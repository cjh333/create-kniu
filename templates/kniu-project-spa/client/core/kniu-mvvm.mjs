import { kniuWarn, KNDEBUG } from './Kniu-Debug.mjs';

const targetEffects = new WeakMap();
const activeEffects = [];
const subscribers = new Set();
const ITERATE_KEY = Symbol.for('kniu:iterate');
const KEYS_KEY = Symbol.for('kniu:keys');
const notify = () => { if (subscribers.size) subscribers.forEach((callback) => callback()); };
export const subscribeReactive = (callback) => { subscribers.add(callback); return () => subscribers.delete(callback); };

export function nextTick(callback) {
  return Promise.resolve().then(callback);
}

function track(target, key) {
  const effect = activeEffects.at(-1);
  if (!effect) return;
  let keys = targetEffects.get(target);
  if (!keys) targetEffects.set(target, keys = new Map());
  let effects = keys.get(key);
  if (!effects) keys.set(key, effects = new Set());
  effects.add(effect);
  effect.deps.add(effects);
}

function trigger(target, key, type = 'set') {
  const keys = targetEffects.get(target);
  if (!keys) return;
  const effects = new Set([...(keys.get(key) || []), ...(keys.get(ITERATE_KEY) || [])]);
  if (type === 'add' || type === 'delete') (keys.get(KEYS_KEY) || []).forEach((effect) => effects.add(effect));
  if (Array.isArray(target) && key !== 'length' && /^(?:\d+|length)$/.test(String(key))) {
    (keys.get('length') || []).forEach((effect) => effects.add(effect));
  }
  effects.forEach((effect) => effect.scheduler ? effect.scheduler() : effect.run());
  notify();
}

export function effect(callback, { lazy = false, scheduler } = {}) {
  const runner = {
    deps: new Set(),
    stopped: false,
    stopHooks: [],
    addStopHook(hook) { if (typeof hook === 'function') runner.stopHooks.push(hook); },
    run() {
      if (runner.stopped) return;
      runner.deps.forEach((dependency) => dependency.delete(runner));
      runner.deps.clear();
      activeEffects.push(runner);
      try { return callback(); } finally { activeEffects.pop(); }
    },
    stop() {
      if (runner.stopped) return;
      runner.stopped = true;
      runner.deps.forEach((dependency) => dependency.delete(runner));
      runner.deps.clear();
      runner.stopHooks.splice(0).forEach((hook) => hook());
    }
  };
  runner.scheduler = scheduler;
  if (!lazy) runner.run();
  return runner;
}

function isPlainData(target) {
  const prototype = Object.getPrototypeOf(target);
  return prototype === null || prototype === Object.prototype || prototype === Array.prototype;
}

export function reactive(initial = {}) {
  const cache = new WeakMap();
  const wrap = (target) => {
    if (!target || typeof target !== 'object') return target;
    if (!isPlainData(target)) return target;
    if (cache.has(target)) return cache.get(target);
    const proxy = new Proxy(target, {
      get(object, key, receiver) { track(object, key); return wrap(Reflect.get(object, key, receiver)); },
      ownKeys(object) { track(object, KEYS_KEY); return Reflect.ownKeys(object); },
      set(object, key, value, receiver) {
        const changed = !Object.is(object[key], value);
        const existed = Reflect.has(object, key);
        const result = Reflect.set(object, key, value, receiver);
        if (changed) trigger(object, key, existed ? 'set' : 'add');
        return result;
      },
      deleteProperty(object, key) {
        const existed = Reflect.has(object, key);
        const result = Reflect.deleteProperty(object, key);
        if (existed) trigger(object, key, 'delete');
        return result;
      }
    });
    cache.set(target, proxy);
    return proxy;
  };
  return wrap(initial);
}

export function computed(getter) {
  let dirty = true;
  let value;
  const dependents = new Set();
  const runner = effect(getter, { lazy: true, scheduler: () => { dirty = true; dependents.forEach((dependent) => dependent.scheduler ? dependent.scheduler() : dependent.run()); } });
  return {
    get value() {
      const parent = activeEffects.at(-1);
      if (parent && !dependents.has(parent)) {
        dependents.add(parent);
        parent.addStopHook?.(() => dependents.delete(parent));
      }
      if (dirty) { value = runner.run(); dirty = false; }
      return value;
    },
    toString() { return String(this.value); },
    valueOf() { return this.value; },
    stop() { dependents.clear(); runner.stop(); }
  };
}

export function watch(source, callback = () => { }, options = {}) {
  const getter = typeof source === 'function' ? source : () => source.value;
  const { immediate = true } = options;
  let oldValue = getter();
  if (immediate) callback(oldValue, undefined);
  const watcher = effect(() => {
    const value = getter();
    if (!Object.is(value, oldValue)) { const previous = oldValue; oldValue = value; callback(value, previous); }
  });
  return () => watcher.stop();
}

export function setup(setupFunction) {
  return async (context = {}) => {
    const lifecycle = { beforeMount: [], mounted: [], beforeUnmount: [], unmounted: [] };
    const getRoute = typeof context.getRoute === 'function' ? context.getRoute : () => ({ path: '', params: {}, query: {} });
    let lastRouteSnapshot = null;
    let lastRouteHash = '';
    const routeDefaultSource = () => {
      const r = getRoute();
      const hash = JSON.stringify({ path: r.path, params: r.params, query: String(r.query) });
      if (lastRouteHash === hash) return lastRouteSnapshot;
      lastRouteHash = hash;
      lastRouteSnapshot = { path: r.path, params: r.params, query: r.query };
      return lastRouteSnapshot;
    };
    const ownedControllerKey = String(context?.controllerKey || '');
    const resolveControllerKey = typeof context?.resolveControllerKey === 'function' ? context.resolveControllerKey : null;
    const routeWatch = function (source, callback, options) {
      const args = Array.from(arguments);
      if (args.length === 1 && typeof source === 'function') {
        return watch(routeDefaultSource, function (snapshot, previous) {
          if (ownedControllerKey && resolveControllerKey) {
            const key = resolveControllerKey(String(snapshot?.path || ''));
            if (key && key !== ownedControllerKey) return;
          }
          source(snapshot, previous);
        });
      }
      return watch(source, callback, options);
    };
    const api = {
      context,
      request: context.request,
      getRoute,
      reactive,
      computed,
      watch: routeWatch,
      nextTick,
      refs: {},
      onBeforeMount: (hook) => lifecycle.beforeMount.push(hook),
      onMounted: (hook) => lifecycle.mounted.push(hook),
      onBeforeUnmount: (hook) => lifecycle.beforeUnmount.push(hook),
      onUnmounted: (hook) => lifecycle.unmounted.push(hook)
    };
    const setupResult = await setupFunction(api) || {};
    const model = {};
    const stateResult = setupResult.state && typeof setupResult.state === 'object' ? setupResult.state : null;
    const descriptors = Object.getOwnPropertyDescriptors(setupResult);
    for (const [key, desc] of Object.entries(descriptors)) {
      if (typeof desc.get === 'function') {
        kniuWarn(KNDEBUG.MVC, '[KNIU] setup() 返回对象含 getter 字段 "' + key + '"，将被求值为静态值，请改用 state 或 computed');
      }
    }
    for (const [key, value] of Object.entries(setupResult)) {
      if (value && typeof value === 'object' && 'value' in value && typeof value.value !== 'function') {
        Object.defineProperty(model, key, { enumerable: true, get: () => value.value });
      } else model[key] = value;
      if (key === 'state' && stateResult) {
        Object.keys(stateResult).forEach((stateKey) => {
          if (stateKey in model) return;
          Object.defineProperty(model, stateKey, {
            enumerable: true,
            configurable: true,
            get: () => stateResult[stateKey],
            set: (value) => { stateResult[stateKey] = value; }
          });
        });
      }
    }
    Object.defineProperty(model, '__kniuLifecycle', {
      enumerable: false,
      value: Object.fromEntries(Object.entries(lifecycle).reduce((entries, [name, callbacks]) => {
        entries.push([name, async (payload) => { for (const callback of callbacks) await callback(payload); }]);
        return entries;
      }, []))
    });
    Object.defineProperty(model, '__kniuSubscribe', {
      enumerable: false, value: (callback) => {
        if (!stateResult) return () => { };
        let initialized = false;
        const runner = effect(() => {
          Object.keys(stateResult).forEach((k) => { stateResult[k]; });
          if (initialized) callback();
          initialized = true;
        });
        return () => runner.stop();
      }
    });
    return model;
  };
}