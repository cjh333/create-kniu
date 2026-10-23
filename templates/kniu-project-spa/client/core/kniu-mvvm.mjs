const targetEffects = new WeakMap();
const activeEffects = [];
const subscribers = new Set();
const notify = () => subscribers.forEach((callback) => callback());
export const subscribeReactive = (callback) => { subscribers.add(callback); return () => subscribers.delete(callback); };

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
  if (!keys) { notify(); return; }
  const effects = new Set([...(keys.get(key) || []), ...(keys.get(Symbol.for('kniu:iterate')) || [])]);
  if (type === 'add' || type === 'delete') (keys.get(Symbol.for('kniu:keys')) || []).forEach((effect) => effects.add(effect));
  effects.forEach((effect) => effect.scheduler ? effect.scheduler() : effect.run());
  notify();
}

export function effect(callback, { lazy = false, scheduler } = {}) {
  const runner = {
    deps: new Set(),
    stopped: false,
    run() {
      if (runner.stopped) return;
      runner.deps.forEach((dependency) => dependency.delete(runner));
      runner.deps.clear();
      activeEffects.push(runner);
      try { return callback(); } finally { activeEffects.pop(); }
    },
    stop() { runner.stopped = true; runner.deps.forEach((dependency) => dependency.delete(runner)); runner.deps.clear(); }
  };
  runner.scheduler = scheduler;
  if (!lazy) runner.run();
  return runner;
}

export function reactive(initial = {}) {
  const cache = new WeakMap();
  const wrap = (target) => {
    if (!target || typeof target !== 'object') return target;
    if (cache.has(target)) return cache.get(target);
    const proxy = new Proxy(target, {
      get(object, key, receiver) { track(object, key); return wrap(Reflect.get(object, key, receiver)); },
      ownKeys(object) { track(object, Symbol.for('kniu:keys')); return Reflect.ownKeys(object); },
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
      if (parent) dependents.add(parent);
      if (dirty) { value = runner.run(); dirty = false; }
      return value;
    },
    toString() { return String(this.value); },
    valueOf() { return this.value; }
  };
}

export function watch(source, callback = () => { }) {
  const getter = typeof source === 'function' ? source : () => source.value;
  let oldValue = getter();
  const watcher = effect(() => {
    const value = getter();
    if (!Object.is(value, oldValue)) { const previous = oldValue; oldValue = value; callback(value, previous); }
  });
  return () => watcher.stop();
}

export function setup(setupFunction) {
  return async (context = {}) => {
    const lifecycle = { beforeMount: [], mounted: [], beforeUnmount: [], unmounted: [] };
    const api = {
      context,
      request: context.request,
      reactive,
      computed,
      watch,
      onBeforeMount: (hook) => lifecycle.beforeMount.push(hook),
      onMounted: (hook) => lifecycle.mounted.push(hook),
      onBeforeUnmount: (hook) => lifecycle.beforeUnmount.push(hook),
      onUnmounted: (hook) => lifecycle.unmounted.push(hook)
    };
    const setupResult = await setupFunction(api) || {};
    const model = {};
    const stateResult = setupResult.state && typeof setupResult.state === 'object' ? setupResult.state : null;
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
    Object.defineProperty(model, '__kniuSubscribe', { enumerable: false, value: (callback) => {
      if (!stateResult) return () => {};
      const runner = effect(() => {
        Object.keys(stateResult).forEach((key) => stateResult[key]);
        callback();
      });
      return () => runner.stop();
    } });
    return model;
  };
}

