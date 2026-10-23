import { mkdir, readFile, readdir, rename, rm, stat, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { brotliCompress, gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveAliasReferences } from './kniu-util.mjs';

const rootDirectory = resolve(process.cwd());
const configPath = resolve(rootDirectory, process.env.KNIU_CONFIG || 'kniu.config.js');
const PROJECT_CONFIG = (await import(pathToFileURL(configPath).href)).default || {};
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
  PUBLIC: PROJECT_CONFIG.publicDir || './public',
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
  info(message, details) { console.info(`[kniu-build] ${message}`, details || ''); },
  async flushPendingWrites() {}
};

const viewDirectory = String(SERVER.VIEWS).replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
const viewIndexPath = join(viewDirectory, 'index.html');
const templateDirectories = (SERVER.TEMPLATE_DIRS || [viewDirectory]).map((directory) => String(directory).replaceAll('\\', '/').replace(/^\/+|\/+$/g, ''));
const publicDirectory = String(SERVER.PUBLIC).replaceAll('\\', '/').replace(/\/+$/g, '');
const publicOutputDirectory = String(buildConfig.outPublic || PROJECT_CONFIG.publicDir || './public')
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

const docsDirectory = join(publicDirectory, 'docs');
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

function filterComponentModule(source) {
  if (!activeComponentTags) return source;
  const componentVariables = {
    Badge: 'kniu-badge', Tag: 'kniu-tag', Status: 'kniu-status', Empty: 'kniu-empty',
    Button: 'kniu-btn', ButtonGroup: 'kniu-btn-group', Switch: 'kniu-switch', Modal: 'kniu-modal',
    Table: 'kniu-table', Loading: 'kniu-loading', Msg: 'kniu-msg', Select: 'kniu-select',
    RadioGroup: 'kniu-radio-group', Page: 'kniu-page', PageMore: 'kniu-page-more', Image: 'kniu-image',
    Input: 'kniu-input', DatePicker: 'kniu-date-picker', Form: 'kniu-form', Upload: 'kniu-upload',
    Icon: 'kniu-icon', Tab: 'kniu-tab', Editor: 'kniu-editor', Navbar: 'kniu-navbar',
    Backtop: 'kniu-backtop', Comment: 'kniu-comment', Like: 'kniu-like', UserLogin: 'kniu-user-login',
    ArticleTab: 'kniu-article-tab'
  };
  const retainedVariables = new Set(Object.entries(componentVariables)
    .filter(([, tag]) => activeComponentTags.has(tag))
    .map(([variable]) => variable));
  const withoutUnusedImports = source.replace(/^import \* as ([A-Za-z_$][\w$]*) from ['"].*?['"];?\r?\n/gm, (statement, variable) => (
    componentVariables[variable] && !retainedVariables.has(variable) ? '' : statement
  ));
  const removedCssVariables = [];
  const withoutUnusedCss = withoutUnusedImports.replace(/^import\s+([A-Z_][A-Z0-9_]*)\s+from\s+['"]\.\/kniu-ui\/(kniu-[a-z0-9-]+)\/[^'"]+\.css\?module['"];?\r?\n/gm, (statement, variable, tag) => {
    if (activeComponentTags.has(tag)) return statement;
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
  const sizeKiB = Buffer.byteLength(source) / 1024;
  if (sizeKiB > limitKiB) {
    const label = isComponentChunk ? '组件 JavaScript chunk' : '初始 JavaScript';
    const message = `[Kniu builder] ${label} ${fileName} 为 ${sizeKiB.toFixed(1)} KiB，超过 ${limitKiB} KiB 预算。`;
    if (BUILDER.PERFORMANCE.failOnBudgetExceeded) throw new Error(message);
    console.warn(message);
  }
}

function minifyHtml(content) {
  return content
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
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
    if (previous === CODE_FOLD || previous === CODE_STOP) return; // 连续空行：一个分隔符就够
    if (output.endsWith(' ')) output = output.replace(/[ ]+$/, ''); // 行尾空白
    if (!output) return;
    const peek = peekNextCode(source, fromIndex);
    if (!peek) return; // 后面没有有效代码，不需要分隔符
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
  // fs.rm handles both files and directories on every supported platform.
  // The former Windows rmdir-only branch left old root-level build files behind.
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
  if (/\.js$/i.test(fileName)) return compactJavaScript(content);
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

async function hashPublicAssets(directory) {
  const files = await collectFiles(directory);
  const assets = new Map();
  const cssFiles = [];
  // Non-CSS assets cannot depend on rewritten public paths, so their content
  // hash is final immediately.
  for (const file of files) {
    // robots.txt 和 sitemap.xml 是爬虫约定的稳定协议入口，不能改名为
    // content-hash 文件；其它 public 资源仍全部采用 hash 文件名。
    if (/(?:^|[\\/])(?:robots\.txt|sitemap\.xml|kniu-sw\.js)$/i.test(file)) continue;
    if (/\.css$/i.test(file)) {
      cssFiles.push(file);
      continue;
    }
    const relativePath = relative(directory, file).replaceAll('\\', '/');
    const originalContent = await readFile(file);
    const textContent = /\.(?:css|js|json)$/i.test(file) ? originalContent.toString('utf8') : null;
    const outputContent = textContent === null ? originalContent : minifyPublicAsset(file, textContent);
    const hash = contentHash(outputContent);
    const hashedRelativePath = `${relativePath.slice(0, Math.max(0, relativePath.lastIndexOf('/') + 1))}${hashedAssetName(file.split(/[\\/]/).at(-1), hash)}`;
    const nextFile = join(directory, hashedRelativePath);
    if (typeof outputContent === 'string') await writeFile(file, outputContent);
    await rename(file, nextFile);
    assets.set(`/public/${relativePath}`, `/public/${hashedRelativePath}`);
  }
  // Rewrite first, then minify and hash CSS. Hashing before this rewrite makes
  // the filename inconsistent with the bytes actually served by the server.
  for (const file of cssFiles) {
    const relativePath = relative(directory, file).replaceAll('\\', '/');
    const rewritten = rewritePublicReferences(await readFile(file, 'utf8'), assets);
    const outputContent = minifyPublicAsset(file, rewritten);
    const hash = contentHash(outputContent);
    const hashedRelativePath = `${relativePath.slice(0, Math.max(0, relativePath.lastIndexOf('/') + 1))}${hashedAssetName(file.split(/[\\/]/).at(-1), hash)}`;
    await writeFile(file, outputContent);
    await rename(file, join(directory, hashedRelativePath));
    assets.set(`/public/${relativePath}`, `/public/${hashedRelativePath}`);
  }
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
  if (moduleId(filePath) === 'client/core/kniu-components.mjs') source = filterComponentModule(source);
  if (moduleId(filePath) === 'client/core/kniudotenv.mjs') {
    return `const RUNTIME_ENV=${JSON.stringify(browserRuntimeEnv)};const DOT_ENV=RUNTIME_ENV;const PROCESS_ENV=RUNTIME_ENV.PROCESS_ENV||'development';function parseEnv(){return {}}function loadEnv(){return RUNTIME_ENV}__exports.DOT_ENV=DOT_ENV;__exports.RUNTIME_ENV=RUNTIME_ENV;__exports.PROCESS_ENV=PROCESS_ENV;__exports.loadEnv=loadEnv;__exports.parseEnv=parseEnv;__exports.default=PROCESS_ENV;`;
  }
  // 根级 kniu.config.js 可用 optionalConfig() 声明可删除的能力模块；在浏览器 bundle
  // 中改写为普通内部模块引用，避免把动态 import 泄漏到产物，也允许模块文件不存在。
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
    importDataDefaults.set(match[0], /^export\s+default\s*[{[]/m.test(depSource));
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
  if (moduleId(filePath) === 'client/core/kniu-router.mjs') {
    transformed = transformed.replace(/import\((url|controllerUrl\(route\.controller\))\)/g, '__kniuLoadControllerUrl($1)');
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

async function createBrowserBundle(entryPath = 'client/client.mjs', plugins = [], globalExport = '') {
  const modules = new Map();
  async function visit(filePath) {
    const absolutePath = resolve(filePath);
    const id = moduleId(absolutePath);
    if (modules.has(id)) return id;
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
    if (absolutePath === resolve('client/core/kniu-components.mjs') && activeComponentTags) {
      const customTags = [...activeComponentTags].filter((tag) => !tag.startsWith('kniu-'));
      const imports = customTags.map((tag) => `import '../custom/${tag}/${tag}.mjs';`).join('\n');
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
  await collectControllers(controllerDirectory);
  const factories = [...modules.entries()]
    .sort(function ([left], [right]) { return left < right ? -1 : left > right ? 1 : 0; })
    .map(function ([id, source]) {
      return `${JSON.stringify(id)}:function(__require,__exports,__live,__kniuLoadController,__kniuLoadControllerFile,__kniuLoadControllerUrl){${source}}`;
    }).join(',');
  const exportStatement = globalExport ? `globalThis[${JSON.stringify(globalExport)}]=__require(${JSON.stringify(entryId)});` : `__require(${JSON.stringify(entryId)});`;
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
  await copySourceTree(publicDirectory, outputPublicDirectory);
  const generatedAssetsDirectory = join(outputPublicDirectory, 'assets');
  await mkdir(generatedAssetsDirectory, { recursive: true });
  await copyFile(join('client', 'core', 'kniu-service-worker.js'), join(generatedAssetsDirectory, 'kniu-sw.js'));
  const siteUrl = String(PROJECT_CONFIG.seo?.siteUrl || '').replace(/\/$/, '');
  const seoRoutes = Array.isArray(PROJECT_CONFIG.seo?.routes) ? PROJECT_CONFIG.seo.routes : ['/'];
  if (siteUrl) {
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${seoRoutes.map((route) => `<url><loc>${siteUrl}${route === '/' ? '/' : `#${route}`}</loc></url>`).join('')}</urlset>`;
    await writeFile(join(generatedAssetsDirectory, 'sitemap.xml'), sitemap);
  }
  await writeFile(join(generatedAssetsDirectory, 'robots.txt'), `User-agent: *\nAllow: /\n${siteUrl ? `Sitemap: ${siteUrl}/public/assets/sitemap.xml\n` : ''}`);
  const publicAssets = await hashPublicAssets(outputPublicDirectory);
  const sourceTemplates = await collectTemplates();
  const configuredComponentTags = collectComponentTags({ configured: '' });
  const componentGroups = new Map();
  Object.values(sourceTemplates).forEach((source) => {
    const tags = collectComponentTags({ template: source });
    configuredComponentTags.forEach((tag) => tags.add(tag));
    if (!tags.size) return;
    componentGroups.set([...tags].sort().join(','), tags);
  });
  const componentManifest = { version: 1, tags: {} };
  for (const tags of componentGroups.values()) {
    activeComponentTags = tags;
    const componentsBundle = await createBrowserBundle('client/core/kniu-components.mjs', plugins, '__KNIU_COMPONENTS__');
    const componentsFileName = `components.${contentHash(componentsBundle)}.min.js`;
    assertPerformanceBudget(componentsFileName, componentsBundle);
    await writeFile(join(outputTemplateDir, componentsFileName), componentsBundle);
    const componentsUrl = `${outputTemplateUrl}/${componentsFileName}`;
    tags.forEach((tag) => {
      const bundles = componentManifest.tags[tag] || (componentManifest.tags[tag] = []);
      if (!bundles.includes(componentsUrl)) bundles.push(componentsUrl);
    });
  }
  activeComponentTags = null;
  const componentManifestSource = JSON.stringify(componentManifest);
  const componentManifestFileName = `component-manifest.${contentHash(componentManifestSource)}.min.json`;
  await writeFile(join(generatedAssetsDirectory, componentManifestFileName), componentManifestSource);
  const clientBundle = await createBrowserBundle('client/client.mjs', plugins);
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
  const templatesSource = `globalThis.__VIEW_TEMPLATES__=${escapeInvisibleForLiteral(JSON.stringify(rewrittenTemplates))};globalThis.__VIEW_DOCS__=${escapeInvisibleForLiteral(JSON.stringify(rewrittenDocs))};`;
  assertNoInvisible('templates bundle', templatesSource);
  const templatesFileName = `templates.${contentHash(templatesSource)}.min.js`;
  assertPerformanceBudget(templatesFileName, templatesSource);
  await writeFile(join(outputTemplateDir, templatesFileName), templatesSource);
  const outputIndex = join(BUILDER.OUTPUT_DIR, 'index.html');
  const indexHtml = rewritePublicReferences(
    resolveAliasReferences(await readFile(viewIndexPath, 'utf8'), SERVER.ALIAS),
    publicAssets
  );
  const componentLoader = `<meta name="kniu-component-manifest" content="/public/assets/${componentManifestFileName}">`;
  // 模板清单以 meta 声明正式路径，由 client.mjs 挂载的模板引擎在运行时动态加载，产物中不存在先于入口的脚本。
  const manifestBase = /^(?:[a-z][a-z0-9+.-]*:)?\//i.test(outputTemplateUrl)
    ? outputTemplateUrl.replace(/\/+$/, '')
    : `/${outputTemplateUrl.replace(/^\.\//, '').replace(/\/+$/, '')}`;
  const templateLoader = `<meta name="kniu-template-manifest" content="${manifestBase}/${templatesFileName}">`;
  const productionScripts =
    componentLoader +
    templateLoader +
    `<script src="${outputTemplateUrl}/${clientFileName}"></script>`;
  await writeFile(
    outputIndex,
    minifyHtml(indexHtml
      .replace(/<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["']\/?client\/client\.(?:js|mjs)["'])[^>]*>\s*<\/script>/i, productionScripts)),
  );
  const securityHeaders = [
    '# 将此内容合并到 Nginx 的 server/location 配置中。',
    "add_header X-Content-Type-Options \"nosniff\" always;",
    "add_header Referrer-Policy \"strict-origin-when-cross-origin\" always;",
    "add_header X-Frame-Options \"SAMEORIGIN\" always;",
    "add_header Permissions-Policy \"geolocation=(), microphone=(), camera=()\" always;",
    "add_header Content-Security-Policy \"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'\" always;",
    '# Kniu 组件以 Shadow DOM 动态挂载样式；接入 CSP nonce/adoptedStyleSheets 后可移除 style-src 的 unsafe-inline。'
  ].join('\n');
  await writeFile(join(generatedAssetsDirectory, 'kniu-security-headers.conf'), securityHeaders);
  const compressedAssets = await writeCompressedAssets(BUILDER.OUTPUT_DIR, generatedAssetsDirectory);
  const manifest = {
    version: 1,
    assets: Object.fromEntries(publicAssets),
    compressed: compressedAssets,
    entry: {
      client: `${outputTemplateUrl}/${clientFileName}`,
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
