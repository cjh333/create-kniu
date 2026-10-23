import { reactive, effect } from './kniu-mvvm.mjs';
import { evaluateTemplateExpression } from './kniu-template.mjs';
import * as Badge from './kniu-ui/kniu-badge/kniu-badge.mjs';
import * as Tag from './kniu-ui/kniu-tag/kniu-tag.mjs';
import * as Status from './kniu-ui/kniu-status/kniu-status.mjs';
import * as Empty from './kniu-ui/kniu-empty/kniu-empty.mjs';
import * as Button from './kniu-ui/kniu-btn/kniu-btn.mjs';
import * as ButtonGroup from './kniu-ui/kniu-btn-group/kniu-btn-group.mjs';
import * as Switch from './kniu-ui/kniu-switch/kniu-switch.mjs';
import * as Modal from './kniu-ui/kniu-modal/kniu-modal.mjs';
import * as Table from './kniu-ui/kniu-table/kniu-table.mjs';
import * as Loading from './kniu-ui/kniu-loading/kniu-loading.mjs';
import * as Msg from './kniu-ui/kniu-msg/kniu-msg.mjs';
import * as Select from './kniu-ui/kniu-select/kniu-select.mjs';
import * as RadioGroup from './kniu-ui/kniu-radio-group/kniu-radio-group.mjs';
import * as Page from './kniu-ui/kniu-page/kniu-page.mjs';
import * as PageMore from './kniu-ui/kniu-page-more/kniu-page-more.mjs';
import * as Image from './kniu-ui/kniu-image/kniu-image.mjs';
import * as Input from './kniu-ui/kniu-input/kniu-input.mjs';
import * as DatePicker from './kniu-ui/kniu-date-picker/kniu-date-picker.mjs';
import * as Form from './kniu-ui/kniu-form/kniu-form.mjs';
import * as Upload from './kniu-ui/kniu-upload/kniu-upload.mjs';
import * as Icon from './kniu-ui/kniu-icon/kniu-icon.mjs';
import * as Tab from './kniu-ui/kniu-tab/kniu-tab.mjs';
import * as Editor from './kniu-ui/kniu-editor/kniu-editor.mjs';
import * as Navbar from './kniu-ui/kniu-navbar/kniu-navbar.mjs';
import * as Backtop from './kniu-ui/kniu-backtop/kniu-backtop.mjs';
import * as Comment from './kniu-ui/kniu-comment/kniu-comment.mjs';
import * as Like from './kniu-ui/kniu-like/kniu-like.mjs';
import * as UserLogin from './kniu-ui/kniu-user-login/kniu-user-login.mjs';
import * as ArticleTab from './kniu-ui/kniu-article-tab/kniu-article-tab.mjs';
import BASE_CSS from './kniu-ui/kniu-other/kniu-base.css?module';
import CONTAIN_CSS from './kniu-ui/kniu-other/kniu-contain.css?module';
import CONTENT_TABLE_CSS from './kniu-ui/kniu-other/kniu-content-table.css?module';
import DROPDOWN_CSS from './kniu-ui/kniu-other/kniu-dropdown.css?module';
import DROPDOWN_OPTION_CSS from './kniu-ui/kniu-other/kniu-dropdown.option.css?module';
import FONT_FACE_CSS from './kniu-ui/kniu-other/kniu-font-face.css?module';
import MARKDOWN_CSS from './kniu-ui/kniu-other/kniu-markdown.css?module';
import RICHTEXT_CSS from './kniu-ui/kniu-other/kniu-richtext.css?module';
import BADGE_CSS from './kniu-ui/kniu-badge/kniu-badge.css?module';
import TAG_CSS from './kniu-ui/kniu-tag/kniu-tag.css?module';
import STATUS_CSS from './kniu-ui/kniu-status/kniu-status.css?module';
import EMPTY_CSS from './kniu-ui/kniu-empty/kniu-empty.css?module';
import BTN_CSS from './kniu-ui/kniu-btn/kniu-btn.css?module';
import BTN_METRICS_CSS from './kniu-ui/kniu-btn/kniu-btn.metrics.css?module';
import BTN_OVERRIDES_CSS from './kniu-ui/kniu-btn/kniu-btn.overrides.css?module';
import BTN_GROUP_CSS from './kniu-ui/kniu-btn-group/kniu-btn-group.css?module';
import SWITCH_CSS from './kniu-ui/kniu-switch/kniu-switch.css?module';
import MODAL_CSS from './kniu-ui/kniu-modal/kniu-modal.css?module';
import MODAL_CONFIRM_CSS from './kniu-ui/kniu-modal/kniu-modal.confirm.css?module';
import TABLE_CSS from './kniu-ui/kniu-table/kniu-table.css?module';
import TABLE_COL_CSS from './kniu-ui/kniu-table/kniu-table-col.css?module';
import LOADING_CSS from './kniu-ui/kniu-loading/kniu-loading.css?module';
import MSG_CSS from './kniu-ui/kniu-msg/kniu-msg.css?module';
import SELECT_CSS from './kniu-ui/kniu-select/kniu-select.css?module';
import RADIO_CSS from './kniu-ui/kniu-radio-group/kniu-radio-group.css?module';
import PAGE_CSS from './kniu-ui/kniu-page/kniu-page.css?module';
import IMAGE_CSS from './kniu-ui/kniu-image/kniu-image.css?module';
import IMAGE_OVERRIDES_CSS from './kniu-ui/kniu-image/kniu-image.overrides.css?module';
import INPUT_CSS from './kniu-ui/kniu-input/kniu-input.css?module';
import INPUT_STATES_CSS from './kniu-ui/kniu-input/kniu-input.states.css?module';
import INPUT_AFFIX_CSS from './kniu-ui/kniu-input/kniu-input.affix.css?module';
import INPUT_PASSWORD_CSS from './kniu-ui/kniu-input/kniu-input.password.css?module';
import INPUT_TEXTAREA_CSS from './kniu-ui/kniu-input/kniu-input.textarea.css?module';
import INPUT_METRICS_CSS from './kniu-ui/kniu-input/kniu-input.metrics.css?module';
import INPUT_GROUP_CSS from './kniu-ui/kniu-input/kniu-input-group.css?module';
import INPUT_PASSWORD_ACTIONS_CSS from './kniu-ui/kniu-input/kniu-input.password-actions.css?module';
import INPUT_TIP_CSS from './kniu-ui/kniu-input/kniu-input.tip.css?module';
import DATE_CSS from './kniu-ui/kniu-date-picker/kniu-date-picker.css?module';
import DATE_OVERRIDES_CSS from './kniu-ui/kniu-date-picker/kniu-date-picker.overrides.css?module';
import UPLOAD_CSS from './kniu-ui/kniu-upload/kniu-upload.css?module';
import ICON_CSS from './kniu-ui/kniu-icon/kniu-icon.css?module';
import TAB_CSS from './kniu-ui/kniu-tab/kniu-tab.css?module';
import EDITOR_CSS from './kniu-ui/kniu-editor/kniu-editor.css?module';
import EDITOR_OVERRIDE_CSS from './kniu-ui/kniu-editor/kniu-editor.overrides.css?module';
import EDITOR_PRINT_CSS from './kniu-ui/kniu-editor/kniu-editor.print.css?module';
import NAVBAR_CSS from './kniu-ui/kniu-navbar/kniu-navbar.css?module';
import NAVBAR_CELLS_CSS from './kniu-ui/kniu-navbar/kniu-navbar-cells.css?module';
import NAVBAR_CELL_CSS from './kniu-ui/kniu-navbar/kniu-navbar-cell.css?module';
import SUB_NAVBAR_CSS from './kniu-ui/kniu-navbar/kniu-sub-navbar.css?module';
import SUB_NAVBAR_OVERRIDES_CSS from './kniu-ui/kniu-navbar/kniu-sub-navbar.overrides.css?module';
import BACKTOP_CSS from './kniu-ui/kniu-backtop/kniu-backtop.css?module';
import LIKE_CSS from './kniu-ui/kniu-like/kniu-like.css?module';
import USER_LOGIN_CSS from './kniu-ui/kniu-user-login/kniu-user-login.css?module';
import USER_LOGIN_OVERRIDES_CSS from './kniu-ui/kniu-user-login/kniu-user-login.overrides.css?module';
import ARTICLE_TAB_CSS from './kniu-ui/kniu-article-tab/kniu-article-tab.css?module';
import ARTICLE_TAB_RENDER_CSS from './kniu-ui/kniu-article-tab/kniu-article-tab.render.css?module';

const registry = [
  ['kniu-badge', Badge.registerBadge, { KNIU_BADGE_CSS: BADGE_CSS }],
  ['kniu-tag', Tag.registerTag, { KNIU_TAG_CSS: TAG_CSS }],
  ['kniu-status', Status.registerStatus, { KNIU_STATUS_CSS: STATUS_CSS }],
  ['kniu-empty', Empty.registerEmpty, { KNIU_EMPTY_CSS: EMPTY_CSS }],
  ['kniu-btn', Button.registerButton],
  ['kniu-btn-group', ButtonGroup.registerButtonGroup],
  ['kniu-switch', Switch.registerSwitch],
  ['kniu-modal', Modal.registerModal],
  ['kniu-table', Table.registerTable],
  ['kniu-loading', Loading.registerLoading],
  ['kniu-msg', Msg.registerMsg],
  ['kniu-select', Select.registerSelect],
  ['kniu-radio-group', RadioGroup.registerRadioGroup],
  ['kniu-page', Page.registerPage],
  ['kniu-page-more', PageMore.registerPageMore],
  ['kniu-image', Image.registerImage],
  ['kniu-input', Input.registerInput],
  ['kniu-date-picker', DatePicker.registerDatePicker],
  ['kniu-form', Form.registerForm],
  ['kniu-upload', Upload.registerUpload],
  ['kniu-icon', Icon.registerIcon],
  ['kniu-tab', Tab.registerTab],
  ['kniu-editor', Editor.registerEditor],
  ['kniu-navbar', Navbar.registerNavbar],
  ['kniu-backtop', Backtop.registerBacktop],
  ['kniu-comment', Comment.registerComment],
  ['kniu-like', Like.registerLike],
  ['kniu-user-login', UserLogin.registerUserLogin],
  ['kniu-article-tab', ArticleTab.registerArticleTab]
];
const componentCss = { KNIU_BASE_RESET_CSS: BASE_CSS, KNIU_BASE_CONTAIN_CSS: '', KNIU_BASE_FONT_CSS: '', KNIU_BTN_CSS: BTN_CSS, KNIU_BTN_METRICS_CSS: BTN_METRICS_CSS, KNIU_BTN_OVERRIDES_CSS: BTN_OVERRIDES_CSS, KNIU_BTN_GROUP_CSS: BTN_GROUP_CSS, KNIU_SWITCH_CSS: SWITCH_CSS, KNIU_MODAL_CSS: MODAL_CSS, KNIU_MODAL_CONFIRM_CSS: MODAL_CONFIRM_CSS, KNIU_TABLE_CSS: TABLE_CSS, KNIU_TABLE_COL_CSS: TABLE_COL_CSS, KNIU_LOADING_CSS: LOADING_CSS, KNIU_MSG_CSS: MSG_CSS, KNIU_SELECT_CSS: SELECT_CSS, KNIU_RADIO_GROUP_CSS: RADIO_CSS, KNIU_PAGE_CSS: PAGE_CSS, KNIU_IMAGE_CSS: IMAGE_CSS, KNIU_IMAGE_OVERRIDES_CSS: IMAGE_OVERRIDES_CSS, KNIU_INPUT_CSS: INPUT_CSS, KNIU_INPUT_STATES_CSS: INPUT_STATES_CSS, KNIU_INPUT_AFFIX_CSS: INPUT_AFFIX_CSS, KNIU_INPUT_PASSWORD_CSS: INPUT_PASSWORD_CSS, KNIU_INPUT_TEXTAREA_CSS: INPUT_TEXTAREA_CSS, KNIU_INPUT_METRICS_CSS: INPUT_METRICS_CSS, KNIU_INPUT_GROUP_CSS: INPUT_GROUP_CSS, KNIU_DATE_PICKER_CSS: DATE_CSS, KNIU_DATE_PICKER_OVERRIDES_CSS: DATE_OVERRIDES_CSS, KNIU_UPLOAD_CSS: UPLOAD_CSS, KNIU_ICON_CSS: ICON_CSS, KNIU_TAB_CSS: TAB_CSS, KNIU_EDITOR_CSS: EDITOR_CSS, KNIU_EDITOR_OVERRIDE_CSS: EDITOR_OVERRIDE_CSS, KNIU_EDITOR_PRINT_CSS: EDITOR_PRINT_CSS, KNIU_NAVBAR_CSS: NAVBAR_CSS, KNIU_NAVBAR_CELLS_CSS: NAVBAR_CELLS_CSS, KNIU_NAVBAR_CELL_CSS: NAVBAR_CELL_CSS, KNIU_SUB_NAVBAR_CSS: SUB_NAVBAR_CSS, KNIU_SUB_NAVBAR_OVERRIDES_CSS: SUB_NAVBAR_OVERRIDES_CSS, KNIU_BACKTOP_CSS: BACKTOP_CSS, KNIU_LIKE_CSS: LIKE_CSS, KNIU_USER_LOGIN_CSS: USER_LOGIN_CSS, KNIU_USER_LOGIN_OVERRIDES_CSS: USER_LOGIN_OVERRIDES_CSS, KNIU_BADGE_CSS: BADGE_CSS, KNIU_TAG_CSS: TAG_CSS, KNIU_STATUS_CSS: STATUS_CSS, KNIU_EMPTY_CSS: EMPTY_CSS };
Object.assign(componentCss, {
  KNIU_BASE_CONTAIN_CSS: CONTAIN_CSS,
  KNIU_CONTENT_TABLE_CSS: CONTENT_TABLE_CSS,
  KNIU_DROPDOWN_CSS: DROPDOWN_CSS,
  KNIU_DROPDOWN_OPTION_CSS: DROPDOWN_OPTION_CSS,
  KNIU_FONT_FACE_CSS: FONT_FACE_CSS,
  KNIU_MARKDOWN_CSS: MARKDOWN_CSS,
  KNIU_RICHTEXT_CSS: RICHTEXT_CSS,
  KNIU_INPUT_PASSWORD_ACTIONS_CSS: INPUT_PASSWORD_ACTIONS_CSS,
  KNIU_INPUT_TIP_CSS: INPUT_TIP_CSS,
  KNIU_ARTICLE_TAB_CSS: ARTICLE_TAB_CSS,
  KNIU_ARTICLE_TAB_RENDER_CSS: ARTICLE_TAB_RENDER_CSS
});
const registered = new Set();
const customComponents = new Map();
const shadowStyleSheetCache = new Map();
const shadowTemplateCache = new Map();
const SHADOW_TEMPLATE_CACHE_LIMIT = 200;

function supportsAdoptedStyleSheets(root) {
  return typeof CSSStyleSheet !== 'undefined'
    && typeof CSSStyleSheet.prototype.replaceSync === 'function'
    && !!root
    && Array.isArray(root.adoptedStyleSheets)
    && typeof root.adoptedStyleSheets !== 'string';
}

function getSharedStyleSheet(cssText) {
  let sheet = shadowStyleSheetCache.get(cssText);
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(cssText);
    shadowStyleSheetCache.set(cssText, sheet);
  }
  return sheet;
}

function adoptSharedStyle(root, cssText) {
  if (!root || !cssText) return null;
  const css = String(cssText);
  if (supportsAdoptedStyleSheets(root)) {
    const sheet = getSharedStyleSheet(css);
    if (root.adoptedStyleSheets.indexOf(sheet) === -1) {
      root.adoptedStyleSheets = root.adoptedStyleSheets.concat(sheet);
    }
    return sheet;
  }
  const element = (root.ownerDocument || document).createElement('style');
  element.textContent = css;
  root.appendChild(element);
  return element;
}

function getShadowInnerHTMLDescriptor() {
  if (typeof ShadowRoot === 'undefined') return null;
  let prototype = ShadowRoot.prototype;
  while (prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'innerHTML');
    if (descriptor) return descriptor;
    prototype = Object.getPrototypeOf(prototype);
  }
  return null;
}

function getShadowTemplate(structure) {
  let template = shadowTemplateCache.get(structure);
  if (!template) {
    if (shadowTemplateCache.size >= SHADOW_TEMPLATE_CACHE_LIMIT) shadowTemplateCache.clear();
    template = document.createElement('template');
    template.innerHTML = structure;
    shadowTemplateCache.set(structure, template);
  }
  return template;
}

function installShadowInnerHTMLAdapter(root) {
  const descriptor = getShadowInnerHTMLDescriptor();
  if (!descriptor || typeof descriptor.set !== 'function' || root.__kniuInnerHTMLAdapter) return;
  root.__kniuInnerHTMLAdapter = true;
  Object.defineProperty(root, 'innerHTML', {
    configurable: true,
    get: function () { return descriptor.get.call(root); },
    set: function (markup) {
      const html = String(markup == null ? '' : markup);
      let styleText = '';
      const structure = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, function (_, css) {
        styleText += css + '\n';
        return '';
      });
      const stale = root.__kniuFallbackStyles;
      if (stale) {
        stale.forEach(function (element) { element.remove(); });
        root.__kniuFallbackStyles = null;
      }
      root.replaceChildren(getShadowTemplate(structure).content.cloneNode(true));
      if (!styleText) return;
      if (supportsAdoptedStyleSheets(root)) {
        adoptSharedStyle(root, styleText);
        return;
      }
      root.__kniuFallbackStyles = [BASE_CSS, CONTAIN_CSS, styleText]
        .map(function (css) { return adoptSharedStyle(root, css); })
        .filter(Boolean);
    }
  });
}

function attachComponentShadow(host) {
  const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
  installShadowInnerHTMLAdapter(root);
  adoptSharedStyle(root, BASE_CSS);
  adoptSharedStyle(root, CONTAIN_CSS);
  return root;
}

const componentContext = {
  ...componentCss, BOOLEAN_ATTRIBUTES: new Set(['disabled', 'hidden', 'readonly', 'multiple']), IDENTITY: {}, REQUEST: { request: (url, options) => fetch(url, options) }, TEMPLATE: {}, KNIU_I18N: { cn: { 'common.empty': '暂无数据' } }, KNIU_ICON_NAMES: new Set(), KNIU_ICON_SVG: {}, KNIU_ICON_FONT_NAMES: new Set(), KNIU_TABLE_CLASS: 'kniu-table', KNIU_TABLE_WRAP_CLASS: 'kniu-table-wrap', KNIU_CONTAIN_EXCLUDE_TAGS: {}, PRUNABLE_ATTRIBUTE_NAMES: new Set(), SEMANTIC_EMPTY_ATTRIBUTES: new Set(), RICH_TEXT_LITERAL_TAG_RE: /<\/?(?:script|style|iframe)/i, SCROLL_LOCK_FLAG: 'kniu-scroll-lock', state: reactive({ loading: false }), componentDefaults: {}, componentLang: (o) => String(o?.lang || 'cn'), componentText: (_l, k) => k === 'common.empty' ? '暂无数据' : k,
  attachComponentShadow, mountOptionsValue(comp) { if (comp.__kniuOptionsValue) comp.options = comp.__kniuOptionsValue; }, installOptionsOnlyProtocol() { }, deferAffixTemplateMount(fn) { queueMicrotask(fn); }, adoptSharedStyle, adoptDropdownStyle(root) { adoptSharedStyle(root, DROPDOWN_CSS); adoptSharedStyle(root, DROPDOWN_OPTION_CSS); }, appendRawStyle(root, value) { return adoptSharedStyle(root, value); }, normalizeComponentCss(v) { return String(v || ''); }, applyScrollLock() { }, lockDocumentScroll() { }, unlockDocumentScroll() { }, releaseScrollLock() { }, reconcileDocumentScrollLock() { }, readScrollLockOriginals() { }, writeScrollLockOriginals() { }, trackPopoverPosition() { }, mountPopoverPortal(_panel, node) { document.body.append(node); }, mountAffixSlots() { }, buildIconElement(name) { return `<kniu-icon icon="${String(name || '')}"></kniu-icon>`; }, resolveIconName(name) { return String(name || ''); }, buildPageList({ page = 1, total = 1 } = {}) { return Array.from({ length: Math.max(1, total) }, (_, i) => i + 1); }, replaceChildrenWithFragment(node, fragment) { node.replaceChildren(fragment); }, createTable() { return document.createElement('table'); }, setLoading(v) { componentContext.state.loading = !!v; }, msg() { }, confirm(message) { return Promise.resolve(globalThis.confirm ? globalThis.confirm(message) : true); }, sanitizeRichHtml(v) { return String(v ?? ''); }, sanitizeRichHtmlAsync(v) { return Promise.resolve(String(v ?? '')); }, hasRichTextLiteralTag() { return false; }, getResponseRecords(v) { return v?.records || v; }, debounce(fn, wait = 0) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); }; }, usePage() { }, usePagination() { }, unwrapTablesIn() { }, wrapTablesIn() { }, installMarkdownStyles() { }, installRichTextStyles() { }, isEmptyAttributeValue(v) { return v == null || v === ''; }, pruneEmptyAttribute() { }, pruneEmptyAttributeTree() { }, pruneEmptyAttributes() { }, resolveTableRowTemplate() { }, compileTableRowTemplate() { }, createRowDeleteHandler() { }, createSearchActions() { }, getSharedStyleSheet, getShadowInnerHTMLDescriptor, flushPendingAdoptedSheets() { }, scheduleAdoptedSheetsFlush() { }, supportsAdoptedStyleSheets, tableTemplateCache: new Map(), shadowTemplateCache, shadowStyleSheetCache, normalizedCssCache: new Map(), pendingAdoptedSheets: new Map(), scrollLockNodes: new Set(), scrollLockOwners: new Set(), shadowInnerHTMLDescriptor: null, adoptedSheetsFlushScheduled: false, toastInstance: null, toastTimer: null, SHADOW_TEMPLATE_CACHE_LIMIT: 200, TABLE_TEMPLATE_CACHE_LIMIT: 200, TABLE_TEMPLATE_RE: /$^/, shouldContainHost() { return true; }
};

function register(tag) {
  if (registered.has(tag) || typeof customElements === 'undefined') return;
  const entry = registry.find(([name]) => name === tag);
  if (!entry || typeof entry[1] !== 'function') return;
  entry[1]({ ...componentContext, ...(entry[2] || {}) });
  registered.add(tag);
}

export async function load(root = document) {
  const tags = new Set([...root.querySelectorAll('*')].map((element) => element.localName));
  registry.forEach(([tag]) => {
    if (tags.has(tag)) register(tag);
  });
  const customTags = [...tags].filter((tag) => (
    tag.includes('-') && !tag.startsWith('kniu-') && !customElements.get(tag)
  ));
  await Promise.all(customTags.map((tag) => import(`../custom/${tag}/${tag}.mjs`)));
  customTags.forEach((tag) => {
    root.querySelectorAll(tag).forEach((element) => {
      if (!element.shadowRoot) {
        throw new Error(`[Kniu component] ${tag} 必须通过 COMPONENT.use 使用 Shadow DOM 渲染。`);
      }
    });
  });
}

function use(spec = {}) {
  const { tag, style = '', template = '', setup } = spec;
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(tag || '') || typeof setup !== 'function') {
    throw new TypeError('COMPONENT.use requires a valid tag and setup(ctx)');
  }
  if (customElements.get(tag)) return customComponents.get(tag);

  class KniuCustom extends HTMLElement {
    connectedCallback() {
      if (this._mounted) return;
      this._mounted = true;
      this.setAttribute('data-kniu-shadow', '');
      const shadowRoot = componentContext.attachComponentShadow(this);
      if (style) {
        componentContext.adoptSharedStyle(shadowRoot, style);
      }
      const ctx = {
        host: this,
        root: shadowRoot,
        reactive,
        emit: (name, detail) => this.dispatchEvent(new CustomEvent(name, {
          detail,
          bubbles: true,
          composed: true
        })),
        onBeforeMount: (callback) => callback?.(this),
        onMounted: (callback) => queueMicrotask(() => callback?.(this, shadowRoot)),
        onUnmounted: (callback) => { this._onUnmounted = callback; }
      };
      const bindings = setup(ctx) || {};
      const state = bindings.state || bindings;
      this._render = () => {
        const content = String(template).replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expression) => {
          return evaluateTemplateExpression(expression, state) ?? '';
        });
        shadowRoot.innerHTML = content;
      };
      this._render();
      this._effect = effect(this._render);
    }

    disconnectedCallback() {
      this._onUnmounted?.(this);
      this._effect?.stop?.();
      this._mounted = false;
    }
  }

  customElements.define(tag, KniuCustom);
  const value = Object.freeze({ tag });
  customComponents.set(tag, value);
  return value;
}
const COMPONENT = Object.freeze({ use });
export default COMPONENT;