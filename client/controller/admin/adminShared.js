import { formatCell } from './databaseShared.js';
import IDENTITY from '../../core/kniuidentity.mjs';
import UI from '../../core/kniuui/kniuui.mjs';
import { getLastRoute } from '../../core/kniulastroute.mjs';

/**
 * 鉴权页（登录/注册/忘记密码）共用的邮箱验证码与回流逻辑。
 * 三个页面拆成独立路由后，避免各自重复实现同一套交互。
 */

export function clearCodeTimer(holder) {
  if (holder && holder.codeTimer) { clearInterval(holder.codeTimer); holder.codeTimer = null; }
}

export function startCodeCountdown(state, holder, seconds) {
  clearCodeTimer(holder);
  state.codeCountdown = Math.max(1, Number(seconds) || 60);
  holder.codeTimer = setInterval(function () {
    state.codeCountdown -= 1;
    if (state.codeCountdown <= 0) clearCodeTimer(holder);
  }, 1000);
}

export function quickValidateEmail(model) {
  const email = String(model && model.email && model.email.value || '').trim();
  if (email === '') {
    UI.msg({ content: '请输入邮箱', type: 'error' });
    return '';
  }
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
    UI.msg({ content: '邮箱格式不正确', type: 'error' });
    return '';
  }
  return email;
}

export async function sendEmailCode(scene, model, state, holder, request) {
  if (state.codeSending || state.codeCountdown > 0) return;
  const email = quickValidateEmail(model);
  if (email === '') return;
  state.codeSending = true;
  let res;
  try {
    res = await request({
      url: '/email_code',
      type: 'POST',
      data: { email: email, scene: scene },
      redirectOnUnauthorized: false
    });
  } finally {
    state.codeSending = false;
  }
  if (!res || res.status !== 1) {
    UI.msg({ content: (res && res.msg) || '验证码发送失败', type: 'error' });
    return;
  }
  const devMode = !!(res.data && res.data.dev);
  UI.msg({
    content: res.msg || (devMode ? '验证码已生成，但邮件未实际发送' : '验证码已发送，请查收邮箱'),
    type: devMode ? 'warning' : 'success'
  });
  startCodeCountdown(state, holder, (res.data && res.data.interval) ? res.data.interval : 60);
}

/**
 * 回流目标：鉴权页登录/注册成功后应返回的页面。
 * 优先级：传入的 redirect（最精确，含 /detail+id、/about+role_id、/profile、/）→ 上一次页面记忆 → 无则 null（交由调用方回落 /admin）。
 */
export function buildRedirectTarget(getRouteData) {
  const data = getRouteData() || {};
  const redirect = String(data.redirect || '').replace(/^#/, '');
  const id = Number(data.id || 0);
  const roleId = Number(data.role_id || 0);
  if (redirect === '/detail' && id > 0) return { path: '/detail', data: { id: id } };
  if (redirect === '/profile' || redirect === '/') return { path: redirect, data: {} };
  if (redirect === '/about') return { path: '/about', data: roleId > 0 ? { role_id: roleId } : {} };
  const last = getLastRoute();
  if (last && last.path) return { path: last.path, data: last.data || {} };
  return null;
}

/**
 * 「返 回」：从哪页进来的就返回到哪页；无记录时回落首页。
 */
export function toBackRoute(navigateTo) {
  const last = getLastRoute();
  if (last && last.path) {
    navigateTo(last.path, last.data || null);
    return;
  }
  navigateTo('/');
}

export function isAdminRole(user) {
  const source = user || {};
  return Number(source.roleId || source.role || 0) === 1 || Number(source.roleAuth || 0) === 1;
}

export function isSuperRole(user) {
  const source = user || {};
  return Number(source.roleId || source.role || 0) === 1;
}

export function applyNavFlags(state, user) {
  state.showWebsiteInfo = isAdminRole(user);
  state.showDaily = state.showWebsiteInfo;
  state.showUserManagement = !!String((user && user.name) || '').trim();
  state.showDatabaseAdmin = isSuperRole(user);
}

export function adminTableMaxHeight() {
  return innerHeight - 220 / 1920 * innerWidth;
}

export function adminEditorMaxHeight() {
  return innerHeight - 590 / 1920 * innerWidth;
}

export function makeFail($msg) {
  return function (res) {
    $msg({ content: (res && res.msg) || '请求失败', type: 'error' });
  };
}

export function confirmYes($confirm, msg, title = '提示', type = 'warning', confirmText = '确定') {
  return $confirm(msg, title, {
    confirmButtonText: confirmText,
    cancelButtonText: '取消',
    type
  }).then(function () { return true; }).catch(function () { return false; });
}

export function requireLogin(AUTH, opts) {
  opts = opts || {};
  if (AUTH.isLoggedIn()) return true;
  if (opts.$msg) opts.$msg({ content: opts.failMsg || '登录已失效，请重新登录', type: 'error' });
  if (opts.navigateTo) {
    const hash = String(globalThis.location?.hash || '');
    const route = hash.replace(/^#/, '').split('?')[0].split('#')[0] || '/';
    if (route !== '/login' && route !== '/register' && route !== '/forgot') {
      opts.navigateTo(IDENTITY.hasAccount() ? '/login' : '/register', { redirect: route });
    }
  }
  return false;
}

export { withSubmitting } from '../../core/kniupage.mjs';

export function createSortUpdateHandler(options) {
  return async function updateSort(index, list, value) {
    const row = list && list[index];
    if (!row) return false;
    const res = await options.actions.post(options.url, { id: row.id, sid: Math.max(0, Number(value) || 0) });
    if (res) {
      await options.reload();
    }
    return !!res;
  };
}

export async function executeSqlTextShared(state, request, opts) {
  opts = opts || {};
  const $msg = opts.$msg;
  const sql = String(state.sqlModel.sql.value || '');
  if (!sql.trim()) {
    $msg({ content: '请输入要执行的 SQL', type: 'error' });
    return false;
  }
  const script = opts.buildSql ? opts.buildSql(sql) : sql;
  const res = await request({ url: '/db_query', type: 'POST', data: { sql: script } });
  if (res.status !== 1) {
    $msg({ content: res.msg, type: 'error' });
    return false;
  }
  const data = res.data || {};
  const lines = [
    `共 ${data.statements || 0} 条语句，失败 ${data.failed || 0} 条，影响 ${data.affected || 0} 行`,
    ''
  ];
  (data.results || []).forEach(function (item) {
    lines.push(`#${item.index + 1} ${item.ok ? '成功' : '失败'} · ${item.kind} · 影响/返回 ${item.affected} 行`);
    if (item.message) lines.push(`　错误：${item.message}`);
    if (item.truncated) lines.push('　（结果过多，仅回显前若干行）');
    (item.rows || []).forEach(function (row) {
      lines.push('　' + Object.keys(row).map(function (key) { return `${key}=${formatCell(row[key])}`; }).join('　'));
    });
  });
  state.sqlResultText = lines.join('\n');
  $msg({ content: res.msg || '执行完成', type: data.failed > 0 ? 'warning' : 'success' });
  if (opts.reload) await opts.reload();
  return data.failed === 0;
}