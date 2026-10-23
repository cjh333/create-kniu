# KniuSystem 经验库（常错与共性问题）

## KniuSystem 框架守则

-	**面向用户的代码简洁**：页面/控制器是否有大量样板、重复劳动
-	**用户易上手**：API 一致性、文档与实现一致、坏味道误导
-	**代码性能优异**：运行时/渲染/内存/N+1
-	**框架防护等级安全**：注入、XSS、越权、敏感数据
-	**通用逻辑封装在核心库client/core内**：页面层是否在重复造轮子

> 只留「换个会话还会再犯」的稳定结论；过程叙事与验收数据见 `.workbuddy/memory/` 每日日志，规则化条目见工作区 MEMORY.md（编号引用）。

## 模板引擎与绑定层

- **模板引擎输出不含别名（kniu-cli SPA 模板定案）**：别名只在模板引擎内解析——`renderTemplate` 渲染前经 `resolveTemplateAliases` 统一转正式路径，dev 与 build 同一机制；index.html 是纯壳（meta + `#client` + 唯一 client.mjs 脚本），favicon/style/js 三类头资源由 `kniu.config.js` 的 `template.head` 配置（favicon 字符串、style/js 数组）经 `TEMPLATE` 插件挂载后注入，动态注入的 js 需 `async = false` 保持顺序；页面中不允许存在先于 client.mjs 的脚本，模板清单（dev `/templates.js`、build `templates.*.min.js`）以 `meta[name=kniu-template-manifest]` 声明正式路径、由路由 start 时动态 `import()` 加载（build 侧 meta 必须写绝对路径，相对路径会被 import() 按入口模块 URL 解析而 404）。
- **模板内容文档的 upgrade 是 no-op**：`:for`/`:if` 从 `block.content` 克隆的节点属于独立 Document（注册表为空），`customElements.upgrade()` 静默跳过；在游离 frag 上先绑定后插入会让 `:option`/`:form` 全部落空。治本：升级前先 `document.adoptNode()`。排查指纹：`__kniuOptionsValue` 参数包存在 + `name` attribute 为 null + 自有 `value` 为 true = 绑定发生在未升级元素上。
- **kniu-cli 模板引擎渲染顺序（已修）**：`renderTemplate` 顺序必须是「resolveTemplateAliases → bindAttributes（跳过 template 标签）→ renderBlocks（:for/:if + interpolate）」。旧顺序插值先行会把 `:form="{{expr}}"` 属性值当普通插值消费成空串，`data-kniu-form` 丢失表达式、setPath 写空键——双向绑定从建立起就失效。绑定表达式现以 `encodeURIComponent` 存入 `data-kniu-form`/`data-kniu-handler`，bind() 侧 decodeURIComponent 还原，躲避后续插值。排查指纹：浏览器 `input.getAttribute('data-kniu-form')` 为空串即中招。
- **整页重渲染的滚动钳制**：innerHTML 重建 + 组件布局未稳定时 `window.scrollTo` 会被钳到当时文档高度允许的最大值。治本三步：① 交换期间 `root.style.minHeight = 已测高度` 锁住文档高度；② `root.style.overflowAnchor = 'none'` 关闭浏览器滚动锚定（否则组件升级后的二次布局会被浏览器自动补偿约 12px）；③ 双 rAF 释放 minHeight 后校正 + `setTimeout(120)` 落定再校正。同页重渲染记 `window.scrollY`、跨路由回 0。
- **模板插值细粒度更新（kniu-cli 已实装）**：`renderTemplate(source, data, { collect: true })` 在 collect 模式下把插值结果包成 `<!--kniu-t:expr|raw-->值<!--/kniu-t-->` 标记，标签内的插值不标记（防破坏属性）；router 用 TreeWalker 收集标记建「表达式 → 文本节点」索引后移除注释，`patchTextBindings()` 就地更新 textContent。`:form` 的 input/change 在 `suppressRender` 保护下只做 patch，不触发整页重渲染——输入零滚动、零闪烁、焦点天然保持。空值插值不产生文本节点，需用 `insertBefore` 补空 Text 节点占位。**`:for` 循环体内的插值必须禁用标记**（渲染该项时临时 `markMode = false`）：循环局部变量（`feature`/`x`/`cell`）不在根 model 中，被登记后 patch 求值为 undefined 会把整块内容清空，症状是「输入文字时列表和表格内容变空」。
- **模板 include 作用域**：header/footer 等公共 include 渲染时 scope 合并主路由上下文（route/params），`{{route.title}}` 才有值；route.title 为函数时需按控制器数据求值后渲染，防止函数源码进页面。
- **模板表达式能力**：`evaluateTemplateExpression` 支持 `||`、`&&`、`!`、`===`、`!==`、`==`、`!=`、`>`、`<`、`>=`、`<=` 与三元（可嵌套，`splitTernary` 按顶层 `?`/`:` 扫描并跳过引号内字符）；三元必须先于 `||`/`&&` 拆分才符合 JS 优先级。自定义组件模板与页面模板共用同一求值器（`kniu-components.mjs` 导入），所以组件模板里写 `{{ value >= 1 ? "★" : "☆" }}` 曾因缺 `>=` 与三元而全部渲染为空——「自定义组件无效」优先查表达式是否受支持。
- **浏览器验证假阳/假阴**：agent 轮次间不硬刷新会一直跑旧 ESM 模块（绑定类修复必须带 cache-bust 重载再测）；agent 断言「input.value 已变」不代表绑定生效（那可能只是 fill 的直接赋值），必须查回显文本；scrollY 断言前先算 `scrollHeight - innerHeight`，视口大时目标位置可能物理不可达。
- **COMPONENT.use 模板作用域就是 state**：`bindings.state || bindings`，自定义组件模板直接写 `{{ value }}` 而非 `state.value`；组件初始值来自宿主 attribute 时必须在 onMounted 里手动读取（connectedCallback 不做 attribute→state 映射）。
- **自定义组件状态必须外部受控**：任何模型变更都会触发整页重渲染，自定义元素被销毁重建，组件内部 state 全部归零、只按宿主 attribute 重新初始化——症状「点一下『增加次数』，评分从 5 星回退到 3 星」。治本：可交互状态放进控制器 state 并由页面绑定（`value="{{rating}}"` + `@change="onRate"`），组件只负责渲染与派发。排查指纹：点击组件后 `host.getAttribute('value')` 未变化即模型没写回。
- **派发事件只能走 ctx.emit**：`COMPONENT.use` 的 `setup(ctx)` 里只有 `ctx.emit(name, detail)`，`host.emit` 是 undefined，会抛 `host.emit is not a function` 并被 click listener 吞掉，表现为「组件内部状态变了但父级模型收不到」。onMounted 回调签名是 `(host, root)`，事件派发不要用 host。
- **所有 Shadow Root 样式走 adoptedStyleSheets**：影子根里不允许出现 `<style>` 节点，DevTools 中应显示 `#adopted-style-sheets` 下的 `#adopted-style-sheet`。实现要点：`attachComponentShadow` 注入基础样式后接管影子根的 `innerHTML` setter，把模板里的 `<style>` 文本抽出改挂 adopted 样式表，再 `replaceChildren` 结构；同一段 CSS 用 Map 缓存为同一张 `CSSStyleSheet` 多实例共享；无构造式样式表的浏览器回退为 `<style>` 节点并记录 `__kniuFallbackStyles`，下次赋值前先移除防止累积。KniuSystem 侧另有两条独立链路：`UI.useComponent` 的 `style` 直接 `adoptSharedStyle`（不再 append `<style>`），页面视图由 `loadHtmlTemplate` 在 `replaceChildren` 前从 fragment 抽出 `<style>` 转成 adopted 样式表。
- **hash 路由 query 不参与匹配**：navigate/normalize 会丢 `?query`，路由表是 `/about/:id` 时 `#/about?x=1` 匹配失败静默回落默认路由（症状「链接点了没反应」），路径参数应写在 hash 路径段里（`#/about/1`）。
- **指令处理顺序**：`:option`（配置）必须先于 `:form`（取值）——凡 value setter 依赖 options 语义的组件（date-picker、switch），配置先行取值在后，顺序颠倒会丢值。
- **deferred 条件渲染**：DocumentFragment 中创建的 `:if/:for` 节点必须延后到真实 DOM anchor 插入后激活；`:for` 克隆项内嵌套 `:if` 要递归激活后代节点，不能只处理循环根；keyed 与普通 `:for` 行为必须一致；deferred 激活函数禁自递归（路由渲染栈溢出）。
- **:for 逐项插入的兄弟判定**：本项 connectedCallback 执行时下一项尚未入 DOM，同步读 `nextElementSibling` 恒空——兄弟布局判断一律推微任务。
- **leaf-plan 快路径不变量**：`setupFor.update()` 与 `build()` 同闸——模板含 `:for/:if/:elseif/:else` 时禁走叶子计划快路，否则 `:if` 分支永不重建（详见工作区规则 #207）。
- **字段级订阅（P1 定稿）**：ITERATE（ownKeys）订阅必须挂响应式代理；整对象读取兜底 `subscribeWholeObject`；「遍历中间步 vs 整对象读取」按表达式文本静态判定（动态枚举会产出虚假路径）；`createView` 按作用域身份（item 代理同一性 + index）分流，身份未变直接 return 保住 per-node 订阅。
- **P2 代理缓存教训**：三级代理缓存命中完美（1000→1）但端到端零差异——**微基准占比 ≠ 端到端收益**，任何优化必须配对 A/B 验证后再合入。
- **三档调度**：`pre/render/post` 顺序 flush，`MAX_FLUSH_CYCLES=100` 兜底；用户 `watch` 回调走 post 档（执行时 DOM 已更新）；兜底轮打断自入队链后需显式 `flushJobs()` 排空，不能依赖已 resolve 的 nextTick。

## 组件

- **kniu-tab 两形态**：一体式（kniu-tab + panel）/ 解耦式（kniu-tab-head 的 `for` 指向 body 的 id）。active 优先级：options.active（受控）> attribute > 首面板；head 一次式配置 `:option="{{for,active,data:[{name,label}]}}"`，**点击后必须回写 `_options.active`**，否则 observer 会把选中项拉回初始页。页面零状态接线，面板常驻 DOM 仅 hidden 显隐。
- **::slotted 样式坑**：`::slotted(x){display:block}` 是作者样式，会压过 UA 的 `[hidden]{display:none}`——必须同时写 `::slotted(x[hidden]){display:none!important}`；`:host{display:inline-flex}+line-height:0` 会沿扁平树继承进 slot 内容，共享样式 `:host` 用 `display:block`，需要 inline-flex 的组件在自身 shadow 追加第二张 style 覆盖。
- **JS 基础坑**：class 是块级作用域，同类多注册类必须定义在 if 块外；connectedCallback 先于子元素解析，首渲染依赖 MutationObserver 异步补挂。
- **input/date-picker options 通道**：OPTION_ATTRIBUTES 白名单键反射为宿主 attribute（camelCase→kebab-case）；构造器须迁移自有 value/options；`'options' in node` 为 true 后 `:option` 走 own-setter 分支，与属性插值等价。
- **行编辑弹窗按列类型映射控件**：date/datetime/time→日期选择器（按粒度），长文本→富文本编辑器，json→源码模式编辑器，blob→textarea。载入值必须 `decodeHtmlEntities` 单轮解码——全站约定「写库 encodeFields / 读接口 decodeFields」，库内文本是实体形态；解码后保存原样入库，读取端幂等。
- **编辑器细节**：加粗输出 `<strong>`——`execCommand('bold')` 的标签由浏览器决定（生成 `<b>`），在工具栏命令出口与 Ctrl+B 快捷键统一走 `_normalizeBold()` 就地替换并还原选区；textarea 清除图标需避让滚动条（right:18px）；弹窗字段 margin 语义=「下一个兄弟是 form-cell/input-group 才设 margin-bottom」（末项不留边属预期）。
- **编辑器空态行号**：内容版本缓存不能覆盖尺寸变化；`ResizeObserver` 和 `maxHeight` 变更必须以 force 调度 `_updateLineNumbers(true)`。rAF 合批期间要累积 force 标记，空内容时才会按最终 `clientHeight` 补齐可视行号，避免行号栏停留在旧的 200px 高度。

## 页面与鉴权

- **数据库页守卫只判登录态**：`onMounted` 仅 `AUTH.isLoggedIn()`；`AUTH.getUser()` 为 null ≠ 非超管；角色差异由导航渲染层收敛（`showDatabaseAdmin`），页面不重复判角色（用户拍板定案）。
- **登录失效链路**：restoreSession 在首路由渲染前完成，markLoggedOut 只复位本地态不跳转；后端 Base 对失效会话统一 401「登录已失效」，请求层 401/1001 自动登出跳登录。
- **后台系统信息**：sessionStorage 先渲染 + 挂载单次完整网络刷新，禁轮询完整快照；服务器 IP 展示口径=公网出口 IP（多 HTTPS 服务短超时 + 缓存，失败显示「—」，禁把内网/代理地址伪装为公网 IP）；上传上限唯一来源 `api/config/upload.php` 的 MAX_SIZE。
- **公共静态资源路径**：生产接口可返回以 public Web 根为准的 `/static/...`（如默认头像）；开发服务器和 dist 预览服务器都必须将该前缀映射至对应 `public/static/...`，不能只映射 `/upload/...`，否则本地会发生资源 404。
- **脚本 MIME text/plain 报错指纹**：浏览器对 script src 报「MIME type ('text/plain') is not executable」时根因多为 404（dev server 404 响应即 text/plain），先核对资源真实路径而非 MIME 配置；kniu-cli 模板中 `@plugin` 指向 `public/static/plugin/` 根，kniu 库文件实际在 `plugin/kniu/` 子目录，引用应用 `@kniu/kniu.min.js`。
- **静态根单一配置**：`client/config/server.js` 的 `PUBLIC` 是公共资源源目录唯一来源；路径别名、构建器文档/复制目录、开发服务器和预览服务器均读取该字段，禁止在核心文件硬编码 `public`。
- **核心与项目解耦**：`client/core` 只保留框架逻辑；控制器目录、组件标签前缀、公共视图目录、壳页面规则、API 前缀、认证端点/字段映射/存储键、CSRF 协议、代理响应头和编辑器上传端点均从 `client/config/{app,auth,request,server,ui}.js` 读取。新增业务协议先配后用，禁止把项目路由、接口或存储键写回 core。

## 基准与优化方法学（长期有效）

- **基准方法学**：顺序测量被堆增长/GC 税污染（同一原语前半程 12ms 后半程 28ms）——必须轮询交错或独立进程；跨实现对比同机配对交替（单次波动可达 2 倍+）；对照线与分项同时测、分项之和 ≤ 对照线；挂载类基准注意口径偏差，结论按保守方向解读。
- **性能格局（O1-O13 收敛后定稿）**：更新热路径（细粒度文本/属性直写 DOM）显著快于对照框架；挂载/冷启动为「无编译步骤」运行时解释架构的固有成本，已从 9 倍差收敛到约 5.6 倍，日常数百行规模无感；列表「换数据」必须 `kniu:key`，大数据量列表用 kniu-table 行池。
- **选型终点**：前端目标优先级 = 易学 > 简单 > 不失性能；不为边际收益引入构建期预编译（破坏「零编译步骤」前提），运行时解释型优化 O1-O13 即合理终点（详见工作区规则 #205/#207）。
