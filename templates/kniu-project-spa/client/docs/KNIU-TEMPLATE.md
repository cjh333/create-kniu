# Kniu Template 模板引擎使用文档

支持插值、条件、嵌套循环、属性绑定和 include：

```html
<template :if="{{ visible }}">内容</template>
<template :for="{{ items }}" :for-item="item" :for-index="index" :key="*this">
  {{ index }}：{{ item }}
</template>
<include src="./common/header.html" />
```
