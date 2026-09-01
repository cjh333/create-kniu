# kniuui 技术说明

`kniuui.js` 是 KniuSystem 的系统 UI 模块，负责注册通用 Web Components，并提供消息框、确认框等全局 UI API。

## 约定

- 系统 UI 自定义元素使用 `kniu-` 前缀。
- 组件内部 DOM 类名使用 `kniu_sys_` 前缀。
- 所有 `kniu-*` 组件的功能配置统一通过 `kniu:options` 对象接收；旧的组件配置 attribute 不再读取或兼容。
- 组件使用 Shadow DOM 隔离内部结构与样式。

## 统一 options 协议（强制）

组件标签只保留模板引擎接口：`ref`、`kniu:model`、条件/循环/样式指令、插槽以及 `kniu@...`。其他配置全部放入 `kniu:options`；组件自身产生的回调优先使用 `onXxx`，如 `onChange`、`onCurrentChange`、`onSizeChange`。

```html
<kniu-table ref="table" kniu:options="{{userTable}}"></kniu-table>
<kniu-input kniu:model="{{form.name}}" kniu:options="{{nameInput}}"></kniu-input>
<kniu-page kniu:options="{{userPage}}"></kniu-page>
```

表格的 `cols`、`data`、loading、编辑、开关、操作按钮和回调均属于 `tableOptions`，不再使用 `kniu-table-col`。options 数据变化时必须整体替换对象引用。以后新增组件也必须先实现本协议。

### 渲染与样式约定（性能铁律）

- **所有组件必须 Shadow DOM 隔离**，统一经 `attachComponentShadow(host)` 初始化：`<template>` 按 HTML 文本缓存，实例只克隆 DocumentFragment 并一次性挂载。
- **强制渲染隔离（已实现）**：`attachComponentShadow` 给 `:host` 统一注入 `contain: layout`（经共享样式表，每次 `innerHTML=` 重设时保留），彻底切断局部变动对全局布局依赖检查。未用 `contain: strict`（含 size containment，内容定宽元素会塌缩）亦未用 `contain: paint`（会裁切溢出宿主的下拉/浮层）。**排除项**：`kniu-table`(tooltip 用视口 fixed 定位)、`kniu-navbar`(移动菜单用视口 fixed 定位) 自身阴影含视口固定后代，加 contain 会让其 fixed 后代改相对宿主定位而错位，故在 `KNIU_CONTAIN_EXCLUDE_TAGS` 中跳过。
- **正确初始化时机**：样式节点必须和 DOM **同步**挂载（模板缓存克隆 + Fragment 一次性挂载），**绝不**在 `attachShadow` 执行完成后再动态插入 `<style>`，否则 `contain` 等属性无法生效。
- **禁止频繁全量重写 innerHTML**：不要反复 `shadowRoot.innerHTML = '...'`（每次销毁旧树、重建节点、重绑事件并触发强制同步布局）。批量渲染先建 Fragment 再一次 `replaceChildren`；复用池 + 事件委托。
- **缓存 Shadow Root 实例**：高频更新组件提前缓存 `shadowRoot` 引用，避免重复创建/销毁影子树带来的额外开销。
- **组件样式走共享样式表** `adoptSharedStyle(root, cssText)`：按 cssText 缓存 `CSSStyleSheet`，ShadowRoot 用 `adoptedStyleSheets` 挂载。**不要在 shadowRoot 里 append 逐实例 `<style>`**（同样的 CSS 会被每个实例重复解析）。目标不是 ShadowRoot 时自动退回 `<style>` 元素。调试时设 `globalThis.__KNIU_NO_SHARED_SHEETS = true` 可退回逐实例模式做 A/B。
- **避免强制同步布局**：禁止在 Shadow 内同步读写 `offsetHeight` / `getBoundingClientRect` / `scrollWidth` / `clientWidth` / `offsetWidth`。需要布局指标时用 `getLayoutMetrics()` 缓存，并在 resize / ResizeObserver / 内容变化 / `doLayout` 时失效；周期性刷新（如阴影显隐）用 `scheduleShadowVisibilityUpdate()` 合并到 rAF。
- **批量渲染先建 Fragment**：表格行、分页页码、下拉项、单选项等一律先构建 `DocumentFragment`，再一次 `replaceChildren`，禁止在循环里逐个 `appendChild`。
- **行/项节点复用时必须改事件委托**：复用会让监听器闭包持有陈旧数据。监听器挂容器（表格整表挂 tbody 两个），行索引写 `dataset.rowIndex`，事件处理时据此从数据数组取回当前对象。复用池还需校验结构签名（如表格的 `rowPoolColumnSignature`），列结构变化即整池作废。
- **事件机制优化（已实现）**：跨 Shadow 边界通信优先用属性绑定；高频事件工具 `debounce` / `throttle` 已落到 `client/core/kniuutil.mjs`（纯函数、零依赖，浏览器/Node 通用）。`kniuheadfix.mjs` 的 `resize` 改用 `throttle(...,120)`；三个搜索页（article/daily/users）输入框绑定 `kniu@input="debouncedSearch"`（250ms 防抖，Enter/点击仍走即时 `searchList`）。
- **内存泄漏兜底**：页面/组件卸载时统一销毁 Shadow 根上的所有事件监听器（含 rAF 句柄、ResizeObserver、复用池、列宽缓存、布局指标缓存），避免残留引用导致内存泄漏。
- **框架级 diff**：组件库自带 diff 更新能力，自动实现局部更新，避免全量重渲染。

- 模块使用默认导出：`import KniuUI from './kniuui.js'`。

## 消息提示

组件方法和请求回调中可以直接调用：

```js
this.$msg('这是一条消息提示');

this.$msg({
  content: '保存成功',
  type: 'success'
});
```

## Loading

`<kniu-loading kniu:options="{{loadingOptions}}" />` 默认使用固定到视口最高层的全屏遮罩；全局加载期间同时锁定 `html` 和 `body` 滚动，使长页面的滚动条不会露在遮罩外。配置 `contained: true` 时，遮罩只覆盖定位容器：

```html
<section style="position:relative;">
  <article></article>
  <kniu-loading kniu:options="{{({ contained:true, show:loading })}}" />
</section>
```

后台公共布局使用 `contained` 模式，加载时只遮罩右侧工作区，不覆盖左侧导航。

消息类型为 `success`、`warning`、`info`、`error`，默认 `info`。`$msg()` 会动态创建 `<kniu-msg>` 并在关闭后销毁，页面中不需要预先声明消息组件。

## 图片上传预览

```html
<kniu-upload kniu:model="{{files}}" kniu:options="{{uploadOptions}}">选择图片</kniu-upload>
```

- 组件只负责本地选择、Blob 预览、删除和回显，不会立即上传。
- `max-size` 是单个文件大小，单位 M；默认单图，再次选择会覆盖当前图片。
- 设置 `multiple` 后才启用多图；`max-count` 表示最多数量，照片墙会自动换行。
- 模型数组可包含新 `File` 或数据库图片 URL；真正上传由表单提交统一完成。
- 图片全部删除后显示“暂无图片”占位，但空占位不会进入文件数组。
- 上传预览图片默认使用 `object-fit: contain`，完整显示图片且不裁切。

## 模态框

```html
<kniu-modal kniu:options="{{modalOptions}}" kniu@close="closeDialog">
  <template #$header><span>编辑文章</span></template>
  <template #default>弹框内容（推荐使用 kniu-input-group + kniu-input 等）</template>
  <template #footer>
    <kniu-btn kniu@click="closeDialog">取 消</kniu-btn>
    <kniu-btn kniu:options="{{primaryButton}}" kniu@click="saveEdit">保 存</kniu-btn>
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
this.$confirm('此操作将永久删除该文件, 是否继续?', '提示', {
  confirmButtonText: '确定',
  cancelButtonText: '取消',
  type: 'warning',
  closeOnClickModal: false   // 禁止点击蒙版关闭（默认 true 允许）
}).then(function () {
  // 用户确认
}).catch(function () {
  // 用户取消、关闭或按 Esc
});
```

确认后 Promise 进入 `then`，取消后进入 `catch`。

## Button

```html
<kniu-btn kniu:options="{{({ type:'primary', size:'small', round:true })}}">保存</kniu-btn>
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
  kniu:model="{{form.username}}"
  placeholder="请输入用户名"
  clearable
></kniu-input>
```

- `type` 默认值为 `text`。
- `clearable` 在存在内容时显示清除按钮，清除后触发 `input`、`change`、`clear`。
- `<template #prepend>` 用于在输入框前增加附加内容，`<template #append>` 用于在输入框后增加附加内容；两者都可通过 `label-width="200px"` 设置附加区域的固定宽度。组件内部附加区域会直接使用该宽度。
- `show-password` 仅在 `type="password"` 时生效。
- 清除和密码显示控件使用 `span[role="button"][tabindex="-1"]`，按 Tab 时会跳过，仅响应鼠标或触摸点击。
- 密码隐藏时显示闭眼图标，密码显示时显示睁眼图标。
- 支持 `name`、`placeholder`、`autocomplete`、`maxlength`、`disabled`、`readonly`、`required`。
- 提供 `focus()` 和 `select()` 方法。
- Input 中按 Enter 会触发所属表单提交。
- `readonly` 状态点击或聚焦时保持默认边框色，不显示可编辑状态的蓝色高亮。
- `prepend`、`append` 内的 `kniu-btn` 自动铺满整个附加区域，完整区域均可点击。

## Select

```html
<kniu-select kniu:model="{{form.region}}" kniu:options="{{selectOptions}}">
  <kniu-option kniu:options="{{({ label:'Zone one', value:'shanghai' })}}" />
  <kniu-option kniu:options="{{({ label:'Zone two', value:'beijing' })}}" />
</kniu-select>
```

- `kniu-select` 支持 `placeholder`、`name`、`disabled`、`required`、`size` 和 `style`。

### kniu-radio-group

```html
<kniu-radio-group kniu:model="{{form.role}}">
  <kniu-radio kniu:options="{{({ value:'1', size:'large' })}}">管理员</kniu-radio>
  <kniu-radio kniu:options="{{({ value:'2', size:'large' })}}">普通用户</kniu-radio>
</kniu-radio-group>
```

- `kniu-radio-group` 支持 `kniu:model`、`name`、`disabled`、`size` 以及 `input`、`change` 事件。
- `kniu-radio` 支持 `value`、`label`、`disabled`、`size`，未设置 `label` 时使用标签内文本。
- 单选项选中时显示主题色实心圆和中心白点，并保留键盘焦点轮廓及禁用状态反馈。
- 下拉内容展开时右侧箭头朝上，关闭、失焦或完成选择后恢复朝下。
- `size` 支持 `small`、默认尺寸和 `large`。
- `kniu-option` 使用 `label`、`value` 和 `disabled` 声明选项。
- 值变化时触发 `input` 和 `change` 事件，`change.detail` 为当前值。
- 分页组件的每页条数下拉使用同一个组件。

## Tag

```html
<kniu-tag kniu:options="{{({ type:'success' })}}">已启用</kniu-tag>
<kniu-tag kniu:options="{{({ type:'danger', effect:'dark', closable:true })}}">异常</kniu-tag>
```

- `type` 支持 `primary`（默认）、`success`、`warning`、`danger` 和 `info`。
- `size` 支持 `large`、默认尺寸和 `small`；`effect` 支持默认浅色、`dark` 和 `plain`。
- `round` 使用胶囊圆角，`closable` 显示关闭按钮并触发 `close` 事件，`disabled` 禁止关闭交互。
- 表格默认插槽中的 `kniu-tag` 会保留标签属性，并以当前列 `field` 对应的行数据作为标签内容；标签属性支持 `{{scope.row...}}` 行级表达式，例如按角色动态设置 `type`。

## Status

```html
<kniu-status kniu:options="{{({ type:'success' })}}">编辑</kniu-status>
<kniu-status kniu:options="{{({ type:'primary' })}}">查看</kniu-status>
```

- 显示形式为“彩色圆点 + 文本”，`type` 只改变圆点颜色，文字保持正文色。
- `type` 支持 `primary`（默认）、`success`、`warning`、`danger` 和 `info`。
- `size` 支持 `large`、默认尺寸和 `small`，会同步调整文字与圆点尺寸。
- 表格默认插槽中的动态 `type="{{scope.row...}}"` 会按当前行计算，标签内容读取列 `field` 对应的当前行值。

## Form 和 InputGroup

```html
<kniu-form ref="form" kniu:options="{{loginModel}}" kniu@submit.prevent="onSubmit">
  <kniu-form-cell kniu:options="{{({ label:'用户名' })}}">
    <kniu-input kniu:model="{{loginModel.username}}" kniu:options="{{({ name:'username' })}}"></kniu-input>
  </kniu-form-cell>
</kniu-form>
```

**所有配置只走 `kniu:options`**。`model` / `data` / `rules` / `kniu:rules` / `formConfig` / `label-position` / `label-width` 属性与 `kniu:rules` 指令**全部作废**，表单元素上只剩 `ref`、事件和两个保留键：

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

- `value` 是默认值也是当前值：`kniu:model="{{loginModel.username}}"` 直接绑到字段对象上，引擎自动读写它的 `value`，无需写 `.value`。
- `condition` 为正则 / 函数 / `true`（`true` 表示非空即通过）；`message` 为错误提示，校验失败时 `$msg` 弹出并给控件加 `data-invalid`。
- **只验证当前渲染出来的字段**：`kniu:if` 未渲染的控件不参与校验（条件表单天然按场景验证）。
- 组件 API：`options`、`values`（摊平后的纯值对象，供直接提交）、`validate()`、`reset()`（回到首次传入的默认值）。
- 提交按钮用 `native-type="submit"`：`kniu-form` 在原生 `submit` 上拦截，先 `validate()`，不通过则阻止 `kniu@submit` 执行。

`labelPosition` 支持：

- `top`：标签位于输入框上方。
- `left`：标签位于左侧且文字左对齐。
- `right`：标签位于左侧且文字右对齐，默认值。

标签位置同时镜像到宿主的 `data-label-position` 属性，供外部样式挂钩（原 `label-position` 属性已废）。

`kniu-input-group` 与 `kniu-form-cell` 共用同一套实现（标签 + 内容布局）。带标签的表单单元写 `<kniu-form-cell kniu:options="{{({ label:'用户名' })}}">`，不带 label 的纯分组容器才用 `<kniu-input-group>`。

`kniu-form-cell` 也支持模板结构：`<template #prepend label-width="120px">权限</template>` 声明标签，`<template #append>` 放置 `kniu-radio-group` 等自定义表单内容。条件渲染延迟插入模板时组件会自动重新挂载；模板式 prepend 标签与输入组件附加标签保持一致，文字默认水平、垂直居中并使用 `#909399`。

输入控件需带 `name`（或 `kniu:model` 指向 options 字段）才会被当作字段纳入取值与验证；同名只取首个控件。字段控件范围：`kniu-input`、`kniu-textarea`、`kniu-select`、`kniu-switch`、`kniu-radio-group`、`kniu-checkbox-group`、`kniu-date-picker`、`kniu-upload`、`kniu-editor`、`kniu-slider`。

## Image

```html
<kniu-image
  style="width:100px;height:40px;"
  src="{{imageUrl}}"
  fit="{{fit}}"
  alt="验证码"
></kniu-image>
```

`fit` 支持 `fill`、`contain`、`cover`、`none`、`scale-down`，未设置或值无效时默认为 `contain`。组件内置暂无图片、加载中和加载失败状态，并触发 `load`、`error` 事件。

表格图片列在默认插槽中声明，`field` 指定图片地址字段：

```html
{ field: 'cover', label: '封面', width: 180, align: 'center', image: { options: { fit: 'cover' } } }
```

## Switch

开关组件。**旧 attribute（`active-value` / `inactive-value` / `active-color` / `inactive-color` / `width` 等）已全部作废**，统一用 `kniu:options` 传配置：

```html
<kniu-switch
  kniu:model="{{row.is_show}}"
  kniu:options="{{switchOptions}}"
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

| `kniu:options` 键 | 说明 | 默认值 |
| --- | --- | --- |
| `activeValue` / `inactiveValue` | 开 / 关对应值 | `true` / `false` |
| `activeColor` / `inactiveColor` | 开 / 关轨道颜色 | `#409EFF` / `#C0CCDA` |
| `width` | 轨道宽度（px） | `40` |
| `disabled` | 禁用 | `false` |
| `activeText` / `inactiveText` | 开 / 关文字（设置了对应图标 class 时自动隐藏） | — |
| `activeIconClass` / `inactiveIconClass` | 开 / 关图标 class | — |
| `name` | 原生 input 的 name | — |

- `kniu:model` 双向绑定（同 kniu-input），状态变化触发 `change`（表格列内开关的 `kniu@change` 同样有效），提供 `focus()`。
- **整体替换 options 对象即刷新**（响应式订阅注册在表达式路径，原地改子属性不触发，见 `kniutemplate.md`）。
- 表格列内开关：在 `tableOptions.cols` 中配置 `switch: { options: switchOptions, onChange }`。

## Editor（富文本编辑器）

```html
<kniu-editor
  ref="editor"
  toolbar="{{toolbar}}"
  kniu:model="{{editForm.content}}"
  name="content"
>
  <template #prepend label-width="100px">正文</template>
</kniu-editor>
```

- `kniu:model` 双向绑定到表单字段（同 kniu-input），`name` 供表单识别，`#prepend` 插槽渲染前置标签（`#append` 同理预留）。
- 内容变更派发 `input` 事件，失焦派发 `change` 事件。
- **最大化（`maximize`）时自动隐藏 `#prepend` / `#append` 修饰框**，编辑器组改为竖向撑满视口，还原后恢复显示。
- 代码模式（`code`）：在富文本视图与源码（`textarea`）视图间切换；源码视图下除 `code` / `maximize` 外工具栏全部禁用。**进入源码视图时自动美化**（`_beautifyHtml`）：块级标签换行+缩进、仅含行内内容的块闭合标签紧跟同行（如 `<li>item1</li>`）、行内标签与文本保持同行、`<pre>` 代码块内容原样保留不破坏缩进、纯空白文本相邻块级标签时丢弃（保证美化往返稳定）。切回富文本时直接以源码内容设回 innerHTML，渲染等价。
- 内置功能参考 KindEditor 设计、UI 现代化：撤销/重做、预览、打印、代码模式、最大化、加粗/斜体/下划线/删除线/上下标、对齐（左中右两端）、增减缩进、有序/无序列表、行距、H1–H3/段落、引用、代码块、分割线、表格、字体/字号/文字色/背景色、链接/取消链接、表情、清除格式、清理 HTML、全选。
- **默认工具栏顺序对齐 KindEditor 默认布局**：`code`(源码) → `undo`/`redo` → `preview`/`print`/`pre`(代码块) → 对齐组 → 列表组 → 缩进组 → 上下标 → `clearhtml`/`selectAll` → `maximize`(全屏) → `formatblock`(H1–H3/段落/引用) → `fontname`/`fontsize` → 颜色组 → 字形组(加粗/斜体/下划线/删除线/行距/清除格式) → `table`/`hr`/`emoticons` → `link`/`unlink`。映射：KindEditor `source`→`code`、`code`(插入代码)→`pre`、`fullscreen`→`maximize`；图片/flash/media/map 等需后端能力项按项目约定跳过。

### toolbar 可配置属性

工具栏可通过 `toolbar` 属性按需配置，未设置时使用默认（全部功能）。

- 取值为字符串：**以 `|` 分隔分组**（分组间自动渲染分隔线），组内以空格或逗号分隔 token。
- 也可在控制器里以数组声明（每个子数组为一组），框架会规范化为上面的字符串形式；通过 `{{toolbar}}` 绑定即可随状态动态切换。
- 可用 token（与功能一一对应）：

  | 分组 | token |
  |---|---|
  | 历史/视图 | `undo` `redo` `preview` `print` `code` `maximize` |
  | 字体样式 | `bold` `italic` `underline` `strikeThrough` `subscript` `superscript` |
  | 对齐/缩进 | `justifyLeft` `justifyCenter` `justifyRight` `justifyFull` `indent` `outdent` |
  | 列表/行距 | `insertOrderedList` `insertUnorderedList` `lineheight` |
  | 块级 | `h1` `h2` `h3` `p` `blockquote` `pre` `hr` `table` |
  | 字体/颜色 | `fontname` `fontsize` `forecolor` `hilitecolor` |
  | 插入 | `link` `unlink` `emoticons` |
  | 清理 | `removeFormat` `clearhtml` `selectAll` |

- 示例：仅保留基础排版

  ```js
  state.toolbar = 'bold italic underline | insertOrderedList insertUnorderedList | link';
  ```

  未知 token 会被忽略（不会渲染），因此可安全裁剪。

## Table

表格数据、列布局和回调全部由控制器 options 提供。旧 attribute 与 `kniu-table-col` 声明全部作废：

```html
<kniu-table ref="table" kniu:options="{{tableOptions}}"></kniu-table>
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
  cols: [
    { type: 'checkbox', width: 60, fixed: true },
    { field: 'id', label: 'ID', width: 80, fixed: true },
    { field: 'sid', label: '排序', sortable: true, editable: 'number', editMin: 0, onChange: updateSort },
    { field: 'is_show', label: '显示', switch: { options: switchOptions, onChange: updateShow } },
    { label: '操作', fixed: 'right', actions: [
      { title: '删除', type: 'danger', link: true, onClick: deleteRow }
    ] }
  ],
  onRowClick: detail => handleRowClick(detail)
};
```

`kniu:options` 键：

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
| `cols` | 列定义数组，包含字段、宽度、编辑、开关、操作等 | `[]` |

> `data` 可作 `options.data` 传入，也可单独用 `kniu:options` 整体替换时一并更新；**原地改 `options.data` 不触发刷新**，必须整体替换对象。

`cols` 列对象：

- 列标题使用 `label`，字段使用 `field`。
- `width` / `min-width` 设置列宽，`align` / `header-align` 支持 `left / center / right`。
- `fixed` 或 `fixed="left"` 固定在左侧，`fixed="right"` 固定在右侧。
- `type="checkbox"` 创建选择列（每行复选框 + 表头全选），`type="index"` 创建索引列。
- `sortable` 开启排序；可通过 `sort-method="{{sortMethod}}"` 绑定自定义排序函数（纯属性）。
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

表格通过自定义事件向外通信，优先在 options 中写 `onRowClick`、`onCurrentChange`、`onSelectionChange`、`onSortChange`；模板事件仍可作为模板引擎接口使用。

| 事件名 | `detail` 载荷 | 触发时机 |
| --- | --- | --- |
| `row-click` | `{ row, index }` | 点击某一行（点击操作列按钮、编辑单元格、选择框、Switch 时不会触发） |
| `current-change` | `{ currentRow, oldCurrentRow }` | 当前行变化（需开启 `highlight-current-row`） |
| `selection-change` | `rows: any[]` | 多选框勾选状态变化，`detail` 为当前选中行数组 |
| `sort-change` | `{ column, field, order }` | 点击排序列头触发；`order` 为 `ascending` / `descending` / `''`（空字符串表示取消排序） |

事件使用 `bubbles: true, composed: true` 派发，可穿透组件 Shadow DOM 被 `kniu@` 绑定捕获，也可被祖先节点监听。

```html
<kniu-table ref="table" kniu:options="{{tableOptions}}"></kniu-table>
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
<kniu-table ref="table" kniu:options="{{tableOptions}}"></kniu-table>
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

表格无数据时，除 `empty-text` 文案和外部 `<kniu-empty>` 外，还支持 `<template #empty>` 具名插槽直接在表格内部渲染自定义空状态：

```html
<kniu-table kniu:options="{{tableOptions}}">
  <template #empty>
    <kniu-empty kniu:options="{{({ note:'暂无文章' })}}" />
  </template>
</kniu-table>
```

插槽内容投影到表格空行 `<td>` 内的 `<slot name="empty">`，CSS 默认 flex 居中（列方向居中、间距 8px）。可放任意内容：图标、文字、按钮、`<kniu-empty>` 等。

**空状态优先级**（从高到低）：

1. `<template #empty>` 插槽存在 → 投影插槽内容
2. `empty-text=""` → 隐藏内置空行（配合外部 `<kniu-empty>`）
3. `empty-text="自定义文案"` → 显示自定义文案
4. 不设 `empty-text` → 显示默认「暂无数据」

> 注意：`<template #empty>` 与外部 `<kniu-empty>` 是两种不同方式。用 `<template #empty>` 时无需写 `empty-text=""`，因为插槽优先级高于文案。

## 空状态 Empty

当列表 / 表格无数据时，使用 `<kniu-empty>` 统一展示空状态。组件内部为 Shadow DOM，居中展示**插画（内联中性 SVG，无第三方品牌标识）+ 文案 + 投影插槽**。

```html
<!-- 典型用法：列表为空、且不在加载/报错时才显示 -->
<kniu-empty kniu:if="{{!list.length && !loading && !error}}" note="暂无数据" />

<!-- 隐藏（例如交给其它逻辑控制时） -->
<kniu-empty hidden note="暂无数据" />
```

| 属性 | 说明 | 默认值 |
| --- | --- | --- |
| `note` | 空状态文案 | `暂无数据` |
| `hidden` | 设置后 `display:none` 不显示 | — |

- `<slot>` 可投影自定义内容（插画下方区域），与 `note` 文案互补。
- `kniu:if` 守卫里的 `!loading && !error`：加载中由 `kniu:loading` 区域遮罩覆盖、报错由 `$msg` 浮层提示，二者都不应再显示「暂无数据」。

**与 `kniu-table` 配合的关键约定**：表格自身已有内置空行（`empty-text`，默认「暂无数据」）。若同页同时用 `<kniu-table>` 和 `<kniu-empty>`，务必给 `<kniu-table>` 加 `empty-text=""` 以隐藏内置空行，否则会出现两份空状态文案：

```html
<kniu-table kniu:options="{{tableOptionsWithEmpty}}">
  ...
</kniu-table>
<kniu-empty kniu:if="{{!list.length && !loading && !error}}" note="暂无数据" />
```

其中 `tableOptionsWithEmpty` 需带 `emptyText: ''` 隐藏内置空行。

## 分页 Page

列表分页由 `<kniu-page>` 组件与控制器侧的 `usePagination()` 配合完成，对接后端服务端分页接口；分页内部状态由 `usePagination()` 自动初始化。

```html
<kniu-page ref="page" kniu:options="{{pageOptions}}" />
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

**旧 attribute（`total` / `page-size` / `current-page` / `background` / `layout` / `prev-text` 等）已全部作废**，`kniu:options` 键：

| `kniu:options` 键 | 说明 | 默认值 |
| --- | --- | --- |
| `total` | 总条数（来自后端） | `0` |
| `pageSize` | 每页条数的唯一初始配置源；`usePagination` 会据此初始化并维护内部 `state.pageRows` | `10` |
| `currentPage` | 当前页码（绑定 `state.currentPage`） | `1` |
| `background` | 页码按钮是否带背景色 | `false` |
| `layout` | 分页条布局。中文支持 `总数,首页,上一页,页码,下一页,末页,条数,跳转`；英文支持不区分大小写的 `First,Prev,Page,Next,Last,Total,Rows,Jumper`。`跳转/Jumper` 显示“去 [页码] 页”，Enter 或 change 后跳转 | `total,prev,pager,next,sizes` |
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
const { usePagination } = KniuUI;
const state = reactive({ pageOptions: { pageSize: 15 } });
```

| `pageOptions.pageSize` | 下拉候选项 |
| --- | --- |
| `15` | `15 / 30 / 45 / 60 / 75 / 90` |
| `10` | `10 / 20 / 30 / 40 / 50 / 60` |
| `20` | `20 / 40 / 60 / 80 / 100 / 120` |

> 若某次外部设置了一个不在倍数序列中的 `page-size`（如代码强制 `pageSize=20` 但基数为 15），下拉会**临时**补出该值，待切回倍数后自动归位。

### 控制器对接

`usePagination(options)` 返回 `loadList / changePage / changePageSize` 三个方法，负责请求后端、写回响应式 state；上一页和下一页由分页组件转换成 `current-change`，不再提供重复的控制器函数：

```js
import KniuUI from '../core/kniuui.js';
const { usePagination } = KniuUI;

const myController = controller(function () {
    const state = reactive({
      list: [],
      loading: false,
      error: '',
      pageOptions: { pageSize: 15 }
    });

    const pager = usePagination({ state, self: this, url: '/api/daily', pageKey: 'pageOptions' });

    function changePage(event) { pager.changePage(event); }      // 由 pageOptions.onCurrentChange 调用
    function changePageSize(event) { pager.changePageSize(event); } // 由 pageOptions.onSizeChange 调用

    onMounted(() => pager.loadList(1));
    return { state, changePage, changePageSize };
});
```

要点：

- `usePagination` 请求体固定携带 `page_current`、`page_rows`(= `state.pageRows`)、`field`、`sort`；成功回写 `list / currentPage / pageTotal / total`，页码窗口由 `kniu-page` 自行计算；失败回写 `error` 并调用 `self.$msg(...)` 弹错误浮层。
- `state.pageRows` 是每页条数的**唯一数据源**，`kniu:options` 里的 `pageSize` 必须绑定它；`size-change` 由组件回写 `state.pageRows` 后自动重新拉取。
- 切换每页大小时组件会把 `currentPage` 重置为 1，再从第 1 页加载。

## 导航栏 Navbar

`<kniu-navbar>` 自带桌面横向导航与移动端菜单，不需要分别维护两套头部结构。移动端页面头部始终保留在原位，展开按钮的三横线通过旋转动画变为 `X`，关闭时再同步还原；只有头部下方的菜单面板从左侧滑入并覆盖剩余视口，关闭时向左滑出，导航项从菜单顶部开始排列。菜单内容仍完全来自现有插槽，不自动虚构搜索、语言或退出等业务入口。

```html
<kniu-navbar home="#/">
  <template #brand>
    <kniu-image kniu:options="{{({ src:'/static/logo.png' })}}" />
  </template>
  <template #append>
    <kniu-navbar-cell index="/" href="#/">首页</kniu-navbar-cell>
    <kniu-navbar-cell index="/about" href="#/about">关于我</kniu-navbar-cell>
    <kniu-sub-navbar>
      <template #title>更多</template>
      <kniu-navbar-cell index="/help" href="#/help">帮助</kniu-navbar-cell>
      <kniu-sub-navbar>
        <template #title>文档</template>
        <kniu-navbar-cell index="/docs/start" href="#/docs/start">入门</kniu-navbar-cell>
        <kniu-sub-navbar>
          <template #title>进阶</template>
          <kniu-navbar-cell index="/docs/api" href="#/docs/api">接口</kniu-navbar-cell>
        </kniu-sub-navbar>
      </kniu-sub-navbar>
    </kniu-sub-navbar>
  </template>
</kniu-navbar>
```

| 组件/属性 | 说明 |
| --- | --- |
| `kniu-navbar[brand]` | 左侧名称 |
| `kniu-navbar[home]` | 名称点击地址，默认 `#/` |
| `kniu-navbar[active]` | 当前激活路径；不设置时自动读取当前路由 |
| `kniu-navbar[type="side"]` | 纵向侧栏导航；与 `kniu-navbar-cell` 配合用于应用工作台 |
| `template #brand` | 左侧品牌内容；未设置时显示 `brand` 属性文字 |
| `template #append` | 右侧导航内容；仍兼容直接写入默认插槽 |
| `kniu-navbar-cell[index]` | 用于匹配当前路由的唯一索引 |
| `kniu-navbar-cell[href]` | 导航地址 |
| `kniu-navbar-cell[disabled]` | 禁用导航项 |
| `kniu-sub-navbar` | 可嵌套至三级的子导航容器；父级标题负责展开，点击实际的 `kniu-navbar-cell` 后才关闭移动菜单 |

## 返回顶部 Backtop

```html
<kniu-backtop right="100" bottom="100" />
```

组件固定显示并自动查找当前可滚动容器；在窄屏设备上会自动使用安全边距。`right`、`bottom` 单位均为像素。

## 日期选择器

```html
<kniu-date-picker
  ref="datePicker"
  kniu:model="{{form.create_time}}"
  kniu:options="{{datePickerOptions}}"
  name="create_time">
  <template #prepend label-width="100px">发布时间</template>
</kniu-date-picker>
```

组件配置只通过 `kniu:options` 传入。`name`、`ref`、`kniu:model`、`kniu@change` 等框架接口和模板插槽继续有效；旧的 `type`、`min`、`max`、`first-day-of-week` 等组件配置属性不再读取。

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

前台文章底部的评论留言组件，配置只通过 `kniu:options` 传入。

```html
<kniu-comment kniu:options="{{commentOptions}}" />
```

```js
state.commentOptions = {
  list: [],                          // 评论列表：{id,parentId,username,avatar,time,content,likes,liked}
  placeholder: '请输入评论...',
  submitText: '发表评论',
  emptyText: '暂无评论，快来抢沙发吧！',
  emojis: ['😀', '😄', ...],         // 可选，默认内置常用表情
  currentUser: '游客',
  onSubmit: async (detail) => { /* detail: {content, parentId} */ },
  onLike: async (detail) => { /* detail: {commentId, liked} */ }
};
```

| options 字段 | 说明 |
| --- | --- |
| `list` | 评论列表，每项含 `id`（评论ID）、`parentId`（回复的父评论ID，0 为顶层）、`username`、`avatar`（可选）、`time`、`content`、`likes`（点赞数）、`liked`（当前是否已赞） |
| `placeholder` | 输入框占位文字 |
| `submitText` | 提交按钮文字，默认“评论” |
| `emptyText` | 空态提示文字 |
| `emojis` | 表情面板内可选表情数组，默认内置 46 个常用表情 |
| `currentUser` | 当前用户昵称，提交评论时作为 `name` 传给后端 |
| `onSubmit` | 提交评论回调，`detail` 含 `content` 与 `parentId`（回复目标） |
| `onLike` | 点赞/取消点赞回调，`detail` 含 `commentId` 与 `liked` |

事件回调（`onSubmit`/`onLike`）由统一 options 协议映射为组件内部派发的 `submit`/`like` 事件，回调收到的 `detail` 即事件负载。

### 下拉面板样式统一约定

表情面板与分页下拉、日期选择器下拉使用同一套面板样式（本次已统一）：

```css
background-color: #fff;
border: 1px solid #e4e7ed;
border-radius: 4px;
box-shadow: 0 2px 12px rgba(0,0,0,.1);
```

网格型面板（表情）额外声明 `overflow-y:auto; overflow-x:hidden`，去除横向滚动条。**以后凡新增这类下拉面板，样式一律对齐此基准。**

### 组件实现要点（2026-09-01）

- 必须定义本组件自己的 `options` accessor（存储到 `_options` 并触发 `_render`），否则 `installOptionsOnlyProtocol` 因无 `ownDescriptor.set` 会退回属性反射，`_options` 恒空、渲染不出内容——对齐 kniu-switch/kniu-select/kniu-date-picker 既有模式。
- 必须把 `kniu-comment` 加入统一 options 协议组件清单，否则 `onSubmit`/`onLike` 事件回调不会绑定。
- 后端返回的 `list` 项字段为 `{id, parentId, username, avatar, time, content, likes, liked}`；前端渲染时 `commentEscape()` 转义，后端已 `decodeFields` 一次，安全且显示正确。

## 默认导出

```js
import KniuUI from './kniuui.js';

KniuUI.msg('消息');
KniuUI.confirm('确认操作？', '提示');
```
