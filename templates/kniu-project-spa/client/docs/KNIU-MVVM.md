# Kniu MVVM 模块使用文档

提供 `reactive`、`computed`、`watch`、`effect`、`setup` 和生命周期钩子。响应式读取按对象属性收集依赖；当前 effect 未读取的字段更新不会触发该 effect。

```js
import { setup } from '../core/kniu-mvvm.mjs';

export default setup(({ reactive, onMounted }) => {
  const state = reactive({ count: 0 });
  onMounted(() => console.log('页面已加载'));
  return { ...state, add() { state.count += 1; } };
});
```

可用钩子：`onBeforeMount`、`onMounted`、`onBeforeUnmount`、`onUnmounted`。

`effect(fn)` 立即执行并订阅执行期间读取的响应式字段，返回对象的 `stop()` 可释放依赖。`watch(source, callback)` 只在 source 结果变化后调用 callback，返回停止函数。`computed(getter)` 惰性缓存结果，依赖变化后失效并在下次访问时重算。

计算值不需要手写 getter：

```js
const state = reactive({ count: 0 });
return {
  ...state,
  label: computed(() => `数量：${state.count}`)
};
```

`setup` 会自动把 `computed` 的 `.value` 暴露给模板。
