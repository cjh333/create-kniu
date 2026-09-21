# KniuSystem 全项目优化审计报告

> 审计时间：2026-09-16
> 范围：前端 `client/`（controller / core / views）+ 后端 `api/`（PHP 控制器 / core / config）
> 方法：通读架构与关键运行路径，定位真实瓶颈与可落地优化点，不臆测。

---

## 一、结论速览

| # | 优化项 | 类型 | 收益 | 工作量/风险 | 是否该做 |
|---|--------|------|------|------------|---------|
| 1 | 后台回复通知由轮询改为 SSE 信号 + 状态接口 | 实时性/后端负载 | 高（红点近实时且避免无意义轮询） | 已完成 | ✅ 已落地 |
| 2 | 富文本/大文本「序列化+清洗」移到 Web Worker | 主线程流畅度 | 中（编辑/评论大内容时不再卡顿输入） | 低 / 低 | ✅ 推荐 |
| 3 | 评论/敏感词过滤批量处理下沉 Worker | 主线程流畅度 | 低-中 | 低 / 低 | 视数据量 |
| 4 | 图片上传前压缩/预处理 | 带宽/上传速度 | 中 | 中 / 中 | 可选 |
| 5 | 538KB 主 JS 瘦身（按需、gzip、去重复） | 首屏加载 | 中 | 中 / 中 | ✅ 推荐 |
| 6 | 服务端静态资源 HTTP 缓存 + gzip | 加载速度/带宽 | 已落地 | — | ✅ 已完成 |
| 7 | PHP 侧重复逻辑收敛（关键词 LIKE/统一账号映射/验证码/通知 SQL） | 可维护性 | 中 | 低 / 低 | ✅ 推荐 |
| 8 | 前端 CRUD 交互工厂已落地（上一轮） | — | 已做 | — | 完成 |
| 9 | 首页时钟 setInterval(1000) 与富文本防抖——维持现状 | — | 现状合理 | — | 不折腾 |

---

## 二、前后端架构现状（决定优化可行性的基础）

```
浏览器
  │  fetch  (POST, /api/*) + EventSource (/events) ← 请求/响应与单向信号并存
  ▼
Node 服务端  client/core/kniuserver.mjs  (6173)
  │  开发态：直出 client/ 下的源码；生产态：直出 dist/
  │  静态资源 + /templates.js
  │  /api/* → 反向代理  →  PHP  api/index.php (9900)
  ▼
PHP 后端  api/app/{admin,index}/Controllers，Db(PDO/mysqli) → MySQL
```

- Node 侧是**长驻进程**（dev 与 prod 都用它当 Web 服务 + 反代），同时提供 `/events` SSE 长连接和回环通知入口 `/__notify`。
- PHP 会话：Cookie 名 `KNIU_<48hex>`（`api/core/SessionName.php`），session 文件在 `api/runtime/session/sess_<id>`。含 `admin_token`（后台）与 `front_token`（前台）两套独立会话，见 `api/index.php` 与 `Controller.php::validateToken()`。
- 身份同步：登录/登出跨标签靠 `storage` 事件（`kniuauth.mjs:113`）；前台身份变化发 `kniu-identity-change`；后台回复通知变化发 `kniu:reply-notification-change`。

> 结论：跨标签靠事件 + storage；跨账号回复通过 Node SSE 信号唤起前端，再由前端调用受保护的状态接口读取真实数据。SSE 已覆盖当前单向通知需求，不需要 WebSocket。

---

## 三、通知实时性现状

### 3.1 已落地的 SSE 链路

当前通知中心由 `client/core/kniunotify.mjs` 单例维护一个 `EventSource('/events')`，开发服务器和预览服务器都直接返回 `text/event-stream`。Node 端的 `/__notify` 只接受本机回环通知，并广播两类轻量信号：

- `reply-refresh`：回复审核或回复状态变化后，后台头部重新调用 `POST /comment_reply_state`。
- `data-change`：写库后的数据版本信号，页面按需增量刷新自己的数据源。

`headerController` 在首次挂载时读取一次状态，之后只由 SSE 或显式本地事件触发，不再设置 60 秒无条件轮询；请求层仍保留并发去重窗口，避免同一信号造成重复请求。SSE 只传“需要刷新”的信号，不携带账号或评论内容，真实数据始终由 PHP 接口按当前会话返回。

### 3.2 鉴权与故障边界

- `/events` 只建立同源单向连接，不替代 PHP 的身份鉴权。
- `/comment_reply_state`、`/comment_reply_read`、`/comment_reply_update` 仍由后端校验当前 `tb_role.id` 和管理员权限。
- `/__notify` 仅允许本机回环请求；不能开放为公网广播入口。
- EventSource 断线由浏览器自动重连；若浏览器不支持 EventSource，页面只能依靠显式刷新或业务接口的低频兜底，不得把 HTML 页面误当作事件流返回。

### 3.3 当前不建议扩展的场景

- 前台文章详情页的评论实时更新：当前进入详情和提交成功后局部刷新已经足够。
- 收藏数与点赞数实时推送：操作者直接使用接口返回值局部更新即可。
- WebSocket 双向通信：只有在线协作或聊天等双向需求出现时再单独评估。

---

## 四、前端能否用 Web Worker —— 分析与落地建议

### 4.1 关键事实

- `kniuui.js` 源码约 **541KB**（一个文件承载所有组件），当前 dist 主 bundle **约 526KB**（`dist/views/client.169dfa571c.js`）；`kniutemplate.mjs` 约 62KB，生产模板 bundle 约 78KB。
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

### 5.1 静态资源缓存与压缩（已落地）

`client/core/kniustatic.mjs` 已统一处理静态资源缓存和 gzip：HTML、模板清单及开发态源码继续使用 `no-store`；生产态文件名带内容哈希的 JS/CSS/图片等资源使用 `Cache-Control: public, max-age=31536000, immutable`。生产环境在客户端声明支持 gzip 且响应体超过 1KB 时压缩可压缩文本资源。

维护时只需同步修改 `kniustatic.mjs` 的缓存命中规则；不要把 `/index.html`、`/templates.js` 或用户上传内容改成长期 immutable 缓存。

### 5.2 gzip / Brotli

- gzip 已由 Node 静态发送层在生产环境按需启用；当前未引入 Brotli，是否增加需单独评估兼容性和部署收益。
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
- 统一账号 ID 映射：所有文章、评论、资料、收藏和历史均使用 `role_id → tb_role.id`
- 算术验证码校验块：`AuthController::logup` / `IndexController`（frontProfileSave / verifyFrontCaptcha）3 处近似重复
- 回复状态 3 段相同的复杂 join SQL（`CommentController::commentReplyState/Read/Update` 内）——可继续抽到公共查询方法；SSE 只负责触发刷新，不改变权限查询。

### 6.3 会话/权限
- 现状合理（前后台会话隔离、`Base`（`api/core/Base.php`）统一鉴权）。若上 WS/SSE，注意**不要**为长连接暴露新鉴权漏洞：SSE/WS 端点必须复用 `validateToken` 同等的 session 校验，不能让"能连上长连接"绕过登录。

---

## 七、可落地优化清单（按优先级）

### 第一优先（低成本高收益，建议本轮或下轮做）
- [ ] P1 静态资源强缓存（带哈希资源 immutable）+ HTML 保持 no-cache
- [ ] P1 prod 开启 gzip（预压缩 dist）
- [x] P1 前端 CRUD 交互工厂（已做）——保持用
- [ ] P1 后端重复函数收敛到 core（关键词 LIKE / 统一账号 ID / 验证码 / 通知 join SQL）

### 第二优先（实时性，已完成的维护项）
- [x] P2 通知中心：SSE 单向推送（Node `/events` + `kniunotify.mjs` 单例），替代 header 的 60 秒无条件轮询
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

> 项目当前是**干净的请求/响应 + 事件驱动**架构，静态资源哈希缓存、生产 gzip 和回复通知 SSE 已落地，无脏轮询之外的真实时性欠账，也几乎没有计算热点。下一步收益主要来自按需拆分 `kniuui.js` 和针对富文本大内容的异步清洗；**WebSocket 双向暂不需要**，SSE 已覆盖当前唯一单向需求。
