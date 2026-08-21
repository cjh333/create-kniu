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

`npm run dev` 通过 `--env-file=.env`（内含 `PROCESS_ENV=development`）启动开发服务并反向代理 `/api` → `http://localhost:9900`。访问 `http://localhost:6173`。Windows 下结束遗留 Node 进程：`npm run kill`。

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

- 公共内容：`/getDaily`、`/getArticle`、`/getInfo`、`/getDetail`
- 会话与系统：`/logup`、`/logout`、`/captcha`、`/admin`、`/system`
- 后台业务（需登录）：SEO、导航、每日内容、文章、角色的增删改查，以及 `/clearCache`

## 五、新增接口

1. 在 `api/config/router.php` 注册路由 → 控制器方法映射。
2. 控制器放入对应应用目录：`api/app/index/Controllers/`（公开）或 `api/app/admin/Controllers/`（后台）。
3. 文本字段写库走 `encodeFields()`、返回走 `decodeFields()`；不要在控制器里手动 `htmlspecialchars` / `htmlspecialchars_decode` 以免重复。

## 六、上传与安全约定

- `/seo_update` 使用 `multipart/form-data`，Logo 文件字段为 `logo`；已有图片可提交 URL，空字符串表示清空。
- `/article_update` 的封面字段为 `cover`；`/article_media_upload` 的即时媒体字段为 `file`。
- 上传同时校验扩展名、客户端 MIME、`finfo` 真实 MIME 和大小，文件名由服务端生成。
- 后台依赖 Session、同源 CSRF 校验和角色授权；角色及缓存管理仅管理员可用。
- 排序字段只能是合法 SQL 标识符，方向只能是 `ASC` 或 `DESC`。
