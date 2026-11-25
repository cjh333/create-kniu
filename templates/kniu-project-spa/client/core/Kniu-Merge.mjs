const isPlainObject = (value) => !!value && typeof value === 'object'
  && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

export function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object') return base;
  const result = isPlainObject(base) ? { ...base } : {};
  Object.keys(patch).forEach((key) => {
    const value = patch[key];
    if (value === undefined) return;
    const current = result[key];
    result[key] = isPlainObject(value) && isPlainObject(current)
      ? deepMerge(current, value)
      : value;
  });
  return result;
}

export default deepMerge;