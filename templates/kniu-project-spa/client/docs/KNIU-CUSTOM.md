# Kniu Custom 自定义组件使用文档

业务自定义组件只能放在 `client/custom/`，不能放入 `client/core`、`controller` 或 `views`。Core 会在页面模板出现组件标签时按固定目录自动加载组件模块。

## 目录结构

```text
client/custom/
└─ hello-card/
   ├─ hello-card.mjs
   ├─ hello-card.html
   └─ hello-card.css
```

组件必须使用框架统一的 `COMPONENT.use({ tag, style, template, setup(ctx) })` 构造。`ctx` 提供 `reactive`、`emit`、`onBeforeMount`、`onMounted`、`onUnmounted`；标签名必须是小写且包含连字符。模板中直接使用 `<hello-card></hello-card>`。

```js
import COMPONENT from '../../core/kniu-components.mjs';
import TEMPLATE from './hello-card.html?module';
import STYLE from './hello-card.css?module';

COMPONENT.use({
  tag: 'hello-card',
  style: STYLE,
  template: TEMPLATE,
  setup(ctx) {
    const state = ctx.reactive({ title: '你好' });
    ctx.onMounted((host) => console.debug('组件已挂载', host));
    return { state };
  }
});
```

组件不需要清单文件，也不需要在入口、页面或 controller 中导入。模板出现 `<hello-card>` 时，Core 会自动加载固定模块 `client/custom/hello-card/hello-card.mjs`；模块顶层的 `COMPONENT.use(...)` 就是组件声明与注册。不要使用 `../` 跨出 `custom` 目录。

Core 内置 UI 与业务组件分离：内置能力位于 `client/core`，用户组件始终位于 `client/custom`，这样升级框架时不会覆盖业务代码。

