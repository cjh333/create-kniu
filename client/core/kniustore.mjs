const stores = new Map();

function normalizeName(name) {
  const value = String(name == null ? '' : name).trim();
  if (!value) throw new TypeError('[KniuStore] store name is required');
  return value;
}

function snapshot(record) {
  return freezeSnapshot(cloneValue(record.state));
}

function freezeSnapshot(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) value.forEach(function (item) { freezeSnapshot(item, seen); });
  else if (value instanceof Map) value.forEach(function (item, key) {
    freezeSnapshot(key, seen);
    freezeSnapshot(item, seen);
  });
  else if (value instanceof Set) value.forEach(function (item) { freezeSnapshot(item, seen); });
  else Object.keys(value).forEach(function (key) { freezeSnapshot(value[key], seen); });
  return Object.freeze(value);
}

function cloneValue(value, seen = new WeakMap()) {
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);
  if (value instanceof Map) {
    const output = new Map();
    seen.set(value, output);
    value.forEach(function (item, key) { output.set(cloneValue(key, seen), cloneValue(item, seen)); });
    return output;
  }
  if (value instanceof Set) {
    const output = new Set();
    seen.set(value, output);
    value.forEach(function (item) { output.add(cloneValue(item, seen)); });
    return output;
  }
  if (Array.isArray(value)) {
    const output = [];
    seen.set(value, output);
    value.forEach(function (item) { output.push(cloneValue(item, seen)); });
    return output;
  }
  const output = {};
  seen.set(value, output);
  Object.keys(value).forEach(function (key) { output[key] = cloneValue(value[key], seen); });
  return output;
}

function isSameValue(left, right, seen = new WeakMap()) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (left.constructor !== right.constructor) return false;
  if (left instanceof Date) return left.getTime() === right.getTime();
  if (left instanceof RegExp) return left.source === right.source && left.flags === right.flags;
  if (seen.get(left) === right) return true;
  seen.set(left, right);
  if (left instanceof Map) {
    if (left.size !== right.size) return false;
    for (const [key, value] of left) {
      if (!right.has(key) || !isSameValue(value, right.get(key), seen)) return false;
    }
    return true;
  }
  if (left instanceof Set) {
    if (left.size !== right.size) return false;
    return [...left].every(function (value) { return right.has(value); });
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(function (key) {
    return Object.prototype.hasOwnProperty.call(right, key) && isSameValue(left[key], right[key], seen);
  });
}

function ensureRecord(name, initialState) {
  const key = normalizeName(name);
  let record = stores.get(key);
  if (!record) {
    record = {
      initialState: initialState && typeof initialState === 'object' ? cloneValue(initialState) : {},
      state: initialState && typeof initialState === 'object' ? cloneValue(initialState) : {},
      revision: 0,
      listeners: new Set(),
      records: new Map()
    };
    stores.set(key, record);
  }
  return record;
}

async function notify(record, type, payload) {
  record.revision += 1;
  const action = Object.freeze({
    type: String(type || 'change'),
    payload: freezeSnapshot(cloneValue(payload)),
    revision: record.revision
  });
  const currentState = snapshot(record);
  const handlers = [...record.listeners];
  await Promise.all(handlers.map(async function (handler) {
    try {
      await handler(currentState, action);
    } catch (error) {
      console.warn('[KniuStore] state subscriber failed:', error);
    }
  }));
  return action;
}

export function createStateStore(name, initialState = {}) {
  const storeName = normalizeName(name);
  const record = ensureRecord(storeName, initialState);
  return Object.freeze({
    name: storeName,
    getState() {
      return snapshot(record);
    },
    async setState(nextState, type = 'set') {
      record.state = nextState && typeof nextState === 'object' ? cloneValue(nextState) : {};
      return notify(record, type, record.state);
    },
    async patchState(patch, type = 'patch') {
      const changes = patch && typeof patch === 'object' ? patch : {};
      const safeChanges = cloneValue(changes);
      Object.assign(record.state, safeChanges);
      return notify(record, type, safeChanges);
    },
    dispatch(type, payload) {
      return notify(record, type, payload);
    },
    async track(recordKey, value, type = 'changed') {
      const key = normalizeName(recordKey);
      const current = cloneValue(value);
      const previous = record.records.get(key);
      if (previous !== undefined && isSameValue(previous, current)) {
        return Object.freeze({ changed: false, type: String(type || 'changed'), revision: record.revision });
      }
      record.records.set(key, current);
      const action = await notify(record, type, Object.freeze({
        key,
        previous: previous === undefined ? null : cloneValue(previous),
        current: cloneValue(current)
      }));
      return Object.freeze({ changed: true, ...action });
    },
    subscribe(handler) {
      if (typeof handler !== 'function') return function unsubscribe() { };
      record.listeners.add(handler);
      return function unsubscribe() {
        record.listeners.delete(handler);
      };
    }
  });
}

export function removeStateStore(name) {
  return stores.delete(normalizeName(name));
}

export function resetAllStateStores() {
  stores.forEach(function (record) {
    record.state = cloneValue(record.initialState);
    record.records.clear();
    record.revision = 0;
  });
}

export default { createStateStore, removeStateStore, resetAllStateStores };