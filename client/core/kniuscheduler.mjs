const TIERS = ['pre', 'render', 'post'];
const MAX_FLUSH_CYCLES = 100;
const queues = { pre: new Set(), render: new Set(), post: new Set() };
const resolved = Promise.resolve();
let pending = false;
let flushing = false;
let currentFlush = null;

function report(error) {
  globalThis.setTimeout(function () { throw error; }, 0);
}

function hasJobs() {
  return queues.pre.size > 0 || queues.render.size > 0 || queues.post.size > 0;
}

function flushJobs() {
  if (flushing) return currentFlush || resolved;
  flushing = true;
  pending = false;
  try {
    let cycles = 0;
    while (hasJobs()) {
      if (++cycles > MAX_FLUSH_CYCLES) {
        report(new Error('[Scheduler] 超过 ' + MAX_FLUSH_CYCLES + ' 轮仍在入队，疑似回调互相触发，已停止本轮 flush'));
        break;
      }
      for (let i = 0; i < TIERS.length; i++) {
        const queue = queues[TIERS[i]];
        if (!queue.size) continue;
        const jobs = Array.from(queue);
        queue.clear();
        jobs.forEach(function (job) {
          try { job(); } catch (error) { report(error); }
        });
      }
    }
  } finally {
    flushing = false;
    currentFlush = null;
  }
  return resolved;
}

function queueJob(job, tier) {
  if (typeof job !== 'function') throw new TypeError('[Scheduler] job must be a function');
  const queue = queues[tier] || queues.render;
  queue.add(job);
  if (!pending && !flushing) {
    pending = true;
    currentFlush = resolved.then(flushJobs);
  }
  return currentFlush || resolved;
}

function nextTick(callback) {
  const promise = currentFlush || resolved;
  return typeof callback === 'function' ? promise.then(callback) : promise;
}

function getSchedulerState() {
  return Object.freeze({
    queued: queues.pre.size + queues.render.size + queues.post.size,
    pre: queues.pre.size,
    render: queues.render.size,
    post: queues.post.size,
    pending,
    flushing,
  });
}

export { flushJobs, getSchedulerState, nextTick, queueJob };
export default { flushJobs, getSchedulerState, nextTick, queueJob };