const THEME_STYLE_KEY = 'themes';
import { kniuWarn, KNDEBUG } from './Kniu-Debug.mjs';
import BASE_CSS from './Kniu-Ui/Kniu-Other/Kniu-Base.css?module';
import THEME_CSS from './Kniu-Ui/Kniu-Other/Kniu-Theme.css?module';
import CONTENT_TABLE_CSS from './Kniu-Ui/Kniu-Other/Kniu-ContentTable.css?module';
import MARKDOWN_CSS from './Kniu-Ui/Kniu-Other/Kniu-Markdown.css?module';
import RICHTEXT_CSS from './Kniu-Ui/Kniu-Other/Kniu-Richtext.css?module';
import KniuUI from './Kniu-Ui/Kniu-Ui.mjs';
import { scopeGet, scopeSet } from './Kniu-Scope.mjs';
import {
  setDocumentStyleAdapter, setThemeStyleSheetProvider,
  adoptDocumentStyle as runtimeAdoptDocumentStyle,
  getThemeStyleSheet as runtimeGetThemeStyleSheet,
  trackRuntimeNode
} from './Kniu-Runtime.mjs';
import { getContracts, DEFAULT_FONT_FAMILY } from './Kniu-Contracts.mjs';

const GLOBAL_STYLE_KEY = 'global-base';
let themeStyleSheet = null;
const documentStyleSheets = new WeakMap();

function supportsAdoptedStyleSheets(target) {
  return !!target
    && typeof CSSStyleSheet === 'function'
    && typeof CSSStyleSheet.prototype.replaceSync === 'function'
    && 'adoptedStyleSheets' in target;
}

function findManagedStyle(documentRef, key) {
  return documentRef.head?.querySelector(`style[data-kniu-runtime-style="${key}"]`) || null;
}

function createManagedStyle(documentRef, key) {
  const style = documentRef.createElement('style');
  style.setAttribute('data-kniu-runtime-style', key);
  const nonce = scopeGet('__KNIU_CSP_NONCE__');
  if (nonce) style.nonce = String(nonce);
  return style;
}

function styleById(documentRef, id) {
  if (typeof documentRef.getElementById === 'function') return documentRef.getElementById(id);
  try { return documentRef.querySelector(`#${id}`) || null; } catch { return null; }
}

function applyDocumentStyle(id, cssText, documentRef = globalThis.document) {
  if (documentRef && documentRef.nodeType === 1) documentRef = documentRef.ownerDocument || null;
  if (!documentRef || !id || !cssText) return null;
  if (supportsAdoptedStyleSheets(documentRef)) {
    let sheets = documentStyleSheets.get(documentRef);
    if (!sheets) {
      sheets = new Map();
      documentStyleSheets.set(documentRef, sheets);
    }
    let sheet = sheets.get(id);
    if (!sheet) {
      sheet = new CSSStyleSheet();
      sheets.set(id, sheet);
    }
    sheet.replaceSync(String(cssText));
    if (!documentRef.adoptedStyleSheets.includes(sheet)) {
      documentRef.adoptedStyleSheets = [...documentRef.adoptedStyleSheets, sheet];
    }
    styleById(documentRef, id)?.remove();
    return sheet;
  }
  let style = styleById(documentRef, id);
  if (!(style instanceof HTMLStyleElement)) {
    style = documentRef.createElement ? documentRef.createElement('style') : globalThis.document.createElement('style');
    style.id = id;
    const nonce = scopeGet('__KNIU_CSP_NONCE__');
    if (nonce) style.nonce = String(nonce);
    (documentRef.head || documentRef.documentElement || documentRef).append(style);
  }
  style.textContent = String(cssText);
  return style;
}

setDocumentStyleAdapter(applyDocumentStyle);

export const adoptDocumentStyle = runtimeAdoptDocumentStyle;

function buildThemeCssText(theme) {
  const variables = Object.entries(theme || {})
    .filter(([name, value]) => /^--kniu-[a-z0-9-]+$/i.test(name) && value != null)
    .map(([name, value]) => `${name}:${String(value)};`)
    .join('');
  return variables ? `:root{${variables}}` : '';
}

function installGlobalStyles(documentRef = globalThis.document) {
  if (!documentRef?.head) return null;
  const globalSheet = documentStyleSheets.get(documentRef)?.get(GLOBAL_STYLE_KEY);
  if (globalSheet && documentRef.adoptedStyleSheets.includes(globalSheet)) {
    documentRef.adoptedStyleSheets = documentRef.adoptedStyleSheets.filter((sheet) => sheet !== globalSheet);
  }
  let style = findManagedStyle(documentRef, GLOBAL_STYLE_KEY);
  if (!(style instanceof HTMLStyleElement)) {
    style = createManagedStyle(documentRef, GLOBAL_STYLE_KEY);
    const title = documentRef.head.querySelector('title');
    documentRef.head.insertBefore(style, title ? title.nextSibling : documentRef.head.firstChild);
  }
  style.textContent = String(THEME_CSS || '') + String(BASE_CSS || '')
    + String(CONTENT_TABLE_CSS || '') + String(MARKDOWN_CSS || '')
    + String(RICHTEXT_CSS || '');
  trackRuntimeNode(style);
  return style;
}

function applyTheme(theme = {}) {
  const cssText = buildThemeCssText(theme);
  const documentRef = globalThis.document;
  if (!documentRef || !cssText) return Object.freeze(theme);
  if (themeStyleSheet && supportsAdoptedStyleSheets(documentRef) && documentRef.adoptedStyleSheets.includes(themeStyleSheet)) {
    documentRef.adoptedStyleSheets = documentRef.adoptedStyleSheets.filter((sheet) => sheet !== themeStyleSheet);
  }
  themeStyleSheet = null;
  let style = findManagedStyle(documentRef, THEME_STYLE_KEY);
  if (!(style instanceof HTMLStyleElement)) {
    style = createManagedStyle(documentRef, THEME_STYLE_KEY);
    const globalStyle = findManagedStyle(documentRef, GLOBAL_STYLE_KEY);
    const title = documentRef.head?.querySelector('title');
    const anchor = globalStyle || title;
    (documentRef.head || documentRef.documentElement).insertBefore(style, anchor ? anchor.nextSibling : null);
  }
  style.textContent = cssText;
  trackRuntimeNode(style);
  return Object.freeze(theme);
}

setThemeStyleSheetProvider(() => themeStyleSheet);

export const getThemeStyleSheet = runtimeGetThemeStyleSheet;

function configureUi({ COMPONENTS = {}, THEME = {}, presets = null } = {}) {
  installGlobalStyles();
  const activePresets = presets || getContracts().theme?.presets || null;
  const preset = activePresets && THEME && THEME.preset ? activePresets[THEME.preset] : null;
  const themeContract = getContracts().theme || {};
  const fontVars = themeContract.fontFamily && themeContract.fontFamily !== DEFAULT_FONT_FAMILY
    ? {
      '--kniu-font-family': themeContract.fontFamily,
      '--kniu-font-mono-family': themeContract.fontMonoFamily || themeContract.fontFamily,
      '--kniu-font-serif-family': themeContract.fontSerifFamily || themeContract.fontFamily
    }
    : {};
  const mergedTheme = { ...fontVars, ...(preset || {}), ...THEME };
  const theme = applyTheme(mergedTheme);
  KniuUI.use({ COMPONENTS, THEME: theme });
  return Object.freeze({ components: { ...COMPONENTS }, theme });
}

export { applyTheme, configureUi, installGlobalStyles };
export default configureUi;