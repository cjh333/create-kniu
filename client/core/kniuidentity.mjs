import { resetAllStateStores } from './kniustore.mjs';

const STORAGE_KEY = 'KNIU_SYSTEM_FRONT_IDENTITY';
const LOGOUT_SIGNAL_KEY = 'KNIU_SYSTEM_AUTH_LOGOUT_TIME';
const listeners = new Set();

function normalizeNickname(value) {
  const nickname = String(value == null ? '' : value).trim().replace(/\s+/g, ' ').slice(0, 30);
  const chars = Array.from(nickname);
  if (chars.length > 0) chars[0] = chars[0].toLocaleLowerCase();
  return chars.join('');
}

function createToken() {
  const bytes = new Uint8Array(32);
  globalThis.crypto?.getRandomValues?.(bytes);
  if (!bytes.some(Boolean)) {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function readStored() {
  try {
    const value = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch (_) {
    return {};
  }
}

function persist(identity) {
  try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(identity)); } catch (_) { }
}

function notifyIdentityChange(identity) {
  globalThis.dispatchEvent?.(new CustomEvent('kniu-identity-change', { detail: identity }));
  [...listeners].forEach(function (listener) {
    try { listener(identity); } catch (error) { console.warn('[KniuIdentity] subscriber failed:', error); }
  });
}

function getIdentity() {
  const value = readStored();
  const identity = {
    token: /^[a-f0-9]{64}$/i.test(value?.token || '') ? value.token.toLowerCase() : createToken(),
    nickname: normalizeNickname(value?.nickname),
    name: String(value?.name || '').trim(),
    avatar: String(value?.avatar || '').trim(),
    account: value?.account ? 1 : 0
  };
  persist(identity);
  return identity;
}

function setIdentity(value) {
  const current = getIdentity();
  const identity = {
    token: /^[a-f0-9]{64}$/i.test(value?.token || '') ? value.token.toLowerCase() : current.token,
    nickname: normalizeNickname(value?.nickname),
    name: String(value?.name || current.name || '').trim(),
    avatar: String(value?.avatar === undefined ? current.avatar : value.avatar || '').trim(),
    account: value?.account === undefined || value?.account === null ? current.account : (value.account ? 1 : 0)
  };
  if (identity.token && current.token && identity.token !== current.token) {
    resetAllStateStores();
  }
  persist(identity);
  notifyIdentityChange(identity);
  return identity;
}

function clearIdentity() {
  const account = readStored().account ? 1 : 0;
  resetAllStateStores();
  try { globalThis.localStorage?.removeItem(STORAGE_KEY); } catch (_) { }
  const identity = { token: createToken(), nickname: '', name: '', avatar: '', account: account };
  persist(identity);
  notifyIdentityChange(identity);
  return identity;
}

if (typeof globalThis !== 'undefined' && typeof globalThis.addEventListener === 'function') {
  globalThis.addEventListener('storage', function (event) {
    if (event.key === STORAGE_KEY) {
      const identity = getIdentity();
      notifyIdentityChange(identity);
      return;
    }
    if (event.key === LOGOUT_SIGNAL_KEY && event.newValue) clearIdentity();
  });
}

function hasAccount() {
  return getIdentity().account === 1;
}

function subscribe(listener) {
  if (typeof listener !== 'function') return function unsubscribe() { };
  listeners.add(listener);
  return function unsubscribe() { listeners.delete(listener); };
}

export { clearIdentity, getIdentity, hasAccount, normalizeNickname, setIdentity, subscribe };
export default { clearIdentity, getIdentity, hasAccount, normalizeNickname, setIdentity, subscribe };