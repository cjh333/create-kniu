import TEMPLATE from './kniutemplate.mjs';
import UI from './kniuui.js';
import REQUEST from './kniurequest.mjs';
import { nextTick } from './kniuscheduler.mjs';

const { collectReactiveReads, observe, reactive } = TEMPLATE;

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
      let binding = null;
      try {
        await viewModel.beforeMount();
        if (!viewModel.isActive()) return function disposeInactiveComponent() { };
        binding = services.bind(root, viewModel.state, refs);
        const disposeViewModel = await viewModel.mount();
        if (!viewModel.isActive()) {
          binding?.dispose?.();
          return function disposeInactiveComponent() { };
        }
        return function disposeComponent() {
          disposeViewModel?.();
          binding?.dispose?.();
        };
      } catch (error) {
        // setup 已登记的订阅、计时器和 effect 必须随失败挂载一起释放。
        viewModel.dispose();
        binding?.dispose?.();
        throw error;
      }
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
    abortController: typeof AbortController === 'function' ? new AbortController() : null,
    detachParentAbort: null,
    stopped: false,
    bindings: null
  };
  const setupContext = createTimerServices({
    ...services,
    root: root || services.root,
    $refs: refs,
    refs: refs,
    signal: instance.abortController?.signal,
    request(options) {
      if (Array.isArray(options)) {
        return REQUEST(options.map(function (option) {
          return { ...(option || {}), signal: instance.abortController?.signal };
        }));
      }
      return REQUEST({ ...(options || {}), signal: instance.abortController?.signal });
    }
  }, instance.timers);
  Object.assign(setupContext, {
    reactive, ref, computed, watch, watchEffect, nextTick,
    onBeforeMount, onMounted, onUnmounted, onScopeDispose
  });
  setupContext.$msg = UI.msg;
  setupContext.$confirm = UI.confirm;

  activeInstance = instance;
  let bindings;
  try {
    bindings = component.setup.call(setupContext, setupContext) || {};
  } finally {
    activeInstance = null;
  }

  const state = bindings.state;
  if (!state || typeof state !== 'object') {
    throw new TypeError(`[MVVM] ${component.name} setup() must return { state, ...actions }`);
  }
  if (!Object.prototype.hasOwnProperty.call(state, '$msg')) state.$msg = UI.msg;
  if (!Object.prototype.hasOwnProperty.call(state, '$confirm')) state.$confirm = UI.confirm;
  if (!Object.prototype.hasOwnProperty.call(state, '$refs')) state.$refs = refs;
  exposeBindings(state, bindings);

  const parentSignal = services.signal;
  if (parentSignal?.addEventListener) {
    const abortFromParent = function () { dispose(); };
    parentSignal.addEventListener('abort', abortFromParent, { once: true });
    instance.detachParentAbort = function () {
      parentSignal.removeEventListener?.('abort', abortFromParent);
    };
    if (parentSignal.aborted) abortFromParent();
  }

  async function mount() {
    for (const hook of instance.mounted) {
      if (instance.stopped) break;
      const cleanup = await hook();
      if (instance.stopped) {
        if (typeof cleanup === 'function') cleanup();
        break;
      }
      if (typeof cleanup === 'function') instance.cleanups.push(cleanup);
    }
    return dispose;
  }

  async function beforeMount() {
    for (const hook of instance.beforeMounted) {
      if (instance.stopped) break;
      await hook();
      if (instance.stopped) break;
    }
  }

  function dispose() {
    if (instance.stopped) return;
    instance.stopped = true;
    instance.detachParentAbort?.();
    instance.detachParentAbort = null;
    instance.abortController?.abort();
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

  return { state, beforeMount, mount, dispose, isActive: function () { return !instance.stopped; } };
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

  return { run, stop, isActive: function () { return !stopped; } };
}

function computed(getter) {
  if (typeof getter !== 'function') throw new TypeError('[MVVM] computed() expects a getter');
  const result = reactive({ value: undefined });
  let effect;
  effect = createReactiveEffect(getter, function (run) {
    if (effect.isActive()) result.value = run();
  });
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

function snapshotWatchValue(value, seen = new WeakMap()) {
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  if (value instanceof Date) return new Date(value.getTime());
  const copy = Array.isArray(value) ? [] : {};
  seen.set(value, copy);
  Object.keys(value).forEach(function (key) {
    copy[key] = snapshotWatchValue(value[key], seen);
  });
  return copy;
}

function watch(source, callback, options = {}) {
  const isRefSource = function (value) {
    return Boolean(value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value'));
  };
  const isReactiveSource = function (value) {
    return Boolean(value && typeof value === 'object' && !isRefSource(value));
  };
  const directReactiveSource = !Array.isArray(source) && isReactiveSource(source);
  const arrayHasReactiveSource = Array.isArray(source) && source.some(isReactiveSource);
  const shouldDeep = options.deep === true || directReactiveSource || arrayHasReactiveSource;
  const readValue = function (item) {
    const value = typeof item === 'function' ? item() : (isRefSource(item) ? item.value : item);
    return shouldDeep ? traverse(value) : value;
  };
  const getter = Array.isArray(source)
    ? function () { return source.map(readValue); }
    : (typeof source === 'function' || isRefSource(source)
      ? function () { return readValue(source); }
      : function () { return traverse(source); });
  if (typeof callback !== 'function') throw new TypeError('[MVVM] watch() expects a callback');
  let oldValue;
  const effect = createReactiveEffect(getter, function (run) {
    if (!effect.isActive()) return;
    const value = run();
    if (shouldDeep || !Object.is(value, oldValue)) {
      const previous = oldValue;
      oldValue = shouldDeep ? snapshotWatchValue(value) : value;
      callback(value, previous);
    }
  });
  const initialValue = effect.run();
  oldValue = shouldDeep ? snapshotWatchValue(initialValue) : initialValue;
  if (options.immediate) callback(initialValue, undefined);
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
  watch,
  watchEffect,
  ref,
  computed,
  reactive,
  nextTick
};
