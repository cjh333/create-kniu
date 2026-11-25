export function createScope(parent) {
  if (typeof parent === 'string'
    || (parent && typeof parent === 'object' && typeof parent.name === 'string'
      && typeof parent.get !== 'function' && typeof parent.set !== 'function')) {
    const options = typeof parent === 'string' ? { name: parent, value: arguments[1] } : parent;
    return {
      name: `scope:${options.name}`,
      install() { scopeSet(options.name, options.value); }
    };
  }
  const target = parent === undefined ? (typeof globalThis !== 'undefined' ? globalThis : null) : parent;
  const own = new Map();
  const scope = {
    parent: target,
    get(key) {
      if (own.has(key)) return own.get(key);
      if (!target) return undefined;
      return typeof target.get === 'function' ? target.get(key) : target[key];
    },
    set(key, value) {
      own.set(key, value);
      if (target && typeof target.get !== 'function') target[key] = value;
      return value;
    },
    delete(key) {
      own.delete(key);
      if (target && typeof target.get !== 'function') delete target[key];
      return true;
    },
    has(key) { return own.has(key); },
    keys() { return [...own.keys()]; },
    clear() {
      for (const key of own.keys()) scope.delete(key);
      own.clear();
    }
  };
  return scope;
}

let defaultScope = null;

export function getDefaultScope() {
  if (!defaultScope) defaultScope = createScope();
  return defaultScope;
}

export function setDefaultScope(scope) {
  defaultScope = scope || null;
  return getDefaultScope();
}

export function withScope(scope, fn) {
  const previous = getDefaultScope();
  defaultScope = scope || previous;
  try { return fn(); }
  finally { defaultScope = previous; }
}

export function scopeGet(key) { return getDefaultScope().get(key); }
export function scopeSet(key, value) { return getDefaultScope().set(key, value); }
export function scopeDelete(key) { return getDefaultScope().delete(key); }
export function scopeKeys() { return getDefaultScope().keys(); }