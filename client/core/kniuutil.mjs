export function resolveAliasReferences(source, aliases = {}) {
  return Object.entries(aliases)
    .sort(function ([left], [right]) { return right.length - left.length; })
    .reduce(function (result, [alias, target]) {
      const aliasPrefix = alias.replace(/\/+$/g, '') + '/';
      const normalizedTarget = String(target)
        .replaceAll('\\', '/')
        .replace(/^\.\//, '')
        .replace(/^\/+|\/+$/g, '');
      const targetPrefix = normalizedTarget ? `/${normalizedTarget}/` : '/';
      return result.replaceAll(aliasPrefix, targetPrefix);
    }, String(source));
}

export function getCurrentRoutePath() {
  const hash = location.hash.slice(1) || '/';
  return hash.split('?')[0].split('#')[0] || '/';
}

export function getRouteQuery() {
  const hash = String(globalThis.location?.hash || '');
  const index = hash.indexOf('?');
  if (index === -1) return {};
  const out = {};
  new URLSearchParams(hash.slice(index + 1)).forEach(function (value, key) {
    if (key) out[key] = value;
  });
  return out;
}

export function getRouteContext(getRouteData, keys) {
  let data = null;
  try { data = typeof getRouteData === 'function' ? getRouteData() : null; } catch (e) { data = null; }
  const merged = { ...getRouteQuery(), ...(data && typeof data === 'object' ? data : null) };
  const out = {};
  (keys || []).forEach(function (key) {
    const value = merged[key];
    out[key] = value === null || value === undefined ? '' : String(value);
  });
  return out;
}

export function isPageReload(performanceRef = globalThis.performance) {
  const entry = performanceRef?.getEntriesByType?.('navigation')?.[0];
  return entry?.type === 'reload' || performanceRef?.navigation?.type === 1;
}

let transientSearchKeyword = '';

export function getTransientSearchKeyword() {
  return transientSearchKeyword;
}

export function setTransientSearchKeyword(value) {
  transientSearchKeyword = String(value == null ? '' : value);
  return transientSearchKeyword;
}

export function getLocalDateParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const pad = function (number) { return String(number).padStart(2, '0'); };
  return {
    year: date.getFullYear(),
    month: pad(date.getMonth() + 1),
    date: pad(date.getDate()),
    week: date.getDay(),
    hour: pad(date.getHours()),
    minute: pad(date.getMinutes()),
    second: pad(date.getSeconds())
  };
}

export function formatLocalDateTime(value = new Date()) {
  const parts = getLocalDateParts(value);
  return `${parts.year}-${parts.month}-${parts.date} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function buildMultipartFormData(model = {}, options = {}) {
  const formData = new FormData();
  const fileField = String(options.fileField || 'file');
  const files = Array.isArray(options.files) ? options.files : [];

  Object.keys(model || {}).forEach(function (field) {
    if (field === fileField) return;
    const value = model[field];
    formData.append(field, value == null ? '' : value);
  });

  const newFile = files.find(function (item) {
    return typeof File !== 'undefined' && item instanceof File;
  });
  const storedFile = files.find(function (item) {
    return typeof item === 'string' && item.length > 0;
  });

  if (newFile) formData.append(fileField, newFile, newFile.name);
  else formData.append(fileField, storedFile || '');
  return formData;
}

export function getResponseRecords(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && typeof payload === 'object') return [payload];
  return [];
}

export function getFirstResponseRecord(payload) {
  return getResponseRecords(payload)[0] || null;
}

export function assignModelFields(target, source, emptyValue = '') {
  if (!target || typeof target !== 'object' || !source || typeof source !== 'object') return target;
  Object.keys(target).forEach(function (field) {
    target[field] = source[field] == null ? emptyValue : source[field];
  });
  return target;
}

export function assignOptionFields(options, source, emptyValue = '') {
  if (!options || typeof options !== 'object' || !source || typeof source !== 'object') return options;
  Object.keys(options).forEach(function (field) {
    const value = source[field] == null ? emptyValue : source[field];
    const slot = options[field];
    if (slot && typeof slot === 'object' && 'value' in slot) slot.value = value;
    else options[field] = value;
  });
  return options;
}

export function fillOptionsFromResponse(options, payload, emptyValue = '') {
  const record = getFirstResponseRecord(payload);
  if (!record) return null;
  assignOptionFields(options, record, emptyValue);
  return record;
}

export function optionsToValues(options) {
  const out = {};
  if (!options || typeof options !== 'object') return out;
  Object.keys(options).forEach(function (field) {
    const slot = options[field];
    out[field] = slot && typeof slot === 'object' && 'value' in slot ? slot.value : slot;
  });
  return out;
}

function field(value, condition, message) {
  return { value: value == null ? '' : value, condition: condition, message: String(message || '') };
}

export function required(message = '此项不能为空', value = '') {
  return field(value, true, message);
}

export function pattern(expression, message = '格式不正确', value = '') {
  return field(value, expression instanceof RegExp ? expression : new RegExp(String(expression || '')), message);
}

export function email(message = '请输入正确邮箱', value = '') {
  return pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, message, value);
}

export function createForm(fields = {}, layout = {}) {
  return Object.assign({}, layout, fields);
}

export function toSingleFileList(value) {
  return value ? [value] : [];
}

export function updateListRecord(list, changes, key = 'id') {
  if (!Array.isArray(list) || !changes) return Array.isArray(list) ? list : [];
  return list.map(function (item) {
    return item && item[key] === changes[key] ? Object.assign({}, item, changes) : item;
  });
}

export function removeListRecord(list, record, key = 'id') {
  if (!Array.isArray(list) || !record) return Array.isArray(list) ? list : [];
  return list.filter(function (item) {
    return !item || item[key] !== record[key];
  });
}

export function debounce(fn, wait = 200) {
  if (typeof fn !== 'function') return fn;
  let timer = 0;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      timer = 0;
      fn.apply(this, args);
    }, wait);
  };
}

export function throttle(fn, wait = 120) {
  if (typeof fn !== 'function') return fn;
  let last = 0;
  let timer = 0;
  return function (...args) {
    const now = Date.now();
    const remain = wait - (now - last);
    if (remain <= 0) {
      if (timer) { clearTimeout(timer); timer = 0; }
      last = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(function () {
        last = Date.now();
        timer = 0;
        fn.apply(this, args);
      }, remain);
    }
  };
}