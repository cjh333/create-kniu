import { resetAllStateStores } from './kniustore.mjs';

const STORAGE_KEY = 'kniu_front_identity';
const LOGOUT_SIGNAL_KEY = 'kniu_auth_logout_at';
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
    // account：本机是否注册过前台账号。退出登录不清零——设备「有账号」这件事不会因登出而改变，
    // 用于区分「初次访客（引导注册）」与「已有账号（直接登录）」。
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

// 前台与后台位于同源的不同标签页时，storage 事件不会在写入页触发，
// 但会在其它页面触发；统一转成组件已订阅的身份变更事件。
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

// 本机是否注册过前台账号：决定被拦截的评论该引导去「登录」还是「注册」。
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
