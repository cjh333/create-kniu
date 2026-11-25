import { reactive } from './Kniu-MVVM.mjs';

export function createStore(initialState = {}, options = {}) {
  const key = String(options.key || 'KNIU_STORE');
  const storage = options.persist === true ? globalThis.localStorage : null;
  let saved = {};
  try { saved = storage ? JSON.parse(storage.getItem(key) || '{}') : {}; } catch { }
  const state = reactive({ ...initialState, ...(saved && typeof saved === 'object' ? saved : {}) });
  const channel = options.sync === true && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`${key}:sync`) : null;
  const STORE_MSG_VERSION = 1;
  const broadcastKey = `${key}:v${STORE_MSG_VERSION}`;
  const persist = () => {
    const snapshot = JSON.parse(JSON.stringify(state));
    try { storage?.setItem(key, JSON.stringify(snapshot)); } catch { }
    channel?.postMessage({ __kniuKey: broadcastKey, state: snapshot });
    return snapshot;
  };
  channel?.addEventListener('message', (event) => {
    if (!event.data || typeof event.data !== 'object') return;
    if (event.data.__kniuKey !== broadcastKey || !event.data.state) return;
    Object.assign(state, event.data.state);
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