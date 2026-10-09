/**
 * rAF 驱动的多任务节奏调度器。
 *
 * 不变量：
 * 1. **每帧每任务最多跑一次** —— 画面卡顿或标签页挂起 10 分钟后回来的首帧，只补跑一次
 *    而不是补跑 N 次（`setInterval` 与「回调里 while 追债」都会雪崩）。
 * 2. **`interval` 可传函数；返回假值 = 未就绪** —— 不跑、也不起算；变成真值的那一帧只起算，
 *    满一个间隔才第一次跑（防「首屏刚拿到间隔就立刻再发一次请求」）。
 * 3. **`stop()` / `start()` 对称（暂停/恢复）** —— `stop()` 只取消挂起的那一帧、不清各任务的
 *    起算点，恢复后「已过间隔」的任务立刻补一次。
 * 4. **同一任务不重叠** —— `run()` 返回 thenable 时，上一轮没落地就跳过本轮；失败按 2^n 退避
 *    （最多 8 倍）。这一条是「后端一慢，请求成倍叠加」的兜底闸门：即使间隔配错、或后端卡死，
 *    单个任务同时在途的请求也**永远只有 1 个**。
 */

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
