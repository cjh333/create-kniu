# 后端 API 技术说明（KniuSystem）

> 需要以 Go、Python、Node.js、Java 等语言重建后端时，请以 [KNIU-API-CONTRACT.md](../!kniu_project/KNIU-API-CONTRACT.md) 为语言无关的行为契约；本文保留当前 PHP 实现、运行和运维说明。

PHP + Composer 轻量框架，提供 JSON API。入口 `api/index.php` 初始化自动加载与 Session、处理 CORS、解析 URI，交由 `Core\Router` 分发到 `api/app/<应用>/Controllers/` 下的控制器。

## 一、本地运行

### 1. 后端（PHP，端口 9900）

```bash
cd api
composer install
composer dump-autoload
php -S localhost:9900 -t .
```

> 阿里云虚拟主机等区分大小写环境：控制器目录名必须首字母大写（`app/admin/Controllers/`），否则无法自动加载。

### 2. 前端（Node，端口 6173）

```bash
npm install
npm run dev
```

前端服务、预览和构建入口通过核心 `kniudotenv.mjs` 先读取项目根目录 `.env`，再应用命令行已有环境变量；`npm run dev` 启动开发服务并按项目配置反向代理 `/api`。Windows 下结束遗留 Node 进程：`npm run kill`。

### 3. 生产构建

```bash
npm run build   # = cross-env PROCESS_ENV=production node client/core/kniubuilder.mjs
```

## 二、HTML 编解码规则（后端全责 · 铁律）

编解码一律在后端完成，前端零参与。任何文本字段都只经过**单轮**编 / 解码，不做重复处理（重复处理是历史脏数据根因）。

| 操作 | 位置 | 行为 |
| --- | --- | --- |
| 增 / 改 | 写库前 | `Controller::encodeFields($data, $fields)`：`htmlspecialchars($str, ENT_QUOTES)` 单轮转码 |
| 查 | 返回前端前 | `Controller::decodeFields($rows, $fields)`：`htmlspecialchars_decode($str, ENT_QUOTES)` 单轮解码；兼容 `find` 单行、`select` 行数组、`null` |
| 删 | — | 不处理 |
| 前端 | 渲染时 | **不做任何编解码**，单元格 / 文本插值直接 `textContent` 直出（已移除 `decodeHtml` 系） |

- 控制器 `input()` 的 `s` 类型返回**原始值**（不转义），与后端统一解码后的结果一致。
- `AuthController::logup()` 等按用户名查询时，查询条件需 `htmlspecialchars($username, ENT_QUOTES)`，与库内编码存储匹配。

### 历史脏数据归一

若怀疑库内仍有旧版反复转义叠加的多层编码字段，当前仓库未提供自动归一脚本；应先备份数据库，再通过部署环境的迁移工具按字段白名单处理，不能在前端补偿编码层数。

- 白名单字段：`tb_daily.cn/en`、`tb_article.title/subtitle/summary/content`、`tb_nav.name/url`、`tb_seo.*`、`tb_role.name`。
- 已接入解码的端点：Daily / Article / Nav / Seo / Role 的 List + Detail，以及 IndexController 的 `getDaily` / `getArticle` / `getDetail`。

## 三、控制器基础能力（`Core\Controller`）

- `encodeFields(array $data, array $fields): array` —— 写库前对指定字段单轮转码（见上）。
- `decodeFields($rows, array $fields)` —— 返回前对指定字段单轮解码（见上）。
- `input()` —— 读取并规范化请求参数；`s` 类型返回原始字符串。
- 统一 JSON 响应封装 `json($data, $msg, $status = ErrorCode::SUCCESS)`，错误码一律取自 `Core\ErrorCode` 常量（见第四节）；响应经前端 `REQUEST` 归一为 `{ status, msg, data, httpStatus, request }`。

## 四、统一错误码

响应体 `status` 是唯一业务结果字段：**`1` 表示成功，其余任何值都表示失败**。前端现有代码统一按 `status === 1` / `!== 1` 判断成败，因此扩展码值天然向后兼容；只有需要特殊交互时才按具体码分支。

码值采用 **4 位分段码**，定义在 `api/core/ErrorCode.php`（`Core\ErrorCode`）：`1xxx` 身份与会话、`2xxx` 请求与业务规则、`3xxx` 目标资源、`4xxx` 服务端。**业务码严禁与 HTTP 状态码同值**（`100`~`599` 不可用）——`201`、`404`、`500` 这类数字会被误读成 HTTP 状态码；4 位码与 3 位 HTTP 码数值上永久隔离，一眼可辨。校验脚本：`php test/check_error_codes.php`。

控制器、`Core\Router`、`Core\Base` 必须引用常量，不得再写字面量数字。语言无关的完整规则见 [KNIU-API-CONTRACT.md](../!kniu_project/KNIU-API-CONTRACT.md) 的 §2.1。

| status | 常量 | 含义 | HTTP | 典型场景 |
| --- | --- | --- | --- | --- |
| `1` | `SUCCESS` | 成功 | 200 | 所有成功响应 |
| `0` | `FAIL` | 通用失败（兜底） | 200 | 暂未细分的失败分支 |
| `1001` | `UNAUTHORIZED` | 登录态无效 | 200 / 401 | 未登录或会话过期；前台 HTTP 200、后台 HTTP 401 |
| `1002` | `FORBIDDEN` | 无权限 | 403 | 普通账号操作他人资源、非管理员调用管理接口 |
| `1003` | `ACCOUNT_DISABLED` | 账号被禁用 | 200 | `is_show=0` 的账号尝试登录 |
| `1004` | `ACCOUNT_MUTED` | 账号被禁言 | 200 | `comment_ban=1` 提交评论或回复 |
| `1005` | `CAPTCHA_INVALID` | 验证码错误或过期 | 200 | 算术验证码、邮箱验证码校验失败 |
| `1006` | `IDENTITY_INVALID` | 身份令牌无效 | 200 | `identity_token` 非法或未绑定账号 |
| `1007` | `CREDENTIAL_INVALID` | 账号或密码错误 | 200 | 登录失败、原密码不正确 |
| `2001` | `PARAM_INVALID` | 参数缺失或格式错误 | 422 | 必填缺失，长度、格式或类型不合法 |
| `2002` | `RULE_REJECTED` | 业务规则拒绝 | 200 | 昵称一年只能改一次、不能给自己点赞或收藏 |
| `2003` | `TOO_MANY_REQUESTS` | 请求过于频繁 | 429 | 邮箱验证码 60 秒内重复发送 |
| `2004` | `UPLOAD_REJECTED` | 上传被拒绝 | 422 | 扩展名、真实 MIME、大小或路径非法 |
| `3001` | `NOT_FOUND` | 资源不存在 | 404 | 文章、评论、账号、配置查不到 |
| `3002` | `CONFLICT` | 资源冲突 | 409 | 账号名、昵称等唯一键重复 |
| `4001` | `SERVER_ERROR` | 服务器内部错误 | 500 | 未捕获异常、数据库写入失败 |
| `4002` | `SERVICE_UNAVAILABLE` | 外部依赖不可用 | 503 | 邮件服务器连接或发信失败 |

使用约定：

- **成功**：`{"status":1,"msg":"…","data":…}`；**失败**：`{"status":<码>,"msg":"…","data":[]}`。
- 业务失败默认 HTTP `200`（含业务码 `3001`/`3002`），错误语义只由 `status` 承载；仅以下场景保留对应 HTTP 码：未登录（后台 `401` + `1001`、前台 `200` + `1001`）、无权限 `403`、频率限制 `429`、服务端 `500`/`503`。
- 路由层 `Core\Router::sendErrorResponse()` 走同一码表：接口不存在 → `3001`，未捕获异常 → `4001`（HTTP 仍为 `404`/`500`）。
- `msg` 只用于展示，前端不得凭文案分支，只能凭 `status`；`1003`/`1004`/`1005`/`2003` 等码可用于驱动刷新验证码、倒计时等交互。
- 新增失败分支必须从 `Core\ErrorCode` 取常量；确实无法归类的才用 `ErrorCode::FAIL`（`0`）。

## 五、接口清单（当前注册于 `api/config/router.php`，均 POST）

**鉴权约定（2026-09-28）**：所有接口默认需要登录鉴权——`Core\Router` 在调用 action 前统一执行 `Core\Controller::requireLogin()`，判定口径 = 后台会话有效（`validateToken()`）或前台身份令牌已绑定 `tb_role` 账号（`currentLoginId()`）。免登录清单的唯一来源是 `api/config/auth.php` 的 `NO_AUTH`（写法 = 接口路径去掉前导斜杠，如 `'getDaily'`）；路由注册处只写「路径 → Controller@action」两个参数、不再接受第三个参数，未登记在 `NO_AUTH` 的接口一律拦截。拒绝响应：后台走 `Core\Base::rejectLogin()`（HTTP 401 + 业务码 `1001`，前端请求层据此跳登录页），前台走 `Core\Controller::rejectLogin()`（HTTP 200 + 业务码 `1001`，避免把游客的公开页面请求打成 401）。**前端页面控制器不做登录判断**：页面照常挂载发请求，请求层收到 `1001` 统一跳 `#/login` 并携带当前页作回跳目标（策略注入见 `client/client.mjs`）。

- 免登录（`api/config/auth.php` 的 `NO_AUTH`）：`/getDaily`、`/getArticle`、`/getInfo`、`/getDetail`、`/getComments`、`/frontRegister`、`/frontLogin`、`/frontBind`、`/frontProfileClear`、`/frontSessionSync`、`/email_code`、`/password_reset`、`/logup`、`/logout`、`/captcha`、`/session_status`。
- 需要登录（默认）：`/getAbout`、`/submitComment`、`/likeComment`、`/deleteComment`、`/likeArticle`、`/favoriteArticle`、`/frontProfile`、`/frontProfileSave`
- 会话与系统：`/logup`、`/logout`、`/captcha`、`/session_status`（免登录）；`/admin`、`/system`（需登录）
- 后台业务（需登录）：SEO、导航、每日内容、文章、角色、评论管理的增删改查，以及 `/about_detail`、`/about_save`、`/clearCache`

所有已登录后台账号均可调用 `/article_add` 新增文章，并可使用 `/article_media_upload` 上传正文媒体；文章编辑、删除、显示状态修改及其他管理操作继续遵循原有权限和文章归属限制。

### 评论接口（公开，POST）

| 端点 | 入参 | 说明 |
| --- | --- | --- |
| `/getComments` | `article_id`（必填）、`identity_token`（可选） | 返回该文章全部**已审核**评论（含回复，`parent_id` 区分），`is_show=1` 过滤，按 `id` 升序；每项含 `{id,userId,isOwn,parentId,replyTo,username,avatar,time,content,likes,liked}`。本人判断只按 `tb_role.id`/`role_id`，昵称仅用于展示 |
| `/submitComment` | `article_id`、`parent_id`、`identity_token`、`message` | 提交评论或回复；禁言账号拒绝提交；其他账号按 `tb_role.comment_audit` 控制显示 |
| `/likeComment` | `comment_id`、`liked`（bool）、`identity_token` | 登录账号按“账号 + 评论 + 服务器日期”记录状态；`true` 点赞、`false` 取消，同一天允许反选后再次点赞；服务端拒绝给本人评论点赞，返回 `{likes,liked,locked}`，当前 `locked` 为 `false` |
| `/deleteComment` | `comment_id`、`identity_token` | 仅允许按当前账号的 `tb_role.id` 删除自己的评论或回复；删除顶层评论时同时删除其回复 |
| `/likeArticle` | `article_id`、`liked`（bool）、`identity_token` | 登录账号按“账号 + 文章 + 服务器日期”记录状态；`true` 点赞、`false` 取消，返回最新 `{likes,liked}`；作者不能给自己的文章点赞 |
| `/favoriteArticle` | `article_id`、`favorited`、`identity_token` | 当前前台用户收藏或取消收藏文章；未登录时拒绝 |
| `/frontProfile` | `identity_token`、需登录 | 返回当前账号的 `{id,name,nickname,is_show,comment_ban,canEditNickname,articleLikeCount,commentLikeCount,commentCount,favorites,history}`；`id` 是 `tb_role.id`，`name` 是账号名，`nickname` 仅用于展示 |
| `/frontProfileSave` | `identity_token`、`nickname`、需登录 | 修改本人昵称：昵称唯一（查重排除自己），未变更直接返回「昵称未变更」，变更间隔一年；昵称仅用于展示，账号唯一标识为 `tb_role.id`，业务关联不依赖昵称。**不再承担建号**——账号创建统一走 `/frontRegister` |
| `/frontProfileClear` | `identity_token` | 统一退出前后台：销毁 `front_token`、`admin_token` 和 Session；不删除数据库账号、不释放昵称 |
| `/frontSessionSync` | `identity_token` | 根据仍有效的后台会话恢复前台身份；资料异常时返回空头像，不应返回 HTML 500 |
| `/frontRegister` | `username,password,confirm,email,email_code,gvcode,identity_token` | 校验算术验证码和邮箱验证码后注册普通账号并绑定前台身份；账号名必须唯一，邮箱允许重复，失败仍返回统一 JSON |
| `/frontLogin` | `username,password,gvcode,identity_token` | 校验算术验证码后登录并绑定前台身份；`is_show=0` 的禁用账号拒绝登录 |
| `/frontBind` | `username,password,identity_token` | 绑定已有账号；切换账号时先解除令牌旧绑定，再写入新账号 |

`/getDetail` 除文章字段外还返回 `previous` 和 `next`，有相邻已显示文章时为 `{id,title}`，没有时为 `null`。相邻顺序按文章 `id`，并过滤 `is_show=1`。成功读取文章时服务端原子增加 `hits`，响应返回递增后的最新值。

账号的 `is_show=0` 在用户管理中表示禁用，禁止登录；`comment_ban=1` 表示禁言，不影响登录、个人中心或发表文章，仅禁止评论和回复提交。

### 评论管理接口（后台，POST，需登录）

| 端点 | 入参 | 说明 |
| --- | --- | --- |
| `/comment_list` | `type`(`all`/`comment`/`reply`)、`audit`(`''`/`0`/`1`)、`keyword`、分页 `page_current`/`page_rows`、`field`/`sort` | 评论/回复列表，按 `parent_id` 区分顶层评论与回复，按 `is_show` 筛待审核/已通过，按 `message` 关键词模糊搜索；管理员可看全部，普通用户按其 `tb_role.id` 匹配本人内容 |
| `/comment_audit` | `id`、`audit`(`0`/`1`) | 审核评论：`audit=1` 通过（前台可见）、`0` 隐藏/撤回；需管理权限 |
| `/comment_delete` | `id` | 删除评论；管理员可删除全部，普通用户可删除自己的评论/回复；**删除顶层评论会级联删除其下全部回复**；需登录并按 `tb_role.id` 校验归属 |
| `/comment_detail` | `id` | 查询单条评论（`decodeFields` 后返回） |
| `/comment_reply_state` | 无 | 返回当前账号收到的已审核未读回复 `{has_unread,unread_count}`；只统计其他用户直接回复本人评论或回复的记录 |
| `/comment_reply_read` | 无 | 将当前账号已经收到的全部已审核回复标记为已读 |
| `/comment_reply_update` | `id`、`is_read`(`0`/`1`) | 修改单条回复对其接收人的读取状态；管理员可管理全部，普通用户只能修改发给本人的回复 |

`tb_comment` 为评论表，`article_id` 关联 `tb_article.id`，`role_id` 直接关联统一账号 `tb_role.id`；`parent_id` 为 0 表示顶层评论，大于 0 表示回复。后台 `/comment` 固定管理顶层评论，`/reply` 固定管理回复，两页共用接口并直接按 `tb_role.id` 判断权限。

`tb_comment_reply_status` 按“回复 ID + 接收账号的 `tb_role.id`”保存逐条读取状态。后台头部在首次加载、收到 `reply-refresh` 信号或显式状态变更时检查；红点仅表示存在其他用户发给本人的已审核新回复，点击后进入回复管理并将当前已接收回复批量设为已读。回复管理中的读取状态开关与红点使用同一份数据。

后台 `/logup` 收到 `identity_token` 并验证账号成功后，同时写入 `admin_token`、`front_token`，并把该浏览器令牌写入对应 `tb_role.identity_token`，因此后台登录成功即同步为前台登录状态。
前台 `kniu-user-login` 初始化时调用 `/frontSessionSync`；若后台 Session 仍有效，则服务端按当前 `tb_role` 账号恢复前台身份。这样从后台“前端首页”新标签打开时不依赖旧标签的本地状态传播。
应用启动使用公开的 `/session_status` 安静探测后台会话；未登录返回 HTTP 200 和 `{loggedIn:false}`。受保护的 `/system` 只在已登录后台读取，不再承担登录探测，避免正常未登录状态产生 401 控制台错误。
`tb_article_favorite` 记录前台用户与文章的收藏关系，`role_id + article_id` 使用唯一索引防止重复收藏。
`tb_article_history` 记录用户最后浏览文章的时间，同一用户同一文章只保留一条；读取个人中心或新增浏览时自动删除一年前的记录。

前台身份与后台账号通过 `tb_role.id` 关联。账号创建只有两条路径：前台 `/frontRegister`（邮箱验证码注册，`role=2`、`role_auth=2`）与后台用户管理；昵称仅用于展示，只有管理员可以更改角色和权限，普通用户可在后台用户管理中修改自己的密码。

前台 `/getAbout` 需要登录，仅返回当前账号（后台会话账号或身份绑定账号）的 `tb_about.content`；网站 SEO 设置不再保存“关于我”内容。未登录不再回退任何内容，由全局鉴权闸门直接拒绝。

## 权限与数据归属（2026-09-02 多账号重构）

系统由单一管理员扩展为多账号按角色隔离数据：

- `tb_role.role=1` 为管理员（`role_auth=1`），可见全量数据；`role=2` 为普通用户（`role_auth=2`），只能查看和操作自己的数据。
- 数据归属：`tb_article.role_id`、评论/收藏/浏览历史的 `role_id` 均关联 `tb_role.id`；`tb_about.role_id` 关联 `tb_role.id`（“关于我”按账号存储，`uk_about_role` 唯一键防重复）；回复状态的接收人字段同样保存 `tb_role.id`。前台身份字段统一保存在 `tb_role`。
- 后台会话 `admin_token` 内含 `id`，核心辅助 `Base::currentUserId()` / `isAdmin()`；`/logup` 登录响应同样返回 `id`。
- 普通用户：文章列表/详情按 `role_id` 过滤，增改删只能操作自己的文章；角色列表只见自己；评论列表只见自己的评论（行内附 `is_own`），只能删除自己的评论；批量删除仅管理员可用。
- “关于我”：后台 `/about_detail` 读本人 `tb_about` 的 `avatar`、`summary`、`content`，`/about_save` 保存三者（存在更新、不存在插入）；`tb_about` 使用 `create_time` / `issue_time` 记录创建和发布时间；首页 `/getInfo` 在浏览器持有合法 `identity_token` 且账号已绑定（`role_id>0`）时使用本人的头像和简介，否则回退默认值，并返回公开 SEO 的 `title`、`logo`、`copyright`、`icp`；前台 `/getAbout` 需要登录，返回关于页内容（未登录被全局鉴权闸门拒绝）。
- 身份绑定：`POST /frontBind`（入参账号密码与 `identity_token`）校验账号密码后绑定前台身份并建立前台会话（个人中心入口，无需验证码）；前台会话 `front_token` 与后台 `admin_token` 完全独立。令牌从旧账号切换到新账号时必须先以 SQL `NULL` 解除旧绑定。
- 前台注册：`POST /frontRegister` 校验 `username`、`password`、`confirm`、`email`、`email_code`、`identity_token` 及算术验证码后，在 `tb_role` 创建普通账号并按 `tb_role.id` 绑定前台身份；邮箱统一转小写但允许重复，账号名必须唯一；异常统一返回 JSON，不输出 HTML 500。
- 当前数据库建表与初始化数据基线统一位于 `!kniu_project/kniusql/`；历史迁移脚本不属于当前仓库基线，恢复数据前应先备份并按部署记录执行迁移。

## 六、新增接口

1. 在 `api/config/router.php` 注册路由 → 控制器方法映射。
2. 控制器放入对应应用目录：`api/app/index/Controllers/`（公开）或 `api/app/admin/Controllers/`（后台）。
3. 文本字段写库走 `encodeFields()`、返回走 `decodeFields()`；不要在控制器里手动 `htmlspecialchars` / `htmlspecialchars_decode` 以免重复。

## 七、上传与安全约定

- `/seo_update` 使用 `multipart/form-data`，Logo 文件字段为 `logo`；已有图片可提交 URL，空字符串表示清空。SEO ICP 备案字段统一为 `icp`，不再使用 `record`。
- `/article_update` 的封面字段为 `cover`；`/article_media_upload` 的即时媒体字段为 `file`。
- 上传同时校验扩展名、客户端 MIME、`finfo` 真实 MIME 和大小，文件名由服务端生成。
- 后台依赖 Session、同源 CSRF 校验和角色授权；角色及缓存管理仅管理员可用。
- Session Cookie 名优先读取项目 `.env` 的 `SESSION_NAME`；未设置或格式不正确时，由核心 `SessionName` 首次生成 `KNIU_` 加 48 位随机哈希并保存到 `api/runtime/session/session.name`，后续稳定复用，避免同一主机上的项目互相覆盖登录态。
- 后台登录有效期统一读取 `api/config/auth.php` 的 `LOGIN_EXPIRE_DAYS`（默认 7 天），并同步用于持久 Session Cookie、Session 回收期限和 `admin_token.expire`；应用启动时以 `/system` 返回结果恢复登录状态。
- 前后端入口都会先读取项目根目录 `.env`；`PROCESS_ENV` 同时作为前端运行环境和后端 `APP_ENV` 的默认来源，外部进程已显式设置的同名变量优先。
- 排序字段只能是合法 SQL 标识符，方向只能是 `ASC` 或 `DESC`。

## 八、邮件与邮箱验证码

### 配置项（项目根 `.env`，PHP 由 `Core\Env::load()` 自己读取，不依赖 Node 注入）

| 变量 | 说明 | QQ 邮箱示例 |
|---|---|---|
| `MAIL_HOST` | SMTP 主机 | `smtp.qq.com` |
| `MAIL_PORT` | 端口 | `465` |
| `MAIL_ENCRYPTION` | `ssl`（465 直连 TLS）/ `tls`（587 STARTTLS）/ `none` | `ssl` |
| `MAIL_USERNAME` | 发信邮箱账号 | `123456@qq.com` |
| `MAIL_AUTH_CODE` | **授权码**，不是邮箱登录密码 | 16 位授权码 |
| `MAIL_FROM_ADDRESS` | 发件地址，留空则取 `MAIL_USERNAME` | 同账号 |
| `MAIL_FROM_NAME` | 发件人显示名 | `KniuSystem` |
| `MAIL_CAFILE` | 根证书包路径，留空则用内置 `api/config/cert/cacert.pem` | 一般不用改 |

- `MAIL_USERNAME` 或 `MAIL_AUTH_CODE` 为空时走兜底：开发环境把邮件内容写入 `api/runtime/mail/mail-YYYY-MM-DD.log` 并返回 `dev=true`，生产环境直接失败。接口 `dev=true` 时前端必须以 warning 提示「邮件未实际发送」，不能显示「已发送」误导用户。
- QQ 邮箱需在「设置 → 账户」开启 SMTP 服务并生成 16 位授权码；`MAIL_AUTH_CODE` 填的是授权码。

### 接口

| 接口 | 用途 | 关键校验 |
|---|---|---|
| `POST /email_code` | 发验证码：`email` + `scene`（`register`/`reset`） | register 场景允许重复邮箱，reset 场景拒绝未注册邮箱；同邮箱同场景 60 秒重发限频；失败锁定期间禁发新码 |
| `POST /password_reset` | 重置密码：`username` + `email` + `code` + `password` + `confirm` | 按「账号 + 邮箱」双条件定位账号（邮箱允许多账号复用，仅按邮箱会重置到同邮箱其他账号）、校验验证码、成功后直接设新密码，不需要原密码 |

### 实现要点

- `Core\Mailer`：原生 socket SMTP，无第三方依赖；`AUTH LOGIN` 认证，主题与正文 UTF-8 走 base64 编码避免中文乱码。
- `Core\EmailCode`：验证码只以 sha256 摘要入库，明文仅出现在邮件正文；同邮箱同场景只保留最新一条；`verify()` 只校验不消费，业务成功后才 `consume()` 落库标记已用。
- **验证码防爆破锁定**：同一验证码连续校验失败达到上限（`CODE_FAIL_LIMIT`，默认 5 次）后，按「邮箱 + 场景」维度锁定 `CODE_LOCK_SECONDS`（默认 600 秒），锁定期内禁止校验与重发（防止「重新发码绕过锁定」），正确码在锁定期内同样被拒。失败计数与锁定时间存于 `tb_email_code` 的 `fail_count`/`lock_until` 列，随 `prune()` 过期清理。
- **TLS 必须用项目自带根证书包**：Windows 版 PHP 常未配置 `openssl.cafile`，此时 `stream_socket_client('ssl://...')` 会静默失败（返回 false、`errno=0`、`errstr` 为空字符串），现象是「无法连接邮件服务器」但 TCP 其实是通的。`Mailer::sslContext()` 会显式挂上 `api/config/cert/cacert.pem`（可由 `MAIL_CAFILE` 覆盖）并强制 `verify_peer=true`。证书过期或换机器时，重新导出系统信任根证书到该路径即可。
