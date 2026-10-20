/**
 * 常驻闸门：dist bundle 接线校验（构建产物层面的回归网）。
 *
 * 背景：kniubuilder 对 kniumvvm.mjs 的动态 import 做字符串锚点替换（改源码模板串
 * 会静默漂移）；配置更名（server.js PROXY 的 url/change_origin、ui.js 的
 * COMPONENTS/THEME、viewer.js 真实路径）若只改配置不改消费方，bundle 里就是死配置。
 * 本闸门在 npm run build 之后运行，核对关键接线确实进入产物：
 *   1. 请求层：REDIRECT 路由（/login /register /forgot）、默认 trigger 1001（unauthorized）
 *      接线、authRedirectInterceptor、拦截器导出；旧内联鉴权判断已移除；
 *   2. viewer.js：控制器真实路径值与 loadControllerFile/__kniuLoadControllerFile；
 *      旧紧凑值（admin/mainController 裸串）已淘汰；
 *   3. 配置命名规范：PROXY 嵌套 url/change_origin 小写、UI 配置第一层大写进 bundle。
 *
 * 用法：
 *   node test/check_bundle_wiring.mjs            核对 dist 产物（先 npm run build）；
 *   node test/check_bundle_wiring.mjs --self-test  合成 bundle 反向自测（不读 dist）。
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function evaluateBundle(bundle) {
  return [
    // 请求层统一拦截器 + 配置驱动重定向（REDIRECT 为扁平数组，trigger 取默认 [1001]）
    ['REDIRECT 默认 trigger 1001（unauthorized）接线', /authRedirectInterceptor/.test(bundle) && /1001/.test(bundle)],
    ['REDIRECT targets /login 进入 bundle', /route:\s*["']\/login["']/.test(bundle)],
    ['REDIRECT targets /register 进入 bundle', /route:\s*["']\/register["']/.test(bundle)],
    ['REDIRECT targets /forgot 进入 bundle', /route:\s*["']\/forgot["']/.test(bundle)],
    ['authRedirectInterceptor 进入 bundle', /authRedirectInterceptor/.test(bundle)],
    ['useResponseInterceptor 导出进 bundle', /useResponseInterceptor/.test(bundle)],
    ['useRequestInterceptor 导出进 bundle', /useRequestInterceptor/.test(bundle)],
    ['旧内联鉴权判断已移除', !/status === STATUS_UNAUTHORIZED\) && request\.redirectOnUnauthorized/.test(bundle)],
    // viewer.js 真实路径装载（值相对 controller/ 基目录，基目录不写入）
    ['viewer 值 admin/mainController.js 进入 bundle', /'admin\/common\/main':\s*["']admin\/mainController\.js["']/.test(bundle)],
    ['loadControllerFile 进入 bundle', /loadControllerFile/.test(bundle)],
    ['__kniuLoadControllerFile 运行时', bundle.includes('__kniuLoadControllerFile')],
    ['旧紧凑值 admin/mainController 裸串已淘汰', !/["']admin\/mainController["']/.test(bundle)],
    // 配置命名规范（第一层大写 / 嵌套小写）
    ['PROXY 嵌套 url/change_origin 小写进 bundle', /url:\s*["']http:\/\/localhost:9900["']/.test(bundle) && /change_origin:\s*true/.test(bundle)],
    ['UI 配置第一层 COMPONENTS/THEME 大写进 bundle', /COMPONENTS:/.test(bundle) && /THEME:/.test(bundle)],
  ];
}

function report(results) {
  let failed = 0;
  for (const [name, ok] of results) {
    if (!ok) failed += 1;
    console.log((ok ? 'PASS' : 'FAIL') + ' ' + name);
  }
  return failed;
}

if (process.argv.includes('--self-test')) {
  // 合成「全对」bundle；再各埋一个故障，断言检测能力（不读 dist、不改产物）。
  const good = [
    "REDIRECT:[{route:'/login',account:true},{route:'/register'},{route:'/forgot'}]",
    'STATUS_UNAUTHORIZED:1001',
    'authRedirectInterceptor', 'useResponseInterceptor', 'useRequestInterceptor',
    "viewer map {'admin/common/main':'admin/mainController.js'}",
    'loadControllerFile', '__kniuLoadControllerFile',
    "PROXY:{'/api':{url:'http://localhost:9900',change_origin:true}}",
    'COMPONENTS:{btn:{size:"default"}}', 'THEME:{"--kniu-color-primary":"#409eff"}'
  ].join('\n');
  const badTrigger = good.replace(/route:\s*['"]\/login['"]/, "route:'/login-x'");
  const badViewer = good.replace("'admin/common/main':'admin/mainController.js'", "'admin/common/main':'admin/mainController'");
  const badProxy = good.replace('change_origin:true', 'CHANGE_ORIGIN:true');
  const cases = [
    ['合成全对 bundle 零失败', report(evaluateBundle(good)) === 0],
    ['REDIRECT 路由被改应检出', report(evaluateBundle(badTrigger)) > 0],
    ['viewer 路径被改应检出', report(evaluateBundle(badViewer)) > 0],
    ['PROXY 嵌套键被改大写应检出', report(evaluateBundle(badProxy)) > 0],
  ];
  const failed = cases.filter(([, ok]) => !ok).length;
  cases.forEach(([name, ok]) => console.log((ok ? 'PASS' : 'FAIL') + ' [自测] ' + name));
  if (failed > 0) process.exit(1);
  console.log('[check_bundle_wiring] 自测 PASS（检测能力证实）');
  process.exit(0);
}

const VIEWS_DIR = 'dist/views';
if (!existsSync(VIEWS_DIR)) {
  console.error('[check_bundle_wiring] 失败：dist/views 不存在，请先执行 npm run build');
  process.exit(1);
}
const files = readdirSync(VIEWS_DIR).filter((f) => f.endsWith('.js'));
if (!files.length) {
  console.error('[check_bundle_wiring] 失败：dist/views 无 .js 产物，请先执行 npm run build');
  process.exit(1);
}
const bundle = files.map((f) => readFileSync(join(VIEWS_DIR, f), 'utf8')).join('\n');
const failed = report(evaluateBundle(bundle));
if (failed > 0) process.exit(1);
console.log(`[check_bundle_wiring] PASS（${files.length} 个产物文件 / 13 项接线核对）`);
