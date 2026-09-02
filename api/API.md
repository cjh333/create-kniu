# 后端 API 技术说明（KniuSystem）

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

若怀疑库内仍有旧版反复转义叠加的多层编码字段，运行根目录工具一次性归一：

```bash
php normalise_db.php            # dry-run（默认，只报告不写库）
php normalise_db.php --apply    # 剥到底解码后回写原文
```

- 白名单字段：`tb_daily.cn/en`、`tb_article.title/subtitle/summary/content`、`tb_nav.name/url`、`tb_seo.*`、`tb_role.name`。
- 已接入解码的端点：Daily / Article / Nav / Seo / Role 的 List + Detail，以及 IndexController 的 `getDaily` / `getArticle` / `getDetail`。

## 三、控制器基础能力（`Core\Controller`）

- `encodeFields(array $data, array $fields): array` —— 写库前对指定字段单轮转码（见上）。
- `decodeFields($rows, array $fields)` —— 返回前对指定字段单轮解码（见上）。
- `input()` —— 读取并规范化请求参数；`s` 类型返回原始字符串。
- 统一 JSON 响应封装，错误码 / 消息按前端 `REQUEST` 归一结构（`{ status, msg, data, httpStatus, request }`）返回。

## 四、接口清单（当前注册于 `api/config/router.php`，均 POST）

- 公共内容：`/getDaily`、`/getArticle`、`/getInfo`、`/getAbout`、`/getDetail`、`/getComments`、`/submitComment`、`/likeComment`、`/deleteComment`、`/likeArticle`、`/favoriteArticle`、`/frontProfile`、`/frontProfileSave`、`/frontProfileClear`
- 会话与系统：`/logup`、`/logout`、`/captcha`、`/frontBind`、`/admin`、`/system`
- 后台业务（需登录）：SEO、导航、每日内容、文章、角色、评论管理的增删改查，以及 `/about_detail`、`/about_save`、`/clearCache`

### 评论接口（公开，POST）

| 端点 | 入参 | 说明 |
| --- | --- | --- |
| `/getComments` | `article_id`（必填）、`identity_token`（可选） | 返回该文章全部**已审核**评论（含回复，`parent_id` 区分），`is_show=1` 过滤，按 `id` 升序；每项含 `{id,userId,isOwn,parentId,replyTo,username,avatar,time,content,likes,liked}`。旧评论 `user_id=0` 时按当前唯一昵称识别本人 |
| `/submitComment` | `article_id`、`parent_id`、`identity_token`、`message` | 提交评论或回复；后端按身份令牌从 `tb_front_user` 读取昵称并写入 `user_id/name`，不接受前端伪造昵称；提交即待审核，成功返回 `{id}` |
| `/likeComment` | `comment_id`、`liked`（bool）、`identity_token` | 点赞（`true` 加 1）或取消（`false` 减 1，不低于 0）；服务端拒绝给本人评论点赞，返回最新 `{likes}` |
| `/deleteComment` | `comment_id`、`identity_token` | 仅允许删除当前身份自己的评论或回复；兼容以唯一昵称识别 `user_id=0` 的旧评论，删除顶层评论时同时删除其回复 |
| `/likeArticle` | `article_id`、`liked`（bool） | 文章点赞（`true` 加 1）或取消（`false` 减 1，不低于 0）；后台作者会话不能给自己的文章点赞，返回最新 `{likes}` |
| `/favoriteArticle` | `article_id`、`favorited`、`identity_token` | 当前前台用户收藏或取消收藏文章；未登录时拒绝 |
| `/frontProfile` | `identity_token` | 返回昵称、获赞数、评论数、收藏文章和近一年浏览历史 `{id,nickname,likes,commentCount,favorites,history}` |
| `/frontProfileSave` | `identity_token`、`nickname`、`gvcode`（首次创建必填） | 昵称只在首次评论时设置并校验验证码；全站唯一，重复统一返回“该昵称已存在”。首次设置同时创建同名 `tb_role` 后台账号，固定普通用户/查看权限，初始密码 `000000`；已绑定身份通过接口修改时距离上次修改必须满一个月并同步后台用户名 |
| `/frontProfileClear` | `identity_token` | 退出当前前台登录状态，不删除数据库身份、不释放昵称 |

`/getDetail` 除文章字段外还返回 `previous` 和 `next`，有相邻已显示文章时为 `{id,title}`，没有时为 `null`。相邻顺序按文章 `id`，并过滤 `is_show=1`。

### 评论管理接口（后台，POST，需登录）

| 端点 | 入参 | 说明 |
| --- | --- | --- |
| `/comment_list` | `type`(`all`/`comment`/`reply`)、`audit`(`''`/`0`/`1`)、`keyword`、分页 `page_current`/`page_rows`、`field`/`sort` | 评论/回复列表，按 `parent_id` 区分顶层评论与回复，按 `is_show` 筛待审核/已通过，`name`/`message` 关键词模糊搜索（大小写不敏感）；`data` 每项含 `{id,parent_id,name,email,ip,message,likes,is_show,article_id,article_title,create_time,...}` |
| `/comment_audit` | `id`、`audit`(`0`/`1`) | 审核评论：`audit=1` 通过（前台可见）、`0` 隐藏/撤回；需管理权限 |
| `/comment_delete` | `id` | 删除评论；**删除顶层评论会级联删除其下全部回复**；需管理权限 |
| `/comment_detail` | `id` | 查询单条评论（`decodeFields` 后返回） |

`tb_comment` 为评论表，`article_id` 关联 `tb_article.id`，`user_id` 关联前台身份 `tb_front_user.id`；`parent_id` 为 0 表示顶层评论，大于 0 表示回复。后台 `/comment` 固定管理顶层评论，`/reply` 固定管理回复，两页共用接口但分别传 `type=comment/reply`。
`tb_article_favorite` 记录前台用户与文章的收藏关系，`user_id + article_id` 使用唯一索引防止重复收藏。
`tb_article_history` 记录用户最后浏览文章的时间，同一用户同一文章只保留一条；读取个人中心或新增浏览时自动删除一年前的记录。

前台昵称账号与后台 `tb_role.name` 一一对应。访客首次设置昵称时事务创建后台普通用户账号（与 `test` 相同的 `role=2`、`role_auth=2`），只有管理员可以更改角色和权限；普通用户可在后台用户管理中修改自己的密码。

`tb_seo.about_content` 保存后台“网站信息”中的“关于我”富文本；`/seo_list` 和 `/seo_update` 负责后台读取、保存，公开接口 `/getAbout` 返回 `{content}` 供前台关于页面展示。

## 权限与数据归属（2026-09-02 多账号重构）

系统由单一管理员扩展为多账号按角色隔离数据：

- `tb_role.role=1` 为管理员（`role_auth=1`），可见全量数据；`role=2` 为普通用户（`role_auth=2`），只能查看和操作自己的数据。
- 数据归属：`tb_article.user_id` 关联 `tb_role.id`（文章作者）；`tb_front_user.role_id` 关联 `tb_role.id`（前台昵称绑定后台账号）；`tb_user_about.user_id` 关联 `tb_role.id`（“关于我”按账号存储，`uk_user_about_user` 唯一键防重复）。
- 后台会话 `admin_token` 内含 `id`，核心辅助 `AdminBaseController::currentUserId()` / `isAdmin()`；`/logup` 登录响应同样返回 `id`。
- 普通用户：文章列表/详情按 `user_id` 过滤，增改删只能操作自己的文章；角色列表只见自己；评论列表只见自己的评论（行内附 `is_own`），只能删除自己的评论；批量删除仅管理员可用。
- “关于我”：后台 `/about_detail` 读本人 `tb_user_about`、`/about_save` 保存本人内容（存在更新、不存在插入）；前台 `/getAbout` 在浏览器持有合法 `identity_token` 且账号已绑定（`role_id>0`）时返回本人内容，否则回退 `tb_seo.about_content`。
- 身份绑定：`POST /frontBind`（入参账号密码与 `identity_token`）校验账号密码后绑定前台身份并建立前台会话（个人中心入口，无需验证码）；前台会话 `front_token` 与后台 `admin_token` 完全独立。
- 数据迁移与回填见 `api/database/20260902_role_permission.sql` 及同目录回填脚本。

## 五、新增接口

1. 在 `api/config/router.php` 注册路由 → 控制器方法映射。
2. 控制器放入对应应用目录：`api/app/index/Controllers/`（公开）或 `api/app/admin/Controllers/`（后台）。
3. 文本字段写库走 `encodeFields()`、返回走 `decodeFields()`；不要在控制器里手动 `htmlspecialchars` / `htmlspecialchars_decode` 以免重复。

## 六、上传与安全约定

- `/seo_update` 使用 `multipart/form-data`，Logo 文件字段为 `logo`；已有图片可提交 URL，空字符串表示清空。
- `/article_update` 的封面字段为 `cover`；`/article_media_upload` 的即时媒体字段为 `file`。
- 上传同时校验扩展名、客户端 MIME、`finfo` 真实 MIME 和大小，文件名由服务端生成。
- 后台依赖 Session、同源 CSRF 校验和角色授权；角色及缓存管理仅管理员可用。
- Session Cookie 名优先读取项目 `.env` 的 `SESSION_NAME`；未设置或格式不正确时，由核心 `SessionName` 首次生成 `KNIU_` 加 48 位随机哈希并保存到 `api/runtime/session/session.name`，后续稳定复用，避免同一主机上的项目互相覆盖登录态。
- 后台登录有效期统一读取 `api/config/auth.php` 的 `LOGIN_EXPIRE_DAYS`（默认 7 天），并同步用于持久 Session Cookie、Session 回收期限和 `admin_token.expire`；应用启动时以 `/system` 返回结果恢复登录状态。
- 前后端入口都会先读取项目根目录 `.env`；`PROCESS_ENV` 同时作为前端运行环境和后端 `APP_ENV` 的默认来源，外部进程已显式设置的同名变量优先。
- 排序字段只能是合法 SQL 标识符，方向只能是 `ASC` 或 `DESC`。
