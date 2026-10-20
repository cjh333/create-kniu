const MAX_BACKOFF_STEPS = 3;

function createCadence(requestFrame, cancelFrame) {
  const frame = typeof requestFrame === 'function'
    ? requestFrame
    : globalThis.requestAnimationFrame.bind(globalThis);
  const unframe = typeof cancelFrame === 'function'
    ? cancelFrame
    : (typeof globalThis.cancelAnimationFrame === 'function'
      ? globalThis.cancelAnimationFrame.bind(globalThis)
      : null);
  const tasks = new Map();
  let handle = 0;
  let paused = false;

  function intervalOf(task) {
    const base = Number(task.interval()) || 0;
    if (!base) return 0;

    return base * Math.pow(2, Math.min(task.failures, MAX_BACKOFF_STEPS));
  }

  function tick(timestamp) {
    if (paused) return;
    handle = frame(tick);

    tasks.forEach(function runTaskIfDue(task, name) {
      if (paused) return;
      const interval = intervalOf(task);

      if (!interval) {
        task.lastRunAt = null;
        return;
      }

      if (task.lastRunAt === null) {
        task.lastRunAt = timestamp;
        return;
      }

      if (timestamp - task.lastRunAt < interval) return;

      task.lastRunAt = timestamp;

      if (task.pending) return;

      const outcome = task.run();
      if (!outcome || typeof outcome.then !== 'function') return;

      task.pending = true;
      const settle = function settle(failed) {
        task.pending = false;
        task.failures = failed ? task.failures + 1 : 0;
      };
      outcome.then(function onFulfilled() { settle(false); }, function onRejected() { settle(true); });
    });
  }

  function start() {
    if (handle) return;
    paused = false;
    handle = frame(tick);
  }

  function stop() {
    paused = true;
    if (handle && unframe) unframe(handle);
    handle = 0;
  }

  function every(name, interval, run) {
    if (typeof name !== 'string' || !name) throw new TypeError('[Cadence] name must be a non-empty string');
    if (typeof run !== 'function') throw new TypeError('[Cadence] runner must be a function');

    tasks.set(name, {
      interval: typeof interval === 'function' ? interval : function readInterval() { return interval; },
      run: run,
      lastRunAt: null,
      pending: false,
      failures: 0,
    });
    start();

    return function removeTask() { tasks.delete(name); };
  }

  return {
    every: every,
    start: start,
    stop: stop,
    isRunning: function isRunning() { return !paused && handle !== 0; },
    getTasks: function getTasks() { return Array.from(tasks.keys()); },
  };
}

export { createCadence };
export default { createCadence };