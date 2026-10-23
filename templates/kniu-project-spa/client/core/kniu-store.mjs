import { reactive } from './kniu-mvvm.mjs';

export function createStore(initialState = {}, options = {}) {
  const key = String(options.key || 'KNIU_STORE');
  const storage = options.persist === true ? globalThis.localStorage : null;
  let saved = {};
  try { saved = storage ? JSON.parse(storage.getItem(key) || '{}') : {}; } catch {}
  const state = reactive({ ...initialState, ...(saved && typeof saved === 'object' ? saved : {}) });
  const channel = options.sync === true && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`${key}:sync`) : null;
  const persist = () => {
    const snapshot = JSON.parse(JSON.stringify(state));
    try { storage?.setItem(key, JSON.stringify(snapshot)); } catch {}
    channel?.postMessage(snapshot);
    return snapshot;
  };
  channel?.addEventListener('message', (event) => {
    if (event.data && typeof event.data === 'object') Object.assign(state, event.data);
  });
  return Object.freeze({
    state,
    patch(values = {}) { Object.assign(state, values); return persist(); },
    reset() { Object.keys(state).forEach((keyName) => delete state[keyName]); Object.assign(state, initialState); return persist(); },
    persist,
    dispose() { channel?.close(); }
  });
}

export default createStore;
