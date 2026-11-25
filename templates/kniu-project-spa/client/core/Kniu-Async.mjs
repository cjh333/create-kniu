export async function withSubmitting(state, task, key = 'isSubmitting', setState = null) {
  if (state[key]) return undefined;
  const write = typeof setState === 'function' ? setState : (value) => { state[key] = value; };
  write(true);
  try { return await task(); }
  finally { write(false); }
}

export function createTtlSingleFlight(requestFn, options = {}) {
  const ttlSuccess = Number(options.ttlSuccess) || 60000;
  const ttlFail = Number(options.ttlFail) || 1000;
  const isSuccess = typeof options.isSuccess === 'function' ? options.isSuccess : function () { return true; };
  let cache = null;
  let pending = null;
  function load(key) {
    const now = Date.now();
    if (cache && cache.key === key && now - cache.at < cache.ttl) return Promise.resolve(cache.result);
    if (pending && pending.key === key) return pending.promise;
    const rest = Array.prototype.slice.call(arguments, 1);
    const promise = Promise.resolve()
      .then(() => requestFn.apply(null, rest))
      .then((result) => {
        cache = { key: key, result: result, at: Date.now(), ttl: isSuccess(result) ? ttlSuccess : ttlFail };
        return result;
      })
      .finally(() => {
        if (pending && pending.promise === promise) pending = null;
      });
    pending = { key: key, promise: promise };
    return promise;
  }
  return {
    load: load,
    invalidate: function () { cache = null; }
  };
}

export function createCadence(requestFrame, cancelFrame) {
  const nativeRaf = globalThis.requestAnimationFrame?.bind(globalThis);
  const raf = requestFrame || nativeRaf || ((callback) => setTimeout(callback, 16));
  const cancel = cancelFrame || (raf === nativeRaf || (requestFrame && globalThis.requestAnimationFrame === requestFrame)
    ? globalThis.cancelAnimationFrame?.bind(globalThis) : null) || clearTimeout;
  const tasks = new Map();
  const stamps = new Map();
  let frame;
  let stopped = false;
  function tick() {
    if (stopped) return;
    const now = Date.now();
    tasks.forEach((task, name) => {
      const interval = Math.max(0, Number(task.intervalFn()) || 0);
      if (!interval || now - (stamps.get(name) || 0) < interval) return;
      stamps.set(name, now);
      try { task.fn(); } catch (error) { console.error(`[cadence:${name}]`, error); }
    });
    if (!stopped) frame = raf(tick);
  }
  frame = raf(tick);
  function startLoop() {
    if (frame != null || stopped) return;
    frame = raf(tick);
  }
  return {
    every(name, intervalOrFn, fn) {
      const intervalFn = typeof intervalOrFn === 'function' ? intervalOrFn : () => intervalOrFn;
      tasks.set(name, { intervalFn, fn });
      stamps.set(name, 0);
      stopped = false;
      startLoop();
      return this;
    },
    stop() {
      stopped = true;
      tasks.clear();
      stamps.clear();
      if (frame != null) { cancel(frame); frame = null; }
    }
  };
}