const queue = new Set();
const resolved = Promise.resolve();
let pending = false;
let flushing = false;
let currentFlush = null;

function report(error) {
  globalThis.setTimeout(function () { throw error; }, 0);
}

function flushJobs() {
  if (flushing) return currentFlush || resolved;
  flushing = true;
  pending = false;
  try {
    while (queue.size) {
      const jobs = Array.from(queue);
      queue.clear();
      jobs.forEach(function (job) {
        try { job(); } catch (error) { report(error); }
      });
    }
  } finally {
    flushing = false;
    currentFlush = null;
  }
  return resolved;
}

function queueJob(job) {
  if (typeof job !== 'function') throw new TypeError('[Scheduler] job must be a function');
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
  return Object.freeze({ queued: queue.size, pending, flushing });
}

export { flushJobs, getSchedulerState, nextTick, queueJob };
export default { flushJobs, getSchedulerState, nextTick, queueJob };