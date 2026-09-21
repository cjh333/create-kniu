const LANGUAGE_ALIASES = {
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  js: 'javascript',
  ts: 'javascript',
  sh: 'bash',
  shell: 'bash'
};

function replaceAll(value, search, replacement) {
  return String(value).split(search).join(replacement);
}

function markdownHeadingId(value) {
  const text = String(value == null ? '' : value)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_~]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  return text || 'section';
}

function parseLinkAttributes(value) {
  const attributes = [];
  const source = String(value || '');
  const pattern = /:?(\w[\w-]*)\s*=\s*["']([^"']*)["']/gi;
  let match;
  while ((match = pattern.exec(source))) {
    if (match[1].toLowerCase() === 'target' && /^_(?:blank|self|parent|top)$/i.test(match[2])) {
      attributes.push('target="' + escapeHtml(match[2]) + '"');
    } else if (match[1].toLowerCase() === 'rel') {
      attributes.push('rel="' + escapeHtml(match[2]) + '"');
    }
  }
  return attributes.length ? ' ' + attributes.join(' ') : '';
}

function inlineMarkdown(value) {
  const tokens = [];
  let text = String(value == null ? '' : value);
  const token = function (html) {
    const key = '\u0000' + tokens.length + '\u0000';
    tokens.push(html);
    return key;
  };
  text = text.replace(/`([^`\n]+)`/g, (_, code) => token('<code>' + escapeHtml(code.replace(/\\([`|\\])/g, '$1')) + '</code>'));
  text = text.replace(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+["']([^"']*)["'])?\)/g,
    (_, alt, src, title) => token('<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + (title ? ' title="' + escapeHtml(title) + '"' : '') + '>'));
  text = text.replace(/\[([^\]]+)\]\(([^\s)]+)(?:\s+["']([^"']*)["'])?\)(?: ?\{([^}]*)\})?/g,
    (_, label, href, title, attributes) => token('<a href="' + escapeHtml(href) + '"' + (title ? ' title="' + escapeHtml(title) + '"' : '') + parseLinkAttributes(attributes) + '>' + inlineMarkdown(label) + '</a>'));
  text = text.replace(/\*\*([^*\n]+)\*\*|__([^_\n]+)__/g, (_, strong, strongAlt) => '<strong>' + (strong || strongAlt) + '</strong>');
  text = text.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
  text = text.replace(/\*([^*\n]+)\*|_([^_\n]+)_/g, (_, italic, italicAlt) => '<em>' + (italic || italicAlt) + '</em>');
  return tokens.reduce((result, html, index) => replaceAll(result, '\u0000' + index + '\u0000', html), text);
}

function renderMarkdownBlocks(source) {
  const lines = String(source == null ? '' : source).replace(/\r\n?/g, '\n').split('\n');
  const output = [];
  let paragraph = [];
  let list = null;
  let table = null;
  const headingIds = new Map();

  function flushParagraph() {
    if (!paragraph.length) return;
    const content = paragraph.map(function (line, index) {
      const nextLine = paragraph[index + 1] || '';
      // 富文本编辑器会在保存时裁掉行尾空格。连续的加粗标签说明行
      // （如“**在线演示：** …”）仍应保留作者输入的逐行结构。
      const labeledLineBreak = /^\*\*[^*\n]+\*\*/.test(line.trim())
        && /^\*\*[^*\n]+\*\*/.test(nextLine.trim());
      const hardBreak = /(?: {2,}|\\)$/.test(line) || labeledLineBreak;
      const value = hardBreak ? line.replace(/(?: {2,}|\\)$/, '') : line;
      const separator = index < paragraph.length - 1
        ? (hardBreak ? '<br>\n' : '\n')
        : '';
      return inlineMarkdown(value) + separator;
    }).join('');
    output.push('<p>' + content + '</p>');
    paragraph = [];
  }
  function flushList() {
    if (!list) return;
    output.push('<' + list.type + '>' + list.items.map(item => '<li>' + inlineMarkdown(item) + '</li>').join('') + '</' + list.type + '>');
    list = null;
  }
  function flushTable() {
    if (!table) return;
    const head = '<thead><tr>' + table.headers.map(cell => '<th>' + inlineMarkdown(cell) + '</th>').join('') + '</tr></thead>';
    const body = table.rows.length ? '<tbody>' + table.rows.map(row => '<tr>' + row.map(cell => '<td>' + inlineMarkdown(cell) + '</td>').join('') + '</tr>').join('') + '</tbody>' : '';
    output.push('<table>' + head + body + '</table>');
    table = null;
  }
  function flush() {
    flushParagraph();
    flushList();
    flushTable();
  }

  function splitTableRow(value) {
    let row = String(value || '').trim();
    if (row.startsWith('|')) row = row.slice(1);
    if (row.endsWith('|')) row = row.slice(0, -1);
    const cells = [];
    let cell = '';
    let inCode = false;
    let escaped = false;
    for (let index = 0; index < row.length; index++) {
      const char = row[index];
      if (escaped) {
        cell += char;
        escaped = false;
        continue;
      }
      if (char === '\\') {
        cell += char;
        escaped = true;
        continue;
      }
      if (char === '`') {
        inCode = !inCode;
        cell += char;
        continue;
      }
      if (char === '|' && !inCode) {
        cells.push(cell.trim());
        cell = '';
        continue;
      }
      cell += char;
    }
    cells.push(cell.trim());
    return cells;
  }

  function isTableDivider(value) {
    const cells = splitTableRow(value);
    return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell));
  }

  function renderQuote(lines) {
    const paragraphs = [];
    let current = [];
    lines.forEach(function (value) {
      if (!value.trim()) {
        if (current.length) paragraphs.push(current), current = [];
        return;
      }
      current.push(value);
    });
    if (current.length) paragraphs.push(current);
    return '<blockquote>' + paragraphs.map(function (paragraph) {
      return '<p>' + paragraph.map(inlineMarkdown).join(' ') + '</p>';
    }).join('') + '</blockquote>';
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const heading = line.match(/^ {0,3}(#{1,6})[ \t]+(.+?)\s*#*$/);
    const unordered = line.match(/^ {0,3}[-+*][ \t]+(.+)$/);
    const ordered = line.match(/^ {0,3}\d+[.)][ \t]+(.+)$/);
    if (!line.trim()) {
      flush();
      continue;
    }
    if (/^\u0000CODE_\d+\u0000$/.test(line.trim())) {
      flush();
      output.push(line.trim());
      continue;
    }
    if (table && /^\s*\|/.test(line)) {
      table.rows.push(splitTableRow(line));
      continue;
    }
    if (!table && /^\s*\|/.test(line) && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      flush();
      table = { headers: splitTableRow(line), rows: [] };
      index++;
      continue;
    }
    if (heading) {
      flush();
      const baseId = markdownHeadingId(heading[2]);
      const count = headingIds.get(baseId) || 0;
      headingIds.set(baseId, count + 1);
      const id = count ? baseId + '-' + count : baseId;
      output.push('<h' + heading[1].length + ' id="' + escapeHtml(id) + '">' + inlineMarkdown(heading[2]) + '</h' + heading[1].length + '>');
      continue;
    }
    if (/^ {0,3}(?:-{3,}|\*{3,}|_{3,})[ \t]*$/.test(line)) {
      flush();
      output.push('<hr>');
      continue;
    }
    if (unordered || ordered) {
      flushTable();
      flushParagraph();
      const type = unordered ? 'ul' : 'ol';
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      const item = (unordered || ordered)[1];
      list.items.push(item);
      continue;
    }
    if (/^ {0,3}\\?>[ \t]?/.test(line)) {
      flushTable();
      flush();
      const quoteLines = [];
      while (index < lines.length) {
        const quoteLine = lines[index];
        if (/^ {0,3}\\?>[ \t]?/.test(quoteLine)) {
          quoteLines.push(quoteLine.replace(/^ {0,3}\\?>[ \t]?/, ''));
          index++;
          continue;
        }
        if (!quoteLine.trim() && /^ {0,3}\\?>/.test(lines[index + 1] || '')) {
          quoteLines.push('');
          index++;
          continue;
        }
        break;
      }
      index--;
      output.push(renderQuote(quoteLines));
      continue;
    }
    if (/^\s*<(?:address|article|aside|blockquote|details|div|dl|fieldset|figure|footer|form|h[1-6]|header|hr|main|nav|ol|p|pre|section|table|ul)\b/i.test(line)) {
      flushTable();
      flush();
      output.push(line);
      continue;
    }
    if (table) flushTable();
    paragraph.push(line);
  }
  flush();
  return output.join('\n');
}

export function renderMarkdown(source) {
  let rawSource = String(source == null ? '' : source).replace(/\r\n?/g, '\n');
  // 某些编辑器/接口会把行首引用符保存成 HTML 实体，先还原为 Markdown 的 >。
  rawSource = rawSource.replace(/(^|\n)([ \t]*)\\?(?:&gt;|&#62;|&#x3e;)[ \t]?/gi, '$1$2> ');
  // 后台编辑器保存的是富文本 HTML。直接保留它，避免把原有 <br>
  // 拆成 Markdown 行后再次生成或吞掉换行。
  if (/^\s*<(?:p|div|h[1-6]|ul|ol|li|blockquote|table|pre|br)\b/i.test(rawSource)) {
    return rawSource;
  }
  // 编辑器可能把纯 Markdown 的每一行保存成 "文本<br>"；在没有富文本块标签时，
  // 将这些编辑器换行还原成 Markdown 换行，才能识别表格分隔行和 --- 分隔线。
  if (/<br\s*\/?>/i.test(rawSource) && /(?:^|\n)\s*(?:#{1,6}\s|>|---+|[-+*]\s|\|)/m.test(rawSource)) {
    rawSource = rawSource.replace(/(?:<br\s*\/?>\s*)+/gi, '\n');
  }
  const fences = [];
  const protectedSource = rawSource.replace(/(^|\n)[ \t]*```([a-z0-9_-]*)[ \t]*\n([\s\S]*?)(?:\n[ \t]*)```[ \t]*(?=\n|$)/gi,
    (_, prefix, language, code) => {
      const className = language ? ' class="language-' + escapeHtml(language) + '"' : '';
      fences.push('<pre><code' + className + '>' + escapeHtml(code) + '</code></pre>');
      return prefix + '\u0000CODE_' + (fences.length - 1) + '\u0000';
    });
  const rendered = renderMarkdownBlocks(protectedSource);
  return rendered.replace(/\u0000CODE_(\d+)\u0000/g, (_, index) => fences[Number(index)] || '');
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function span(className, value) {
  return '<span class="code-token-' + className + '">' + escapeHtml(value) + '</span>';
}

function readLanguage(node) {
  const className = String(node?.className || '');
  const match = className.match(/(?:language|lang)-([a-z0-9_-]+)/i);
  const raw = (match ? match[1] : node?.dataset?.language || '').toLowerCase();
  return LANGUAGE_ALIASES[raw] || raw;
}

export function detectCodeLanguage(source, hint = '') {
  const normalizedHint = String(hint || '').toLowerCase();
  if (normalizedHint) return LANGUAGE_ALIASES[normalizedHint] || normalizedHint;
  const text = String(source || '');
  if (/@(?:font-face|media|supports|keyframes|import)\b|[.#][\w-]+\s*\{[\s\S]*?:/.test(text)) return 'css';
  if (/<\/?[a-z][^>]*>/i.test(text)) return 'markup';
  if (/\b(?:const|let|var|function|return|import|export)\b|=>|console\./.test(text)) return 'javascript';
  if (/^\s*(?:#!\/bin\/(?:ba)?sh|git|npm|yarn|pnpm|curl|sudo)\b/m.test(text)) return 'bash';
  return 'plaintext';
}

function scanCode(source, matchers) {
  const text = String(source || '');
  const output = [];
  let index = 0;
  let plainStart = 0;

  function flushPlain(end) {
    if (end > plainStart) output.push(escapeHtml(text.slice(plainStart, end)));
  }

  while (index < text.length) {
    let matched = null;
    for (const matcher of matchers) {
      const value = matcher(text, index);
      if (value) {
        matched = value;
        break;
      }
    }
    if (!matched) {
      index++;
      continue;
    }
    flushPlain(index);
    output.push(span(matched.className, matched.value));
    index += matched.value.length;
    plainStart = index;
  }
  flushPlain(text.length);
  return output.join('');
}

function at(source, index, expression, className) {
  const match = source.slice(index).match(expression);
  return match ? { className, value: match[0] } : null;
}

function highlightCss(source) {
  return scanCode(source, [
    (text, index) => at(text, index, /^\/\*[\s\S]*?\*\//, 'comment'),
    (text, index) => at(text, index, /^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/, 'string'),
    (text, index) => at(text, index, /^@[a-z-]+/i, 'keyword'),
    (text, index) => at(text, index, /^#[0-9a-f]{3,8}\b/i, 'number'),
    (text, index) => at(text, index, /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:%|[a-z]+)?\b/i, 'number'),
    (text, index) => at(text, index, /^--[a-z0-9_-]+/i, 'attr'),
    (text, index) => at(text, index, /^[a-z_-][a-z0-9_-]*(?=\s*:)/i, 'attr'),
    (text, index) => at(text, index, /^[a-z_-][a-z0-9_-]*(?=\()/i, 'built-in'),
    (text, index) => at(text, index, /^!important\b/i, 'keyword')
  ]);
}

function highlightJavaScript(source) {
  return scanCode(source, [
    (text, index) => at(text, index, /^\/\/[^\r\n]*/, 'comment'),
    (text, index) => at(text, index, /^\/\*[\s\S]*?\*\//, 'comment'),
    (text, index) => at(text, index, /^(?:`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/, 'string'),
    (text, index) => at(text, index, /^(?:const|let|var|function|return|if|else|for|while|new|class|extends|import|from|export|default|async|await|throw|try|catch|true|false|null|undefined)\b/, 'keyword'),
    (text, index) => at(text, index, /^\b\d+(?:\.\d+)?\b/, 'number'),
    (text, index) => at(text, index, /^[a-z_$][a-z0-9_$]*(?=\()/i, 'built-in')
  ]);
}

function highlightMarkup(source) {
  const text = String(source || '');
  const output = [];
  let index = 0;
  while (index < text.length) {
    if (text.startsWith('<!--', index)) {
      const end = text.indexOf('-->', index + 4);
      const value = text.slice(index, end < 0 ? text.length : end + 3);
      output.push(span('comment', value));
      index += value.length;
      continue;
    }
    if (text[index] !== '<') {
      output.push(escapeHtml(text[index]));
      index++;
      continue;
    }
    const end = text.indexOf('>', index + 1);
    if (end < 0) {
      output.push(escapeHtml(text.slice(index)));
      break;
    }
    const tag = text.slice(index, end + 1);
    const match = tag.match(/^(<\/?)([a-z0-9:-]+)([\s\S]*?)(\/?>)$/i);
    if (!match) {
      output.push(escapeHtml(tag));
      index = end + 1;
      continue;
    }
    const attributes = escapeHtml(match[3])
      .replace(/(\s)([a-z0-9:-]+)(=)/gi, '$1<span class="code-token-attr">$2</span>$3')
      .replace(/(=)(&quot;.*?&quot;|&#39;.*?&#39;)/g, '$1<span class="code-token-string">$2</span>');
    const tagHtml = escapeHtml(match[1])
      + '<span class="code-token-keyword">' + escapeHtml(match[2]) + '</span>'
      + attributes + escapeHtml(match[4]);
    output.push(tagHtml);
    index = end + 1;
  }
  return output.join('');
}

export function highlightCode(source, hint = '') {
  const text = String(source || '');
  const language = detectCodeLanguage(text, hint);
  if (language === 'css') return highlightCss(text);
  if (language === 'javascript' || language === 'bash') return highlightJavaScript(text);
  if (language === 'markup') return highlightMarkup(text);
  return escapeHtml(text);
}

export function splitCodeLines(source) {
  const lines = String(source == null ? '' : source).replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines.length ? lines : [''];
}

function normalizeCssLine(value, indent) {
  let line = String(value || '').trim();
  if (!line) return line;
  if (/\{$/.test(line)) line = line.replace(/\s*\{$/, ' {');
  // 声明块中的冒号是属性分隔符；顶层选择器保留伪类写法，如 :hover。
  if (indent > 0 && /^[\w-]+\s*:/.test(line)) {
    line = line.replace(/^([\w-]+)\s*:\s*/, '$1: ');
  }
  // CSS 列表（font-family、src 等）统一使用逗号加空格。
  line = line.replace(/,\s*/g, ', ');
  return line;
}

function splitCssValue(value) {
  const parts = [];
  let start = 0;
  let quote = '';
  let escaped = false;
  let depth = 0;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '(') { depth++; continue; }
    if (char === ')') { depth = Math.max(0, depth - 1); continue; }
    if (char === ',' && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts;
}

function formatCssLines(value, indent) {
  const line = normalizeCssLine(value, indent);
  const match = line.match(/^(src\s*:\s*)(.+)$/i);
  if (!match) return [line];
  const parts = splitCssValue(match[2]);
  if (parts.length < 2) return [line];
  const columns = parts.map(function (part) {
    const split = part.match(/^(.*?)(\s+format\(.*)$/i);
    return {
      url: split ? split[1].trim() : part,
      format: split ? split[2].trim() : ''
    };
  });
  const firstPrefix = match[1].length;
  const continuationPrefix = firstPrefix;
  const formatColumn = Math.max.apply(null, columns.map(function (column, index) {
    const prefixLength = index === 0 ? firstPrefix : continuationPrefix;
    return prefixLength + column.url.length;
  })) + 2;
  return parts.map(function (part, index) {
    const suffix = index < parts.length - 1 ? ',' : '';
    const split = part.match(/^(.*?)(\s+format\(.*)$/i);
    const url = split ? split[1].trim() : part;
    const format = split ? split[2].trim() : '';
    const prefix = index === 0 ? match[1] : ' '.repeat(continuationPrefix);
    const value = format
      ? prefix + url + ' '.repeat(Math.max(1, formatColumn - prefix.length - url.length)) + format
      : prefix + url;
    return value + suffix;
  }).filter(function (value) {
    return value.trim() !== '';
  });
}

export function formatCss(source) {
  const text = String(source == null ? '' : source).replace(/\r\n?/g, '\n').trim();
  if (!text) return '';

  const lines = [];
  let line = '';
  let indent = 0;
  let quote = '';
  let comment = false;
  let escaped = false;
  let parenDepth = 0;

  function flush(force = false) {
    const value = normalizeCssLine(line, indent);
    const values = formatCssLines(value, indent);
    if (value || force) values.forEach(function (item) {
      lines.push('    '.repeat(Math.max(0, indent)) + item);
    });
    line = '';
  }

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const next = text[index + 1];

    if (comment) {
      line += char;
      if (char === '*' && next === '/') {
        line += next;
        index++;
        comment = false;
      }
      continue;
    }
    if (quote) {
      line += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '*') {
      line += char + next;
      index++;
      comment = true;
      continue;
    }
    if (char === '"' || char === "'") {
      line += char;
      quote = char;
      continue;
    }
    if (char === '(') {
      parenDepth++;
      line += char;
      continue;
    }
    if (char === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      line += char;
      continue;
    }
    if (parenDepth === 0 && char === '{') {
      line = line.trimEnd() + ' {';
      flush();
      indent++;
      continue;
    }
    if (parenDepth === 0 && char === ';') {
      line = line.trimEnd() + ';';
      flush();
      continue;
    }
    if (parenDepth === 0 && char === '}') {
      flush();
      indent = Math.max(0, indent - 1);
      line = '}';
      const nextCode = text.slice(index + 1).match(/^\s*(.)/s);
      if (!nextCode || !/[;,]/.test(nextCode[1])) {
        flush();
        if (indent === 0 && nextCode && nextCode[1] !== '}') lines.push('');
      }
      continue;
    }
    if (char === '\n') {
      if (/^\s*src\s*:/i.test(line) && /,\s*$/.test(line)) {
        line += ' ';
        continue;
      }
      if (line.trim()) flush();
      continue;
    }
    line += char;
  }
  flush();
  return lines.join('\n').replace(/\n\n(?=\s*url\()/gi, '\n');
}

function formatCode(source, language) {
  return language === 'css' ? formatCss(source) : String(source == null ? '' : source).replace(/\r\n?/g, '\n').trim();
}

function codeClassName(code) {
  return String(code?.className || '');
}

export function unwrapCodeFence(source) {
  const normalized = String(source == null ? '' : source).replace(/\r\n?/g, '\n');
  const match = normalized.match(/^\s*```([a-z0-9_-]*)[ \t]*\n([\s\S]*?)\s*```[ \t]*$/i);
  if (!match) return { source: normalized, language: '' };
  return { source: match[2], language: match[1].toLowerCase() };
}

function readCodeSource(node, documentRef) {
  if (!node) return '';
  const clone = node.cloneNode(true);
  clone.querySelectorAll('br').forEach(function (br) {
    br.replaceWith(documentRef.createTextNode('\n'));
  });
  return clone.textContent || '';
}

export function enhanceCodeBlocks(html, documentRef = globalThis.document) {
  if (!documentRef) return String(html || '');
  const template = documentRef.createElement('template');
  template.innerHTML = String(html || '');
  template.content.querySelectorAll('pre').forEach(function (pre) {
    const code = pre.querySelector(':scope > code') || pre.querySelector('code');
    const rawSource = code ? readCodeSource(code, documentRef) : readCodeSource(pre, documentRef);
    const fence = unwrapCodeFence(rawSource);
    const source = formatCode(fence.source, detectCodeLanguage(
      fence.source,
      fence.language || codeClassName(code || pre).match(/(?:language|lang)-([a-z0-9_-]+)/i)?.[1] || ''
    ));
    const hint = codeClassName(code || pre);
    const language = detectCodeLanguage(
      source,
      fence.language || hint.match(/(?:language|lang)-([a-z0-9_-]+)/i)?.[1] || ''
    );
    const wrapper = documentRef.createElement('pre');
    wrapper.className = 'article-code';
    wrapper.dataset.language = language;
    const body = documentRef.createElement('code');
    body.className = 'article-code-body';
    body.innerHTML = highlightCode(source, language);
    wrapper.append(body);
    pre.replaceWith(wrapper);
  });
  return template.innerHTML;
}
