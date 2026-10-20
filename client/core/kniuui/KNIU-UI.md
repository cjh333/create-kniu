# kniuui 技术说明

`kniuui.mjs` 是 KniuSystem 的系统 UI 模块，负责注册通用 Web Components，并提供消息框、确认框等全局 UI API。

## 约定

- 系统 UI 自定义元素使用 `kniu-` 前缀。
- 组件内部 DOM 类名使用 `kniu_sys_` 前缀；页面与设计系统仍用 `kniu_*` 工具类族（`kniu_container`、`kniu_web_*`、`kniu_md_*` 等）。组件源码内的类名由 `node test/audit_component_classes.mjs` 守护，退出码非 0 即存在不合规类名。
- 所有 `kniu-*` 组件的功能配置统一通过 `kniu:option` 对象接收；同时支持简写 `:option`，两者完全等价。旧的组件配置 attribute 不再读取或兼容。
- 组件使用 Shadow DOM 隔离内部结构与样式。
- 所有 `kniu-*` 组件和项目页面统一只使用 `public/static/font/` 内现有字体文件：默认字体 `KniuSans`，辅助字体 `KniuHei`，均按 LightExtra(200)、Light(300)、Regular(400)、Medium(500)、BoldSemi(600)、Bold(700)、Heavy(900) 以独立 family（`KniuSans_Regular` 等）注册 `@font-face`；正文和代码区域均使用 `KniuSans`，斜体使用浏览器合成样式；禁止引入 Noto/思源、微软雅黑、宋体、黑体、Arial、Georgia、Consolas、Robot 或其他系统字体作为默认字体，图标使用内置 SVG，不使用图标字体。`@font-face` 生效点在 document 级（`public/static/css/web(.min).css` 与 `public/static/plugin/kniu/kniu(.min).css`）；`client/core/kniuui/kniu-other/kniu-font-face.css` 为 shadow 侧同构冗余注册（shadow 内 `@font-face` 不生效，依赖 document 级注册命中）。
- `kniu-editor` 的字体菜单只提供项目 `KniuSans`（默认）和 `KniuHei` 两项，选项 value 使用真实注册 family 名（如 `KniuSans_Regular`）；清除字体时恢复继承，不再提供旧字体或通用字体族选项。
- 视口级下拉浮层关闭时必须恢复原始节点位置，并清除 `data-open`、`position`、`left`、`top`、`right`、`bottom`、`transform`、`visibility` 等临时定位状态；重复开闭不得复用上一次的显示或坐标状态。移动端用户菜单每次打开先清空旧坐标，在下一帧重新测量触发按钮，并在导航展开动画期间持续跟随锚点。

## 统一 options 协议（强制）

组件标签只保留模板引擎接口：`ref`、`kniu:form`、条件/循环/样式指令、插槽以及 `kniu@...`。其他配置全部放入 `kniu:option` 或其简写 `:option`；对象字面量直接写在 `{{...}}` 中；组件自身产生的回调优先使用 `onXxx`，如 `onChange`、`onCurrentChange`、`onSizeChange`。

```html
<kniu-table ref="table" kniu:option="{{userTable}}"></kniu-table>
<kniu-input kniu:form="{{form.name}}" kniu:option="{{nameInput}}"></kniu-input>
<kniu-page kniu:option="{{userPage}}"></kniu-page>
<kniu-page-more :option="{{text:'查看更多',noMore:'没有更多了',block:true,count:10,loading:(loadingMore),disabled:(noMore)}}" @click="loadMore" />
```

`:option="{{...}}"` 与 `kniu:option="{{...}}"` 进入同一个 options 协议；同一组件不要同时声明两者，避免配置覆盖歧义。

`kniu-page-more` 的 `count` 表示每次请求最多追加的列表数量：列表总数小于等于 `count` 时组件隐藏；总数大于 `count` 时显示。加载请求返回空数据或已到最后一页后，组件保持显示并展示 `noMore` 文案，同时禁用按钮；`loading` 控制加载状态，点击事件使用标准 `@click` 或 options 回调。

两个及以上按钮统一使用 `<kniu-btn-group>` 包裹，组件内置 `display:inline-flex; align-items:center; gap:10px`，页面不得再用零散 margin 拼按钮间距。

表格的数据、loading 和表格级回调放在 `tableOptions` 中；列只允许使用 `<kniu-table-col>` HTML 子标签，列属性和列模板直接写在标签上。options 数据变化时必须整体替换对象引用。以后新增组件也必须先实现本协议。

### 全局默认项与主题

应用入口用 `UI.use()` 配置组件默认项和主题变量。默认项仅减少重复书写，页面的 `kniu:option` 同名字段优先；核心库不包含任何项目业务默认项。

```js
UI.use({
  components: { btn: { size: 'small' }, page: { layout: 'total,prev,pager,next' } },
  theme: { '--kniu-color-primary': '#409eff', '--kniu-radius': '4px' }
});
```

主题变量从应用根继承至 Shadow DOM；`--kniu-font-family` 等被组件 `:host` 写了默认值的变量，由 `UI.use()` 在组件挂载时于基础字体样式之后追加 `:host{...}` 主题表覆盖（同特异性后者胜出），运行时重新 `UI.use()` 只影响之后新建的组件。组件样式新增颜色、边框、圆角、控件高度和字体时，应优先使用 `--kniu-color-primary`、`--kniu-border-color`、`--kniu-radius`、`--kniu-control-height`、`--kniu-font-family`，避免在业务页面重复传视觉配置。回归探针 `test/probe_ui_theme.mjs`。

### 双语配置（lang，强制约定）

所有 `kniu-*` 组件的**内置文案**统一支持中英双语，通过 `kniu:option` 里的 `lang` 字段切换：

- `lang` 取值：`'cn'`（默认）/ `'en'`（`'english'` 亦视为英文），不区分大小写。**未配置时默认中文**，向后兼容。
- **运行时动态切换**：改 `options.lang` 后（经 `options` 属性 setter，即 `installOptionsOnlyProtocol`），组件调用 `_sync()` / `_render()` 立即按新 lang 重渲染。无需重建组件。
- 文案统一读 `KNIU_I18N` 字典（`cn` / `en` 两组，扁平命名空间「组件.具体键」，参数用 `{n}` 占位），经 `componentText(lang, key, params)` 翻译：**key 缺失回退中文，再缺失返回 key 本身**。`componentLang(options)` 读取 lang（默认 `cn`）。
- **显式配置优先**：组件内部文案（如按钮默认文字、空状态、aria-label）走字典；若 `options` 里显式传入同名字段（如 `submitText`、`emptyText`、`placeholder`），则以显式值为准，不受 `lang` 影响。
- 参考实现：编辑器工具栏 `_applyToolbarLang()` 遍历 `.kniu_sys_editor_btn` 按 `data-cmd` / `data-action` / `data-block` token 设 `title` / `aria-label`，`_sync()` 在 lang 变化时重建工具栏（`__kniuLastLang` 缓存比较）。

```html
<kniu-empty kniu:option="{{ lang:'en' }}" />
<kniu-comment kniu:option="{{commentOptions}}" />
```
```js
state.commentOptions = Object.assign({}, state.commentOptions, { lang: 'en' }); // 运行中切英文
```

> 备注：业务方传入的显式文案（控制器里硬编码的中文）优先于内置字典，属预期行为；要让整页跟随 `lang`，需在业务层同时按 `lang` 提供或省略文案字段。

### 渲染与样式约定（性能铁律）

- **所有组件必须 Shadow DOM 隔离**，统一经 `attachComponentShadow(host)` 初始化：`<template>` 按 HTML 文本缓存，实例只克隆 DocumentFragment 并一次性挂载。
- **强制渲染隔离（已实现）**：`attachComponentShadow` 给 `:host` 统一注入 `contain: layout`（经共享样式表，每次 `innerHTML=` 重设时保留），彻底切断局部变动对全局布局依赖检查。未用 `contain: strict`（含 size containment，内容定宽元素会塌缩）亦未用 `contain: paint`（会裁切溢出宿主的下拉/浮层）。**排除项**：`kniu-table`(tooltip 用视口 fixed 定位)、`kniu-navbar`(移动菜单用视口 fixed 定位) 自身阴影含视口固定后代，加 contain 会让其 fixed 后代改相对宿主定位而错位，故在 `KNIU_CONTAIN_EXCLUDE_TAGS` 中跳过。
- **正确初始化时机**：样式节点必须和 DOM **同步**挂载（模板缓存克隆 + Fragment 一次性挂载），**绝不**在 `attachShadow` 执行完成后再动态插入 `<style>`，否则 `contain` 等属性无法生效。
- **禁止频繁全量重写 innerHTML**：不要反复 `shadowRoot.innerHTML = '...'`（每次销毁旧树、重建节点、重绑事件并触发强制同步布局）。批量渲染先建 Fragment 再一次 `replaceChildren`；复用池 + 事件委托。
- **缓存 Shadow Root 实例**：高频更新组件提前缓存 `shadowRoot` 引用，避免重复创建/销毁影子树带来的额外开销。
- **组件样式走共享样式表** `adoptSharedStyle(root, cssText)`：按 cssText 缓存 `CSSStyleSheet`，ShadowRoot 用 `adoptedStyleSheets` 挂载。**不要在 shadowRoot 里 append 逐实例 `<style>`**（同样的 CSS 会被每个实例重复解析）。目标不是 ShadowRoot 时自动退回 `<style>` 元素。调试时设 `globalThis.__KNIU_NO_SHARED_SHEETS = true` 可退回逐实例模式做 A/B。
- **组件 CSS 放独立文件**（`client/core/kniuui/*.css`，见 SKILL #126）：以「CSS 文本模块」导入——`import X from './kniu-editor.css?module'`，再 `adoptSharedStyle(shadowRoot, X)`。`?module` 是通道标记：dev 由 `kniuserver.mjs` 把它当 JS 模块返回（`export default "…"`），dist 由 `kniubuilder.mjs` 的 `.css` 分支内联为字符串，两侧语义一致。**尺寸下限属性必须显式保底**：可触及铁律下限的属性（控件高度/宽度，见 #59/#81/#83/#62）在文件里预写 `max(下限px, calc(N / var(--kniu_vw)))`——`normalizeComponentCss()` 对非 font 属性的裸 px 只做 `calc(N/vw)` 换算、**不加保底**（仅 font/font-size 加 `max(12px, …)`），窄视口会跌破下限；已含 `var(--kniu_vw)` 的值原样返回，不会双重换算。其余 px 可照原样写，由 normalize 统一换算。**注入顺序就是层叠顺序**：需要压过共享样式（例如 `adoptDropdownStyle()` 注入的 `.kniu_sys_dropdown_panel`）的覆盖必须单独一份文件、留在原调用位置，不能并进主样式表——同特异性下后注入者取胜。
- **避免强制同步布局**：禁止在 Shadow 内同步读写 `offsetHeight` / `getBoundingClientRect` / `scrollWidth` / `clientWidth` / `offsetWidth`。需要布局指标时用 `getLayoutMetrics()` 缓存，并在 resize / ResizeObserver / 内容变化 / `doLayout` 时失效；周期性刷新（如阴影显隐）用 `scheduleShadowVisibilityUpdate()` 合并到 rAF。
- **批量渲染先建 Fragment**：表格行、分页页码、下拉项、单选项等一律先构建 `DocumentFragment`，再一次 `replaceChildren`，禁止在循环里逐个 `appendChild`。
- **行/项节点复用时必须改事件委托**：复用会让监听器闭包持有陈旧数据。监听器挂容器（表格整表挂 tbody 两个），行索引写 `dataset.rowIndex`，事件处理时据此从数据数组取回当前对象。复用池还需校验结构签名（如表格的 `rowPoolColumnSignature`），列结构变化即整池作废。
- **事件机制优化（已实现）**：跨 Shadow 边界通信优先用属性绑定；高频事件工具 `debounce` 已落到 `client/core/kniuutil.mjs`（纯函数、零依赖，浏览器/Node 通用）。三个搜索页（article/daily/users）输入框绑定 `kniu@input="debouncedSearch"`（250ms 防抖，Enter/点击仍走即时 `searchList`）。固定导航的 `.kniu_sys_head_placeholder` 由 `kniu-navbar` 按导航实际高度同步维护。
- **内存泄漏兜底**：页面/组件卸载时统一销毁 Shadow 根上的所有事件监听器（含 rAF 句柄、ResizeObserver、复用池、列宽缓存、布局指标缓存），避免残留引用导致内存泄漏。
- **框架级 diff**：组件库自带 diff 更新能力，自动实现局部更新，避免全量重渲染。

- 模块使用默认导出，业务 Controller 统一命名为 `UI`：`import UI from '../../core/kniuui/kniuui.mjs'`。

## 挂载自定义组件（扩展）

当内置 `kniu-*` 组件都不满足需求时，开发者可自行编写组件并挂载进项目，成为与内置组件平起平坐的一等公民。

自定义组件**必须挂载才能使用**：组件文件本身是惰性的，只有被应用入口 `import` 一次（副作用调用挂载 API）才会注册生效；未挂载的 tag 在模板里不会渲染。

### 推荐写法：`UI.useComponent(spec)`（声明式封装，MVVM 形态）

公共写法已提炼成一个声明式 spec，对齐项目 `controller(setup)` 与生命周期钩子体系（`onBeforeMount`/`onMounted`/`onUnmounted`，项目无 `onRender`）。**无渲染函数**：state 经模板引擎响应式绑定到模板，改 state 即自动更新视图：

```js
import UI from '../../core/kniuui/kniuui.mjs';
import APP_RATING_TEMPLATE from './app-rating.html?module';   // 布局外置 <名>.html（支持 kniu: 指令与 {{ }} 绑定）
import APP_RATING_CSS from './app-rating.css?module';         // 样式外置 <名>.css（shadow 内 @import 相对路径以文档为基准，dist 会破，故用 ?module）

UI.useComponent({
  tag: 'app-rating',                                  // 必填：小写含连字符，kniu- 前缀保留给内置
  style: APP_RATING_CSS,                              // 可选：shadow 样式字符串（自动包 <style>）
  template: APP_RATING_TEMPLATE,                      // 可选：shadow 模板 HTML
  setup: function (ctx) {                             // 必填：对齐 controller(setup)，返回 { state, ...actions }
    const state = ctx.reactive({ value: 0, readonly: false });
    ctx.onMounted(function (host) {                   // 生命周期钩子：onBeforeMount / onMounted / onUnmounted
      host.shadowRoot.addEventListener('click', function (e) {
        const btn = e.target.closest('button[data-v]');
        if (!btn || state.readonly) return;
        state.value = Number(btn.dataset.v);          // 改 state → 视图自动更新（响应式绑定）
        host.emit('change', { value: state.value });  // 派发跨 Shadow 事件（composed 冒泡）
      });
    });
    return { state };
  }
});
```

- 生命周期（对齐 kniumvvm）：`onBeforeMount(host)`（挂载前、绑定前）→ `TEMPLATE.bind` 响应式绑定 → `onMounted(host)`；元素移除时 `onUnmounted(host)`，随后自动 `dispose` 绑定订阅。
- 组件内改 `state.*` 即自动更新 DOM；宿主经 `kniu:option` 赋值 → options setter **浅合并**进响应式 `state`（同名键覆盖）。例如 `<app-rating kniu:option="{{ {value:4, readonly:true} }}">` 会把初始分值设为 4、置为只读；不传时取 `setup` 里的默认值 `reactive({ value: 0, readonly: false })`。
- `ctx` 能力：`reactive`/`nextTick`（模板引擎）、`emit(name, detail)`（= `host.emit`）、`host`；需要完整响应式体系（`computed`/`watch` 等）时直接用 `kniumvvm` 的 `controller()`。
- 跨 Shadow 事件：组件内 `host.emit('change', { value })` 派发 `composed:true` 的 `CustomEvent`，页面用 `kniu@change="onRatingChange"` 或 `addEventListener('change', ...)` 接收。
- 完整参考示例见 `client/custom/app-rating/` 三件套（`.mjs` 纯逻辑 / `.html` 纯布局 / `.css` 纯样式）——**它是参考模板，项目默认未挂载**（见下方「挂载步骤」）。

### 在页面模板中使用

自定义组件一旦挂载，用法与内置 `kniu-*` 完全一致：

```html
<!-- 1) 直接写死属性（取 setup 默认值 value=0） -->
<app-rating></app-rating>

<!-- 2) 由父组件 state 传入初始值（kniu:option 浅合并进组件 state） -->
<app-rating kniu:option="{{ value: 4, readonly: false }}"></app-rating>

<!-- 3) 接收跨 Shadow 事件 -->
<app-rating kniu:option="{{ rating }}" kniu@change="onRatingChange"></app-rating>
```

```js
// 对应 Controller（或组件 setup）内：
const state = reactive({ rating: { value: 0, readonly: false } });

function onRatingChange(e) {
  // e.detail = { value: 3 }，由组件 host.emit('change', { value }) 派发
  state.rating = { value: e.detail.value, readonly: state.rating.readonly };
}
```

- **内置系统组件同遵守三件套分离**：`kniu-<名>/` 目录下 `.css` 纯样式、静态模板骨架外置 `.html`（mjs 里 `import ... from './kniu-<名>.html?module'`，渲染时拼 `'<style>' + CSS + '</style>' + TEMPLATE`）、`.mjs` 纯逻辑；模板含 `${...}` 动态插值或程序化 DOM 的（如 editor/comment/table/tab/like/user-login）保持内嵌。json 仅在确有需要时加。

### 挂载步骤（激活组件）

组件文件放在 **`client/custom/<名>/`** 下（核心库 `client/core/` 只放框架代码，自定义组件不进核心库；**仅被显式 `import` 才进入 bundle，不参与自动打包**，未挂载的 tag 在模板里不会渲染）。

在应用入口 `client/client.mjs` 的 `UI.use({...})` 附近**导入一次**（副作用导入，模块顶层已调用 `UI.useComponent`）即完成全局注册：

```js
// client/client.mjs 顶部，其它 import 附近
import '../../custom/app-rating/app-rating.mjs';   // 副作用导入：注册 <app-rating> 自定义元素
```

> 说明：`client/custom/app-rating/` 是项目内置的**参考模板**，默认并未在 `client/client.mjs` 中挂载。若要在页面里实际使用 `<app-rating>`，需按上面一行 `import` 激活；激活后它才会被打包并可在任意模板中使用。新增你自己的组件时，照搬此「三件套 + 一处 import」流程即可。

### 高级写法：`UI.defineComponent(tag, registerFn)`

需要完整控制类定义时（复用 confirm/msg/REQUEST 等共享能力），仍可用低级 API：`registerFn(context)` 接收与内置组件相同的共享 context，自行 `class extends HTMLElement` + `attachComponentShadow` + `customElements.define`。

### 约束与能力

- **tag 命名**：必须小写且含连字符（如 `app-rating`、`x-foo`）；`kniu-` 前缀为内置组件保留，`defineComponent`/`useComponent` 会直接拒绝，避免覆盖/混淆系统组件。重复 tag 自动跳过（幂等），不会抛错。
- **共享 context**（仅低级 API）：`context` 与内置组件完全相同，包含 `attachComponentShadow`、`adoptSharedStyle`、`appendRawStyle`、`flushPendingAdoptedSheets`、`KNIU_I18N`、`TEMPLATE`、`REQUEST`、`IDENTITY`、`confirm`、`msg`、`componentDefaults`、`installOptionsOnlyProtocol`、各组件 CSS 常量等——可直接复用框架 Shadow DOM、共享样式表、主题变量、全局弹窗与请求层。
- **选项协议（可选，仅低级 API）**：若希望接入与 `kniu-*` 完全一致的 `options` 协议（`componentDefaults` 合并、`onXxx` 回调绑定、`_sync()`/`_render()` 驱动、属性反射、非允许属性自清），在 `customElements.define` 之后调用 `context.installOptionsOnlyProtocol(['app-rating'])`；其会读取你类上的 `options` 描述符并链式合并。`useComponent` 封装已内置简版 options 协议（赋值合并进响应式 state）。
- **样式/字体**：一律经框架 Shadow 初始化，尺寸用 `max(下限px, calc(N/var(--kniu_vw)))`，颜色优先 `--kniu-*` 主题变量（见渲染与样式约定）；字体使用内置 `KniuSans`（默认）与 `KniuHei`。
- **事件**：跨 Shadow 边界通信用 `composed: true` 的 `CustomEvent`（组件内 `host.emit(name, detail)` 派发），页面通过 `kniu@change` 或 `addEventListener('change', ...)` 接收。

回归探针见 `test/probe_define_component.mjs`（dev 6987）。

## 消息提示

Controller 中从 setup 上下文解构 `$msg`、`$confirm` 后直接调用：

```js
const exampleController = controller(({ $msg }) => {
  $msg('这是一条消息提示');

  $msg({
    content: '保存成功',
    type: 'success'
  });
});
```

## Loading

`<kniu-loading kniu:option="{{loadingOptions}}" />` 默认使用固定到视口最高层的全屏遮罩；全局加载期间同时锁定 `html` 和 `body` 滚动，使长页面的滚动条不会露在遮罩外。配置 `contained: true` 时，遮罩只覆盖定位容器：

```html
<section style="position:relative;">
  <article></article>
  <kniu-loading kniu:option="{{ contained:true, show:loading }}" />
</section>
```

后台公共布局使用 `contained` 模式，加载时只遮罩右侧工作区，不覆盖左侧导航。

消息类型为 `success`、`warning`、`info`、`error`，默认 `info`。`$msg()` 会动态创建 `<kniu-msg>` 并在关闭后销毁，页面中不需要预先声明消息组件。

## 图片上传预览

```html
<kniu-upload kniu:form="{{files}}" kniu:option="{{uploadOptions}}">选择图片</kniu-upload>
```

`kniu-upload` 的 `kniu:option` 支持 `note` 字段，用于替换无文件时 `.kniu_upload_empty` 内的文字描述；未配置时使用内置文案。

```html
<kniu-upload kniu:form="{{files}}" kniu:option="{{ note:'请选择图片' }}" />
```

- 组件只负责本地选择、Blob 预览、删除和回显，不会立即上传。
- `max-size` 是单个文件大小，单位 M；默认单图，再次选择会覆盖当前图片。
- 设置 `multiple` 后才启用多图；`max-count` 表示最多数量，照片墙会自动换行。
- 模型数组可包含新 `File` 或数据库图片 URL；真正上传由表单提交统一完成。
- 图片全部删除后显示“暂无图片”占位，但空占位不会进入文件数组。
- 上传预览图片默认使用 `object-fit: contain`，完整显示图片且不裁切。

## 模态框

```html
<kniu-modal kniu:option="{{modalOptions}}" kniu@close="closeDialog">
  <template #$header><span>编辑文章</span></template>
  <template #default>弹框内容（推荐使用 kniu-input-group + kniu-input 等）</template>
  <template #footer>
    <kniu-btn kniu@click="closeDialog">取 消</kniu-btn>
    <kniu-btn kniu:option="{{primaryButton}}" kniu@click="saveEdit">保 存</kniu-btn>
  </template>
</kniu-modal>
```

> 具名插槽支持两种等价写法：`<template #header>`（推荐，模板简写语法，框架内部等同 `slot="header"`）与 `<template slot="header">`。框架会在加载视图时把这类 `<template>` 平铺为带 `slot` 属性的真实子节点，再交给 `<slot name="X">` 投影——因为 `<template>` 是 inert 元素，Web Components 的 slot 算法不会展开它，不平铺则弹框内容空白。
>
> **注意（投影语义）**：`<slot name="default">` 只匹配带 `slot="default"` 属性的 light DOM 节点；**直接写在 `<kniu-modal>` 内但不带 slot 属性的子节点不会被投影（显示空白）**。视图里一律通过 `<template #default>` 写内容，框架平铺后自动带 `slot="default"`；手动 `createElement('kniu-modal')` 拼内容时需给节点补 `slot="default"` 属性。

| 属性 | 说明 | 默认值 |
| --- | --- | --- |
| `show` | 是否显示（`true`=显示/打开，`false`=隐藏/关闭；默认隐藏） | `false` |
| `mask` | 是否启用半透明蒙版 | `true` |
| `mask-alpha` | 蒙版透明度（0~1，仅 `mask="true"` 时生效） | `0.6` |
| `mask-close` | 点击蒙版是否关闭弹框（默认**不允许**；`true` 才开启）；旧别名 `close-on-click-modal` / `modal` 仍兼容 | `false`（默认禁用） |
| `scrollbar` | 模态框开启时是否允许浏览器滚动条（`false` 时锁定 body 滚动） | `true` |
| `width` | 弹框宽度（`640px` 这种带单位的值） | `auto`（按内容自适应，最小 `320px`） |
| `title` | 标题（仅确认模式） | `提示` |
| `message` | 文本（仅确认模式） | — |
| `confirm-text` / `cancel-text` | 按钮文字（仅确认模式） | `确定` / `取消` |
| `type` | 图标类型（`success` / `warning` / `info` / `error`，仅确认模式） | `warning` |
| `show-close` | `false` 时隐藏右上角关闭按钮 | — |

事件：`close`（任意方式关闭）、`confirm`（仅确认模式，点击确定）、`cancel`（仅确认模式，点击取消/关闭/遮罩/Esc）。

方法：`open()` / `close()`。

**注意**：宽度请使用 `width="640px"` 属性写法，**不要用内联 `style="width:640px;"`**——内联 width 会作用在 host 元素上、把全屏遮罩挤成小方框（旧版本曾因此出现"模态框跑到左下角、内容显示不全"的问题）。如一定要写内联样式，组件会自动把 `width` 迁移到 `--kniu-modal-width` 并清空内联 width，但**推荐用 `width` 属性**语义更清晰。

## 确认框

```js
const exampleController = controller(({ $confirm }) => {
  $confirm('此操作将永久删除该文件, 是否继续?', '提示', {
  confirmButtonText: '确定',
  cancelButtonText: '取消',
  type: 'warning',
  closeOnClickModal: false   // 禁止点击蒙版关闭（默认 true 允许）
}).then(function () {
  // 用户确认
}).catch(function () {
  // 用户取消、关闭或按 Esc
});
});
```

确认后 Promise 进入 `then`，取消后进入 `catch`。

## Button

```html
<kniu-btn kniu:option="{{ type:'primary', size:'small', round:true }}">保存</kniu-btn>
```

| 属性 | 可选值或说明 | 默认值 |
| --- | --- | --- |
| `size` | `large / default / small`（兼容 `medium / mini`） | `default` |
| `type` | `primary / success / warning / danger / info` | — |
| `plain` | 朴素按钮 | `false` |
| `text` | 文字按钮 | `false` |
| `bg` | 为文字按钮增加背景 | `false` |
| `link` | 链接按钮 | `false` |
| `round` | 圆角按钮 | `false` |
| `circle` | 圆形按钮 | `false` |
| `loading` | 加载状态 | `false` |
| `loading-icon` | 自定义加载图标类名 | — |
| `disabled` | 禁用状态 | `false` |
| `icon` | 图标类名 | — |
| `autofocus` | 自动聚焦 | `false` |
| `native-type` | `button / submit / reset` | `button` |
| `auto-insert-space` | 两个中文字符之间自动插入空格 | `false` |
| `color` | 自定义按钮颜色 | — |
| `dark` | 自定义颜色使用暗色模式 | `false` |
| `tag` | 自定义根元素标签 | `button` |
| `block` | 按钮宽度占满父容器（`width: 100%`） | `false` |

## Input

```html
<kniu-input
  kniu:form="{{form.username}}"
  kniu:option="{{placeholder:'请输入用户名',clearable:true}}"
></kniu-input>
```

- `type` 默认值为 `text`。
- `clearable` 在存在内容时显示清除按钮，清除后触发 `input`、`change`、`clear`。
- `<template #prepend>` 用于在输入框前增加附加内容，`<template #append>` 用于在输入框后增加附加内容；两者都可通过 `label-width="200px"` 设置附加区域的固定宽度。组件内部附加区域会直接使用该宽度。
- `show-password` 仅在 `type="password"` 时生效。
- 清除和密码显示控件使用 `span[role="button"][tabindex="-1"]`，按 Tab 时会跳过，仅响应鼠标或触摸点击。
- 密码隐藏时显示闭眼图标，密码显示时显示睁眼图标。
- 支持 `name`、`placeholder`、`autocomplete`、`autocapitalize`、`maxlength`、`disabled`、`readonly`、`required`；昵称等需要保留用户输入大小写的字段可在 `kniu:option` 中配置 `autocapitalize: 'none'`。
- 提供 `focus()` 和 `select()` 方法。
- Input 中按 Enter 会触发所属表单提交。
- `readonly` 状态点击或聚焦时保持默认边框色，不显示可编辑状态的蓝色高亮。
- `prepend`、`append` 内的 `kniu-btn` 自动铺满整个附加区域，完整区域均可点击；当默认插槽改为 `append` 时，按钮自动使用 `border: none; border-radius: 0`，与输入框连接为无缝附加按钮。

## Select

```html
<kniu-select kniu:form="{{form.region}}" kniu:option="{{selectOptions}}">
  <kniu-option kniu:option="{{ label:'Zone one', value:'shanghai' }}" />
  <kniu-option kniu:option="{{ label:'Zone two', value:'beijing' }}" />
</kniu-select>
```

- `kniu-select` 支持 `placeholder`、`name`、`disabled`、`required`、`size` 和 `style`。

### kniu-radio-group

```html
<kniu-radio-group kniu:form="{{form.role}}">
  <kniu-radio kniu:option="{{ value:'1', size:'large' }}">管理员</kniu-radio>
  <kniu-radio kniu:option="{{ value:'2', size:'large' }}">普通用户</kniu-radio>
</kniu-radio-group>
```

- `kniu-radio-group` 支持 `kniu:form`、`name`、`disabled`、`size` 以及 `input`、`change` 事件。
- `kniu-radio` 支持 `value`、`label`、`disabled`、`size`，未设置 `label` 时使用标签内文本。
- 单选项选中时显示主题色实心圆和中心白点，并保留键盘焦点轮廓及禁用状态反馈。
- 下拉内容展开时右侧箭头朝上，关闭、失焦或完成选择后恢复朝下。
- `size` 支持 `small`、默认尺寸和 `large`。
- `kniu-option` 使用 `label`、`value` 和 `disabled` 声明选项。
- 值变化时触发 `input` 和 `change` 事件，`change.detail` 为当前值。
- 分页组件的每页条数下拉使用同一个组件。

## Tag

```html
<kniu-tag kniu:option="{{ type:'success' }}">已启用</kniu-tag>
<kniu-tag kniu:option="{{ type:'danger', effect:'dark', closable:true }}">异常</kniu-tag>
```

- `type` 支持 `primary`（默认）、`success`、`warning`、`danger` 和 `info`。
- `size` 支持 `large`、默认尺寸和 `small`；`effect` 支持默认浅色、`dark` 和 `plain`。
- `round` 使用胶囊圆角，`closable` 显示关闭按钮并触发 `close` 事件，`disabled` 禁止关闭交互。
- 表格默认插槽中的 `kniu-tag` 会保留标签属性，并以当前列 `field` 对应的行数据作为标签内容；标签属性支持 `{{scope.row...}}` 行级表达式，例如按角色动态设置 `type`。

## Icon

项目图标统一使用 `<kniu-icon>`，SVG 内容来自 `D:/D07Depot/kniu-iconfont-preview.html`。组件将完整 SVG 图标表内置于核心模块，不加载 `kniu.css` 或图标字体；颜色继承 `currentColor`，尺寸继承当前 `font-size`。

```html
<kniu-icon kniu:option="{{icon:'search'}}" />
<kniu-icon kniu:option="{{icon:'loading'}}" style="font-size:20px;color:#409eff;" />
```

- 通过 `kniu:option.icon` 传入图标名；图标清单以 `D:/D07Depot/kniu-iconfont-preview.html` 的 `data-name` 为准，例如 `home`、`search`、`document`、`user`、`loading`、`close`、`edit`、`delete`、`table`、`link`。
- 当前图标集共 177 个。`client/core/kniuiconsvg.mjs` 是**生成产物**：用 `node test/gen_kniuiconsvg.mjs` 从预览页重新生成（剥 `data:image/svg+xml,` 前缀 → `decodeURIComponent` → `#000` 换成 `currentColor`），不要手工增删条目或添加别名；同步后用 `node test/icon_sync_check.mjs` 校验（要求预览页与 mjs 图标数一致、且项目内所有引用都能解析）。预览页版本升级后每枚图标都被统一包一层 `<g transform='translate(...) scale(...)'>` 并配对应的浮点 `stroke-width`（用于跨图标视觉线宽归一），这是预期产物，不要手工还原成裸 `<path>`。
- 预览页的 `data-name` 是唯一命名来源。新增图标后若要用于工具栏按钮，必须同步 `EDITOR_TOOLBAR_ITEMS` 与构造函数内置工具栏两处。
- `loading` 自动旋转，用户偏好减少动态效果时停止动画；其它图标不附带动画。
- 名称必须与预览页 `data-name` 完全一致，区分大小写；组件不提供 PascalCase、连字符名称或其它别名转换，例如只能写 `home_fill`、`triangle_down_fill`、`info_fill_circle`。
- 图标按钮应只放置 `<kniu-icon>` 并提供 `title` 或 `aria-label`；禁止在业务页面直接书写 `<svg>`、图标字体伪元素或 Unicode 图标字符。

## Badge

`<kniu-badge>` 包裹任意 light DOM 内容，在右上角显示数字或红点；被包裹节点的点击事件会正常冒泡到组件宿主。

```html
<kniu-badge kniu:option="{{value:8,max:99}}">
  <kniu-icon kniu:option="{{icon:'service'}}" />
</kniu-badge>
<kniu-badge kniu:option="{{isDot:true}}">通知</kniu-badge>
```

| 配置 | 说明 | 默认值 |
| --- | --- | --- |
| `value` | 徽章数值；超过 `max` 时显示 `${max}+` | 空 |
| `max` | 数值显示上限 | `99` |
| `isDot` | 显示无文字红点 | `false` |
| `hidden` | 隐藏徽章但保留内容 | `false` |
| `unstyled` | 仅保留结构，不注入默认视觉样式 | `false` |

## Status

```html
<kniu-status kniu:option="{{type:'success'}}">编辑</kniu-status>
<kniu-status kniu:option="{{type:'primary'}}">查看</kniu-status>
```

- 显示形式为“彩色圆点 + 文本”，`type` 只改变圆点颜色，文字保持正文色。
- `type` 支持 `primary`（默认）、`success`、`warning`、`danger` 和 `info`。
- `size` 支持 `large`、默认尺寸和 `small`，会同步调整文字与圆点尺寸。
- 表格默认插槽中的动态 `type="{{scope.row...}}"` 会按当前行计算，标签内容读取列 `field` 对应的当前行值。

## 页签 kniu-tab

```html
<!-- 一体式：页签头与内容同处布局 -->
<kniu-tab active="data">
  <kniu-tab-panel name="data" label="数据">…</kniu-tab-panel>
  <kniu-tab-panel name="struct" label="属性">…</kniu-tab-panel>
</kniu-tab>

<!-- 解耦式：页签头可布局在页面任意位置（如工具条），通过 for 引用面板容器 -->
<kniu-tab-head for="dbTabBody"></kniu-tab-head>
…
<kniu-tab-body id="dbTabBody" active="data">
  <kniu-tab-panel name="data" label="数据">…</kniu-tab-panel>
  <kniu-tab-panel name="struct" label="属性">…</kniu-tab-panel>
</kniu-tab-body>
```

- 页签头由面板的 `label`/`name` attribute 自动生成（缺 `label` 用 `name`、缺 `name` 按序号），无需单独维护 items 配置。
- 自管切换：点击页签写容器的 `active` attribute 并显隐对应面板（`hidden` attribute），页面零状态接线；缺省高亮 `active` 指向的面板，未指定取第一个面板。
- 解耦式：`kniu-tab-head` 的 `for` 指向 `kniu-tab-body` 的 id（HTML label 范式，`getRootNode()` 作用域内查找，head 先于 body 解析时 rAF 轮询补挂）；body 的面板增删、name/label/active 变化经 MutationObserver 实时反映到页签。支持一次式 options：body 用 `:option="{{id:'xxx',active:'data'}}"`（id/active 落 attribute），head 用 `:option="{{for:'xxx',active:'data',data:[{name:'data',label:'数据'},{name:'struct',label:'属性'}]}}"`——`data` 数组配置页签（与面板按顺序一一对应，面板可不再写 name/label），`active` 为初始 item 名，`change` 事件与 `onChange` 回调携带 item 名。
- 面板常驻 DOM（仅显隐切换），切走再切回不丢状态、无需重拉数据。
- 受控可选：`:option="{{tabBar}}"` 传 `{ active, onChange }` 时 `options.active` 优先于 attribute；点击仍派发 `CustomEvent('change', { detail: { name }, bubbles: true, composed: true })` 并回调 `onChange`。受控改 `active` 需整体替换 options（原地改子属性不触发订阅）。
- 胶囊式页签：浅灰底 `#f5f7fa` 圆角容器 + 白底高亮当前项（`color:#409eff`、字重 600、投影）。
- `::slotted(kniu-tab-panel)` 的 display 规则会压过 UA `[hidden]`，必须同时保留 `::slotted(kniu-tab-panel[hidden]){display:none!important}`，否则面板显隐失效。

## Form 和 InputGroup

```html
<kniu-form ref="form" kniu:option="{{loginModel}}" kniu@submit.prevent="onSubmit">
  <kniu-form-cell kniu:option="{{label:'用户名'}}">
    <kniu-input kniu:form="{{loginModel.username}}" kniu:option="{{name:'username'}}"></kniu-input>
  </kniu-form-cell>
</kniu-form>
```

**所有配置只走 `kniu:option`**。`model` / `data` / `rules` / `kniu:rules` / `formConfig` / `label-position` / `label-width` 属性与 `kniu:rules` 指令**全部作废**，表单元素上只剩 `ref`、事件和两个保留键：

```js
const loginModel = {
  // 表单级保留键（不是字段，不参与取值与验证）
  labelPosition: 'top',   // top | left | right，默认 right
  labelWidth: '80px',     // 默认 80px

  // 需要验证的字段：写成对象，有 condition 即验证
  username: { value: '', condition: /^(?=.*\S).+$/, message: '请输入用户名' },
  gvcode: {
    value: '',
    // 函数入参：{ value, field, input, options, values, ...同表单其它字段值 }
    condition: function (v) { return v.value.length <= 4 && v.password !== ''; },
    message: '请输入验证码'
  },

  // 不需要验证的字段：直接给默认值
  role: 2
};
```

- `value` 是默认值也是当前值：`kniu:form="{{loginModel.username}}"` 直接绑到字段对象上，引擎自动读写它的 `value`，无需写 `.value`。
- `condition` 为正则 / 函数 / `true`（`true` 表示非空即通过）；`message` 为错误提示，校验失败时 `$msg` 弹出并给控件加 `data-invalid`。
- **只验证当前渲染出来的字段**：`kniu:if` 未渲染的控件不参与校验（条件表单天然按场景验证）。
- 组件 API：`options`、`values`（摊平后的纯值对象，供直接提交）、`validate()`、`reset()`（回到首次传入的默认值）。
- 提交按钮用 `native-type="submit"`：`kniu-form` 在原生 `submit` 上拦截，先 `validate()`，不通过则阻止 `kniu@submit` 执行。

`labelPosition` 支持：

- `top`：标签位于输入框上方。
- `left`：标签位于左侧且文字左对齐。
- `right`：标签位于左侧且文字右对齐，默认值。

标签位置同时镜像到宿主的 `data-label-position` 属性，供外部样式挂钩（原 `label-position` 属性已废）。

`kniu-input-group` 与 `kniu-form-cell` 共用同一套实现（标签 + 内容布局）。带标签的表单单元写 `<kniu-form-cell kniu:option="{{ label:'用户名' }}">`，不带 label 的纯分组容器才用 `<kniu-input-group>`。

`kniu-form-cell` 也支持模板结构：`<template #prepend label-width="120px">权限</template>` 声明标签，`<template #append>` 放置 `kniu-radio-group` 等自定义表单内容。条件渲染延迟插入模板时组件会自动重新挂载；模板式 prepend 标签与输入组件附加标签保持一致，文字默认水平、垂直居中并使用 `#909399`。

输入控件需带 `name`（或 `kniu:form` 指向 options 字段）才会被当作字段纳入取值与验证；同名只取首个控件。字段控件范围：`kniu-input`、`kniu-textarea`、`kniu-select`、`kniu-switch`、`kniu-radio-group`、`kniu-checkbox-group`、`kniu-date-picker`、`kniu-upload`、`kniu-editor`、`kniu-slider`。

## Image

```html
<kniu-image
  style="width:100px;height:40px;"
  kniu:option="{{src:imageUrl,fit:fit,alt:'验证码'}}"
></kniu-image>
```

`fit` 支持 `fill`、`contain`、`cover`、`none`、`scale-down`，未设置或值无效时默认为 `contain`。没有 `src` 时不渲染 `.kniu_sys_image`，只显示暂无图片状态；有 `src` 时再创建图片元素。组件内置加载中和加载失败状态，并触发 `load`、`error` 事件。

表格图片列在默认插槽中声明，`field` 指定图片地址字段：

```html
<kniu-table-col field="cover" label="封面" width="180" align="center">
  <template #default>
    <kniu-image kniu:option="{{fit:'cover'}}" />
  </template>
</kniu-table-col>
```

## Switch

开关组件。**旧 attribute（`active-value` / `inactive-value` / `active-color` / `inactive-color` / `width` 等）已全部作废**，统一用 `kniu:option` 传配置：

```html
<kniu-switch
  kniu:form="{{form.enabled}}"
  kniu:option="{{switchOptions}}"
  kniu@change="onSwitchChange"
></kniu-switch>
```

```js
// 控制器
state.switchOptions = {
  activeValue: 1,          // 开对应值
  inactiveValue: 0,        // 关对应值
  activeColor: '#13ce66',
  inactiveColor: '#ff4949',
  disabled: false
};
```

| `kniu:option` 键 | 说明 | 默认值 |
| --- | --- | --- |
| `activeValue` / `inactiveValue` | 开 / 关对应值 | `true` / `false` |
| `activeColor` / `inactiveColor` | 开 / 关轨道颜色 | `#409EFF` / `#C0CCDA` |
| `width` | 轨道宽度（px） | `40` |
| `disabled` | 禁用 | `false` |
| `activeText` / `inactiveText` | 开 / 关文字（设置了对应图标 class 时自动隐藏） | — |
| `activeIconClass` / `inactiveIconClass` | 开 / 关图标 class | — |
| `name` | 原生 input 的 name | — |

- `kniu:form` 双向绑定（同 kniu-input），状态变化触发 `change`（表格列内开关的 `kniu@change` 同样有效），提供 `focus()`。
- **整体替换 options 对象即刷新**（响应式订阅注册在表达式路径，原地改子属性不触发，见 `kniutemplate.md`）。
- 表格列内开关直接放在列模板中；普通模板绑定使用当前行变量 `row`，列条件等元数据表达式可使用 `scope.row`；开关配置统一写入 `kniu:option`。

## Editor（富文本编辑器）

```html
<kniu-editor
  ref="editor"
  kniu:option="{{editor}}"
  kniu:form="{{editForm.content}}"
>
  <template #prepend label-width="100px">正文</template>
</kniu-editor>
```

- `kniu:form` 双向绑定到表单字段（同 kniu-input），`name` 供表单识别，`#prepend` 插槽渲染前置标签（`#append` 同理预留）。
- 前台文章正文必须按编辑模式分别使用根类：Markdown 使用 `.kniu_sys_markdown_body` 并调用 `UI.installMarkdownStyles(root)`；富文本使用 `.kniu_sys_richtext_body` 并调用 `UI.installRichTextStyles(root)`。两套样式不得写入 `detail.css` 或互相覆盖。危险标签源码的尖括号必须保留 HTML 实体，避免浏览器将其解析为真实元素；外层只保留一层 `<code>`。
- 内容变更派发 `input` 事件，失焦派发 `change` 事件。
- 仅富文本模式会对 `script`、`style`、`iframe` 等危险原始标签做可见文本转义：无论来自粘贴、输入、值回写或源码切换，都不会被浏览器解析为真实节点或删除其后续内容；普通 `<p>`、`<strong>` 等富文本标签仍按原行为解析。Markdown 模式不经过该富文本清洗链路。
- 仅富文本模式的“代码块”按钮始终生成块级 `<pre><code>`；“行内代码”按钮将选中的内容包裹为 `<code>`，再次点击可取消包裹。Markdown 模式只编辑原始文本，所有富文本工具栏命令均不会执行。
- 媒体上传大小通过 options 配置 `imgMaxSize`、`videoMaxSize`、`audioMaxSize`，单位为字节；分别限制图片、视频和音频文件，默认值由业务页面显式传入。
- **最大化（`maximize`）时自动隐藏 `#prepend` / `#append` 修饰框**，编辑器组改为竖向撑满视口，还原后恢复显示。
- 代码模式（`code`）：在富文本视图与源码（`textarea`）视图间切换；源码视图下除 `code` / `maximize` 外工具栏全部禁用。**进入源码视图时自动美化**（`_beautifyHtml`）：块级标签换行+缩进、仅含行内内容的块闭合标签紧跟同行（如 `<li>item1</li>`）、行内标签与文本保持同行、`<pre>` 代码块内容原样保留不破坏缩进、纯空白文本相邻块级标签时丢弃（保证美化往返稳定）。切回富文本时直接以源码内容设回 innerHTML，渲染等价。
- 美化必须同时覆盖**行内型正文**：正文实际靠 `<br>` 分行（区块标签很少）时，只按块级标签断行会让整篇挤在一行，因此每个 `<br>` 之后按当前层级断行+缩进，`<br>` 后面文本的行首缩进在下一轮被丢弃以保持幂等；`<br>` 紧跟块级闭合标签（如 `<p>文字<br></p>`）时不落断行、不改动原文。整篇**没有任何标签**时（纯文本 / Markdown / 被转义过的正文）不做空白折叠，只统一 `CRLF`，否则整篇会被压成一行。美化对同一输入必须可重复执行（`v1 === v2`）。`tb_article` 正文的真实形态就是「Markdown 纯文本 + `<br>` + `CRLF`」，回归探针见 `test/beautify_probe.mjs`。
- Markdown 模式由 `client/core/kniucode.mjs` 独立解析：块级语法遵循 CommonMark（标题、段落、引用、列表、分割线、围栏代码块），表格和删除线采用 GFM 扩展。所有 `- `、`+ `、`* ` 列表项一律输出语义化 `<ul><li>`，无论项目内容以行内代码、占位符或中文开头；段落行尾两个及以上空格或反斜杠必须按 CommonMark 输出硬换行 `<br>`。不得为单篇文章增加改变列表结构的特例。详细回归样例见 `test/detail_code_fence_probe.mjs`。
- 控制器生命周期支持 `onBeforeMount`、`onMounted`、`onUnmounted`：`onBeforeMount` 在模板绑定和 `onMounted` 前执行，适用于进入页面前的滚动复位等不依赖已渲染 DOM 的工作。
- 内置功能包括撤销/重做、代码模式、最大化、加粗/斜体/下划线/删除线、对齐、有序/无序列表、H1–H3/段落、引用、行内代码、代码块、分割线、表格、字体/字号/文字色/背景色、链接/取消链接、图片、媒体、表情、清除格式、清理 HTML 和全选；具体显示哪些按钮由 `toolbar` 数组唯一决定。
- 业务页面当前统一使用扁平数组，并按 `abouteditController.js` / `articleController.js` 的顺序配置；文档和业务代码均不得再写旧 token 或嵌套分组数组。

### toolbar 可配置属性

工具栏通过 `kniu:option` 的 `toolbar` 配置按需设置，唯一格式是扁平字符串数组；数组中的 `'|'` 表示分组分隔线。未设置时使用组件默认工具栏。

- 取值只能是字符串数组；不支持工具栏字符串、嵌套数组或其它快捷格式。
- 可用 token（大小写和名称以此为准；与功能一一对应）：

  | 分组 | token |
  |---|---|
  | 视图 | `code` `fullscreen` |
  | 历史 | `undo` `redo` |
  | 字体样式 | `bold` `italic` `underline` `strikeThrough` |
  | 对齐 | `justifyLeft` `justifyCenter` `justifyRight` `justifyFull` |
  | 列表 | `insertOrderedList` `insertUnorderedList` |
  | 块级 | `h1` `h2` `h3` `h4` `h5` `h6` `p` `blockquote` `pre` `inlineCode` `hr` `table` |
  | 字体/颜色 | `fontName` `fontSize` `foreColor` `hiliteColor` |
  | 插入 | `link` `unlink` `image` `media` `emoticons` |
  | 清理 | `removeFormat` `clear` `selectAll` |

- 示例：仅保留基础排版

  ```js
  state.editor = {
    imgMaxSize: 5 * 1024 * 1024,
    videoMaxSize: 20 * 1024 * 1024,
    audioMaxSize: 10 * 1024 * 1024,
    toolbar: [
      'code', '|', 'undo', 'redo', '|',
      'bold', 'italic', 'underline', 'strikeThrough', '|',
      'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull', '|',
      'insertOrderedList', 'insertUnorderedList', '|',
      'h1', 'h2', 'h3', 'p', '|',
      'blockquote', 'pre', 'hr', 'table', '|',
      'fontName', 'fontSize', 'foreColor', 'hiliteColor', '|',
      'link', 'unlink', 'image', 'media', 'emoticons', '|',
      'removeFormat', 'clear', 'selectAll', '|',
      'fullscreen'
    ]
  };
  ```

  未知 token 会被忽略（不会渲染），因此可安全裁剪。

## Table

表格数据、loading 和表格级回调由 `kniu:option` 提供；列布局唯一使用 `kniu-table-col` HTML 子标签，公开配置不接收列数组：

内部原生 `.kniu_sys_table` 固定使用 `width:100%`；列配置的总宽度仅生成 `min-width`，超出父容器时由 viewport 横向滚动，不会写入内联像素 `width` 覆盖 100%。普通表头和单元格默认使用 `padding:5px 10px`；`small` 尺寸有自己的紧凑间距。

```html
<kniu-table ref="table" kniu:option="{{tableOptions}}">
  <kniu-table-col field="name" label="名称" />
  <kniu-table-col field="is_show" label="显示" width="120" align="center">
    <template #default>
      <kniu-switch
        kniu:option="{{switchOptions}}"
        kniu@change="updateShow"
      />
    </template>
  </kniu-table-col>
  <kniu-table-col label="操作" width="160" fixed="right">
    <template #default>
      <kniu-btn kniu:option="{{type:'danger',size:'small',link:true}}" kniu@click="deleteRow">删除</kniu-btn>
    </template>
  </kniu-table-col>
</kniu-table>
```

```js
// 控制器：options 整体替换即刷新（usePagination 的 syncOptions 已按此约定实现）
state.tableOptions = {
  data: state.list,
  rowKey: 'id',
  stripe: true,
  border: true,
  highlightCurrentRow: true,
  maxHeight: 250,
  emptyText: '暂无数据',
  loading: state.loading,
  onRowClick: detail => handleRowClick(detail)
};
```

`kniu:option` 键：

| 键 | 说明 | 默认值 |
| --- | --- | --- |
| `height` / `maxHeight` | 固定高度或最大高度 | — |
| `stripe` | 斑马纹 | `false` |
| `border` | 纵向和外部边框 | `false` |
| `size` | `large / default / small` | `default` |
| `fit` | 列宽是否铺满容器 | `true` |
| `showHeader` | 是否显示表头 | `true` |
| `highlightCurrentRow` | 高亮当前行 | `false` |
| `rowKey` | 行数据唯一键 | — |
| `emptyText` | 无数据时表格**内置空行**的文案。不设置时默认「暂无数据」；显式写 `emptyText: ''`（空串）会**隐藏**内置空行——当你改用 `<kniu-empty>` 自定义空状态时必须加它，否则内置文案与 `<kniu-empty>` 会重复出现。**优先级**：`<template #empty>` 插槽 > `emptyText` > 默认「暂无数据」 | `暂无数据` |
| `loading` | 区域加载遮罩开关，必须随 table options 整体更新 | `false` |
| `loadingText` | 加载遮罩中央文案 | — |
> `data` 由 `tableOptions.data` 提供；**原地改 `tableOptions.data` 不触发刷新**，必须整体替换 `tableOptions`。

`kniu-table-col` 支持的常用属性：

- 列标题使用 `label`，字段使用 `field`。
- `width` / `min-width` 设置列宽，`align` / `header-align` 支持 `left / center / right`。
- `fixed` 或 `fixed="left"` 固定在左侧，`fixed="right"` 固定在右侧。
- `type="checkbox"` 创建选择列（每行复选框 + 表头全选），`type="index"` 创建索引列。
- `sortable` 开启排序；排序处理通过表格 options 的 `onSortChange` 接收结果。
- 列模板内的控件事件必须绑定在实际支持该原生事件的控件上，例如将 `kniu@change` 写在列模板内的 `<kniu-switch>`；不要把 `kniu@change` 直接写在 `<kniu-table-col>` 上，列组件不支持该事件。
- **排序三态循环**：点击排序列头依次为「升序 → 降序 → 恢复初始顺序」（第三次点击回到 `setData` 时的数据源顺序，而非在已排序结果上停留）；切换列或编程 `sort()` 同理，`order=''`/`clearSort()` 即恢复原始顺序。
- 数据为空时表头自动锁定：排序、全选及其他表头交互均不可操作；数据恢复后自动解锁。
- `show-overflow-tooltip` 为溢出（被省略号裁切）的单元格提供悬浮提示。仅当单元格内容实际溢出时才弹层，避免每条都提示。定位策略（自动避让）：
  - **默认在单元格正上方、水平居中对齐文字**。
  - **垂直避让**：上方空间不足时自动落到下方；若上下都放不下，则取空间更大的一侧（即「上方不够→下方、下方不够→上方」双向兜底）。
  - **水平避让**：居中后若左侧贴近视口边缘则**左对齐**（tip 左缘贴近单元格左缘）；若右侧贴近视口边缘则**右对齐**（tip 右缘贴近单元格右缘）；最终夹在视口内，保证提示框永远完整可见。
  - **指向小三角**：tip 带同色小三角指向单元格——tip 在上方时三角在 tip 底部朝下、在下方时在 tip 顶部朝上；三角水平位置跟随单元格中心（左右避让时也始终指向单元格），并夹在 tip 内部不出界。
- `editable` 同时配置是否编辑与编辑类型：`true` 或 `'text'` 为文本编辑，`'number'` 为数字编辑，`false` 关闭；数字列可配 `editMin`（默认 `0`：未配置时数字编辑不允许输入负数，提交时小于 0 的值会被钳制到 0）。
- 操作列模板支持多个 `kniu-btn`。
- 操作列模板内的按钮支持 `kniu:if` 条件。页面级条件（如 `kniu:if="{{canEditContent}}"`）会在表格读取列定义前解析；行级条件（如 `kniu:if="{{scope.row.can_edit}}"`）由表格按当前行解析。条件为假时按钮不会渲染。`kniu-btn` 没有 `hidden` 属性，不能用 `hidden` 代替条件渲染。

### 事件

表格通过自定义事件向外通信，优先在 options 中写 `onRowClick`、`onCurrentChange`、`onSelectionChange`、`onSortChange`；模板事件仍可作为模板引擎接口使用，但必须绑定在列模板中的实际控件上，不能直接绑定到 `<kniu-table-col>`。

| 事件名 | `detail` 载荷 | 触发时机 |
| --- | --- | --- |
| `row-click` | `{ row, index }` | 点击某一行（点击操作列按钮、编辑单元格、选择框、Switch 时不会触发） |
| `current-change` | `{ currentRow, oldCurrentRow }` | 当前行变化（需开启 `highlight-current-row`） |
| `selection-change` | `rows: any[]` | 多选框勾选状态变化，`detail` 为当前选中行数组 |
| `sort-change` | `{ column, field, order }` | 点击排序列头触发；`order` 为 `ascending` / `descending` / `''`（空字符串表示取消排序） |

事件使用 `bubbles: true, composed: true` 派发，可穿透组件 Shadow DOM 被 `kniu@` 绑定捕获，也可被祖先节点监听。

```html
<kniu-table ref="table" kniu:option="{{tableOptions}}"></kniu-table>
```

```js
onRowClick(event) {
  const { row, index } = event.detail;
  console.log('点击行', index, row);
}
onSelectionChange(event) {
  const selectedRows = event.detail; // 当前选中行数组
}
onSortChange(event) {
  const { field, order } = event.detail; // order: 'ascending' | 'descending' | ''
}
```

### 方法

表格方法为命令式接口（逃生舱），通过 `ref` 属性把组件实例**数据驱动**地注入控制器作用域后调用。

在模板中声明引用：

```html
<kniu-table ref="table" kniu:option="{{tableOptions}}"></kniu-table>
```

`ref="table"` 会把 `<kniu-table>` 节点挂到控制器作用域的 `table` 上，处理函数里的 `this`（即响应式 state 代理）即可直接访问：

```js
// 处理函数中的 this 指向响应式 state，table 由 ref 注入，全程零 DOM 操作。
clearAll() { this.tableRef.clearSelection(); }
logSelection() { this.tableRef.getSelectionRows().forEach((row) => console.log(row)); }
toggleFirst() { this.tableRef.toggleRowSelection(this.data[0], true); }   // 选中第一行
setSecond() { this.tableRef.setCurrentRow(this.data[1]); }                 // 高亮第二行
sortBySid() { this.tableRef.sort('sid', 'ascending'); }                    // 按 sid 升序
resetSort() { this.tableRef.clearSort(); }                                // 取消排序
relayout() { this.tableRef.doLayout(); }                                  // 重新布局
```

| 方法 | 参数 | 说明 |
| --- | --- | --- |
| `clearSelection()` | — | 清空所有选中行 |
| `getSelectionRows()` | — | 返回当前选中行数组（`any[]`） |
| `toggleRowSelection(row, selected?)` | `row`：行数据；`selected`：可选，省略则取反 | 选中 / 取消选中指定行 |
| `setCurrentRow(row)` | `row`：行数据 | 设置当前高亮行（需 `highlight-current-row`） |
| `sort(field, order)` | `field`：字段名；`order`：`ascending` / `descending` / `''` | 以编程方式排序 |
| `clearSort()` | — | 清除排序状态 |
| `doLayout()` | — | 重新计算并刷新布局（列宽、固定列、滚动阴影等） |

### 空数据插槽 `#empty`

表格无数据时，除 `tableOptions.emptyText` 文案和外部 `<kniu-empty>` 外，还支持 `<template #empty>` 具名插槽直接在表格内部渲染自定义空状态：

```html
<kniu-table kniu:option="{{tableOptions}}">
  <template #empty>
    <kniu-empty kniu:option="{{ note:'暂无文章' }}" />
  </template>
</kniu-table>
```

插槽内容投影到表格空行 `<td>` 内的 `<slot name="empty">`，CSS 默认 flex 居中（列方向居中、间距 8px）。可放任意内容：图标、文字、按钮、`<kniu-empty>` 等。

**空状态优先级**（从高到低）：

1. `<template #empty>` 插槽存在 → 投影插槽内容
2. `tableOptions.emptyText = ''` → 隐藏内置空行（配合外部 `<kniu-empty>`）
3. `tableOptions.emptyText = '自定义文案'` → 显示自定义文案
4. 不设 `emptyText` → 显示默认「暂无数据」

> 注意：`<template #empty>` 与外部 `<kniu-empty>` 是两种不同方式。用 `<template #empty>` 时无需设置 `emptyText: ''`，因为插槽优先级高于文案。

## 空状态 Empty

当列表 / 表格无数据时，使用 `<kniu-empty>` 统一展示空状态。组件内部为 Shadow DOM，居中展示**插画（内联中性 SVG，无第三方品牌标识）+ 文案 + 投影插槽**。

```html
<!-- 典型用法：列表为空、且不在加载/报错时才显示 -->
<kniu-empty kniu:if="{{!list.length && !loading && !error}}" kniu:option="{{note:'暂无数据'}}" />

<!-- 隐藏（例如交给其它逻辑控制时） -->
<kniu-empty kniu:option="{{hidden:true,note:'暂无数据'}}" />
```

| 属性 | 说明 | 默认值 |
| --- | --- | --- |
| `note` | 空状态文案 | `暂无数据` |
| `hidden` | 设置后 `display:none` 不显示 | — |

- `<slot>` 可投影自定义内容（插画下方区域），与 `note` 文案互补。
- `kniu:if` 守卫里的 `!loading && !error`：加载中由 `kniu:loading` 区域遮罩覆盖、报错由 `$msg` 浮层提示，二者都不应再显示「暂无数据」。

**与 `kniu-table` 配合的关键约定**：表格自身已有内置空行（`tableOptions.emptyText`，默认「暂无数据」）。若同页同时用 `<kniu-table>` 和 `<kniu-empty>`，务必把 `tableOptions.emptyText` 设为空字符串以隐藏内置空行，否则会出现两份空状态文案：

```html
<kniu-table kniu:option="{{tableOptionsWithEmpty}}">
  ...
</kniu-table>
<kniu-empty kniu:if="{{!list.length && !loading && !error}}" kniu:option="{{note:'暂无数据'}}" />
```

其中 `tableOptionsWithEmpty` 需带 `emptyText: ''` 隐藏内置空行。

## 分页 Page

列表分页由 `<kniu-page>` 组件与控制器侧的 `usePagination()` 配合完成，对接后端服务端分页接口；分页内部状态由 `usePagination()` 自动初始化。

```html
<kniu-page ref="page" kniu:option="{{pageOptions}}" />
```

```js
// 控制器：options 整体替换即刷新
state.pageOptions = {
  total: state.total,
  pageSize: state.pageRows,
  currentPage: state.currentPage,
  background: true,
  layout: '条数,首页,上一页,页码,下一页,末页,总数',
  onCurrentChange: detail => changePage({ detail }),
  onSizeChange: detail => changePageSize({ detail })
};
```

**旧 attribute（`total` / `page-size` / `current-page` / `background` / `layout` / `prev-text` 等）已全部作废**，`kniu:option` 键：

| `kniu:option` 键 | 说明 | 默认值 |
| --- | --- | --- |
| `total` | 总条数（来自后端） | `0` |
| `pageSize` | 每页条数的唯一初始配置源；`usePagination` 会据此初始化并维护内部 `state.pageRows` | `10` |
| `currentPage` | 当前页码（绑定 `state.currentPage`） | `1` |
| `background` | 页码按钮是否带背景色 | `false` |
| `layout` | 分页条布局。中文支持 `总数,首页,上一页,页码,下一页,末页,条数,跳转`；英文支持不区分大小写的 `First,Prev,Page,Next,Last,Total,Rows,Jumper`。`跳转/Jumper` 显示“去 [页码] 页”，Enter 或 change 后跳转。**渲染为单行，所有分页项的 DOM 顺序严格等于 layout 声明顺序**（默认值继承全局 `UI.use({ components: { page: { layout } } })`，实例单独传 `layout` 时以内联配置为准） | `total,prev,pager,next,sizes` |
| `firstText` / `prevText` / `nextText` / `lastText` | 首/上/下/末页按钮自定义文字（覆盖 `layout` 中的中文别名） | — |
| `sizes` | 自定义每页条数下拉候选项（默认由基数派生，见下） | — |

分页功能回调优先写入 options（`onCurrentChange` / `onSizeChange`）；同名自定义事件仍会正常派发：

| 事件名 | `event.detail` | 说明 |
| --- | --- | --- |
| `current-change` | `{ page }` | 页码切换 | 
| `size-change` | `{ size }` | 每页条数切换 | 

### 每页条数下拉 = 基数的倍数

下拉框候选项严格等于 `pageOptions.pageSize` 初始基数的 1～6 倍：`[base, 2×base, 3×base, 4×base, 5×base, 6×base]`，禁止追加不属于该基数倍数的特殊值。

```js
// pageSize: 15 → 下拉为 15/30/45/60/75/90
import UI from '../../core/kniuui/kniuui.mjs';
const { usePagination } = UI;
const state = reactive({ pageOptions: { pageSize: 15 } });
```

| `pageOptions.pageSize` | 下拉候选项 |
| --- | --- |
| `15` | `15 / 30 / 45 / 60 / 75 / 90` |
| `10` | `10 / 20 / 30 / 40 / 50 / 60` |
| `20` | `20 / 40 / 60 / 80 / 100 / 120` |

> 若某次外部设置了一个不在倍数序列中的 `page-size`（如代码强制 `pageSize=20` 但基数为 15），下拉会**临时**补出该值，待切回倍数后自动归位。

### 控制器对接

`usePagination(options)` 返回 `loadList / changePage / changePageSize / syncOptions` 四个方法，负责请求后端、写回响应式 state；上一页和下一页由分页组件转换成 `current-change`，不再提供重复的控制器函数：

```js
import UI from '../../core/kniuui/kniuui.mjs';
const { usePagination } = UI;

const myController = controller(({ $msg }) => {
    const state = reactive({
      list: [],
      loading: false,
      error: '',
      pageOptions: { pageSize: 15 }
    });

    const pager = usePagination({ state, self: { $msg }, url: '/api/daily', pageKey: 'pageOptions' });

    function changePage(event) { pager.changePage(event); }      // 由 pageOptions.onCurrentChange 调用
    function changePageSize(event) { pager.changePageSize(event); } // 由 pageOptions.onSizeChange 调用

    onMounted(() => pager.loadList(1));
    return { state, changePage, changePageSize };
});
```

要点：

- `usePagination` 请求体固定携带 `page_current`、`page_rows`(= `state.pageRows`)、`field`、`sort`；成功回写 `list / currentPage / pageTotal / total`，页码窗口由 `kniu-page` 自行计算；失败回写 `error` 并调用 `self.$msg(...)` 弹错误浮层。
- `state.pageRows` 是每页条数的**唯一数据源**，`kniu:option` 里的 `pageSize` 必须绑定它；`size-change` 由组件回写 `state.pageRows` 后自动重新拉取。
- 切换每页大小时组件会把 `currentPage` 重置为 1，再从第 1 页加载。
- `usePagination` 不内置接口、表名或业务映射。搜索、翻页、每页条数切换以及保存、删除、审核成功后的显式刷新都通过 `loadList` 完成。
- `createRowDeleteHandler` 默认在成功后刷新当前列表；能够可靠局部更新状态的页面可显式设置 `reloadOnSuccess: false` 并在 `onSuccess` 中处理。

## 导航栏 Navbar

所有 `kniu-*` 组件的 Shadow DOM 样式都经过统一兼容处理：组件内部的固定尺寸会转换为 `calc(数值 / var(--kniu_vw))`，例如 `220 / var(--kniu_vw)` 的写法；字体尺寸转换后使用 `max(12px,calc(数值 / var(--kniu_vw)))`，移动端最终字号不得小于 `12px`；移动端到桌面端的统一断点为 `calc(1280px - 60px)`，1024px 仍按移动端布局处理；媒体查询断点保留原始 `px`，避免改变响应式断点。需要表达「尺寸不得低于某个绝对像素」时写成 `max(28px,calc(40 / var(--kniu_vw)))`：声明值里只要出现 `var(--kniu_vw)` 就视为作者已自行使用项目单位，转换器不再二次改写，其中的 `28px` 下限才能稳定生效（例如 `.kniu_sys_upload_bar` 的 `min-height` 在窄屏下钳在 `28px`）；经 `appendRawStyle()` 注入的样式本就不做转换，可直接写 `max(28px,…)`。项目普通页面通过 `web.min.css` 将移动端 `html/body` 的正文基准设为 `14px`，不再使用 `1em` 把字号锁回浏览器默认的 `16px`，也不再用通配符覆盖页面内部已有的字号层级。日期选择器的普通日历和范围日历分别使用各自渲染方法中的 `weekLabels` 局部变量。

`<kniu-navbar>` 自带桌面横向导航与移动端菜单，不需要分别维护两套头部结构。组件自身的 `:host` 内置 `display:flex;justify-content:space-between;align-items:center;width:100%;height:inherit`，并通过 `--kniu-navbar-font-size` 提供统一导航字号；菜单、`kniu-navbar-cells`、`kniu-navbar-cell`、`kniu-sub-navbar` 与 `kniu-user-login` 的普通文案均继承该字号，品牌文字仍可单独放大，避免导航出现大大小小的字体。页面模板不再重复声明 `kniu-navbar` 布局；组件生成的 `.kniu_sys_head_placeholder` 由组件统一注入 `z-index:-999;position:relative;display:block;width:100%;height:100%` 样式，页面只使用组件生成的占位元素，不再维护外部占位样式。内部 `.kniu_sys_navbar_bar` 删除原有 `padding` 和 `margin:0 auto`，基础样式使用 `margin-right:auto;margin-left:auto;width:calc(100vw - 30 / var(--kniu_vw) * 2);height:inherit`；在 `@media (min-width:calc(1280px - 60px))` 下使用 `width:calc(100vw - 220 / var(--kniu_vw) * 2)` 和 `min-height:72px`。`fixed:'top'` / `fixed:'bottom'` 使导航悬浮在对应位置，存在 `fixed` 时默认启用 `placeholder`；`placeholder:true` 会在组件后生成 `.kniu_sys_head_placeholder`，并按导航实际高度占位。桌面端 `slot[name="default"]` 位于 `.menu` 外并排在 `.menu` 前面，`slot[name="append"]` 位于右侧 `.menu` 内；移动端页面头部始终保留在原位，展开按钮的三横线通过旋转动画变为 `X`，关闭时再同步还原；只有头部下方的菜单面板从左侧滑入并覆盖剩余视口，菜单 `top` 使用外层 `.kniu_web_head` 的实际高度，头部尺寸变化时自动同步，导航项从菜单顶部开始排列，`#default`、`#append` 和未命名兼容内容均投影在 `.menu` 内。active/side 状态使用原生 `toggleAttribute` 同步，避免调用不存在的自定义方法。菜单打开期间组件会将根元素 `html` 设置为 `overflow:hidden`，关闭或卸载后恢复原值。菜单内容仍完全来自现有插槽，不自动虚构搜索、语言或退出等业务入口。`kniu-navbar-cell` 使用 `route` 配置匹配当前路由，使用 `href` 配置导航地址。

```html
<kniu-navbar kniu:option="{{home:'#/'}}">
  <template #brand>
    <kniu-image kniu:option="{{src:'/static/logo.png'}}" />
  </template>
  <template #append>
    <kniu-navbar-cells>
      <kniu-navbar-cell kniu:option="{{route:'/',href:'#/'}}">首页</kniu-navbar-cell>
      <kniu-navbar-cell kniu:option="{{route:'/about',href:'#/about'}}">关于我</kniu-navbar-cell>
      <kniu-sub-navbar>
        <template #title>更多</template>
        <kniu-navbar-cell kniu:option="{{route:'/help',href:'#/help'}}">帮助</kniu-navbar-cell>
        <kniu-sub-navbar>
          <template #title>文档</template>
          <kniu-navbar-cell kniu:option="{{route:'/docs/start',href:'#/docs/start'}}">入门</kniu-navbar-cell>
          <kniu-sub-navbar>
            <template #title>进阶</template>
            <kniu-navbar-cell kniu:option="{{route:'/docs/api',href:'#/docs/api'}}">接口</kniu-navbar-cell>
          </kniu-sub-navbar>
        </kniu-sub-navbar>
      </kniu-sub-navbar>
    </kniu-navbar-cells>
  </template>
</kniu-navbar>
```

| 组件/属性 | 说明 |
| --- | --- |
| `kniu-navbar` options `brand` | 左侧名称 |
| `kniu-navbar` options `home` | 名称点击地址，默认 `#/` |
| `kniu-navbar` options `active` | 当前激活路径；不设置时自动读取当前路由 |
| `kniu-navbar` options `fixed` | 悬浮位置，支持 `top` / `bottom`；存在时默认启用占位 |
| `kniu-navbar` options `placeholder` | 是否在组件后生成 `.kniu_sys_head_placeholder`；显式 `false` 可关闭 |
| `kniu-navbar` options `type:'side'` | 纵向侧栏导航；与 `kniu-navbar-cell` 配合用于应用工作台 |
| `template #brand` | 左侧品牌内容；未设置时显示 options 的 `brand` 文字 |
| `template #append` | 右侧导航内容；仍兼容直接写入默认插槽 |
| `kniu-navbar-cells` | 导航项横向包裹容器，固定 `gap:10px`；移动端纵向排列并保持相同间距 |
| `kniu-navbar-cell[route]` | 用于匹配当前路由的路径 |
| `kniu-navbar-cell[href]` | 导航地址 |
| `kniu-navbar-cell[disabled]` | 禁用导航项 |
| `kniu-sub-navbar` | 可嵌套至三级的子导航容器；父级标题负责展开，点击实际的 `kniu-navbar-cell` 后才关闭移动菜单 |

## 返回顶部 Backtop

```html
<kniu-backtop kniu:option="{{right:100,bottom:100}}" />
```

组件固定显示并自动查找当前可滚动容器；在窄屏设备上会自动使用安全边距。options 的 `right`、`bottom` 单位均为像素。

## 日期选择器

```html
<kniu-date-picker
  ref="datePicker"
  kniu:form="{{form.create_time}}"
  kniu:option="{{datePickerOptions}}"
  name="create_time">
  <template #prepend label-width="100px">发布时间</template>
</kniu-date-picker>
```

组件配置只通过 `kniu:option` 传入。`name`、`ref`、`kniu:form`、`kniu@change` 等框架接口和模板插槽继续有效；旧的 `type`、`min`、`max`、`first-day-of-week` 等组件配置属性不再读取。

| options 字段 | 说明 |
| --- | --- |
| `type` | `date`、`datetime` 或 `time`，默认 `date` |
| `lang` | `cn` 或 `en`，默认 `cn` |
| `range` | 是否启用开始、结束范围联动；范围模式的 model 值为双值数组 |
| `format` | 输入框显示格式，不改变内部标准值格式 |
| `weekStart` | `0` 表示星期日开始，`1` 表示星期一开始，默认 `1` |
| `value` | model 为空时使用的初始值；范围模式可传双值数组 |
| `mark` | 日期标记对象，支持具体年份以及 `0` 通配年月 |
| `min` / `max` | 可选择的最小、最大日期 |
| `placeholder` | 输入框占位文字 |
| `disabled` / `readonly` / `required` | 禁用、只读和必填状态 |

日期面板整体宽度不超过 `218px`，范围联动的两个相邻月份纵向排列。日期、年份和月份视图的标题始终显示完整年月；中文按“年 月”排列，英文按“月 年”排列。英文星期标题使用 `Su Mo Tu We Th Fr Sa` 两字母缩写。年份选择按三列五行显示以当前年居中的 15 年，月份选择按三列四行显示 12 个月。

头部单箭头 `‹ ›` 在所有视图中只切换月份，双箭头 `« »` 只切换年份；范围联动模式使用同一导航语义并在切换后保留当前选择层级。

日期、年份和月份视图使用相同的内容区及面板总高度；年份五行与月份四行会自动均分固定高度，切换视图时面板不会上下跳动。

面板底部左侧实时预览当前选择，右侧以相同按钮样式紧邻排列“重置、现在、确定”；重置立即清空输入框和待选范围，并把草稿及预览恢复为当前日期且不提交，确定后才通过 model 和 change 事件提交。

“现在”会直接选择当前日期时间，并与“确定”使用相同的提交事件和关闭流程；空值时直接点击“确定”也默认提交当前日期时间。范围模式点击“现在”时，起止值都使用当前日期时间。

`datetime` 模式采用左右分栏，日期位于左侧，时、分、秒自绘滚动列表位于右侧，底部预览和操作按钮横跨整个面板；纯 `date` 与纯 `time` 模式保持原布局。

非范围 `datetime` 面板中，年月导航横跨整个面板并独占第一行；第二行并排显示星期与时分秒标题，第三行并排显示日期和时间列表，因此时间区域不会越过年月头部。

时、分、秒列表默认隐藏滚动条但保持滚轮和触控滚动，鼠标悬停对应列表时才显示细滚动条。

时、分、秒标题之间不绘制贯穿线；标题下方的三列组成连续选择框，相邻列共用一根竖线且不重叠，各列内部的时间数字之间不绘制横线，选择框底部保留间距。

“秒”列与面板最右侧之间保留 `4px` 空隙，三个时间列在剩余宽度内继续等分并保持标题、列表对齐。

浮层通过窗口捕获阶段判断外部点击：点击日期面板和输入组件之外的页面空白会关闭选择器；Portal 不覆盖页面，面板内部的日期、时间滚动和操作按钮保持正常响应。

`hidden` 状态具有最高显示优先级，即使 `datetime` 使用 Grid 布局，关闭和确定提交后面板也会真正从视觉布局中隐藏。

时间列跟随 `options.format`：包含 `ss` 时显示时、分、秒三列；不包含 `ss` 时隐藏秒及其分隔符，只显示等宽的时、分两列，并在提交时把秒归零。

隐藏秒列时不会保留第三列空白：时间区动态缩为两列宽度，`datetime` 面板总宽度同步从 `350px` 收窄至 `306px`；恢复秒列时自动恢复三列宽度。

时、分、秒均独立跟随 format：`HH/hh` 控制时、`mm/ii` 控制分、`ss` 控制秒。只有“分、秒”时仅显示两列且无空白；一至三列时间区域会分别匹配对应面板宽度，未显示的时间单位提交为零。

format 字母大小写不敏感，组件会在内部自动规范化：日期部分的 `M/m` 识别为月份，时间部分识别为分钟，其他年、日、时、秒字母也会统一为组件标准形式；不会修改原始 options 配置对象。

例如 `yyyy-mm-dd mm:ss` 会规范化为 `yyyy-MM-dd mm:ss`：第一个 `mm` 是月份，空格后的 `mm` 是分钟，因此时间区显示“分、秒”两列而不显示“时”。

时间选择区会按第一列可见单位绘制左外框：隐藏“时”后由“分”补齐左边框，只显示“秒”时则由“秒”补齐，左侧不会留空。

星期标题与日期网格之间不显示横线；时间选区仍保留完整四边外框及三列之间的竖向分隔线。

年月导航头部与中部的星期、时间标题之间保留整行分隔线；该分隔线与星期和日期之间的留白属于两个不同层级。

日期网格首行与星期栏分隔线保留间距；标记圆点仅在日期未选中时显示，标记日期进入单选高亮或范围起止高亮后自动隐藏圆点。

## 评论组件 kniu-comment

前台文章底部的评论留言组件，配置只通过 `kniu:option` 传入。

前台业务只在已登录、已绑定账号且未禁言时渲染评论输入区。`currentUserId` 始终传 `tb_role.id`，`currentUser` 只用于展示昵称，不能用昵称判断归属或提交身份。本人评论通过 `onDelete` 接收 `{ commentId }`，业务确认后调用删除接口并刷新列表；服务端仍需校验所有权。未登录时仍显示评论点赞状态和按钮外观，但点击应跳转登录页，不渲染回复按钮；禁言账号保留评论列表，不渲染输入区。

```html
<kniu-comment kniu:option="{{commentOptions}}" />
```

```js
state.commentOptions = {
  list: [],                          // 评论列表：{id,parentId,replyTo,username,avatar,time,content,likes,liked}
  placeholder: '请输入评论...',
  maxLength: 500,                     // 最大字数；配置后显示实时“已输入 / 上限”
  submitText: '发表评论',
  emptyText: '暂无评论，快来抢沙发吧！',
  emojis: ['😀', '😄', ...],         // 可选，默认内置常用表情
  currentUser: '',                   // 当前登录账号的昵称，仅用于展示
  currentUserId: 0,                  // tb_role.id；未登录为 0
  canSubmit: false,                  // 未登录或禁言时为 false
  onSubmit: async (detail) => { /* detail: {content, parentId} */ },
  onLike: async (detail) => { /* detail: {commentId, liked} */ },
  onDelete: async (detail) => { /* detail: {commentId} */ }
};
```

| options 字段 | 说明 |
| --- | --- |
| `list` | 评论列表，每项含 `id`、`userId`（其值为 `tb_role.id`）、`isOwn`、`parentId`、`replyTo`、`username`、`avatar`、`time`、`content`、`likes`、`liked`；可选 `likeFeedback` 使用新的时间戳触发一次上漂红心；本人评论显示删除按钮，不渲染回复和点赞操作 |
| `placeholder` | 输入框占位文字 |
| `maxLength` | 评论最大字数；大于 0 时限制输入、表情插入与提交，并在输入框内部右下角实时显示“当前字数/上限” |
| `filter` | 逗号分隔的敏感词，例如 `B,逼,屌,操`；提交事件派发前进行不区分大小写匹配，命中后提示“您的评论涉及敏感字不可提交评论”并直接终止 |
| `currentUserId` | 当前登录账号的 `tb_role.id`；与列表 `userId/isOwn` 一起识别本人评论，不能改用昵称 |
| `submitText` | 提交按钮文字，默认“评论” |
| `emptyText` | 空态提示文字 |
| `emojis` | 表情面板内可选表情数组，默认内置 46 个常用表情 |
| `currentUser` | 当前登录账号昵称，仅用于展示；后端从身份令牌解析 `tb_role.id`，不接收昵称作为归属字段 |
| `onSubmit` | 提交评论回调，`detail` 含 `content` 与 `parentId`（回复目标） |
| `onLike` | 点赞/取消点赞回调，`detail` 含 `commentId` 与 `liked`；登录后可反选，未登录由业务引导到登录页 |
| `onDelete` | 删除按钮回调，`detail` 含 `commentId`；评论操作组与昵称、时间处于同一信息行并靠右，删除按钮固定在“回复”左侧且默认隐藏，鼠标移入或键盘聚焦 actions 区域时显示 |

事件回调（`onSubmit`/`onLike`/`onDelete`）由统一 options 协议映射为组件内部派发的 `submit`/`like`/`delete` 事件，回调收到的 `detail` 即事件负载。

评论点赞成功后，控制器必须以接口返回的最新 `liked` 状态写入目标项的 `likeFeedback`：返回 `true` 时播放上漂红心，返回 `false` 时不播放；不能使用请求前的旧 `liked` 状态判断。`likeFeedback` 是一次性信号，组件以“评论 ID + 反馈标记”消费一次，控制器更新目标项时也应清除其它项残留的旧信号，避免多条评论因一次列表重渲染同时播放。红心保留评论按钮独立的 `left:50%` 与负 `margin-left` 水平居中方式，垂直位移保持原有 `-4px`、`-18px` 起点和中间点，仅将终点从 `-48px` 小幅缩短为 `-42px`；插入节点后先强制建立首帧再启动动画，避免评论按钮的 flex 布局或同帧渲染导致红心不移动。组件样式转换器会把负 px 值转换为 `calc(-数值 / var(--kniu_vw))`，不生成 `-calc(...)`。

### 下拉面板样式统一约定

所有组件内的普通下拉面板使用同一套面板表面样式，包括 `kniu-select`、分页条数、日期选择器、编辑器的字体/字号/颜色/表格/表情面板、评论表情面板、前台用户菜单和桌面端导航子菜单：

```css
background-color: #fff;
border: 1px solid #e4e7ed;
border-radius: 4px;
box-shadow: 0 2px 12px rgba(0,0,0,.1);
```

普通下拉选项统一使用 `min-height:32px; padding:0 12px`，悬停或聚焦时使用 `#f5f7fa` 背景和 `#409eff` 文字；网格型面板（表情、颜色）可以保留自身网格尺寸，但面板表面仍必须遵循上述基准。编辑器的行距原生 `select` 的关闭态也遵循相同的边框与圆角。

链接、图片、媒体编辑等表单型弹窗不属于普通下拉，不得套用下拉选项布局；`kniu-modal` 和移动端全屏导航面板同样不在本约定范围内。**以后凡新增组件普通下拉面板，必须复用核心共享下拉样式，不得另设一套视觉基准。**

### 下拉弹框定位约定（默认下方，不足翻上方）

所有下拉类弹框浮层（日期选择器、分页条数选择器、评论表情面板）**默认显示在触发元素下方**；仅当下方空间不足且上方空间足够容纳完整面板时切换到上方，上方也不足时保持默认下方。

- 表情面板默认 `top:calc(100% + 6px)`（下方）；打开时用 `getBoundingClientRect()` 测量下方剩余空间（仅用户点击打开时测一次，非渲染热路径），不足时加 `.kniu_sys_comment_above` 类切换 `bottom:calc(100% + 6px)`（上方）。
- 间距统一 `6px`，与分页下拉一致，保证三类下拉弹框定位统一。
- 方向切换通过容器/面板自身的 `data-placement` 或 `above` 类控制，动画方向与展开方向一致。

### 按钮样式约定

评论组件工具栏内的按钮必须跟随项目 `kniu-btn` 的语义与尺寸，保持视觉统一：

| 按钮 | 样式 | 尺寸 |
| --- | --- | --- |
| 表情按钮 | 默认样式：白底、灰边框 `#dcdfe6`、文字色 `#606266`；悬停蓝边框/浅蓝背景 `#ecf5ff` | `min-height:32px; padding:8px 12px` |
| 提交按钮 | 主色样式：蓝底 `#409eff`、白字、蓝边框；悬停 `#79bbff`；禁用 `#a0cfff` | `min-height:32px; padding:8px 15px; font-weight:500` |

两按钮**高度必须一致**，与项目 `kniu-btn` 默认/主色两种类型对齐；禁止自行使用绿色、红色等非项目主色的提交按钮。

### 组件实现要点（2026-09-01）

- 必须定义本组件自己的 `options` accessor（存储到 `_options` 并触发 `_render`），否则 `installOptionsOnlyProtocol` 因无 `ownDescriptor.set` 会退回属性反射，`_options` 恒空、渲染不出内容——对齐 kniu-switch/kniu-select/kniu-date-picker 既有模式。
- 必须把 `kniu-comment` 加入统一 options 协议组件清单，否则 `onSubmit`/`onLike` 事件回调不会绑定。
- 后端返回的 `list` 项字段含 `{id,userId,isOwn,parentId,replyTo,username,avatar,time,content,likes,liked}`；`replyTo` 和 `isOwn` 均由服务端按身份关联生成。前端渲染时 `commentEscape()` 转义，后端已 `decodeFields` 一次。

## 前台登录状态 kniu-user-login

前台公共头部始终使用 `<kniu-user-login></kniu-user-login>`。移动端用户区域 `.user` 使用 `padding: 0 16px 0 calc(16px + var(--kniu-navbar-level, 0) * 16px)`，桌面端恢复为无内边距。未建立账号时显示“你好，访客！”、头像和下拉箭头，菜单仅提供“登录”；统一登录页可以切换登录和注册。建立账号后显示头像、“你好，昵称”和下拉箭头，菜单提供“个人中心”“后台管理”和“退出”；“后台管理”在新标签页打开后台登录页。点击退出后先清除本地身份使前台立即变为访客，再由 `/frontProfileClear` 销毁前后台 Session；数据库账号仍保留。前后台任一端登录或退出时，`kniu_front_identity` 与 `kniu_auth_logout_at` 的跨标签同步会立即更新另一端 UI；组件监听 `kniu-identity-change` 实时更新。移动端导航收起时必须同步关闭用户下拉菜单；浮层 portal 关闭后恢复到原始节点位置，清除所有临时定位状态；每次打开都在下一帧重新测量触发按钮，导航动画期间持续跟随锚点，反复开闭不得沿用失效坐标。

## 点赞组件 kniu-like

文章点赞组件只通过 `kniu:option` 配置，按钮显示大拇指图标及括号包裹的点赞数，例如“大拇指图标 (360)”。组件始终渲染；`own=true` 时按钮禁用但仍显示点赞数，不能把整个组件隐藏。组件在内容区域水平居中并保留 `24px` 上下间距；按钮最小高度 `44px`（下限挂在**宿主**上），图标 `24px`，文字 `16px`。**尺寸契约**：内层真实按钮填满宿主盒（`height:100%`），因此当外层布局给宿主设定了固定尺寸时，点赞按钮会与同组的 `kniu-btn` 呈现完全一致的长宽——宿主无确定高度时 `height:100%` 回退为 `auto`，按钮高度等于自身内容盒（约 48 设计 px），触控下限由宿主 `min-height:44px` 兜底。仅当状态为已点赞且收到新的 `feedback` 标记时向上飘出蓝色 `+1`；取消点赞、旧反馈重渲染和待处理的取消请求都不播放，并遵循 `prefers-reduced-motion`。

```html
<kniu-like kniu:option="{{likeOptions}}" />
```

```js
state.likeOptions = {
  count: 360,
  liked: false,
  own: false,
  loading: false,
  disabled: false,
  feedback: 0,             // 每次成功点赞使用新的时间戳触发一次 +1 动画
  onChange: async ({ liked, count }) => { /* 提交后以服务端计数覆盖 count */ }
};
```

| options 字段 | 说明 |
| --- | --- |
| `count` | 当前点赞数，组件保证显示为不小于 0 的整数 |
| `liked` | 当前是否已点赞；为 `true` 时显示主色高亮 |
| `own` | 当前内容是否属于本人；为 `true` 时不渲染点赞按钮 |
| `loading` | 提交中禁用按钮，防止连续点击造成重复请求 |
| `disabled` | 禁用点赞 |
| `onChange` | 点击回调，收到 `{liked, count}`；`liked` 是本次期望提交的新状态 |

组件只派发状态意图，不在本地先行增减；业务提交 `/likeArticle` 后用服务端返回的最新 `likes` 整体替换 options，避免并发下计数漂移。

## 文章翻篇组件 kniu-article-tab

用于详情页显示上一篇、下一篇。相邻文章不存在时显示“返回列表”，点击时 `id` 为 `null`，由业务返回列表页。

```html
<kniu-article-tab kniu:option="{{articleTabOptions}}" />
```

```js
state.articleTabOptions = {
  previous: { id: 1, title: '上一篇文章标题' }, // 无相邻文章时为 null
  next: { id: 3, title: '下一篇文章标题' },
  previousLabel: '上一篇',
  nextLabel: '下一篇',
  onChange: ({ direction, id }) => { /* 切换到对应文章 */ }
};
```

组件按上下两行排列，标题允许换行；缺少上一篇或下一篇时不渲染对应项，两项都缺少时隐藏整个组件。点击派发 `change`，负载为 `{direction:'previous'|'next', id:number}`。

### 组件目录化三件套（2026-10-08 起）

`kniu-article-tab` 是第一个按「模板 / 样式 / 逻辑三件套」形态拆分的组件，文件位于 `kniu-article-tab/` 子目录：

| 文件 | 职责 |
| --- | --- |
| `kniu-article-tab.html` | shadow 模板静态骨架（动态行由 `.mjs` 填入） |
| `kniu-article-tab.css` / `kniu-article-tab.render.css` | 组件样式（空态 / 渲染态） |
| `kniu-article-tab.mjs` | 组件类 + `registerArticleTab(context)` 注册函数 |

约束：①组件模块不反向 import `kniuui.mjs`（避免循环依赖），共享闭包工具由 `kniuui.mjs` 的 `KNIU_COMPONENT_CONTEXT` 注入（当前暴露 `attachComponentShadow`，后续组件迁出时按需追加）；②`.html`/`.css` 经 `?module` 文本模块通道同步拿到（dev 侧 `kniuserver.mjs`、dist 侧 `kniubuilder.mjs` 两侧同语义，均支持 `.css?module` 与 `.html?module`）；③注册后 `installOptionsOnlyProtocol` 照常生效（`kniuui.mjs` 末尾 tag 列表不变），options 默认值合并与回调绑定行为与内联实现完全一致；④shadow 模板缓存 key 因此从「含动态按钮行」变为恒定骨架，命中率更高。后续组件逐个迁出时沿用此形态。

## 默认导出

```js
import UI from '../../core/kniuui/kniuui.mjs';

UI.msg('消息');
UI.confirm('确认操作？', '提示');
```
