const EMPTY_IDENTITY = Object.freeze({ token: '', name: '', nickname: '', avatar: '', email: '', id: 0, account: false });

function createIdentity(options = {}) {
  const storageKey = String(options.storageKey || 'KNIU_CLI_IDENTITY');
  const storage = options.persist === true ? globalThis.localStorage : globalThis.sessionStorage;
  let value = { ...EMPTY_IDENTITY };
  const listeners = new Set();
  const notify = () => listeners.forEach((listener) => listener({ ...value }));
  const read = () => {
    try {
      const stored = JSON.parse(storage?.getItem(storageKey) || 'null');
      if (stored && typeof stored === 'object') value = { ...EMPTY_IDENTITY, ...stored };
    } catch { value = { ...EMPTY_IDENTITY }; }
    return { ...value };
  };
  const write = () => {
    try { storage?.setItem(storageKey, JSON.stringify(value)); } catch { }
    globalThis.dispatchEvent?.(new CustomEvent('kniu-identity-change', { detail: { ...value } }));
    notify();
  };
  read();
  const isLoggedIn = () => Boolean(value.account || Number(value.id || 0) > 0 || (value.token && String(value.token).trim() !== ''));
  return Object.freeze({
    getIdentity: () => ({ ...value }),
    setIdentity(next = {}) { value = { ...EMPTY_IDENTITY, ...next }; write(); return { ...value }; },
    clearIdentity() { value = { ...EMPTY_IDENTITY }; try { storage?.removeItem(storageKey); } catch { } write(); },
    isLoggedIn,
    hasAccount: isLoggedIn,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  });
}

export { EMPTY_IDENTITY, createIdentity };
export default createIdentity;