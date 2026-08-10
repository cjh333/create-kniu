# kniu-template 使用说明

轻量响应式数据绑定模板引擎。核心能力按实际使用顺序组织：

1. **数据列表渲染**：`kniu:for`
2. **判断渲染**：`kniu:if` / `kniu:elseif` / `kniu:else`
3. **属性渲染**：`kniu:model` / `kniu:<attr>` / `kniu:[name]`
4. **事件渲染**：`kniu@<event>`
5. **DOM 查询操作**：`$()`

响应式状态和文本插值作为基础内容置于核心能力之前；模板复用、综合示例与注意事项置于其后。

> 源码：`client/core/kniutemplate.mjs`  
> 本文件只描述使用方式，不内联到 `.mjs` 源码中。

---

## 目录

- [§1 接入方式](#1-接入方式)
- [§2 响应式状态 `reactive()`](#2-响应式状态-reactive)
- [§3 文本插值 `{{...}}`](#3-文本插值)
  - [§3.1 不转义输出 `{{@...}}`](#31-不转义输出)
  - [§3.2 对象构造表达式](#32-对象构造表达式)
  - [§3.3 安全：XSS 防护模型](#33-安全xss-防护模型)
- [§4 数据列表渲染 `kniu:for`](#4-数据列表渲染-kniufor)
  - [§4.1 自定义变量名](#41-自定义变量名-kniufor-index--kniufor-item)
  - [§4.2 嵌套循环](#42-嵌套循环)
  - [§4.3 `<template>` 循环容器](#43-用-template-作为循环容器)
  - [§4.4 列表 key 标识](#44-列表-key-标识-kniukeykeyed-渲染-)
- [§5 判断渲染 `kniu:if`](#5-判断渲染-kniuif)
  - [§5.1 分支链 `kniu:elseif` / `kniu:else`](#51-分支链-kniuelseif--kniuelse)
- [§6 属性渲染](#6-属性渲染)
  - [§6.1 `kniu:model`](#61-kniumodel双向绑定-)
  - [§6.2 `kniu:<attr>`](#62-kniuattr通用标准属性绑定)
  - [§6.3 `kniu:[name]`](#63-kniuname自定义-data-属性)
  - [§6.4 属性内插值](#64-属性内插值任意属性-)
- [§7 事件渲染 `kniu@<event>`](#7-事件渲染-kniuevent)
- [§8 DOM 查询方法 `$()`](#8-dom-查询方法)
- [§9 模板片段复用 `<include>`](#9-模板片段复用-include)
- [§10 完整示例](#10-完整示例)
- [§11 注意事项](#11-注意事项)

---

## 1. 接入方式

当前项目采用组合式 **MVVM + 纯 View**。页面 HTML 只保留结构、样式和 `kniu:*` 绑定；Controller 在 `setup()` 中声明状态和普通函数：

```js
import { defineComponent, reactive, toRefs } from '../core/kniumvvm.mjs';

export const exampleController = defineComponent({
  name: 'ExampleView',
  setup({ navigateTo }) {
    const state = reactive({ title: '示例应用' });
    function handleOpenOrders() {
      navigateTo('/orders');
    }
    toRefs({ state, handleOpenOrders });
  }
});
```

> 模块规范：本项目全部使用 **命名导出**（`export const X` / `export { X }`），禁用 `export default`；消费方一律具名导入 `import { X } from '...'`。

路由通过 `ROUTER.addRoute(path, controller)` 将页面与控制器装配起来（视图按文件名约定解析为 `app-<filename>` 自定义元素）：

```js
ROUTER.addRoute('/example', exampleController);
```

模板内 `<script>` 仅作为旧模板兼容能力保留，正式页面业务逻辑统一放在 Composition API Controller 中。

`kniusystem` 由 `kniueventer.mjs` 的模板运行时对象聚合而成，固定成员如下；另含宿主（`kniubase.mjs` / 微应用运行时）透传的能力，按需解构：

| 成员 | 来源 | 说明 |
| --- | --- | --- |
| `$` | `kniueventer.mjs` | 轻量查询包装器（见 §8） |
| `reactive` | `kniutemplate.mjs` | 响应式状态（见 §2） |
| `bind` | `kniutemplate.mjs` | 显式绑定；模板外复用同一状态时用 `bind(scope, proxy)` |
| `on` | `kniueventer.mjs` | 事件绑定助手：`on(target, type, fn, opt)`，等价 `$(target).on(...)`，返回解绑函数 |
| `templateUrl` | `kniueventer.mjs` | 当前模板经过精确匹配后使用的路径 |
| `eventTo` | 宿主注入 | 事件总线：`eventTo.emit(type, detail)` / `eventTo.on(type, fn)` |
| `navigateTo` | 微应用运行时注入 | 路由跳转：`navigateTo('/orders')`，仅微应用模板内可用 |
| `openExternalUrl` | 微应用运行时注入 | 在新标签页打开外部 HTTP/HTTPS 地址：`openExternalUrl('https://www.baidu.com')` |
| `app-main` / `useViews` | `kniubase.mjs` | 公共工作台外壳由 `app.useViews({ main, aside })` 注册 `app-main` 持久渲染（侧边栏 + 顶栏 + 内容区 + Toast），导航、路由同步、快捷键、Toast 与清理逻辑由核心模块接管 |
| `ROUTER` / `useToastNotifications` / `createAppRuntime` 等 | `kniubase.mjs` 透传 | 底层框架能力，需要自定义外壳运行时才按需使用 |

> 选用建议：Model 只负责数据与派生规则；Controller 使用 `reactive`、`eventTo`、`navigateTo` 和 `openExternalUrl`；View 不写业务脚本。

公共工作台（侧边栏 + 顶栏 + 内容区 + Toast）在应用入口处注册，由持久外壳 `app-main` 承载：

```js
import { createApp } from './core/kniubase.mjs';
import { ROUTER } from './config/router.js';
import { mainController } from './controller/mainController.js';
import { asideController } from './controller/asideController.js';
import { headerController } from './controller/headerController.js';

const app = createApp();
app.use(ROUTER);
app.useViews({ main: mainController, aside: asideController, header: headerController });
app.mount('#app');
```

微应用内跳转与外部打开：

```js
const { navigateTo, openExternalUrl } = kniusystem;

navigateTo('/orders');                         // 进入站内微应用
openExternalUrl('https://www.baidu.com');      // 在新标签页打开外部页面
```

`openExternalUrl()` 仅接受 HTTP/HTTPS 地址，并使用 `noopener,noreferrer` 隔离新页面与当前应用。浏览器仍可能根据用户设置拦截非用户操作触发的弹窗，因此建议在点击事件中调用。

卸载逻辑已自动接管：组件卸载时会执行 `onUnmounted()`、`onMounted()` 返回的清理函数以及框架登记的响应式绑定清理。

---

## 2. 响应式状态 `reactive()`

```js
reactive({
  nopay: 12,
  owner: { name: '江屿设计' },
  logs: [{ message: '订单导出完成' }],
});
```

- 基于 `Proxy` 实现：**对属性赋值即触发对应 DOM 更新**。

---

## 3. 文本插值 `{{...}}`

在模板 HTML 的纯文本节点里使用 `{{...}}`，**括号内容既可以是路径，也可以是表达式**：

```html
<p>待付款：{{nopay}}</p>
<p>当前负责人：{{owner.name}}</p>
<p>乘数结果：{{i * j}}</p>
<p>是否超量：{{count > 100}}</p>
```

- 求值基于 `with` + `new Function`：括号里的标识符会在当前作用域（state + 循环局部变量）中求值。
- 纯路径（仅 `字母/数字/下划线/点号`）按 `state` 取值；表达式（含运算符、字面量等）直接求值。
- 求值时**自动记录被访问的路径**并订阅，因此 `owner.name` 这类路径的修改会精确触发重渲染。
- 缺失值 / 出错渲染为空字符串。

> 表达式示例：`{{i * j}}`、`{{i <= j}}`、`{{count + 1}}`、`{{status === 'done' ? '已完成' : '进行中'}}`。
>
> 还支持：文本与表达式混排 `{{a + b}} + {{c}} + d`、字符串拼接 `{{"hello, " + name}}`、嵌套路径与下标 `{{object.key}} {{array[0]}}`、比较运算 `{{length > 5}}`。

### 3.1 不转义输出 `{{@...}}`

默认 `{{...}}` 会把结果作为**文本**写入（自动 HTML 转义，最安全，永远不会把数据里的 `<` 当成标签）。若你的数据本身含 HTML 且希望**原样渲染**（例如富文本、高亮片段），使用 `{{@...}}`：

```html
<p>转义输出：{{date}}</p>
<p>不转义输出：{{@date}}</p>
```

```js
state.date = '<b>2026-07-31</b> <i>周五</i>';
// {{date}}   → 在页面上显示为纯文本：<b>2026-07-31</b> <i>周五</i>
// {{@date}}  → 渲染成真正的加粗 / 斜体：2026-07-31 周五
```

- `{{@表达式}}` 与 `{{表达式}}` 的求值完全一致，仅**输出方式**不同：不转义段通过 `<span>.innerHTML` 注入，会解析 HTML。
- `@` 只影响输出，不影响订阅路径（数据变化仍会触发重渲染）。
- 注意 XSS 风险：仅对**可信内容**使用 `{{@...}}`；用户可控 / 外部来源的数据仍应走 `{{...}}` 转义输出。

### 3.2 对象构造表达式

`{{...}}` 的**表达式**支持**对象字面量构造**，可组合「键值对 / 展开 `...` / 简写」任意混用，并遵循 JS 的对象覆盖规则。它不是某个专属绑定，而是 `{{}}` 表达式求值能力的自然延伸——任何能写 `{{expr}}` 的地方都能写对象构造。

```html
<div>1. 对象字面量 {{({foo: a, bar: b}).foo}}</div>
<div>2. 展开合并 {{({...obj1, ...obj2, e: 5}).e}}</div>
<div>3. 简写 {{({foo, bar}).foo}}</div>
<div>4. 覆盖顺序 {{({...obj1, ...obj2, a, c: 6}).a}}</div>
```

对应 state：

```js
const state = reactive({
  foo: 'my-foo', bar: 'my-bar',
  obj1: { a: 1, b: 2 },
  obj2: { b: 3, c: 4 },
  a: 5, b: 8,
});
```

组合结果（对 `{{ }}` 整体求值后取 `.key`）：

| 表达式 | 结果 |
| --- | --- |
| `{{foo: a, bar: b}}` | `{ foo: 5, bar: 8 }` |
| `{{...obj1, ...obj2, e: 5}}` | `{ a: 1, b: 3, c: 4, e: 5 }` |
| `{{foo, bar}}`（简写 = `{ foo: foo, bar: bar }`） | `{ foo: 'my-foo', bar: 'my-bar' }` |
| `{{...obj1, ...obj2, a, c: 6}}` | `{ a: 5, b: 3, c: 6 }` |

规则要点：

- **顺序覆盖**：后面的键覆盖前面的。`...obj2` 的 `b:3` 覆盖 `...obj1` 的 `b:2`；字面量 `c:6` 再覆盖 `obj2.c:4`；简写 `a` 等同 `a: a`（即 `a: 5`）。
- **简写 `{foo, bar}`**：key 与 value 同名，等价于 `{ foo: foo, bar: bar }`。
- **求值即依赖订阅**：表达式读到的 `obj1`/`obj2`/`a` 等路径被精确订阅，`state.a = 99` 会触发对应插值重新求值。
- **对象结果是整体返回的对象**：直接把 `{{ {foo:a,bar:b} }}` 当文本渲染会被 `String()` 化为 `[object Object]`；要用它请顺势做属性访问（如 `.foo`），或用于 `kniu:for` 等接收结构化值的指令。
- **花括号与引号之间的空格**：`kniu:for="{{[1,2,3]}} "` 末尾的空格会被忽略，等价于 `{{[1,2,3] + ' '}}`（普通属性里则把该空格当作字符串拼接）。

### 3.3 安全：XSS 防护模型

模板引擎默认采取**最小权限**的输出策略，从四个层面阻断 XSS：

1. **默认转义（最安全）**：`{{ expr }}` 一律通过 `textNode.nodeValue` 输出，浏览器会**自动 HTML 转义**，注入的 `<script>`/`<img onerror>` 等只会被当作纯文本显示，绝不解析为标签。把用户输入放进 `{{ }}` 即可获得天然防护。
2. **`{{@ expr }}` 不转义但强制净化**：`{{@ }}` 用于输出受信任的富文本 HTML，但写入前会经过 `sanitizeHtml()` 净化：移除 `<script>`/`<iframe>`/`<object>`/`<embed>`/`<link>`/`<meta>`/`<style>`/`<base>`/`<form>` 等可执行/危险元素，剥离**所有 `on*` 事件属性**，并拒绝 `javascript:` / `vbscript:` 以及非图片的 `data:` 协议 URL。即"原样渲染但不执行脚本"。
3. **URL / 事件属性协议白名单**：所有会引入外部资源的属性（`href`/`src`/`xlink:href`/`poster`/`srcset`，包括 `kniu:` 指令与属性插值两条路径）都会校验协议，**`javascript:` / `vbscript:` / 非图片 `data:` 一律拒绝写入**并告警。
4. **事件 handler 只接受函数**：`kniu@事件="fn"` 的表达式结果必须是函数，引擎绝不把普通字符串当代码执行，避免代码注入。

> 实践建议：任何来自用户输入 / 接口 / URL 的参数，优先用 `{{ }}`（转义）。只有在你**完全信任内容来源**（如自家 CMS 的富文本字段）时才用 `{{@ }}`，且引擎已为其加好净化层。

---

## 4. 数据列表渲染 `kniu:for`

```html
<ul>
  <li kniu:for="{{logs}}">{{index}}. {{item.message}}</li>
</ul>
```

- 语法：`kniu:for="{{arrayExpr}}"`，`arrayExpr` 为 **表达式**（可写 state 路径，也可写字面量数组如 `[1, 2, 3]`）。
- 字面量数组里**可以混入 state 变量**（表达式整体求值）：

```html
<div kniu:for="{{[zero, 1, 2, 3, 4]}}"> {{item}} </div>
```

```js
const state = reactive({ zero: 0 }); // 渲染出 0 1 2 3 4
```
- 循环体内可用特殊变量：
  - `{{index}}` —— 当前下标（整数）
  - `{{item.xxx}}` —— 当前元素的字段，支持嵌套（`item.user.name`）
  - 其它 `{{path}}` —— 回退到根 state
- 响应式覆盖：
  - 数组 `push` / `splice` / 整段重赋值（订阅 `length` 与数组整体 path）
  - 元素叶子属性修改（订阅各 item 现有属性）

### 4.1 自定义变量名 `kniu:for-index` / `kniu:for-item`

默认的 `index` / `item` 可改名，提升可读性：

```html
<div kniu:for="{{array}}" kniu:for-index="idx" kniu:for-item="itemName">
  {{idx}}: {{itemName.message}}
</div>
```

### 4.2 嵌套循环

外层与内层各自声明变量名，互不冲突；内层可直接引用外层的 item 变量（通过作用域链）：

```html
<div kniu:for="{{[1, 2, 3, 4, 5, 6, 7, 8, 9]}}" kniu:for-item="i">
  <div kniu:for="{{[1, 2, 3, 4, 5, 6, 7, 8, 9]}}" kniu:for-item="j">
    <div kniu:if="{{i <= j}}">
      {{i}} × {{j}} = {{i * j}}
    </div>
  </div>
</div>
```

### 4.3 用 `<template>` 作为循环容器

当循环体包含多个顶层节点时，用 `<template>` 包裹，避免额外冗余容器：

```html
<template kniu:for="{{[1, 2, 3]}}">
  <div>序号 {{index}}</div>
  <div>元素 {{item}}</div>
</template>
```

> 注意：`kniu:for` 模板节点不参与普通文本/元素绑定扫描，由列表渲染逻辑单独克隆处理。

### 4.4 列表 key 标识 `kniu:key`（keyed 渲染） ⭐

默认 `kniu:for` 是**无 key** 模式：每次数组变化都销毁并重插全部节点。当列表需要**重排 / 增删 / 保留输入框内容**时，应给每项一个稳定标识（`key`），让引擎按 key **复用** DOM 节点（移动而非重建），从而保留元素状态（输入值、焦点、滚动位置）。

```html
<!-- 用 item 的某个字段作 key -->
<div kniu:for="{{objectArray}}" kniu:key="unique">{{item.id}}</div>

<!-- 用 item 本身作 key（对象按引用、原始值按值） -->
<div kniu:for="{{objectArray}}" kniu:key="*this">{{item.id}}</div>
```

```js
const state = reactive({
  objectArray: [
    { id: 5, unique: 'unique_5' },
    { id: 4, unique: 'unique_4' },
    { id: 3, unique: 'unique_3' },
    { id: 2, unique: 'unique_2' },
    { id: 1, unique: 'unique_1' },
    { id: 0, unique: 'unique_0' },
  ],
});
```

两种取值方式：

| `kniu:key` 值 | key 来源 | 适用场景 |
| --- | --- | --- |
| `"unique"`（任意字段路径） | `item.unique`（经 `getPath` 取字段） | 元素含唯一 id/业务键 |
| `"*this"` | item 本身（对象按引用、原始值按值） | 元素是基本类型数组，或对象引用天然唯一 |

要点与限制：

- **key 必须唯一**：同一次渲染中出现重复 key 会导致复用错乱（后者覆盖前者）。`kniu:key="*this"` 且数组含重复原始值时同样会冲突。
- **未写 `kniu:key` 时保持原有 unkeyed 行为**（整体重建），不影响既有代码。
- **复用节点的刷新**：keyed 复用的节点会重新运行文本/元素绑定（值随数据更新）；其内部若嵌套 `kniu:for` / `kniu:if`，按首渲染快照保留（如需它们也随 item 数据变化，建议把嵌套数据放在 item 字段里再读）。
- **典型用途**：带可输入控件的列表（输入框内容在重排后仍跟随其 key 的节点）、需要动画/平滑移动的列表、虚拟滚动前的稳定身份。

---

## 5. 判断渲染 `kniu:if`

`kniu:if="{{expr}}"` 的值为**真**时渲染子内容，为假时移除。表达式支持任意 JS 表达式：

```html
<div kniu:if="{{count > 0}}">有 {{count}} 条记录</div>
<div kniu:if="{{status === 'done'}}">已完成</div>
<span kniu:if="{{i <= j}}">{{i}} × {{j}}</span>
```

- `kniu:if` 可与 `kniu:for` 嵌套使用（见 §4.2）。
- 条件引用的路径会精确订阅，值变化时自动插入 / 移除 DOM。
- 与原生 `v-if` 不同：为兼容现有结构，条件为真的元素会保留并参与数据绑定。

### 5.1 分支链 `kniu:elseif` / `kniu:else`

与 `kniu:if` 同级的相邻兄弟上，可接多个 `kniu:elseif` 与一个 `kniu:else`，构成完整的 `if / else if / else` 链：

- 引擎从 `kniu:if` 开始，**向后收集相邻的 `kniu:elseif` 与（最后一个）`kniu:else`**（相邻空白文本节点会被跳过，中间插入其它元素会打断链）。
- 渲染时**订阅链上所有分支的条件**；命中**第一个为真的分支**即渲染它，其余不渲染；若全部为假则渲染 `kniu:else`。
- 任一分支条件变化都会触发重渲染，自动切换显示的那个分支。

```html
<div kniu:if="{{length > 5}}"> 1 </div>
<div kniu:elseif="{{length > 2}}"> 2 </div>
<div kniu:else> 3 </div>
```

- `kniu:else` 没有表达式，始终作为「兜底」分支（必须放在链尾）。
- 分支链同样支持嵌套 `kniu:for` / `kniu:if`，也按首渲染快照保留内部嵌套指令（见 §4.4 说明）。

---

## 6. 属性渲染

属性渲染覆盖「元素级绑定」与「属性内插值」两条路径，统一使用 `kniu:` 指令，属性值需包裹在 `{{ }}` 内（属性内插值除外）。

| 子节 | 指令 | 用途 | 方向 |
| --- | --- | --- | --- |
| §6.1 | `kniu:model` | 双向绑定 | state ⇄ DOM |
| §6.2 | `kniu:<attr>` | 通用标准属性绑定 | state → DOM |
| §6.3 | `kniu:[name]` | 自定义 `data-*` 属性 | state → DOM |
| §6.4 | 任意属性内插值 `{{...}}` | 属性值表达式插值 | state → DOM |

### 6.1 `kniu:model` —— 双向绑定 ⭐

只需将 state 单向写入输入框时，使用标准属性指令：

```html
<input kniu:value="{{owner.name}}">
<input type="checkbox" kniu:checked="{{agreed}}">
```

需要用户输入回写 state 时，使用 `kniu:model`：

```html
<input kniu:model="{{message}}" placeholder="编辑我……">
<p>input 表单消息是: {{ message }}</p>
```

- `kniu:model="{{path}}"` 实现 state ⇄ 表单双向同步，使用 `input` 事件回写；复选框和单选框使用 `change` 事件回写。
- 属性值必须包裹在 `{{ }}` 内。
- `model` 是 JS 关键字，但作为 HTML 属性名（`kniu:model`）完全合法；引擎内部用 `[kniu\:model]` 转义冒号来匹配选择器。
- 可配合 `type="checkbox"`/`radio` 使用（布尔值走 `checked` + `change`）。
- 模板卸载时自动移除对应的事件监听。
- 绑定完成后，`kniu:model` 指令属性会从最终 DOM 中移除；响应式订阅与输入事件仍然有效。

### 6.2 `kniu:<attr>` —— 通用标准属性绑定

任意元素的标准属性都可以直接写成 `kniu:属性="{{ 表达式 }}"` 的单向绑定（state → 属性）。`href`/`src`/`value`/`title`/`alt`/`width`/`colspan`…… 全部支持，写法统一：

```html
<a kniu:href="{{ linkUrl }}" kniu:title="{{ linkTitle }}">链接</a>
<img kniu:src="{{ imgSrc }}" kniu:alt="{{ imgAlt }}" />
<input kniu:value="{{ inputValue }}" />
<div kniu:class="{{hasError ? 'panel text-danger' : 'panel'}}">class 绑定</div>
<div kniu:style="{{'color:' + activeColor + ';font-size:' + fontSize + 'px'}}">style 绑定</div>
```

- 取值规则：
  - 布尔属性（`checked`/`disabled`/`hidden`/`selected`/`readonly`/`required` 等）→ 真则存在、假/`null`/`false` 则移除；
  - `value` → 走元素 `value` 属性（表单当前值）；
  - 其它 → `setAttribute(属性, String(value))`（`null`/`false` 时移除）。
- `class` 和 `style` 都是标准 DOM 属性，使用字符串表达式绑定，不提供额外的对象或数组语法。
- 指令绑定完成后会从最终 DOM 中移除，只保留求值后的标准属性。
- **元素-属性兼容校验**：`kniu:<attr>` 只能写在该元素原生支持该属性的标签上。例如 `<a>` 只能用 `kniu:href`、`<img>` 只能用 `kniu:src`；把 `kniu:src` 写在 `<a>` 上会被**跳过并告警**。自定义数据属性使用 `kniu:[name]`。
- 全局属性（`id`/`class`/`style`/`title`/`lang`/`data-*`/`aria-*` 等）在任何元素上都可用。

### 6.3 `kniu:[name]` —— 自定义 `data-*` 属性

中括号内填写自定义属性名称，渲染时引擎会自动添加 `data-` 前缀：

```html
<button kniu:[msg]="{{msg}}" type="button">导出订单</button>
<button kniu:[tab-index]="{{tabIndex}}" type="button">切换页签</button>
```

```js
reactive({
  msg: '订单导出成功',
  tabIndex: 2,
});
```

渲染结果：

```html
<button data-msg="订单导出成功">导出订单</button>
<button data-tab-index="2">切换页签</button>
```

- `kniu:[msg]` 对应 `data-msg`，`kniu:[tab-index]` 对应 `data-tab-index`。
- 名称只能包含英文字母、数字和连字符，并且必须以英文字母开头。
- 表达式结果为 `null`、`undefined` 或 `false` 时移除对应的 `data-*` 属性；其他值转换为字符串。
- 绑定完成后，`kniu:[name]` 指令会从最终 DOM 中移除。
- 事件中可通过 `e.currentTarget.dataset.msg` 或 `e.currentTarget.dataset.tabIndex` 读取。
- 多个自定义属性分别声明，例如同时使用 `kniu:[msg]` 和 `kniu:[tab-index]`。

### 6.4 属性内插值 `{{...}}`（任意属性） ⭐

除了 `kniu:<attr>` 指令写法，还可以**直接在任意 HTML 属性值里写 `{{表达式}}`**，引擎会求值并写回该属性。多个 `{{}}` 可与静态文本混排。

```html
<!-- 布尔属性：表达式为真 → 存在；为假/null/undefined → 移除 -->
<input type="checkbox" checked="{{agree}}" />
<div hidden="{{!showHidden}}">showHidden 为真时隐藏</div>
<div hidden="{{flag ? true : false}}">flag 为真时存在</div>
<button disabled="{{loading}}">提交</button>

<!-- 普通属性：求值后转字符串写回 -->
<img src="{{avatarUrl}}" alt="{{owner.name}}" />
<div class="{{status === 'ok' ? 'on' : 'off'}}">状态</div>

<!-- 与静态文本混排 -->
<a href="/user/{{user.id}}">详情</a>

<!-- 组件属性：与静态文本混排，须包在双引号内 -->
<div id="item-{{id}}">…</div>
```

求值规则：

- **布尔属性**（`checked` / `hidden` / `disabled` / `selected` / `readonly` / `multiple` / `required` / `autofocus` / `defer` / `open` / `inert` 等）：
  - 若该属性值是一个**纯表达式**（整串只有一个 `{{expr}}`，无其它文本）：
    - 真值（非 `false`/`null`/`undefined`/`0`/`''`）→ `setAttribute(name, '')`（属性出现）
    - 假值 → `removeAttribute(name)`（属性移除）
  - 若与静态文本混排（如 `hidden="x{{flag}}"`），按普通属性处理。
- **普通属性 / 混排文本**：把所有 `{{expr}}` 替换为 `String(值)` 后拼接；表达式结果为 `null`/`undefined`/`false` 且整体无其他静态文本时移除该属性，否则 `setAttribute(name, 拼接结果)`。

> 选择建议：标准属性使用 `kniu:href` / `kniu:checked`；自定义 `data-*` 属性使用 `kniu:[name]`；普通属性也可以直接使用 `href="{{url}}"` 形式的属性插值。

---

## 7. 事件渲染 `kniu@<event>`

用 `kniu@事件名="处理函数"` 把 `setup()` 暴露的函数绑定到 DOM 原生事件（如 `kniu@click` / `kniu@change` / `kniu@focus` / `kniu@keydown` / `kniu@submit` …）。事件属性直接填写函数名，不使用 `{{ }}`，触发时传入原生 `Event` 对象。

```html
<button kniu@click="handleClick">点我</button>
<input kniu@keydown="handleKeydown" placeholder="按键触发" />
<form kniu@submit="handleSubmit">…</form>
```

事件修饰符采用点语法。例如：

```html
<form kniu@submit.prevent="handleSubmit">…</form>
<button kniu@click.stop.once="handleClick">提交一次</button>
<input kniu@keydown.enter.exact="handleEnter" />
```

- 行为修饰符：`.prevent`、`.stop`、`.self`
- 监听选项：`.once`、`.capture`、`.passive`
- 系统按键：`.ctrl`、`.shift`、`.alt`、`.meta`、`.exact`
- 键盘按键：`.enter`、`.tab`、`.delete`、`.esc`、`.space`、`.up`、`.down`、`.left`、`.right`
- 鼠标按键：`.left`、`.middle`、`.right`

`.prevent` 会在调用处理函数前执行 `event.preventDefault()`；`.stop` 会执行
`event.stopPropagation()`。`.passive` 与 `.prevent` 不能同时使用。

```js
export const exampleController = defineComponent({
  setup({ eventTo }) {
    const state = reactive({ count: 0 });
    function handleClick() {
      state.count += 1;
      eventTo.emit('toast', 'hello world');
    }
    function handleKeydown(event) { console.log(event.key); }
    function handleSubmit() { }
    toRefs({ state, handleClick, handleKeydown, handleSubmit });
  }
});
```

事件函数使用闭包访问 `state`，不依赖 `this`；跨组件消息通过 `setup({ eventTo })` 注入的事件总线发送。

**关键规则与约束：**

1. **事件必须写在元素原生支持的事件上**（元素-事件兼容性校验，与 `kniu:<attr>` 的元素-属性校验同源）。例如：
   - `kniu@click` / `kniu@keydown` / `kniu@mouseover` 等几乎所有元素都支持（全局事件 `*`）；
   - `kniu@change` / `kniu@input` 仅适用于表单控件（`input`/`textarea`/`select`/`button`）；
   - `kniu@submit` / `kniu@reset` **只能写在 `<form>` 上**；
   - `kniu@focus` / `kniu@blur` 仅适用于可聚焦元素。
   - 若事件不适用于该元素（如 `<a>` 上写 `kniu@submit`），引擎会**跳过绑定并输出 `console.warn` 告警**，不会静默失败。
2. **值必须是函数**：属性中的名称或表达式求值后必须是函数，非函数值直接忽略（避免代码注入 / XSS）。
3. **响应式**：引用的函数若随 state 变化而替换，引擎会先 `removeEventListener` 旧函数再绑定新函数（通过 `WeakMap` 跟踪，不重复叠加监听）。
4. 绑定完成后 `kniu@事件` 标记属性会从最终 DOM 上移除，不会泄漏到产物。
5. 事件属性值**不使用 `{{ }}`**，例如 `kniu@click="handleClick"`。

> - 单个标准属性 → `kniu:href` / `kniu:title` / `kniu:value` / `kniu:class` / `kniu:style` …（见 §6.2）；
> - 自定义 `data-*` 属性 → `kniu:[name]`（见 §6.3）；
> - 或在任意属性值里直接写 `{{表达式}}`（见 §6.4）。

---

## 8. DOM 查询方法 `$()`

`$()` 接收 CSS 选择器或 `Element`，返回带链式 DOM 方法的包装对象；匹配多个元素时返回包装对象数组。当前应用启动时启用了 `strictSelectors`，查询不到元素会直接抛错，以尽早暴露 View 与 Controller 不一致。关闭严格模式时才返回安全的空对象并输出警告。

```js
const { $ } = kniusystem;

$('#title').text('订单中心');
$('#app-icon').css({ backgroundColor: '#635bff' });

const off = $('#export').on('click', handleExport);
return off; // 模板卸载时解绑
```

| 分类 | 方法 | 示例 | 说明 |
| --- | --- | --- | --- |
| 事件 | `on(type, fn, opt)` | `$('#x').on('click', fn)` | 绑定事件，返回解绑函数 |
| 事件 | `off(type, fn, opt)` | `$('#x').off('click', fn)` | 解绑事件 |
| 查询 | `find(selector)` | `$(el).find('button')` | 查找后代，返回包装元素或数组；严格模式下无匹配会抛错 |
| 查询 | `parents(selector)` | `$(e.target).parents('[data-app]')` | 自底向上匹配，等价于 `closest` |
| 内容 | `text([value])` | `$('#t').text('hi')` | 读写文本；无参数时读取 |
| 内容 | `html([value])` | `$('#t').html('<b>hi</b>')` | 读写 `innerHTML` |
| 属性 | `attr(name[, value])` / `attr({...})` | `$('#a').attr('href', url)` | 读写或批量设置属性 |
| 属性 | `prop(name[, value])` | `$(e.target).prop('tagName')` | 读写 DOM 属性 |
| 类名 | `addClass(...)` / `removeClass(...)` | `$('#b').addClass('active')` | 增删类名，支持空格分隔 |
| 类名 | `toggleClass(name, force)` | `$('#b').toggleClass('active', enabled)` | 切换类名 |
| 样式 | `css(name[, value])` / `css({...})` | `$('#i').css('background', color)` | 读写或批量设置样式 |
| 表单 | `val([value])` | `$('#i').val()` | 读写表单值；多选读取为数组 |
| 显示 | `show()` / `hide()` | `$('#x').hide()` | 切换 `display` |
| 数据 | `data(name[, value])` / `data({...})` / `data()` | `$('#x').data('id')` | 读写 `dataset`，自动转换 kebab/camel 命名 |

> 所有 setter 方法均返回当前包装对象，支持链式调用。事件处理函数建议采用常见的 `handle*` 命名。页面内的普通元素事件优先使用 `kniu@<event>`；需要事件委托、全局事件或命令式 DOM 操作时再使用 `$()`。

---

## 9. 模板片段复用 `<include>`

在任意模板源码里写 `<include src="相对或绝对路径">`，加载该模板时会被**就地展开**为其内容（递归，支持 include 套 include）。

```html
<include src="./header.html" />
```

应用入口同样只使用 `<include>`：

```html
<div id="app">
  <include src="/client/views/admin/common/main.html" />
</div>
```

要点：

- `src` 支持相对路径（基于**当前模板 URL** 解析）与基于 `VIEWS` 配置的绝对路径。
- `#app` 必须包含一个根 `<include src="...">`，启动器读取其 `src` 后加载入口模板。
- 解析顺序与 `loadHtmlTemplate` 一致：先精确查找 `globalThis.__VIEW_TEMPLATES__` 清单，取不到再按完整路径 `fetch`。不按文件名模糊回退，避免同名模板被误加载。
- 展开在**字符串层面**完成（先于 DOM 解析），因此自闭合写法 `<include src="x" />` 不会把后续兄弟节点误吞为它的子节点；显式闭合 `<include src="x"></include>` 同样支持。
- 为兼容旧模板，被包含模板里的 `<script>` 仍会随主模板一起收集并执行；正式页面应把状态和事件迁入 Controller。
- 循环引用会被检测并跳过（console.warn），避免无限展开。

---

## 10. 完整示例

下面是一段**合成演示**，集中覆盖文本插值 / `kniu:model` / `kniu:<attr>` / `kniu:[name]` / `kniu@事件` / XSS 防护 / `kniu:for` / `kniu:if` 等全部指令，便于一览写法。实际项目中的精简用法可参考 `views/orders.html`（`kniu:for` + `kniu:key` + `kniu:if` 分支链）与 `views/home.html`（`kniusystem.eventTo` / `kniusystem.navigateTo`）。

```html
<div class="demo">
  <p>当前负责人：<b>{{owner.name}}</b>（待付款 {{nopay}} 单）</p>
  <input kniu:model="{{message}}" placeholder="编辑我……" />
  <p>input 表单消息是: {{ message }}</p>

  <h4>标准 class / style 属性绑定</h4>
  <div kniu:class="{{hasError ? 'static text-danger' : 'static'}}">class 演示</div>
  <div kniu:style="{{'color:' + activeColor + ';font-size:' + fontSize + 'px'}}">style 演示：测试</div>

  <h4>属性绑定（kniu:&lt;attr&gt; / kniu:[name]）</h4>
  <a kniu:href="{{ linkUrl }}" kniu:title="{{ linkTitle }}">链接（kniu:href + kniu:title）</a>
  <img kniu:src="{{ imgSrc }}" kniu:alt="{{ imgAlt }}" />
  <input kniu:value="{{ inputValue }}" />
  <button kniu:[msg]="{{ tipText }}">带 data-msg 的按钮</button>

  <button kniu:title="{{owner.name}}">导出（悬停看标题绑定）</button>

  <h4>原生事件绑定（kniu@事件）</h4>
  <div kniu:class="{{hasError ? 'text-danger' : ''}}">点击 {{ clickCount }} 次 ｜ 最近按键 {{ lastKey }} ｜ 失焦 {{ blurCount }} 次</div>
  <button kniu@click="handleClick">点我（kniu@click）</button>
  <input kniu:model="{{ inputMsg }}" kniu@keydown="handleKeydown" placeholder="按键触发 kniu@keydown" />
  <input kniu:value="{{ inputMsg }}" kniu@change="handleChange" kniu@focus="handleFocus" placeholder="改变/聚焦触发" />

  <h4>XSS 防护示意</h4>
  <p>转义输出：{{ risky }}</p>
  <p>不转义（已净化，&lt;script&gt; 会被剥离）：{{@ risky }}</p>

  <h4>列表渲染（默认变量名）</h4>
  <ul>
    <li kniu:for="{{logs}}">{{index}}. {{item.message}}</li>
  </ul>
  <button kniu@click="handleAddLog">追加一条日志</button>

  <h4>自定义变量名 + 嵌套 + kniu:if</h4>
  <div kniu:for="{{[1, 2, 3, 4, 5, 6, 7, 8, 9]}}" kniu:for-item="i">
    <div kniu:for="{{[1, 2, 3, 4, 5, 6, 7, 8, 9]}}" kniu:for-item="j">
      <span kniu:if="{{i <= j}}">{{i}} × {{j}} = {{i * j}}&nbsp;</span>
    </div>
  </div>

  <h4>&lt;template&gt; 循环容器</h4>
  <template kniu:for="{{[1, 2, 3]}}">
    <div>序号 {{index}}</div>
    <div>元素 {{item}}</div>
  </template>
</div>
```

对应 Controller：

```js
export const demoController = defineComponent({
  setup() {
    const state = reactive({
      nopay: 12,
      owner: { name: '江屿设计' },
      logs: [{ message: '订单导出完成' }, { message: '库存已同步' }],
      clickCount: 0,
      lastKey: '',
      blurCount: 0,
      inputMsg: '',
      hasError: true,
      // {{ }} 转义；{{@ }} 会净化后输出。
      risky: '<script>alert(1)</script><b>富文本</b>',
    });
    function handleClick() { state.clickCount += 1; }
    function handleKeydown(event) { state.lastKey = event.key; }
    function handleChange(event) { state.inputMsg = event.target.value; }
    function handleFocus() { state.blurCount += 1; }
    function handleAddLog() {
      state.logs.push({ message: `新日志 ${state.logs.length + 1}` });
    }
    toRefs({ state, handleClick, handleKeydown, handleChange, handleFocus, handleAddLog });
  }
});
```

---

## 11. 注意事项

1. `reactive()` 只能代理**对象/数组**。基本类型直接返回，不会响应式。
2. Controller 应在 `setup()` 内创建 `reactive()` 状态；其他上下文复用同一状态时，请用 `bind(scope, proxy)` 显式绑定。
3. `$()` 包装对象的所有 setter 方法均返回 `this`，支持链式调用。
4. `kniu:for` 的数组表达式须最终求值为数组；非数组会被当作空数组处理。
5. `{{...}}` 与 `kniu:if` 中的表达式通过 `with` + `new Function` 求值，**不要在其中拼接不可信字符串**，避免注入风险。
6. 循环内的 `kniu:model` 双向写回以根 `state` 为基准；在循环体内修改 `item.xxx` 推荐用 `state.list[idx].xxx = ...` 或借助数组整体重赋值。
