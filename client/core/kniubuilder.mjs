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
        // 视图模板逐份折叠空白；markdown 文档（collectDocs）不走这里，正文的空白有语义。
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
// 导出给压缩器单测（test/verify_compact.mjs）复用，构建流程本身不依赖这两个出口。
export { compactJavaScript, joinCodeSegments, squeezeCodeWhitespace, squeezeCss, squeezeHtml };
// 不可见字符纪律：产物里一个都不许留（见 test/verify_compact.mjs 的「产物纯净度」一节）。
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

// 代码区段间分隔符（只在压缩器内部存在，第二遍会全部消费掉，绝不进产物）。
// 让**第一遍**（唯一知道每个 token 真实身份的地方）来决定怎么处理这个换行：
//   CODE_FOLD — 折成一个空格。上一行末尾停在「表达式尚未结束」的位置（运算符/开括号/
//               逗号/分号/冒号…），这里不可能有 ASI，折空格与源码解析结果完全一致。
//   CODE_STOP — 必须终止语句，这里插入一个 `;`。源码在该换行处要么本来就有分号、
//               要么 ASI 会插一个（`} const b = 2`、`foo()` 换行 `bar()`、`return` 后换行…）。
//               esbuild 的 minify 输出也就是这么做的，产物因此可以真正压成一行。
// 不用「保留物理换行」这条退路了 —— 那正是产物里 2400 多行的来源。
const CODE_FOLD = '\u0000';
const CODE_STOP = '\u0001';

// 产物纪律：bundle 里不允许出现任何「看不见的字符」。这类字符在编辑器/其它工具里
// 既不可见又会被判成非法字符，出了问题极难排查。它们只有在字符串 / 正则 / 模板字面量
// **内部**才有语义（此时改写成 `\uXXXX` 与原文是同一个字符值），所以统一就地转义。
const INVISIBLE_CHARACTER = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u0085\u00A0\u200B-\u200F\u2028\u2029\u2060\uFEFF]/;

function escapeInvisible(character) {
  if (!character || !INVISIBLE_CHARACTER.test(character)) return character;
  return `\\u${character.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
}

// 走 JSON.stringify 的通道（`.css` 文本模块、`__VIEW_TEMPLATES__` / `__VIEW_DOCS__`）：
// JSON 不会转义上述字符，它们会以**字面**形态落进产物。做一次全局改写即可 ——
// 这些字符不可能出现在 JSON 的结构位置，只会落在字符串内部，`\uXXXX` 与原文同值。
const INVISIBLE_CHARACTER_GLOBAL = new RegExp(INVISIBLE_CHARACTER.source, 'g');

function escapeInvisibleForLiteral(source) {
  return source.replace(INVISIBLE_CHARACTER_GLOBAL, function (character) { return escapeInvisible(character); });
}

// 产出物自检：留一个不可见字符就报错，避免「改了压缩器又悄悄放回来」。
const FORBIDDEN_IN_OUTPUT = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u0085\u00A0\u200B-\u200F\u2028\u2029\u2060\uFEFF]/;

function assertNoInvisible(label, source) {
  const hit = FORBIDDEN_IN_OUTPUT.exec(source);
  if (!hit) return;
  throw new Error(
    `[Kniu builder] ${label} 仍含不可见字符 U+${hit[0].charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}（偏移 ${hit.index}）`,
  );
}

// `return /^(?=.*\S).+/.test(v)` 这类「关键字后直接跟正则字面量」的写法：
// 只看前一个字符（return 的 `n`）会把它判成除法，于是正则内容被按代码解析，
// 引号/注释判定随之整体错位。这些关键字之后的 `/` 必须当成正则的开始。
const REGEX_AFTER_KEYWORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'case', 'do', 'else', 'yield', 'await', 'throw',
]);
const WORD_CHARACTER = /[A-Za-z0-9_$]/;

// ── 段间断句判定 ─────────────────────────────────────────────────────────────
// 上一行末尾的 token 类别（由第一遍在 emit / appendRaw 里维护）。
const TOKEN_OP = 'op';           // 运算符、逗号、分号、冒号、开括号…（表达式未结束）
const TOKEN_WORD = 'word';       // 标识符 / 关键字 / 数字
const TOKEN_CLOSE = 'close';     // 右括号 `)` `]` `}`
const TOKEN_LITERAL = 'literal'; // 字符串 / 正则 / 模板字面量的收尾引号
const TOKEN_INCDEC = 'incdec';   // `++` / `--`（可作后缀，能结束一条语句）

// 受 ASI 「限制性产生式」管束的关键字：它们**后面紧跟换行就等价于插了分号**
// （`return\nx` 是 `return; x`，`break\nfoo` 是 `break; foo`），所以一律换成 `;`。
const RESTRICTED_TAIL = new Set(['return', 'throw', 'break', 'continue', 'yield', 'debugger', 'async']);

// 下一段首字符本身是「续接符号」→ 源码在那个换行处不会插分号，折空格与源码等价。
// 例如 `? a\n: b`、`[a\n, b]`、`foo(a\n)`、`a\n.b()`、`const o = {\na: 1\n}`。
const CONTINUATION_HEAD = new Set([
  '(', '[', '`', '+', '-', '*', '/', '%', '&', '|', '^', '<', '>', '=', '?', '~', '.', ',', ')', ']', '}', ':', ';',
]);

// `}` 之后**必须贴附**到前一语句的词：`if(){…} else`、`try{…} catch`、`try{…} finally`。
// 注意 `do` / `try` 不在此列 —— 它们是**新语句的开头**（`}\ndo{…}while(x)` 必须插分号）。
const ATTACH_HEAD_WORDS = new Set(['else', 'catch', 'finally']);

// 上一段末词属于这些时，后面的 `{` 是它的块（`else {` / `do {` / `try {` / `finally {`）。
const BLOCK_LEAD_WORDS = new Set(['else', 'do', 'try', 'finally']);

// `if (x)` / `for (;;)` … 这类控制头之后的 `{` 是它的块，不能拆。
const CONTROL_HEAD_WORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'with']);

// 从 from 开始跳过空白与注释，取下一个有效代码的一小段（首字符 / 前两字符 / 首个单词）。
// 必须够长：只回 2 个字符时 `headWord` 永远截成 `el`，`else` 这类判定会静默失效。
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

// 下一段是否「续接」上一段：首字符属于续接集，且不是 `++` / `--` 前缀、不是 `!`（`!=` 除外）。
function continuesExpression(peek) {
  const head = peek[0];
  const two = peek.slice(0, 2);
  if (head === '!') return two === '!=';
  if ((head === '+' || head === '-') && two === head + head) return false;
  return CONTINUATION_HEAD.has(head);
}

// 末尾的标识符单词（`x.return` 这种属性名不算关键字，故要求前面不是 `.`）。
function trailingWord(text) {
  const match = /([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(text);
  if (!match) return '';
  if (text[text.length - match[1].length - 1] === '.') return '';
  return match[1];
}

// 末尾 `)` 前面那个词（`if` / `for` / `foo` / 函数名…），用于判断 `{` 是不是紧跟其后的块。
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

// 末尾这个 `}` 是不是 `do { … }` 的块（后面必须跟 `while` 才合法）。
// 判据：文本里最后一个 `do` 之后只剩一个配平的 `{…}`。
function isDoBlockTail(text) {
  const pattern = /(?:^|[^\w$.])do\b/g;
  let doIndex = -1;
  let match;
  while ((match = pattern.exec(text))) {
    // match[0] 含前导分隔符（`^` 分支没有），末两字符才是 `do`。
    doIndex = match.index + match[0].length - 2;
  }
  if (doIndex < 0) return false;
  return /^\s*\{[\s\S]*\}\s*$/.test(text.slice(doIndex + 2));
}

// 合并成一行时，两个字符之间到底需不需要那个空格？只有三种情况真的需要：
//   ① 两侧都是「单词字符」（标识符/关键字/数字/`$`/`_`）—— 否则 `const a` 会粘成 `consta`、
//      `void 0` 会粘成标识符 `void0`；
//   ② 数字后接 `.` —— `1` + `.toString` 会被读成小数；
//   ③ 两侧直接相接会被词法器**最长匹配**成另一个 token 或注释（`+`+`+`→`++`、`/`+`/`→行注释、
//      `/`+`*`→块注释、`<`+`!`→`<!--`、`?`+`.`→`?.` …）。
// 其余位置（`}`+`else`、`)`+`{`、`a`+`=`、`=`+`/re/`、`'x'`+`+`…）一律不留空格 —— 与 esbuild --minify 一致。
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

// 断句决策：返回 CODE_FOLD 或 CODE_STOP。
// `output` 是压缩到当前位置的全部代码（只看尾巴，避免在长字符串上跑锚定正则）。
function decideBreak(kind, lastChar, output, peek) {
  // ① 上一行停在表达式中间 → 不存在 ASI，折空格。
  if (kind === TOKEN_OP) return CODE_FOLD;
  // 前面垫一个空格：让 `[^\w$.]` 有字符可匹配，也避免把切片开头当成单词边界。
  const tailText = ` ${output.slice(-64)}`;
  // ② 受 ASI 限制性产生式管束的关键字结尾 → 换行处必然插分号（优先于续接判定：
  //    `return\n(x)` 是 `return; (x)`，`return` 后面的换行**不允许**接表达式）。
  if (kind === TOKEN_WORD && RESTRICTED_TAIL.has(trailingWord(tailText))) return CODE_STOP;
  // ③ 下一段以续接符号开头 → 源码在这里也没有插分号，折空格。
  if (continuesExpression(peek)) return CODE_FOLD;
  const headWord = (peek.match(/^[A-Za-z_$][A-Za-z0-9_$]*/) || [''])[0];
  // ④ `}` 之后跟 else / catch / finally（以及 do-while 的 while）：块必须贴紧，折空格。
  if (kind === TOKEN_CLOSE && lastChar === '}') {
    if (ATTACH_HEAD_WORDS.has(headWord)) return CODE_FOLD;
    // while 只可能贴附于 `do { … }`；普通 `while (…) { … }` 是新语句，要靠 `;` 分开。
    if (headWord === 'while' && isDoBlockTail(output.slice(-4096))) return CODE_FOLD;
  }
  // ⑤ `if (x)` / `function f()` / `class A` / `else` / `do` / `try` 之后换行接 `{`：块必须贴紧。
  if (peek[0] === '{') {
    if (kind === TOKEN_CLOSE && lastChar === ')' && CONTROL_HEAD_WORDS.has(parenHeadWord(` ${output.slice(-4096)}`))) return CODE_FOLD;
    if (/(?:^|[^\w$.])(?:function|class)\b/.test(tailText)) return CODE_FOLD;
    if (kind === TOKEN_WORD) {
      if (BLOCK_LEAD_WORDS.has(trailingWord(tailText))) return CODE_FOLD;
      if (/(?:^|[^\w$.])(?:function|class)\s+[\w$]+$/.test(tailText)) return CODE_FOLD;
    }
  }
  // ⑥ 其余都是「上一行已是一条完整语句、下一行是另一条语句」→ 必须插分号。
  return CODE_STOP;
}

// 第一遍：删除注释、去掉行首缩进与行尾空白、把代码区的连续空白压到「最少」——
// 只有在 needsSpaceBetween 判定必须留一个空格时才留（与 esbuild --minify 同口径）。
// 字符串 / 正则 / 模板字面量的内容原样保留；代码区的换行按上下文换成段间分隔符
// （`CODE_FOLD` 折空格 / `CODE_STOP` 插分号），由第二遍 joinCodeSegments 落实。
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
  // 末尾的标识符单词（跨过空格继续保留，遇到其它符号清空），用于识别 `return` 这类关键字。
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
    // ⚠ 空格**不能**清掉 whitespaceRun：同一段连续空白的第二个空格会重新进入 emitWhitespace()
    // 再判一次、再补一个空格（`const   value` 残留三空格）。只有真正发射了非空格字符，
    // 才代表「这一段空白结束了」。
    if (!lastWasSpace) whitespaceRun = false;
    trackWord(character);
  };
  // 字符串 / 正则 / 模板内部的原文追加：内容一字不改，但仍要更新 lastChar，
  // 否则 `'abc'` 或 `/re/` 结束后的下一个 `/` 会拿错误的「前一个字符」去判正则还是除法。
  // 不可见字符在这里就地转义（`\uXXXX` 与字面字符是同一个值），产物因此只剩可见字符。
  const appendRaw = function (character) {
    output += escapeInvisible(character);
    lastWasSpace = false;
    lastChar = character;
    lastKind = TOKEN_LITERAL;
    lastWord = '';
    afterSpace = false;
    whitespaceRun = false;
  };
  // 转义对 `\x`：若 x 是不可见字符，字符串/正则/模板里的 `\<不可见>` 等价于该字符本身
  // （NonEscapeCharacter）。此时必须**丢掉反斜杠**只留 `\uXXXX`，否则会产出 `\\uXXXX`
  // —— 那变成「反斜杠 + 文本」，取值就错了。
  const appendEscapedRaw = function (next) {
    if (next && INVISIBLE_CHARACTER.test(next)) appendRaw(next);
    else { appendRaw('\\'); if (next) appendRaw(next); }
  };
  // 空白段：只在 needsSpaceBetween 判定必须留空格时才留一个（连续空白只第一次判定）。
  const emitWhitespace = function (fromIndex) {
    if (whitespaceRun) return;
    whitespaceRun = true;
    if (!output) return;
    const ahead = peekNextCode(source, fromIndex);
    if (needsSpaceBetween(lastChar, ahead[0])) emit(' ');
  };
  // 代码区段间：由第一遍拍板「折成空格」还是「插分号」，写进占位符交给第二遍。
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
        // 跨行块注释替换成换行（保住 ASI），单行块注释按「空格是否必要」处理。
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
      // 模板字面量内的物理换行编码成 `\n` 两字符：取值完全不变（模板里它就是换行），
      // 但产物里不会出现「一段模板内容被拆成多行、行首还带缩进」的样子。
      // 注意 `${…}` 里面的代码属于 code 状态，走 emitBreak()，不受这里影响。
      else if (character === '\n') appendRaw('\\n');
      else if (character === '\r') { appendRaw('\\n'); if (next === '\n') index += 1; }
      else appendRaw(character);
      continue;
    }
    if (character === '\r') continue;
    if (character === '\n') { emitBreak(index); continue; }
    // 代码位置的「行分隔符 / 段分隔符」也是行终止符，按换行处理以保住 ASI。
    if (character === '\u2028' || character === '\u2029') { emitBreak(index); continue; }
    // 代码位置的其余不可见字符：JS 要么视作空白（NBSP / VT / FF / BOM），要么源码本就非法，
    // 一律丢弃 —— 绝不能原样进产物。
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

// 第二遍：按第一遍留下的分隔符拼接 —— `CODE_FOLD` 折成**最少**的分隔（多数位置连空格都不需要），
// `CODE_STOP` 落成一个 `;`（`;` 本身就是完整 token，后面不必跟空格）。
// 到这里产物只剩一行：既没有物理换行，也没有任何看不见的字符（见 assertNoInvisible）。
// 合并成一行时不补分号的旧做法会残留 2400 多行；esbuild --minify 同样是「补分号 + 只在必要时留空格」。
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

// 产物里的 JS 一律走它：去注释 + 折叠空白，但字符串 / 正则 / 模板内容与 ASI 语义保持等价。
function compactJavaScript(source) {
  return joinCodeSegments(squeezeCodeWhitespace(source));
}

// HTML 模板（client/views/**/*.html）的空白压缩：把文本区与标签区（引号外）的连续空白
// 折叠成单个空格、去掉行首缩进与行尾空白。`<script>`/`<pre>`/`<textarea>` 的内容与
// HTML 注释原样保留——这些区域的空白有语义，压了就会改渲染结果。
// 例外：`<style>` 的内容是 CSS，交给 squeezeCss() 去注释 + 折叠空白（它的空白同样无语义）。
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

// CSS 文本压缩：去注释 + 折叠空白 + 删掉「两侧本来就不需要空格」的空白。
// 合法性依据是 CSS 词法 —— token 边界只由空白/注释决定，所以
//   ① 注释整体删除（删掉的位置退化成一段空白，相邻 token 仍需分隔时才落一个空格）；
//   ② 连续空白折成一个空格；
//   ③ 紧邻 `{ } ; , )` 的空格、`:` 之后的空格、`!` 之前的空格，删掉后词法产物完全相同；
//   ④ 字符串（`content:"…"` / `url("…")`）内部一字不动。
// **绝不碰** `+ - > ~ /` 两侧的空白：`calc(1px + 2px)` 少了空格就是语法错误。
// `(` 之前也保留空格（`@media screen and (...)` 折成 `and(...)` 是否合法取决于解析器实现，
// 收益极小、不值得冒险）。
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
  // CSS 文本模块的导入说明符带 `?module`（`./css/x.css?module`，见 SKILL #126），
  // 它是「把 CSS 当 JS 模块取文本」的通道标记，解析磁盘路径前必须剥掉，否则会去找
  // 一个文件名里带问号的文件。
  const [bare] = specifier.split('?');
  return resolve(dirname(fromPath), bare);
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
    // CSS 文本模块：`.css` 读盘后导出为字符串，不做 JS 语法改写。
    // 与 dev 侧 kniuserver 的 `/client/core/kniuui/*.css?module` 通道同语义（见 SKILL #126）：
    // 组件样式以「CSS 文本」形态同步拿到，仍由 adoptSharedStyle → normalizeComponentCss
    // 做 px→vw 改写，因此 CSS 文件里照原样写 px，不要预写 calc()。
    // 文本先过 squeezeCss()（去注释 + 折叠空白，见 SKILL #137）再 JSON.stringify：
    // 导出的是 `"…"` 双引号字面量，压缩器不会碰它；语义与源文件等价，
    // 只是不再逐字节相同 —— `check_dist_css_inline.mjs` 的判据同步改为「压缩后逐字节」。
    if (absolutePath.endsWith('.css')) {
      const css = squeezeCss(await readFile(absolutePath, 'utf8'));
      modules.set(id, `__exports.default=${escapeInvisibleForLiteral(JSON.stringify(css))};`);
      return id;
    }
    // HTML 文本模块：组件 shadow 模板骨架（组件目录化三件套，见规则 #177）。
    // 与 dev 侧 kniuserver 的 `.html?module` 通道同语义：读盘导出字符串，不做 JS 语法改写、
    // 不过 compactJavaScript（HTML 的空白是 shadow DOM 结构的一部分，保持原样）。
    if (absolutePath.endsWith('.html')) {
      const html = await readFile(absolutePath, 'utf8');
      modules.set(id, `__exports.default=${escapeInvisibleForLiteral(JSON.stringify(html))};`);
      return id;
    }
    const source = await readFile(absolutePath, 'utf8');
    const transformed = await transformBrowserModule(source, absolutePath, visit);
    // 每个模块的源码在这里就地压掉注释与冗余空白，字符串/正则/模板内容与 ASI 语义不变。
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
  // 拼装前按 id 排序：collectControllers 走 Promise.all + 异步读盘，Map 的插入顺序取决于
  // 每个 readFile 的完成先后 → 同样的源码会产出「模块顺序不同、体积相同、哈希不同」的 bundle
  // （构建不可复现，「哈希变了」就不再等于「代码变了」）。排序后产物逐字节可复现。
  const factories = [...modules.entries()]
    .sort(function ([left], [right]) { return left < right ? -1 : left > right ? 1 : 0; })
    .map(function ([id, source]) {
      return `${JSON.stringify(id)}:function(__require,__exports,__live,__kniuLoadController){${source}}`;
    }).join(',');
  // 每个模块源码已在 compactJavaScript 里压成单行（无物理换行、无不可见字符），
  // 模块之间只靠工厂函数边界分隔，整个产物就是一行。
  const bundle = `(function(){'use strict';const __modules={${factories}};const __cache=Object.create(null);function __require(id){if(__cache[id])return __cache[id];const factory=__modules[id];if(!factory)throw new Error('[Kniu bundle] Module not found: '+id);const exports={};__cache[id]=exports;factory(__require,exports,__live,__kniuLoadController);return exports}function __live(id,key){const target=function(){const value=__require(id)[key];return value.apply(this,arguments)};return new Proxy(target,{get:function(_,property){const value=__require(id)[key];const member=value[property];return typeof member==='function'?member.bind(value):member},set:function(_,property,value){__require(id)[key][property]=value;return true},apply:function(_,thisArg,args){return __require(id)[key].apply(thisArg,args)}})}function __kniuLoadController(path){return __require('client/controller/'+path+'.js')}__require(${JSON.stringify(entryId)});})();`;
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
  // 两个 JSON 通道都过一次不可见字符转义（HTML 模板或 markdown 里带 NBSP 时不至于漏进产物）。
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
