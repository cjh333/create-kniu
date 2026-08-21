# kniuui 技术说明

`kniuui.js` 是 KniuSystem 的系统 UI 模块，负责注册通用 Web Components，并提供消息框、确认框等全局 UI API。

## 约定

- 系统 UI 自定义元素使用 `kniu-` 前缀。
- 组件内部 DOM 类名使用 `kniu_sys_` 前缀。
- 组件通过纯属性（如 `<kniu-table data="{{list}}">`、`<kniu-image src="{{cover}}">`）接收数据，业务代码不直接查找组件内部 DOM。组件自有属性不要用 `kniu:[property]` 模板属性规则。
- 组件使用 Shadow DOM 隔离内部结构与样式。
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

消息类型为 `success`、`warning`、`info`、`error`，默认 `info`。`$msg()` 会动态创建 `<kniu-msg>` 并在关闭后销毁，页面中不需要预先声明消息组件。

## 图片上传预览

```html
<kniu-upload kniu:model="{{files}}" name="cover" max-size="5" accept="image/*">选择图片</kniu-upload>
```

- 组件只负责本地选择、Blob 预览、删除和回显，不会立即上传。
- `max-size` 是单个文件大小，单位 M；默认单图，再次选择会覆盖当前图片。
- 设置 `multiple` 后才启用多图；`max-count` 表示最多数量，照片墙会自动换行。
- 模型数组可包含新 `File` 或数据库图片 URL；真正上传由表单提交统一完成。
- 图片全部删除后显示“暂无图片”占位，但空占位不会进入文件数组。

## 模态框

```html
<kniu-modal width="640px" mask="true" mask-alpha="0.6" mask-close="false" scrollbar="true" show="{{showmodal}}" kniu@close="closeDialog">
  <template #$header><span>编辑文章</span></template>
  <template #default>弹框内容（推荐使用 kniu-input-group + kniu-input 等）</template>
  <template #footer>
    <kniu-btn kniu@click="closeDialog">取 消</kniu-btn>
    <kniu-btn kniu@click="saveEdit" type="primary">保 存</kniu-btn>
  </template>
</kniu-modal>
```

> 具名插槽支持两种等价写法：`<template #header>`（推荐，模板简写语法，框架内部等同 `slot="header"`）与 `<template slot="header">`。框架会在加载视图时把这类 `<template>` 平铺为带 `slot` 属性的真实子节点，再交给 `<slot name="X">` 投影——因为 `<template>` 是 inert 元素，Web Components 的 slot 算法不会展开它，不平铺则弹框内容空白。

| 属性 | 说明 | 默认值 |
| --- | --- | --- |
| `show` | 是否显示（`true`=显示/打开，`false`=隐藏/关闭；默认隐藏） | `false` |
| `mask` | 是否启用半透明蒙版 | `true` |
| `mask-alpha` | 蒙版透明度（0~1，仅 `mask="true"` 时生效） | `0.6` |
| `mask-close` | 点击蒙版是否关闭弹框（默认**不允许**；`true` 才开启）；旧别名 `close-on-click-modal` / `modal` 仍兼容 | `false`（默认禁用） |
| `scrollbar` | 模态框开启时是否允许浏览器滚动条（`false` 时锁定 body 滚动） | `true` |
| `width` | 弹框宽度（`640px` 这种带单位的值） | `520px`（通用）/ `420px`（确认模式） |
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
<kniu-btn type="primary" size="small" round>保存</kniu-btn>
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
- `<template #prepend>` 用于在输入框前增加附加内容，`<template #append>` 用于在输入框后增加附加内容；两者都可通过 `label-width="200px"` 设置附加区域的固定宽度。
- `show-password` 仅在 `type="password"` 时生效。
- 清除和密码显示控件使用 `span[role="button"][tabindex="-1"]`，按 Tab 时会跳过，仅响应鼠标或触摸点击。
- 密码隐藏时显示闭眼图标，密码显示时显示睁眼图标。
- 支持 `name`、`placeholder`、`autocomplete`、`maxlength`、`disabled`、`readonly`、`required`。
- 提供 `focus()` 和 `select()` 方法。
- Input 中按 Enter 会触发所属表单提交。

## Form 和 InputGroup

```html
<kniu-form
  ref="form"
  model="{{form}}"
  rules="{{rules}}"
  kniu@submit.prevent="onSubmit"
  label-position="top"
  label-width="80px"
>
  <kniu-form-cell label="用户名">
    <kniu-input kniu:model="{{form.username}}"></kniu-input>
  </kniu-form-cell>
</kniu-form>
```

`label-position` 支持：

- `top`：标签位于输入框上方。
- `left`：标签位于左侧且文字左对齐。
- `right`：标签位于左侧且文字右对齐，默认值。

`kniu-input-group` 与 `kniu-form-cell` 共用同一套实现（标签 + 内容布局）。区别在于语义：**带 `label` 的表单单元统一写 `<kniu-form-cell label="用户名">`**，不带 label 的纯分组容器才用 `<kniu-input-group>`。两者的默认间距均为 `20px`，均可覆盖表单级 `label-position` 和 `label-width`。

`kniu-form` 通过 `rules="{{rules}}"`（纯属性）接收验证规则。`rules` 是一个以输入框 `name` 为键的对象：**rules 中存在的字段代表需要验证，不存在的字段不验证**。每个字段规则为 `{ condition, message }`：`condition` 可以是正则表达式或函数（函数接收 `{ value, field, input }`，返回布尔值），校验不通过时通过 `$msg` 弹出 `message` 错误提示（同时保留输入框红色边框），且阻止提交。该规则只对 `<form>` 和 `<kniu-form>` 有效，输入框无需再写 `required`。提交按钮应使用 `native-type="submit"`。

## Image

```html
<kniu-image
  style="width:100px;height:40px;"
  src="{{imageUrl}}"
  fit="{{fit}}"
  alt="验证码"
></kniu-image>
```

`fit` 支持 `fill`、`contain`、`cover`、`none`、`scale-down`。组件内置暂无图片、加载中和加载失败状态，并触发 `load`、`error` 事件。

## Switch

```html
<kniu-switch
  kniu:model="{{row.is_show}}"
  active-value="1"
  inactive-value="0"
></kniu-switch>
```

支持 `disabled`、`width`、活动/非活动图标、文字、值、颜色、`name` 和 `validate-event`，状态改变时触发 `change`，并提供 `focus()`。

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

表格数据由控制器提供，列布局在 HTML 中声明：

```html
<kniu-table 
  ref="table"
  data="{{tableData}}"
  max-height="250"
  row-key="id"
  stripe
  border
  highlight-current-row
  kniu@row-click="handleRowClick"
>
  <kniu-table-col fixed field="id" label="ID" width="150"></kniu-table-col>
  <kniu-table-col field="sid" label="排序" sortable editable edit-type="number" edit-min="0"></kniu-table-col>
  <kniu-table-col fixed="right" label="操作" width="120">
    <template #default>
      <kniu-btn link type="danger" size="small">删除</kniu-btn>
      <kniu-btn link type="primary" size="small">编辑</kniu-btn>
    </template>
  </kniu-table-col>
</kniu-table>
```

表格属性：

| 属性 | 说明 | 默认值 |
| --- | --- | --- |
| `height` / `max-height` | 固定高度或最大高度 | — |
| `stripe` | 斑马纹 | `false` |
| `border` | 纵向和外部边框 | `false` |
| `size` | `large / default / small` | `default` |
| `fit` | 列宽是否铺满容器 | `true` |
| `show-header` | 是否显示表头 | `true` |
| `highlight-current-row` | 高亮当前行 | `false` |
| `row-key` | 行数据唯一键 | — |
| `empty-text` | 无数据时表格**内置空行**的文案。不设置时默认「暂无数据」；显式写 `empty-text=""`（空串）会**隐藏**内置空行——当你改用 `<kniu-empty>` 自定义空状态时必须加它，否则内置文案与 `<kniu-empty>` 会重复出现。**优先级**：`<template #empty>` 插槽 > `empty-text` > 默认「暂无数据」 | `暂无数据` |
| `loading` | 区域加载遮罩开关（布尔）。为真时在表格 `shadowRoot` 内、`group`（定位上下文）上覆盖一层半透明遮罩（spinner + 可选文案），`pointer-events:auto` 阻断交互。遮罩由组件自管理，表重建后状态自动重放。**推荐用 `kniu:loading="{{loading}}"` 指令驱动**（指令检测到组件自带 `loading` 后委托，详见 `kniutemplate.md` §6.5）；也可控制器直接 `this.$refs.table.loading = true` | `false` |
| `loading-text` | 加载遮罩中央文案（配合 `loading`）。对应 `kniu:loading-text="{{tip}}"` 指令属性 | — |

列属性：

- 列标题使用 `label`，字段使用 `field`。
- `width` / `min-width` 设置列宽，`align` / `header-align` 支持 `left / center / right`。
- `fixed` 或 `fixed="left"` 固定在左侧，`fixed="right"` 固定在右侧。
- `type="checkbox"` 创建选择列（每行复选框 + 表头全选），`type="index"` 创建索引列。
- `sortable` 开启排序；可通过 `sort-method="{{sortMethod}}"` 绑定自定义排序函数（纯属性）。
- 数据为空时表头自动锁定：排序、全选及其他表头交互均不可操作；数据恢复后自动解锁。
- `show-overflow-tooltip` 为溢出（被省略号裁切）的单元格提供悬浮提示。仅当单元格内容实际溢出时才弹层，避免每条都提示。定位策略（自动避让）：
  - **默认在单元格正上方、水平居中对齐文字**。
  - **垂直避让**：上方空间不足时自动落到下方；若上下都放不下，则取空间更大的一侧（即「上方不够→下方、下方不够→上方」双向兜底）。
  - **水平避让**：居中后若左侧贴近视口边缘则**左对齐**（tip 左缘贴近单元格左缘）；若右侧贴近视口边缘则**右对齐**（tip 右缘贴近单元格右缘）；最终夹在视口内，保证提示框永远完整可见。
  - **指向小三角**：tip 带同色小三角指向单元格——tip 在上方时三角在 tip 底部朝下、在下方时在 tip 顶部朝上；三角水平位置跟随单元格中心（左右避让时也始终指向单元格），并夹在 tip 内部不出界。
- `editable` 开启单元格编辑；数字列可使用 `edit-min` 限制最小值。
- 操作列模板支持多个 `kniu-btn`。

### 事件

表格通过自定义事件向外通信，使用 `kniu@事件名="处理函数"` 在模板中绑定；处理函数接收浏览器原生 `CustomEvent`，通过 `event.detail` 获取载荷。

| 事件名 | `detail` 载荷 | 触发时机 |
| --- | --- | --- |
| `row-click` | `{ row, index }` | 点击某一行（点击操作列按钮、编辑单元格、选择框、Switch 时不会触发） |
| `current-change` | `{ currentRow, oldCurrentRow }` | 当前行变化（需开启 `highlight-current-row`） |
| `selection-change` | `rows: any[]` | 多选框勾选状态变化，`detail` 为当前选中行数组 |
| `sort-change` | `{ column, field, order }` | 点击排序列头触发；`order` 为 `ascending` / `descending` / `''`（空字符串表示取消排序） |

事件使用 `bubbles: true, composed: true` 派发，可穿透组件 Shadow DOM 被 `kniu@` 绑定捕获，也可被祖先节点监听。

```html
<kniu-table
  data="{{tableData}}"
  row-key="id"
  highlight-current-row
  kniu@row-click="onRowClick"
  kniu@selection-change="onSelectionChange"
  kniu@sort-change="onSortChange"
>
  ...
</kniu-table>
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
<kniu-table ref="table" data="{{tableData}}" row-key="id" highlight-current-row>
  ...
</kniu-table>
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
<kniu-table data="{{list}}" row-key="id">
  <kniu-table-col label="标题" field="title" />
  ...
  <template #empty>
    <kniu-empty note="暂无文章" />
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
<kniu-table empty-text="" data="{{list}}" row-key="id">
  ...
</kniu-table>
<kniu-empty kniu:if="{{!list.length && !loading && !error}}" note="暂无数据" />
```

## 分页 Page

列表分页由 `<kniu-page>` 组件 + 控制器侧的 `paginationState()` / `usePagination()` 配合完成，对接后端服务端分页接口。

```html
<kniu-page
  ref="page"
  background
  layout="条数,首页,上一页,页码,下一页,末页,总数"
  total="{{total}}"
  page-size="{{pageRows}}"
  current-page="{{currentPage}}"
  kniu@current-change="changePage"
  kniu@size-change="changePageSize"
/>
```

组件属性：

| 属性 | 说明 | 默认值 |
| --- | --- | --- |
| `total` | 总条数（来自后端） | `0` |
| `page-size` | 每页条数。必须绑定控制器 `state.pageRows`，**不要写死字面量**（否则与控制器取数断联、且切换每页大小无法回写） | `10` |
| `current-page` | 当前页码（绑定 `state.currentPage`） | `1` |
| `background` | 页码按钮是否带背景色 | `false` |
| `layout` | 分页条布局，逗号分隔的若干 token；中英文别名均可：`total`/`总数`、`first`/`首页`、`prev`/`上一页`、`pager`/`页码`、`next`/`下一页`、`last`/`末页`/`尾页`、`sizes`/`条数` | `total,prev,pager,next,sizes` |
| `prev-text` / `next-text` / `first-text` / `last-text` | 上/下/首/末页按钮自定义文字（覆盖 `layout` 中的中文别名） | — |

事件（均通过 `kniu@` 绑定，处理函数接收原生 `CustomEvent`，载荷在 `event.detail`）：

| 事件名 | `event.detail` | 说明 |
| --- | --- | --- |
| `current-change` | `{ page }` | 页码切换 | 
| `size-change` | `{ size }` | 每页条数切换 | 

### 每页条数下拉 = 基数的倍数

下拉框的候选项**永远等于「基数」的倍数**：`[base, 2×base, 3×base, 4×base, 5×base]`，若 5×base 仍小于 100 则追加 `100`，并去重。基数由控制器 `paginationState(n)` 的 `n` **一次性锁定**，之后用户切换每页大小只会改变当前选中的值，**不会改变基数**——即下拉序列固定为初始基数的倍数。

```js
// 控制器：paginationState(15) → 基数锁定为 15 → 下拉恒为 15/30/45/60/75/100
const { usePagination, paginationState } = KniuUI;
const state = reactive({ ...paginationState(15) });
```

| `paginationState(n)` | 下拉候选项 |
| --- | --- |
| `paginationState(15)` | `15 / 30 / 45 / 60 / 75 / 100` |
| `paginationState(10)` | `10 / 20 / 30 / 40 / 50 / 100` |
| `paginationState(20)` | `20 / 40 / 60 / 80 / 100` |

> 若某次外部设置了一个不在倍数序列中的 `page-size`（如代码强制 `pageSize=20` 但基数为 15），下拉会**临时**补出该值，待切回倍数后自动归位。

### 控制器对接

`usePagination(options)` 返回 `loadList / changePage / prevPage / nextPage / changePageSize` 五个方法，负责请求后端、写回响应式 state：

```js
import KniuUI from '../core/kniuui.js';
const { usePagination, paginationState } = KniuUI;

const myController = controller(function () {
    const state = reactive({
      list: [],
      loading: false,
      error: '',
      ...paginationState(15)   // 基准每页 15 条；state.pageRows 成为分页大小唯一数据源
    });

    const pager = usePagination({ state, self: this, url: '/api/daily' });

    function changePage(event) { pager.changePage(event); }      // 绑定 <kniu-page kniu@current-change>
    function changePageSize(event) { pager.changePageSize(event); } // 绑定 <kniu-page kniu@size-change>

    onMounted(() => pager.loadList(1));
    return { state, changePage, changePageSize };
});
```

要点：

- `usePagination` 请求体固定携带 `page_current`、`page_rows`(= `state.pageRows`)、`field`、`sort`；成功回写 `list / currentPage / pageTotal / total / pageList`，失败回写 `error` 并调用 `self.$msg(...)` 弹错误浮层。
- `state.pageRows` 是每页条数的**唯一数据源**，`<kniu-page page-size="{{pageRows}}">` 必须绑定它；`size-change` 由组件回写 `state.pageRows` 后自动重新拉取。
- 切换每页大小时组件会把 `currentPage` 重置为 1，再从第 1 页加载。

## 默认导出

```js
import KniuUI from './kniuui.js';

KniuUI.msg('消息');
KniuUI.confirm('确认操作？', '提示');
```
