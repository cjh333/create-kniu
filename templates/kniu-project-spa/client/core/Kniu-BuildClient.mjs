import { mkdir, readFile, readdir, rename, rm, stat, writeFile, copyFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { brotliCompress, gzip, gzipSync } from 'node:zlib';
import { promisify } from 'node:util';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveAliasReferences } from './Kniu-Util.mjs';
import { getContracts } from './Kniu-Contracts.mjs';
import { deepMerge } from './Kniu-Merge.mjs';
import { CORE_COMPONENT_TAGS } from './Kniu-ComponentManifest.mjs';
import { renderTemplate, configureTemplateEngine, extractStaticBlocks } from './Kniu-TemplateEngine.mjs';
import { withBootLoadingHtml } from './Kniu-BootLoading.mjs';

const rootDirectory = resolve(process.cwd());
const configPath = resolve(rootDirectory, process.env.KNIU_CONFIG || 'client/client.config.js');
const FRAMEWORK_CONFIG = (await import(pathToFileURL(configPath).href)).default || {};
const configDirectory = dirname(configPath);
const importRelative = async (name) => (await import(pathToFileURL(join(configDirectory, 'config', name)).href)).default || {};
const [projectRoutes, projectBases, projectViews, projectAuth] = await Promise.all([
  importRelative('router.js'), importRelative('server.js'), importRelative('viewer.js'), importRelative('auth.js')
]);
const PROJECT_SETTINGS = {
  routes: projectRoutes,
  views: projectViews,
  ...projectBases,
  auth: projectAuth
};
const PROJECT_CONFIG = deepMerge(FRAMEWORK_CONFIG, PROJECT_SETTINGS);
const buildConfig = PROJECT_CONFIG.build || {};
const BUILDER = {
  OUTPUT_DIR: String(buildConfig.outDir || './dist').replace(/^\.\//, ''),
  OUTFILE: String(buildConfig.outFile || './views/'),
  PUBLIC_PATH: String(buildConfig.publicPath || ''),
  MINIFY: buildConfig.minify !== false,
  SUCCESS_MESSAGE: buildConfig.successMessage || 'Kniu build completed.',
  PLUGINS: Array.isArray(buildConfig.plugins) ? buildConfig.plugins : [],
  PERFORMANCE: buildConfig.performance || {}
};
const SERVER = {
  VIEWS: PROJECT_CONFIG.root || './client/views',
  TEMPLATE_DIRS: PROJECT_CONFIG.templates?.dirs || [PROJECT_CONFIG.root || './client/views'],
  PUBLIC: PROJECT_CONFIG.publicDir || './client/public',
  ALIAS: PROJECT_CONFIG.resolve?.alias || {}
};
const APP = {
  PATHS: {
    controller_directory: './client/controller'
  }
};
const PROCESS_ENV = process.env.NODE_ENV || 'production';
const DOT_ENV = {};
const appLogger = {
  info(message, details) { console.info(`[kniu-build-client] ${message}`, details || ''); },
  async flushPendingWrites() { }
};

const viewDirectory = String(SERVER.VIEWS).replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
const viewIndexPath = join(viewDirectory, 'index.html');
const templateDirectories = (SERVER.TEMPLATE_DIRS || [viewDirectory]).map((directory) => String(directory).replaceAll('\\', '/').replace(/^\/+|\/+$/g, ''));
const publicDirectory = String(SERVER.PUBLIC).replaceAll('\\', '/').replace(/\/+$/g, '');
const publicOutputDirectory = String(buildConfig.outPublic || './public')
  .replaceAll('\\', '/')
  .replace(/^\.\//, '')
  .replace(/^\/+|\/+$/g, '');

async function collectTemplateDirectory(directory, rootDirectory = directory) {
  const { readdir, readFile } = await import('node:fs/promises');
  const { join, relative } = await import('node:path');
  const templates = {};
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(
    entries.map(async function (entry) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        Object.assign(templates, await collectTemplateDirectory(path, rootDirectory));
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        if (relative(rootDirectory, path).replaceAll('\\', '/') === 'index.html') return;
        const templatePath = `/${relative('.', path).replaceAll('\\', '/')}`;
        templates[templatePath] = resolveAliasReferences(squeezeHtml(await readFile(path, 'utf8')), SERVER.ALIAS);
      }
    }),
  );
  return templates;
}

async function collectTemplates() {
  const templates = {};
  for (const directory of templateDirectories) {
    Object.assign(templates, await collectTemplateDirectory(directory, directory));
  }
  return templates;
}

const docsDirectory = join(publicDirectory, 'doc');
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
        const relativeToPublic = relative(publicDirectory, path).replaceAll('\\', '/');
        docs[`/public/${relativeToPublic}`] = await readFile(path, 'utf8');
      }
    }),
  );
  return docs;
}

const PRERENDER_STYLE_RE = /<style\b[^>]*>[\s\S]*?<\/style>/gi;
const PRERENDER_MAX_DEPTH = 5;

async function expandPrerenderIncludes(source, currentFile, depth = 0) {
  if (depth >= PRERENDER_MAX_DEPTH) return source;
  const baseDirectory = dirname(currentFile);
  const includeRe = /<include\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*(?:><\/include>|>)/gi;
  let output = '';
  let cursor = 0;
  let match;
  while ((match = includeRe.exec(source)) !== null) {
    output += source.slice(cursor, match.index);
    cursor = match.index + match[0].length;
    const includePath = join(baseDirectory, match[1]);
    try {
      const included = await readFile(includePath, 'utf8');
      output += await expandPrerenderIncludes(included, includePath, depth + 1);
    } catch (error) {
      appLogger.info('Prerender include skipped', { includePath, error: error.code || error.message });
    }
  }
  return output + source.slice(cursor);
}

const PRERENDER_SKELETON_CSS = [
  '[data-kniu-prerender]{display:block;min-height:100vh;background:#f5f6f8}',
  '[data-kniu-prerender] .kniu_web_head{height:56px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08)}',
  '[data-kniu-prerender] kniu-navbar,[data-kniu-prerender] kniu-navbar-cells{display:block}',
  '[data-kniu-prerender] kniu-navbar-cells{display:flex;align-items:center;gap:18px;height:56px;max-width:1200px;margin:0 auto;padding:0 16px;color:#333;font-size:14px}',
  '[data-kniu-prerender] kniu-navbar-cell{display:inline-block;white-space:nowrap}',
  '[data-kniu-prerender] .kniu_web_body{min-height:calc(100vh - 56px)}',
  '[data-kniu-prerender] .kniu_container{max-width:1200px;margin:0 auto;padding:0 16px}',
  '[data-kniu-prerender] img:not([src]),[data-kniu-prerender] img[src=""]{visibility:hidden}'
].join('');

async function renderPrerenderShell() {
  try {
    const routes = PROJECT_CONFIG.routes || {};
    const defaultEntry = Object.entries(routes).find(([, route]) => route?.default)
      || Object.entries(routes)[0];
    if (!defaultEntry) return '';
    const [, route] = defaultEntry;
    const templateFile = join(viewDirectory, String(route.template));
    const rawSource = await readFile(templateFile, 'utf8');
    const expandedSource = await expandPrerenderIncludes(rawSource, templateFile);
    const staticSource = expandedSource.replace(PRERENDER_STYLE_RE, '');
    const html = renderTemplate(staticSource, {});
    return html ? `<div data-kniu-prerender data-kniu-path="${String(defaultEntry[0])}">${html}</div>` : '';
  } catch (error) {
    appLogger.info('Prerender shell skipped', { error: error.message });
    return '';
  }
}

export { collectDocs };
export { compactJavaScript, joinCodeSegments, squeezeCodeWhitespace, squeezeCss, squeezeHtml };
export { escapeInvisible, escapeInvisibleForLiteral, FORBIDDEN_IN_OUTPUT, INVISIBLE_CHARACTER };

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
let activeComponentTags = null;
let builtRequestWorkerUrl = '';
let builtIconsUrl = '';
let builtServiceWorkerUrl = '';
let builtPublicAssets = new Map();

function collectComponentTags(templates) {
  const tags = new Set();
  Object.values(templates).forEach((source) => {
    String(source).replace(/<\s*([a-z][a-z0-9]*-[a-z0-9-]+)/gi, (_, tag) => {
      tags.add(tag.toLowerCase());
      return _;
    });
  });
  const configured = buildConfig.componentTags;
  if (Array.isArray(configured)) configured.forEach((tag) => tags.add(String(tag).toLowerCase()));
  return tags;
}

function toComponentTag(directoryName) {
  return directoryName
    .replace(/^Kniu-/, '')
    .replace(/Component$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
    .replace(/^/, 'kniu-');
}

function filterComponentModule(source) {
  if (!activeComponentTags) return source;
  const componentVariables = {
    Badge: 'kniu-badge', Tag: 'kniu-tag', Status: 'kniu-status', Empty: 'kniu-empty',
    Button: 'kniu-btn', ButtonGroup: 'kniu-btn-group', Switch: 'kniu-switch', Modal: 'kniu-modal',
    Table: 'kniu-table', Msg: 'kniu-msg', Select: 'kniu-select',
    RadioGroup: 'kniu-radio-group', Page: 'kniu-page', PageMore: 'kniu-page-more', Image: 'kniu-image',
    Input: 'kniu-input', SmsVcode: 'kniu-smsvcode', Gvcode: 'kniu-gvcode', AuthLayout: 'kniu-auth-layout', DatePicker: 'kniu-date-picker', Form: 'kniu-form', Upload: 'kniu-upload',
    Icon: 'kniu-icon', Tab: 'kniu-tab', Editor: 'kniu-editor', Navbar: 'kniu-navbar',
    Backtop: 'kniu-backtop', Comment: 'kniu-comment', Like: 'kniu-like', UserLogin: 'kniu-user-login',
    ArticleTab: 'kniu-article-tab', VList: 'kniu-vlist'
  };
  const retainedVariables = new Set(Object.entries(componentVariables)
    .filter(([, tag]) => activeComponentTags.has(tag))
    .map(([variable]) => variable));
  const withoutUnusedImports = source.replace(/^import \* as ([A-Za-z_$][\w$]*) from ['"].*?['"];?\r?\n/gm, (statement, variable) => (
    componentVariables[variable] && !retainedVariables.has(variable) ? '' : statement
  ));
  const removedCssVariables = [];
  const withoutUnusedCss = withoutUnusedImports.replace(/^import\s+([A-Z_][A-Z0-9_]*)\s+from\s+['"]\.\/Kniu-Ui\/(Kniu-[A-Za-z0-9-]+)\/[^'"]+\.css\?module['"];?\r?\n/gm, (statement, variable, tag) => {
    if (!/Component$/.test(tag)) return statement;
    if (activeComponentTags.has(toComponentTag(tag))) return statement;
    removedCssVariables.push(variable);
    return '';
  });
  const withoutUnusedCssProperties = removedCssVariables.reduce((result, variable) => result
    .replace(new RegExp(`\\b[A-Z_][A-Z0-9_]*\\s*:\\s*${variable}\\s*,?`, 'g'), ''), withoutUnusedCss);
  return withoutUnusedCssProperties.replace(/^\s*\['(kniu-[a-z0-9-]+)',.*\](?:,)?(?:\r?\n|$)/gm, (statement, tag) => (
    activeComponentTags.has(tag) ? statement : ''
  ));
}

function contentHash(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 10);
}

const gzipAsync = promisify(gzip);
const brotliCompressAsync = promisify(brotliCompress);

async function writeCompressedAssets(directory, assetsDirectory) {
  const files = await collectFiles(directory);
  const compressed = {};
  const assetsRoot = resolve(assetsDirectory);
  await Promise.all(files.filter((file) => {
    const filePath = resolve(file);
    return !filePath.startsWith(`${assetsRoot}${process.platform === 'win32' ? '\\' : '/'}`)
      && /\.(?:css|js|json|html|svg|txt)$/i.test(file);
  }).map(async (file) => {
    const source = await readFile(file);
    if (source.length < 256) return;
    const [gzipContent, brotliContent] = await Promise.all([gzipAsync(source), brotliCompressAsync(source)]);
    const relativePath = relative(directory, file).replaceAll('\\', '/');
    const assetRelativePath = relativePath.replace(/^public\//, '');
    const gzipPath = join(assetsDirectory, `${assetRelativePath}.gz`);
    const brotliPath = join(assetsDirectory, `${assetRelativePath}.br`);
    await Promise.all([
      mkdir(dirname(gzipPath), { recursive: true }),
      mkdir(dirname(brotliPath), { recursive: true })
    ]);
    await Promise.all([writeFile(gzipPath, gzipContent), writeFile(brotliPath, brotliContent)]);
    compressed[relativePath] = {
      gzip: `/public/assets/${assetRelativePath}.gz`,
      brotli: `/public/assets/${assetRelativePath}.br`
    };
  }));
  return compressed;
}

function assertPerformanceBudget(fileName, source) {
  const isComponentChunk = /^components\./.test(fileName);
  const limitKiB = Number(isComponentChunk
    ? BUILDER.PERFORMANCE.maxComponentChunkKiB || 0
    : BUILDER.PERFORMANCE.maxInitialJsKiB || 0);
  if (!limitKiB || !/\.js$/i.test(fileName)) return;
  const rawSizeKiB = Buffer.byteLength(source) / 1024;
  const transferSizeKiB = gzipSync(source, { level: 9 }).length / 1024;
  if (transferSizeKiB > limitKiB) {
    const label = isComponentChunk ? '组件 JavaScript chunk' : '初始 JavaScript';
    const message = `[Kniu builder] ${label} ${fileName} 压缩后为 ${transferSizeKiB.toFixed(1)} KiB（原始 ${rawSizeKiB.toFixed(1)} KiB），超过 ${limitKiB} KiB 传输预算。`;
    if (BUILDER.PERFORMANCE.failOnBudgetExceeded) throw new Error(message);
    console.warn(message);
  }
}

function minifyHtml(content) {
  return content
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/[\r\n]+/g, '')
    .trim();
}

const CODE_FOLD = '\u0000';
const CODE_STOP = '\u0001';
const INVISIBLE_CHARACTER = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u0085\u00A0\u200B-\u200F\u2028\u2029\u2060\uFEFF]/;

function escapeInvisible(character) {
  if (!character || !INVISIBLE_CHARACTER.test(character)) return character;
  return `\\u${character.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
}

const INVISIBLE_CHARACTER_GLOBAL = new RegExp(INVISIBLE_CHARACTER.source, 'g');

function escapeInvisibleForLiteral(source) {
  return source.replace(INVISIBLE_CHARACTER_GLOBAL, function (character) { return escapeInvisible(character); });
}

const FORBIDDEN_IN_OUTPUT = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u0085\u00A0\u200B-\u200F\u2028\u2029\u2060\uFEFF]/;

function assertNoInvisible(label, source) {
  const hit = FORBIDDEN_IN_OUTPUT.exec(source);
  if (!hit) return;
  throw new Error(
    `[Kniu builder] ${label} 仍含不可见字符 U+${hit[0].charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}（偏移 ${hit.index}）`,
  );
}

const REGEX_AFTER_KEYWORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'case', 'do', 'else', 'yield', 'await', 'throw',
]);
const WORD_CHARACTER = /[A-Za-z0-9_$]/;

const TOKEN_OP = 'op';
const TOKEN_WORD = 'word';
const TOKEN_CLOSE = 'close';
const TOKEN_LITERAL = 'literal';
const TOKEN_INCDEC = 'incdec';
const RESTRICTED_TAIL = new Set(['return', 'throw', 'break', 'continue', 'yield', 'debugger', 'async']);
const CONTINUATION_HEAD = new Set([
  '(', '[', '`', '+', '-', '*', '/', '%', '&', '|', '^', '<', '>', '=', '?', '~', '.', ',', ')', ']', '}', ':', ';',
]);
const ATTACH_HEAD_WORDS = new Set(['else', 'catch', 'finally']);
const BLOCK_LEAD_WORDS = new Set(['else', 'do', 'try', 'finally']);
const CONTROL_HEAD_WORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'with']);

function peekNextCode(source, from) {
  let index = from;
  while (index < source.length) {
    const character = source[index];
    if (character === ' ' || character === '\t' || character === '\r' || character === '\n') { index += 1; continue; }
    if (character === '\u2028' || character === '\u2029') { index += 1; continue; }
    if (character === '/' && source[index + 1] === '/') {
      const stop = source.indexOf('\n', index);
      if (stop < 0) return '';
      index = stop + 1;
      continue;
    }
    if (character === '/' && source[index + 1] === '*') {
      const stop = source.indexOf('*/', index);
      if (stop < 0) return '';
      index = stop + 2;
      continue;
    }
    return source.slice(index, index + 12);
  }
  return '';
}

function continuesExpression(peek) {
  const head = peek[0];
  const two = peek.slice(0, 2);
  if (head === '!') return two === '!=';
  if ((head === '+' || head === '-') && two === head + head) return false;
  return CONTINUATION_HEAD.has(head);
}

function trailingWord(text) {
  const match = /([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(text);
  if (!match) return '';
  if (text[text.length - match[1].length - 1] === '.') return '';
  return match[1];
}

function parenHeadWord(text) {
  let depth = 0;
  for (let index = text.length - 1; index >= 0; index -= 1) {
    const character = text[index];
    if (character === ')') depth += 1;
    else if (character === '(') {
      depth -= 1;
      if (depth === 0) return (text.slice(0, index).match(/[\w$]+$/) || [''])[0];
    }
  }
  return '';
}

function isDoBlockTail(text) {
  const pattern = /(?:^|[^\w$.])do\b/g;
  let doIndex = -1;
  let match;
  while ((match = pattern.exec(text))) {
    doIndex = match.index + match[0].length - 2;
  }
  if (doIndex < 0) return false;
  return /^\s*\{[\s\S]*\}\s*$/.test(text.slice(doIndex + 2));
}

const MERGE_RISK = new Set([
  '++', '--', '//', '/*', '*/', '<<', '>>', '<=', '>=', '==', '!=', '=>', '&&', '||', '??', '?.', '..',
  '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<!',
]);

function needsSpaceBetween(previous, next) {
  if (!previous || !next) return false;
  if (WORD_CHARACTER.test(previous) && WORD_CHARACTER.test(next)) return true;
  if (next === '.' && /[0-9]/.test(previous)) return true;
  return MERGE_RISK.has(previous + next);
}

function decideBreak(kind, lastChar, output, peek) {
  if (kind === TOKEN_OP) return CODE_FOLD;
  const tailText = ` ${output.slice(-64)}`;
  if (kind === TOKEN_WORD && RESTRICTED_TAIL.has(trailingWord(tailText))) return CODE_STOP;
  if (continuesExpression(peek)) return CODE_FOLD;
  const headWord = (peek.match(/^[A-Za-z_$][A-Za-z0-9_$]*/) || [''])[0];
  if (kind === TOKEN_CLOSE && lastChar === '}') {
    if (ATTACH_HEAD_WORDS.has(headWord)) return CODE_FOLD;
    if (headWord === 'while' && isDoBlockTail(output.slice(-4096))) return CODE_FOLD;
  }
  if (peek[0] === '{') {
    if (kind === TOKEN_CLOSE && lastChar === ')' && CONTROL_HEAD_WORDS.has(parenHeadWord(` ${output.slice(-4096)}`))) return CODE_FOLD;
    if (/(?:^|[^\w$.])(?:function|class)\b/.test(tailText)) return CODE_FOLD;
    if (kind === TOKEN_WORD) {
      if (BLOCK_LEAD_WORDS.has(trailingWord(tailText))) return CODE_FOLD;
      if (/(?:^|[^\w$.])(?:function|class)\s+[\w$]+$/.test(tailText)) return CODE_FOLD;
    }
  }
  return CODE_STOP;
}

function squeezeCodeWhitespace(source) {
  let output = '';
  let state = 'code';
  let quote = '';
  let regexClass = false;
  let lastChar = '';
  let lastKind = TOKEN_OP;
  let lastWasSpace = false;
  let whitespaceRun = false;
  let blockHasNewline = false;
  const templateDepths = [];
  const regexPrefix = /[([{:;,=!?&|+\-*%^~<>]/;
  let lastWord = '';
  let afterSpace = false;
  const trackWord = function (character) {
    if (WORD_CHARACTER.test(character)) { lastWord = afterSpace ? character : lastWord + character; afterSpace = false; }
    else if (character === ' ') afterSpace = true;
    else { lastWord = ''; afterSpace = false; }
  };
  const emit = function (character) {
    const previousChar = lastChar;
    output += character;
    lastWasSpace = character === ' ' || character === CODE_FOLD || character === CODE_STOP;
    if (!lastWasSpace) {
      if (WORD_CHARACTER.test(character)) lastKind = TOKEN_WORD;
      else if (character === ')' || character === ']' || character === '}') lastKind = TOKEN_CLOSE;
      else if ((character === '+' || character === '-') && previousChar === character) lastKind = TOKEN_INCDEC;
      else lastKind = TOKEN_OP;
      lastChar = character;
    }
    if (!lastWasSpace) whitespaceRun = false;
    trackWord(character);
  };
  const appendRaw = function (character) {
    output += escapeInvisible(character);
    lastWasSpace = false;
    lastChar = character;
    lastKind = TOKEN_LITERAL;
    lastWord = '';
    afterSpace = false;
    whitespaceRun = false;
  };
  const appendEscapedRaw = function (next) {
    if (next && INVISIBLE_CHARACTER.test(next)) appendRaw(next);
    else { appendRaw('\\'); if (next) appendRaw(next); }
  };
  const emitWhitespace = function (fromIndex) {
    if (whitespaceRun) return;
    whitespaceRun = true;
    if (!output) return;
    const ahead = peekNextCode(source, fromIndex);
    if (needsSpaceBetween(lastChar, ahead[0])) emit(' ');
  };
  const emitBreak = function (fromIndex) {
    const previous = output[output.length - 1];
    if (previous === CODE_FOLD || previous === CODE_STOP) return;
    if (output.endsWith(' ')) output = output.replace(/[ ]+$/, '');
    if (!output) return;
    const peek = peekNextCode(source, fromIndex);
    if (!peek) return;
    output += decideBreak(lastKind, lastChar, output, peek);
    lastWasSpace = true;
    whitespaceRun = true;
    lastWord = '';
    afterSpace = false;
  };
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (state === 'line-comment') {
      if (character === '\n') { emitBreak(index); state = 'code'; }
      continue;
    }
    if (state === 'block-comment') {
      if (character === '\n') blockHasNewline = true;
      if (character === '*' && next === '/') {
        if (blockHasNewline) emitBreak(index + 2);
        else emitWhitespace(index + 2);
        state = 'code';
        index += 1;
      }
      continue;
    }
    if (state === 'string') {
      if (character === '\\') { appendEscapedRaw(next); index += 1; }
      else { appendRaw(character); if (character === quote) state = 'code'; }
      continue;
    }
    if (state === 'regex') {
      if (character === '\\') { appendEscapedRaw(next); index += 1; continue; }
      appendRaw(character);
      if (character === '[') regexClass = true;
      else if (character === ']') regexClass = false;
      else if (character === '/' && !regexClass) { state = 'code'; lastChar = ')'; }
      continue;
    }
    if (state === 'template') {
      if (character === '\\') { appendEscapedRaw(next); index += 1; }
      else if (character === '`') { appendRaw(character); state = 'code'; }
      else if (character === '$' && next === '{') { appendRaw('${'); templateDepths.push(0); state = 'code'; index += 1; }
      else if (character === '\n') appendRaw('\\n');
      else if (character === '\r') { appendRaw('\\n'); if (next === '\n') index += 1; }
      else appendRaw(character);
      continue;
    }
    if (character === '\r') continue;
    if (character === '\n') { emitBreak(index); continue; }
    if (character === '\u2028' || character === '\u2029') { emitBreak(index); continue; }
    if (INVISIBLE_CHARACTER.test(character)) continue;
    if (character === ' ' || character === '\t') { emitWhitespace(index); continue; }
    if (character === '/' && next === '/') { state = 'line-comment'; index += 1; continue; }
    if (character === '/' && next === '*') { blockHasNewline = false; state = 'block-comment'; index += 1; continue; }
    if (character === '/' && (REGEX_AFTER_KEYWORDS.has(lastWord) || regexPrefix.test(lastChar) || !lastChar)) { emit(character); regexClass = false; state = 'regex'; continue; }
    if (character === '"' || character === "'") { emit(character); quote = character; state = 'string'; continue; }
    if (character === '`') { emit(character); state = 'template'; continue; }
    if (templateDepths.length && character === '{') templateDepths[templateDepths.length - 1] += 1;
    if (templateDepths.length && character === '}') {
      const top = templateDepths.length - 1;
      if (templateDepths[top] === 0) { templateDepths.pop(); state = 'template'; }
      else templateDepths[top] -= 1;
    }
    emit(character);
  }
  return output;
}

function joinCodeSegments(source) {
  let output = '';
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === CODE_FOLD) {
      if (needsSpaceBetween(output[output.length - 1], source[index + 1])) output += ' ';
      continue;
    }
    if (character === CODE_STOP) { output += ';'; continue; }
    output += character;
  }
  return output;
}

function compactJavaScript(source) {
  return joinCodeSegments(squeezeCodeWhitespace(source));
}

const RAW_TEXT_TAGS = ['style', 'script', 'pre', 'textarea'];
const CSS_TEXT_TAGS = ['style'];

function squeezeTagWhitespace(tag) {
  let output = '';
  let quote = '';
  let lastWasSpace = false;
  for (const character of tag) {
    if (quote) {
      output += character;
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") { quote = character; output += character; lastWasSpace = false; continue; }
    if (character === ' ' || character === '\t' || character === '\n' || character === '\r') {
      if (!lastWasSpace) { output += ' '; lastWasSpace = true; }
      continue;
    }
    output += character;
    lastWasSpace = false;
  }
  return output;
}

const CSS_SPACE_DROP_BEFORE = new Set(['{', '}', ';', ',', ')', '!']);
const CSS_SPACE_DROP_AFTER = new Set(['{', '}', ';', ',', '(', ':', '!']);

function squeezeCss(source) {
  let output = '';
  let pendingSpace = false;
  let index = 0;
  const length = source.length;
  const flushSpace = function (nextCharacter) {
    if (!pendingSpace || !output) return;
    pendingSpace = false;
    if (CSS_SPACE_DROP_BEFORE.has(nextCharacter)) return;
    if (CSS_SPACE_DROP_AFTER.has(output[output.length - 1])) return;
    output += ' ';
  };
  while (index < length) {
    const character = source[index];
    if (character === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      index = end === -1 ? length : end + 2;
      if (output) pendingSpace = true;
      continue;
    }
    if (character === ' ' || character === '\t' || character === '\n' || character === '\r' || character === '\f') {
      if (output) pendingSpace = true;
      index += 1;
      continue;
    }
    flushSpace(character);
    if (character === '"' || character === "'") {
      let cursor = index + 1;
      while (cursor < length) {
        if (source[cursor] === '\\') { cursor += 2; continue; }
        if (source[cursor] === character) { cursor += 1; break; }
        cursor += 1;
      }
      output += source.slice(index, cursor);
      index = cursor;
      continue;
    }
    output += character;
    index += 1;
  }
  return output;
}

function squeezeHtml(source) {
  let output = '';
  let pendingSpace = false;
  const flushSpace = function () { if (pendingSpace) { output += ' '; pendingSpace = false; } };
  const write = function (text) { flushSpace(); output += text; };
  let index = 0;
  while (index < source.length) {
    if (source.startsWith('<!--', index)) {
      const end = source.indexOf('-->', index + 4);
      const stop = end === -1 ? source.length : end + 3;
      write(source.slice(index, stop));
      index = stop;
      continue;
    }
    const character = source[index];
    if (character === '<') {
      let cursor = index + 1;
      let tagQuote = '';
      while (cursor < source.length) {
        const inner = source[cursor];
        if (tagQuote) { if (inner === tagQuote) tagQuote = ''; }
        else if (inner === '"' || inner === "'") tagQuote = inner;
        else if (inner === '>') break;
        cursor += 1;
      }
      const stop = cursor < source.length ? cursor + 1 : source.length;
      const tag = source.slice(index, stop);
      write(squeezeTagWhitespace(tag));
      index = stop;
      const name = (tag.match(/^<\s*([A-Za-z][\w-]*)/) || [])[1];
      if (name && RAW_TEXT_TAGS.includes(name.toLowerCase()) && !tag.endsWith('/>')) {
        const closePattern = new RegExp(`</\\s*${name}\\s*>`, 'i');
        const hit = closePattern.exec(source.slice(index));
        if (hit) {
          const raw = source.slice(index, index + hit.index);
          write(CSS_TEXT_TAGS.includes(name.toLowerCase()) ? squeezeCss(raw) : raw);
          write(hit[0]);
          index += hit.index + hit[0].length;
        }
      }
      continue;
    }
    if (character === ' ' || character === '\t' || character === '\n' || character === '\r') {
      if (output) pendingSpace = true;
      index += 1;
      continue;
    }
    flushSpace();
    output += character;
    index += 1;
  }
  return output.replace(/[\s]+$/g, '');
}

async function clearOutputDirectory(directory) {
  let entries;
  try {
    entries = await readdir(directory);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  await Promise.all(entries.map(function (entryName) { return rm(join(directory, entryName), { recursive: true, force: true }); }));
}

async function copySourceTree(sourcePath, destinationPath, shouldSkip) {
  const info = await stat(sourcePath);
  if (info.isDirectory()) {
    await mkdir(destinationPath, { recursive: true });
    const entries = await readdir(sourcePath, { withFileTypes: true });
    await Promise.all(entries.map(function (entry) {
      return copySourceTree(join(sourcePath, entry.name), join(destinationPath, entry.name), shouldSkip);
    }));
    return;
  }
  if (typeof shouldSkip === 'function' && shouldSkip(sourcePath)) return;
  await mkdir(dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
}

async function findRedundantMinifiedFiles(directory) {
  const all = new Set((await collectFiles(directory)).map((file) => relative(directory, file).replaceAll('\\', '/')));
  const redundant = new Map();
  for (const path of all) {
    const pair = /^(.*)\.min\.(css|js|mjs|json)$/i.exec(path);
    if (!pair) continue;
    const sourcePath = `${pair[1]}.${pair[2]}`;
    if (all.has(sourcePath)) redundant.set(path, sourcePath);
  }
  return redundant;
}

async function buildMinifiedAssetAliases(directory, redundant = new Map()) {
  const all = new Set((await collectFiles(directory)).map((file) => relative(directory, file).replaceAll('\\', '/')));
  const aliases = new Map(redundant);
  for (const path of all) {
    if (/\.min\.(?:css|js|mjs|json)$/i.test(path)) continue;
    const minPath = path.replace(/(\.[^.]+)$/i, '.min$1');
    if (!all.has(minPath) || redundant.has(minPath)) aliases.set(minPath, path);
  }
  return aliases;
}

async function collectFiles(directory, files = []) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collectFiles(path, files);
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function hashedAssetName(fileName, hash) {
  const extensionIndex = fileName.lastIndexOf('.');
  if (extensionIndex < 1) return `${fileName}.${hash}`;
  const stem = fileName.slice(0, extensionIndex);
  const extension = fileName.slice(extensionIndex);
  const normalizedStem = stem.endsWith('.min') ? stem.slice(0, -4) : stem;
  const minifiable = /\.(?:css|js|json)$/i.test(extension);
  return minifiable
    ? `${normalizedStem}.${hash}.min${extension}`
    : `${normalizedStem}.${hash}${extension}`;
}

function minifyPublicAsset(fileName, content) {
  if (/\.css$/i.test(fileName)) return squeezeCss(content);
  if (/\.(?:js|mjs)$/i.test(fileName)) return compactJavaScript(content);
  if (/\.json$/i.test(fileName)) {
    try { return JSON.stringify(JSON.parse(content)); } catch { return squeezeCodeWhitespace(content); }
  }
  return content;
}

function rewritePublicReferences(source, assets) {
  let output = String(source);
  for (const [original, hashed] of assets) {
    output = output.replaceAll(original, hashed);
    output = output.replaceAll(original.slice(1), hashed.slice(1));
  }
  return output;
}

function isExternalCssReference(value) {
  return !value || value.startsWith('//') || value.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(value);
}

function splitCssReference(value) {
  const index = value.search(/[?#]/);
  return index === -1 ? [value, ''] : [value.slice(0, index), value.slice(index)];
}

function publicPathFor(directory, value) {
  const raw = String(value).replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = [];
  for (const part of `${directory}${raw}`.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

function cssReferenceValues(source) {
  const text = String(source || '');
  const values = [];
  for (const match of text.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)) values.push(match[2]);
  for (const match of text.matchAll(/@import\s+(['"])([^'"]+)\1/gi)) values.push(match[2]);
  return values;
}

function rewriteCssAssetReferences(source, sourceRelativePath, assets) {
  const directory = sourceRelativePath.slice(0, sourceRelativePath.lastIndexOf('/') + 1);
  const rewriteValue = (value) => {
    if (isExternalCssReference(value) || value.startsWith('/')) return value;
    const [pathPart, suffix] = splitCssReference(value);
    const hashed = assets.get(`/public/${publicPathFor(directory, pathPart)}`);
    return hashed ? `${hashed}${suffix}` : value;
  };
  let output = String(source);
  output = output.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote, value) => {
    const next = rewriteValue(value);
    return next === value ? match : `url(${quote}${next}${quote})`;
  });
  output = output.replace(/(@import\s+)(['"])([^'"]+)\2/gi, (match, prefix, quote, value) => {
    const next = rewriteValue(value);
    return next === value ? match : `${prefix}${quote}${next}${quote}`;
  });
  return output;
}

function cssAssetDependencies(source, sourceRelativePath, cssSources, minAliases) {
  const directory = sourceRelativePath.slice(0, sourceRelativePath.lastIndexOf('/') + 1);
  const dependencies = [];
  for (const value of cssReferenceValues(source)) {
    if (isExternalCssReference(value) || value.startsWith('/')) continue;
    const [pathPart] = splitCssReference(value);
    const key = publicPathFor(directory, pathPart);
    const sourceKey = minAliases.get(key) || key;
    if (cssSources.has(sourceKey)) dependencies.push(sourceKey);
  }
  return dependencies;
}

async function hashPublicAssets(directory, minAliases = new Map()) {
  const files = await collectFiles(directory);
  const assets = new Map();
  const cssSources = new Map();
  const registerMinAliases = (relativePath, hashedRelativePath) => {
    for (const [minPath, sourcePath] of minAliases) {
      if (sourcePath === relativePath) assets.set(`/public/${minPath}`, `/public/${hashedRelativePath}`);
    }
  };
  for (const file of files) {
    if (/(?:^|[\\/])(?:robots\.txt|sitemap\.xml)$/i.test(file)) continue;
    const relativePath = relative(directory, file).replaceAll('\\', '/');
    if (/\.css$/i.test(file)) {
      cssSources.set(relativePath, { file, source: await readFile(file, 'utf8') });
      continue;
    }
    const originalContent = await readFile(file);
    const textContent = /\.(?:css|js|mjs|json)$/i.test(file) ? originalContent.toString('utf8') : null;
    const outputContent = textContent === null ? originalContent : minifyPublicAsset(file, textContent);
    const hash = contentHash(outputContent);
    const hashedRelativePath = `${relativePath.slice(0, Math.max(0, relativePath.lastIndexOf('/') + 1))}${hashedAssetName(file.split(/[\\/]/).at(-1), hash)}`;
    const nextFile = join(directory, hashedRelativePath);
    if (typeof outputContent === 'string') await writeFile(file, outputContent);
    await rename(file, nextFile);
    assets.set(`/public/${relativePath}`, `/public/${hashedRelativePath}`);
    registerMinAliases(relativePath, hashedRelativePath);
  }
  const visiting = new Set();
  const processed = new Set();
  async function processCss(relativePath) {
    if (processed.has(relativePath)) return;
    if (visiting.has(relativePath)) {
      appLogger.info('CSS 循环引用，跳过提前解析', relativePath);
      return;
    }
    visiting.add(relativePath);
    const { file, source } = cssSources.get(relativePath);
    for (const dependency of cssAssetDependencies(source, relativePath, cssSources, minAliases)) {
      await processCss(dependency);
    }
    const rewritten = rewriteCssAssetReferences(rewritePublicReferences(source, assets), relativePath, assets);
    const outputContent = minifyPublicAsset(file, rewritten);
    const hash = contentHash(outputContent);
    const hashedRelativePath = `${relativePath.slice(0, Math.max(0, relativePath.lastIndexOf('/') + 1))}${hashedAssetName(file.split(/[\\/]/).at(-1), hash)}`;
    await writeFile(file, outputContent);
    await rename(file, join(directory, hashedRelativePath));
    assets.set(`/public/${relativePath}`, `/public/${hashedRelativePath}`);
    registerMinAliases(relativePath, hashedRelativePath);
    visiting.delete(relativePath);
    processed.add(relativePath);
  }
  for (const relativePath of cssSources.keys()) await processCss(relativePath);
  return assets;
}

function moduleId(filePath) {
  return relative(process.cwd(), filePath).replaceAll('\\', '/');
}

async function resolveBrowserModule(fromPath, specifier) {
  const [bare] = specifier.split('?');
  if (bare.startsWith('.') || bare.startsWith('/')) return resolve(dirname(fromPath), bare);
  if (bare.startsWith('node:')) {
    throw new Error(`[Kniu builder] 浏览器包不能引用 Node 内置模块：${bare}（来自 ${moduleId(fromPath)}）`);
  }
  try {
    const resolvedUrl = await import.meta.resolve(bare, pathToFileURL(fromPath).href);
    if (!resolvedUrl.startsWith('file:')) {
      throw new Error(`解析结果不是本地 ESM 文件：${resolvedUrl}`);
    }
    return fileURLToPath(resolvedUrl);
  } catch (error) {
    throw new Error(`[Kniu builder] 无法解析浏览器 ESM 依赖 “${bare}”（来自 ${moduleId(fromPath)}）：${error.message}`);
  }
}

function isDataDefaultExport(source) {
  if (/^export\s+default\s*[{[]/m.test(source)) return true;
  const match = /^export\s+default\s+([A-Za-z_$][\w$]*)\s*;?\s*$/m.exec(source);
  if (!match) return false;
  const name = match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const decl = new RegExp('(?:const|let|var)\\s+' + name + '\\s*=\\s*([\\s\\S]{0,200}?);').exec(source);
  if (!decl) return false;
  const init = decl[1].trim();
  return /^[[{]/.test(init) || /^(?:[\w$]+\.)?(?:deepMerge|merge|assign)\s*\(/i.test(init);
}

function importBinding(source, dependencyId, defaultIsData = false) {
  const value = source.trim();
  if (/^\*\s+as\s+[A-Za-z_$][\w$]*$/.test(value)) {
    const name = value.replace(/^\*\s+as\s+/, '');
    return `const ${name}=__require(${JSON.stringify(dependencyId)});`;
  }
  if (value.startsWith('{')) {
    const bindings = value.slice(1, -1).split(',').map(function (entry) {
      const [name, alias = name] = entry.trim().split(/\s+as\s+/);
      return `${name.trim()}:${alias.trim()}`;
    }).join(',');
    return `const {${bindings}}=__require(${JSON.stringify(dependencyId)});`;
  }
  const defaultAccess = defaultIsData
    ? `__require(${JSON.stringify(dependencyId)})["default"]`
    : `__live(${JSON.stringify(dependencyId)},'default')`;
  const comma = value.indexOf(',');
  if (comma === -1) return `const ${value}=${defaultAccess};`;
  const defaultName = value.slice(0, comma).trim();
  const named = importBinding(value.slice(comma + 1).trim(), dependencyId);
  return `const ${defaultName}=${defaultAccess};${named}`;
}

async function transformBrowserModule(source, filePath, visit) {
  if (moduleId(filePath) === 'client/core/Kniu-Components.mjs') {
    source = source.replace(/const \{ default: ui \} = await import\('\.\/Kniu-Ui\/Kniu-Ui\.mjs'\);/g, "const ui = (await import('./Kniu-Ui/Kniu-UiEssential.mjs')).createUiEssential(componentContext);");
    if (builtIconsUrl) source = source.replace(/import\('\.\/Kniu-Icons\.mjs'\)/g, `import(${JSON.stringify(builtIconsUrl)})`);
  }
  if (moduleId(filePath) === 'client/core/Kniu-UiConfig.mjs') {
    source = source.replace(/import KniuUI from '\.\/Kniu-Ui\/Kniu-Ui\.mjs';/g, "import { createUiEssential } from './Kniu-Ui/Kniu-UiEssential.mjs';\nconst KniuUI = createUiEssential(null);");
  }
  source = source.replace(/^import\s*\{[^}]*\}\s*from\s*(['"])[^'"]+\1;?/gm, function (statement) {
    return statement.replace(/\r?\n\s*/g, ' ');
  });
  if (moduleId(filePath) === 'client/core/Kniu-Components.mjs') source = filterComponentModule(source);
  if (moduleId(filePath) === 'client/core/kniudotenv.mjs') {
    return `const RUNTIME_ENV=${JSON.stringify(browserRuntimeEnv)};const DOT_ENV=RUNTIME_ENV;const PROCESS_ENV=RUNTIME_ENV.PROCESS_ENV||'development';function parseEnv(){return {}}function loadEnv(){return RUNTIME_ENV}__exports.DOT_ENV=DOT_ENV;__exports.RUNTIME_ENV=RUNTIME_ENV;__exports.PROCESS_ENV=PROCESS_ENV;__exports.loadEnv=loadEnv;__exports.parseEnv=parseEnv;__exports.default=PROCESS_ENV;`;
  }
  const optionalImports = [...source.matchAll(/await\s+optionalConfig\(\s*['"]([^'"]+)['"]\s*\)/g)];
  for (const match of optionalImports) {
    let replacement = 'null';
    try {
      const dependencyPath = await resolveBrowserModule(filePath, match[1]);
      const dependencyId = await visit(dependencyPath);
      replacement = `__require(${JSON.stringify(dependencyId)})["default"]`;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    source = source.replace(match[0], replacement);
  }
  const imports = [...source.matchAll(/^import\s+(.+?)\s+from\s+['"]([^'"]+)['"];?\s*$/gm)];
  const importIds = new Map();
  const importDataDefaults = new Map();
  for (const match of imports) {
    const dependencyPath = await resolveBrowserModule(filePath, match[2]);
    importIds.set(match[0], await visit(dependencyPath));
    const depSource = (await readFile(dependencyPath, 'utf8'))
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    importDataDefaults.set(match[0], isDataDefaultExport(depSource));
  }
  let transformed = source.replace(/^import\s+(.+?)\s+from\s+['"]([^'"]+)['"];?\s*$/gm, function (statement, binding) {
    return importBinding(binding, importIds.get(statement), importDataDefaults.get(statement) === true);
  });
  const sideEffectImports = [...transformed.matchAll(/^import\s+['"]([^'"]+)['"];?\s*$/gm)];
  const sideEffectIds = new Map();
  for (const match of sideEffectImports) sideEffectIds.set(match[0], await visit(await resolveBrowserModule(filePath, match[1])));
  transformed = transformed.replace(/^import\s+['"]([^'"]+)['"];?\s*$/gm, function (statement) {
    return `__require(${JSON.stringify(sideEffectIds.get(statement))});`;
  });
  const reexportIds = new Map();
  const reexports = [...source.matchAll(/^export\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?\s*$/gm)];
  for (const match of reexports) {
    const dependencyPath = await resolveBrowserModule(filePath, match[2]);
    reexportIds.set(match[0], await visit(dependencyPath));
  }
  if (reexports.length) {
    transformed = transformed.replace(/^export\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?\s*$/gm, function (statement, entries) {
      const dependencyId = reexportIds.get(statement);
      return entries.split(',').map(function (entry) {
        const [name, alias = name] = entry.trim().split(/\s+as\s+/);
        return `__exports[${JSON.stringify(alias.trim())}]=__require(${JSON.stringify(dependencyId)})[${JSON.stringify(name.trim())}];`;
      }).join('');
    });
  }
  const exportAll = [...transformed.matchAll(/^export\s+\*\s+from\s+['"]([^'"]+)['"];?\s*$/gm)];
  const exportAllIds = new Map();
  for (const match of exportAll) exportAllIds.set(match[0], await visit(await resolveBrowserModule(filePath, match[1])));
  transformed = transformed.replace(/^export\s+\*\s+from\s+['"]([^'"]+)['"];?\s*$/gm, function (statement) {
    return `Object.assign(__exports,__require(${JSON.stringify(exportAllIds.get(statement))}));delete __exports.default;`;
  });
  if (moduleId(filePath) === 'client/core/Kniu-Router.mjs') {
    transformed = transformed.replace(/import\((url|controllerUrl\(route\.controller\))\)/g, '__kniuLoadControllerUrl($1)');
  }
  const staticDynamicImports = [...transformed.matchAll(/import\(\s*(['"])(\.[^'"]+\.(?:mjs|js))\1\s*\)/g)];
  for (const match of staticDynamicImports) {
    const dependencyPath = await resolveBrowserModule(filePath, match[2]);
    const dependencyId = await visit(dependencyPath);
    transformed = transformed.replace(match[0], `Promise.resolve().then(function(){return __require(${JSON.stringify(dependencyId)})})`);
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

async function runPluginHook(plugins, hook, context) {
  for (const plugin of plugins) {
    if (typeof plugin?.[hook] !== 'function') continue;
    try {
      await plugin[hook](context);
    } catch (error) {
      throw new Error(`[Kniu builder] 插件 ${plugin.name || 'anonymous'} 的 ${hook} 钩子失败：${error.message}`, { cause: error });
    }
  }
}

async function createBrowserBundle(entryPath = 'client/client.js', plugins = [], globalExport = '', options = {}) {
  const externalModules = options.externalModules instanceof Set ? options.externalModules : null;
  const externalSharedKey = options.externalSharedKey || '__KNIU_SHARED__';
  const sharedCandidates = options.sharedCandidates instanceof Set ? options.sharedCandidates : null;
  const sharedExportKey = options.sharedExportKey || '';
  const moduleIdsOut = options.moduleIdsOut instanceof Set ? options.moduleIdsOut : null;
  const sharedExportedOut = options.sharedExportedOut instanceof Set ? options.sharedExportedOut : null;
  const isAsyncSource = (source) => {
    try { new Function(source); return false; }
    catch (error) { return /await is only valid in async functions/.test(error.message); }
  };
  const externalStubSource = (id) => (
    `const __shared=(globalThis[${JSON.stringify(externalSharedKey)}]=globalThis[${JSON.stringify(externalSharedKey)}]||Object.create(null))[${JSON.stringify(id)}];`
    + `if(!__shared)throw new Error('[Kniu bundle] 共享模块未就绪：${id}');`
    + `for(const __sharedKey in __shared)__exports[__sharedKey]=__shared[__sharedKey];`
  );
  const modules = new Map();
  async function visit(filePath) {
    const absolutePath = resolve(filePath);
    const id = moduleId(absolutePath);
    if (modules.has(id)) return id;
    if (externalModules?.has(id)) {
      modules.set(id, externalStubSource(id));
      return id;
    }
    modules.set(id, null);
    if (absolutePath.endsWith('.css')) {
      const css = squeezeCss(await readFile(absolutePath, 'utf8'));
      modules.set(id, `__exports.default=${escapeInvisibleForLiteral(JSON.stringify(css))};`);
      return id;
    }
    if (absolutePath.endsWith('.html')) {
      const html = await readFile(absolutePath, 'utf8');
      modules.set(id, `__exports.default=${escapeInvisibleForLiteral(JSON.stringify(html))};`);
      return id;
    }
    let source = await readFile(absolutePath, 'utf8');
    if (builtRequestWorkerUrl) {
      source = source.replace(/(['"])\/client\/core\/Kniu-RequestWorker\.mjs\1/g, () => JSON.stringify(builtRequestWorkerUrl));
    }
    if (builtServiceWorkerUrl) {
      source = source.replace(/(['"])\/public\/assets\/Kniu-Sw\.mjs\1/g, () => JSON.stringify(builtServiceWorkerUrl));
    }
    if (builtPublicAssets.size) source = rewritePublicReferences(source, builtPublicAssets);
    if (absolutePath === resolve('client/core/Kniu-Components.mjs') && activeComponentTags) {
      const customTags = [...activeComponentTags].filter((tag) => !tag.startsWith('kniu-'));
      const componentsSource = readFileSync(resolve('client/core/Kniu-Components.mjs'), 'utf8');
      const nameBody = componentsSource.slice(
        componentsSource.indexOf('function customComponentName('),
        componentsSource.indexOf('function customComponentUrl(')
      );
      const customComponentName = new Function(`${nameBody}; return customComponentName;`)();
      const customRoot = String(getContracts().paths.customComponents || '../custom').replace(/[/\\]+$/, '');
      const imports = customTags.map((tag) => {
        const name = customComponentName(tag);
        return `import '${customRoot}/${name}/${name}.mjs';`;
      }).join('\n');
      if (imports) source = `${imports}\n${source}`;
    }
    const transformContext = { id, path: absolutePath, code: source };
    for (const plugin of plugins) {
      if (typeof plugin?.transformModule !== 'function') continue;
      try {
        const result = await plugin.transformModule(transformContext);
        if (typeof result === 'string') source = result;
        else if (result && typeof result.code === 'string') source = result.code;
        transformContext.code = source;
      } catch (error) {
        throw new Error(`[Kniu builder] 插件 ${plugin.name || 'anonymous'} 的 transformModule 钩子失败（${id}）：${error.message}`, { cause: error });
      }
    }
    if (/\brequire\s*\(/.test(source)) {
      throw new Error(`[Kniu builder] ${id} 包含 CommonJS require()；请使用浏览器兼容的 ESM npm 包。`);
    }
    const transformed = await transformBrowserModule(source, absolutePath, visit);
    modules.set(id, compactJavaScript(transformed));
    return id;
  }
  const controllerDirectory = resolve(String(APP.PATHS.controller_directory));
  const controllerModuleRoot = String(APP.PATHS.controller_directory).replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
  async function collectControllers(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    await Promise.all(entries.map(function (entry) {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? collectControllers(path) : entry.isFile() && entry.name.endsWith('.js') ? visit(path) : null;
    }));
  }
  const entryId = await visit(entryPath);
  if (options.includeControllers !== false) await collectControllers(controllerDirectory);
  if (moduleIdsOut) for (const id of modules.keys()) moduleIdsOut.add(id);
  let sharedExportIds = null;
  if (sharedExportKey && sharedCandidates) {
    sharedExportIds = [];
    for (const [id, source] of modules.entries()) {
      if (sharedCandidates.has(id) && !isAsyncSource(source)) sharedExportIds.push(id);
    }
    if (sharedExportedOut) for (const id of sharedExportIds) sharedExportedOut.add(id);
  }
  const factories = [...modules.entries()]
    .sort(function ([left], [right]) { return left < right ? -1 : left > right ? 1 : 0; })
    .map(function ([id, source]) {
      const needsAsync = !externalModules?.has(id) && isAsyncSource(source);
      return `${JSON.stringify(id)}:${needsAsync ? 'async ' : ''}function(__require,__exports,__live,__kniuLoadController,__kniuLoadControllerFile,__kniuLoadControllerUrl){${source}}`;
    }).join(',');
  const sharedExportStatement = sharedExportIds?.length
    ? `(function(){const __sharedStore=globalThis[${JSON.stringify(sharedExportKey)}]=globalThis[${JSON.stringify(sharedExportKey)}]||Object.create(null);`
    + `[${sharedExportIds.map((id) => JSON.stringify(id)).join(',')}].forEach(function(id){__sharedStore[id]=__require(id);});})();`
    : '';
  const exportStatement = (globalExport
    ? `(function(){const __m=__require(${JSON.stringify(entryId)});const __k=(document.currentScript&&document.currentScript.src)||'';if(__k){globalThis['__KNIU_COMPONENT_BUNDLES__']=globalThis['__KNIU_COMPONENT_BUNDLES__']||Object.create(null);globalThis['__KNIU_COMPONENT_BUNDLES__'][__k]=__m;}globalThis[${JSON.stringify(globalExport)}]=__m;})();`
    : `__require(${JSON.stringify(entryId)});`) + sharedExportStatement;
  const bundle = `(function(){'use strict';const __modules={${factories}};const __cache=Object.create(null);function __require(id){if(__cache[id])return __cache[id];const factory=__modules[id];if(!factory)throw new Error('[Kniu bundle] Module not found: '+id);const exports={};__cache[id]=exports;factory(__require,exports,__live,__kniuLoadController,__kniuLoadControllerFile,__kniuLoadControllerUrl);return exports}function __live(id,key){const target=function(){const value=__require(id)[key];return value.apply(this,arguments)};return new Proxy(target,{get:function(_,property){const value=__require(id)[key];const member=value[property];return typeof member==='function'?member.bind(value):member},set:function(_,property,value){__require(id)[key][property]=value;return true},apply:function(_,thisArg,args){return __require(id)[key].apply(thisArg,args)}})}function __kniuLoadController(path){return __require(${JSON.stringify(controllerModuleRoot)}+'/'+path+'.js')}function __kniuLoadControllerFile(path){return Promise.resolve().then(function(){return __require(${JSON.stringify(controllerModuleRoot)}+'/'+path)})}function __kniuLoadControllerUrl(url){return Promise.resolve().then(function(){return __require(String(url).replace(/^\\//,''))})}${exportStatement}})();`;
  assertNoInvisible('client bundle', bundle);
  return bundle;
}

if (isMain) {
  const plugins = Array.isArray(BUILDER.PLUGINS) ? BUILDER.PLUGINS : [];
  const buildContext = { config: BUILDER, root: process.cwd(), outputDirectory: BUILDER.OUTPUT_DIR };
  await runPluginHook(plugins, 'beforeBuild', buildContext);
  await clearOutputDirectory(BUILDER.OUTPUT_DIR);
  appLogger.info('Start building', { OUTPUT_DIR: BUILDER.OUTPUT_DIR });
  await mkdir(BUILDER.OUTPUT_DIR, { recursive: true });
  await mkdir(outputTemplateDir, { recursive: true });
  const outputPublicDirectory = join(BUILDER.OUTPUT_DIR, publicOutputDirectory);
  const redundantMinFiles = await findRedundantMinifiedFiles(publicDirectory);
  const minAssetAliases = await buildMinifiedAssetAliases(publicDirectory, redundantMinFiles);
  await copySourceTree(publicDirectory, outputPublicDirectory, (sourcePath) => {
    return redundantMinFiles.has(relative(publicDirectory, sourcePath).replaceAll('\\', '/'));
  });
  const generatedAssetsDirectory = join(outputPublicDirectory, 'assets');
  await mkdir(generatedAssetsDirectory, { recursive: true });
  await copyFile(join('client', 'core', 'Kniu-ServiceWorker.mjs'), join(generatedAssetsDirectory, 'Kniu-Sw.js'));
  const siteUrl = String(PROJECT_CONFIG.seo?.siteUrl || '').replace(/\/$/, '');
  const seoRoutes = Array.isArray(PROJECT_CONFIG.seo?.routes) ? PROJECT_CONFIG.seo.routes : ['/'];
  if (siteUrl) {
    const escapeXmlText = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
    const escapeUrl = (value) => escapeXmlText(value).replace(/\s+/g, '%20');
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${seoRoutes.map((route) => `<url><loc>${escapeUrl(siteUrl)}${route === '/' ? '/' : `#${escapeXmlText(route)}`}</loc></url>`).join('')}</urlset>`;
    await writeFile(join(generatedAssetsDirectory, 'sitemap.xml'), sitemap);
  }
  await writeFile(join(generatedAssetsDirectory, 'robots.txt'), `User-agent: *\nAllow: /\n${siteUrl ? `Sitemap: ${siteUrl}/public/assets/sitemap.xml\n` : ''}`);
  const publicAssets = await hashPublicAssets(outputPublicDirectory, minAssetAliases);
  builtPublicAssets = publicAssets;
  builtServiceWorkerUrl = publicAssets.get('/public/assets/Kniu-Sw.js') || '/public/assets/Kniu-Sw.js';
  const requestWorkerSource = compactJavaScript(await readFile(join('client', 'core', 'Kniu-RequestWorker.mjs'), 'utf8'));
  assertNoInvisible('request worker', requestWorkerSource);
  const requestWorkerFileName = `Kniu-RequestWorker.${contentHash(requestWorkerSource)}.js`;
  builtRequestWorkerUrl = `/${publicOutputDirectory}/assets/${requestWorkerFileName}`;
  await writeFile(join(generatedAssetsDirectory, requestWorkerFileName), requestWorkerSource);
  const iconsSource = compactJavaScript(await readFile(join('client', 'core', 'Kniu-Icons.mjs'), 'utf8'));
  assertNoInvisible('icons asset', iconsSource);
  const iconsFileName = `Kniu-Icons.${contentHash(iconsSource)}.js`;
  builtIconsUrl = `/${publicOutputDirectory}/assets/${iconsFileName}`;
  await writeFile(join(generatedAssetsDirectory, iconsFileName), iconsSource);
  const sourceTemplates = await collectTemplates();
  const componentTagsAll = new Set([...CORE_COMPONENT_TAGS, ...collectComponentTags(sourceTemplates)]);
  const componentManifest = { version: 1, tags: {} };
  activeComponentTags = componentTagsAll;
  const componentModuleIds = new Set();
  await createBrowserBundle('client/core/Kniu-Components.mjs', plugins, '__KNIU_COMPONENTS__', { includeControllers: false, moduleIdsOut: componentModuleIds });
  activeComponentTags = new Set(['kniu-msg', 'kniu-modal']);
  const sharedExportedModules = new Set();
  const clientBundle = await createBrowserBundle('client/client.js', plugins, '', {
    sharedCandidates: componentModuleIds,
    sharedExportKey: '__KNIU_SHARED__',
    sharedExportedOut: sharedExportedModules
  });
  activeComponentTags = componentTagsAll;
  const componentsEntryId = moduleId(resolve('client/core/Kniu-Components.mjs'));
  const componentsExternals = new Set([...sharedExportedModules].filter((id) => id !== componentsEntryId));
  const componentsBundle = await createBrowserBundle('client/core/Kniu-Components.mjs', plugins, '__KNIU_COMPONENTS__', {
    includeControllers: false,
    externalModules: componentsExternals,
    externalSharedKey: '__KNIU_SHARED__'
  });
  activeComponentTags = null;
  appLogger.info('Shared modules exported to globalThis', { count: sharedExportedModules.size });
  const componentsFileName = `components.${contentHash(componentsBundle)}.min.js`;
  assertPerformanceBudget(componentsFileName, componentsBundle);
  await writeFile(join(outputTemplateDir, componentsFileName), componentsBundle);
  const componentsUrl = `${outputTemplateUrl}/${componentsFileName}`;
  componentTagsAll.forEach((tag) => { componentManifest.tags[tag] = [componentsUrl]; });
  const componentManifestSource = JSON.stringify(componentManifest);
  const componentManifestFileName = `component-manifest.${contentHash(componentManifestSource)}.min.json`;
  await writeFile(join(generatedAssetsDirectory, componentManifestFileName), componentManifestSource);
  const clientFileName = `client.${contentHash(clientBundle)}.min.js`;
  assertPerformanceBudget(clientFileName, clientBundle);
  await writeFile(join(outputTemplateDir, clientFileName), clientBundle);

  const templates = Object.fromEntries(Object.entries(sourceTemplates).map(([path, source]) => [
    path,
    rewritePublicReferences(source, publicAssets)
  ]));
  const rewrittenTemplates = Object.fromEntries(
    Object.entries(templates).sort(function ([left], [right]) { return left.localeCompare(right); }),
  );
  const rewrittenDocs = await collectDocs();
  const staticBlocks = [];
  const compiledTemplates = Object.fromEntries(
    Object.entries(rewrittenTemplates).map(([url, source]) => [url, extractStaticBlocks(source, staticBlocks)]),
  );
  const TEMPLATE_DYNAMIC_RE = /\{\{|:[A-Za-z][\w-]*(?:\.[\w-]+)*\s*=/;
  const staticTemplateUrls = Object.entries(rewrittenTemplates)
    .filter(([, source]) => !TEMPLATE_DYNAMIC_RE.test(source))
    .map(([url]) => url);
  const templatesSource = `globalThis.__VIEW_TEMPLATES__=${escapeInvisibleForLiteral(JSON.stringify(compiledTemplates))};globalThis.__VIEW_STATIC_TEMPLATES__=${JSON.stringify(staticTemplateUrls)};globalThis.__VIEW_STATIC_BLOCKS__=${escapeInvisibleForLiteral(JSON.stringify(staticBlocks))};globalThis.__VIEW_DOCS__=${escapeInvisibleForLiteral(JSON.stringify(rewrittenDocs))};`;
  assertNoInvisible('templates bundle', templatesSource);
  const templatesFileName = `templates.${contentHash(templatesSource)}.min.js`;
  assertPerformanceBudget(templatesFileName, templatesSource);
  await writeFile(join(outputTemplateDir, templatesFileName), templatesSource);
  const outputIndex = join(BUILDER.OUTPUT_DIR, 'index.html');
  const indexHtml = rewritePublicReferences(
    resolveAliasReferences(await readFile(viewIndexPath, 'utf8'), SERVER.ALIAS),
    publicAssets
  );
  const manifestBase = /^(?:[a-z][a-z0-9+.-]*:)?\//i.test(outputTemplateUrl)
    ? outputTemplateUrl.replace(/\/+$/, '')
    : `/${outputTemplateUrl.replace(/^\.\//, '').replace(/\/+$/, '')}`;
  const manifestMetas =
    `<meta name="kniu-component-manifest" content="/public/assets/${componentManifestFileName}">` +
    `<meta name="kniu-template-manifest" content="${manifestBase}/${templatesFileName}">`;
  const preloads = [
    `<link rel="preload" as="script" href="${outputTemplateUrl}/${clientFileName}">`,
    `<link rel="preload" as="script" href="${outputTemplateUrl}/${templatesFileName}" crossorigin>`,
    `<link rel="preload" as="script" href="${publicAssets.get('/public/assets/Kniu-Special.js') || '/public/assets/Kniu-Special.js'}" crossorigin>`
  ].join('');
  const productionScript = `<script src="${outputTemplateUrl}/${clientFileName}"></script>`;
  const prerenderShell = await renderPrerenderShell();
  if (prerenderShell) {
    appLogger.info('Prerender shell generated', { bytes: prerenderShell.length });
  }
  const skeletonStyle = prerenderShell ? `<style data-kniu-skeleton>${PRERENDER_SKELETON_CSS}</style>` : '';
  const prerenderTargetRe = /(<kniu-router-view\b[^>]*>)/i;
  const shellInjection = prerenderTargetRe.test(indexHtml)
    ? ((html) => html.replace(prerenderTargetRe, `$1${prerenderShell}`))
    : ((html) => html.replace(/(<noscript\b[^>]*>[\s\S]*?<\/noscript>)/i, `$1${prerenderShell}`));
  const withEntryScript = (html) => (/<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `${productionScript}</body>`)
    : `${html}${productionScript}`);
  await writeFile(
    outputIndex,
    minifyHtml(withEntryScript(withBootLoadingHtml(shellInjection(indexHtml))
      .replace(/<\/head>/i, `${manifestMetas}${preloads}${skeletonStyle}</head>`)
      .replace(/<script\b(?=[^>]*\bsrc=["']\/?client\/client\.(?:js|mjs)["'])[^>]*>\s*<\/script>/i, ''))),
  );
  const securityHeaders = [
    '# 将此内容合并到 Nginx 的 server/location 配置中。',
    '# 关键：必须显式声明 .mjs 的 MIME type，否则浏览器 ESM 模块会因 MIME 校验失败而拒绝执行。',
    "types {",
    "  application/javascript js mjs;",
    "}",
    "default_type application/octet-stream;",
    "add_header X-Content-Type-Options \"nosniff\" always;",
    "add_header Referrer-Policy \"strict-origin-when-cross-origin\" always;",
    "add_header X-Frame-Options \"SAMEORIGIN\" always;",
    "add_header Permissions-Policy \"geolocation=(), microphone=(), camera=()\" always;",
    "add_header Content-Security-Policy \"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; script-src 'self'; connect-src 'self' " + [...(Array.isArray(PROJECT_CONFIG.imageProxy?.domainWhitelist) ? PROJECT_CONFIG.imageProxy.domainWhitelist.map((host) => `https://${host}`) : [])].join(' ') + "; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'\" always;",
    '# Kniu 组件以 Shadow DOM 动态挂载样式；接入 CSP nonce/adoptedStyleSheets 后可移除 style-src 的 unsafe-inline。',
    '# SPA 路由回退：找不到静态文件时交给 index.html，由前端 Router 处理。',
    "location / {",
    "  try_files $uri $uri/ /index.html;",
    "}",
    '# 静态资源缓存：public/assets 下带 hash 的产物可以长期缓存。',
    "location ~* \\.(?:js|mjs|css|png|jpg|jpeg|gif|svg|woff2?|ttf|eot|ico)$ {",
    "  expires 1y;",
    "  add_header Cache-Control \"public, immutable\";",
    "}",
    '# 入口 HTML 不缓存：否则发版后仍会引用旧 hash 的主包。',
    "location = /index.html {",
    "  expires -1;",
    "}"
  ].join('\n');
  await writeFile(join(generatedAssetsDirectory, 'Kniu-SecurityHeaders.conf'), securityHeaders);
  const htaccess = [
    '# Apache 配置：显式声明 .mjs 的 MIME type，否则浏览器 ESM 模块会因 MIME 校验失败而拒绝执行。',
    'AddType application/javascript .js .mjs',
    'AddType text/css .css',
    'AddType image/svg+xml .svg',
    '',
    '# 安全头',
    'Header always set X-Content-Type-Options "nosniff"',
    'Header always set Referrer-Policy "strict-origin-when-cross-origin"',
    'Header always set X-Frame-Options "SAMEORIGIN"',
    'Header always set Permissions-Policy "geolocation=(), microphone=(), camera=()"',
    '',
    '# SPA 路由回退：找不到静态文件时交给 index.html，由前端 Router 处理。',
    '<IfModule mod_rewrite.c>',
    '  RewriteEngine On',
    '  RewriteBase /',
    '  RewriteRule ^index\\.html$ - [L]',
    '  RewriteCond %{REQUEST_FILENAME} !-f',
    '  RewriteCond %{REQUEST_FILENAME} !-d',
    '  RewriteRule . /index.html [L]',
    '</IfModule>',
    '',
    '# 静态资源缓存：public/assets 下带 hash 的产物可以长期缓存。',
    '<IfModule mod_expires.c>',
    '  ExpiresActive On',
    '  ExpiresByType application/javascript "access plus 1 year"',
    '  ExpiresByType text/css "access plus 1 year"',
    '  ExpiresByType image/png "access plus 1 year"',
    '  ExpiresByType image/jpeg "access plus 1 year"',
    '  ExpiresByType image/svg+xml "access plus 1 year"',
    '  ExpiresByType image/x-icon "access plus 1 year"',
    '  ExpiresByType font/woff2 "access plus 1 year"',
    '  ExpiresByType text/html "access plus 0 seconds"',
    '</IfModule>'
  ].join('\n');
  await writeFile(join(BUILDER.OUTPUT_DIR, '.htaccess'), htaccess);
  const compressedAssets = await writeCompressedAssets(BUILDER.OUTPUT_DIR, generatedAssetsDirectory);
  const manifest = {
    version: 1,
    assets: Object.fromEntries(publicAssets),
    compressed: compressedAssets,
    entry: {
      client: `${outputTemplateUrl}/${clientFileName}`,
      requestWorker: builtRequestWorkerUrl,
      componentManifest: `/public/assets/${componentManifestFileName}`,
      templates: `${outputTemplateUrl}/${templatesFileName}`
    }
  };
  const manifestSource = JSON.stringify(manifest);
  const manifestFileName = `asset-manifest.${contentHash(manifestSource)}.min.json`;
  await writeFile(join(generatedAssetsDirectory, manifestFileName), manifestSource);
  await runPluginHook(plugins, 'afterBuild', { ...buildContext, clientBundle, clientFileName, templatesFileName });
  console.log(BUILDER.SUCCESS_MESSAGE);
  appLogger.info(BUILDER.SUCCESS_MESSAGE);
  await appLogger.flushPendingWrites();
}

export default collectTemplates;