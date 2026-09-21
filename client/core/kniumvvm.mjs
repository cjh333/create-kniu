import KniuTemplate from './kniutemplate.mjs';
import KniuUI from './kniuui.js';
import { nextTick } from './kniuscheduler.mjs';
import SYNC from './kniusync.mjs';

const { collectReactiveReads, observe, reactive } = KniuTemplate;

let activeInstance = null;

function loadController(name) {
  const normalized = String(name || '').trim().replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
  if (!/^[a-z0-9_/-]+$/i.test(normalized) || normalized.includes('..') || !normalized.includes('/')) {
    throw new TypeError('[MVVM] controller path must include its folder');
  }
  const parts = normalized.split('/');
  const fileName = parts.pop();
  const controllerName = fileName.endsWith('Controller') ? fileName : `${fileName}Controller`;
  const controllerPath = [...parts, controllerName].join('/');
  return import(`../controller/${controllerPath}.js`).then(function (module) {
    const controller = module[controllerName] || module.default;
    if (!controller) throw new Error(`[MVVM] Controller export not found: ${controllerName}`);
    return controller;
  });
}

function requireActiveInstance(apiName) {
  if (!activeInstance) throw new Error(`[MVVM] ${apiName}() must be called inside setup()`);
  return activeInstance;
}

function registerLifecycleHook(type, hook) {
  if (typeof hook !== 'function') throw new TypeError(`[MVVM] ${type} hook must be a function`);
  requireActiveInstance(type)[type].push(hook);
}

function createTimerServices(services, timers) {
  return {
    ...services,
    setInterval(callback, delay) {
      const timer = { id: globalThis.setInterval(callback, delay), repeat: true };
      timers.add(timer);
      return timer.id;
    },
    setTimeout(callback, delay) {
      const timer = { id: null, repeat: false };
      timer.id = globalThis.setTimeout(function () {
        timers.delete(timer);
        callback();
      }, delay);
      timers.add(timer);
      return timer.id;
    }
  };
}

function exposeBindings(state, bindings) {
  Object.entries(bindings).forEach(function ([name, value]) {
    if (name === 'state') return;
    if (Object.prototype.hasOwnProperty.call(state, name)) {
      throw new Error(`[MVVM] setup binding "${name}" conflicts with reactive state`);
    }
    state[name] = value;
  });
}

function controller(setup) {
  if (typeof setup !== 'function') throw new TypeError('[MVVM] controller() expects a setup function');
  const component = {
    name: setup.name || 'AnonymousController',
    setup,
    __kniuComponent: true,
    async mount(services, root) {
      const refs = {};
      const viewModel = createViewModel(component, services, root, refs);
      await viewModel.beforeMount();
      const binding = services.bind(root, viewModel.state, refs);
      const disposeViewModel = await viewModel.mount();
      return function disposeComponent() {
        disposeViewModel?.();
        binding?.dispose?.();
      };
    }
  };
  return Object.freeze(component);
}

function createViewModel(component, services = {}, root, refs = {}) {
  const instance = {
    beforeMounted: [],
    mounted: [],
    unmounted: [],
    cleanups: [],
    timers: new Set(),
    stopped: false,
    bindings: null
  };
  const setupContext = createTimerServices({ ...services, root: root || services.root, $refs: refs, refs: refs }, instance.timers);
  Object.assign(setupContext, {
    reactive, ref, computed, watch, watchEffect,
    onBeforeMount, onMounted, onUnmounted, onScopeDispose, autoSync
  });
  setupContext.$msg = KniuUI.msg;
  setupContext.$confirm = KniuUI.confirm;

  activeInstance = instance;
  // setup() 期间发布当前作用域：期间调用的 autoSync()（含 usePagination 内部的注册）
  // 自动绑定到本实例，随 dispose() 一并注销。
  SYNC.setActiveOwner(instance);
  let bindings;
  try {
    bindings = component.setup.call(setupContext, setupContext) || {};
  } finally {
    activeInstance = null;
    SYNC.setActiveOwner(null);
  }

  const state = bindings.state;
  if (!state || typeof state !== 'object') {
    throw new TypeError(`[MVVM] ${component.name} setup() must return { state, ...actions }`);
  }
  if (!Object.prototype.hasOwnProperty.call(state, '$msg')) state.$msg = KniuUI.msg;
  if (!Object.prototype.hasOwnProperty.call(state, '$confirm')) state.$confirm = KniuUI.confirm;
  if (!Object.prototype.hasOwnProperty.call(state, '$refs')) state.$refs = refs;
  exposeBindings(state, bindings);

  async function mount() {
    for (const hook of instance.mounted) {
      const cleanup = await hook();
      if (typeof cleanup === 'function') instance.cleanups.push(cleanup);
    }
    return dispose;
  }

  async function beforeMount() {
    for (const hook of instance.beforeMounted) await hook();
  }

  function dispose() {
    if (instance.stopped) return;
    instance.stopped = true;
    // 先摘掉本作用域注册的数据源，避免卸载过程中又被服务端变更信号触发重放。
    SYNC.disposeOwner(instance);
    instance.unmounted.forEach(function (hook) {
      try { hook(); } catch (error) { console.warn('[MVVM] onUnmounted hook failed:', error); }
    });
    instance.cleanups.reverse().forEach(function (cleanup) {
      try { cleanup(); } catch (error) { console.warn('[MVVM] cleanup failed:', error); }
    });
    instance.timers.forEach(function (timer) {
      if (timer.repeat) globalThis.clearInterval(timer.id);
      else globalThis.clearTimeout(timer.id);
    });
    instance.timers.clear();
  }

  return { state, beforeMount, mount, dispose };
}

function onBeforeMount(hook) {
  registerLifecycleHook('beforeMounted', hook);
}

function onMounted(hook) {
  registerLifecycleHook('mounted', hook);
}

function onUnmounted(hook) {
  registerLifecycleHook('unmounted', hook);
}

function onScopeDispose(cleanup) {
  if (typeof cleanup !== 'function') throw new TypeError('[MVVM] cleanup must be a function');
  requireActiveInstance('onScopeDispose').cleanups.push(cleanup);
}

/**
 * 注册一个数据源，服务端数据变更时自动重放（页面不刷新、业务不写刷新代码）。
 *
 * 必须在 setup() 内同步调用——内部依赖当前控制器作用域做自动注销；
 * 在 usePagination() 等工厂内部调用同样有效（仍处于同一个 setup 同步段）。
 *
 * @param {Function} reload 重新拉数据并写回响应式 state 的函数。
 * @return {Function} 手动注销函数（通常无需调用）。
 */
function autoSync(reload) {
  return SYNC.autoSync(reload);
}

function ref(value) {
  return reactive({ value: value });
}

function subscribeDependencies(dependencies, callback) {
  const stops = [];
  dependencies.forEach(function (keys, dependency) {
    keys.forEach(function (key) { stops.push(observe(dependency, key, callback)); });
  });
  return function () { stops.forEach(function (stop) { stop(); }); };
}

function createReactiveEffect(getter, notify) {
  let stopDependencies = function () { };
  let stopped = false;

  function run() {
    if (stopped) return undefined;
    stopDependencies();
    const collected = collectReactiveReads(getter);
    stopDependencies = subscribeDependencies(collected.dependencies, function () { notify(run); });
    return collected.value;
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    stopDependencies();
  }

  return { run, stop };
}

function computed(getter) {
  if (typeof getter !== 'function') throw new TypeError('[MVVM] computed() expects a getter');
  const result = reactive({ value: undefined });
  const effect = createReactiveEffect(getter, function (run) { result.value = run(); });
  result.value = effect.run();
  if (activeInstance) activeInstance.cleanups.push(effect.stop);
  return result;
}

function traverse(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  Object.keys(value).forEach(function (key) { traverse(value[key], seen); });
  return value;
}

function watch(source, callback, options = {}) {
  const getter = Array.isArray(source)
    ? function () { return source.map(function (item) { return typeof item === 'function' ? item() : item.value; }); }
    : (typeof source === 'function'
      ? source
      : (source && Object.prototype.hasOwnProperty.call(source, 'value')
        ? function () { return source.value; }
        : function () { return traverse(source); }));
  if (typeof callback !== 'function') throw new TypeError('[MVVM] watch() expects a callback');
  let oldValue;
  const effect = createReactiveEffect(getter, function (run) {
    const value = run();
    if (options.deep || !Object.is(value, oldValue)) {
      const previous = oldValue;
      oldValue = value;
      callback(value, previous);
    }
  });
  oldValue = effect.run();
  if (options.immediate) callback(oldValue, undefined);
  if (activeInstance) activeInstance.cleanups.push(effect.stop);
  return effect.stop;
}

function watchEffect(effect) {
  if (typeof effect !== 'function') throw new TypeError('[MVVM] watchEffect() expects a function');
  let cleanup;
  const runner = createReactiveEffect(
    function () {
      if (cleanup) cleanup();
      cleanup = undefined;
      return effect(function (fn) {
        if (typeof fn !== 'function') throw new TypeError('[MVVM] watchEffect cleanup must be a function');
        cleanup = fn;
      });
    },
    function (run) { run(); }
  );
  runner.run();
  const stop = runner.stop;
  runner.stop = function () {
    stop();
    if (cleanup) cleanup();
    cleanup = undefined;
  };
  if (activeInstance) activeInstance.cleanups.push(runner.stop);
  return runner.stop;
}

export default {
  loadController,
  controller,
  createViewModel,
  onBeforeMount,
  onMounted,
  onUnmounted,
  onScopeDispose,
  autoSync,
  watch,
  watchEffect,
  ref,
  computed,
  reactive,
  nextTick
};