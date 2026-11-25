# Kniu UI 组件使用说明

本文对应 `client/core/Kniu-Ui/` 当前实现。组件由 `client/core/Kniu-Components.mjs` 按模板实际出现的标签自动注册；业务页面不需要 import 组件、维护清单或手工加载 CSS。第 10 节按组件逐一提供 HTML、控制器示例和属性用途；示例中的接口地址和业务数据需要由项目自行替换。

## 1. 统一规则

### 组件注册的 dev/dist 一致性（完整 runtime 必须先于 modular registry）

`Kniu-Components.mjs` 的 `componentContext.createTable` 是**故意的 throw 兜底**（`[kniu] Complete UI runtime must register Kniu-Table before the modular registry.`），设计前提是完整 runtime 先用真实 `createTable` 注册 `kniu-table`。两条注册路径必须保持：

- **组件注册路径**（`load()`/`preload()` 里的 `(await import('./Kniu-Ui/Kniu-Ui.mjs')).default`）：**必须导入完整 `Kniu-Ui.mjs`**，其模块顶层 `registerTable(KNIU_COMPONENT_CONTEXT)` 用真实 createTable 先注册；`registerTable` 内的 `customElements.get('kniu-table')` 去重守卫让后续 modular 注册自动跳过。
- **主包 API 路径**（`use()`/`UI.confirm()` 里的 `const { default: ui } = await import(...)`）：dist 构建替换为精简版 `Kniu-UiEssential.mjs`（无 createTable），避免完整 runtime 进入主包。

🔴 构建器 `Kniu-BuildClient.mjs:transformBrowserModule` 只替换**主包 API 路径**那 2 处解构式 import，**不得**连同注册路径的 `(await import(...)).default` 一起替换——否则 dist 的完整 Ui 被排除构建图，`register('kniu-table')` 只能用 throw 兜底，`_renderTable` 必崩（dev 因直接导入完整 Ui 而正常，属典型 dev/dist parity 陷阱，规则 182）。回归：`test/check_table_register_gate.mjs`（14/14，含反向）+ `test/probe_table_register_cdp.mjs`（dev/dist 双环境）。

### 基础工具类（碎片化类）

`Kniu-Base.css` 提供完整的碎片化工具类（规则 171），全部以 `kniu_` 前缀。文件内按功能顺序分成 10 段，新增/查找类时按此顺序对号入座：

1. 显示 / 可见性：`kniu_block`、`kniu_inline`、`kniu_inline_block`、`kniu_inline_flex`、`kniu_flex`、`kniu_grid`、`kniu_hidden`、`kniu_contents`、`kniu_invisible`、`kniu_visible`、`kniu_opacity_0/1`、`kniu_float_right`、`kniu_clear_float`
2. Flex / Grid：`kniu_flex_wrap`、`kniu_flex_col`、`kniu_flex_row*`、`kniu_flex_nowrap`、组合类 `kniu_flex_betweencenter`/`centercenter`/`rightcenter`/`leftcenter`、`kniu_items_*`、`kniu_justify_*`、`kniu_self_*`、`kniu_flex_1`/`grow`/`shrink_0`/`none`、`kniu_order_first/last`、`kniu_min_w_0`
3. 间距 gap：`kniu_gap_0~100`、`kniu_gap_x_*`（column-gap）、`kniu_gap_y_*`（row-gap）
4. 定位与层叠：`kniu_static/relative/absolute/fixed/sticky`、`kniu_inset_0`/`top_0`/`right_0`/`bottom_0`/`left_0`、`kniu_z_0~1000`
5. 尺寸：`kniu_w_*`、`kniu_h_*`、`kniu_min_w_*`、`kniu_min_h_0`、`kniu_max_w_*`、`kniu_max_h_full`、`kniu_w_auto`、`kniu_h_auto`、`kniu_h_full`
6. 间距 margin / padding：`kniu_m_*`/`mx`/`my`/`mt`/`mr`/`mb`/`ml_*`、`kniu_p_*`/`px`/`py`/`pt`/`pr`/`pb`/`pl_*`
7. 文本：`kniu_text_left/center/right/justify`、`kniu_text_nowrap`/`ellipsis`/`break_all`、`kniu_font_10~24`、`kniu_font_weight_400~700`、`kniu_line_height_1`、`kniu_italic`/`not_italic`
8. 颜色 / 背景：`kniu_color_primary/text/info/disabled/success/warning/danger/white/inherit`、`kniu_bg_surface/fill/fill_dark/primary/primary_light/transparent`
9. 边框 / 圆角：`kniu_border`、`kniu_border_t/r/b/l/none/transparent`、`kniu_radius`/`_0`/`_4`/`_50`、`kniu_outline_none`
10. 溢出 / 交互：`kniu_overflow_hidden/visible/scroll/x_auto/y_auto/x_hidden/y_hidden`、`kniu_pointer`/`not_allowed`、`kniu_pe_none`/`auto`、`kniu_select_text`/`none`

```html
<div class="kniu_flex kniu_flex_wrap kniu_items_center kniu_gap_10">内容</div>
<div class="kniu_grid kniu_gap_20">表单内容</div>
<div class="kniu_flex kniu_items_center kniu_justify_between kniu_px_20 kniu_py_10">工具栏</div>
```

**缩放单位**：`kniu_gap_*`、`kniu_m*_*`、`kniu_p*_*`、`kniu_w_*`、`kniu_h_*` 用 `--kniu_vw` 响应式缩放（数值以 `Kniu-Base.css` 为准，档位 0/1/2/3/4/5/10/15/20/25/30/35/40/45/50/55/60/65/70/75/80/85/90/95/100）；`kniu_font_*`、`kniu_radius_4` 用固定像素；颜色类走主题变量。**页面里需要固定像素（如 `margin-left:120px`）或自定义色（如 `#667eea`）时仍写页面样式，不要硬套缩放类。**

**层叠顺序**：Base.css 经 `global-base` 前置镜像进视图 shadowRoot，视图 `<style scoped>` 后注入。同特异性下视图 scoped 规则会覆盖碎片类——因此把视图规则迁移为碎片类时必须"删原声明 + 元素加碎片类"两处同时改，不能只加类。现有 `kniu_flex_centercenter` 等组合类仍可使用。

组件支持静态属性、:option 对象和控制器赋值。推荐使用 :option，因为对象可以包含数组、函数和动态值：

    <kniu-btn :option="{{type:'primary',disabled:(saving),nativeType:'submit'}}">保存</kniu-btn>
    <kniu-input :form="{{form.title}}" :option="{{name:'title',placeholder:'请输入标题'}}" />

    export default setup(({ reactive }) => {
      const state = reactive({ saving: false, form: { title: '' } });
      function save(event) { event?.preventDefault?.(); state.saving = true; }
      return { state, save };
    });

事件可用 `@click`、`@change`、`@submit.prevent` 绑定；组件选项中的 `onXxx` 回调只在相应组件实现支持时使用，新增回调统一接收**单个具名对象**（存量 `onCurrentChange`/`onSizeChange` 也是对象），不要同时绑定同一事件以免重复执行。输入组件用 `:form` 做双向绑定。第 10 节标出各组件实际事件和属性，回调清单见下文「组件回调」。

### 表单布局

Kniu-Form 包住 kniu-form-cell，输入组件放在 cell 中；标签放 slot="prepend"，右侧操作放 slot="append"。提交按钮必须设置 nativeType:'submit'。

    <kniu-form :option="{{...(form)}}" @submit.prevent="submit">
      <kniu-form-cell>
        <kniu-input :form="{{form.title}}" :option="{{name:'title',required:true}}">
          <span slot="prepend" label-width="90px">标题</span>
        </kniu-input>
      </kniu-form-cell>
      <kniu-form-cell><kniu-btn :option="{{type:'primary',nativeType:'submit'}}">提交</kniu-btn></kniu-form-cell>
    </kniu-form>

Kniu-Form 的 options 直接传字段对象，可额外设置 `labelWidth`、`labelPosition`；字段规则使用 `{value, condition, message}`。控制器应在 submit 中设置 loading，并在 finally 恢复状态；不要把请求直接写进模板表达式。完整的真实写法见第 10 节。

### 组件回调（可选扩展点）

组件存在需要通知外部的时机时，可经 `:option` 传入 `onXxx` 回调（对应 `代码规则.md` §3.8）。约定如下：

- 回调只在 `options` 里定义一处，组件**每次触发时现读**当前 options，禁止再用 `refs.xxx.onChange = ...` 后置赋值覆盖；局部重绑后旧引用不会被持有。
- 未提供回调时组件行为不变；一次交互只触发一次，程序化赋值造成的同值重复触发会去重。
- 回调只说明「发生了什么」，状态更新、发请求一律回到控制器；不要在模板表达式里写业务逻辑。
- 回调抛错由框架隔离并经 `kniu:runtime-error` 上报，不会中断组件渲染，也不会被静默吞掉。

| 组件 | 回调 | 参数（单个具名对象） | 触发时机 |
| --- | --- | --- | --- |
| `kniu-input` | `onChange` / `onClear` | `{ value }` / `{ value: '' }` | 输入值变化 / 点击清空按钮 |
| `kniu-select` | `onChange` | `{ value }` | 下拉项选中 |
| `kniu-radio-group` | `onChange` | `{ value }` | 单选项变化 |
| `kniu-switch` | `onChange` | `{ value }` | 开关切换 |
| `kniu-modal` | `onConfirm` / `onCancel` / `onClose` | `{ confirmed }` / `{ confirmed }` / `{ reason }` | 确认 / 取消 / 关闭 |
| `kniu-form` | `onSubmit` | `{ values, valid }` | 表单提交且校验完成后 |
| `kniu-upload` | `onChange` / `onRemove` / `onExceed` | `{ files }` / `{ file, files }` / `{ files, maxCount }` | 文件列表变化 / 移除文件 / 超出数量限制 |
| `kniu-date-picker` | `onChange` | `{ value, kind }` | 选定日期或时间；`kind` 为 `date`、`start-change`、`end-change` |
| `kniu-page` | `onCurrentChange` / `onSizeChange` | `{ page }` / `{ size }` | 页码 / 每页条数变化 |
| `kniu-editor` | `onChange` | `{ value }` | 编辑内容变化（同值重复派发已去重） |

视图示例（回调写在 `:option` 中，控制器函数用 `(fn)` 引用）：

```html
<kniu-input :option="{{name:'keyword',onChange:(onKeywordChange),onClear:(onKeywordClear)}}" />
<kniu-select :option="{{name:'status',onChange:(onStatusChange)}}">
  <kniu-option value="0" label="待审核" /><kniu-option value="1" label="已通过" />
</kniu-select>
<kniu-form :option="{{...(form)}}" @submit.prevent="submit">…</kniu-form>
<kniu-modal :option="{{show:(dialog.show),onConfirm:(confirmDialog),onClose:(closeDialog)}}">…</kniu-modal>
```

```js
export default setup(({ reactive }) => {
  const state = reactive({
    keyword: '',
    dialog: { show: false },
    form: { status: '', onSubmit: onFormSubmit }
  });
  function onKeywordChange({ value }) { state.keyword = value; }
  function onKeywordClear() { state.keyword = ''; }
  function onStatusChange({ value }) { state.form.status = value; }
  function onFormSubmit({ values, valid }) { if (valid) state.form.lastSubmit = values; }
  function confirmDialog() { state.dialog.show = false; }
  function closeDialog() { state.dialog.show = false; }
  function submit() { return state.form; }
  return { state, submit, onKeywordChange, onKeywordClear, onStatusChange,
    onFormSubmit, confirmDialog, closeDialog };
});
```

`kniu-form` 会把除 `labelWidth`/`labelPosition`/`onSubmit` 之外的 options 键当作表单字段，因此回调名不要自定义成其它 `onXxx`，否则会被计入 `values`。

## 2. 基础组件

### Kniu-Btn / Kniu-BtnGroup

按钮文字写在标签中。选项：type=default|primary|success|warning|danger|info、size=large|default|small、nativeType=button|submit|reset、disabled、loading、link、block、text、round、circle、dark、icon、loadingIcon、color、tag、autoInsertSpace、ariaLabel。loading 会阻止点击并设置 aria-busy。group 只负责横向组合。特殊按钮统一用 nativeType 声明：`nativeType:'submit'` 且绑定 `@click` 时，由框架在处理期间锁定所在模态框/Kniu-Form（处理函数返回 Promise）；不绑 `@click` 时在 Kniu-Form 内走原生提交（先校验再触发 `@submit`）。`nativeType:'reset'` 点击即重置：优先恢复所在 Kniu-Form 的模型默认值，无 Kniu-Form 时退回原生 form.reset()。

### Kniu-Icon / Kniu-Tag / Kniu-Badge / Kniu-Status

Kniu-Icon 使用 icon（如 search、loading、close、edit、picture、view）；大小和颜色使用 CSS，loading 图标自动旋转，交互放在外层 button。

Kniu-Tag 使用 type、size、effect、round、closable、disabled，关闭使用 onClose 回调。

Kniu-Badge 使用 value、max、isDot、hidden、unstyled，内容是被标记主体。

Kniu-Status 使用 type、size，状态文案写在标签中。

    <kniu-badge :option="{{value:(unread),max:99}}"><kniu-icon icon="bell" /></kniu-badge>
    <kniu-tag :option="{{type:'success',closable:true,onClose:(removeTag)}}">已发布</kniu-tag>
    <kniu-status :option="{{type:(online?'success':'danger')}}">在线</kniu-status>

### Kniu-Image / Kniu-Empty / Kniu-Loading / Kniu-Backtop

Kniu-Image：src、alt、fit=fill|contain|cover|none|scale-down。加载成功或失败分别派发 load、error。建议给图片或容器明确宽高；目前没有内置 lazy、fallback 和预览配置。

Kniu-Empty：note 设置文案，默认 slot 可放操作按钮；插图为内置图形。

Kniu-Loading：`show`、`text`，以及 `contained` 属性（容器内遮罩，`position:absolute` 覆盖最近定位祖先，缺省为整页 `position:fixed`）。遮罩为纯白（`#ffffff`，2026-11-03 用户定案，原半透明磨砂已移除），淡入淡出：整页模式 .4s、容器内模式 .28s，出现与消失均为 opacity 渐变过渡（路由加载遮罩的隐藏时机见 Kniu-Router.md）。

Kniu-Backtop：right、bottom（像素），自动监听页面/最近滚动容器。

## 3. 输入、选择、日期

### Kniu-Input / kniu-input-group / kniu-form-cell

Kniu-Input 支持 type=text|password|textarea|number，以及 name、value、placeholder、maxlength、minlength、rows、disabled、readonly、required、autofocus、clearable、showPassword、prefix、suffix、size、labelWidth、tip、error。textarea 用 rows，密码框用 showPassword；:form 是推荐入口。prepend/append 用 slot。

    <kniu-input :form="{{form.keyword}}" :option="{{name:'keyword',clearable:true}}" @keydown.enter="search" />
    <kniu-input :form="{{form.summary}}" :option="{{name:'summary',type:'textarea',rows:6,maxlength:500}}" />

kniu-input-group 用于包裹多个输入；kniu-form-cell 负责一行布局。

### Kniu-Select / kniu-option

select 选项：name、value、placeholder、disabled、required、size；option 使用 value、label、disabled。change.detail 为选中 value。当前实现没有 clearable、filterable。

    <kniu-select :form="{{form.status}}" :option="{{name:'status',placeholder:'请选择'}}">
      <kniu-option value="0" label="待审核" /><kniu-option value="1" label="已通过" />
    </kniu-select>

### Kniu-RadioGroup / kniu-radio / Kniu-Switch

radio-group 使用 name、value、disabled、size；radio 使用 value、label、disabled、size。group 负责互斥和 change。

switch 使用 value、checked、disabled、activeText、inactiveText、activeColor、inactiveColor、size；change.detail 是布尔值，服务端 0/1 请显式转换。

switch 的 `width` 为数字时设置开关本体的像素宽度；使用 `100%`、`200px` 等 CSS 宽度字符串时设置整个组件的宽度。

    <kniu-radio-group :form="{{audit}}" @change="filter"><kniu-radio :option="{{value:'0'}}">待审核</kniu-radio><kniu-radio :option="{{value:'1'}}">已通过</kniu-radio></kniu-radio-group>
    <kniu-switch :form="{{enabled}}" :option="{{activeText:'启用',inactiveText:'停用'}}" @change="toggle" />

### Kniu-DatePicker

选项：type=date|datetime|time、range、rangeSeparator、displaySeparator、format、value、name、placeholder、lang=cn|en、disabled、readonly、required、min、max、weekStart、mark。单值是格式化字符串，range 是 [start,end]。实例有 open()、close()、focus()。

    <kniu-date-picker ref="picker" :form="{{form.createTime}}" :option="{{type:'datetime',format:'yyyy-mm-dd hh:mm:ss',name:'create_time'}}" />
    <kniu-date-picker :option="{{range:true,format:'yyyy-mm-dd',rangeSeparator:' 至 '}}" />

## 4. 导航、标签页与分页

### Kniu-Navbar 系列

Kniu-Navbar：brand、home、active、type、open、fixed=top|bottom、placeholder。

Kniu-NavbarCell：route、href、active、disabled、side、level；应用内优先 route，外链才用 href。Kniu-NavbarCells 是布局容器，Kniu-SubNavbar 是二级导航。

    <kniu-navbar :option="{{fixed:'top',brand:(logo)}}"><kniu-navbar-cells><kniu-navbar-cell :option="{{route:'/'}}">首页</kniu-navbar-cell><kniu-navbar-cell :if="{{loggedIn}}" :option="{{route:'/article'}}">写文章</kniu-navbar-cell></kniu-navbar-cells></kniu-navbar>

### Kniu-Tab 系列

`kniu-tab` 的直接子元素使用 `kniu-tab-panel`；也可使用独立的 `kniu-tab-head` 与 `kniu-tab-body`，通过 `for` 和 `id` 关联。选项与完整示例见第 10 节。

    <kniu-tab :option="{{active:(activeTab)}}" @change="changeTab"><kniu-tab-panel name="basic" label="基本信息">基本资料</kniu-tab-panel><kniu-tab-panel name="log" label="日志">操作记录</kniu-tab-panel></kniu-tab>

### Kniu-Page / Kniu-PageMore

Kniu-Page：currentPage、pageSize、total、sizes、layout、background、firstText、prevText、nextText、lastText、onCurrentChange、onSizeChange，用于页码分页。

Kniu-PageMore：count、loading、disabled、visible、text、loadingText、noMore、block、onChange，用于加载更多；点击调用 onChange({count})。

表单的 `@submit` 异步处理期间会锁定对应 `Kniu-Form`，处理完成或抛错后恢复。模态框底部的外置保存按钮在 `:option` 写 `nativeType:'submit'`（配合 `@click`），由框架锁定所在模态框；处理函数需要返回表示提交完成的 Promise。

分页 change 的控制器流程应是“读取新页码 → 更新 page → 请求 → 写回 data/total → 处理 loading/错误”。如果接口分页从 0 开始，在控制器转换，不要让组件接收 0。

## 5. 弹层、消息、用户反馈

### Kniu-Modal / Kniu-Msg

modal：show、title、message、type、width、height、mask、maskAlpha、maskBlur、maskClose、scrollbar、showClose、closeBtn、minmax、confirmText、cancelText。正文写默认 slot；使用 onConfirm/onCancel/onClose 回调并把 show 设 false。show 必须是布尔值，不要写字符串 false。

    <kniu-modal :option="{{show:(dialog.show),title:'编辑',minmax:true,maskClose:false,onClose:(closeDialog)}}"><kniu-form>...</kniu-form></kniu-modal>

消息建议在控制器使用 `UI.msg({content:'已更新',type:'success',duration:2000,position:'top'})`。`type` 可为 success/info/warning/error；`position` 可为 top/right/bottom/left/center，默认 center。组件的 `:option` 也可设置 position；不要在每次渲染创建 msg 实例。

表单交互纪律（2026-11-24 用户裁决）：只要触发表单提交/新增/编辑/保存/登录/注册/反馈/评论/SQL 执行，就必须给用户可见反馈——成功提示后端 `msg`（无 msg 时用语义化兜底文案），失败与校验不通过提示 `error`，网络异常 `catch` 后也要提示；`actions.post` 失败已自动提示，不要重复弹窗。弹框内保存优先按「更新行 → 关闭 → 提示 msg」顺序。非表单的开关、排序、点赞、删除等不套用此规则，避免提示噪音。闸门 `test/check_form_feedback_gate.mjs` 固化 19 条表单路径。

### Kniu-UserLogin

组件从 identity service 显示当前用户；菜单由默认插槽中的 `Kniu-UserLoginCell` 声明，可自由增减。菜单项通过 `route` 跳转，可用 `target:'_blank'` 在新标签页打开；退出等操作由项目绑定点击事件。

    <kniu-user-login>
      <template #default>
        <kniu-user-login-cell :option="{{route:(profileRoute)}}">个人中心</kniu-user-login-cell>
        <kniu-user-login-cell :option="{{route:'/admin/dashboard',target:'_blank'}}">后台管理</kniu-user-login-cell>
        <kniu-user-login-cell @click="logoutUser">退出</kniu-user-login-cell>
      </template>
    </kniu-user-login>

## 6. 上传、编辑器和业务组件

### Kniu-Upload

选项：accept、multiple、maxCount、maxSize（MB）、disabled、note。value/files 始终是 File[]；input/change.detail 返回文件数组，remove.detail 返回被删文件，超限触发 exceed.detail={files,maxCount}。组件只选文件，不自动上传，控制器需自行构造 FormData。

    <kniu-upload ref="upload" :form="{{files}}" :option="{{multiple:true,maxCount:3,maxSize:5,accept:'image/*'}}">选择图片</kniu-upload>

服务端上传示例：先监听 change，使用 event.detail 里的 File 构造 FormData，再调用 request；上传成功后再保存返回 URL。清空可调用 ref 实例的 clear()，删除单项可调用 removeAt(index)。

### Kniu-Editor

编辑器是一个 Shadow DOM 组件，支持富文本和 Markdown 两种完全不同的编辑模型。最重要的选项如下：

| 选项/属性 | 类型 | 说明 |
| --- | --- | --- |
| type | rich/markdown | rich 返回 HTML；markdown 返回 Markdown 源文。默认 rich。运行中可通过实例的 type/setType 切换。 |
| name | string | 内部表单字段名，配合 Kniu-Form 使用。 |
| placeholder | string | 编辑区为空时显示的提示。 |
| readonly | boolean | 只读：仍可聚焦和复制，但不能编辑、插入资源或操作工具栏。 |
| disabled | boolean | 禁用编辑器及源代码区；通常用于提交中。 |
| toolbar | string 或 string[] | 自定义工具栏。字符串用空格/逗号分隔，竖线分组；数组可用 "|" 分组。 |
| maxHeight | number | 内容区最大高度（px），小于 200 会按 200 处理；最大化时暂时取消限制。 |
| height | string 或 number | 内容区高度，如 `600px` 或 `600`；支持 CSS 高度值，设置 maxHeight 时同时受其限制，最大化时暂时取消。 |

#### HTML 布局与双向绑定

编辑器通常直接放在 kniu-form-cell 中。:form 绑定的字段必须是字符串：rich 模式是 HTML，markdown 模式是 Markdown。初始值从控制器传入，用户输入会派发 input，编辑完成/失焦会派发 change；控制器不要读取 Shadow DOM 内部的 contenteditable 节点。

    <kniu-form-cell>
      <kniu-editor
        ref="editor"
        :form="{{article.content}}"
        :option="{{name:'content',type:'markdown',placeholder:'请输入正文',maxHeight:(editorMaxHeight),toolbar:(editorToolbar)}}"
        @input="onEditorInput"
        @change="onEditorChange">
        <span slot="prepend" label-width="90px">正文</span>
      </kniu-editor>
    </kniu-form-cell>

也可以不使用 :form，直接通过 ref 读写 editor.value：

    const editor = document.querySelector('kniu-editor');
    editor.value = '# 标题';
    const source = editor.value;
    editor.focus();

#### rich 富文本模式

rich 是默认模式，value 是经过组件清洗后的 HTML。工具栏支持撤销/重做、打印、代码模式、最大化、加粗、斜体、下划线、删除线、上下标、对齐、缩进、有序/无序列表、行距、字距、标题、段落、引用、代码块、行内代码、分割线、表格、字体、字号、文字色、背景色、链接、图片、音视频、取消链接、表情、清除格式、清理 HTML 和全选。

插入图片时可选择云端 URL 或本地图片文件（jpeg/png/gif/webp）；插入视频时支持 mp4/webm/ogg/quicktime，音频使用对应音频格式。组件只负责把本地文件转换为编辑内容，不会替业务上传到服务器；需要持久化时，控制器应拦截/改写资源 URL 或先上传再写入 URL。点击已有图片、视频或音频，或右键媒体，可编辑 URL、媒体名、宽高、等比锁定，也可删除。

#### markdown 模式

markdown 模式编辑的是原始 Markdown 文本，工具栏会自动切换为 Markdown 工具：撤销/重做、粗体、斜体、删除线、行内代码、标题、引用、代码块、无序/有序列表、链接、图片、分割线、表格、预览、最大化。预览由项目 Markdown 渲染器生成；预览开关和“同步滚动”只影响编辑体验，不会改变 value。

Markdown 工具栏 token 与 rich 模式不同，不能把 insertOrderedList、forecolor 等富文本 token 混用。Markdown 的插入行为大致是：粗体使用 **文本**、斜体使用 *文本*、引用使用 >、代码块使用围栏、链接使用 [文字](URL)、图片使用 ![名称](URL)。

#### 行号列

rich 与 markdown 两种模式都在编辑区左侧渲染行号列（宽 48px，`overflow:hidden`）。行号由内容行数与可视区高度共同决定：内容不足一屏时按可视高度补足序号，补足数量按 `floor((clientHeight - 上下内边距) / 行高)` 向下取整——若用 `ceil` 会多补一行，其底边越过行号列可用高度被裁成半个数字（空内容时最末一位只剩上半截）。滚动时行号整列 `translateY(-scrollTop)` 跟随，超出可视区的序号随滚动进入视图，与文本行的裁切一致。

#### toolbar 自定义

不传 toolbar 使用默认工具栏。字符串使用空格或逗号分隔，使用 | 插入分组分隔线；数组中的 "|" 也会分组。无效 token 会被忽略。以下别名会自动转换：fontName→fontname、fontSize→fontsize、foreColor→forecolor、hiliteColor→hilitecolor、clear→clearhtml、fullscreen→maximize。

    <kniu-editor :option="{{type:'rich',toolbar:'undo redo | bold italic | heading link image maximize'}}" />
    <kniu-editor :option="{{type:'markdown',toolbar:['undo','redo','heading','bold','link','image','|','preview','maximize']}}" />

rich 可用 token：undo、redo、print、code、maximize、bold、italic、underline、strikeThrough、subscript、superscript、justifyLeft、justifyCenter、justifyRight、justifyFull、indent、outdent、insertOrderedList、insertUnorderedList、lineheight、spacing、heading、h1-h6、p、blockquote、pre、inlineCode、hr、table、fontname、fontsize、forecolor、hilitecolor、link、image、media、unlink、emoticons、removeFormat、clearhtml、selectAll。

markdown 可用 token：undo、redo、bold、italic、strike、inlineCode、heading、quote、code、ul、ol、link、image、hr、table、preview、maximize。

#### 实例属性和方法

| API | 用途 |
| --- | --- |
| value | 读写当前 HTML 或 Markdown；rich 写入时会清理危险标签，markdown 会统一换行。 |
| type / setType(type) | 读取或切换 rich/markdown。切换会重建工具栏并派发 input，切换前应先保存当前 value。 |
| toolbar | 读写工具栏配置；写数组会转换为内部属性。 |
| maxHeight | 读写内容区最大高度。 |
| focus() | 聚焦当前编辑区；源码/Markdown 模式聚焦 textarea。 |

#### 控制器示例

    export default setup(({ reactive, onMounted }) => {
      const state = reactive({
        article: { content: '' },
        editorType: 'markdown',
        editorToolbar: ['undo', 'redo', '|', 'heading', 'bold', 'italic', 'link', 'image', '|', 'preview', 'maximize'],
        editorMaxHeight: 560,
        saving: false
      });

      function onEditorInput(event) {
        const value = event?.detail ?? state.article.content;
        console.debug('editor input length:', String(value || '').length);
      }
      function onEditorChange() { /* 可在失焦后做草稿保存 */ }
      function toggleMode() {
        const el = document.querySelector('kniu-editor');
        const oldValue = el?.value || '';
        el?.setType(state.editorType === 'markdown' ? 'rich' : 'markdown');
        if (el && !el.value) el.value = oldValue;
        state.editorType = state.editorType === 'markdown' ? 'rich' : 'markdown';
      }
      onMounted(() => { /* 可在此读取接口并写入 state.article.content */ });
      return { state, onEditorInput, onEditorChange, toggleMode };
    });

提交时不要把 markdown 当 HTML 直接输出。rich 内容和 Markdown 内容都必须在服务端再次校验/清洗；文章展示应按 content_mode 选择 Markdown 渲染器或富文本 sanitizer。readonly/disabled 状态只负责前端交互控制，权限校验仍必须在服务端完成。

### Kniu-Like / Kniu-Comment / Kniu-ArticleTab

like：count、liked、disabled、loading、own、feedback；change.detail 至少有 liked，控制器请求接口后回写 count/liked/loading。

comment：list、maxLength、submitText、emptyText、currentUser、currentUserId、placeholder、filter、canSubmit，以及 onSubmit/onLike/onDelete/onUser。事件 detail 分别是评论内容/父级、评论点赞、评论 id、用户 id。控制器负责鉴权、提交和刷新列表。

article-tab：previous、next（通常含 id/title）、previousLabel、nextLabel；change.detail 含 id/direction，控制器据此导航。

comment.list 的每项建议包含 id、message、nickname、userId、likes、liked、children/replies；currentUserId 用于判断“自己的评论”，canSubmit=false 时只读。onSubmit 回调收到 content 和 parentId，成功后应重新拉取 list；onLike/onDelete 必须以服务端结果回写 likes/liked，避免只改本地造成刷新后闪回。

## 7. 表格

Kniu-Table 用子级 Kniu-TableCol 声明列。table options：data、rowKey、height、maxHeight、border、stripe、size、loading、loadingText、highlightCurrentRow、selectable、onSortChange、onSelectionChange。表格无数据时不要挂载 `Kniu-Table`，直接使用 `Kniu-Empty`；组件不再提供 `emptyText` 或空数据插槽。列 options：field、label、width、minWidth、align、fixed、type=checkbox|index、sortable、editable、showOverflowTooltip、formatter、onChange。

    <kniu-table ref="table" :option="{{...(tableState)}}">
      <kniu-table-col :option="{{type:'checkbox',width:60,fixed:'left'}}" />
      <kniu-table-col :option="{{field:'title',label:'标题',minWidth:280,showOverflowTooltip:true}}" />
      <kniu-table-col :option="{{field:'operation',label:'操作',width:160,fixed:'right'}}"><kniu-btn :option="{{type:'primary',size:'small',link:true}}" @click="editRow">修改</kniu-btn></kniu-table-col>
    </kniu-table>

列插槽可使用 scope.row、scope.$index。ref 实例提供 clearSelection()、getSelectionRows()、toggleRowSelection(row, selected)、setCurrentRow(row)、sort(field, order)、clearSort()、doLayout()。更新数据时赋新对象：state.tableState = {...state.tableState, data: rows}。

后台列表页的高度约束（2026-11-18 修复后定案）：`.admin_content_body` 下的 `<kniu-table>` 必须用 `<div class="detail_wrap">` 包裹（`kniu-page` 一并放入），由 `admin_detail.css` 的 `.detail_wrap>kniu-table{flex:1;min-height:0}` 提供高度上限。不要只依赖组件 `maxHeight`：未传时 viewport 无固定高度，`overflow:auto` 不产生滚动条，横向滚动条落在表格末端会被 `.kniu_web_aside_view:has(.index_cells){overflow:hidden}` 裁掉，表现为「表格底部被遮挡、无法左右滚动」。修复前反例为 `admin/daily/ListPage.html` 与 `admin/table/ListPage.html`。

编辑器高度自适应可视区（2026-11-18 三次修订定案，`client/controller/index/EditorAutoHeightShared.js`）：

- **高度载体必须是 `.kniu_sys_editor_split`**，不是 `.kniu_sys_editor_content_wrap`。编辑器处于 Markdown/源码模式时 `content_wrap` 被 `display:none`（实测高度恒为 0），真正可见的是 `.kniu_sys_editor_source_wrap`；`split` 是两者共同父容器，也正是组件 `_applyMaxHeight()` 设置高度的那一层。旧实现按 `content_wrap` 判可见性，永远判定「不可测」直接退出，`maxHeight` 恒为 null。
- **必须落「固定高度」，只设 `maxHeight` 无效**：`max-height` 只在内容超高时才生效，内容短时 `split` 仍回落自然高度（实测短内容 `split` 692 而 `maxHeight` 739，页面底部留白 100px+）。落地方式为同时写 `editor.height = target+'px'` 与 `editor.maxHeight = target`，并在 `split` 实际高与目标差 >1（`drifted`）时无条件重写。
- **模板禁写 `height:'100%'`**：`:option` 回写会调用 `height` setter，`_applyMaxHeight()` 里 `split.style.height = height || max+'px'` 优先取 `100%`，把 `split` 拉回内容高度，`maxHeight` 形同虚设。`admin/help/EditPage.html` 已删除该选项。
- **填充边界取「最近的裁剪容器或有背景的卡片」的内容盒**：不能取布局底（`.kniu_web_aside_view` 底 941 比白卡内容底 926.7 靠下约 15px，按它算提交按钮会被顶出白卡）；也不能取 `overflow:visible` 且无背景的祖先（`kniu-form` / `kniu-form-cell` 高度随内容变化，会自我反馈把目标一路压到 `MIN_HEIGHT`=220）。边界余量按「编辑器顶 → 容器底」判，不能按当前编辑器底判（撑高后余量自然变小，会误判「没空间」而退回更外层）。
- **目标高度一次反推，不做加减迭代**：`target = min(容器内容底, innerHeight) − 编辑器顶 − chrome − below − 2`。`chrome`=编辑器高 − split 高（工具栏/状态栏/边框）、`below`=编辑器之后同级内容的实际底。三项都与内容区高度无关，因此结果与当前值无关，天然不振荡。
- **不得用 `wrap.style.maxHeight` 当「当前高度」基准**：模板写过 `height:'100%'` 时组件会主动清空 wrap 的 maxHeight，基准会是 0 或自然高度，`cur − excess` 必然算偏（旧实现 dev 607 / dist 593 不一致即此因）。
- **位置变化必须靠 DOM 变更复测**：兄弟单元格重渲染会把编辑器顶边平移（实测 ±25px），而 `ResizeObserver` 只在尺寸变化时触发，必须在 `MutationObserver` 回调里补一次 `schedule()`，否则会一直沿用旧的上方占位。
- **挂载等待不许用固定延时**：编辑器在路由渲染/接口回填后才挂载，旧实现的 600ms 在慢设备/慢接口下必然测偏。改为按「几何是否可测」轮询（80ms × 50 次），一旦测量成功即交给 `ResizeObserver`（观察 editor / split / 当前可见 pane）持续跟踪。
- 兜底：目标算不出时取 `min(split 高, 容器底 − 编辑器顶 − chrome)`，下限 `MIN_HEIGHT`=220，超出时由页面自身滚动。
- **不得把布局标记当作必需前提**（2026-11-23 修复）：旧实现要求 `closestAcrossShadows(editor, '[data-kniu-layout]')` 必须有值，否则直接 `return false`。后台布局改用 `<kniu-router-view />` 声明式槽位后（规则 175a）`data-kniu-layout` 已从全部布局移除，测量每次早退，表现就是「编辑器高度完全不自适应、maxHeight 恒为 null」。现在选择器为 `[data-kniu-layout], kniu-router-view`，且找不到布局时退回视口作为兜底边界，边界主判据仍是「最近的裁剪容器或有背景的卡片」。

回归：`test/check_editor_viewport_height_gate.mjs`（15/15，含 6 条反向）＋ `test/probe_editor_viewport_height_cdp.mjs <base> [cdpPort]`（短内容/长内容 × 700/900/1200，断言「提交按钮底 = 卡片内容底 − 2、不出卡、split 高 == maxHeight」），dev 与 dist 数值必须逐项一致。短内容是关键用例：旧探针只用长内容，恰好漏掉「内容短 → 塌回自然高度」这条用户可见的留白。

行作用域绑定的两条硬约束（2026-11-04 修复后定案）：

- 表达式必须写成 `scope.row.xxx`（或简写 `row.xxx`／`$index`），**不能**只写字段名。列插槽里的 `:if="{{scope.row.cover}}"` 在编译期求不出值，会被惰性转成 `data-kniu-row-if` 属性，等行渲染时由表格组件按行数据求值；写裸字段名（`{{cover}}`）不会被识别为行作用域，只会得到空串。
- `Kniu-Image` 的 `:if` 是行级条件：为假时该行**整个单元格留空**（不渲染破图、不渲染占位）。行级 `:if` 也支持列插槽里的 `Kniu-Btn`，用于按行数据显示/隐藏操作按钮。

    <kniu-table-col :option="{{field:'cover',label:'封面',width:180,align:'center'}}">
      <template #default>
        <kniu-image :if="{{scope.row.cover}}" style="width:60px;height:30px;" src="{{scope.row.cover}}" />
      </template>
    </kniu-table-col>


## 8. 控制器完整范例

    import { setup } from '../core/Kniu-MVVM.mjs';
    import { UI } from '../core/Kniu-Components.mjs';
    export default setup(({ reactive, request, onMounted }) => {
      const state = reactive({ form:{title:''}, saving:false, table:{data:[],loading:false}, page:{currentPage:1,pageSize:20,total:0} });
      async function submit() { state.saving=true; try { await request.post('/api/save', state.form); UI.msg({content:'已更新',type:'success'}); } finally { state.saving=false; } }
      async function loadPage(page = 1) { state.page = {...state.page,currentPage:page}; state.table = {...state.table,loading:true}; try { const r=await request.post('/api/list',{page,pageSize:state.page.pageSize}); state.table = {...state.table,data:r.data?.records||[]}; state.page = {...state.page,total:Number(r.data?.total)||0}; } finally { state.table = {...state.table,loading:false}; } }
      state.page.onCurrentChange = ({page}) => loadPage(page);
      onMounted(() => loadPage(1)); return { state, submit, loadPage };
    });

## 9. 常见问题

1. 组件不显示：确认标签是小写连字符、页面经过 Kniu 模板编译，且 option 是合法对象。
2. 布尔属性失效：disabled="false" 仍是存在属性；动态值使用 :option="{{disabled:(flag)}}"。
3. 事件无数据：检查 event.detail，并兼容模板代理的第一个参数；不要读取 Shadow DOM 内部节点。
4. 表单不提交：按钮使用 nativeType:'submit' 且位于 Kniu-Form 内，监听 @submit.prevent。
5. 上传拿不到文件：从 event.detail 或组件 files 读取 File[]，自行构造 FormData。
6. 日期/表格不刷新：给 options 赋新对象，不要只改深层字段。
7. 自定义组件放在 client/custom/<组件名>/，默认导出 COMPONENT 并调用 COMPONENT.use({...})；模板出现标签后 Core 自动加载。

## 10. 组件实例与属性索引

以下每组 HTML 与紧随其后的控制器可组合使用。控制器示例默认以 `import { setup } from '../../core/Kniu-MVVM.mjs'` 引入 `setup`，以实际控制器位置调整相对路径。需要提示时另引入 `import { UI } from '../../core/Kniu-Components.mjs'`。`refs` 是组件实例集合；`state` 中的字段供模板绑定。静态 HTML 属性使用连字符，例如 `native-type`；`:option` 使用驼峰，如 `nativeType`。布尔值用 `true`/`false`，不要写字符串 `"false"`。各组件的 `onXxx` 回调清单、参数与视图/控制器示例统一见 §1「组件回调（可选扩展点）」，本节只列属性与事件，不重复列举。

### 10.1 按钮、按钮组与图标

```html
<kniu-btn-group block>
  <kniu-btn :option="{{type:'primary',loading:(saving),nativeType:'button'}}" @click="save">保存</kniu-btn>
  <kniu-btn :option="{{type:'default',disabled:(saving)}}" @click="cancel">取消</kniu-btn>
</kniu-btn-group>
<kniu-btn :option="{{icon:'search',ariaLabel:'搜索'}}" @click="search">搜索</kniu-btn>
<kniu-icon :option="{{icon:'loading'}}" style="font-size:20px;color:#409eff" />
```

```js
export default setup(({ reactive }) => {
  const state = reactive({ saving: false });
  async function save() { state.saving = true; try { /* 保存 */ } finally { state.saving = false; } }
  function cancel() {} function search() {}
  return { state, save, cancel, search };
});
```

`kniu-btn-group` 通过默认插槽排列按钮；`block` 使组占满可用宽度。组本身不处理点击或提交，各子按钮分别声明。

| 按钮选项 | 作用 |
| --- | --- |
| `type`、`size` | 视觉类型（default、primary、success、warning、danger、info）与尺寸（large、default、small）。 |
| `nativeType`、`tag` | 内部原生元素的按钮类型（button、submit、reset）与标签名。 |
| `disabled`、`loading`、`loadingIcon` | 禁止操作、显示加载状态，以及替换加载图标。 |
| `plain`、`text`、`bg`、`link` | 朴素、文字、文字背景与链接样式。 |
| `round`、`circle`、`block` | 圆角、圆形和占满容器宽度。 |
| `icon`、`color`、`dark` | 图标名、自定义颜色及深色方案。 |
| `autofocus`、`autoInsertSpace`、`ariaLabel`、`unstyled` | 自动聚焦、双字自动间距、无障碍名称、去除组件样式。 |

`kniu-icon` 的 `icon` 指定图标名称；使用 CSS 的 `font-size`、`color` 控制尺寸和颜色，`loading` 图标自动旋转。图标本身不是交互按钮，应放在 `kniu-btn` 中并给按钮设置无障碍名称。

### 10.2 标签、徽标和状态

```html
<kniu-tag :option="{{type:'success',size:'small',effect:'light',round:true,closable:true,onClose:(removeTag)}}">已发布</kniu-tag>
<kniu-badge :option="{{value:(unread),max:99,isDot:false,hidden:false}}"><kniu-icon icon="bell" /></kniu-badge>
<kniu-status :option="{{type:'success',size:'small'}}">在线</kniu-status>
```

```js
export default setup(({ reactive }) => {
  const state = reactive({ unread: 3 });
  function removeTag() { /* 移除业务数据 */ }
  return { state, removeTag };
});
```

`kniu-tag`：`type` 颜色语义、`size` 尺寸、`effect` 外观、`round` 圆角、`closable` 显示关闭按钮、`disabled` 禁止操作；关闭时处理 `close`。`kniu-badge`：`value` 数量、`max` 最大显示值、`isDot` 红点、`hidden` 隐藏徽标、`unstyled` 去默认样式，默认插槽为被标记的内容。`kniu-status`：`type` 状态颜色，`size` 尺寸，正文为状态文案。

### 10.3 图片、空态和回到顶部

```html
<kniu-image :option="{{src:(photo),alt:'封面',fit:'cover'}}" style="width:120px;height:80px" />
<kniu-empty :option="{{note:'暂无数据'}}"><kniu-btn @click="reload">重新加载</kniu-btn></kniu-empty>
<kniu-backtop :option="{{right:24,bottom:24}}" />
```

```js
export default setup(({ reactive }) => {
  const state = reactive({ photo: '/public/static/img/default-avatar.png' });
  async function reload() { /* 请求数据 */ }
  return { state, reload };
});
```

`kniu-image`：`src` 图片 URL、`alt` 替代文字、`fit` 填充方式；成功派发 `load`，失败派发 `error`。`kniu-empty`：`note` 文案，默认插槽放操作。`kniu-backtop`：`right`、`bottom` 为距离边缘的像素值。`kniu-loading` 组件已移除（2026-11-23 裁决）：启动期与路由切换的 loading 统一由 `Kniu-BootLoading.mjs`（视口级遮罩，`showBootLoading()`/`hideBootLoading()`，单例幂等）负责。DOM/CSS 真源与显示逻辑统一放在 `Kniu-BootLoading.mjs`（2026-11-24 用户裁决，`Kniu-BootLoadingBootstrap.mjs` 已合并删除）。🔴 **遮罩必须由首屏 HTML 静态输出**：构建器与 dev server 用同一模块导出的 `withBootLoadingHtml(html)` 把节点插到 `<body>` 开头、早于 `<kniu-router-view>` 预渲染骨架和入口脚本；JS 创建的遮罩一定慢于骨架首绘（用户实测先看到「热门网址」）。`client/client.js` 的第一个依赖仍必须是该模块，顶层 `showBootLoading()` 在入口其余代码前**复用**这个静态节点（先 querySelector、没有才创建），保持单例。index.html 只保留 `<script src="/client/client.js" type="module">`，不再生成/预加载额外 classic 资源；CSP `style-src` 允许内联样式，`script-src 'self'` 下不用内联脚本。

### 10.4 表单和输入组

```html
<kniu-form ref="form" :option="{{...(form)}}" @submit.prevent="submit">
  <kniu-form-cell><kniu-input :form="{{form.title}}" :option="{{name:'title',placeholder:'标题',clearable:true}}"><template #prepend :option="{{labelWidth:'90px'}}">标题</template></kniu-input></kniu-form-cell>
  <kniu-form-cell><kniu-input-group><kniu-input :form="{{form.first}}" :option="{{name:'first',placeholder:'名'}}" /><kniu-input :form="{{form.last}}" :option="{{name:'last',placeholder:'姓'}}" /></kniu-input-group></kniu-form-cell>
  <kniu-form-cell><kniu-input :form="{{form.notes}}" :option="{{name:'notes',type:'textarea',rows:4,maxlength:500}}" /></kniu-form-cell>
  <kniu-btn-group><kniu-btn :option="{{type:'primary',nativeType:'submit'}}">提交</kniu-btn><kniu-btn :option="{{nativeType:'reset'}}">重置</kniu-btn></kniu-btn-group>
</kniu-form>
```

```js
export default setup(({ reactive, refs }) => {
  const state = reactive({ form: { title: { value: '', condition: true, message: '请输入标题' }, first: '', last: '', notes: '' } });
  function submit() { if (!refs.form.validate()) return; console.log(refs.form.values); }
  return { state, refs, submit };
});
```

`kniu-form` 的字段选项可以是普通值或 `{value, condition, message}`；`condition` 可为 `true`（非空）、正则或校验函数，`message` 为失败提示。`labelWidth`、`labelPosition` 控制标签布局；实例提供 `validate()`、`reset()`、`values`。`kniu-form-cell` 是表单行容器；`kniu-input-group` 组合多个输入，二者内容写默认插槽。

`kniu-input`：`type` 输入类型（text、password、textarea、number）、`name` 字段名、`value` 值、`placeholder` 提示、`maxlength`/`minlength` 长度、`rows` 多行高度、`disabled` 禁用、`readonly` 只读、`required` 必填、`autofocus` 聚焦、`clearable` 清空按钮、`showPassword` 密码显隐、`prefix`/`suffix` 前后图标、`size` 尺寸、`labelWidth` 标签宽度、`tip` 辅助说明、`error` 错误信息。`:form` 双向绑定；`prepend`/`append` 插槽放标签或操作。

### 10.5 选择器、单选和开关

```html
<kniu-select :form="{{form.category}}" :option="{{name:'category',placeholder:'请选择'}}" @change="changed"><kniu-option value="a" label="分类 A" /><kniu-option value="b" label="分类 B" /></kniu-select>
<kniu-radio-group :form="{{form.audit}}" :option="{{name:'audit'}}" @change="changed"><kniu-radio :option="{{value:'0'}}">待审核</kniu-radio><kniu-radio :option="{{value:'1'}}">通过</kniu-radio></kniu-radio-group>
<kniu-switch :form="{{form.enabled}}" :option="{{activeText:'启用',inactiveText:'停用',width:60}}" @change="changed" />
```

```js
export default setup(({ reactive }) => {
  const state = reactive({ form: { category: '', audit: '0', enabled: false } });
  function changed(event) { console.log(event.detail); }
  return { state, changed };
});
```

`kniu-select`：`name` 字段名、`value` 值、`placeholder` 占位、`disabled` 禁用、`required` 必填、`size` 尺寸；子项 `kniu-option` 的 `value` 是实际值、`label` 是显示名、`disabled` 禁用选项。`kniu-radio-group` 的 `name`、`value`、`disabled`、`size` 控制整组；`kniu-radio` 的 `value`、`label`、`disabled`、`size` 控制单项。`kniu-switch` 的 `value`/`checked` 是状态，`disabled` 禁用，`activeText`/`inactiveText` 是文字，`activeColor`/`inactiveColor` 是颜色，`size` 是尺寸，`width` 数字为开关像素宽、CSS 字符串为组件宽。

### 10.6 日期和验证码

```html
<kniu-date-picker ref="picker" :form="{{form.date}}" :option="{{name:'date',type:'datetime',format:'yyyy-mm-dd hh:mm:ss',placeholder:'选择时间'}}" />
<kniu-gvcode ref="captcha" :form="{{form.captcha}}" :option="{{name:'captcha',src:(captchaUrl),placeholder:'图形验证码',maxlength:4}}" @click="refreshCaptcha" />
<kniu-smsvcode :form="{{form.code}}" :option="{{name:'code',buttonText:(codeText),buttonDisabled:(sending)}}" @click="sendCode" />
```

```js
export default setup(({ reactive, refs }) => {
  const state = reactive({ form: { date: '', captcha: '', code: '' }, captchaUrl: '', codeText: '发送验证码', sending: false });
  async function refreshCaptcha() { /* 请求验证码图片，获取 Blob URL 和服务端校验令牌 */ }
  async function sendCode() { if (state.sending) return; state.sending = true; try { /* 请求验证码 */ } finally { state.sending = false; } }
  return { state, refs, refreshCaptcha, sendCode };
});
```

`kniu-date-picker`：`type` 日期/日期时间/时间，`range` 范围选择，`rangeSeparator` 内部范围分隔符，`displaySeparator` 显示分隔文案，`format` 输出格式，`value` 值，`name` 字段名，`placeholder` 占位，`lang` 语言，`disabled`/`readonly`/`required` 为状态，`min`/`max` 为边界，`weekStart` 为每周起始日（0 周日，其他值周一），`mark` 为日期标记对象；`open()`、`close()`、`focus()` 控制实例。`kniu-gvcode` 的 `src`/`alt`/`fit` 配置图片；`kniu-smsvcode` 的 `buttonText`（或 `text`）和 `buttonDisabled` 控制发送按钮。两者均支持 `name`、`placeholder`、`autocomplete`、`autocapitalize`、`maxlength`、`disabled`、`readonly`、`required` 和 `value`，可用 `focus()`。图形点击刷新、短信请求和倒计时由业务控制器实现。

### 10.7 导航和标签页

```html
<kniu-navbar :option="{{fixed:'top'}}">
  <template #brand><a href="#/">网站</a></template>
  <template #default><kniu-navbar-cells><kniu-navbar-cell :option="{{route:'/'}}">首页</kniu-navbar-cell><kniu-navbar-cell :option="{{href:'https://example.com'}}">外部链接</kniu-navbar-cell></kniu-navbar-cells></template>
</kniu-navbar>
<kniu-sub-navbar><kniu-navbar-cell :option="{{route:'/about'}}">关于</kniu-navbar-cell></kniu-sub-navbar>
<kniu-tab :option="{{active:(activeTab)}}" @change="changeTab">
  <kniu-tab-panel name="basic" label="基本信息">基本内容</kniu-tab-panel>
  <kniu-tab-panel name="history" label="历史记录">历史内容</kniu-tab-panel>
</kniu-tab>
<!-- 独立头部和内容：for 必须等于 body 的 id -->
<kniu-tab-head :option="{{for:'exampleTabs',data:(tabItems)}}" />
<kniu-tab-body id="exampleTabs"><kniu-tab-panel name="one" label="概览">概览内容</kniu-tab-panel><kniu-tab-panel name="two" label="明细">明细内容</kniu-tab-panel></kniu-tab-body>
```

```js
export default setup(({ reactive }) => {
  const state = reactive({ activeTab: 'basic', tabItems: [{ name: 'one', label: '概览', active: true }, { name: 'two', label: '明细' }] });
  function changeTab(event) { state.activeTab = event.detail.name; }
  return { state, changeTab };
});
```

`kniu-navbar`：`brand` 品牌内容配置、`home` 首页地址、`active` 当前项、`type` 样式、`open` 展开状态、`fixed` 固定位置、`placeholder` 固定时占位；具名插槽 `brand`、`default`、`append` 放品牌、主菜单、尾部菜单。`kniu-navbar-cells` 是菜单布局容器；`kniu-navbar-cell` 的 `route` 是站内路由、`href` 是链接、`active` 当前状态、`disabled` 禁用、`side` 位置、`level` 层级；`kniu-sub-navbar` 为二级导航容器。`kniu-tab` 的 `active` 是当前面板名，`change.detail.name` 是选择结果；直接子项 `kniu-tab-panel` 的 `name` 是标识、`label` 是标签文本。独立组合中 `kniu-tab-head` 的 `for` 指向 body 的 `id`，`data` 为 `{name,label,active}` 数组，`type:'hash'` 可使用 hash 保存标签；`kniu-tab-body` 的 `active` 为当前面板名。

### 10.8 分页和加载更多

```html
<kniu-page :option="{{pageOptions}}" />
<kniu-page-more :option="{{moreOptions}}" />
```

```js
export default setup(({ reactive }) => {
  const state = reactive({ rows: [], pageOptions: { currentPage: 1, pageSize: 20, total: 0, layout: '首页,上一页,页码,下一页,末页,总数' }, moreOptions: { count: 20, text: '加载更多', visible: true } });
  async function loadPage(page) { /* 请求 page，并更新 rows 和 total */ }
  state.pageOptions.onCurrentChange = ({ page }) => loadPage(page);
  state.pageOptions.onSizeChange = ({ size }) => { state.pageOptions.pageSize = size; return loadPage(1); };
  state.moreOptions.onChange = ({ count }) => { /* 加载 count 条并追加 rows */ };
  return { state };
});
```

`kniu-page`：`currentPage` 当前页（从 1 开始）、`pageSize` 每页数、`total` 总数、`sizes` 可选每页数数组、`layout` 显示项及顺序、`background` 背景样式、`firstText`/`prevText`/`nextText`/`lastText` 自定义按钮文字、`onCurrentChange({page})` 页码回调、`onSizeChange({size})` 条数回调。`kniu-page-more`：`count` 每次请求数、`loading` 加载中、`loadingText` 加载文字、`disabled` 禁用、`noMore` 禁用时的结束文案、`text` 默认文案、`block` 占满宽度、`visible` 显隐、`onChange({count})` 点击回调。它不自动请求数据。

### 10.9 弹窗、提示与认证布局

```html
<kniu-btn @click="openDialog">编辑</kniu-btn>
<kniu-modal :option="{{show:(dialog.show),title:'编辑',width:'560px',maskClose:false,onClose:(closeDialog)}}">
  <template #default>确认保存当前设置？</template>
  <template #footer><kniu-btn @click="closeDialog">取消</kniu-btn><kniu-btn :option="{{type:'primary'}}" @click="save">保存</kniu-btn></template>
</kniu-modal>
<kniu-auth-layout brand="示例" brand-mark="例" subtitle="登录账户" footer="© 示例"><kniu-input :form="{{username}}" :option="{{placeholder:'账号'}}" /></kniu-auth-layout>
```

```js
import { UI } from '../../core/Kniu-Components.mjs';
export default setup(({ reactive }) => {
  const state = reactive({ dialog: { show: false }, username: '' });
  function openDialog() { state.dialog.show = true; }
  function closeDialog() { state.dialog.show = false; }
  function save() { closeDialog(); UI.msg({ content: '已更新', type: 'success', duration: 2000, position: 'top' }); }
  return { state, openDialog, closeDialog, save };
});
```

`kniu-modal`：`show` 显隐、`title` 标题、`message` 简单正文、`type` 语义、`width`/`height` 尺寸、`mask` 遮罩、`maskAlpha` 透明度、`maskBlur` 模糊、`maskClose` 点击遮罩关闭、`scrollbar` 内容滚动、`showClose`/`closeBtn` 关闭按钮、`minmax` 最小化最大化、`confirmText`/`cancelText` 按钮文案；插槽为 `header`、`default`、`footer`，通过 `onConfirm`、`onCancel`、`onClose` 选项监听事件。后台编辑弹框的保存交互统一按 `/admin/feedback`「保存结果」口径：`actions.post` 的 `onOk` 内先更新列表行再关闭弹框，关闭函数加 `if (!state.showmodal) return` 幂等守卫；不要包 `withSubmitting(state,…)` 或用顶层 `isSubmitting` 驱动关闭（会引入与保存无关的状态刷新）。对应写接口对「字段未变化」也应返回成功码，否则 `onOk` 不执行、弹框不关闭（`daily_update` 2026-11-24 修复）。关闭后如有消息反馈，直接提示响应 msg：`onOk(response) { … closeDialog(); $msg({ content: response?.msg || '已更新', type: 'success' }); }`（2026-11-24 用户裁决）。表单提示语全局统一口径（2026-11-24 用户裁决「要么都用已更新，要么都用数据未变化」）：更新类表单有变化 → 后端 SUCCESS「已更新」、无变化 → 后端 SUCCESS「数据未变化」（禁 RULE_REJECTED，否则 onOk 不执行误弹 error）；新增类 → 「添加成功」；前端兜底文案更新类 `|| '已更新'`、新增/更新混合 `|| (isAdd ? '添加成功' : '已更新')`，契约默认 `messages.saveSuccess = '已更新'`。`kniu-msg` 通常使用 `UI.msg`：`content` 内容、`type` 类型、`duration` 持续毫秒数、`position` 位置。`kniu-auth-layout`：`brand` 品牌名、`brand-mark` 品牌标记、`subtitle` 副标题、`footer` 底部文字；默认插槽放登录表单。

**弹框保存不得抖动页面（2026-11-24 用户裁决「和 /admin/feedback 一样，不抖动」）**：`withSubmitting` 这类在抑制范围之外写顶层状态的写法会触发订阅回调 → 异步比对模板 HTML，发现列表数据已变即 `scheduleRefreshRender` **整页重建**（表格节点被销毁重建，实测 `rerenders=1`、`tableSameNode=false`）。正确姿势：保存成功后**就地回填**——行编辑改 `state.list` 行对象的 `cells` 与扁平字段、列编辑合并进 `state.columns`，再用 `context.updateBindings([refs.table], …)` 只重绑该表格；删除/新增无行可回填时才刷新，且用 `loadList(page, { silent: true })` 避免 loading 遮罩闪烁；只有改名等结构变更（影响表头）才允许 `loadStructure()` 整页刷新。闸门 `test/check_row_modal_save_gate.mjs`、探针 `test/probe_row_modal_save_cdp.mjs`（dev+dist 双断言 rerenders=0 且表格节点同一）。

**编辑页（非弹框）提交不得重绘页面（2026-11-24 用户裁决「和 /admin/table/row 一样，不刷新不抖动」）**：提交态**不要放进 `reactive` state**，也不要绑到模板（`locked:(isSubmitting)`、`:if="{{isSubmitting}}"`）。原因有两条：① `setup()` 会把 state 的每个键挂成模型 getter，`__kniuSubscribe` 读全部顶层键——提交期间写入 `state.isSubmitting` 会让订阅回调异步比对模板 HTML，真实网络下提交态持续数百毫秒，一旦判定不一致就 `scheduleRefreshRender` 触发路由刷新重渲染；② `kniu-form` 的 `locked` 会加 `data-locked`，CSS `:host([data-locked]){opacity:.8}` 让整表单变暗，肉眼就是一次闪烁；`:if` 只在渲染期求值，不整页重绘根本不会切换。正确姿势：提交锁用非响应式对象、只用按钮自身的 `loading` 属性表达提交态：

```js
const submitLock = { isSubmitting: false };            // 不进 reactive state
function setSubmitting(value) {                        // 只改按钮自身属性，零重绘
  if (!refs.submit || !refs.submit.isConnected) return;
  if (value) refs.submit.setAttribute('loading', '');
  else refs.submit.removeAttribute('loading');
}
await withSubmitting(submitLock, task, 'isSubmitting', setSubmitting);
```

模板配套：`<kniu-btn ref="submit" :option="{{nativeType:'submit'}}">提 交</kniu-btn>`，表单 `:option` 里**不要**写 `locked:(isSubmitting)`。`kniu-btn` 的 `loading` 是受控样式状态（显示转圈 + 禁用内层 button），属性切换不产生布局位移。闸门 `test/check_edit_form_inplace_submit_gate.mjs`、探针 `test/probe_edit_form_no_rerender_cdp.mjs`（保存响应延迟 600ms，断言提交中期 `data-locked` 不存在、`opacity==='1'`，且 `rerenders/rebinds/refreshScheduled` 全为 0、表单与编辑器节点同一、编辑器内容不变）。⚠️ 探针陷阱：mock 即时返回会掩盖「提交态持续期间」的抖动，必须给保存接口加延迟。

### 10.10 上传和编辑器

```html
<kniu-upload ref="upload" :form="{{files}}" :option="{{accept:'image/*',multiple:true,maxCount:3,maxSize:5,note:'最多三张'}}">选择图片</kniu-upload>
<kniu-editor ref="editor" :form="{{content}}" :option="{{name:'content',type:'markdown',height:'400px',placeholder:'正文'}}" @change="changed" />
```

```js
export default setup(({ reactive, refs, request }) => {
  const state = reactive({ files: [], content: '' });
  function changed() { console.log(state.content); }
  async function upload() { const data = new FormData(); state.files.forEach((file) => data.append('files[]', file)); return request.post('/api/upload', data); }
  function clearFiles() { refs.upload.clear(); }
  return { state, refs, changed, upload, clearFiles };
});
```

`kniu-upload`：`accept` 文件类型、`multiple` 多选、`maxCount` 数量限制、`maxSize` 单文件 MB 限制、`disabled` 禁用、`note` 提示；`files`/`value` 为文件数组，事件有 `input`、`change`、`remove`、`exceed`，方法有 `clear()`、`removeAt(index)`。`kniu-editor`：`type` 为 rich 或 markdown、`name` 字段、`placeholder` 提示、`readonly` 只读、`disabled` 禁用、`toolbar` 工具项、`maxHeight` 最大高度、`height` 高度；`value` 读写正文，`setType()` 切模式，`focus()` 聚焦。详细工具栏、事件和清洗规则见第 6 节。

### 10.11 点赞、评论和上一篇下一篇

```html
<kniu-like :option="{{likeOptions}}" />
<kniu-comment :option="{{commentOptions}}" />
<kniu-article-tab :option="{{articleTabs}}" @change="changeArticle" />
```

```js
export default setup(({ reactive, context }) => {
  const state = reactive({ likeOptions: { count: 5, liked: false }, commentOptions: { list: [], canSubmit: true, placeholder: '写评论' }, articleTabs: { previous: { id: 1, title: '上一篇' }, next: null, previousLabel: '上一篇', nextLabel: '下一篇' } });
  state.likeOptions.onChange = ({ liked }) => { /* 请求成功后回写 liked 和 count */ };
  state.commentOptions.onSubmit = (detail) => { /* 提交评论后刷新 list */ };
  function changeArticle(event) { context.navigate('/article/' + event.detail.id); }
  return { state, changeArticle };
});
```

`kniu-like`：`count` 点赞数、`liked` 是否点赞、`disabled`/`loading` 禁用状态、`own` 禁止给自己点赞、`feedback` 改变时播放提示、`onChange({liked,count})` 请求回调。`kniu-comment`：`list` 评论数组、`maxLength` 最大长度、`submitText` 按钮文案、`emptyText` 空态、`currentUser`/`currentUserId` 当前用户、`placeholder` 占位、`filter` 筛选、`canSubmit` 是否允许提交、`emojis` 表情数组、`onSubmit`/`onLike`/`onDelete`/`onUser` 业务回调。`kniu-article-tab`：`previous`/`next` 为含 `id`、`title` 的文章或空值，`previousLabel`/`nextLabel` 为标签，`change.detail` 包含 `id`、`direction`。

### 10.12 用户菜单和表格

```html
<kniu-user-login><template #default><kniu-user-login-cell :option="{{route:'/vipcenter/1'}}">个人中心</kniu-user-login-cell><kniu-user-login-cell @click="logout">退出</kniu-user-login-cell></template></kniu-user-login>
<kniu-table :option="{{table}}"><kniu-table-col :option="{{field:'title',label:'标题',minWidth:200,showOverflowTooltip:true}}" /><kniu-table-col :option="{{label:'操作',width:100}}"><template #default><kniu-btn :option="{{link:true}}" @click="editRow">查看</kniu-btn></template></kniu-table-col></kniu-table>
```

```js
export default setup(({ reactive }) => {
  const state = reactive({ table: { rowKey: 'id', data: [{ id: 1, title: '示例' }] } });
  function editRow(index, rows) { console.log(rows[index]); }
  async function logout() { /* 调用认证服务退出 */ }
  return { state, editRow, logout };
});
```

`kniu-user-login` 使用身份服务提供头像和姓名，默认插槽放 `kniu-user-login-cell`；菜单项 `route` 指向站内路由、`target` 控制打开方式，`@click` 处理业务操作。`kniu-table`：`data` 数据、`rowKey` 行主键、`height`/`maxHeight` 高度、`border` 边框、`stripe` 斑马纹、`size` 尺寸、`loading`/`loadingText` 加载状态、`highlightCurrentRow` 当前行高亮、`selectable` 是否可选、`onSortChange`/`onSelectionChange` 回调。`kniu-table-col`：`field` 字段、`label` 表头、`width`/`minWidth` 宽度、`align` 对齐、`fixed` 固定、`type` 特殊列、`sortable` 排序、`editable` 编辑、`showOverflowTooltip` 溢出提示、`formatter` 格式化、`onChange` 编辑回调；行操作处理器参数为 `(index, rows)`。表格实例方法见第 7 节。
