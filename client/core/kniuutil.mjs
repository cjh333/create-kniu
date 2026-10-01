// 将 source 中的别名前缀替换为真实路径前缀（按别名长度降序替换，避免短别名误伤长别名）。
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

// 获取当前路由路径（不包含查询参数和哈希）。
// 注：HTML 编解码为后端全责（增/改写库前转义、查返回前解码），前端不做任何编解码。
export function getCurrentRoutePath() {
  const hash = location.hash.slice(1) || '/';
  return hash.split('?')[0].split('#')[0] || '/';
}

// 页面刷新时 history.state 仍会保留；需要区分刷新与站内路由跳转的页面可使用此判断。
export function isPageReload(performanceRef = globalThis.performance) {
  const entry = performanceRef?.getEntriesByType?.('navigation')?.[0];
  return entry?.type === 'reload' || performanceRef?.navigation?.type === 1;
}

let transientSearchKeyword = '';

// 前台单页会话内共享搜索词：路由切换不丢失，浏览器刷新会自然回到空值。
export function getTransientSearchKeyword() {
  return transientSearchKeyword;
}

export function setTransientSearchKeyword(value) {
  transientSearchKeyword = String(value == null ? '' : value);
  return transientSearchKeyword;
}

// 返回本地时间的常用组成部分，适合表单默认值和日期组件初始化。
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

// 使用本地时区生成后端 datetime 字段所需的 yyyy-mm-dd hh:mm:ss。
export function formatLocalDateTime(value = new Date()) {
  const parts = getLocalDateParts(value);
  return `${parts.year}-${parts.month}-${parts.date} ${parts.hour}:${parts.minute}:${parts.second}`;
}

/**
 * 将普通表单模型与一个单文件字段组装为 multipart/form-data。
 * 新选择的 File 优先于数据库回显 URL；两者都没有时提交空值。
 */
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

// 将接口常见的 data、{ data: [] } 或单对象结构统一转换为记录数组。
export function getResponseRecords(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && typeof payload === 'object') return [payload];
  return [];
}

// 从接口数据中获取第一条记录；没有数据时返回 null。
export function getFirstResponseRecord(payload) {
  return getResponseRecords(payload)[0] || null;
}

// 只复制 target 已声明的字段，避免接口额外字段意外进入表单状态。
export function assignModelFields(target, source, emptyValue = '') {
  if (!target || typeof target !== 'object' || !source || typeof source !== 'object') return target;
  Object.keys(target).forEach(function (field) {
    target[field] = source[field] == null ? emptyValue : source[field];
  });
  return target;
}

// 把接口记录写回 kniu-form 的 options：字段对象（{ value, condition, message }）写 .value，
// 直接值字段整体替换。语义与 assignModelFields 一致（记录缺失的字段按 emptyValue 清空）。
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

// 读取接口首条记录并填充 kniu-form 的 options，适用于单记录设置表单。
export function fillOptionsFromResponse(options, payload, emptyValue = '') {
  const record = getFirstResponseRecord(payload);
  if (!record) return null;
  assignOptionFields(options, record, emptyValue);
  return record;
}

// 把 options 摊平成纯值对象（字段对象取 value），用于构造提交数据。
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

// 将数据库单图 URL 转成上传组件使用的文件列表。
export function toSingleFileList(value) {
  return value ? [value] : [];
}

// 按唯一字段合并列表中的一条记录，并返回新数组。
export function updateListRecord(list, changes, key = 'id') {
  if (!Array.isArray(list) || !changes) return Array.isArray(list) ? list : [];
  return list.map(function (item) {
    return item && item[key] === changes[key] ? Object.assign({}, item, changes) : item;
  });
}

// 按唯一字段从列表中删除一条记录，并返回新数组。
export function removeListRecord(list, record, key = 'id') {
  if (!Array.isArray(list) || !record) return Array.isArray(list) ? list : [];
  return list.filter(function (item) {
    return !item || item[key] !== record[key];
  });
}

// 高频事件防抖：wait 毫秒内连续触发只执行最后一次。典型用于搜索输入框，
// 避免每次按键都打接口。纯函数、零依赖，浏览器与 Node 两侧通用。
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

// 高频事件节流：wait 毫秒内最多执行一次，首跳立即执行、尾跳补执行。
// 典型用于 resize / scroll 等布局相关事件。纯函数、零依赖。
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
