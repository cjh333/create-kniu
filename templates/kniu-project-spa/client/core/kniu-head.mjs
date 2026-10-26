// 属性选择器转义：name 含 " / ] / \ 时直接拼接会破坏选择器结构。
function escapeAttributeSelector(value) {
  return String(value).replace(/["\\\]]/g, '\\$&');
}

function setMeta(name, content, attribute = 'name') {
  if (!content) return;
  const escaped = escapeAttributeSelector(name);
  let node = document.head.querySelector(`meta[${attribute}="${escaped}"]`);
  if (!node) { node = document.createElement('meta'); node.setAttribute(attribute, name); document.head.append(node); }
  node.setAttribute('content', String(content));
}

export function updateHead({ title, description, canonical, image, type = 'website', jsonLd } = {}) {
  if (title) document.title = String(title);
  setMeta('description', description);
  setMeta('og:title', title, 'property');
  setMeta('og:description', description, 'property');
  setMeta('og:type', type, 'property');
  setMeta('og:image', image, 'property');
  if (canonical) {
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.append(link); }
    link.href = canonical;
  }
  if (jsonLd) {
    let script = document.head.querySelector('script[data-kniu-jsonld]');
    if (!script) { script = document.createElement('script'); script.type = 'application/ld+json'; script.dataset.kniuJsonld = 'true'; document.head.append(script); }
    try { script.textContent = JSON.stringify(jsonLd); } catch { script.textContent = ''; }
  }
}

export default updateHead;