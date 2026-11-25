# Kniu Router 路由模块使用文档

## 路由前缀（2026-11-13 全量调整）

| 分类 | 前缀 | 例外 | 示例 |
|---|---|---|---|
| 前台 | `/index` | 默认首页 `/` 保持（无业务段，`default: true`） | `/#/index/article/3`、`/#/index/vipcenter/article`、`/#/index/login` |
| 后台 | `/admin` | `/admin/dashboard` 原本已带前缀，保持不变 | `/#/admin/user`、`/#/admin/table/row` |

- 认证页 `/login` / `/register` / `/forgot` 的视图与控制器虽在 `admin/` 目录下，按**功能**归前台 → `/index/login` 等；`auth.loginRoute`、`anonymousRoutes`（`client/public/assets/Kniu-Special.js`）与 `privateRoutePrefixes: ['/index/vipcenter']` 同轮同步。
- 个人中心保留 `vipcenter` 业务段 → `/index/vipcenter/*`；首页 `/` 与框架通用 `#/` 判定（`Kniu-Contracts.mjs:isInternalLink`、Navbar 默认值）不动。
- **不留旧别名**：`api/core/Kniu-Seo.php` 的 302 同步改为 `/#/index/article/{id}`，旧收藏/外链失效；`startsWith('/admin')` 守卫在加前缀后覆盖全部后台路由。
- 匹配器按 `staticSegments` 降序排序（`Kniu-Router.mjs:70-82`），所有路由统一 +1 静态段，相对顺序不变，动态段仍排在静态段之后。
- 回归：`test/check_route_prefix_gate.mjs`（前缀一致性、零旧路径残留、template/controller 文件存在、配置一致、反向退化）+ dev/dist 真机逐条验证。详见 `!KniuProject/代码规则.md` 2.21。

## 路由跳转与参数

模板导航使用标准链接，不使用 `data-route`：

```html
<a href="#/about/12">查看关于页面</a>
<a :href="#/about/{{id}}">动态跳转</a>
```

路由路径可声明参数：

```js
'/about/:id': {
  template: 'about/about.html', 
  controller: 'about/AboutController.js' 
}
```

控制器可从 `setup` 的 `context` 调用 `navigate`：

```js
export default setup(({ context }) => ({
  open(id) {
    context.navigate('/about/:id', { id });
  }
}));
```

需要在站内切换时不显示 loading，可传第三个参数：`context.navigate('/vipcenter/1', {}, { loading: false })`。这仍会正常执行路由守卫、页面挂载和数据请求；只对本次跳转隐藏 BootLoading，不会进行浏览器整页刷新。

需要把参数放进 `history.state` 而不出现在 URL 查询串时，传第三个参数 `{ state: true }`：

```js
context.navigate('/database', { database: name }, { state: true });
```

Router 在跳转落定后写 `history.state.kniuRouteData = { path, data }`，其中 `path` 是**不含查询串的规范化路由路径**；`Kniu-Util.mjs:getRouteData()` 用 `getCurrentRoutePath()` 比对后取出 `data`，控制器侧统一经 `getRouteContext()` / `routeParams()` 消费。🔴 写入时机必须满足「目标 history 条目已是当前条目」：同路由分支同步写；跨路由分支在 `navigateGuarded(...).then()` 内补写并带 `routePath() === resolvedPath` 守卫——**禁在 `writeLocation` 之前用 `queueMicrotask` 抢先写入**（hash 模式 `location.hash` 赋值会创建 state=null 的新条目，先写的数据会 stranded 在旧条目上，目标页读到空 data 触发「跳转后弹回」；history 模式 `pushState` 携带旧 state 故不易暴露）。🔴 该分支涉及同步分支、落定回调分支与参数缺失 fallback 三条路径，改动 `navigate()` 局部变量必须同步全部引用并跑 `test/check_router_state_path_gate.mjs`（闸门模拟须建模真实微任务顺序，见 `!KniuProject/代码规则.md` 2.20）；`node --check` 无法发现未定义标识符。

匹配到的参数可在模板使用 `{{params.id}}`，也会传给 controller 的路由上下文。

路由 API 支持 `router.beforeEach(fn)`、`router.afterEach(fn)` 动态注册守卫（返回注销函数）；route 可用 `children` 建立嵌套路由，`controller` 可使用 `() => import('./controller.mjs')` 延迟加载，`template` 可使用异步函数解析模板路径。路由上下文提供 `matched` 父子路径序列。新导航会忽略较旧异步导航结果。

路由表唯一真源位于 `client/config/router.js`（2026-11-09 配置分层后），由 `client/client.config.js` 以 `pages.routes` 组合导出；后者是通用框架配置 + 业务配置的唯一入口，不在其中重复声明路由。`template` 相对 `pages.root`（见 `client/config/pages.js`），`controller` 相对 `client/controller/`；公共视图控制器映射位于同一文件的 `views`。后台路由可用配置助手复用统一 `layout`。通用 `beforeEach` 和 `afterEach` 钩子内置在 `client/core/Kniu-Router.mjs`。

## 路由命名与视图模板

`client/config/router.js` 的键（URL 业务段）与 `template` 的业务目录必须同源命名，细则见 `!KniuProject/代码规则.md` 2.11：

- `index/message/ListPage.html` → 路由应含 `message` 段；`admin/database/ConnectPage.html` → 路由应含 `database` 段。禁止同义词、缩写或连写（`innermsg`、`databasetables`、`dbconnect`）。
- 布局前缀 `/vipcenter`、`/admin` 默认不参与比对，动态参数 `:id` 一律不算业务段；前缀本身是视图业务目录名时该段同时计为业务段（`/vipcenter/:id` ↔ `index/vipcenter/DetailPage.html`）；模板基名（`ListPage` / `DetailPage` / `EditPage` 等）只表页面形态，不进 URL。
- `controller` 与 `template` 的目录、基名严格镜像，且文件必须真实存在（否则页面空白且无任何报错）。
- 新增路由由 `test/route_view_name_gate.mjs` 把关；当前仅默认入口 `/` 为结构性例外（无业务段），豁免清单**只减不增**，V11 扫描运行时文件确保旧路径零残留。
- 2026-11-09 存量已对齐：`/detail/:id`→`/article/:id`、`/profile/:id`→`/publisher/:id`、`/vipcenter/innermsg*`→`/vipcenter/message*`、`/vipcenter/aboutedit`→`/vipcenter/about`、`/vipcenter/articleedit`→`/vipcenter/article/edit`、`/admin`→`/admin/dashboard`、`/aboutedit`→`/about`、`/articleedit`→`/article/edit`、`/dbconnect`→`/database/connect`、`/databasetables`→`/table`、`/databasetable`→`/table/row`。`startsWith('/admin')` 一类的前缀守卫保持原样；SEO 302（`/article-{id}.html`）改用路径参数 `/#/article/{id}`，避免查询串被 `normalizeRoute` 截掉后落到错误页面。同日后续：个人中心业务名 `publisher` 整体改为 `vipcenter`（`/publisher/:id`→`/vipcenter/:id`、`index/publisher/`→`index/vipcenter/`），旧路径不留别名。
- 存量重命名属破坏性变更：同轮同步所有 `href="#/..."`、`context.navigate(...)`、路由守卫与 `meta`、`seo.routes`、面包屑/高亮映射、文档与闸门，重建 dist 并真机逐条验证。

路由表支持 `default` 标记缺省路由与 `title` 配置；`title` 可以是字符串或接收 `{ model, params }` 的异步函数（用于按数据动态设置文档标题）。数据库请求应放在 controller 或请求模块中，路由只读取 controller 返回的数据：

```js
// router.js
export const routes = {
  '/article': {
    template: 'article/detail.html',
    controller: 'article/DetailController.js',
    title: ({ model }) => model.article?.title || '文章'
  }
};
```

```js
// controller/article/DetailController.js
import { setup } from '../../core/Kniu-MVVM.mjs';

export default setup(async ({ reactive, context, onMounted }) => {
  const article = await fetch(`/api/articles/${context.params.id}`).then((response) => response.json());
  const state = reactive({ article: article.data });
  onMounted(() => console.debug('文章页面已加载'));
  return { state };
});
```

## 加载提示（BootLoading）

切换路由**必须**有 loading 效果（2026-11-23 裁决）：`renderWithBoundary` 渲染前调用 `showBootLoading()`、提交后调用 `hideBootLoading()`，与启动期共用同一套 `Kniu-BootLoading.mjs`（视口级固定遮罩，单例幂等：遮罩节点**常驻 DOM 不销毁**，样式全部由类控制、零内联样式——基础类持有可见态与 0.6s opacity 过渡，show 移除 `kniu_sys_boot_loading_hidden/_closed` 两个状态类，hide 先加 `_hidden`（淡出）再由计时器加 `_closed`（`display:none`）；避免路由高频切换下反复删除/重建节点开销）。`kniu-loading` 组件与全局 `setLoading` mask 已移除——项目只保留 BootLoading 一套 loading。

**时限已移除**（同轮裁决）：`minVisibleDuration`（最短可见 360ms）、`loadingMinWait` 硬等、`loadingOptions.duration`/`text` 配置全部删除——遮罩渲染前显示、提交即收，不再人为延长。

**遮罩落点（2026-11-23 第二轮裁决）**：
- **跨布局导航**（前台 → 后台等）：强制视口级 BootLoading（遮罩挂 `body`），即使目标路由设了 `showLoading:false` 也显示——旧页面在遮罩下保持可见。
- **后台同布局导航**：loading 只显示在内容区 `loadingTarget`（`.kniu_web_aside_content`）内——`showBootLoading({ target })` 传入容器时遮罩节点 `appendChild` 移入容器并加 `kniu_sys_boot_loading_contained` 类（`position:absolute` 覆盖父容器）；容器查找作用域为 `currentViewRoot`（页面宿主 shadowRoot，与 include 复用的 `existingTarget` 同源——`document.querySelector` 穿不透 shadow DOM，真机探针实测）。容器不存在时回退视口级。
- **`data-kniu-preserve` 契约**：内容区 `innerHTML` 重写会销毁挂在其内的遮罩，Router 两处内容区提交统一走 `wipePreservingOverlays`（wipe 前摘除 `[data-kniu-preserve]` 标记节点、写完补回），保证局部 loading 存活整个渲染期。BootLoading 根节点标记 `data-kniu-preserve="boot-loading"`。
- **页面级 `showLoading` 开关已移除**：后台路由统一走 BootLoading（`adminRoute` 工厂不再接受 `hasOwnLoading` 参数）——后台页面已无自带 loading（`kniu-loading` 移除、`kniu-table.loading` 未启用），设 `showLoading:false` 会导致两层都没有 loading（用户报「后台路由切换 loading 偶尔不生效」的根因）。Router 决策逻辑保留 `targetConfig?.showLoading !== false` 判断，未来真有自带 loading 的页面仍可配置关闭。

## 路由挂载点（kniu-router-view）

对标 Vue `<router-view>` 的声明式挂载点组件（`client/core/Kniu-Ui/Kniu-RouterViewComponent/`，注册于 `Kniu-Components.mjs` registry 与 manifest `CORE_COMPONENT_TAGS`）：

- `createRouter` 入口解析挂载点：容器内存在 `<kniu-router-view>` 时，页面宿主（`data-kniu-route-view`）统一挂进该组件（`root = root.querySelector('kniu-router-view') || root`）；未放置组件时回退容器本身，向后兼容。
- 组件自身零逻辑：`attachComponentShadow(this, { contain: false })` + `<slot>` 透传 light DOM 页面宿主，`:host { display:block; min-height:100% }`。🔴 **必须 contain:false**：默认注入的 `Kniu-Contain.css`（`:host{contain:layout}`）会让宿主成为 `position:fixed` 后代的包含块——本组件包住整页，页内 `fixed` 头部（如 `kniu-navbar[fixed]`）会相对它定位、随内容滚走（2026-11-23 线上「头部悬浮失效」根因）。
- 入口 `index.html` 在 `#client` 内放置 `<kniu-router-view />`（仿 Vue，无需任何标记属性）；构建器 prerender shell 直接锚定该开标签注入**内部**（无组件时回退 noscript 之后），保证 hydration 时 `root.querySelector('[data-kniu-prerender]')` 命中、首屏渲染后 shell 随 coexist 清理逻辑一并移除，不残留骨架。
- 🔴 **入口脚本必须由构建器注入到 `</body>` 前**：`#client` 挂在 `<html>` 上时 `mount('#client')` 的 root 是 `documentElement`，仅靠「root.querySelector('kniu-router-view')」把它修正成挂载点；而 dist 的入口脚本是 classic script（不自动 defer），若留在原位（`<body>` 开头、挂载点之前）就会同步执行，此时组件还没解析出来 → root 退化成 documentElement → `replaceChildren` 把 `<head>/<body>` 一并清掉（样式全丢、`document.body === null`）。dev 用 `<script type="module">` 自动 defer，所以只在 dist 暴露。Router 侧另有兜底：root 为 documentElement 时退到挂载点或 `body`。
- **布局内声明式槽位**：布局模板可直接写 `<kniu-router-view />` 标记路由内容落点（替代 `data-kniu-layout` 标记），`composeLayout` 渲染时将其**替换为页面内容（标记被消费、元素不保留）**。🔴 标记被消费意味着它不能承载几何样式——高度/滚动（如 `.kniu_web_aside_view` 的 `height:100%`/`overflow:auto`/`:has(.index_cells)` 守卫）必须由外层容器承担：TheMain 中 router-view 包在 `<article class="kniu_web_aside_view">` 内。优先级：`data-kniu-layout` > `kniu-router-view` > `contracts.router.layoutContainerSelector` 兜底。
- 🔴 **构建期静态块提取必须排除 `kniu-router-view`**（`Kniu-TemplateEngine.mjs` 的 `STATIC_EXCLUDED_TAGS`）：否则布局里「`<div class="...content"><article class="...view"><kniu-router-view /></article></div>`」整棵静态子树会被抽成 `%%KNIU_S_n%%` 占位符，运行时 `composeLayout` 拿到的布局源码里已没有槽位标签 → dist 首屏报「布局缺少 data-kniu-layout 槽位」，而 dev 不做静态块提取因此完全正常（2026-11-23 线上崩溃根因）。旧写法 `data-kniu-layout` 能幸免是因为属性名命中 `data-kniu` 动态判据。`composeLayout` 另有兜底：正常路径全部未命中且源码含 `%%KNIU_S_` 时，还原静态块后重试一次。
- 闸门：`test/check_router_view_gate.mjs`（R01-R09 + X01-X06）。

```js
const adminRoute = (title, template, controller) => ({
  title,
  layout: 'admin/common/main.html',
  loadingTarget: '[data-kniu-layout]',        // 同 layout 复用内容区的标记
  loadingContainer: '.kniu_web_aside_content', // 遮罩挂载容器
  template,
  controller
});
```

行为约定：

- 路由 loading 统一为**视口级 BootLoading**（`kniu-loading` 的 contained 容器内遮罩已随组件移除，不再区分容器内/整页两套）。
- 遮罩**无时限**（2026-11-23 裁决）：渲染前显示、提交即收，`minVisibleDuration`/`loadingMinWait`/`duration` 已全部删除。
- `showLoading: !hasOwnLoading` 的页面（自带 table loading 的列表页）不叠加路由 loading，由页面自身反馈加载状态。

## 数据先行渲染（一次提交）

导航的数据拉取在**底层**完成，最终只做一次「包含动态数据的完整 DOM」插入——不存在「空壳 → 数据落地重渲」的第二趟：

1. **遮罩阶段就开窗**：`renderWithBoundary` 在显示遮罩后调用 `beginRequestTracking()` 开启**请求追踪窗口**，窗口内新发起的全部请求（含请求链：A 落定后拉起的 B）都被纳入。提前到这里是必要的——控制器自己监听 `hashchange` 拉的数（详情页上一篇/下一篇）发生在 router 处理函数让出之后、`render()` 内部开窗之前，窗口晚开就会漏掉这批请求。`render()` 内的 `begin` 幂等，不会重复开窗。
2. 模型装配完成后、提交 DOM 前，`requestTrackingSettled(4000)` 等窗口内请求全部落定——此时数据已写入各控制器的响应式状态，`renderTemplate` 直接取到最终值。
3. 提交前清掉 mount 窗口的 `changed` 标记与已排期的 refresh 渲染：窗口内落定的数据已体现在本次提交里，不再冲刷出多余的整页重渲。
4. 硬超时 4s 兜底放行：慢数据走既有 refresh 链路晚到，绝不挂死渲染。
5. 首屏数据落定时遮罩仍在显示；提交即完整，遮罩收起后不再有内容替换。

### 首屏挂载窗口（settleFirstScreen）

控制器普遍把首屏加载写在 `onMounted` 里，而 `mounted` 原本在 DOM 提交**之后**才执行——请求落在追踪窗口之外，页面先以「空壳」提交（`:if="{{!loading}}"` 把正文整块藏起来），数据回来再整页重渲一次，观感就是「进页面加载两次 / 中间闪一下」。`settleFirstScreen` 把首次 `mounted` 提前到**已插入文档但不可见**的提交窗口内：

1. host 已 `replaceChildren` 进文档并 `visibility:hidden`（不是完全离屏——组件布局、`affix` 的 `isConnected` 守卫都需要真实文档环境），`mountViewTree` 完成组件升级与 `bind`。
2. `collectRefs` 后调用控制器首次 `mounted`：首屏请求在窗口内发起。
3. 重新 `beginRequestTracking()` + `requestTrackingSettled(4000)` 等这批请求落定；期间数据变化由 `mountState.mounting` 记成 `changed`，不排期 refresh。
4. 有变化则在**同一个隐藏 host** 上整页重渲一版（`innerHTML` + `mountViewTree` + `collectRefs`），用户仍看不到。
5. 全部完成后才恢复可见——遮罩撤掉时页面已完整，不会再有第二趟内容替换。

导航中途被后续操作取代时，撤销 `mountedControllers` 与 `mountState` 标记，让下次导航重新走首屏加载（避免「挂过但没显示」的控制器永久跳过数据加载）。`mounted` 抛错只记日志、不阻断页面显示。

边界：控制器实例跨参数复用（`controllerInstances` 缓存、`setup` 不重跑）时 `mounted` 不会重跑，数据由控制器自身的 `hashchange` 侦测拉取；这类请求由第 1 步的「渲染开始即开窗」覆盖，同样在提交前落定。回归闸门 `test/nav_once_gate.mjs`（三条腿：跨页 / 反向 / 同控制器换参数，断言「恢复可见帧内容 == 末帧内容」且恢复后零变化，并注入 700ms 网络延迟，否则本地快接口会让闸门永远绿）。

## 跨布局导航：并存与原子切换（2026-11-03）

- 背景：跨布局进入（前台 → 后台等）时旧版依赖 `kniu-loading` 的容器挂载，容器在旧视图不存在需要回退视口级（2026-11-18 用户反馈曾因静默 pending 全程无反馈）。2026-11-23 起改用 BootLoading 后此问题消失——遮罩恒为视口级，与容器存在与否无关。
- 现行行为：`renderWithBoundary` 识别 `targetConfig.layout !== currentLayout` 为跨布局导航，**强制显示 BootLoading**（即使目标路由设了 `showLoading:false` 也显示），旧页面在遮罩下保持可见；同布局导航按 `showLoading` 决定是否叠加。新建 host 分支保持**并存 + 原子替换**：`position:absolute; top:0; left:0; width:100%` + `visibility:hidden`（mountHidden），数据落定后清除定位样式并**只移除兄弟节点**。
- 约束：①width 必须 100%（不能 shrink-to-fit，隐藏窗口内的组件布局测量要与最终提交一致）；②提交不能 `replaceChildren(host)`——host 已是 root 子节点，replaceChildren 会把它摘下再插回，DOM 观察者会记第二次「新增节点」（e2e host 计数翻倍实测）；③导航被取代时在 mountHidden 恢复可见性**之前**撤下未交付的并存 host，否则绝对定位半成品会叠在旧页面上。
- 回归闸门：`test/check_admin_nav_partial_loading_gate.mjs`（S01-S03 决策单测 + S00 BootLoading 接线守卫）。

## 挂载期隐藏（mountHidden）

内容插入 → 样式注入 → 组件升级分**多帧**进行，中间帧以无样式/占位态布局呈现（透过半透明遮罩可见，观感即「上下抖动一下」，实测首页到达时文档高度 805→927→805）。四个提交点（新建视图 host / 同路由 refresh / include host 重建 / layout 内容区重写）全部用 `mountHidden(host, work)` 包裹：挂载期间 `visibility:hidden`，`finally` 恢复——中途导航中止也不留隐藏态，挂载完成一次性以最终形态显示。不采用完全离屏装配（挂完再插入），因为 affix 模板的 `isConnected` 守卫会在离屏等待期放弃挂载。

### 滚动条锁定（防「一闪一闪」）

`visibility:hidden` 不移除布局：中间帧是无样式占位布局，高度会瞬时偏离最终态，根元素/祖先滚动容器的滚动条随之**闪现又消失**（进入无滚动条页面时尤其明显，实测 `/login→/article` 出现→消失→再出现三连切换）。`mountHidden` 因此在挂载窗口内锁定滚动条：

- 锁定对象：`document.documentElement` + 宿主**祖先链**上所有 `overflow-y: auto/scroll` 的滚动容器（穿透 shadow 边界），覆盖前台根滚动与后台 `.kniu_web_aside_view` 内部滚动两套体系。
- 锁定值**保持源页面当前的滚动条可见状态**（可见→`scroll`、不可见→`hidden`）——整个提交窗口内轨道不发生显隐切换。若一律锁 `hidden`，有滚动条的页面在刷新渲染窗口内会「消失又出现」，仍是闪烁。
- **落地形态（规则 2.17/148）**：DOM 侧只切 `data-kniu-mount-lock="scroll|hidden"`（由 `Kniu-Util.mjs:setOverflowLock()` 统一写入/清理），样式由固定表 `kniu-scroll-lock-style` 的 `[data-kniu-mount-lock="..."]{overflow-y:...!important}` 承担；**禁止再写 `element.style.overflowY`**（原写法会在 DevTools 留下 `<html style="overflow-y: scroll;">`）。Shadow 内祖先容器先 `installScrollLockStyles(shadowRoot)` 上表再切属性。
- 释放延迟到**宏任务**（`setTimeout 0`）：同一导航的多个 `mountHidden`（include host → 内容区）顺序衔接时不留锁间隙；深度计数防嵌套提前释放；释放只 `removeAttribute('data-kniu-mount-lock')`。
- 效果：每次导航/刷新滚动条**至多变化一次**（释放后一次性落到最终态）。不引入常驻滚动条（`html{overflow-y:scroll}` 已被用户定案移除，不得恢复；`scrollbar-gutter:stable` 对根元素/视口在本机 Chrome 156 不生效，仅后台内部容器已用）。

## 事件委托（一次性插入的配套机制）

视图层全部交互监听统一**委托**在 scope 根上，不在元素上逐个 `addEventListener`：

- 覆盖四类：`@event`（`data-kniu-event(-N)` 属性）、路由链接 `a[href^="#/"]`、`data-action`、`data-Kniu-Form`（input/change 同步模型）。每类 scope 根挂按事件类型的监听（click/input/change/keydown/submit + 模板扫描到的自定义事件名），`WeakMap` 去重。
- 派发期沿 `composedPath()` 逐节点匹配属性触发；嵌套 scope（include shadowRoot 内含于视图 shadowRoot）以 `__kniuDelegatedBoundary` 标记分段，各处理自己的一段——与原生逐层冒泡每节点只触发一次语义一致。
- **`event.currentTarget` 语义还原**：逐元素绑定时代处理器拿到的 `currentTarget` 是绑定元素；委托下原生 `currentTarget` 是 scope 根（shadowRoot）。派发时给处理器传入包装事件，把 `currentTarget` 还原为触发体节点，其余属性/方法透传原事件。控制器里依赖 `currentTarget` 的写法（`dataset`、`__kniuOptionsValue`、组件宿主挂载对象如 `__kniuUserLoginOwner`）因此保持可用。
- **文档级兜底派发**：部分组件会把带 `@event` 的宿主 teleport 到 `document.body`（如 Kniu-UserLogin 把用户菜单搬到 body），脱离所有 scope。`ensureDelegation` 同时把事件类型注册到 document 级派发器，与 scope 派发共用 `__kniuDelegatedBoundary`——scope 已处理的事件从 boundary 之后继续，只有 scope 覆盖不到的 teleport 光 DOM 被文档级真正处理，不会双重触发。
- **插入即生效**：属性在派发期读取，任何时点整段插入的带属性节点自动可交互，无需重新绑定。处理器经元素上的 `__kniuModel` 标记解析（bind 期标记；晚于 bind 插入的节点回退 `lastModel`）。
- 同元素多事件（如 `keydown.enter` + `input`）必须按派发类型匹配对应属性，否则一个 keydown 会误触发 `@input` 处理器。
- 修饰符引擎（enter/esc/prevent/stop/once 等）整体保留，`once` 以节点标记实现；submission 防重锁（`pendingSubmissions`，按 `route:handler` 键）语义不变。
- 组件内部 shadow 的事件按组件协议（组件自身 shadowRoot 委托 + `bubbles:true` 再派发）冒出边界后经 retarget 命中 host 上的属性（内置组件 CustomEvent 全量 `bubbles:true`，已审计）。不冒泡事件（focus/blur）不在委托覆盖范围，需要时用 `focusin/focusout`。
- 表格行模板（`template.content`）内的事件不委托（不在 DOM 中），仍由表格组件按克隆绑定。
- 回归闸门：`test/event_delegation_gate.mjs`（需 identity_token）。

## 渲染提交与 include 复用

- 一次导航 = **一次提交**（数据先行，见上节）：整段 HTML 字符串构建后**一次性**写入（`innerHTML` 赋值 = parse + 原子替换，不是逐节点插入），且提交时已含动态数据。首次挂载窗口内若发生数据重渲（见「首屏挂载窗口」），那一趟在同一个 `visibility:hidden` 的 host 上完成，用户侧仍只看到一次呈现。
- 🔴 **include 控制器若有首屏必需的异步数据，必须在 `setup(async …)` 里 `await` 后再返回模型**（2026-11-24 页脚强刷缺 `copyright`/`icp` 根因）：`expandIncludes` 在 `await factory()` 后就把模板里的 `{{字段}}` **求值成静态字符串**并写入 `lastExpandedSource`；之后 include 状态再变，刷新只是重渲染这份已定值的 HTML，字段不会自动回填。页头因有 `KNIU_CLI_SITE_LOGO` 本地缓存兜底未暴露，页脚没有缓存就只剩静态年份。修法：`TheFooterController` 改为 `setup(async …)` 并 `await loadSeo()`（接口有 `createTtlSingleFlight` 缓存与超时降级，不会重复请求）。
- 同 layout 的连续导航会复用布局：`data-kniu-view-host`（aside/header 等 include host）与新渲染产物对比 `stableIncludeHtml`（抹掉 style 内容、所有属性值与文本，只比标签结构/属性名）。结构相同则 `syncIncludeContent` 按「同标签第 N 个」把新属性与文本原地写回旧 shadowRoot（容错组件把 light DOM 搬进自身 shadow 的情况），再补一次 `binder.bind(model, shadowRoot, true)`（updateOnly：刷新 `:option` 引用与菜单高亮，不重复绑事件），**跳过 `replaceWith` 重建**。此前每趟渲染都全量重建 aside/header，一次导航卸载重挂 4 次（菜单、头像、图标闪烁），观感即「每个页面都在加载多次」（2026-11-18 用户反馈抖动，已按本节落实）。同步失败（树形对不上）则退回重建分支，保证正确性。
- include 控制器跨导航复用，自身 `hashchange` 监听与路由渲染同帧、先后不保证（dist 实测出现过 active 停在上一页）。`expandIncludes` 因此在取到缓存模型后、渲染模板前显式 `await model.__kniuSyncRoute({ path: routePath() })`（用 `binder.setSuppressRender(true)` 抑制中间刷新）；头部/侧栏控制器实现该钩子同步 `currentPath` / `activeNavigationPath`，保证渲染产物与原地同步写回的值都是当前路由。
- 内容区 `existingTarget.innerHTML` 的两次提交（首提交 + `settleFirstScreen` 数据回灌）各自包在 `mountHidden.run(existingTarget, ...)` 中：侧栏/顶栏不参与重建，内容区在挂载窗口隐藏，避免中间帧抖动；loading 遮罩在同一次提交内 `reappendRouteLoading` 归位。
- 注意：include 模板里 `(path)` 引用形态（如 `active:(activeNavigationPath)`）输出到 HTML 的只有引用名**不含值**——运行时状态靠 bind 解析模型。所以跳过重建必须补 bind，否则菜单高亮会卡在旧路由（历史上高亮一直靠「重建 + bind」更新，include 控制器的 `onMounted` 从不被路由调用，不能依赖它做兜底）。
- 内容无变化 ⇒ 结构类 `:if` 输出也未变，跳过渲染安全；include 控制器实例本就跨导航复用（`controllerInstances` 缓存），事件绑定引用的方法不变。
- **布尔选项的往返还原（updateOnly 重喂陷阱）**：编译层把 `:option` 对象字面量布尔 true 输出为 `unstyled="true"` 式属性，但组件 options 反射层（`installOptionsOnlyProtocol` → `reflectOptions`）落地时规范化为**空属性** `unstyled=""`（组件 CSS 有 `:host([fixed=""])` 依赖空值形态，不可改反射层）。bind(updateOnly) 重喂按 `getAttribute` 解析属性值，空串 ≠ `'true'` 会被误判为 falsy → `reflectOptions` 移除属性 → 组件回落默认皮肤（症状：侧栏「帮助/退出登录」`unstyled:true` 按钮导航后变白药丸，且因 `__kniuOptionsValue` 已被覆写而持续）。bind 重喂因此做了往返还原：**属性缺失→取 `__kniuOptionsValue` 前值；属性为空串且前值 === true→还原 true**；真正的空串选项（前值 `''`）不受影响。

## 文本绑定与原样绑定（kniu-t 标记）

- `{{expr}}` 编译为 `<!--kniu-t:expr-->文本<!--/kniu-t-->`，`{{@expr}}`（原样 HTML）为 `<!--kniu-t:expr|raw-->HTML片段<!--/kniu-t-->`。`collectTextBindings` 扫描注释标记建立 `textBindings`（`expr|0` 转义 / `expr|1` 原样），`patchTextBindings` 做局部更新（`updateBindings`、suppressRender 期间的订阅冲刷都走这里）。
- 🔴 **原样绑定必须整节点收集 + template 解析整体替换，禁止 `textContent=`**：`{{@expr}}` 的值经 innerHTML 解析后是**一串真实元素节点**（`<br>`/`<strong>`…），不是单个文本节点；若只收「下一个是文本节点」、patch 时 `textContent = 整段HTML字符串`，会把 HTML 当字面量写进首个文本节点，而已解析的元素仍在 → **内容重复 + 转义**（about 页点关注按钮后「关于我」出现两份、`<br>` 变可见文字）。修复后：raw 区域收集起止注释之间**全部**节点，patch 用 `<template>.innerHTML` 解析为 fragment 插入并移除旧节点；并在绑定位置留一个**空文本锚点**，保证空值与后续 patch 始终有插入位置。
- 转义绑定（`{{expr}}`）不受影响：值恒为纯文本，`textContent` 赋值 + `escapeHtml` 语义正确。

## 组件预热（preloadComponents）

- 时机：路由 `start()` 首次渲染完成后，`requestIdleCallback`（超时 2s，无此 API 时退 `setTimeout` 300ms）调度一次，一次性执行。
- 生产（有 `kniu-component-manifest` meta）：把 manifest 里**全部** bundle 脚本拉齐（`loadScript` 缓存到 `componentBundles`）。之后每次导航的 `loadComponents` 网络层全部命中缓存同步完成——bundle 只预取不预注册，注册保持按需（同步且廉价）。
- dev（无 manifest）：预 `import('./Kniu-Components.mjs')` 并调用其 `preload()` **全量注册内置组件**（dev 下所有组件模块顶层静态 import，register 只是同步 define）。之后导航的 `load()` 里 register 全部命中 `registered` 集合直接返回。
- 预热失败仅 `console.warn`，按需加载链路不受影响。
- 效果：路由表已知全部视图所需组件，预热后任何页面的组件装配零网络、零 define 开销，「逐个 shadow DOM 渲染」之间的组件加载间隔消失，页面一次成形。

## 首屏挂载窗口与 refresh 抢跑（规则 170）

- 🔴🔴 **首屏 settle 期间禁止 `scheduleRefreshRender` 抢跑**：`scheduleRefreshRender` 的 150ms timer 回调在执行 `renderWithBoundary({refresh:true})` 前，必须检查 `mountStates` 是否有 `mounting=true` 的 controller；有则**丢弃本次排队刷新**（settle 结束时自身会 rerender 带最新数据）。
- 2026-11-20 回归链：header/footer 由 `setup(async)` 改为同步 setup + 异步 `loadSiteInfo`，siteInfo 返回后 state.logo/copyright 变化 → 订阅回调 → `scheduleRefreshRender` → 150ms 后 `renderWithBoundary({refresh:true})` 递增 `pendingNavigation`（实测日志 `SETTLE ABORT navMismatch 1!=2`）。首屏 settle 因此 abort，数据到达时的订阅回调全部命中 `mounting=true` 分支只记 changed 不刷新；abort 分支又清掉 mountStates，最终视图停留在空数据 DOM（首页强刷偶发空白，实测 30%~50% 复现，无 JS 报错）。
- 判据：dev 批量强刷探针修复前 3~5/10 失败，修复后 0/12；禁用 refresh render 对照 0/10（证明根因）。闸门 `test/check_firstscreen_refresh_race_gate.mjs` 5/5（S01 守卫存在 / S02 命中即 return / S03 不整体禁用刷新 / X01 X02 反向退化必 FAIL）。
