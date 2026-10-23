import { resolveTheme } from './kniu-theme.mjs';

const THEME_STYLE_ID = 'kniu-theme-vars';

function applyTheme(theme = {}) {
  const resolvedTheme = resolveTheme(theme);
  const variables = Object.entries(resolvedTheme)
    .filter(([name, value]) => /^--kniu-[a-z0-9-]+$/i.test(name) && value != null)
    .map(([name, value]) => `${name}:${String(value)};`)
    .join('');
  const documentRef = globalThis.document;
  if (!documentRef) return resolvedTheme;
  let style = documentRef.getElementById(THEME_STYLE_ID);
  if (!(style instanceof HTMLStyleElement)) {
    style = documentRef.createElement('style');
    style.id = THEME_STYLE_ID;
    const nonce = globalThis.__KNIU_CSP_NONCE__;
    if (nonce) style.nonce = String(nonce);
    (documentRef.head || documentRef.documentElement).append(style);
  }
  // 使用 :root 规则而非 document.documentElement.style，避免向 <html>
  // 写入 style 属性，也让主题规则可被 CSP nonce 统一管理。
  style.textContent = `:root{${variables}}`;
  return resolvedTheme;
}

function configureUi({ COMPONENTS = {}, THEME = {} } = {}) {
  const theme = applyTheme(THEME);
  return Object.freeze({ components: { ...COMPONENTS }, theme });
}

export { applyTheme, configureUi };
export default configureUi;
