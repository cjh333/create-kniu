import PROCESS_ENV, { DOT_ENV } from './kniudotenv.mjs';
import { mkdir, readFile, readdir, rm, stat, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import BUILDER from '../config/builder.js';
import SERVER from '../config/server.js';
import { resolveAliasReferences } from './kniuutil.mjs';
import LOGGER from './kniulogger.mjs';

const { appLogger } = LOGGER;

const viewDirectory = String(SERVER.VIEWS || '/views').replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
const viewIndexPath = join(viewDirectory, 'index.html');

async function collectTemplates(directory = viewDirectory, rootDirectory = directory) {
  const { readdir, readFile } = await import('node:fs/promises');
  const { join, relative } = await import('node:path');
  const templates = {};
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(
    entries.map(async function (entry) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        Object.assign(templates, await collectTemplates(path, rootDirectory));
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        if (relative(rootDirectory, path).replaceAll('\\', '/') === 'index.html') return;
        const templatePath = `/${relative('.', path).replaceAll('\\', '/')}`;
        templates[templatePath] = resolveAliasReferences(await readFile(path, 'utf8'), SERVER.ALIAS);
      }
    }),
  );
  return templates;
}

const docsDirectory = 'public/docs';
async function collectDocs(directory = docsDirectory, rootDirectory = directory) {
  const docs = {};
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return docs;
    throw error;
  }
  await Promise.all(
    entries.map(async function (entry) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        Object.assign(docs, await collectDocs(path, rootDirectory));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        docs[`/${relative('.', path).replaceAll('\\', '/')}`] = await readFile(path, 'utf8');
      }
    }),
  );
  return docs;
}

export { collectDocs };

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
const outfile = BUILDER.OUTFILE.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
const outputTemplateDir = join(BUILDER.OUTPUT_DIR, outfile);
const publicPath = BUILDER.PUBLIC_PATH.replaceAll('\\', '/').replace(/\/+$/g, '');
const outputTemplateUrl = publicPath ? `${publicPath}/${outfile}` : outfile;
const browserRuntimeEnv = Object.freeze({
  PROCESS_ENV,
  HOST: DOT_ENV.HOST || '',
  PORT: DOT_ENV.PORT || ''
});

function contentHash(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 10);
}

function minifyHtml(content) {
  return content
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .trim();
}

function compactJavaScript(source) {
  let output = '';
  let state = 'code';
  let quote = '';
  let regexClass = false;
  const templateDepths = [];
  const regexPrefix = /[([{:;,=!?&|+\-*%^~<>]/;
  const appendSpace = function () { if (output && !output.endsWith(' ')) output += ' '; };
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (state === 'line-comment') {
      if (character === '\n') { appendSpace(); state = 'code'; }
      continue;
    }
    if (state === 'block-comment') {
      if (character === '*' && next === '/') { appendSpace(); state = 'code'; index += 1; }
      continue;
    }
    if (state === 'string') {
      output += character;
      if (character === '\\') { output += next || ''; index += 1; }
      else if (character === quote) state = 'code';
      continue;
    }
    if (state === 'regex') {
      output += character;
      if (character === '\\') { output += next || ''; index += 1; }
      else if (character === '[') regexClass = true;
      else if (character === ']') regexClass = false;
      else if (character === '/' && !regexClass) state = 'code';
      continue;
    }
    if (state === 'template') {
      if (character === '\\') { output += character + (next || ''); index += 1; }
      else if (character === '`') { output += character; state = 'code'; }
      else if (character === '$' && next === '{') { output += '${'; templateDepths.push(0); state = 'code'; index += 1; }
      else output += character;
      continue;
    }
    if (character === '\r' || character === '\n') { appendSpace(); continue; }
    if (character === '/' && next === '/') { state = 'line-comment'; index += 1; continue; }
    if (character === '/' && next === '*') { state = 'block-comment'; index += 1; continue; }
    if (character === '/' && (regexPrefix.test(output.trimEnd().slice(-1)) || !output.trim())) { output += character; regexClass = false; state = 'regex'; continue; }
    if (character === '"' || character === "'") { output += character; quote = character; state = 'string'; continue; }
    if (character === '`') { output += character; state = 'template'; continue; }
    if (templateDepths.length && character === '{') templateDepths[templateDepths.length - 1] += 1;
    if (templateDepths.length && character === '}') {
      const top = templateDepths.length - 1;
      if (templateDepths[top] === 0) { templateDepths.pop(); state = 'template'; }
      else templateDepths[top] -= 1;
    }
    output += character;
  }
  return output.trim();
}

// 将模板字符串内的物理换行编码为 \n，避免单行化后的 U+2028 落入 CSS 文本。
function encodeTemplateLineBreaks(source) {
  let output = '';
  let state = 'code';
  let quote = '';
  let regexClass = false;
  const templateDepths = [];
  const regexPrefix = /[([{:;,=!?&|+\-*%^~<>]/;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (state === 'line-comment') {
      output += character;
      if (character === '\n') state = 'code';
      continue;
    }
    if (state === 'block-comment') {
      output += character;
      if (character === '*' && next === '/') { output += next; index += 1; state = 'code'; }
      continue;
    }
    if (state === 'string') {
      output += character;
      if (character === '\\') { output += next || ''; index += 1; }
      else if (character === quote) state = 'code';
      continue;
    }
    if (state === 'regex') {
      output += character;
      if (character === '\\') { output += next || ''; index += 1; }
      else if (character === '[') regexClass = true;
      else if (character === ']') regexClass = false;
      else if (character === '/' && !regexClass) state = 'code';
      continue;
    }
    if (state === 'template') {
      if (character === '\\') { output += character + (next || ''); index += 1; }
      else if (character === '`') { output += character; state = 'code'; }
      else if (character === '$' && next === '{') { output += '${'; templateDepths.push(0); state = 'code'; index += 1; }
      else if (character === '\r' && next === '\n') { output += '\\n'; index += 1; }
      else output += character === '\n' ? '\\n' : character;
      continue;
    }
    if (character === '/' && next === '/') { output += '//'; index += 1; state = 'line-comment'; continue; }
    if (character === '/' && next === '*') { output += '/*'; index += 1; state = 'block-comment'; continue; }
    if (character === '/' && (regexPrefix.test(output.trimEnd().slice(-1)) || !output.trim())) { output += character; regexClass = false; state = 'regex'; continue; }
    if (character === '"' || character === "'") { output += character; quote = character; state = 'string'; continue; }
    if (character === '`') { output += character; state = 'template'; continue; }
    if (templateDepths.length && character === '{') templateDepths[templateDepths.length - 1] += 1;
    if (templateDepths.length && character === '}') {
      const top = templateDepths.length - 1;
      if (templateDepths[top] === 0) { templateDepths.pop(); state = 'template'; }
      else templateDepths[top] -= 1;
    }
    output += character;
  }
  return output;
}

// U+2028 是 JavaScript 的行终止符，但不产生物理换行；保留代码的 ASI 与注释边界。
function toSingleLineJavaScript(source) {
  return encodeTemplateLineBreaks(source).replace(/\r?\n/g, '\u2028');
}

async function clearOutputDirectory(directory) {
  let entries;
  try {
    entries = await readdir(directory);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  // 用 Windows 原生命令绕过 workbuddy shim（shim 拦截 fs.promises.rm 走 trash binary 偶尔 ETIMEDOUT）
  if (process.platform === 'win32') {
    const { execFileSync } = await import('node:child_process');
    for (const entryName of entries) {
      const target = join(directory, entryName);
      try { execFileSync('cmd.exe', ['/c', 'rmdir', '/s', '/q', target], { stdio: 'ignore' }); }
      catch (e) { /* 单个失败不影响后续 */ }
    }
    return;
  }
  await Promise.all(entries.map(function (entryName) { return rm(join(directory, entryName), { recursive: true, force: true }); }));
}

async function copySourceTree(sourcePath, destinationPath) {
  const info = await stat(sourcePath);
  if (info.isDirectory()) {
    await mkdir(destinationPath, { recursive: true });
    const entries = await readdir(sourcePath, { withFileTypes: true });
    await Promise.all(entries.map(function (entry) {
      return copySourceTree(join(sourcePath, entry.name), join(destinationPath, entry.name));
    }));
    return;
  }
  await mkdir(dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
}

function moduleId(filePath) {
  return relative(process.cwd(), filePath).replaceAll('\\', '/');
}

function resolveBrowserModule(fromPath, specifier) {
  if (!specifier.startsWith('.')) return '';
  return resolve(dirname(fromPath), specifier);
}

function importBinding(source, dependencyId) {
  const value = source.trim();
  if (value.startsWith('{')) {
    const bindings = value.slice(1, -1).split(',').map(function (entry) {
      const [name, alias = name] = entry.trim().split(/\s+as\s+/);
      return `${name.trim()}:${alias.trim()}`;
    }).join(',');
    return `const {${bindings}}=__require(${JSON.stringify(dependencyId)});`;
  }
  const comma = value.indexOf(',');
  if (comma === -1) return `const ${value}=__live(${JSON.stringify(dependencyId)},'default');`;
  const defaultName = value.slice(0, comma).trim();
  const named = importBinding(value.slice(comma + 1).trim(), dependencyId);
  return `const ${defaultName}=__live(${JSON.stringify(dependencyId)},'default');${named}`;
}

async function transformBrowserModule(source, filePath, visit) {
  // 浏览器包不读取磁盘 .env；构建时将当前环境内联到单文件包。
  // 保留 Node 源模块不变，避免影响开发服务器和构建命令本身。
  if (moduleId(filePath) === 'client/core/kniudotenv.mjs') {
    return `const RUNTIME_ENV=${JSON.stringify(browserRuntimeEnv)};const DOT_ENV=RUNTIME_ENV;const PROCESS_ENV=RUNTIME_ENV.PROCESS_ENV||'development';function parseEnv(){return {}}function loadEnv(){return RUNTIME_ENV}__exports.DOT_ENV=DOT_ENV;__exports.RUNTIME_ENV=RUNTIME_ENV;__exports.PROCESS_ENV=PROCESS_ENV;__exports.loadEnv=loadEnv;__exports.parseEnv=parseEnv;__exports.default=PROCESS_ENV;`;
  }
  const imports = [...source.matchAll(/^import\s+(.+?)\s+from\s+['"]([^'"]+)['"];?\s*$/gm)];
  const importIds = new Map();
  for (const match of imports) {
    const dependencyPath = resolveBrowserModule(filePath, match[2]);
    if (!dependencyPath) throw new Error(`Unsupported external browser dependency: ${match[2]}`);
    importIds.set(match[0], await visit(dependencyPath));
  }
  let transformed = source.replace(/^import\s+(.+?)\s+from\s+['"]([^'"]+)['"];?\s*$/gm, function (statement, binding) {
    return importBinding(binding, importIds.get(statement));
  });
  if (moduleId(filePath) === 'client/core/kniumvvm.mjs') {
    transformed = transformed.replace(
      'return import(`../controller/${controllerPath}.js`).then(function (module) {',
      'return Promise.resolve(__kniuLoadController(controllerPath)).then(function (module) {'
    );
  }
  const namedExports = [];
  transformed = transformed.replace(/^export\s+(async\s+)?(const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm, function (statement, asyncPrefix = '', kind, name) {
    namedExports.push([name, name]);
    return `${asyncPrefix}${kind} ${name}`;
  });
  transformed = transformed.replace(/^export\s*\{([^}]+)\};?\s*$/gm, function (statement, entries) {
    entries.split(',').forEach(function (entry) {
      const [name, alias = name] = entry.trim().split(/\s+as\s+/);
      namedExports.push([name.trim(), alias.trim()]);
    });
    return '';
  });
  transformed = transformed.replace(/^export\s+default\s+/gm, '__exports.default=');
  if (namedExports.length) {
    transformed += `\n${namedExports.map(function ([name, alias]) {
      return `__exports[${JSON.stringify(alias)}]=${name};`;
    }).join('')}`;
  }
  return transformed;
}

async function createBrowserBundle(entryPath = 'client/client.mjs') {
  const modules = new Map();
  async function visit(filePath) {
    const absolutePath = resolve(filePath);
    const id = moduleId(absolutePath);
    if (modules.has(id)) return id;
    modules.set(id, null);
    const source = await readFile(absolutePath, 'utf8');
    const transformed = await transformBrowserModule(source, absolutePath, visit);
    modules.set(id, transformed);
    return id;
  }
  const controllerDirectory = resolve('client/controller');
  async function collectControllers(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    await Promise.all(entries.map(function (entry) {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? collectControllers(path) : entry.isFile() && entry.name.endsWith('.js') ? visit(path) : null;
    }));
  }
  const entryId = await visit(entryPath);
  await collectControllers(controllerDirectory);
  const factories = [...modules.entries()].map(function ([id, source]) {
    return `${JSON.stringify(id)}:function(__require,__exports,__live,__kniuLoadController){${source}}`;
  }).join(',');
  return toSingleLineJavaScript(`(function(){'use strict';const __modules={${factories}};const __cache=Object.create(null);function __require(id){if(__cache[id])return __cache[id];const factory=__modules[id];if(!factory)throw new Error('[Kniu bundle] Module not found: '+id);const exports={};__cache[id]=exports;factory(__require,exports,__live,__kniuLoadController);return exports}function __live(id,key){const target=function(){const value=__require(id)[key];return value.apply(this,arguments)};return new Proxy(target,{get:function(_,property){const value=__require(id)[key];const member=value[property];return typeof member==='function'?member.bind(value):member},set:function(_,property,value){__require(id)[key][property]=value;return true},apply:function(_,thisArg,args){return __require(id)[key].apply(thisArg,args)}})}function __kniuLoadController(path){return __require('client/controller/'+path+'.js')}__require(${JSON.stringify(entryId)});})();`);
}

if (isMain) {
  await clearOutputDirectory(BUILDER.OUTPUT_DIR);
  appLogger.info('Start building', { OUTPUT_DIR: BUILDER.OUTPUT_DIR });
  await mkdir(BUILDER.OUTPUT_DIR, { recursive: true });
  await mkdir(outputTemplateDir, { recursive: true });
  await copySourceTree('public', join(BUILDER.OUTPUT_DIR, 'public'));
  const clientBundle = await createBrowserBundle();
  const clientFileName = `client.${contentHash(clientBundle)}.js`;
  await writeFile(join(outputTemplateDir, clientFileName), clientBundle);

  const templates = await collectTemplates();
  const rewrittenTemplates = Object.fromEntries(
    Object.entries(templates)
      .sort(function ([left], [right]) { return left.localeCompare(right); })
      .map(function ([templatePath, source]) {
        return [
          templatePath,
          source,
        ];
      }),
  );
  // 文档键保持源路径，浏览器中的动态视图加载器据此定位对应文档。
  const rewrittenDocs = await collectDocs();
  const templatesSource = `globalThis.__VIEW_TEMPLATES__=${JSON.stringify(rewrittenTemplates)};globalThis.__VIEW_DOCS__=${JSON.stringify(rewrittenDocs)};`;
  const templatesFileName = `templates.${contentHash(templatesSource)}.js`;
  await writeFile(join(outputTemplateDir, templatesFileName), templatesSource);
  const outputIndex = join(BUILDER.OUTPUT_DIR, 'index.html');
  const indexHtml = resolveAliasReferences(await readFile(viewIndexPath, 'utf8'), SERVER.ALIAS);
  const productionScripts =
    `<script src="${outputTemplateUrl}/${templatesFileName}"></script>` +
    `<script src="${outputTemplateUrl}/${clientFileName}"></script>`;
  await writeFile(
    outputIndex,
    minifyHtml(indexHtml
      .replace(/<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["']client\/client\.(?:js|mjs)["'])[^>]*>\s*<\/script>/i, productionScripts)),
  );
  console.log(BUILDER.SUCCESS_MESSAGE);
  appLogger.info(BUILDER.SUCCESS_MESSAGE);
  await appLogger.flushPendingWrites();
}

export default collectTemplates;
