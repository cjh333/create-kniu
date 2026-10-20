# KniuSystem 技术说明

KniuSystem 是一个前后端分离的单页面管理系统。前端使用原生 JavaScript、Custom Elements、Shadow DOM、Location Hash 和 EventTarget 构建，不依赖前端运行时框架；后端使用 PHP、Composer 与轻量路由/控制器结构提供 JSON API。

## 技术栈

| 层级 | 技术与职责 |
| --- | --- |
| 前端运行时 | 原生 ES Modules、Custom Elements、Shadow DOM、Hash Router、响应式模板绑定 |
| 前端构建 | Node.js 原生 ESM；打包脚本、模板和静态资源 |
| 开发服务 | Node.js HTTP Server；托管前端资源、生成模板清单、代理 `/api` 请求 |
| 后端接口 | PHP、Composer 自动加载、控制器路由、Session 鉴权、JSON 响应 |
| 数据访问 | `api/core/Db.php` 与 `api/config/database.php` |

## 项目结构

```text
KniuSystem/
├─ client/
│  ├─ client.mjs             # 浏览器应用入口
│  ├─ config/                # 构建、日志、路由、服务配置
│  ├─ controller/            # 页面与公共布局的 ViewModel
│  ├─ core/                  # SPA、MVVM、模板、请求、鉴权等核心模块
│  └─ views/
│     ├─ index.html          # HTML 外壳
│     └─ admin/              # 页面模板与 common/ 公共布局模板
├─ api/
│  ├─ index.php              # PHP API 入口
│  ├─ config/                # 路由、数据库、鉴权、日志等配置
│  ├─ core/                  # Router、Controller、Db 等基础设施
│  └─ app/                   # index/admin 业务控制器
├─ !KniuProject/
│  ├─ KNIU_API_CONTRACT.md    # 与语言无关的 API 行为契约
│  └─ kniusql/               # 当前数据库建表与初始化数据基线
├─ public/                   # CSS、图片、字体和 Kniu 插件资源
├─ dist/                     # 生产构建产物
└─ package.json              # 前端开发与构建命令
```

## 前端架构

### 启动与装配

浏览器加载 `client/views/index.html`，其中的模块脚本指向 `client/client.mjs`。入口执行顺序为：

1. 从 `client/config/router.js` 加载路由表。
2. 调用 `createApp()` 创建应用实例和事件总线。
3. 通过 `app.use(ROUTER)` 注入页面路由。
4. 通过 `client.useViews(VIEWER)` 按目录注入公共布局 Controller——装配表在 `client/config/viewer.js`：**键是视图相对 `views/` 的路径（如 `'admin/common/aside'`，须等于 `kniuviewkey.mjs::toCommonKey` 派生值），值是控制器相对 `client/controller/` 基目录的真实文件路径（基目录不写入，如 `'admin/asideController.js'`）；一次调用写完，调用会整体替换而非合并；不接受嵌套对象写法**。
5. 调用 `app.mount('#client')` 恢复会话、注册组件并渲染当前 Hash 路由（挂载目标 `#client` 对应 `client/views/index.html` 中的 `<div id="client">`）。

### 视图、路由与组件

- `client/views/index/*.html` 是前台页面，其中 `/about`、`/profile` 需要登录（由接口返回的 1001 引导到登录页，控制器本身不判断登录态）；`client/views/admin/*.html` 是后台页面。页面会映射为包含目录的唯一组件标识，避免前后台同名模板相互覆盖。
- `client/views/admin/common/*.html` 与 `client/views/index/common/*.html` 是各自区域的公共布局组件，不直接进入页面路由。
- `SERVER.HOME` 当前为 `index/index`，因此 `/` 默认渲染前台 `index.html`。
- 路由使用 Location Hash，例如 `#/login`、`#/register`、`#/seo`、`#/article`、`#/detail`。
- 页面模板在独立 Shadow Root 内渲染，样式与 DOM 查询默认限制在组件作用域内。

当前路由配置如下：

| 路径 | Controller | 渲染方式 |
| --- | --- | --- |
| `/` | `index/homeController` | 前台独立渲染 |
| `/detail` | `index/detailController` | 前台独立渲染；文章 ID 通过路由状态传递，不显示在地址栏 |
| `/login` | `admin/loginController` | 独立渲染（登录页，无后台框架） |
| `/register` | `admin/loginController` | 独立渲染（注册页，无后台框架） |
| `/admin` | `admin/homeController` | 后台主框架（侧栏 + 顶栏）；后台入口 |
| `/home` | `admin/homeController` | 后台主框架 |
| `/seo` | `admin/seoController` | 后台主框架 |
| `/aboutedit` | `admin/abouteditController` | 后台主框架 |
| `/user` | `admin/userController` | 后台主框架 |
| `/daily` | `admin/dailyController` | 后台主框架 |
| `/article` | `admin/articleController` | 后台主框架 |
| `/comment` | `admin/commentController` | 后台主框架 |
| `/reply` | `admin/replyController` | 后台主框架 |
| `/database` | `admin/databaseController` | 后台主框架；**仅 `role=1` 超级管理员可见**（类 AdminSQL）。第一层：数据库列表 + 建库/导入/执行 SQL |
| `/databasetables` | `admin/databaseTablesController` | 第二层：某个库的数据表列表 + 建表/导出（库名由 `navigateTo` 的路由数据带入） |
| `/databasetable` | `admin/databaseTableController` | 第三层：单表的结构 + 数据行增删改查（库名 + 表名由路由数据带入） |
| `/about` | `index/aboutController` | 前台独立渲染 |
| `/profile` | `index/profileController` | 前台独立渲染 |

路由的 Controller 必须填写包含目录的完整相对路径；公开前台使用 `index/`，后台使用 `admin/`。注册只有一种写法 `ROUTER.add(路径, Controller)`：路由表不表达鉴权，页面控制器也不判断登录，一律由服务端接口返回的业务码 `1001` 驱动请求层跳转 `#/login`。渲染方式由 Controller 目录决定——`admin/` 前缀的页面装配后台主框架（侧栏 + 顶栏），其余页面独立渲染。`admin/mainController`、`admin/asideController` 和 `admin/headerController` 由公共布局装配；模板目录中存在但未注册到路由表的页面会被收集为组件，但不会成为显式业务路由。

### MVVM 分层

- Model：API 数据以及 `AUTH`、`UTIL` 等全局状态。
- ViewModel：`client/controller/` 中的 Controller 使用 `controller(setupFn)`；状态由 `reactive()` 创建，setup 直接返回模板所需状态与方法。
- View：HTML 模板保留结构、样式与 `kniu:*` 声明式绑定。
- 生命周期：`onMounted()`、`onUnmounted()` 和 `onScopeDispose()` 统一管理事件、定时器和清理函数。
- 动态加载：路由与公共布局 Controller 由 `loadController()` 按明确的目录路径动态导入，不猜测同名 Controller 所在目录。

控制器直接返回需要给模板使用的状态和方法：

```js
import MVVM from './client/core/kniumvvm.mjs';

const { controller, reactive, onMounted } = MVVM;

export default controller(() => {
  const state = reactive({ loading: false });
  function load() { state.loading = true; }
  onMounted(load);
  return { state, load };
});
```

MVVM 提供 `reactive()` 状态对象与 getter/多来源 `watch()`；可复用的有状态逻辑统一以 `useXxx()` composable 命名。

### 核心模块

| 模块 | 职责 |
| --- | --- |
| `kniubase.mjs` | 创建应用、注册 Shadow DOM 组件、恢复会话、渲染路由并按 Controller 目录决定布局归属（不设鉴权守卫；暴露 `getRouteData()` 供登录回跳拼装参数） |
| `kniumvvm.mjs` | Controller 动态加载、组件定义、ViewModel 创建、生命周期与 `watch()` |
| `kniutemplate.mjs` | 响应式状态、依赖观察、`kniu:*` 声明式模板绑定与清理 |
| `kniustore.mjs` | 命名状态中心：跨组件/跨路由共享状态、订阅和可等待的业务动作派发；不依赖 UI 或 MVVM |
| `kniuscheduler.mjs` | 更新任务去重、微任务批处理与 `nextTick()` 刷新边界 |
| `kniueventer.mjs` | 事件总线、作用域 DOM 工具、模板加载、模板嵌入和路由注册表；业务入口统一命名为 `EVENTER` |
| `kniuauth.mjs` | `AUTH` 登录状态、用户信息、会话恢复、退出和失效复位 |
| `kniurequest.mjs` | `/api` 请求封装、响应归一化、并发去重和 401 处理；所有成功接口自动交给状态中心作前后快照比对 |
| `kniuui.mjs` | 系统 UI 组件、消息提示与路径别名替换；内含通用列表组合器 `usePage()`（自动创建表格/分页状态并接线页事件，编排分页、搜索和可选删除，接口、数据表与权限策略由业务 Controller 传入）；业务入口统一命名为 `UI` |
| `kniulogger.mjs` | 按环境配置的前端/构建日志；业务入口统一命名为 `LOGGER` |
| `kniuserver.mjs` | 开发静态服务、模板清单生成和 API 反向代理 |
| `kniuproxy.mjs` | 服务器端共享基础设施：`/api` 反向代理、请求协议解析与 MIME 映射，供 `kniuserver` 与 `kniupreview` 复用 |
| `kniubuilder.mjs` | 生产打包、模板内联、内容哈希、资源引用改写和产物输出 |

`kniustore` 的快照只存在当前浏览器会话；账号唯一性以 `tb_role.id` 为准，账号切换或退出会将状态恢复为各 Store 的初始值。业务表与数据库事务是唯一数据真相；保存、删除和审核成功后由当前页面局部更新状态或显式重新加载列表。

### 模板运行机制

开发环境由服务器扫描 `SERVER.VIEWS`，将除 `index.html` 外的模板写入 `globalThis.__VIEW_TEMPLATES__`。生产构建执行相同的模板收集逻辑并输出独立的 `templates.<hash>.js`。组件挂载时优先从模板清单读取，随后解析路径别名和模板嵌入，执行模板脚本、Controller 绑定及清理注册。

### 鉴权与请求链路

1. `AUTH.restoreSession()` 在应用启动时先安静探测 `/api/session_status`；后台会话有效时再读取 `/api/system` 恢复账号信息，访问后台登录页时进入后台。
2. 路由表只做「路径 → Controller」映射，不携带鉴权标记；**页面控制器不做登录鉴权判断**（不检查登录态、不预防式跳转），页面照常挂载并发请求。
3. 鉴权只在服务端判定：接口返回业务码 `1001`（后台同时为 HTTP 401）时，请求层统一 `AUTH.markLoggedOut()` 并跳转 `#/login`，同时把当前页面路径与路由参数作为回跳目标带上（`/detail` 会连 `id` 一起带），登录成功后由登录页按 `redirect` 回跳——跳转策略在 `client/client.mjs` 注入。
4. 后端接口默认全部需要登录：`Core\Router` 分发时对每个 action 统一调用 `Core\Controller::requireLogin()`；**免登录清单的唯一来源是 `api/config/auth.php` 的 `NO_AUTH`**（写法 = 接口路径去掉前导斜杠，如 `'getDaily'`），路由注册处只写两个参数，传第三个参数会直接抛异常。
5. `REQUEST` 自动为相对接口添加 `/api` 前缀，默认携带 Cookie，并将响应归一为 `{ status, msg, data, httpStatus, request }`。
6. 未登录的拒绝形式：后台接口返回 HTTP 401 + `1001`，前台接口返回 HTTP 200 + `1001`（前台必须保持 200——公开页面会在游客态发请求，不能因游客产生 401 控制台错误）。两者在请求层都走同一条跳转链路。
7. 退出登录调用 `POST /api/logout`，销毁后端 Session 并复位前端状态。

前端不设路由守卫，控制器也不写登录判断；**唯一权限边界是服务端的「全部接口默认鉴权」**，前端只按返回码执行跳转。少部分「身份探测」请求（前台头部昵称、详情页标记本人评论、登录页自身）显式传 `redirectOnUnauthorized: false`，避免游客浏览公开页面时被弹到登录页。
登录有效期通过 `api/config/auth.php` 的 `LOGIN_EXPIRE_DAYS` 配置，默认开发和生产环境均为 7 天；该值同时控制 Session Cookie、服务端 Session 回收期限和后台令牌过期时间。

## 后端架构

`api/index.php` 是统一入口：初始化 Composer 自动加载和 Session，读取应用/日志配置，处理 CORS，解析请求 URI，随后交给 `Core\Router` 分发。控制器按应用划分：

- `api/app/index/Controllers/`：公开内容、前台身份、评论、点赞、收藏和个人中心接口。
- `api/app/admin/Controllers/`：登录、系统信息、SEO、导航、每日内容、文章、角色和缓存管理。
- `api/core/Base.php`：后台控制器的公共鉴权基础（`currentUserId()`/`isAdmin()`/`requireManagePermission()`，未登录按 HTTP 401 拒绝）。
- `api/core/Controller.php`：请求参数和 JSON 响应等控制器基础能力。

接口统一在 `api/config/router.php` 注册，当前均使用 POST，包括：

- 公共内容与前台身份：`/getDaily`、`/getArticle`、`/getInfo`、`/getAbout`、`/getDetail`、`/getComments`、`/submitComment`、`/likeComment`、`/deleteComment`、`/likeArticle`、`/favoriteArticle`、`/frontProfile`、`/frontProfileSave`、`/frontProfileClear`、`/frontSessionSync`、`/frontRegister`、`/frontLogin`、`/frontBind`、`/email_code`、`/password_reset`
- 后台会话与系统：`/logup`、`/logout`、`/captcha`、`/session_status`、`/admin`、`/system`
- 后台业务：SEO、导航、每日内容、文章、评论、回复、角色、关于我的增删改查，以及 `/clearCache`、`/article_media_upload`

## 配置说明

| 配置文件 | 关键内容 |
| --- | --- |
| `client/core/kniudotenv.mjs` | 加载项目根目录 `.env`，并统一导出当前运行环境 `PROCESS_ENV` 与 `RUNTIME_ENV`（原 `kniuenv.mjs` 已合并至此） |
| `client/config/server.js` | 环境、时区、主机、端口、首页、视图目录、路径别名与 API 代理 |
| `client/config/router.js` | 页面路由与 Controller 映射（不表达鉴权） |
| `client/config/builder.js` | 输出目录、资源访问前缀、产物子目录和待复制资源 |
| `client/config/logger.js` | 日志级别与输出策略 |
| `api/config/router.php` | 后端接口与控制器方法映射（只写路径与 Controller@action，不表达鉴权） |
| `api/config/database.php` | 数据库连接 |
| `api/config/auth.php`、`role.php` | 会话鉴权、角色权限与免登录接口清单 `NO_AUTH`（后端鉴权唯一来源） |
| `api/config/log.php`、`upload.php` | 日志与上传配置 |

开发环境默认前端地址为 `http://localhost:6173`，`/api` 请求代理到 `http://localhost:9900`。生产环境的 API 代理目标为空，前后端应由部署层配置为同源或配置反向代理。

## 本地开发

### 后端

```bash
cd api
composer install
php -S localhost:9900 -t .
```

### 前端

在项目根目录执行：

```bash
npm install
npm run dev
```

然后访问 `http://localhost:6173`。Windows 下需要结束遗留 Node 进程时可执行 `npm run kill`。

## 生产构建

```bash
npm run build
```

`build` 脚本使用 `node client/core/kniubuilder.mjs --env=production`，不依赖 `cross-env`、`esbuild` 或其它 npm 构建插件。构建器会自动清理并重新生成 `dist/`，无需手动执行删除命令；浏览器包在构建期读取 `.env` 中允许公开的 `PROCESS_ENV`、`HOST`、`PORT`，数据库和邮件等服务端密钥不会写入前台产物。

> 环境约定：前端核心启动时自动读取项目根目录 `.env`，外部进程已显式设置的变量优先；`client/core/kniudotenv.mjs` 在未配置时默认使用 `development`，`--env=production`（或 `npm run build`）会生成生产发布目录。

构建器会清空并重新生成 `dist/`：

```text
dist/
├─ index.html
├─ client/
│  └─ ...浏览器原生 ESM 模块
├─ views/
│  ├─ client.<hash>.js
│  └─ templates.<hash>.js
└─ public/
   └─ ...静态 CSS、JavaScript、图片和字体
```

- `index.html` 会注入模板清单和客户端模块脚本。
- 客户端代码由 `client/client.mjs` 作为生产构建入口。
- 模板和 CSS 内的资源路径会改写为哈希文件路径。
- `BUILDER.PUBLIC_PATH` 可设置根路径或子目录部署前缀；空字符串表示相对产物路径。

### 生产部署敏感路径防护（必做）

docroot 指向项目根时，以下路径**必须**禁止 HTTP 直读（根目录已附带 `.htaccess`，Apache 自动生效；nginx 需在 server 块加等价规则）：

| 路径 | 内容 |
| --- | --- |
| `/.env` | 数据库/邮件凭证 |
| `/runtime/`（含 `/api/runtime/`） | 会话文件、登录锁、`db-connections.json`（明文连接凭证）、请求日志 |
| `/!KniuProject/` | SQL 基线与种子数据（含密码哈希/令牌摘要） |

nginx 等价规则：

```nginx
location ~ (^|/)\. { deny all; }
location ^~ /runtime/ { deny all; }
location ^~ /api/runtime/ { deny all; }
location ^~ /!KniuProject/ { deny all; }
```

两条配套前提：①源站仅允许 Cloudflare 回源 IP 访问（`Controller::clientIp()` 信任 `CF-Connecting-IP`，直连源站可伪造该头绕过防爆破锁的 IP 维度）；②上传目录 `public/upload` 由部署层禁用 PHP handler。

## 开发约定

核心状态回归检查运行 `npm test`；该检查覆盖账号切换后的快照清空、请求生命周期与核心列表工具。

- 单能力核心模块使用默认导出；`kniuutil.mjs` 这类纯函数集合使用命名导出，让调用处明确表达依赖。
- 项目内系统级 UI 的类名、元素标识及相关样式统一使用 `kniu_sys_` 前缀，业务页面自身命名不受此约束。
- **禁止外部品牌字眼**：所有源码、注释、变量、样式、文案、资源名和构建产物统一使用项目自身命名；自动检查发现违规内容时直接阻止交付。
- **HTML 编解码后端全责（铁律）**：增 / 改 → 写库前 `Controller::encodeFields()` 单轮 `htmlspecialchars($str, ENT_QUOTES)`；查 → 返回前端前 `Controller::decodeFields()` 单轮 `htmlspecialchars_decode($str, ENT_QUOTES)`（兼容 `find` 单行 / `select` 行数组 / `null`）；删 → 不处理；**前端不做任何编解码**，单元格 / 文本插值直接 `textContent` 直出（已移除 `decodeHtml` 系）。当前仓库未提供历史脏数据自动归一脚本，遇到多层编码数据时应先备份，再由部署环境的迁移工具按字段白名单处理。
- 系统 UI 优先封装为数据驱动组件；组件功能配置统一通过 `kniu:option` 绑定对象、数组或函数，原生元素的自定义 `data-*` 属性才使用 `kniu:[name]`，业务 Controller 不直接查询和创建组件内部 DOM。
- 鉴权只在服务端：`Core\Router` 全局闸门 + `Core\Controller::requireLogin()` 是唯一安全边界，前端页面控制器不写登录判断，只按接口业务码 `1001` 跳转登录页；**新增接口默认需要登录**，确需公开的接口登记到 `api/config/auth.php` 的 `NO_AUTH`（登记后跑 `php test/check_no_auth_list.php` 校验）；退出必须调用 `POST /api/logout`。

## 安全与统一检查

- 数据库凭据只从环境变量读取，复制 `.env.example` 后在本机填写，禁止提交真实密钥。
- 后台 Cookie 使用 `HttpOnly`、`SameSite=Strict`，API 校验同源请求并返回 CSP 等安全响应头。
- 富文本进入编辑器前执行白名单清洗；上传删除路径必须位于 `public/upload/` 内。
- 当前 `package.json` 提供 `npm run dev`、`npm run preview`、`npm run build` 和 `npm run kill`；没有未实现的 `check` 或 `benchmark` 脚本。
- 新增页面时，同时添加 `client/views/index/<name>.html`、`client/controller/index/<name>Controller.js`，并以 `index/<name>Controller` 注册到路由表；控制器里**不要写登录守卫**——需要登录的页面由后端接口默认鉴权返回 `1001`，请求层会自动跳登录页并带上回跳目标。
- 新增后台页面时，同时添加 `client/views/admin/<name>.html`、`client/controller/admin/<name>Controller.js`，并以 `admin/<name>Controller` 注册到路由表；页面控制器需自行保证未登录时的接口请求能触发 401 跳转，后台页面会在 `admin/` 目录判定下自动装配主框架。
- 新增公共布局时，将模板放入对应区域的 `common/`，将 Controller 放入同名区域目录，并在 `client/config/viewer.js` 中装配：`{ 'admin/common/aside': 'admin/asideController.js' }`。**只接受这一种扁平写法**——键是视图相对 `views/` 的路径（`views/admin/common/aside.html` → `admin/common/aside`，须等于 `kniuviewkey.mjs::toCommonKey` 派生值），值是控制器相对 `client/controller/` 基目录的真实文件路径（基目录不写入）；**它整体替换上一次的注册，不是合并**，所以要在一次调用里写全；写成嵌套对象（`{ admin: { common: { aside: '...' } } }`）会在启动期抛 `TypeError`，不会静默降级；键写错不会报错，但控制器会静默丢失、模板以 `{{ }}` 原样呈现——回归闸门 `node test/check_viewer_paths.mjs`。
- 页面和公共布局组件标识包含所在区域，前后台允许使用同名文件且不会相互覆盖。
- 后端新增接口时，在 `api/config/router.php` 注册，并将控制器放入对应应用的 `Controllers` 目录；部署到区分大小写的环境时必须保持目录名大小写正确。
- `dist/` 是生成目录，不应直接编辑。

更细的模板语法参见 [`client/core/kniutemplate/KNIU-TEMPLATE.md`](client/core/kniutemplate/KNIU-TEMPLATE.md)，系统 UI 组件（`kniu-table` / `kniu-page` / `kniu-empty` / `kniu-modal` / `kniu-form` / `kniu-input` / `kniu-switch` / `kniu-editor` 等）用法参见 [`client/core/kniuui/KNIU-UI.md`](client/core/kniuui/KNIU-UI.md)，当前 PHP API 说明参见 [`api/API.md`](api/API.md)，跨语言 API 契约参见 [`!KniuProject/KNIU_API_CONTRACT.md`](./!KniuProject/KNIU_API_CONTRACT.md)。

所有 `kniu-*` 自定义组件统一使用 `kniu:option` 配置，旧的零散组件属性不再兼容。模板标签仅保留 `ref`、`kniu:form`、模板指令、插槽和模板事件；组件回调优先配置为 options 中的 `onXxx`。
