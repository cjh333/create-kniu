import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reactive, effect, computed, watch, nextTick, setup } from '../Kniu-MVVM.mjs';

test('reactive 基本读写与 effect 触发', () => {
  const state = reactive({ count: 0 });
  let rendered = 0;
  const runner = effect(() => { rendered = state.count; });
  assert.equal(rendered, 0);
  state.count = 5;
  assert.equal(rendered, 5, '赋值后 effect 应自动重跑');
  state.count = 5;
  assert.equal(rendered, 5, '相同值不应触发重跑');
  runner.stop();
});

test('reactive 嵌套对象深度追踪', () => {
  const state = reactive({ user: { name: 'a' } });
  let seen = '';
  const runner = effect(() => { seen = state.user.name; });
  assert.equal(seen, 'a');
  state.user.name = 'b';
  assert.equal(seen, 'b', '深层属性变更应触发');
  state.user = { name: 'c' };
  assert.equal(seen, 'c', '整对象替换应触发');
  runner.stop();
});

test('reactive 数组操作触发 iterate 依赖', () => {
  const state = reactive({ list: [1, 2] });
  let length = 0;
  const runner = effect(() => { length = state.list.length; });
  assert.equal(length, 2);
  state.list.push(3);
  assert.equal(length, 3, 'push 应通过 KEYS_KEY 触发 length 依赖');
  runner.stop();
});

test('effect.stop 后不再响应变更', () => {
  const state = reactive({ n: 1 });
  let seen = 0;
  const runner = effect(() => { seen = state.n; });
  runner.stop();
  state.n = 99;
  assert.equal(seen, 1, 'stop 后依赖已清理');
});

test('computed 惰性求值与依赖失效', () => {
  const state = reactive({ a: 1, b: 2 });
  let calls = 0;
  const sum = computed(() => { calls += 1; return state.a + state.b; });
  assert.equal(sum.value, 3);
  assert.equal(sum.value, 3, '未失效时读取应走缓存');
  assert.equal(calls, 1);
  state.b = 10;
  assert.equal(sum.value, 11, '依赖变更后应重新求值');
  assert.equal(calls, 2);
  sum.stop();
});

test('watch 默认 immediate 且能拿到新旧值', async () => {
  const state = reactive({ v: 1 });
  const frames = [];
  const stop = watch(() => state.v, (next, prev) => frames.push([next, prev]));
  assert.deepEqual(frames, [[1, undefined]], 'immediate 立即回调');
  state.v = 2;
  await nextTick();
  assert.deepEqual(frames, [[1, undefined], [2, 1]]);
  stop();
  state.v = 3;
  await nextTick();
  assert.equal(frames.length, 2, 'stop 后不再回调');
});

test('nextTick 在微任务时序执行', async () => {
  let done = false;
  nextTick(() => { done = true; });
  assert.equal(done, false);
  await Promise.resolve();
  assert.equal(done, true);
});

test('setup 展开 ref 字段与生命周期挂载', async () => {
  const build = setup(async (api) => {
    const counter = api.reactive({ n: 0 });
    const state = { n: 0 };
    api.onMounted(() => { state.n = 7; });
    return { counter, state };
  });
  const model = await build({});
  assert.equal(model.counter.n, 0);
  assert.equal(model.state.n, 0, 'setup 返回的 state 直接挂到 model');
  await model.__kniuLifecycle.mounted();
  assert.equal(model.state.n, 7, 'mounted 钩子按序执行');
  assert.equal(typeof model.__kniuLifecycle.unmounted, 'function', '卸载钩子存在');
});