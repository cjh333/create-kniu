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

  function tick(timestamp) {
    if (paused) return;
    handle = frame(tick);

    tasks.forEach(function runTaskIfDue(task, name) {
      if (paused) return;
      const interval = Number(task.interval()) || 0;

      if (!interval) {
        task.lastRunAt = null;
        return;
      }

      if (task.lastRunAt === null) {
        task.lastRunAt = timestamp;
        return;
      }

      if (timestamp - task.lastRunAt >= interval) {
        task.lastRunAt = timestamp;
        task.run();
      }
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