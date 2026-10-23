# Kniu UI 组件使用文档

框架内置组件由 `client/core/kniu-components.mjs` 自动识别并按需注册。用户不需要维护组件清单、导入组件模块或编写注册配置。`client/core/kniu-ui/` 是框架源码目录，不是用户配置目录；Core 内部负责处理组件依赖。业务自定义组件模块默认导入 `COMPONENT`，并以 `COMPONENT.use({...})` 声明。

## 内置组件

Core 当前提供以下内置标签，模板出现时会自动注册，无须在入口脚本或项目配置中逐个声明：

`kniu-article-tab`、`kniu-backtop`、`kniu-badge`、`kniu-btn`、`kniu-btn-group`、`kniu-comment`、`kniu-date-picker`、`kniu-editor`、`kniu-empty`、`kniu-form`、`kniu-icon`、`kniu-image`、`kniu-input`、`kniu-like`、`kniu-loading`、`kniu-modal`、`kniu-msg`、`kniu-navbar`、`kniu-page`、`kniu-page-more`、`kniu-radio-group`、`kniu-select`、`kniu-status`、`kniu-switch`、`kniu-tab`、`kniu-table`、`kniu-tag`、`kniu-upload`、`kniu-user-login`。

以下是常用组件的最小用法：

```html
<kniu-tag type="success">操作成功</kniu-tag>
<kniu-badge value="8"><button type="button">通知</button></kniu-badge>
<kniu-status type="success">服务正常</kniu-status>
<kniu-empty note="暂无内容" />
```

Core 只注册当前页面实际出现的组件，所需的内置样式也由 Core 自动加载。

新增业务组件必须存放在 `client/custom/<组件名>/`，模板使用组件标签后由 Core 自动加载对应的 `<组件名>.mjs`。