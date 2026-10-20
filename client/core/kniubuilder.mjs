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
        templates[templatePath] = resolveAliasReferences(squeezeHtml(await readFile(path, 'utf8')), SERVER.ALIAS);
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

function contentHash(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 10);
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
  if (process.platform === 'win32') {
    const { execFileSync } = await import('node:child_process');
    for (const entryName of entries) {
      const target = join(directory, entryName);
      try { execFileSync('cmd.exe', ['/c', 'rmdir', '/s', '/q', target], { stdio: 'ignore' }); }
      catch (e) { }
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
  const [bare] = specifier.split('?');
  return resolve(dirname(fromPath), bare);
}

function importBinding(source, dependencyId, defaultIsData = false) {
  const value = source.trim();
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
  if (moduleId(filePath) === 'client/core/kniudotenv.mjs') {
    return `const RUNTIME_ENV=${JSON.stringify(browserRuntimeEnv)};const DOT_ENV=RUNTIME_ENV;const PROCESS_ENV=RUNTIME_ENV.PROCESS_ENV||'development';function parseEnv(){return {}}function loadEnv(){return RUNTIME_ENV}__exports.DOT_ENV=DOT_ENV;__exports.RUNTIME_ENV=RUNTIME_ENV;__exports.PROCESS_ENV=PROCESS_ENV;__exports.loadEnv=loadEnv;__exports.parseEnv=parseEnv;__exports.default=PROCESS_ENV;`;
  }
  const imports = [...source.matchAll(/^import\s+(.+?)\s+from\s+['"]([^'"]+)['"];?\s*$/gm)];
  const importIds = new Map();
  const importDataDefaults = new Map();
  for (const match of imports) {
    const dependencyPath = resolveBrowserModule(filePath, match[2]);
    if (!dependencyPath) throw new Error(`Unsupported external browser dependency: ${match[2]}`);
    importIds.set(match[0], await visit(dependencyPath));
    const depSource = (await readFile(dependencyPath, 'utf8'))
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    importDataDefaults.set(match[0], /^export\s+default\s*[{[]/m.test(depSource));
  }
  let transformed = source.replace(/^import\s+(.+?)\s+from\s+['"]([^'"]+)['"];?\s*$/gm, function (statement, binding) {
    return importBinding(binding, importIds.get(statement), importDataDefaults.get(statement) === true);
  });
  const reexportIds = new Map();
  const reexports = [...source.matchAll(/^export\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?\s*$/gm)];
  for (const match of reexports) {
    const dependencyPath = resolveBrowserModule(filePath, match[2]);
    if (!dependencyPath) throw new Error(`Unsupported external browser dependency: ${match[2]}`);
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
  if (moduleId(filePath) === 'client/core/kniumvvm.mjs') {
    const controllerImportSource = 'return import(`../controller/${controllerPath}.js`).then(function (module) {';
    if (!transformed.includes(controllerImportSource)) {
      throw new Error('kniubuilder: kniumvvm.mjs 动态 controller import 源串已漂移，请同步更新 builder 内的替换锚点');
    }
    transformed = transformed.replace(
      controllerImportSource,
      'return Promise.resolve(__kniuLoadController(controllerPath)).then(function (module) {'
    );
    // loadControllerFile：viewer.js 真实路径装载（路径相对 client/controller/ 基目录，与 bundle 模块 id 对齐）。
    const controllerFileImportSource = 'return import(`../controller/${normalized}`).then(function (module) {';
    if (!transformed.includes(controllerFileImportSource)) {
      throw new Error('kniubuilder: kniumvvm.mjs 动态 controller 文件 import 源串已漂移，请同步更新 builder 内的替换锚点');
    }
    transformed = transformed.replace(
      controllerFileImportSource,
      'return Promise.resolve(__kniuLoadControllerFile(normalized)).then(function (module) {'
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
    const source = await readFile(absolutePath, 'utf8');
    const transformed = await transformBrowserModule(source, absolutePath, visit);
    modules.set(id, compactJavaScript(transformed));
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
  const factories = [...modules.entries()]
    .sort(function ([left], [right]) { return left < right ? -1 : left > right ? 1 : 0; })
    .map(function ([id, source]) {
      return `${JSON.stringify(id)}:function(__require,__exports,__live,__kniuLoadController,__kniuLoadControllerFile){${source}}`;
    }).join(',');
  const bundle = `(function(){'use strict';const __modules={${factories}};const __cache=Object.create(null);function __require(id){if(__cache[id])return __cache[id];const factory=__modules[id];if(!factory)throw new Error('[Kniu bundle] Module not found: '+id);const exports={};__cache[id]=exports;factory(__require,exports,__live,__kniuLoadController,__kniuLoadControllerFile);return exports}function __live(id,key){const target=function(){const value=__require(id)[key];return value.apply(this,arguments)};return new Proxy(target,{get:function(_,property){const value=__require(id)[key];const member=value[property];return typeof member==='function'?member.bind(value):member},set:function(_,property,value){__require(id)[key][property]=value;return true},apply:function(_,thisArg,args){return __require(id)[key].apply(thisArg,args)}})}function __kniuLoadController(path){return __require('client/controller/'+path+'.js')}function __kniuLoadControllerFile(path){return Promise.resolve().then(function(){return __require('client/controller/'+path)})}__require(${JSON.stringify(entryId)});})();`;
  assertNoInvisible('client bundle', bundle);
  return bundle;
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
    Object.entries(templates).sort(function ([left], [right]) { return left.localeCompare(right); }),
  );
  const rewrittenDocs = await collectDocs();
  const templatesSource = `globalThis.__VIEW_TEMPLATES__=${escapeInvisibleForLiteral(JSON.stringify(rewrittenTemplates))};globalThis.__VIEW_DOCS__=${escapeInvisibleForLiteral(JSON.stringify(rewrittenDocs))};`;
  assertNoInvisible('templates bundle', templatesSource);
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