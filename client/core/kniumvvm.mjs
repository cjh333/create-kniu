import { observe, reactive } from './kniutemplate.mjs';

let activeInstance = null;

export function loadController(name) {
  const controllerName = name.endsWith('Controller') ? name : `${name}Controller`;
  return import(`../controller/${controllerName}.js`).then(function (module) {
    const controller = module[controllerName];
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

export function defineComponent(options = {}) {
  if (typeof options.setup !== 'function') {
    throw new TypeError('[MVVM] defineComponent() requires a setup() function');
  }
  const component = {
    name: options.name || 'AnonymousComponent',
    setup: options.setup,
    __kniuComponent: true,
    async mount(services, root) {
      const viewModel = createViewModel(component, services, root);
      const binding = services.bind(root, viewModel.state);
      const disposeViewModel = await viewModel.mount();
      return function disposeComponent() {
        disposeViewModel?.();
        binding?.dispose?.();
      };
    }
  };
  return Object.freeze(component);
}

export function createViewModel(component, services = {}, root) {
  const instance = {
    mounted: [],
    unmounted: [],
    cleanups: [],
    timers: new Set(),
    stopped: false,
    bindings: null
  };
  const setupContext = createTimerServices({ ...services, root: root || services.root }, instance.timers);

  activeInstance = instance;
  let bindings;
  try {
    bindings = component.setup(setupContext) || instance.bindings || {};
  } finally {
    activeInstance = null;
  }

  const state = bindings.state;
  if (!state || typeof state !== 'object') {
    throw new TypeError(`[MVVM] ${component.name} setup() must register reactive bindings with toRefs()`);
  }
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

export function onMounted(hook) {
  registerLifecycleHook('mounted', hook);
}

export function onUnmounted(hook) {
  registerLifecycleHook('unmounted', hook);
}

export function onScopeDispose(cleanup) {
  if (typeof cleanup !== 'function') throw new TypeError('[MVVM] cleanup must be a function');
  requireActiveInstance('onScopeDispose').cleanups.push(cleanup);
}

export function toRefs(bindings) {
  if (!bindings || typeof bindings !== 'object') {
    throw new TypeError('[MVVM] toRefs() expects a reactive state or setup bindings object');
  }
  const instance = requireActiveInstance('toRefs');
  instance.bindings = Object.prototype.hasOwnProperty.call(bindings, 'state')
    ? bindings
    : { state: bindings };
  return instance.bindings;
}

export function watch(state, key, callback, options = {}) {
  if (!state || typeof key !== 'string' || typeof callback !== 'function') {
    throw new TypeError('[MVVM] watch() expects reactive state, a key and a callback');
  }
  if (options.immediate) callback(state[key], undefined);
  const stop = observe(state, function (change) {
    if (change.key === key) callback(change.value, change.oldValue);
  });
  if (activeInstance) activeInstance.cleanups.push(stop);
  return stop;
}

export { reactive };
