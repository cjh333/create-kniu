import { isDangerousUrl } from './kniu-sanitizer.mjs';

export const KNIU_TABLE_WRAP_CLASS = 'kniu_richtext_table_wrap';
export const KNIU_TABLE_CLASS = 'kniu_richtext_table';

export function wrapTablesIn(root, skipNode) {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll('table').forEach((table) => {
    const parent = table.parentNode;
    if (!parent || parent.closest?.('table') || (skipNode && table.contains(skipNode))) return;
    if (parent.classList?.contains(KNIU_TABLE_WRAP_CLASS)) {
      table.classList.add(KNIU_TABLE_CLASS);
      return;
    }
    const wrapper = (root.ownerDocument || document).createElement('div');
    wrapper.className = KNIU_TABLE_WRAP_CLASS;
    parent.insertBefore(wrapper, table);
    wrapper.append(table);
    table.classList.add(KNIU_TABLE_CLASS);
  });
}

export function unwrapTablesIn(root) {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll(`.${KNIU_TABLE_WRAP_CLASS}`).forEach((wrapper) => {
    const parent = wrapper.parentNode;
    if (!parent) return;
    while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper);
    wrapper.remove();
  });
  root.querySelectorAll(`.${KNIU_TABLE_CLASS}`).forEach((table) => table.classList.remove(KNIU_TABLE_CLASS));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function replaceMarkdownLinks(escaped) {
  let out = '';
  let cursor = 0;
  while (cursor < escaped.length) {
    const labelStart = escaped.indexOf('[', cursor);
    if (labelStart === -1) { out += escaped.slice(cursor); break; }
    out += escaped.slice(cursor, labelStart);
    const labelEnd = escaped.indexOf(']', labelStart + 1);
    if (labelEnd === -1) { out += escaped.slice(labelStart); break; }
    let afterLabel = labelEnd + 1;
    while (afterLabel < escaped.length && escaped[afterLabel] === ' ') afterLabel += 1;
    if (escaped[afterLabel] !== '(') {
      out += escaped.slice(labelStart, afterLabel);
      cursor = afterLabel;
      continue;
    }
    let depth = 1;
    let hrefEnd = -1;
    for (let i = afterLabel + 1; i < escaped.length; i += 1) {
      const ch = escaped[i];
      if (ch === '\\' && i + 1 < escaped.length) { i += 1; continue; }
      if (ch === '(') depth += 1;
      else if (ch === ')') { depth -= 1; if (depth === 0) { hrefEnd = i; break; } }
    }
    if (hrefEnd === -1) { out += escaped.slice(labelStart); break; }
    const label = escaped.slice(labelStart + 1, labelEnd);
    const href = escaped.slice(afterLabel + 1, hrefEnd).trim();
    out += `<a href="${isDangerousUrl(href) ? '#' : escapeHtml(href)}" rel="noopener noreferrer">${label}</a>`;
    cursor = hrefEnd + 1;
  }
  return out;
}

function inlineMarkdown(value) {
  return replaceMarkdownLinks(escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>'));
}

export function renderMarkdownArticle(value, documentRef = globalThis.document) {
  const source = String(value ?? '').replace(/\r\n?/g, '\n');
  const html = source.split(/\n{2,}/).map((block) => {
    if (/^```/.test(block)) {
      const code = block.replace(/^```[^\n]*\n?|\n?```$/g, '');
      return `<pre><code>${escapeHtml(code)}</code></pre>`;
    }
    const heading = /^(#{1,6})\s+(.+)$/m.exec(block);
    if (heading) return `<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`;
    return `<p>${inlineMarkdown(block).replace(/\n/g, '<br>')}</p>`;
  }).join('');
  if (!documentRef) return html;
  const template = documentRef.createElement('template');
  template.innerHTML = html;
  wrapTablesIn(template.content);
  return template.innerHTML;
}