/**
 * 常驻闸门：client/config/viewer.js 静态页面映射校验。
 *
 * 口径（用户定稿）：viewer.js 与 router.js 不同，指的是静态非路由跳转性页面；
 * 键 = 视图模板相对 views/ 的路径，值 = 控制器相对 client/controller/ 基目录的真实
 * 文件路径（控制器强制存放在该目录，基目录不写入）——按真实所在位置定位，
 * 不遍历文件夹、不猜后缀。
 * 例：'admin/common/main': 'admin/mainController.js'
 *   → client/views/admin/common/main.html 的控制器是
 *     client/controller/admin/mainController.js。
 *
 * 校验：
 *   1. 键必须等于 toCommonKey 派生值（kniuviewkey.mjs 单一真相源，框架查找同函数）——
 *      防「配置键与框架查找键格式分叉」重现（三拆事故：键写 'admin/common/aside'
 *      而框架按 'admin/aside' 查，公共视图控制器全量静默丢失）；
 *   2. 键对应的视图模板 client/views/<键>.html 必须存在；
 *   3. 值必须是 controller/ 基目录下真实存在的 .js 文件路径（基目录不写入）；
 *   4. 该控制器文件必须导出与文件名同名的符号（loadControllerFile 的读取契约），
 *      或存在 default 导出。
 *
 * 用法：node test/check_viewer_paths.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import VIEWER from '../client/config/viewer.js';
import { toCommonKey } from '../client/core/kniuviewkey.mjs';

const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
}

const entries = Object.entries(VIEWER);
check(entries.length > 0, 'viewer.js 不能为空');

for (const [viewName, controllerPath] of entries) {
  // 键必须与框架查找键（kniuviewkey.mjs::toCommonKey）逐字一致。
  const derivedKey = toCommonKey(`/client/views/${viewName}.html`);
  check(
    derivedKey === viewName,
    `键「${viewName}」不是框架查找键格式（toCommonKey 派生值应为「${derivedKey}」）`
  );

  const viewFile = join('client/views', `${viewName}.html`);
  check(existsSync(viewFile), `视图模板不存在：${viewFile}（键「${viewName}」）`);

  check(
    typeof controllerPath === 'string' && /^[\w-]+\/[\w-]+\.js$/.test(controllerPath),
    `「${viewName}」的控制器值必须是 controller/ 基目录下的真实 .js 路径（基目录不写入），收到：${JSON.stringify(controllerPath)}`
  );
  if (typeof controllerPath !== 'string' || !/^[\w-]+\/[\w-]+\.js$/.test(controllerPath)) continue;

  const controllerFile = join('client/controller', controllerPath);
  check(existsSync(controllerFile), `控制器文件不存在：${controllerFile}（键「${viewName}」）`);
  if (!existsSync(controllerFile)) continue;

  const exportName = controllerPath.split('/').pop().replace(/\.js$/, '');
  const source = readFileSync(controllerFile, 'utf8');
  const hasNamedExport = new RegExp(`export\\s+(?:const|let|var|function|class)\\s+${exportName}\\b`).test(source)
    || new RegExp(`export\\s*\\{[^}]*\\b${exportName}\\b`).test(source);
  const hasDefaultExport = /export\s+default\b/.test(source);
  check(
    hasNamedExport || hasDefaultExport,
    `控制器未导出与文件名同名的符号「${exportName}」且无 default 导出：${controllerFile}`
  );
}

if (failures.length > 0) {
  console.error(`[check_viewer_paths] 失败 ${failures.length} 项：`);
  failures.forEach((item) => console.error(' - ' + item));
  process.exit(1);
}
console.log(`[check_viewer_paths] PASS（${entries.length} 个静态页面映射，视图/控制器真实路径与导出全部命中）`);
