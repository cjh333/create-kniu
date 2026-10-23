#!/usr/bin/env node
import { cp, mkdir, readdir, rm, stat, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const valueAfter = (name, fallback = undefined) => {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  return value && !value.startsWith('--') ? value : fallback;
};
const name = args.find((argument, index) => !argument.startsWith('-') && !['--template', '--port'].includes(args[index - 1]));
const template = valueAfter('--template', 'kniu-project-spa');
const port = valueAfter('--port');
const force = args.includes('--force');
const supportedTemplates = new Set(['kniu-project-spa']);
const usage = `用法：npm create kniu@latest <项目名> [选项]

所有项目固定生成到：<当前目录>/kniu-project/<项目名>

选项：
  --template <kniu-project-spa>       选择模板，默认 kniu-project-spa
  --port <端口>                       写入开发服务器端口（kniu-project-spa）
  --force                             仅覆盖同名项目目录
  --help                              显示帮助`;
if (!name || args.includes('--help') || args.includes('-h')) {
  console.log(usage);
  process.exitCode = name ? 0 : 1;
} else if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(name)) {
  console.error('项目名只能由英文字母、数字和连字符组成，并且必须以字母开头。');
  process.exitCode = 1;
} else if (!supportedTemplates.has(template)) {
  console.error(`不支持的模板：${template}。可用模板：${[...supportedTemplates].join('、')}`);
  process.exitCode = 1;
} else if (port && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)) {
  console.error('--port 必须是 1 到 65535 之间的端口号。');
  process.exitCode = 1;
} else {
  const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const projectsRoot = resolve(process.cwd(), 'kniu-project');
  const destination = resolve(projectsRoot, name);
  if (!destination.startsWith(projectsRoot + sep)) throw new Error('项目目录校验失败。');
  const source = resolve(cliRoot, 'templates', template);
  try { await stat(source); }
  catch { throw new Error(`脚手架模板不存在：${source}`); }
  try {
    const info = await stat(destination);
    if (!info.isDirectory()) throw new Error('目标路径已存在且不是目录。');
    if ((await readdir(destination)).length) {
      if (!force) throw new Error(`项目已存在：${destination}。如确认覆盖，请加 --force。`);
      await rm(destination, { recursive: true, force: true });
    }
  } catch (error) {
    if (error.code === 'ENOENT') await mkdir(destination, { recursive: true });
    else throw error;
  }
  await mkdir(destination, { recursive: true });
  await cp(source, destination, { recursive: true });
  const coreSource = resolve(source, 'client', 'core');
  await mkdir(resolve(destination, 'client', 'core'), { recursive: true });
  await cp(resolve(coreSource, 'kniu-server.mjs'), resolve(destination, 'client', 'core', 'kniu-server.mjs'));
  if (port && template === 'kniu-project-spa') {
    const configPath = resolve(destination, 'kniu.config.js');
    await writeFile(configPath, (await readFile(configPath, 'utf8')).replace(/port: 5173/, `port: ${Number(port)}`));
  }
  const packagePath = resolve(destination, 'package.json');
  try {
    const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
    packageJson.name = name.toLowerCase();
    await writeFile(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
  } catch (error) {
    throw new Error(`无法写入项目 package.json：${error.message}`);
  }
  await writeFile(resolve(destination, '.kniu-project.json'), JSON.stringify({ name, template, createdAt: new Date().toISOString(), generator: 'kniu-create' }, null, 2) + '\n');
  console.log(`已创建 Kniu SPA：${destination}`);
  console.log(`进入项目目录：cd ${destination}`);
  console.log(`启动：npm run dev`);
}
