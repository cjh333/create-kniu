# Kniu Template 模板引擎使用文档

支持插值、条件、嵌套循环、属性绑定、事件绑定和 include：

```html
<!-- 支持普通标签 -->
<div :if="{{ visible }}">内容</div>
<div :elseif="{{ other }}">另一段</div>
<div :for="{{ items }}" :for-item="item" :for-index="index" :key="*this">
  {{ index }}：{{ item }}
</div>
<!-- 支持 template 标签 -->
<template :if="{{ visible }}">内容</template>
<template :elseif="{{ other }}">另一段</template>
<template :for="{{ items }}" :for-item="item" :for-index="index" :key="*this">
  {{ index }}：{{ item }}
</template>
<!-- 支持组件 -->
<kniu-btn :if="{{ visible }}">内容</kniu-btn>
<include src="./common/header.html" />
```

属性与事件指令：

- `:name="表达式"`：通用属性绑定，求值后写入属性；
- `:option="{ key: '值' }"`：对象字面量批量属性绑定，`onXxx` 键会编译为事件（如 `{ onClick: 'handle()' }`）；
- `:form="表达式"`：双向绑定，与 `Kniu-Input` 等表单组件配合；
- `@事件="表达式"`：事件委托绑定，事件名须在白名单内（`click`、`input`、`change`、`submit`、`keydown` 等 28 个，见 `Kniu-TemplateEngine.mjs` 的 `events` 集合），非法事件名编译期直接报错。

**事件必须写成 `@事件` 指令，禁止手写编译产物 `data-kniu-event` / `data-kniu-handler`。** `@click="loadPage"` 编译后正是 `data-kniu-event="click" data-kniu-handler="loadPage"`，手写产物运行时能跑、行为也一致，因此不会报错也不会被视觉回归发现，但它绕过了模板引擎：表达式求值、`.stop`/`.prevent` 修饰符、作用域变量全部失效，后续给 handler 传参或加修饰符会被静默忽略。闸门 `test/check_template_directive_gate.mjs` 拦截 `client/views`、`client/custom` 里的硬编码写法。

表达式不支持 `__proto__`、`prototype`、`constructor` 等敏感键。