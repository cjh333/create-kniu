# Kniu MVVM 模块使用文档

提供 `reactive`、`computed`、`watch`、`effect`、`setup` 和生命周期钩子。响应式读取按对象属性收集依赖；当前 effect 未读取的字段更新不会触发该 effect。

```js
import { setup } from '../core/Kniu-MVVM.mjs';

export default setup(({ reactive, onMounted }) => {
  const state = reactive({ count: 0 });
  onMounted(() => console.log('页面已加载'));
  return { state, add() { state.count += 1; } };
});
```

返回对象中的 `state` 字段会被自动展开：其顶层字段以响应式 getter 挂到 model 上，模板可直接读 `{{ state.count }}`。**不要手写 `...state` 展开**——手动展开产生的是创建时刻的值快照（setup 会自动跳过已存在的同名键），后续响应式更新不再触达 model。

> 🔴🔴 **深层 `slot.value` 回填后必须显式触发一次视图刷新**（2026-11-19 定案，规则 169）。`assignOptionFields` / `fillOptionsFromResponse` 只写 `state.model.field.value` 这类嵌套值，而视图刷新链路只有一条：顶层 `state` 字段变化 → `__kniuSubscribe` 的 effect（**只读顶层字段**）→ 调度 `renderWithBoundary({refresh:true})`。绑定层虽然会读 `.value`，但读取发生在渲染/`bind()` 而非 effect 内，不被追踪；表单组件也没有对 `form.value` 的响应式监听。因此**裸的深层回填不会刷新视图**。
>
> 首屏能回填只是因为 `settleFirstScreen` 在 `mounted` 请求落定后无条件 rerender 一次；一旦脱离该窗口（接口慢于 `requestTrackingTimeout=4000ms`、复用控制器实例重新拉取、路由参数变化只回填不重建），数据进了 model 但输入框依旧为空——表现就是「拉取有数据，页面没回填」。
>
> 回填函数必须三选一（缺一即为 bug）：
> 1. `context.updateBindings(refs.form, () => assignOptionFields(state.model, data))` —— **原地 patch 不重建组件**，表单里有 kniu-editor 时首选（重建会丢视口自适应高度），需确认 ref 已 `isConnected`；
> 2. 回填后改一个顶层字段（如 `state.files = ...`），借 `__kniuSubscribe` 触发整页 refresh（会重建组件）；
> 3. 回填到新建的局部对象，再整体赋给 `state.model = {...}`（顶层引用变化）。
>
> 反例（曾导致线上缺陷）：`loadHelp()` 里只有裸 `assignOptionFields(state.helpModel, res.data)`。回归：`test/check_deep_fill_refresh_gate.mjs`（9/9，含反向）＋ `test/probe_deep_fill_refresh_cdp.mjs`（慢接口 6000ms，dev 正反向 + dist 正向）。

可用钩子：`onBeforeMount`、`onMounted`、`onBeforeUnmount`、`onUnmounted`。

> **公共视图（`pages.views`，如 `aside`/`header`/`footer`）的控制器只有路由级页面才会触发挂载/卸载钩子**——公共视图的 `onMounted`/`onUnmounted` 不会执行。需要「渲染完成后再做」的副作用（读 DOM、挂原生监听）必须写在 setup 顶层，并自行用 `setTimeout`/`queueMicrotask` 或幂等标记处理时序；也不要在公共视图里往 `globalThis` 加监听，卸载钩子同样不会来，监听会持续累积。

`effect(fn)` 立即执行并订阅执行期间读取的响应式字段，返回对象的 `stop()` 可释放依赖。`watch(source, callback)` 只在 source 结果变化后调用 callback，返回停止函数。`computed(getter)` 惰性缓存结果，依赖变化后失效并在下次访问时重算。

计算值不需要手写 getter：

```js
const state = reactive({ count: 0 });
return {
  state,
  label: computed(() => `数量：${state.count}`)
};
```

`setup` 会自动把 `computed` 的 `.value` 暴露给模板。

---

### 在组件 `useComponent` / `COMPONENT.use` 中使用

自定义组件的 `ctx` 同样提供 `reactive`、`computed`、`watch`、`refs`、`nextTick` 与生命周期钩子：

```js
import { useComponent } from '../core/Kniu-Ui/Kniu-Ui.mjs';

useComponent({
  tag: 'my-card',
  template: `<div>{{ label }}</div>`,
  setup({ reactive, computed, onMounted }) {
    const state = reactive({ count: 0 });
    const label = computed(() => `数量：${state.count}`);
    onMounted(() => console.log('mounted'));
    return { state, inc() { state.count += 1; } };
  }
});
```