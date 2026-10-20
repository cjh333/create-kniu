/**
 * 由模板路径派生公共视图查找键。
 * @param {String} path 模板路径，如 '/client/views/admin/common/aside.html'。
 * @returns {String} 查找键，如 'admin/common/aside'；非公共视图返回 ''。
 */
export function toCommonKey(path) {
  const parts = String(path || '').replaceAll('\\', '/').replace(/\.html$/, '').split('/').filter(Boolean);
  const commonIndex = parts.lastIndexOf('common');
  if (commonIndex <= 0) return '';
  const viewsIndex = parts.lastIndexOf('views');
  const start = viewsIndex >= 0 && viewsIndex < commonIndex ? viewsIndex + 1 : commonIndex - 1;
  return parts.slice(start).join('/');
}

/**
 * 由模板路径派生自定义元素标签名。
 * @param {String} path 模板路径，如 '/client/views/admin/common/aside.html'。
 * @returns {String} 标签名，如 'kniu-system-admin-common-aside'。
 */
export function toComponentTag(path) {
  const normalized = String(path || '').replaceAll('\\', '/').replace(/\.html$/, '');
  const parts = normalized.split('/').filter(Boolean);
  const commonIndex = parts.lastIndexOf('common');
  const names = commonIndex > 0 ? parts.slice(commonIndex - 1) : parts.slice(-2);
  return 'kniu-system-' + names.join('-').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
}