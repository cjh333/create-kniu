# Kniu Router 路由模块使用文档

## 路由跳转与参数

模板导航使用标准链接，不使用 `data-route`：

```html
<a href="#/about/12">查看关于页面</a>
<a :href="#/about/{{id}}">动态跳转</a>
```

路由路径可声明参数：

```js
'/about/:id': { template: 'about/about.html', controller: 'about/aboutController.js' }
```

控制器可从 `setup` 的 `context` 调用 `navigate`：

```js
export default setup(({ context }) => ({
  open(id) {
    context.navigate('/about/:id', { id });
  }
}));
```

匹配到的参数可在模板使用 `{{params.id}}`，也会传给 controller 的路由上下文。

路由 API 支持 `router.beforeEach(fn)`、`router.afterEach(fn)` 动态注册守卫（返回注销函数）；route 可用 `children` 建立嵌套路由，`controller` 可使用 `() => import('./controller.mjs')` 延迟加载，`template` 可使用异步函数解析模板路径。路由上下文提供 `matched` 父子路径序列。新导航会忽略较旧异步导航结果。

路由配置位于 `client/config/router.js`。`template` 相对 `client/views/`，`controller` 相对 `client/controller/`。通用 `beforeEach` 和 `afterEach` 钩子内置在 `client/core/kniu-router.mjs`，项目配置文件只保留路由表。

```js
export const routes = {
  '/': { template: 'index/home.html', controller: 'index/homeController.js', default: true }
};

标题可以是异步函数。数据库请求应放在 controller 或请求模块中，路由只读取 controller 返回的数据：

```js
// router.js
export const routes = {
  '/article': {
    template: 'article/detail.html',
    controller: 'article/detailController.js',
    title: ({ model }) => model.article?.title || '文章'
  }
};
```

```js
// controller/article/detailController.js
import { setup } from '../../core/kniu-mvvm.mjs';

export default setup(async ({ reactive, context, onMounted }) => {
  const article = await fetch(`/api/articles/${context.params.id}`).then((response) => response.json());
  const state = reactive({ article: article.data });
  onMounted(() => console.debug('文章页面已加载'));
  return { ...state };
});
```
```
