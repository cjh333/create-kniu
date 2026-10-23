# Kniu CLI

Kniu CLI 用于创建零运行时依赖、原生 ESM 的前端 SPA。模板包含路由、受限模板表达式、Web Components、请求安全策略、认证会话、Store、可选可观测性、Service Worker 和生产构建器。

## 创建与运行

- 本地任意盘符下打开 `CMD` 命令行工具，创建项目

```powershell
npx --yes github:cjh333/create-kniu my-app
```

- 进入项目目录

```powershell
cd my-app
```

- 运行项目

```powershell
npm run dev
```

- 构建(打包)项目

```powershell
npm run build
```

生产构建的 `dist` 根目录只包含 `index.html`、`public/` 和 `views/`。构建器产生的 manifest、安全头配置以及 `.br/.gz` 文件统一放在 `dist/public/assets/`。源文件保持可读格式，只有生产资源生成带内容 hash 的 `.min` 文件。

## 预览构建(打包)项目

```powershell
npm run preview
```

## 目录职责

- `client/config/`：路由和模板映射；
- `client/controller/`：控制器；
- `client/core/`：框架核心源码；
- `client/docs/`：API 文档；
- `client/views/`：页面模板；
- `client.mjs`：唯一入口。

## `kniu.config.js` 字段参考

下面的路径均相对于项目根目录；未填写的字段使用模板默认值。

| 字段 | 类型 | 默认值 | 说明与注意事项 |
| --- | --- | --- | --- |
| `root` | `string` | `'./client/views'` | 页面模板根目录。构建器会扫描其中的 HTML；不要指向 `public`。 |
| `publicDir` | `string` | `'./public'` | 静态资源源目录，构建时复制到 `dist/public`；引用会改写为 hash 路径。 |
| `loading` | `boolean | object` | `true` | 页面首次加载和路由切换时是否显示加载状态。可写为 `{ enabled: true, text: '加载中…' }`；设置 `false` 可关闭。 |
| `resolve.alias` | `Record<string,string>` | `{}` | 模块和模板路径别名，默认提供 `@`、`@style`、`@img`、`@upload`、`@plugin`、`@kniu`；目标应在项目目录内。模板中的别名只在模板引擎内渲染：路由模板渲染与 `template.head` 注入时统一解析为正式路径，输出不含别名。 |
| `template.head.favicon` | `string` | `'@img/favicon.ico'` | 页面图标，支持别名书写；由模板引擎挂载后解析为正式路径并注入 `<link rel="icon">`。 |
| `template.head.style` | `array` | `['@kniu/kniu.min.css','@style/app.css']` | 全局样式表，支持别名书写；按数组顺序注入 `<link rel="stylesheet">`。 |
| `template.head.js` | `array` | `['@kniu/kniu.min.js']` | 插件脚本，支持别名书写；由模板引擎在唯一入口挂载链路内按数组顺序注入（`async = false`），不会先于 `client.mjs` 加载。 |
| `server.host` | `string` | `'127.0.0.1'` | 开发服务器监听地址；局域网调试才使用 `0.0.0.0`。 |
| `server.port` | `number` | `6173` | 开发服务器端口。 |
| `server.strictPort` | `boolean` | `true` | 端口占用时是否失败；CI 推荐保持 `true`。 |
| `server.proxy` | `Record<string,object>` | `{}` | 开发期 API 代理，例如 `'/api': { target, changeOrigin }`；不参与生产构建。 |
| `request.credentials` | `string` | `'same-origin'` | fetch 凭证策略。跨域 Cookie 需显式 `'include'` 并正确配置 CORS。 |
| `request.timeout` | `number` | `15000` | 请求超时毫秒数。 |
| `request.csrfCookie` | `string` | `'XSRF-TOKEN'` | CSRF Cookie 名称；仅对同源或明确可信域使用。 |
| `request.csrfHeader` | `string` | `'X-CSRF-Token'` | CSRF 请求头名称。 |
| `request.traceHeader` | `string` | `'X-Request-ID'` | 请求链路 ID 请求头；不要把密码、Token 放入 ID。 |
| `auth.enabled` | `boolean` | `false` | 启用路由认证；路由 meta 可使用 `requiresAuth`、`roles`、`permissions`。 |
| `auth.storageKey` | `string` | `'KNIU_CLI_AUTH'` | 认证状态存储键，避免与同域应用重复。前端状态不能替代服务端权限校验。 |
| `auth.loginRoute` | `string` | `'/login'` | 未认证用户跳转路由。 |
| `auth.sessionUrl` | `string` | `''` | 会话恢复接口；为空时不主动请求。 |
| `identity.storageKey` | `string` | `'KNIU_CLI_IDENTITY'` | 当前用户身份缓存键。 |
| `identity.persist` | `boolean` | `false` | `false` 使用 `sessionStorage`，`true` 使用 `localStorage`；不要存凭证或隐私数据。 |
| `observability.enabled` | `boolean` | `false` | 是否采集错误、未处理 Promise 和 Web Vitals。默认关闭。 |
| `observability.endpoint` | `string` | `'/api/client-observability'` | 上报端点；生产端应脱敏、鉴权、限流、采样。 |
| `observability.allowCrossOrigin` | `boolean` | `false` | 是否允许跨源上报；仅对可信且配置 CORS 的端点开启。 |
| `store.state` | `object` | `{}` | Store 初始状态，只放可序列化、非敏感状态。 |
| `store.persist` | `boolean` | `false` | 是否写入 `localStorage`；不要持久化 Token 或隐私数据。 |
| `store.sync` | `boolean` | `false` | 是否通过 BroadcastChannel 同步同源标签页；高频状态请节流。 |
| `store.key` | `string` | `'KNIU_STORE'` | Store 持久化和跨标签同步键。 |
| `serviceWorker.enabled` | `boolean` | `false` | 是否注册离线插件；需审查缓存的动态响应。 |
| `serviceWorker.url` | `string` | `'/public/assets/kniu-sw.js'` | Service Worker URL，必须同源并满足 scope 规则。其源代码位于 `client/core/kniu-service-worker.js`，构建时输出到 `public/assets`；它是可选离线能力，不进入首屏核心运行时。 |
| `serviceWorker.scope` | `string` | `'/'` | Service Worker 控制范围。范围越大，升级和缓存风险越高。 |
| `security.cspNonce` | `string` | `''` | 服务端每次响应生成的随机 CSP nonce；不能使用固定常量，优先采用 `adoptedStyleSheets`。 |
| `seo.siteUrl` | `string` | `'http://localhost:6173'` | canonical、Open Graph、sitemap 使用的绝对 URL；生产改为 HTTPS 域名。 |
| `seo.routes` | `array` | `['/','/about/1']` | SEO 元数据和 sitemap 路由。hash SPA 的非根 URL 带 `#`，完整 SEO 应使用 history + 服务器回退或 SSR/SSG。 |
| `seo.robots` | `string` | `'index,follow'` | 页面 robots 元信息；预发布应使用 `noindex,nofollow`。 |
| `build.outDir` | `string` | `'./dist'` | 构建输出根目录；构建前会清理，不要指向源码目录。 |
| `build.outFile` | `string` | `'./views/'` | 编译模板输出目录（相对于 `outDir`）。 |
| `build.outPublic` | `string` | `'./public'` | 静态资源输出目录（相对于 `outDir`）。 |
| `build.successMessage` | `string` | `'Kniu CLI build created in dist/'` | 构建完成提示文本。 |
| `build.plugins` | `array` | `[]` | 构建插件；可实现异步 `beforeBuild`、`transformModule`、`afterBuild`，只加载可信代码。 |
| `build.minify` | `boolean` | `true` | 是否压缩生产 JS/CSS/JSON/HTML。 |
| `build.performance.maxInitialJsKiB` | `number` | `300` | 初始 JS 体积预算（KiB）。 |
| `build.performance.maxComponentChunkKiB` | `number` | `250` | 单组件 chunk 体积预算（KiB）。 |
| `build.performance.failOnBudgetExceeded` | `boolean` | `false` | 预算超限是否失败；生产 CI 推荐开启。 |
| `build.componentTags` | `array` | `[]` | 补充动态 `kniu-*` 标签；标签越多，组件包越大。 |
| `components` | `Record<string,object>` | `{}` | 全局组件默认配置，如 `btn.size`、`page.layout`、`editor.mediaUploadUrl`。 |
| `theme.preset` | `'light' \ 'dark' \ 'ocean' \ 'forest' \ 'violet'` | `'light'` | 主题预设。`light` 为默认明亮主题；`dark` 适合暗色界面；`ocean`、`forest`、`violet` 分别是蓝、绿、紫品牌色方案。 |
| `theme['--kniu-*']` | `string` | `''` | 全局 CSS 自定义属性。会覆盖预设对应值；建议使用 `--kniu-*` 并提供回退值，不要拼接用户输入。 |

## 模板与安全

`{{value}}` 始终 HTML 转义；`{{@content}}` 是明确的原始 HTML 输出，只能接收白名单清洗后的可信内容，不能直接渲染用户输入。模板表达式不执行 `eval`/`Function`，并阻止 `constructor`、`prototype`、`__proto__` 等危险属性。表达式支持 `||`、`&&`、`!`、比较（`===`、`!==`、`==`、`!=`、`>`、`<`、`>=`、`<=`）与三元 `条件 ? 甲 : 乙`（可嵌套，字符串内字符不参与解析）。

生产环境应部署构建生成的安全头配置，启用 HTTPS、`HttpOnly`/`Secure` Cookie，并由服务端完成权限校验。开发服务器允许的 HMR/内联样式兼容项不应直接照搬到生产 CSP。

## 组件隔离

所有 Kniu 内置组件和通过 `COMPONENT.use()` 注册的业务组件均使用 open Shadow DOM 渲染，组件 CSS、DOM 查询与事件委托只作用于对应组件根节点。业务组件不得直接 `customElements.define()` 后使用 Light DOM；应通过 `COMPONENT.use()` 注册，并在 `setup(ctx)` 中使用 `ctx.root`。`onMounted` 回调接收 `(host, root)`，其中 `root` 是该组件的 `ShadowRoot`。

影子根内的样式统一通过 `adoptedStyleSheets` 挂载，DevTools 中表现为 `#shadow-root` 下的 `#adopted-style-sheets`，不再出现 `<style>` 节点：`attachComponentShadow` 会接管影子根的 `innerHTML`，把模板里的 `<style>` 文本转成共享的 `CSSStyleSheet`；同一段 CSS 只创建一张样式表，供多个实例复用。不支持构造式样式表的浏览器自动回退为 `<style>` 节点，业务代码无需分支。

## 请求、Store、监控与可访问性

```js
const data = await app.request.get('/api/list', { cache: true, cacheTtl: 30000, retries: 2 });
app.store.patch({ theme: 'dark' });
const issues = app.auditAccessibility();
```

监控默认关闭；启用后服务端应脱敏、采样和限流。`auditAccessibility()` 能发现图片缺少 `alt`、按钮缺少 `type`、表单缺少 label/ARIA 等常见问题，但不能替代人工键盘和读屏测试。

## SEO 边界

框架提供 head 元数据、canonical、Open Graph、JSON-LD、robots 和 sitemap 构建辅助，但它仍是浏览器 SPA，不等同于 SSR/SSG。营销站、文档站和需要稳定搜索 URL 的页面，应选 history 路由并配合服务器回退，或在发布链路增加 SSR/SSG；管理后台、登录后应用通常不需要索引。

## 类型与检查

类型入口为 `templates/kniu-project-spa/client/core/kniu.d.ts`。在 CLI 目录运行：

```powershell
npm run check
npm run build:template
```
