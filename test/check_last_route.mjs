/**
 * 常驻闸门：kniulastroute.mjs「上一次页面」记忆校验。
 *
 * 该模块是 /about、/profile 返回按钮与 /login 登录回流共用的单一真相源
 * （kniubase 在路由变迁时经 rememberLastRoute 自动记录）。此处用桩
 * sessionStorage 做行为断言，防纯函数被改坏。
 *
 * 用法：node test/check_last_route.mjs
 */
import { rememberLastRoute, getLastRoute, setAuthRoutes, getAuthRoutes, STORAGE_KEY } from '../client/core/kniulastroute.mjs';

const store = new Map();
globalThis.sessionStorage = {
  setItem(key, value) { store.set(key, String(value)); },
  getItem(key) { return store.has(key) ? store.get(key) : null; },
  removeItem(key) { store.delete(key); }
};

const failures = [];
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures.push(`${name}：期望 ${JSON.stringify(expected)}，实得 ${JSON.stringify(actual)}`);
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name);
}

// 核心库不预设路由，此处按本项目配置注入（验证 setAuthRoutes API 与过滤行为）。
setAuthRoutes(['/login', '/register', '/forgot']);
check('setAuthRoutes 注入生效', getAuthRoutes(), ['/login', '/register', '/forgot']);

// ① 往返：内容页路径 + 数据原样存取。
check('往返读写', (rememberLastRoute({ path: '/detail', data: { id: 3 } }), getLastRoute()), { path: '/detail', data: { id: 3 } });

// ② 鉴权中转页不入记忆，且不清掉已有记录。
check('登录页被过滤', rememberLastRoute({ path: '/login' }), null);
check('注册页被过滤', rememberLastRoute({ path: '/register' }), null);
check('忘记密码页被过滤', rememberLastRoute({ path: '/forgot' }), null);
check('过滤后旧记录仍在', getLastRoute(), { path: '/detail', data: { id: 3 } });

// ③ 路径归一化：hash 前缀与查询串剥离。
check('hash 前缀剥离', (rememberLastRoute({ path: '#/about', data: null }), getLastRoute()), { path: '/about', data: null });
check('查询串剥离', (rememberLastRoute({ path: '/detail?from=home#x' }), getLastRoute()), { path: '/detail', data: null });

// ④ 非法输入：非对象、无 path、坏 JSON 均返回 null 不抛错。
check('非对象输入', rememberLastRoute('nope'), null);
check('空 path 回落根路径', (rememberLastRoute({ path: '', data: { a: 1 } }), getLastRoute()), { path: '/', data: { a: 1 } });
check('data 非对象置空', (rememberLastRoute({ path: '/home', data: 'x' }), getLastRoute()), { path: '/home', data: null });
store.set(STORAGE_KEY, '{bad json');
check('坏 JSON 读为 null', getLastRoute(), null);

// ⑤ 存储抛错（隐私模式）不向上炸。
globalThis.sessionStorage = {
  setItem() { throw new Error('QuotaExceeded'); },
  getItem() { throw new Error('denied'); },
  removeItem() { }
};
let threw = false;
try { rememberLastRoute({ path: '/home' }); getLastRoute(); } catch (e) { threw = true; }
check('存储异常静默降级', threw, false);

if (failures.length > 0) {
  console.error(`[check_last_route] 失败 ${failures.length} 项：`);
  failures.forEach((item) => console.error(' - ' + item));
  process.exit(1);
}
console.log('[check_last_route] PASS（往返/鉴权过滤/归一化/异常降级全部符合）');
