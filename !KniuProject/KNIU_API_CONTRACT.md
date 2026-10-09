# KniuSystem 通用 API 契约

本文件定义 KniuSystem 后端的语言无关行为契约。任何 PHP、Go、Python、Node.js、Java 或其他实现，只要保持本文件的 HTTP 路径、字段、响应、鉴权、权限和状态规则一致，即可替换现有后端。

实现专用的启动、ORM、Web 框架、Session 库和数据库驱动不属于本契约。

## 1. 项目目录与文件归位

不同语言可以使用等价的目录命名，但恢复、迁移或新增文件时必须按职责归位，不能把业务、配置、运行数据和依赖混放。

| 目录 | 作用 | 恢复或新增内容应放置的位置 |
| --- | --- | --- |
| `api/` | 后端根目录与 HTTP 入口 | 应用入口、依赖清单、后端运行说明放在此层；不要放业务控制器或运行时数据 |
| `api/app/` | 业务应用层 | 按访问边界分组：`admin/` 为需要后台会话的管理业务，`index/` 为公开或前台身份业务；各自内部放路由动作、领域服务和业务 DTO |
| `api/config/` | 非敏感默认配置 | 路由、认证、角色、数据库配置模板、邮件和上传策略、证书配置放这里；真实密钥只放环境变量或未提交的环境文件 |
| `api/core/` | 语言/框架无关的基础能力 | 请求解析、统一响应、鉴权、数据库抽象、密码哈希、验证码、邮件、上传、缓存、数据通知等公共能力放这里；不得在此处放页面专属业务 |
| `!kniu_project/kniusql/` | 数据库初始化与迁移基线 | `kniu_create_tb_*.sql` 放建表基线，`kniu_insert_tb_*.sql` 放初始化数据；结构变更同时更新本目录与数据迁移方案 |
| `api/assets/` | 后端静态资源 | 验证码字体、服务端模板、固定资源等非用户上传内容放这里 |
| `api/runtime/` | 可再生的运行时数据 | `cache/`、`session/`、日志、开发邮件和临时文件放这里；恢复代码时不应覆盖生产运行数据 |
| `api/vendor/` | 第三方依赖安装目录 | 由依赖清单恢复，不手工放项目源码；其他语言使用等价的依赖缓存目录 |

推荐的跨语言映射：HTTP 路由与控制器可分别放在 `app/<boundary>/`，公共中间件和基础设施放 `core/`，持久化模型或仓储可放在 `app/` 下的领域子目录或独立 `data/` 目录；无论如何，外部接口必须继续遵循本文契约。

## 2. 基础约定

- API 根路径：`/api`；下文路径均省略此前缀。
- 所有业务接口使用 `POST`。请求体接受 `application/json`、`application/x-www-form-urlencoded`；带文件接口接受 `multipart/form-data`。
- 时间使用服务器时区的 `YYYY-MM-DD HH:mm:ss`，每日状态在服务器当地时间 `00:00:00` 重置。
- 成功响应：`{"status":1,"msg":"…","data":{…}}`；失败响应：`{"status":<错误码>,"msg":"…","data":[]}`，错误码取值与判定规则见 2.1。
- 业务结果一律由响应体的 `status` 表达。`401` 保留给「后台未登录」、`403` 保留给「已登录但无权限」、`429` 保留给「请求过于频繁」、`500`/`503` 保留给服务端错误；参数与业务校验失败默认仍返回 HTTP `200`，以免公开页面在游客态产生控制台错误。

### 2.1 统一响应与错误码

所有接口返回同一 JSON 结构，`status` 是唯一的业务结果字段。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `status` | int | 业务错误码：**`1` 表示成功，其余任何值都表示失败** |
| `msg` | string | 面向用户的提示语，可直接展示 |
| `data` | any | 成功时为业务数据；失败时为 `[]` 或 `null` |

**判定规则**：客户端只判断 `status === 1` 区分成败，不得用 HTTP 状态码判断业务结果；只有需要特殊交互时才按具体码分支（`1001` 清理登录态并跳转登录页、`2003` 按返回秒数倒计时）。`msg` 仅用于展示，任何实现都不得依赖其文案做分支。

码值采用 **4 位分段码**：`1xxx` 身份与会话、`2xxx` 请求与业务规则、`3xxx` 目标资源、`4xxx` 服务端。**业务码严禁与 HTTP 状态码同值**（`100`~`599` 一律不可用）——`201`、`404`、`500` 这类数字会被误读成 HTTP 状态码，排查问题时极易混淆；4 位码与 3 位 HTTP 码在数值上永久隔离，一眼可辨。

| status | 含义 | 典型场景 | 建议 HTTP |
| --- | --- | --- | --- |
| `1` | 成功 | 所有成功响应 | 200 |
| `0` | 通用失败（兜底） | 未细分的业务失败 | 200 |
| `1001` | 登录态无效 | 未登录访问需登录接口、会话已过期 | 200（前台）/ 401（后台） |
| `1002` | 无权限 | 普通账号操作他人资源、非管理员调用管理接口 | 403 |
| `1003` | 账号被禁用 | `is_show=0` 的账号尝试登录 | 200 |
| `1004` | 账号被禁言 | `comment_ban=1` 的账号提交评论或回复 | 200 |
| `1005` | 验证码错误或已过期 | 算术验证码、邮箱验证码校验失败 | 200 |
| `1006` | 身份令牌无效 | `identity_token` 格式非法或尚未绑定账号 | 200 |
| `1007` | 账号或密码错误 | 登录失败、修改密码时原密码不正确 | 200 |
| `2001` | 参数缺失或格式错误 | 必填字段缺失，长度、格式或类型不合法 | 422 |
| `2002` | 业务规则拒绝 | 昵称一年只能修改一次、不能给自己点赞或收藏 | 200 |
| `2003` | 请求过于频繁 | 邮箱验证码在 60 秒内重复发送 | 429 |
| `2004` | 上传被拒绝 | 扩展名、真实 MIME、大小或路径非法 | 422 |
| `3001` | 资源不存在 | 文章、评论、账号、配置在库中查不到 | 404 |
| `3002` | 资源冲突 | 账号名、昵称等唯一键重复 | 409 |
| `4001` | 服务器内部错误 | 未捕获异常、数据库写入失败 | 500 |
| `4002` | 外部依赖不可用 | 邮件服务器连接或发信失败 | 503 |

实现约束：

- 需要登录的接口在未登录时，后台（`admin/`）返回 HTTP `401` + 业务码 `1001`，前台（`index/`）返回 HTTP `200` + 业务码 `1001`。前台保持 `200` 是硬性要求——公开页面会在游客态发起请求，不能因未登录产生 401 控制台错误或触发全局跳转。
- 除上表「建议 HTTP」列出的场景外，业务失败一律返回 HTTP `200`，错误语义只由 `status` 承载。注意 HTTP 码与业务码是两套独立编号：业务码只用 4 位段码，永远不取 HTTP 码的数值。
- 新增失败分支必须复用既有码值，不得自造数字；确实无法归类的才用 `0`。

- 富文本与普通文本均由服务端单轮 HTML 编码后存储、单轮解码后返回；客户端不得再次编码或解码。

## 3. 统一身份与权限

### 3.1 账号

`tb_role.id` 是所有业务关系的唯一标识。`name` 是登录名且必须唯一，`nickname` 仅用于展示。不得按昵称或登录名判断资源归属。

角色：`role=1` 或 `role_auth=1` 为管理员；其他为普通账号。`is_show=0` 的账号无法登录；`comment_ban=1` 的账号能登录和发表文章，但不能发表评论或回复；`comment_audit=1` 的评论和回复初始不可见，需管理员审核，`comment_audit=0` 时直接可见。后台开关统一为右侧“是/绿色”、左侧“否/红色”。

### 3.2 会话与前台身份

- 后台会话以安全、HttpOnly、SameSite Cookie 保存；有效期由配置项 `LOGIN_EXPIRE_DAYS` 决定（当前项目配置为 1 天），该值同时用于持久 Session Cookie、Session 回收期限和会话内 `admin_token.expire`。实现不得把天数写死在代码里。
- 前台身份通过客户端生成的 64 位十六进制 `identity_token` 绑定；服务端只持久化其 SHA-256，且绑定到 `tb_role.identity_token`。
- 后台登录可同步前台身份；前台会话与后台会话逻辑独立，但可在同一浏览器同步恢复。
- 修改昵称必须距上次 `issue_time` 满一年；服务端必须强制执行。

## 4. 逻辑数据模型

| 实体 | 核心字段与规则 |
| --- | --- |
| Role | `id,is_select,sid,name,nickname,identity_token,password,email,role,role_auth,is_show,comment_audit,comment_ban,create_time,issue_time`；`id` 是稳定账号标识，`name` 全局唯一且仅用于登录，`nickname` 仅用于展示；`email` 允许重复且统一小写存储。`sid` 为后台排序、`is_select` 为后台勾选状态 |
| Article | `id,role_id,is_select,sid,type,title,subtitle,summary,content,content_mode,cover,url,is_show,likes,hits,create_time,issue_time`；`role_id -> Role.id`。`content_mode` 决定正文渲染方式，取值 `rich`（默认，富文本 HTML）或 `markdown`；`type` 为文章分类，`sid` 为排序，`is_select` 为后台勾选状态 |
| Comment | `id,sid,article_id,role_id,parent_id,message,is_show,likes,ip,create_time`；`parent_id=0` 是评论，大于 0 是回复；`sid` 为后台排序 |
| About | 每个 `role_id` 仅一条：`avatar,summary,content,create_time,issue_time` |
| Favorite | `role_id + article_id` 唯一 |
| History | `role_id + article_id` 唯一，保存 `last_view_time`，只保留一年 |
| Reply status | `reply_id + recipient_user_id` 复合主键，`recipient_user_id -> Role.id`，保存 `is_read,issue_time` |
| Selectall | `name,is_select`；`name` 是后台业务表标识且全局唯一，`is_select` 保存该表的「全选」状态。列表接口返回的 `selectall` 字段即来源于此 |
| Email code | `email,scene,code_hash,expire_time,used,fail_count,lock_until,ip,create_time`；验证码只存摘要。`scene` 仅 `register` / `reset`；`fail_count` 累计校验失败次数，达到上限后写入 `lock_until` 作为锁定截止时间 |

Role 表的 `role` / `role_auth` 建表默认值（均为 `1`）**仅供建表使用**，实际账号一律由接口写入：`/role_add` 默认传 `0`，`role_auth` 由 `role` 派生（见 §7.4）。直接以 SQL 插入会因默认值 `1` 误造出管理员账号。

删除 Role 时必须事务性清理其文章、资料、评论和回复、回复状态、收藏、浏览历史，以及其文章对应的收藏与浏览记录。

## 5. 公共内容与前台接口

| 路径 | 请求字段 | 成功 `data` / 行为 |
| --- | --- | --- |
| `/getDaily` | 无 | 当前每日一句列表或当前项，字段含 `id,cn,en,is_show` |
| `/getArticle` | 可选分页/排序 | 已显示文章列表；每项含文章字段、`publisher`（昵称）和点赞数 |
| `/getInfo` | 可选 `identity_token` | 首页资料。返回键**固定为** `today,title,logo,copyright,icp,photo,note`：`today` 是当天在一年中的序号（1~366）；`title`/`logo`/`copyright`/`icp` 取自公开 SEO；`photo` 是当前账号 `tb_about.avatar`（无资料时为内置默认头像）、`note` 是 `tb_about.summary`（为空时为“这家伙很懒，什么都没留下！”）。**键名是 `photo`/`note`，不是 `avatar`/`summary`**；已识别到账号时不得回退到其他账号的资料 |
| `/getAbout` | `identity_token` | **需登录**（不在免登录清单内，未登录一律拒绝且不回退任何内容）。返回当前账号的 `tb_about.content`；不读取 SEO 内容 |
| `/getDetail` | `id`、可选 `identity_token` | 文章详情、`publisher,isOwn,favorited,previous,next,hits,likes`；成功读取时原子增加文章 `hits` 并返回最新值；记录登录账号浏览历史 |
| `/getComments` | `article_id`，可选 `identity_token` | 只返回 `is_show=1` 的评论和回复，按 `id` 升序；行字段：`id,userId,isOwn,parentId,replyTo,username,avatar,time,content,likes,liked`。`userId` 为兼容字段，值必须是作者的 `tb_role.id`；`username` 为实时昵称，不能用于归属判断 |
| `/submitComment` | `article_id,parent_id=0,identity_token,message` | 登录且未禁言才可提交；回复必须属于同一文章；免审立即可见并返回成功，待审仅返回成功 ID；昵称从 `tb_role.nickname` 读取，客户端不得提交账号归属字段 |
| `/deleteComment` | `comment_id,identity_token` | 仅本人可删；删除顶层评论时连同其回复删除 |
| `/likeComment` | `comment_id,liked,identity_token` | 不可点赞本人。按账号、评论和服务器日期保存状态；`liked=true` 点赞，`false` 取消，同一天允许再次点赞；返回 `likes,liked,locked` |
| `/likeArticle` | `article_id,liked,identity_token` | 登录必需；作者不可点赞自己文章；按账号、文章和服务器日期保存状态；返回 `likes,liked` |
| `/favoriteArticle` | `article_id,favorited,identity_token` | 登录必需；收藏可反选；返回 `favorited` |
| `/frontProfile` | `identity_token` | `id,name,nickname,canEditNickname,articleLikeCount,commentLikeCount,commentCount,favorites,history` |
| `/frontProfileSave` | `identity_token,nickname` | **需登录**。只修改本人昵称：昵称唯一（**查重必须落在 `nickname` 列**，排除自己），与当前值相同时直接返回「昵称未变更」，距上次 `issue_time` 未满一年拒绝修改。**本接口不承担建号**，账号创建统一走 `/frontRegister`，因此不接受 `gvcode` |
| `/frontProfileClear` | `identity_token` | 统一退出前后台：销毁前台令牌、后台会话与 Session；不删除数据库账号、不释放昵称 |
| `/frontSessionSync` | `identity_token` | 依据有效后台会话和 `tb_role.id` 恢复前台身份，返回 `loggedIn,id,roleId,name,nickname,avatar`；资料表异常时头像为空，不得返回 500 |
| `/frontRegister` | `username,nickname,password,confirm,email,email_code,gvcode,identity_token` | 校验算术验证码和注册邮箱验证码后创建普通账号、绑定前台身份；邮箱统一小写但允许重复，账号名必须全局唯一；`nickname` **可选**（不传或为空则回落为 `username`，兼容老客户端），传了则须 ≤30 字且**全局唯一**（撞名 3002），落库写 `tb_role.nickname`，响应 `data.nickname` 回显；失败统一返回 JSON，不输出 HTML 500 |
| `/frontLogin` | `username,password,gvcode,identity_token` | 校验算术验证码后登录并绑定身份；禁用账号 `is_show=0` 必须拒绝登录 |
| `/frontBind` | `username,password,identity_token` | 将已有账号绑定当前前台身份；若令牌原已绑定其他账号，先以 SQL `NULL` 解除旧绑定再绑定 |
| `/email_code` | `email,scene` | `scene` 仅 `register` / `reset`；返回发送状态和开发环境标识。同邮箱同场景只保留最新一条验证码，60 秒内重复发送返回 `2003`；校验失败累计写入 `fail_count`，达到上限后按「邮箱 + 场景」维度锁定（写入 `lock_until`，`CODE_LOCK_SECONDS` 默认 600 秒），**重新发码不解锁** |
| `/password_reset` | `email,code,password,confirm` | 校验验证码后重置密码 |

点赞和收藏状态必须按 `tb_role.id` 与目标资源隔离。评论点赞、文章点赞和收藏都支持反选；点赞状态按服务器当地时间每日 `00:00:00` 重新开始计算。取消点赞或收藏不能播放“+1”反馈，只有成功点赞时前端局部播放一次动画。

**免登录边界**：可匿名调用的接口仅限四类——游客可用的公开内容（每日一句、文章列表与详情、评论列表、首页资料）、前台账号动作（注册、登录、绑定、退出、会话探测）、邮箱验证码与找回密码、后台登录相关（验证码、登录、退出、会话探测）。除此之外一律需要登录，**任何人资料接口和管理接口都不得放进免登录集合**。上表中标注“需登录”的行即为明确不在该集合内的接口。

## 6. 后台认证与系统接口

| 路径 | 请求字段 | 行为 |
| --- | --- | --- |
| `/captcha` | 可选 `width,height,fontSize` | 返回算术验证码图片，并将答案存入后台会话 |
| `/logup` | `username,password,identity_token` | 校验验证码会话、账号、密码和禁用状态；建立后台会话并可同步前台身份 |
| `/logout` | 无 | 销毁后台会话 |
| `/session_status` | 无 | 始终返回 HTTP 200；`data.loggedIn` 表示后台会话状态 |
| `/admin` | 无 | 后台首页统计，返回键为 `welcome,version,server_time,user_count,article_count,daily_count` |
| `/system` | 可选 `scope` | 已登录后台账号的系统信息。`scope` **只接受** `memory` / `uptime`，**未知值一律按全刷处理**（不得因为传了没见过的值就返回未刷新的数据）：`memory` 只重算 `currentMemory` 与 `memoryRefreshMs`，`uptime` 只重算 `uptime` 与 `uptimeRefreshMs`，`currentTime` / `UTCTime` 每次都刷新。静态字段（`platform,arch,server,ip,rootDir,mysqlVer,totalMemory`）可缓存，动态字段必须每次重算。`memoryRefreshMs` / `uptimeRefreshMs` 是下发给前端的**轮询节奏**（可用内存秒级、运行时间分钟级），前端据此分别轮询、每条请求只带自己的 `scope` |
| `/clearCache` | 无 | 管理员清理缓存，返回清理统计 |

## 7. 后台资源接口

除特别说明外，后台接口都要求有效后台会话。普通账号只能访问和修改自己的资源；批量操作、角色管理、评论审核、SEO、导航、每日一句和清缓存仅管理员可用。

### 7.1 SEO、导航与每日一句

| 资源 | 路径 | 关键请求字段 |
| --- | --- | --- |
| SEO | `/seo_list`, `/seo_update` | `id,sid,title,url,logo,description,keywords,author,copyright,icp,email`；更新 Logo 使用 multipart 字段 `logo` |
| 导航 | `/nav_add`, `/nav_delete`, `/nav_update`, `/nav_list`, `/nav_detail` | `id,is_select,sid,name,url,is_show`；支持 `parent_id,is_open,nav_type` 扩展 |
| 每日一句 | `/daily_add`, `/daily_delete`, `/daily_update`, `/daily_list`, `/daily_detail` | `id,is_select,sid,cn,en,is_show` |

列表接口统一接受 `page_current,page_rows,field,sort`，返回：`{data: [...], count, page_current, page_rows, selectall}`。`field` 必须受服务端白名单约束。

### 7.2 文章

| 路径 | 关键请求字段 | 行为 |
| --- | --- | --- |
| `/article_add` | `sid,title,subtitle,summary,content,content_mode,url,cover,is_show,create_time` | 已登录账号创建文章，归属由服务端写入当前 `role_id`；`content_mode` 只接受 `rich`（默认）或 `markdown`，其他值一律归为 `rich` |
| `/article_update` | `id` 加上述可更新字段（含 `content_mode`）；可含 `type=KNIU_TABLE_EVENT_CHECKALL` | 作者只能改自己的文章；批量仅管理员 |
| `/article_delete` | `id` | 作者或管理员删除 |
| `/article_list`, `/article_detail` | 分页参数或 `id` | 普通账号仅见自己的文章 |
| `/article_cover_delete` | `cover` | 删除当前账号可操作文章的上传封面 |
| `/article_media_upload` | multipart `file` | 上传编辑器图片、音频或视频，返回 `{url}` |

### 7.3 评论与回复管理

| 路径 | 请求字段 | 行为 |
| --- | --- | --- |
| `/comment_list` | `type=all|comment|reply,audit,keyword,page_current,page_rows,field,sort` | 管理员查看全部，普通账号只见本人；返回 `account_name,nickname,is_own,status_text` |
| `/comment_detail` | `id` | 查询单条内容 |
| `/comment_audit` | `id,audit=0|1` | 管理员审核；通过回复后发送刷新信号 |
| `/comment_delete` | `id` | 管理员可删全部，普通账号可删本人；删除顶层评论级联回复 |
| `/comment_update` | `id,sid` | 修改评论排序（`sid`）；仅管理员可用 |
| `/comment_reply_state` | 无 | 返回 `has_unread,unread_count` |
| `/comment_reply_read` | 无 | 当前账号收到的已审核回复全部标已读 |
| `/comment_reply_update` | `id,is_read=0|1` | 接收者或管理员更新单条回复状态 |

### 7.4 账号资料与关于我

| 路径 | 请求字段 | 行为 |
| --- | --- | --- |
| `/role_add`, `/role_update`, `/role_delete`, `/role_list`, `/role_detail` | 账号资料、`id`、分页字段 | 管理员管理账号；普通账号仅可查看本人及修改本人密码/受限资料。`role_add` 的 `role` 默认 `0`，`role_auth` 由 `role` 派生 |

**唯一 admin 超级账号（不可绕过的四条约束）**：任何实现都必须保证「全系统恰好一个 `role=1` 的超级账号，且它不可被删除」。
① `role_add` 传 `role=1` → `2002`（不能新增第二个管理员）；② `role_update` 把他人提权为 `role=1` → `2002`；③ `role_update` 把 admin 降级为 `role=2` → `2002`（**删除保护的前置条件**：没有它就能「先降级、再删除」把系统锁成无管理员）；④ `role_delete` 目标 `role=1` → `1002`，且该判定**排在「不能删除自己」之前**。`role_update` 的 `role` 变更必须先读目标当前 `role` 再决定放行与否，不得只看请求值。

**改密码即作废会话**（后端强制，前端不参与判定）：`/role_update` 一旦把密码成功写入库中，被改账号的**全部后台会话立即失效**——改的是当前登录账号时，先删除该账号在其它设备的会话文件、再销毁当前请求的会话，响应 `data.logout=true`（前端据此清理登录态并跳转登录页）；管理员修改他人密码时保留管理员自身会话、仅删除被改账号的会话，响应 `data.logout=false`。只改昵称、角色、启用状态等非密码字段（含批量勾选 `KNIU_TABLE_EVENT_CHECKALL`）不触发登出。实现必须保证「密码已变更」与「会话已失效」的判定口径一致，不能只删会话或只判密码任一单项。
| `/about_detail` | 无 | 返回当前后台账号的 `avatar,summary,content` |
| `/about_save` | multipart：`avatar` 文件，可选 `summary,content` | 更新当前账号资料；头像由服务端存储并返回 URL |

### 7.5 数据库管理（类 AdminSQL，**仅 `role=1` 超级管理员**）

后台「数据库管理」栏目（三层独立页面：`#/database` 库列表 → `#/databasetables` 数据表 → `#/databasetable` 单表结构与数据；库名/表名经 `navigateTo` 的路由数据逐层传递）。**权限口径收窄**：本模块可执行任意 SQL、可建库删表，因此判据是 `tb_role.role === 1`——`role=2`（**含 `role_auth=1` 的编辑账号**）调用任一接口都必须 **HTTP 403 + 业务码 `1002`**；侧栏入口只对超管渲染，普通用户直连上述三个路由任一都由客户端弹回 `#/admin`（客户端只是提示层，服务端才是边界）。

| 路径 | 关键请求字段 |
| --- | --- |
| `/db_list` | `database`（可选，用于标记「当前」） |
| `/db_create` | `name`（重名 `3002`） |
| `/db_tables` | `database` |
| `/db_table_create` | `database`,`table`,`fields[]`(`name,type,length,nullable,primary,default,comment`) |
| `/db_table_structure` | `database`,`table` |
| `/db_table_drop` | `database`,`table` |
| `/db_rows` | `database`,`table`,分页 `page_current`/`page_rows`,`keyword`,`field`,`sort` |
| `/db_row_save` | `database`,`table`,`values{}`，编辑时加 `id` |
| `/db_row_delete` | `database`,`table`,`id` |
| `/db_export` | `database`（响应为 `text/plain` 的 `.sql` 脚本） |
| `/db_import` | `sql`（上限 8MB，按分号逐条执行、遇错即停） |
| `/db_query` | `sql`（逐条执行并回显每条结果，单条失败不中断） |

**强制约束（任何实现都必须满足）**：
① **标识符白名单**：库名/表名/列名一律先过 `/^[A-Za-z0-9_]{1,64}$/` 再拼反引号（MySQL 不支持参数化标识符），命中即返回 `2001` 且不得触达 SQL——`db_kniu; DROP TABLE tb_daily` 这类注入必须被拦下且目标表完好；字段类型同样走枚举白名单。
② **语句切分必须是状态机**：导入与 SQL 控制台按分号切分时，必须跳过单/双引号字符串、`--`、`#` 行注释与 `/* */` 块注释内部的分号，不能简单 `split(';')`。
③ **无主键表拒绝写入与删除**（`2002`）：UPDATE/DELETE 无法定位单行，会全表命中。
④ **写操作与导出、导入、查询全部落审计**；因此 `/db_export` 虽然只读数据、**也不得**被前台当作无副作用查询（本项目前端以 `mutation:false` 标记只读请求，导出必须保持默认的写语义）。
⑤ 列元信息只能来自结构接口：同名字段在 `/db_rows` 里只有列名（无类型、无 `Extra`），实现时不得用它覆盖结构信息，否则「长文本不该用单行输入框」「自增主键不该出现在新增表单」这两条会静默失效。

## 8. 跨语言实现清单

1. 按第 4 节建立数据模型、唯一约束和索引；所有关系使用 `role_id -> Role.id`。
2. 实现 Cookie 会话、前台身份令牌摘要、验证码、密码哈希和 CSRF/同源校验。
3. 逐条实现第 5 至第 7 节路由，保持路径、字段名、响应形状与 2.1 的错误码语义不变。
4. 在每个写接口中做服务端权限与归属校验；不要信任客户端传来的 `role_id`、昵称、作者或审核状态。改密码必须由后端强制失效被改账号的全部后台会话（见 §7.4），不能依赖前端判定。
5. 对上传、排序、分页、富文本、事务删除、每日重置和通知已读状态应用本契约的规则；正文渲染按 `content_mode` 分流（`rich` 富文本 / `markdown`）。
6. 通过当前前端的登录、注册、文章增改删、评论回复、点赞收藏、个人中心、后台管理（含 `/system` 的 `scope` 轮询）回归测试后再切换实现。
