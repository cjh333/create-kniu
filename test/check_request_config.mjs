/**
 * 常驻闸门：client/config/request.js 请求层配置校验。
 *
 * 背景：该文件是手维护的请求层唯一配置源（状态码字典 + 重定向策略），
 * 字段写错不会报语法错，只会在运行时静默失效（如 trigger 写了字典外
 * 的码 → 该码永不被跳转命中）。故静态校验：
 *   1. STATUS：非空对象，键为数字字符串，值为非空语义名；
 *   2. REDIRECT：兼容两种形态——
 *      ① 扁平数组（按 targets 处理，trigger 取默认 [1001]，与运行时 authRedirect 一致）；
 *      ② 对象 { trigger, targets }；
 *   3. 有效 trigger 码（默认 [1001]）须存在于 STATUS 字典；
 *   4. targets 每条 route 以 '/' 开头、account 为布尔或缺省；
 *   5. targets 必须同时覆盖「有前台账号（account:true）」与「访客」两种落点。
 */
import REQUEST_CONFIG from '../client/config/request.js';

const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
}

const STATUS = REQUEST_CONFIG.STATUS;
check(STATUS && typeof STATUS === 'object' && !Array.isArray(STATUS), 'STATUS 必须是非空对象');
const statusKeys = STATUS && typeof STATUS === 'object' ? Object.keys(STATUS) : [];
check(statusKeys.length > 0, 'STATUS 不能为空');
statusKeys.forEach(function (key) {
  check(/^\d+$/.test(key), `STATUS 键必须是数字字符串：${key}`);
  check(typeof STATUS[key] === 'string' && STATUS[key].trim() !== '', `STATUS[${key}] 必须是非空语义名`);
});

const REDIRECT = REQUEST_CONFIG.REDIRECT;
check(REDIRECT && (Array.isArray(REDIRECT) || typeof REDIRECT === 'object'), 'REDIRECT 必须是数组或对象');

// 兼容两种写法：①扁平数组（按旧版 targets 处理，trigger 取默认 [1001]）；
// ②对象 { trigger, targets }。运行时 authRedirect 同样兼容这两种形态。
const isArrayForm = Array.isArray(REDIRECT);
const targets = isArrayForm
  ? REDIRECT
  : (REDIRECT && Array.isArray(REDIRECT.targets) ? REDIRECT.targets : null);
const trigger = isArrayForm
  ? null
  : (REDIRECT && Array.isArray(REDIRECT.trigger) ? REDIRECT.trigger : null);
const effectiveTrigger = trigger && trigger.length ? trigger : [1001];

check(!!targets && targets.length > 0, 'REDIRECT 目标（targets）必须是非空数组');
(effectiveTrigger || []).forEach(function (code) {
  check(Number.isFinite(code), `REDIRECT.trigger 必须是数字：${code}`);
  check(statusKeys.includes(String(code)), `REDIRECT.trigger 码 ${code} 不在 STATUS 字典内（手滑写错码？）`);
});

let hasAccountTarget = false;
let hasGuestTarget = false;
(targets || []).forEach(function (item, index) {
  check(item && typeof item === 'object', `REDIRECT.targets[${index}] 必须是对象`);
  if (!item || typeof item !== 'object') return;
  check(typeof item.route === 'string' && item.route.startsWith('/'), `REDIRECT.targets[${index}].route 必须以 '/' 开头`);
  check(item.account === undefined || typeof item.account === 'boolean', `REDIRECT.targets[${index}].account 必须是布尔`);
  if (item.account === true) hasAccountTarget = true;
  else hasGuestTarget = true;
});
check(hasAccountTarget, 'REDIRECT.targets 缺少 account:true 的落点（已持有前台账号的身份无处可跳）');
check(hasGuestTarget, 'REDIRECT.targets 缺少无 account 标记的落点（访客无处可跳）');

if (failures.length > 0) {
  console.error(`[check_request_config] 失败 ${failures.length} 项：`);
  failures.forEach(function (item) { console.error(' - ' + item); });
  process.exit(1);
}
console.log(`[check_request_config] PASS（STATUS ${statusKeys.length} 码 / trigger ${effectiveTrigger.length} 码 / targets ${targets ? targets.length : 0} 落点）`);
