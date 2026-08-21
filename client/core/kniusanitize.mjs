// 对可编辑富文本执行安全白名单清理，避免事件属性和危险 URL 进入 DOM。
export function sanitizeRichHtml(html, documentRef = document) {
  const template = documentRef.createElement('template');
  template.innerHTML = String(html || '');
  template.content.querySelectorAll('script,iframe,object,embed,link,meta,style,base,form').forEach(function (node) { node.remove(); });
  template.content.querySelectorAll('*').forEach(function (node) {
    Array.from(node.attributes).forEach(function (attr) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      const dangerousUrl = ['href', 'src', 'poster', 'xlink:href'].includes(name) && /^(javascript|vbscript):/i.test(value);
      if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction' || dangerousUrl) node.removeAttribute(attr.name);
    });
  });
  return template.innerHTML;
}
