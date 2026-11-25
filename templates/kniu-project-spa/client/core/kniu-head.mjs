import { trackRuntimeNode } from './Kniu-Runtime.mjs';

function escapeAttributeSelector(value) {
  return String(value).replace(/["\\\]]/g, '\\$&');
}

function setMeta(documentRef, name, content, attribute = 'name') {
  if (!content || !documentRef?.head) return;
  const escaped = escapeAttributeSelector(name);
  let node = documentRef.head.querySelector(`meta[${attribute}="${escaped}"]`);
  if (!node) {
    node = documentRef.createElement('meta');
    node.setAttribute(attribute, name);
    documentRef.head.append(node);
    trackRuntimeNode(node);
  }
  node.setAttribute('content', String(content));
}

export function updateHead({ title, description, canonical, image, type = 'website', jsonLd } = {}, documentRef = globalThis.document) {
  if (!documentRef?.head) return;
  if (title) documentRef.title = String(title);
  setMeta(documentRef, 'description', description);
  setMeta(documentRef, 'og:title', title, 'property');
  setMeta(documentRef, 'og:description', description, 'property');
  setMeta(documentRef, 'og:type', type, 'property');
  setMeta(documentRef, 'og:image', image, 'property');
  if (canonical) {
    let link = documentRef.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = documentRef.createElement('link');
      link.rel = 'canonical';
      documentRef.head.append(link);
      trackRuntimeNode(link);
    }
    link.href = canonical;
  }
  if (jsonLd) {
    let script = documentRef.head.querySelector('script[data-kniu-jsonld]');
    if (!script) {
      script = documentRef.createElement('script');
      script.type = 'application/ld+json';
      script.dataset.kniuJsonld = 'true';
      documentRef.head.append(script);
      trackRuntimeNode(script);
    }
    try { script.textContent = JSON.stringify(jsonLd); } catch { script.textContent = ''; }
  }
}

export default updateHead;