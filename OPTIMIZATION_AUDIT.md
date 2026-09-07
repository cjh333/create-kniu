# KniuSystem 全项目优化审计报告

> 审计时间：2026-09-03
> 范围：前端 `client/`（controller / core / views）+ 后端 `api/`（PHP 控制器 / core / config）
> 方法：通读架构与关键运行路径，定位真实瓶颈与可落地优化点，不臆测。

---

## 一、结论速览

| # | 优化项 | 类型 | 收益 | 工作量/风险 | 是否该做 |
|---|--------|------|------|------------|---------|
| 1 | 后台"回复通知"60s 轮询 → WebSocket 推送 | 实时性/后端负载 | 高（红点从 ≤60s 延迟降到近实时，去掉无意义轮询） | 中 / 中 | ✅ 推荐 |
| 2 | 富文本/大文本「序列化+清洗」移到 Web Worker | 主线程流畅度 | 中（编辑/评论大内容时不再卡顿输入） | 低 / 低 | ✅ 推荐 |
| 3 | 评论/敏感词过滤批量处理下沉 Worker | 主线程流畅度 | 低-中 | 低 / 低 | 视数据量 |
| 4 | 图片上传前压缩/预处理 | 带宽/上传速度 | 中 | 中 / 中 | 可选 |
| 5 | 450KB 主 JS 瘦身（按需、gzip、去重复） | 首屏加载 | 中 | 中 / 中 | ✅ 推荐 |
| 6 | 服务端静态资源 HTTP 缓存 + ETag（当前全 NO_CACHE） | 加载速度/带宽 | 高（当前每次重下） | 低 / 低 | ✅ 推荐 |
| 7 | PHP 侧重复逻辑收敛（关键词 LIKE/前台用户映射/验证码/通知 SQL） | 可维护性 | 中 | 低 / 低 | ✅ 推荐 |
| 8 | 前端 CRUD 交互工厂已落地（上一轮） | — | 已做 | — | 完成 |
| 9 | 首页时钟 setInterval(1000) 与富文本防抖——维持现状 | — | 现状合理 | — | 不折腾 |

---

## 二、前后端架构现状（决定优化可行性的基础）

```
浏览器
  │  fetch  (POST, /api/*)          ← 全部为请求/响应，全项目无 WS/SSE/EventSource
  ▼
Node 服务端  client/core/kniuserver.mjs  (6173)
  │  开发态：直出 client/ 下的源码；生产态：直出 dist/
  │  静态资源 + /templates.js
  │  /api/* → 反向代理  →  PHP  api/index.php (9900)
  ▼
PHP 后端  api/app/{admin,index}/Controllers，Db(PDO/mysqli) → MySQL
```

- Node 侧是**长驻进程**（dev 与 prod 都用它当 Web 服务 + 反代），天然可作为 WebSocket 网关宿主。
- PHP 会话：Cookie 名 `KNIU_<48hex>`（`api/core/SessionName.php`），session 文件在 `api/runtime/session/sess_<id>`。含 `admin_token`（后台）与 `front_token`（前台）两套独立会话，见 `api/index.php` 与 `Controller.php::validateToken()`。
- 身份同步：登录/登出跨标签靠 `storage` 事件（`kniuauth.mjs:113`）；前台身份变化发 `kniu-identity-change`；后台回复通知变化发 `kniu:reply-notification-change`。

> 结论：跨标签已靠事件 + storage 做到"即时"；但**跨账号**（别人回复了我）目前只能靠轮询/重新聚焦/事件，这正是 WebSocket 的价值所在。

---

## 三、前端能否用 WebSocket —— 分析与落地建议

### 3.1 现有轮询（最该替换的点）

`client/controller/admin/headerController.js:90-112`：

```js
onMounted(function () {
  loadReplyNotification();                          // 首次拉
  const notificationTimer = setInterval(loadReplyNotification, 60000); // ← 每 60s 轮询
  const handleVisibility = function () {
    if (document.visibilityState === 'visible') loadReplyNotification();
  };
  document.addEventListener('visibilitychange', handleVisibility);
  globalThis.addEventListener('kniu:reply-notification-change', loadReplyNotification);
  ...
});
```

- 接口：`POST /reply_notification_state`（`CommentController::replyNotificationState`）。
- 问题：后台所有在线的管理/普通账号只要停留在后台壳层，就会每 60s 打一次该接口；而这条数据只有在"别人回复了你"时才变化。多数请求是"空轮询"。
- 另外：后台/前台是两个标签页时，即便前台有新评论，后台红点也要等 60s 或手动刷新/切回才更新。

### 3.2 推荐方案（Node 网关 + 推送 + 兜底轮询降频）

| 层 | 做法 |
|----|------|
| 连接 | 浏览器 → `ws://host:6173/ws`（与页面同源，Cookie 自动带上，无需改鉴权跨域） |
| 网关宿主 | 在 `kniuserver.mjs` 里用 `ws` 库（或原生 `http` upgrade）开一个 WS 端点 |
| 握手鉴权 | Node 读到请求 Cookie 中的 `KNIU_...` session id，去 `api/runtime/session/sess_<id>` 校验 `admin_token.id` / `front_token.id`（Node 直读 PHP session 文件，绕开一次 HTTP） |
| 订阅语义 | 客户端发 `{type:'subscribe', channel:'reply:<roleId>'}` 或按 `front_user_id`；Node 按"接收人"建频道索引 |
| 事件来源 | 两种：①PHP 写评论/审核通过后，由 Node 推送；②最简方案：PHP 端在 `submitComment`/`replyNotification` 落库后，让 Node 触发一次订阅者刷新 |
| 兜底 | 保留一个低频心跳轮询（如 5~10 分钟）或 `visibilitychange` 重新拉取，防止 WS 断线漏消息；WS 断开自动重连 + 指数退避 |

**跨账号即时"回复我"的完整链路**（以最简、对现有代码侵入最小为原则）：
1. `CommentController::replyNotificationState` 现成可复用作兜底。
2. Node 网关维护 `Map<recipientId, Set<ws>>`。
3. 推送触发点（任选其一，推荐 A）：
   - **A（推荐，后端无感知）**：Node 网关在收到"回复状态变更"信号后，调用 PHP 现有查询、把 `{has_unread:true}` 推给该 recipient 的所有连接。信号来源可以是 PHP 在 `submitComment` 后向 Node 的一个内部端点 POST（内网本机，无鉴权风险）。
   - **B**：直接读库触发（PHP 写库后 `exec("curl ... /_ws_emit")`，跨进程触发，运维稍繁琐）。
4. 客户端 `headerController` 收到推送 → 复用现有 `syncNotificationBadge(true,count)` → 红点即时亮起，`setInterval(60s)` 可降为低频心跳或直接删除（保留 `visibilitychange` 兜底）。

> 冒烟：Node 与 PHP 分进程，务必用**内网本机回环**做触发，不要经公网/代理；会话文件直读需与 `SessionName::resolve` + `session.save_path` 对齐（当前已固定到 `api/runtime/session`，Node 可直读）。

### 3.3 其它可用到 WS/SSE 的场景（暂不需要，列为可扩展）

- 前台文章详情页的"评论实时更新"（多人围观时）——当前 `getComments` 是进页面拉一次 + 自己提交后刷新，暂无他人评论实时需求，**不建议现在做**。
- 收藏数/点赞数实时——由操作者自身响应即更新，无需推送。
- **若只想要"服务端→浏览器单向"，SSE（`EventSource`）比 WS 更简单**：浏览器一行、服务端普通 HTTP 长连接，天然带重连，不需要 `ws` 握手子协议。本项目"红点推送"是纯单向，**SSE 其实是最省事的首选**；只有未来要双向（在线编辑协作、聊天）才值得上 WS。

> 结论：**实时性场景真实存在且只有一处（回复通知红点）**。建议先做 **SSE**（单向够用、实现最简），架构上把"通知中心"做成 `client/core/kniunotify.mjs` 单例，Node 端开 `/api/notify` 长连接端点，PHP 写库后由 Node 触发。WebSocket 留到有双向需求再上，避免过度设计。

---

## 四、前端能否用 Web Worker —— 分析与落地建议

### 4.1 关键事实

- `kniuui.js` 源码 **492KB**（一个文件承载所有组件），dist 主 bundle **~450KB**（`dist/views/client.b9a4ad5b4c.js`）；`kniutemplate.mjs` 62KB（响应式/模板编译）。
- 模板编译、响应式代理、Shadow DOM 渲染、富文本编辑器等都**重度依赖 DOM**，**无法**也不应塞进 Worker（Worker 无 DOM，靠 postMessage 传结构体，传输本身也有开销）。
- 已确认纯函数工具（`kniuutil.mjs` 的 debounce/throttle/updateListRecord 等）本就是 O(1)/轻量，无需 Worker。

### 4.2 真正适合 Worker 的负载

| 候选 | 现状 | 是否值得 |
|------|------|---------|
| 富文本「序列化 → HTML + 白名单清洗」| `kniusanitizer.mjs::sanitizeRichHtml` 用 DOM 清脚本/事件属性。大文章（几百 KB）在主线程做会卡 | ✅ 大内容值得；小内容不用 |
| 评论/敏感词批量过滤（`kniu-comment` filter）| 主线程逐条正则 | 低-中：数据量大才值得 |
| 图片上传前压缩（缩到限制尺寸/质量）| 直接原图上传（`buildMultipartFormData`）| 中：上传带宽/后端压力 |
| 浏览历史/收藏大批量派生字段映射 | 小，不值得 | ❌ |
| 模板/响应式编译 | DOM 相关 | ❌ 不要动 |

### 4.3 推荐落地（小步、可回退）

1. 建 `client/core/kniuworker.mjs`：封装"创建 Worker + postMessage 往返 Promise + 错误/超时兜底（Worker 不可用时自动回主线程执行）"。
2. 第一个接 Worker 的点：**富文本保存前清洗 + 长度统计**。把 `sanitizeRichHtml` 挪进一个 Worker 脚本（脚本内用 `DOMParser`/手动解析，因为 Worker 无 document，需重写为字符串级清理，或用 `OffscreenCanvas` 无关的纯字符串处理）。**注意**：现有 `sanitizeRichHtml` 依赖 `document.createElement('template')`，Worker 里没有，需先做"字符串级等价实现"并保持白名单一致——这是主要成本点。
3. 若嫌改动大，**退而求其次**：大清洗保持主线程但用 `requestIdleCallback`/`nextTick` 切分（避免一次同步卡死），收益接近、零 Worker 复杂度。

> 结论：**Worker 有价值但适用面窄**。本项目主线程真正的痛点不在计算，而在"一次 bundle 太大 + 富文本偶发大内容"。优先把富文本清洗做成**可切分/异步**；确需 Worker 时，`kniusanitizer` 是最干净的切入点（唯一无 DOM 依赖难点的模块）。**不建议**为 UI 渲染引入 Worker（Shadow DOM 本质绑定主线程）。

---

## 五、服务端与传输层优化（性价比最高，建议最先做）

### 5.1 静态资源缓存缺失（高收益低风险）

`kniuserver.mjs` 对所有响应（含 CSS/JS/图片）一律 `Cache-Control: no-store`（`NO_CACHE`，见 81-84 行、132 行）。生产态 `dist/` 文件名带内容哈希（`client.b9a4ad5b4c.js`），**非常适合强缓存**，现在却每次重新下载 450KB。

建议：对 `dist/` 下带哈希的静态资源发 `Cache-Control: public, max-age=31536000, immutable`；对 `/index.html`、`/templates.js` 维持 `no-cache`（HTML 需实时）。改造集中在 `kniuserver.mjs` 的静态分支，风险极低。

### 5.2 gzip / Brotli

- dev 不必；**prod 建议**：`dist` 预压缩（gzip/brotli）或 Node 侧 `zlib` 动态压缩 JS/CSS/HTML（>1KB 才压）。450KB JS 压缩后通常 <120KB，首屏明显变快。
- 注意当前经反代转发 PHP 响应，压缩应只针对 Node 直出的静态资源，勿压缩 API JSON（后端已在 `index.php` 处理 CORS/头，避免重复 Content-Encoding）。

### 5.3 主 bundle 瘦身（450KB 是一个体量信号）

- 现有已按 controller 动态 `import()`（`kniumvvm.mjs::loadController`），路由级拆包是对的。剩下大头是 **`kniuui.js` 全量进主包**。
- 可选项：esbuild 拆 `kniuui.js` 为「核心必需」+「按需组件 chunk」（编辑器/日期/富文本等大件路由级懒加载）。**成本中、收益中**，属大重构，建议单独立项评估，不做一次性冒险。

---

## 六、后端（PHP）优化点

### 6.1 数据访问与查询
- `Db` 每请求新建连接/或连接池复用？建议核对 `Db.php` 是否用持久连接或连接复用（多并发时避免频繁建连）。若默认每次 `new mysqli`，可评估 `mysqli.persist`/pdo 复用。
- `IndexController::getDetail` 对一次详情做了 `inc hits` + 查文章 + 查历史 + 查收藏 + 查上/下一篇，约 5~6 次查询；可合并上/下篇为一次 `(id< ? ORDER BY id DESC LIMIT 1) UNION (id>? ...)`，或至少确认命中唯一主键的多次查询可接受。

### 6.2 重复逻辑收敛（上轮调研未动，本轮列为待办）
- 关键词模糊 LIKE 编码段（4 处）：`Article/Comment/Daily/Role`
- 前台用户 ID 映射 `role_id → tb_front_user.id`：`CommentController` + `AuthController` 等多处
- 算术验证码校验块：`AuthController::logup` / `IndexController`（frontProfileSave / verifyFrontCaptcha）3 处近似重复
- 回复通知 3 段相同的复杂 join SQL（`CommentController::replyNotificationState/Read/Update` 内）——**这是 WebSocket 推送改造时最该顺手抽公共方法的地方**。

### 6.3 会话/权限
- 现状合理（前后台会话隔离、`Base`（`api/core/Base.php`）统一鉴权）。若上 WS/SSE，注意**不要**为长连接暴露新鉴权漏洞：SSE/WS 端点必须复用 `validateToken` 同等的 session 校验，不能让"能连上长连接"绕过登录。

---

## 七、可落地优化清单（按优先级）

### 第一优先（低成本高收益，建议本轮或下轮做）
- [ ] P1 静态资源强缓存（带哈希资源 immutable）+ HTML 保持 no-cache
- [ ] P1 prod 开启 gzip（预压缩 dist）
- [ ] P1 前端 CRUD 交互工厂（已做，见 SKILL #98）——保持用
- [ ] P1 后端重复函数收敛到 core（关键词 LIKE / 前台用户 ID / 验证码 / 通知 join SQL）

### 第二优先（实时性，值得做但要先定方向）
- [ ] P2 通知中心：**先 SSE 单向推送**（Node 端 `/api/notify` + `kniunotify.mjs` 单例），替换 `headerController` 的 60s 轮询为「SSE + 低频心跳 + visibilitychange 兜底」
- [ ] P2 富文本保存前清洗改为异步切分或 Worker 化（先做异步切分，成本最低）

### 第三优先（大工程，单独立项评估）
- [ ] P3 kniuui.js 按组件分包 / 主 bundle 进一步瘦身
- [ ] P3 图片上传前压缩
- [ ] P3 WebSocket 双向（仅当出现协作/聊天需求）

---

## 八、不建议做的（避免过度优化）

- 用 WebSocket 推"点赞数/收藏数"——操作者自响应即够，属过度设计。
- 前台评论实时刷新——当前无"围观他人评论"需求，纯增复杂度。
- 把响应式/模板编译/Shadow DOM 渲染搬 Worker——本质绑主线程，搬不动也无效。
- 首页 1s 时钟——`setInterval(1000)` 更新本地时间戳成本可忽略，无需 worker。
- 为几十条以内的列表/清洗上 Worker——postMessage 往返开销反而更大，数据量不够不上。

---

## 九、一句话总结

> 项目当前是**干净的请求/响应 + 事件驱动**架构，无脏轮询之外的真实时性欠账，也几乎没有计算热点。**最值得做的**是「静态资源缓存/gzip」这类传输层优化（立刻见效）与「回复通知红点用 SSE 替代 60s 轮询」这一处真实实时场景；**Web Worker 仅富文本大内容清洗一处值得、且建议先用异步切分过渡**；**WebSocket 双向暂不需要**，SSE 已覆盖当前唯一单向需求。
