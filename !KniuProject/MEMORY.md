# 跨项目通用规则与配置

## 长期偏好

- **记忆文件工具无关**：本目录（全局层）内的记忆文件是通用记忆体，面向所有具备记忆机制的 AI 助手；内容不得绑定特定 AI 品牌或其私有机制，规则只引用逻辑位置，实际路径对照仅存于本文件「记忆位置」一节。
- 报告格式：改了什么 / 为什么 / 验证（表格化），附文件路径、URL 与错误消息/堆栈。
- 偏好最小改动优化，坚持「不改逻辑」；方案偏离需求时快速修正而非重做。
- 模糊范围（目录/页面/口径）先用提问澄清；批量编辑后逐一确认完成再进入下一步。
- 决策题直接给推荐答案；探针断言必须相对比较，禁止写死。
- 前端无状态原则：不做登录守卫/失效判断，鉴权全在后端；并行请求用 Promise.all 替代回调地狱。

## 经验库（常错与共性问题）

1. **NodeList 禁止直接链式数组方法**：`querySelectorAll` 结果要 `Array.prototype.filter.call(...)` 或 `Array.from(...)`，直接 `.filter()` 抛 TypeError。
2. **Controller 方法 Promise 链缺 return**：基类 wrapper 会提前清理请求上下文（`_req`/`_res` 变 null），异步回调里报空值错误。
3. **构建器 import 正则不跨行**：`import` 必须单行；多行写法 dev 正常、构建时匹配不到被原样留进产物，整站崩。
4. **按字符串前缀判 URL 协议前必须先归一化**：`trim()` 不够，须剔除全部空白与控制字符（HTML 实体 `&#9;` 解析后 `trim` 去不掉），否则 `javas&#9;cript:` 绕过黑名单。
5. **浏览器端代码引用 `process` 等 Node 全局**是 Node/Browser 兼容性陷阱。
6. **列表派生字段（按钮态/状态文字）必须随数据整批重算**：切换状态后只算新行会出现两行都「当前」或都不显示的错位。
7. **缓存编译产物、不缓存行数据**；缓存键与调用参数严格分离。
8. **options-only 组件要整体换新对象触发刷新**，原地改子属性不重渲染。
9. **表达式写错一字常是「静默失效」**：编译不过组件退回默认值、不报任何错——渲染异常先查绑定表达式与作用域（`scope.row.*` vs 控制器变量）。
10. **目录扫描类校验必须先对齐「消费方真正用了什么」**，否则对着不存在的产物报恒红。
11. **跨克隆/异步绑定链的配置必须「属性可重解析 + 消费方惰性求值」双管齐下**：expando 不随 cloneNode 复制，靠保留源属性供重绑续命；消费方一次性快照会把尚未写入的绑定定格成坏值（`"1"≠true` 全显示关、点击不发请求）。任何一处急切快照都坏。
12. **组件共用样式必须全部走 CSS 变量，配置唯一入口是 client.mjs 的 UI.use(theme)**：组件 CSS 写死色值/圆角/高度会让全局主题改不动（KniuSystem 2026-10-08：按钮主色/hover/small 高度硬编码 + 19 个组件 65 处裸 `#409eff`，全部 `var(--kniu-xxx, 同值兜底)` 化后 theme 即时生效）。CSS 变量失效是**静默**的（声明整体无效回落默认值），排查要看 computedStyle 而非源码。验证主题跟随：运行时改 `:root` 变量再读组件 computedStyle，取样必须选能体现该变量的实例（如验证背景色要选实心按钮，link/text 变体 bg 恒透明测不出）。
13. **动态 `import()` 返回模块命名空间，默认导出在 `.default` 上**：`const UI = await import('x.mjs')` 拿到的是命名空间对象，`UI.default` 才是 `export default` 的值；探针/脚本里直接 `UI.defineComponent` 会得 undefined（组件其实已被示例文件用 `import UI from` 默认导出成功挂载，只是探针读不到）。统一 `(await import(x)).default || mod` 兼容两种解析（KniuSystem 2026-10-08 挂载探针首版踩中）。

## 规则变更记录

- 2026-10-08：按《部署说明》完成记忆归类——本文件存跨项目偏好+经验库（常错共性）；项目记忆回归项目规范（已删除其中重复的英文旧文档，原 334KB 版备份于项目记忆目录的 `backup/` 下）；SOUL.md 补全身份/边界/红线/防重复机制；本文件归位本目录（全局层 `!KniuProject/`）。
- 2026-10-08：用户明确要求（16:45）——**每轮代码修改除项目记忆外，必须同步更新本目录（全局层 `!KniuProject/`）内的记忆文件**（本 MEMORY.md 的经验库/规则变更记录、SOUL.md 涉及时同步），无需用户提醒自动执行。

## LLM 配置

- 本地中继：127.0.0.1:8790（免费模型聚合）
- 可用模型：Qwen2.5-14B-Instruct-1M 等
- API Keys：智谱 GLM、Kimi、硅基流动、魔搭 ModelScope、SenseNova 商汤、Google Gemini、OpenRouter

## 开发环境

- Node.js 22+（管理版本优先）
- Python 3.13+（管理版本优先）
- Windows 用户：cjh33
- 网络代理：极兔客户端（HTTP_PROXY=127.0.0.1:63636）

## 通用约束

- 所有项目必须遵循文件操作安全原则
- 禁止删除个人目录文件
- 修改前备份，操作后确认
- 使用 present_files 展示最终成果

## 记忆位置（实际路径对照，唯一来源）

> 逻辑位置以本表为准；项目记忆目录名源于当前所用 AI 工具的约定，更换工具时以新目录为准，规则引用的逻辑位置不变。

- 全局层（跨项目通用，本文件）：`D:\D09WebModel\W03_KniuSystem\!KniuProject\MEMORY.md`
- 主规则：`D:\D09WebModel\W03_KniuSystem\!KniuProject\SOUL.md`
- 部署说明：`D:\D09WebModel\W03_KniuSystem\!KniuProject\README.md`
- KniuSystem 项目记忆：`D:\D09WebModel\W03_KniuSystem\.workbuddy\memory\MEMORY.md`
- KniuSystem 每日日志：`D:\D09WebModel\W03_KniuSystem\.workbuddy\memory\YYYY-MM-DD.md`（只保留最近 3 天，过期先提炼进项目记忆再删）
- 2026-10-08 17:25：评论组件 `.kniu_sys_comment_submit`/`.kniu_sys_comment_emoji_btn` 高度/圆角/hover 色接入全局变量（规则 #175 补⑥）；avatar/textarea 的固定尺寸属尺寸语义，不纳入控件高变量。
- 2026-10-08 17:40：全组件样式复审——btn/input 系控件高与圆角残余硬编码 23 处、语义色 148 处全部接入 theme 变量；定稿优先级链「实例配置/内联 > theme 全局 > CSS 兜底」，kniu-btn.metrics.css 的 14 处 !important 移除（会压过内联，违规）；插画 SVG 与导出 HTML 保留字面量（无变量环境）。
- 2026-10-08 18:24：kniu-page 分页顺序修复——`_render()` 原拆 head/body 两行且 body 在 DOM 前面，跨行顺序被打乱（daily 页「总数、条数、上一页…」≠ layout 声明）；改为单行平铺 `replaceChildren(rowFragment)`，DOM 顺序严格等于 layout 顺序，未列项隐藏。**通用经验**：组件若把声明式顺序配置（layout/order）拆到多个 DOM 容器渲染，跨容器顺序必然失真——顺序类配置必须单容器按声明顺序逐项 append；优先级链沿用「实例内联 > 全局 UI.use 默认」。
- 2026-10-08 20:49：KniuSystem 组件目录化三件套试点（kniu-article-tab）——大文件单 IIFE 内的组件按 Vue SFC/微信小程序形态拆为 `组件名/{.html 模板骨架, .css, .mjs 组件类+register}`，组件模块不反向 import 宿主（避免循环依赖），共享闭包工具由宿主构造 context 对象注入；文本资源（.css/.html）经 `?module` 通道同步当 JS 模块拿文本（dev 服务器与构建器两侧同语义，.html 导出不做空白压缩）。**通用经验**：①拆 IIFE 闭包不必先抽公共核心库——context 注入即可起步，迁完再评估是否收敛为独立核心模块；②动态内容填入静态模板骨架而非整段 innerHTML 拼接，可让模板结构缓存 key 恒定；③改了 dev 服务器资源通道逻辑必须重启 dev 进程，旧进程会按旧分支返回错误形态（裸 HTML 而非 JS 模块）。
- 2026-10-08 20:51：KniuSystem 全局配置入口统一为 `UI.use`（用户定稿「UI.configure 改为 UI.use 一种写法、删除 UI.configure」）——内部 `function configure` 改名 `use`、公共 API `use: configure`→对象简写 `use,`，`UI.configure` 别名彻底移除；文档 `KNIU-UI.md` 的 `UI.configure()`→`UI.use()`（2 处）。**架构决策**：组件「拆分 vs 单文件」用户拍板——拆分更好；理由：生产性能零差异（打包器把全部 import inline 进同一 dist/client.*.js，源布局对运行时无影响），dev 仅多几个 ?module 请求可忽略，维护性显著优于 8500 行巨石且贴合 Vue/小程序心智；维持 pilot 混合模式（kniuui.mjs 注册中枢 + 组件外置子目录，context 注入共享工具），其余 34 组件迁完前把闭包基础设施下沉为 base 模块可降风险（化解旧「单文件不拆」顾虑）。
- 2026-10-08 22:11：KniuSystem 组件目录化**全量收官**——`kniuui.mjs` 内 28 个组件（含 article-tab 试点）全部按「Vue SFC/小程序自定义组件」形态迁出为 `kniuui/<名>/kniu-<名>.mjs`（组件模块 `export function registerX(context)`，共享闭包工具由 IIFE 顶 `KNIU_COMPONENT_CONTEXT` 注入；CSS 常量集中经 context 下发，`.html/.css` 走 `?module` 文本通道，dev/构建器两侧同语义）。生产性能零差异（打包器 inline 全部 import）。**通用经验（提取脚本坑）**：①`collectLocals` 只扫真实声明（function/class/const/let/var+解构），**绝不扫 `(...)` 调用实参**——实参含 CSS 常量/helper 会被误判为局部声明、错误排除出解构，渲染期 ReferenceError；②解构用「MASTER 全键 − 本组件局部声明」最稳；③判定「是否拆分回归」用「原始单文件对照实验」——`kniu-form` 裸 `<kniu-form>` 升级期 `createElement` 抛 `NotSupportedError` 是预存 quirk，拆前拆后同现。验证：build 通过、CDP 真机 35/36 PASS。
- 2026-10-08 22:15：KniuSystem 新增**挂载自定义组件扩展 API**——`UI.defineComponent(tag, registerFn)`（挂在默认导出 `KniuUI`），开发者认为内置 `kniu-*` 组件不够用时可自行编写组件挂载进项目。`registerFn(context)` 透传与内置相同的 `KNIU_COMPONENT_CONTEXT`（attachComponentShadow/adoptSharedStyle/KNIU_I18N/REQUEST/confirm/msg/installOptionsOnlyProtocol/各 CSS 常量…），自定义组件是一等公民。约束：tag 小写含连字符、`kniu-` 前缀保留给内置（直接拒绝）、重复 tag 幂等跳过、`customElements.define` 的 tag 须与首个参数一致；可选 `context.installOptionsOnlyProtocol([tag])` 接入标准化 options 协议。示例 `client/core/kniuui-contrib/app-rating/app-rating.mjs`（星级评分 `<app-rating>`），挂载=入口处 `import` 一次该模块；回归 `test/probe_define_component.mjs`（CDP 真机全 PASS）。**通用经验**：动态 `import()` 返回命名空间、默认导出在 `.default`，探针要用 `(await import(x)).default || mod`，否则误判 API 不存在（组件其实已挂）。
- 2026-10-09 10:20：KniuSystem 组件 CSS 目录化**资源层收官**——组件专属 CSS 全部随组件进各自子目录；根目录剩余全局 CSS 收拢至 `client/core/kniuui/kniu-other/`（base/font-face/content-table/dropdown/dropdown.option/markdown/richtext 共 7 个），`kniuui.mjs` 22 条 CSS import 全部改指组件目录或 kniu-other，根目录不再有任何 CSS。验收链：import 目标存在性逐条校验 → `npm run build` → dist 产物 grep 含新路径 → `node test/probe_bundle_boot.mjs http://localhost:6988` 全绿（24 个 kniu-* 元素、无 JS 报错）。**通用经验**：①批量 `mv` 用 `&&` 串联时，首个不存在文件会截断整链且后续命令静默未执行——移动类批量操作必须逐段核对清单再确认终态（`ls` 目标目录）；②preview 端口是 6988，`probe_bundle_boot.mjs` 默认打 6990，需显式传 baseUrl。
- 2026-10-09 10:30：全局层记忆文件**去品牌化（工具无关化）**——用户定稿：记忆文件面向所有 AI，不涉及任何特定 AI。改写三份文件：①README.md 标题改「AI 记忆文件部署与维护说明（工具无关）」，用户级/项目级目录一律用 `<用户记忆目录>`/`<项目记忆目录>` 占位；②SOUL.md 优先级链与记忆体系只引用逻辑位置，实际路径对照收敛到 MEMORY.md「记忆位置」唯一来源；③MEMORY.md 长期偏好新增「记忆文件工具无关」条目，同步规则表述改为「同步更新本目录（全局层）内的记忆文件」，并修正原先指向不存在路径 `!KniuProject\.workbuddy\` 的失效引用（实际文件在 `!KniuProject/` 根）。另：每日日志保留窗口定稿为**最近 3 天**，过期先按主题提炼进项目级 MEMORY.md、确认后再删；此清理在每个工作日首次涉及记忆读写时自动执行，无需提醒。
- 2026-10-09 10:45：KniuSystem 自定义组件**迁址+简化封装**（用户定稿）——①开发者自定义组件不放核心库：`client/core/kniuui-contrib/` 撤销，示例移至 `client/custom/app-rating/`，后续自定义组件一律放 `client/custom/<名>/`；②公共写法提炼成 `UI.useComponent(spec)`（spec=`{tag, style?, template?, setup(ctx)}`），一口完成 Shadow 初始化+options 合并+响应式绑定+`host.emit`（派发 change），示例从 50 行缩到 30 行；③**挂载语义**：组件文件惰性，必须被应用入口 import（副作用调用挂载 API）才注册可用。**通用经验**：声明式 render 整体重绘 innerHTML ⇒ 事件监听必须委托在容器（shadowRoot）上，逐元素监听重绘即丢——凡「render 函数返回 HTML 字符串」的封装都要内置这条约定或改用框架 diff。验收：build 过 + 探针 PASS（dev 6987）+ bundle 启动探针全绿；规则 #179 原条目内补充（不另立新号）。
- 2026-10-09 11:10：KniuSystem `useComponent` **终版（用户两次纠正）**——①API 必须用项目钩子体系：项目无 `onRender`/`render` 钩子，渲染函数式封装被否；终版为 MVVM 形态 `setup(ctx)` 返回 `{state, ...actions}`（对齐 `kniumvvm controller(setup)`），生命周期 `onBeforeMount`/`onMounted`/`onUnmounted`，state 经 `TEMPLATE.bind` 响应式驱动视图、改 state 即更新 DOM；②**组件三件套分离**：`.mjs` 纯逻辑 / `.html` 纯布局（`?module` 导入）/ `.css` 纯样式（`?module` 导入）。**通用经验**：①shadow `<style>` 内 `@import "./x.css"` 相对路径以**文档**为基准而非组件文件——dev 即 404、dist 必破，组件样式外置一律走项目 `?module` 文本通道；②给宿主元素的能力（如 emit）必须同时挂在元素实例与 setup 上下文两处（ctx.emit=this.emit.bind(this)），只挂 ctx 会 `host.emit is not a function`；③后台服务 EADDRINUSE 先查是否是自己上一轮启动的进程还活着（服务可用则直接复用）。
- 2026-10-09 11:40：KniuSystem **系统组件三件套推广（可分离模板外置）**——kniuui 内置组件静态模板骨架一律外置 `<名>.html`（`?module` 导入，mjs 拼 `'<style>'+CSS+'</style>'+TEMPLATE`，多骨架加后缀如 `kniu-modal.confirm.html`），本轮外置 25 份覆盖 17 个组件；含动态插值/程序化 DOM 的（editor/comment/table/tab/like/user-login）保持内嵌，纯 `<slot></slot>` 无布局不分，json 仅确有需要才加；系统组件保持 `registerX(context)` 类结构、不用 useComponent。**通用经验**：①批量校验 `?module` 相对 import 的路径基准是 mjs 所在组件子目录而非目录根，用 Node 脚本逐文件解析最稳；②探针报「弹窗未打开」类失败先核对 admin 会话/页面上下文环境前提，再判是否代码回归。验收：26 mjs 语法过 + html import 全存在 + build 过 + dist 含模板内容 + bundle 启动探针全绿 + 三静态闸门过；项目规则 #177 原条目内补充（不另立新号）。
- 2026-10-09 12:45：KniuSystem **全项目四层审计+高危修复**——①模板引擎三个🔴：kniu:loading 引用 find 回调形参 `a` 出作用域（任何该指令用法必抛 ReferenceError）；模板表达式作用域无原型链拦截（`{{ constructor.constructor('…')() }}` 任意代码执行）；if/for 订阅三连泄漏（cleanups 只清不执行/嵌套 disposer 恒落顶层累积/过期 render 对脱离 anchor insertBefore 崩）。②MVVM：异步钩子内 effect 永不登记清理（activeInstance 同步段即 null）→ runHook 恢复。③后端安全：访问日志明文落 identity_token/验证码（改黑名单递归脱敏）；/captcha 免登录超大尺寸 OOM（硬夹取）；logout 不清 Cookie+未开 use_strict_mode（补齐）；frontBind 免验证码可爆破（不动契约，会话级 5 次锁 600s）；SQL 控制台封 LOAD_FILE/OUTFILE/SHUTDOWN。**通用经验**：①find/map 回调形参禁止在回调外复用（静态检查抓不到的 ReferenceError）；②「字符串模板 + new Function/with」求值必须拦危险键，且 globalThis 兜底同样要拦；③订阅清理语义=「注册到最近重渲染边界，最终 disposer 才上交外层」；④日志脱敏黑名单必须递归并覆盖 token/code 类键。修复顺带修好 test/core-state-sync.mjs 两处既有损坏（.html load 钩子缺失、kniuui.js 旧路径/configure 旧名断言）。未采纳项（深 watch 优化、controller/useComponent 内核收敛、CORS 严格比对、图片重编码、IP 限流等）已记录备查。
- 2026-10-09 13:30：KniuSystem 安全补强与退出竞态修复——①模板/富文本统一新增 `srcset` 多候选 URL 校验，拦截后续项中的 `javascript:`/`vbscript:` 与非位图 `data:`；动态 `kniu:style` 拒绝 CSS `expression()` 和危险 `url(...)`。②API 来源校验从仅主机名收紧到协议、主机、端口完全相同，预检仅对受信 Origin 返回 204。③退出登录必须**先** `AUTH.markLoggedOut()`/清本地身份，再发送 `/logout`；公共头部的 `/comment_reply_state` 与工作台 `/system` 请求先检查 `AUTH.isLoggedIn()`，匿名状态直接跳过，消除路由卸载/重挂载窗口的 401 噪声。验证：URL 单元断言、JS/PHP 语法检查、`npm run build`、`git diff --check` 均通过。**通用经验**：注销属于状态转换，前端认证态应在网络请求前复位；所有公共布局的受保护请求都要以当前认证态为前置条件，不能假设组件挂载即仍有会话。
- 2026-10-09 14:00：修复登录空表单校验异常——`kniu-form` 已通过 context 注入 `msg`，但校验失败分支误引用不存在的全局 `KniuUI.msg`，导致 `ReferenceError`；改为优先调用注入的 `msg`，上传组件同类错误一并修复。验证：相关 mjs `node --check`、`npm run build`、`git diff --check` 通过。
- 2026-10-09 14:30：前台首页接入 `kniu-more` 加载更多——新增组件三件套，`/getArticle` 支持分页元数据，首页按 8 条追加、搜索基于累计列表，末页显示 `noMore`。验证：JS/PHP 语法检查、`npm run build` 通过。
- 2026-10-09 14:45：补充 `KNIU-UI.md`：明确 `:option` 是 `kniu:option` 的完全等价简写，增加 `kniu-more` 示例，并说明同一组件不要同时声明两种写法。
- 2026-10-09 15:00：按用户定稿将组件名由 `kniu-more` 统一改为 `kniu-page-more`，保留 `:option="{{more}}"`、`count:10` 与控制器现有回调写法；组件目录及 html/css 资源同步更名。验证：`npm run build`、组件 `node --check`、`git diff --check` 通过。
- 2026-10-09 16:20：用户调整首页配置为状态对象 `more`（含 `onChange: loadMore`、`count:10`），广告项增加 `isShow` 条件过滤；同步确认 `kniu-page-more` 组件模板类名与 CSS，并让按钮点击调用 options.onChange。
- 2026-10-09 16:35：首页广告 `:for` 内嵌 `template :if` 未渲染，改为直接在循环项 `<li>` 上声明 `:if="{{item.isShow == 1}}"`，避免嵌套模板分支在 keyed 循环快照中的作用域/重绑问题。`npm run build` 与 `git diff --check` 通过。
- 2026-10-09 16:45：直接项级 `:if` 仍受 keyed 循环实现限制，改为控制器初始化时先过滤 `advertises`，模板只循环最终可见项，移除模板条件指令。
- 2026-10-09 17:00：按用户要求恢复模板条件渲染，不改控制器过滤；修复模板引擎 `queryDirectives()` 漏掉 root 自身的问题。`querySelectorAll('*')` 不包含克隆后的循环项 root，导致 root 上的 `:if` 永远未被 setup；现在先匹配 root 再匹配 descendants，首页恢复 `<li :if="{{item.isShow == 1}}">`。验证：模板 JS 语法、`npm run build`、`git diff --check` 通过。
- 2026-10-09 17:20：完善 `kniu-page-more` 分页语义：总数 `<= count` 时隐藏；总数 `> count` 才显示；追加请求返回空数据或最后一页后保留组件并显示 `noMore`、禁用按钮。首页将状态统一放入 `pageMore`，避免组件读取不存在的顶层 `loadingMore/noMore`。
- 2026-10-09 17:35：修复模板引擎 `:for` 根节点 `:if` 不渲染：克隆视图初始化时锚点尚未插入 DOM，`setupIf` 原先直接因 `!anchor.parentNode` 返回且丢失首次 render；现在暂存 deferred render，列表项插入后立即激活。控制器保持不变。
- 2026-10-09 17:50：修复后端总数 11 条时“加载更多”仍不显示：`pageMore` 是 options-only 对象，原地修改 `visible/loading/disabled` 不触发 options setter；新增 `updatePageMore()` 整体替换对象，确保总数大于 `count=10` 时组件显示。
- 2026-10-09 18:00：继续修复循环项根节点 `:if`：`setupIf()` 会把 root 替换为 comment anchor，但 `createView.roots` 仍保存旧元素，导致 keyed `:for` 提交错误节点；现在根条件 setup 返回 anchor，并由 createView 替换 roots 项后再插入。
- 2026-10-09 18:15：最终定位并修复 `:if` 首次 render 延迟补丁落错函数：此前 deferred 逻辑只加到了 `setupFor`，`setupIf` 仍在无 parentNode 时立即 render 并退出；现 `setupIf` 同样在锚点插入后触发 deferred render。验证：模板 JS 检查、`npm run build`、`git diff --check`。
- 2026-10-09 18:30：首页发布人链接到对应关于我：`getArticle` 返回 `publisher_role_id`，新增免登录 `/getPublisherAbout`，关于页读取 `role_id` 路由参数；发布人点击跳转 `#/about?role_id=...`。验证：JS/PHP 语法检查、构建通过。
- 2026-10-09 18:45：核查 `kniu-page-more` 属性链：新增真实 loading 旋转 icon（独立 span + CSS animation），按钮文本不再覆盖 icon；首页分页请求改用 `pageMore.count`（当前 6）而非硬编码 10，首屏阈值同步使用 count。`text/noMore/block/loading/disabled/count/onChange/visible` 均有对应行为。验证：组件/控制器 node --check、`npm run build`、`git diff --check`。
- 2026-10-09 19:00：确认首页分页不保留独立 `ARTICLE_PAGE_SIZE` 常量；`pageMoreCount()` 从 `state.pageMore.count` 读取，首屏请求、追加请求和显示阈值全部使用该配置。
- 2026-10-09 19:00：移除首页 `const ARTICLE_PAGE_SIZE = 6` 硬编码；新增 `pageMoreCount()`，首屏/后续 `page_rows` 与显示阈值全部读取 `pageMore.count`，count 成为唯一分页配置源。
- 2026-10-09 19:10：首页与详情页发布人链接统一使用 `:option` 的 `roleId/onClick` 隐式参数，控制器调用 `navigateTo('/about',{role_id})`；详情 API 补充 `publisher_role_id` 并修正模板拼写。验证：语法、构建、diff 检查通过。
- 2026-10-09 19:20：再次修复 `:for` 克隆根节点上的 `:if` 不渲染：`setupIf/setupFor` 在临时 `DocumentFragment` 中提前 render 会把结果插入即将丢弃的 fragment，只留下 comment anchor；现在对 nodeType=11 延迟到 anchor 插入真实 DOM 后 render，条件广告可正确显示。
- 2026-10-09 19:25：补齐 keyed `:for` 的 deferred `:if` 激活：上一修复只覆盖非 keyed 分支，而首页广告声明 `:key="id"`；keyed 分支插入 fragment 后现遍历 view roots 执行 `__kniuDeferredIfRender`，使 `item.isShow == 1` 的 `<li>` 真正插入 DOM。
- 2026-10-09 19:35：修复详情页 `kniu-comment` textarea 占位文字贴顶：全局组件样式归一化会转换裸 `padding` px，导致垂直内边距回退；评论组件在原 padding 后明确保留 `padding-top:10px`，使“说点什么吧...”与上边线保留 10px 间距。构建产物已确认包含该声明。
- 2026-10-09 19:45：继续处理评论框字体影响：`font: inherit` 会重置 textarea 的行高，导致占位符视觉贴顶；改为显式 `font:14px/1.5 var(--kniu-font-family)`，并给 `padding-top:10px` 加 `!important`、同步设置 placeholder 行高。
- 2026-10-09 20:00：详情页刷新按钮闪烁修复：详情主体 section 增加 `:if="{{!loading}}"`，请求期间不挂载文章、点赞、收藏、评论、返回按钮；`loadDetail()` 每次请求开始显式恢复 `state.loading=true`，统一由公共 `kniu-loading` 显示加载态。
- 2026-10-09 20:10：认证过期跳转统一改为 `authRedirect(function (routePath) {})`；请求层解析当前 hash 路径并传参，移除入口重复旧回调。
- 2026-10-09 20:20：`kniu-comment` 提交按钮默认 `disabled`；输入同步按 `String(value).trim().length > 0` 解锁，空白内容保持锁定。同步函数不再依赖字数统计配置，表情插入、无 maxLength 场景及初始渲染都能正确更新。
