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

// 根据路由路径解析导航高亮索引（纯函数，导航配置由调用方传入）。
export function getNavigationIndex(path, navigationPaths, routeMap = {}) {
  const mapped = routeMap[path];
  if (mapped !== undefined) {
    const index = navigationPaths.indexOf(mapped);
    if (index >= 0) return index;
  }
  const index = navigationPaths.indexOf(path);
  return index >= 0 ? index : 0;
}

// 将路由路径按映射表解析为实际导航路径（未命中映射则原样返回）。
export function resolveActivePath(path, routeMap = {}) {
  return routeMap[path] || path;
}

// 根据路由路径解析导航应用名称（纯函数，导航配置由调用方传入）。
export function getApplicationName(path, navigationItems, routeMap = {}, defaultName = '控制台') {
  const activePath = resolveActivePath(path, routeMap);
  const item = navigationItems.find(function (it) { return it.path === activePath; });
  return (item && item.name) || defaultName;
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

// 读取接口首条记录并填充模型，适用于单记录设置表单。
export function fillModelFromResponse(target, payload, emptyValue = '') {
  const record = getFirstResponseRecord(payload);
  if (!record) return null;
  assignModelFields(target, record, emptyValue);
  return record;
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