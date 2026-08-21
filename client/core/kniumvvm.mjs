import KniuTemplate from './kniutemplate.mjs';
import KniuUI from './kniuui.js';
import { nextTick } from './kniuscheduler.mjs';

const { collectReactiveReads, observe, reactive } = KniuTemplate;

let activeInstance = null;

function loadController(name) {
  const controllerName = name.endsWith('Controller') ? name : `${name}Controller`;
  return import(`../controller/${controllerName}.js`).then(function (module) {
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
    mounted: [],
    unmounted: [],
    cleanups: [],
    timers: new Set(),
    stopped: false,
    bindings: null
  };
  const setupContext = createTimerServices({ ...services, root: root || services.root, $refs: refs, refs: refs }, instance.timers);
  Object.assign(setupContext, { reactive, ref, computed, watch, watchEffect, onMounted, onUnmounted, onScopeDispose });
  setupContext.$msg = KniuUI.msg;
  setupContext.$confirm = KniuUI.confirm;

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

  function dispose() {
    if (instance.stopped) return;
    instance.stopped = true;
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

  return { state, mount, dispose };
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
