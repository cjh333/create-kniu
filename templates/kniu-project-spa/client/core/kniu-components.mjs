import { getContracts, configureI18n, DEFAULT_FONT_FAMILY, limitValue } from './Kniu-Contracts.mjs';
import { KNIU_I18N, lookupComponentText } from './Kniu-I18nData.mjs';
import { localizeMarkup } from './Kniu-UiText.mjs';
import {
  isTagEnabled, isBusinessTagEnabled, configureComponentRegistry, getEnabledTags,
  getComponentManifest, resetComponentRegistry,
  CORE_COMPONENT_TAGS, BUSINESS_COMPONENT_TAGS
} from './Kniu-ComponentManifest.mjs';
import { reactive, effect, computed, watch, nextTick } from './Kniu-MVVM.mjs';
import { identity } from './Kniu-IdentityService.mjs';
import { evaluateTemplateExpression } from './Kniu-TemplateEngine.mjs';
import { escapeAttribute, createLruCache } from './Kniu-Util.mjs';
import * as Badge from './Kniu-Ui/Kniu-BadgeComponent/Kniu-BadgeComponent.mjs';
import * as RouterView from './Kniu-Ui/Kniu-RouterViewComponent/Kniu-RouterViewComponent.mjs';
import * as VList from './Kniu-Ui/Kniu-VListComponent/Kniu-VListComponent.mjs';
import * as Tag from './Kniu-Ui/Kniu-TagComponent/Kniu-TagComponent.mjs';
import * as Status from './Kniu-Ui/Kniu-StatusComponent/Kniu-StatusComponent.mjs';
import * as Empty from './Kniu-Ui/Kniu-EmptyComponent/Kniu-EmptyComponent.mjs';
import * as Button from './Kniu-Ui/Kniu-BtnComponent/Kniu-BtnComponent.mjs';
import * as ButtonGroup from './Kniu-Ui/Kniu-BtnGroupComponent/Kniu-BtnGroupComponent.mjs';
import * as Switch from './Kniu-Ui/Kniu-SwitchComponent/Kniu-SwitchComponent.mjs';
import * as Modal from './Kniu-Ui/Kniu-ModalComponent/Kniu-ModalComponent.mjs';
import * as Table from './Kniu-Ui/Kniu-TableComponent/Kniu-TableComponent.mjs';
import * as Msg from './Kniu-Ui/Kniu-MsgComponent/Kniu-MsgComponent.mjs';
import * as Select from './Kniu-Ui/Kniu-SelectComponent/Kniu-SelectComponent.mjs';
import * as RadioGroup from './Kniu-Ui/Kniu-RadioGroupComponent/Kniu-RadioGroupComponent.mjs';
import * as Page from './Kniu-Ui/Kniu-PageComponent/Kniu-PageComponent.mjs';
import * as PageMore from './Kniu-Ui/Kniu-PageMoreComponent/Kniu-PageMoreComponent.mjs';
import * as Image from './Kniu-Ui/Kniu-ImageComponent/Kniu-ImageComponent.mjs';
import * as Input from './Kniu-Ui/Kniu-InputComponent/Kniu-InputComponent.mjs';
import * as SmsVcode from './Kniu-Ui/Kniu-SmsvcodeComponent/Kniu-SmsvcodeComponent.mjs';
import * as Gvcode from './Kniu-Ui/Kniu-GvcodeComponent/Kniu-GvcodeComponent.mjs';
import * as AuthLayout from './Kniu-Ui/Kniu-AuthLayoutComponent/Kniu-AuthLayoutComponent.mjs';
import * as DatePicker from './Kniu-Ui/Kniu-DatePickerComponent/Kniu-DatePickerComponent.mjs';
import * as Form from './Kniu-Ui/Kniu-FormComponent/Kniu-FormComponent.mjs';
import * as Upload from './Kniu-Ui/Kniu-UploadComponent/Kniu-UploadComponent.mjs';
import * as Icon from './Kniu-Ui/Kniu-IconComponent/Kniu-IconComponent.mjs';
import * as Tab from './Kniu-Ui/Kniu-TabComponent/Kniu-TabComponent.mjs';
import * as Editor from './Kniu-Ui/Kniu-EditorComponent/Kniu-EditorComponent.mjs';
import * as Navbar from './Kniu-Ui/Kniu-NavbarComponent/Kniu-NavbarComponent.mjs';
import * as Backtop from './Kniu-Ui/Kniu-BacktopComponent/Kniu-BacktopComponent.mjs';
import * as Comment from './Kniu-Ui/Kniu-CommentComponent/Kniu-CommentComponent.mjs';
import * as Like from './Kniu-Ui/Kniu-LikeComponent/Kniu-LikeComponent.mjs';
import * as UserLogin from './Kniu-Ui/Kniu-UserLoginComponent/Kniu-UserLoginComponent.mjs';
import * as ArticleTab from './Kniu-Ui/Kniu-ArticleTabComponent/Kniu-ArticleTabComponent.mjs';
import { KNIU_ICON_NAMES } from './Kniu-IconNames.mjs';
import { getThemeStyleSheet } from './Kniu-Runtime.mjs';
import { scopeGet } from './Kniu-Scope.mjs';
import BASE_CSS from './Kniu-Ui/Kniu-Other/Kniu-Base.css?module';
import CONTAIN_CSS from './Kniu-Ui/Kniu-Other/Kniu-Contain.css?module';
import CONTENT_TABLE_CSS from './Kniu-Ui/Kniu-Other/Kniu-ContentTable.css?module';
import DROPDOWN_CSS from './Kniu-Ui/Kniu-Other/Kniu-Dropdown.css?module';
import DROPDOWN_OPTION_CSS from './Kniu-Ui/Kniu-Other/Kniu-Dropdown.Option.css?module';
import FONT_FACE_CSS from './Kniu-Ui/Kniu-Other/Kniu-Fontface.css?module';
import MARKDOWN_CSS from './Kniu-Ui/Kniu-Other/Kniu-Markdown.css?module';
import RICHTEXT_CSS from './Kniu-Ui/Kniu-Other/Kniu-Richtext.css?module';
import BADGE_CSS from './Kniu-Ui/Kniu-BadgeComponent/Kniu-BadgeComponent.css?module';
import TAG_CSS from './Kniu-Ui/Kniu-TagComponent/Kniu-TagComponent.css?module';
import STATUS_CSS from './Kniu-Ui/Kniu-StatusComponent/Kniu-StatusComponent.css?module';
import EMPTY_CSS from './Kniu-Ui/Kniu-EmptyComponent/Kniu-EmptyComponent.css?module';
import BTN_CSS from './Kniu-Ui/Kniu-BtnComponent/Kniu-BtnComponent.css?module';
import BTN_METRICS_CSS from './Kniu-Ui/Kniu-BtnComponent/Kniu-BtnComponent.Metrics.css?module';
import BTN_OVERRIDES_CSS from './Kniu-Ui/Kniu-BtnComponent/Kniu-BtnComponent.Overrides.css?module';
import BTN_GROUP_CSS from './Kniu-Ui/Kniu-BtnGroupComponent/Kniu-BtnGroupComponent.css?module';
import SWITCH_CSS from './Kniu-Ui/Kniu-SwitchComponent/Kniu-SwitchComponent.css?module';
import MODAL_CSS from './Kniu-Ui/Kniu-ModalComponent/Kniu-ModalComponent.css?module';
import MODAL_CONFIRM_CSS from './Kniu-Ui/Kniu-ModalComponent/Kniu-ModalComponent.Confirm.css?module';
import TABLE_CSS from './Kniu-Ui/Kniu-TableComponent/Kniu-TableComponent.css?module';
import TABLE_COL_CSS from './Kniu-Ui/Kniu-TableColComponent/Kniu-TableColComponent.css?module';
import MSG_CSS from './Kniu-Ui/Kniu-MsgComponent/Kniu-MsgComponent.css?module';
import SELECT_CSS from './Kniu-Ui/Kniu-SelectComponent/Kniu-SelectComponent.css?module';
import RADIO_CSS from './Kniu-Ui/Kniu-RadioGroupComponent/Kniu-RadioGroupComponent.css?module';
import PAGE_CSS from './Kniu-Ui/Kniu-PageComponent/Kniu-PageComponent.css?module';
import IMAGE_CSS from './Kniu-Ui/Kniu-ImageComponent/Kniu-ImageComponent.css?module';
import IMAGE_OVERRIDES_CSS from './Kniu-Ui/Kniu-ImageComponent/Kniu-ImageComponent.Overrides.css?module';
import INPUT_CSS from './Kniu-Ui/Kniu-InputComponent/Kniu-InputComponent.css?module';
import INPUT_STATES_CSS from './Kniu-Ui/Kniu-InputComponent/Kniu-InputComponent.States.css?module';
import INPUT_AFFIX_CSS from './Kniu-Ui/Kniu-InputComponent/Kniu-InputComponent.Affix.css?module';
import INPUT_PASSWORD_CSS from './Kniu-Ui/Kniu-InputComponent/Kniu-InputComponent.Password.css?module';
import INPUT_TEXTAREA_CSS from './Kniu-Ui/Kniu-InputComponent/Kniu-InputComponent.Textarea.css?module';
import INPUT_METRICS_CSS from './Kniu-Ui/Kniu-InputComponent/Kniu-InputComponent.Metrics.css?module';
import INPUT_GROUP_CSS from './Kniu-Ui/Kniu-InputComponent/Kniu-InputComponent.Group.css?module';
import INPUT_PASSWORD_ACTIONS_CSS from './Kniu-Ui/Kniu-InputComponent/Kniu-InputComponent.Password.Actions.css?module';
import INPUT_TIP_CSS from './Kniu-Ui/Kniu-InputComponent/Kniu-InputComponent.Tip.css?module';
import DATE_CSS from './Kniu-Ui/Kniu-DatePickerComponent/Kniu-DatePickerComponent.css?module';
import DATE_OVERRIDES_CSS from './Kniu-Ui/Kniu-DatePickerComponent/Kniu-DatePickerComponent.Overrides.css?module';
import UPLOAD_CSS from './Kniu-Ui/Kniu-UploadComponent/Kniu-UploadComponent.css?module';
import ICON_CSS from './Kniu-Ui/Kniu-IconComponent/Kniu-IconComponent.css?module';
import TAB_CSS from './Kniu-Ui/Kniu-TabComponent/Kniu-TabComponent.css?module';
import EDITOR_CSS from './Kniu-Ui/Kniu-EditorComponent/Kniu-EditorComponent.css?module';
import EDITOR_OVERRIDE_CSS from './Kniu-Ui/Kniu-EditorComponent/Kniu-EditorComponent.Overrides.css?module';
import EDITOR_PRINT_CSS from './Kniu-Ui/Kniu-EditorComponent/Kniu-EditorComponent.Print.css?module';
import NAVBAR_CSS from './Kniu-Ui/Kniu-NavbarComponent/Kniu-NavbarComponent.css?module';
import NAVBAR_CELLS_CSS from './Kniu-Ui/Kniu-NavbarCellsComponent/Kniu-NavbarCellsComponent.css?module';
import NAVBAR_CELL_CSS from './Kniu-Ui/Kniu-NavbarCellComponent/Kniu-NavbarCellComponent.css?module';
import SUB_NAVBAR_CSS from './Kniu-Ui/Kniu-SubNavbarComponent/Kniu-SubNavbarComponent.css?module';
import SUB_NAVBAR_OVERRIDES_CSS from './Kniu-Ui/Kniu-SubNavbarComponent/Kniu-SubNavbarComponent.Overrides.css?module';
import BACKTOP_CSS from './Kniu-Ui/Kniu-BacktopComponent/Kniu-BacktopComponent.css?module';
import LIKE_CSS from './Kniu-Ui/Kniu-LikeComponent/Kniu-LikeComponent.css?module';
import USER_LOGIN_CSS from './Kniu-Ui/Kniu-UserLoginComponent/Kniu-UserLoginComponent.css?module';
import USER_LOGIN_OVERRIDES_CSS from './Kniu-Ui/Kniu-UserLoginComponent/Kniu-UserLoginComponent.Overrides.css?module';
import ARTICLE_TAB_CSS from './Kniu-Ui/Kniu-ArticleTabComponent/Kniu-ArticleTabComponent.css?module';
import ARTICLE_TAB_RENDER_CSS from './Kniu-Ui/Kniu-ArticleTabComponent/Kniu-ArticleTabComponent.Render.css?module';
import COMMENT_CSS from './Kniu-Ui/Kniu-CommentComponent/Kniu-CommentComponent.css?module';
import NAVBAR_PLACEHOLDER_CSS from './Kniu-Ui/Kniu-NavbarComponent/Kniu-NavbarComponent.Placeholder.css?module';
import ROUTER_VIEW_CSS from './Kniu-Ui/Kniu-RouterViewComponent/Kniu-RouterViewComponent.css?module';

const registry = [
  ['kniu-router-view', RouterView.registerRouterView, { KNIU_ROUTER_VIEW_CSS: ROUTER_VIEW_CSS }],
  ['kniu-badge', Badge.registerBadge, { KNIU_BADGE_CSS: BADGE_CSS }],
  ['kniu-vlist', VList.registerVList],
  ['kniu-tag', Tag.registerTag, { KNIU_TAG_CSS: TAG_CSS }],
  ['kniu-status', Status.registerStatus, { KNIU_STATUS_CSS: STATUS_CSS }],
  ['kniu-empty', Empty.registerEmpty, { KNIU_EMPTY_CSS: EMPTY_CSS }],
  ['kniu-btn', Button.registerButton],
  ['kniu-btn-group', ButtonGroup.registerButtonGroup],
  ['kniu-switch', Switch.registerSwitch],
  ['kniu-modal', Modal.registerModal],
  ['kniu-table', Table.registerTable],
  ['kniu-msg', Msg.registerMsg],
  ['kniu-select', Select.registerSelect],
  ['kniu-radio-group', RadioGroup.registerRadioGroup],
  ['kniu-page', Page.registerPage],
  ['kniu-page-more', PageMore.registerPageMore],
  ['kniu-image', Image.registerImage],
  ['kniu-input', Input.registerInput],
  ['kniu-smsvcode', SmsVcode.registerSmsVcode],
  ['kniu-gvcode', Gvcode.registerGvcode],
  ['kniu-auth-layout', AuthLayout.registerAuthLayout],
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
const componentCss = { KNIU_BASE_RESET_CSS: BASE_CSS, KNIU_BASE_CONTAIN_CSS: '', KNIU_BASE_FONT_CSS: '', KNIU_BTN_CSS: BTN_CSS, KNIU_BTN_METRICS_CSS: BTN_METRICS_CSS, KNIU_BTN_OVERRIDES_CSS: BTN_OVERRIDES_CSS, KNIU_BTN_GROUP_CSS: BTN_GROUP_CSS, KNIU_SWITCH_CSS: SWITCH_CSS, KNIU_MODAL_CSS: MODAL_CSS, KNIU_MODAL_CONFIRM_CSS: MODAL_CONFIRM_CSS, KNIU_TABLE_CSS: TABLE_CSS, KNIU_TABLE_COL_CSS: TABLE_COL_CSS, KNIU_MSG_CSS: MSG_CSS, KNIU_SELECT_CSS: SELECT_CSS, KNIU_RADIO_GROUP_CSS: RADIO_CSS, KNIU_PAGE_CSS: PAGE_CSS, KNIU_IMAGE_CSS: IMAGE_CSS, KNIU_IMAGE_OVERRIDES_CSS: IMAGE_OVERRIDES_CSS, KNIU_INPUT_CSS: INPUT_CSS, KNIU_INPUT_STATES_CSS: INPUT_STATES_CSS, KNIU_INPUT_AFFIX_CSS: INPUT_AFFIX_CSS, KNIU_INPUT_PASSWORD_CSS: INPUT_PASSWORD_CSS, KNIU_INPUT_TEXTAREA_CSS: INPUT_TEXTAREA_CSS, KNIU_INPUT_METRICS_CSS: INPUT_METRICS_CSS, KNIU_INPUT_GROUP_CSS: INPUT_GROUP_CSS, KNIU_DATE_PICKER_CSS: DATE_CSS, KNIU_DATE_PICKER_OVERRIDES_CSS: DATE_OVERRIDES_CSS, KNIU_UPLOAD_CSS: UPLOAD_CSS, KNIU_ICON_CSS: ICON_CSS, KNIU_TAB_CSS: TAB_CSS, KNIU_EDITOR_CSS: EDITOR_CSS, KNIU_EDITOR_OVERRIDE_CSS: EDITOR_OVERRIDE_CSS, KNIU_EDITOR_PRINT_CSS: EDITOR_PRINT_CSS, KNIU_NAVBAR_CSS: NAVBAR_CSS, KNIU_NAVBAR_CELLS_CSS: NAVBAR_CELLS_CSS, KNIU_NAVBAR_CELL_CSS: NAVBAR_CELL_CSS, KNIU_SUB_NAVBAR_CSS: SUB_NAVBAR_CSS, KNIU_SUB_NAVBAR_OVERRIDES_CSS: SUB_NAVBAR_OVERRIDES_CSS, KNIU_BACKTOP_CSS: BACKTOP_CSS, KNIU_LIKE_CSS: LIKE_CSS, KNIU_USER_LOGIN_CSS: USER_LOGIN_CSS, KNIU_USER_LOGIN_OVERRIDES_CSS: USER_LOGIN_OVERRIDES_CSS, KNIU_BADGE_CSS: BADGE_CSS, KNIU_TAG_CSS: TAG_CSS, KNIU_STATUS_CSS: STATUS_CSS, KNIU_EMPTY_CSS: EMPTY_CSS, KNIU_COMMENT_CSS: COMMENT_CSS, KNIU_NAVBAR_PLACEHOLDER_CSS: NAVBAR_PLACEHOLDER_CSS };
function componentHostFontCss() {
  const font = String(getContracts().theme?.fontFamily || DEFAULT_FONT_FAMILY);
  return `:host{font-family:var(--kniu-font-family,"${font}")}`;
}
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
const injectedCustomPath = scopeGet('__KNIU_CUSTOM_PATH__');
const customComponentsPath = (typeof injectedCustomPath === 'string' && injectedCustomPath)
  ? injectedCustomPath.replace(/[/\\]+$/, '')
  : getContracts().paths.customComponents;

function customComponentName(tag) {
  const pascal = String(tag)
    .split('-')
    .filter(Boolean)
    .map(function (part) { return part.charAt(0).toUpperCase() + part.slice(1); })
    .join('');
  return pascal + 'Component';
}

function customComponentUrl(tag) {
  const name = customComponentName(tag);
  return customComponentsPath + '/' + name + '/' + name + '.mjs';
}

const SHADOW_TEMPLATE_CACHE_LIMIT = 200;
const shadowStyleSheetCache = createLruCache(SHADOW_TEMPLATE_CACHE_LIMIT);
const shadowTemplateCache = createLruCache(SHADOW_TEMPLATE_CACHE_LIMIT);

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
    template = document.createElement('template');
    template.innerHTML = structure;
    shadowTemplateCache.set(structure, template);
  }
  return template;
}

function installShadowInnerHTMLAdapter(root, host) {
  const descriptor = getShadowInnerHTMLDescriptor();
  if (!descriptor || typeof descriptor.set !== 'function' || root.__kniuInnerHTMLAdapter) return;
  root.__kniuInnerHTMLAdapter = true;
  Object.defineProperty(root, 'innerHTML', {
    configurable: true,
    get: function () { return descriptor.get.call(root); },
    set: function (markup) {
      const lang = host?.getAttribute?.('lang') || host?.lang || 'cn';
      const html = localizeMarkup(String(markup == null ? '' : markup), lang);
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
      root.__kniuFallbackStyles = [BASE_CSS, host?.__kniuSkipContain ? '' : CONTAIN_CSS, styleText]
        .map(function (css) { return adoptSharedStyle(root, css); })
        .filter(Boolean);
    }
  });
}

function attachComponentShadow(host, options = {}) {
  const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
  installShadowInnerHTMLAdapter(root, host);
  if (options.contain === false) host.__kniuSkipContain = true;
  adoptSharedStyle(root, BASE_CSS);
  if (!host.__kniuSkipContain) adoptSharedStyle(root, CONTAIN_CSS);
  adoptSharedStyle(root, componentHostFontCss());
  const themeSheet = getThemeStyleSheet();
  if (themeSheet && supportsAdoptedStyleSheets(root) && root.adoptedStyleSheets.indexOf(themeSheet) === -1) {
    root.adoptedStyleSheets = root.adoptedStyleSheets.concat(themeSheet);
  }
  return root;
}

function installOptionsOnlyProtocol(tagName) {
  const Constructor = globalThis.customElements?.get(tagName);
  const prototype = Constructor?.prototype;
  if (!prototype || Object.prototype.hasOwnProperty.call(prototype, 'options')) return;
  const allowed = new Set((Constructor.observedAttributes || []).map(String));
  Object.defineProperty(prototype, 'options', {
    configurable: true,
    get: function () { return this.__kniuOptionsValue || {}; },
    set: function (value) {
      const options = value && typeof value === 'object' ? value : {};
      this.__kniuOptionsValue = options;
      Object.entries(options).forEach(([key, item]) => {
        if (typeof item === 'function') return;
        const attribute = key.replace(/[A-Z]/g, (char) => '-' + char.toLowerCase());
        if (!allowed.has(attribute)) return;
        if (item === true) this.setAttribute(attribute, '');
        else if (item === false || item == null) this.removeAttribute(attribute);
        else this.setAttribute(attribute, String(item));
      });
    }
  });
}

function computePopoverLayout(panel, anchorRect, options) {
  const config = options || {};
  const offset = config.offset == null ? 6 : config.offset;
  const viewportWidth = Math.max(0, Number(globalThis.innerWidth) || document.documentElement?.clientWidth || 0);
  const viewportHeight = Math.max(0, Number(globalThis.innerHeight) || document.documentElement?.clientHeight || 0);
  const panelWidth = (panel && panel.offsetWidth) || config.width || 0;
  const panelHeight = (panel && panel.offsetHeight) || config.height || 0;
  const width = Math.min(panelWidth, Math.max(0, viewportWidth - 16));
  const left = Math.max(8, Math.min(anchorRect.left, viewportWidth - width - 8));
  const placement = viewportHeight - anchorRect.bottom - 8 < panelHeight && anchorRect.top - 8 >= panelHeight
    ? 'top'
    : 'bottom';
  return {
    placement,
    left,
    top: placement === 'top' ? anchorRect.top - panelHeight - offset : anchorRect.bottom + offset,
    width,
    height: panelHeight
  };
}

function mountPopoverPortal(panel, hostRoot, options = {}) {
  if (!panel || !hostRoot || !document.body) return null;
  if (panel.__kniuPortalState?.portal?.isConnected) return panel.__kniuPortalState;
  panel.__kniuPortalState?.unmount();

  const portal = document.createElement('span');
  const homeParent = panel.parentNode;
  const homeMarker = document.createComment('kniu-popover-home');
  if (homeParent) homeParent.insertBefore(homeMarker, panel);
  portal.setAttribute(options.attribute || 'data-kniu-popover', '');
  portal.style.cssText = `position:fixed;inset:0;display:block;width:0;height:0;pointer-events:none;z-index:${options.zIndex ?? 10030}`;
  const root = portal.attachShadow({ mode: 'open' });
  if (supportsAdoptedStyleSheets(hostRoot) && hostRoot.adoptedStyleSheets.length) {
    root.adoptedStyleSheets = hostRoot.adoptedStyleSheets.slice();
  } else {
    hostRoot.querySelectorAll('style').forEach((style) => root.append(style.cloneNode(true)));
  }
  panel.style.pointerEvents = 'auto';
  root.append(panel);
  document.body.append(portal);
  const state = {
    portal,
    root,
    panel,
    unmount() {
      if (homeMarker.parentNode) homeMarker.parentNode.insertBefore(panel, homeMarker);
      else if (homeParent?.isConnected) homeParent.append(panel);
      else hostRoot.append(panel);
      homeMarker.remove();
      portal.remove();
      if (panel.__kniuPortalState === state) panel.__kniuPortalState = null;
    }
  };
  panel.__kniuPortalState = state;
  return state;
}

let toastTimer = null;
let toastInstance = null;
function showMsg(options) {
  const config = options && typeof options === 'object' ? options : { content: options };
  const content = config.content;
  const type = ['success', 'warning', 'info', 'error'].includes(config.type) ? config.type : 'info';
  if (typeof document === 'undefined' || !document.body) return { close: function () { } };
  if (toastTimer) clearTimeout(toastTimer);
  if (toastInstance) toastInstance.remove();
  register('kniu-msg');
  const toast = document.createElement('kniu-msg');
  toast.message = content == null ? '' : String(content);
  toast.type = type;
  toast.position = config.position;
  toast.visible = false;
  document.body.append(toast);
  toastInstance = toast;
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      if (toastInstance === toast && toast.isConnected) toast.visible = true;
    });
  });
  const close = function () {
    if (toastInstance !== toast) return;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = null;
    toast.visible = false;
    toastInstance = null;
    setTimeout(function () { toast.remove(); }, 250);
  };
  const configuredDuration = Number(config.duration);
  const duration = config.duration == null || !Number.isFinite(configuredDuration) ? 2600 : Math.max(0, configuredDuration);
  if (duration > 0) toastTimer = setTimeout(close, duration);
  return { close: close };
}

let iconSvgData = null;
let iconSvgPending = null;
function loadIconSvg() {
  if (iconSvgData) return Promise.resolve(iconSvgData);
  if (!iconSvgPending) {
    iconSvgPending = import('./Kniu-Icons.mjs')
      .then((mod) => {
        iconSvgData = mod.KNIU_ICONS;
        return iconSvgData;
      })
      .catch((error) => {
        iconSvgPending = null;
        console.error('[kniu] 图标数据加载失败', error);
        return {};
      });
  }
  return iconSvgPending;
}

const componentContext = {
  ...componentCss, BOOLEAN_ATTRIBUTES: new Set(['disabled', 'hidden', 'readonly', 'multiple']), IDENTITY: identity, REQUEST: { request: (url, options) => fetch(url, options) }, TEMPLATE: {}, KNIU_I18N: KNIU_I18N, KNIU_ICON_NAMES: new Set(KNIU_ICON_NAMES), KNIU_ICON_SVG: new Proxy({}, { get(_t, name) { return typeof name === 'string' && iconSvgData ? iconSvgData[name] : ''; }, has(_t, name) { return !!(iconSvgData && iconSvgData[name]); } }), KNIU_ICON_FONT_NAMES: new Set(), loadIconSvg, KNIU_TABLE_CLASS: 'kniu-table', KNIU_TABLE_WRAP_CLASS: 'kniu-table-wrap', KNIU_CONTAIN_EXCLUDE_TAGS: {}, PRUNABLE_ATTRIBUTE_NAMES: new Set(), SEMANTIC_EMPTY_ATTRIBUTES: new Set(), RICH_TEXT_LITERAL_TAG_RE: /<\/?(?:script|style|iframe)/i, SCROLL_LOCK_FLAG: 'kniu-scroll-lock', state: reactive({ loading: false }), componentLang: (o) => String(o?.lang || 'cn'), componentText: (lang, key, params) => lookupComponentText(String(lang || 'cn').toLowerCase(), key, params),
  attachComponentShadow, mountOptionsValue(comp) { if (comp.__kniuOptionsValue) comp.options = comp.__kniuOptionsValue; }, installOptionsOnlyProtocol() { }, deferAffixTemplateMount(template, mount, done) { const finish = function () { if (typeof mount === 'function') mount(); if (typeof done === 'function') done(); }; const hasPendingOptionAttr = function () { return template.hasAttribute(':option') || template.hasAttribute('kniu:option') || template.hasAttribute('data-kniu-option-keys'); }; if (!hasPendingOptionAttr()) { finish(); return; } if (template.__kniuAffixPending) return; template.__kniuAffixPending = true; template.__kniuAffixDeadline = Date.now() + limitValue('affixTemplateDeadline', 50); const retry = function () { template.__kniuAffixPending = false; if (!template.isConnected) return; const optionsReady = !!template.__kniuOptionsValue; const attrConsumed = !hasPendingOptionAttr(); if (!optionsReady && !attrConsumed && Date.now() <= template.__kniuAffixDeadline) { template.__kniuAffixPending = true; queueMicrotask(retry); return; } finish(); }; queueMicrotask(retry); }, adoptSharedStyle, adoptDropdownStyle(root) { adoptSharedStyle(root, DROPDOWN_CSS); adoptSharedStyle(root, DROPDOWN_OPTION_CSS); }, appendRawStyle(root, value) { return adoptSharedStyle(root, value); }, normalizeComponentCss(v) { return String(v || ''); }, applyScrollLock() { }, lockDocumentScroll() { }, unlockDocumentScroll() { }, releaseScrollLock() { }, reconcileDocumentScrollLock() { }, readScrollLockOriginals() { }, writeScrollLockOriginals() { }, trackPopoverPosition() { }, mountPopoverPortal, computePopoverLayout, mountAffixSlots() { }, buildIconElement(name) { return `<kniu-icon icon="${escapeAttribute(name)}"></kniu-icon>`; }, resolveIconName(name) { return String(name || ''); }, buildPageList({ page = 1, total = 1 } = {}) { return Array.from({ length: Math.max(1, total) }, (_, i) => i + 1); }, replaceChildrenWithFragment(node, nodes) { const doc = node.ownerDocument || document; const frag = doc.createDocumentFragment(); Array.from(nodes || []).forEach((child) => { if (child) frag.appendChild(child); }); node.replaceChildren(frag); }, createTable() { throw new Error('[kniu] Complete UI runtime must register Kniu-Table before the modular registry.'); }, msg: showMsg, confirm(message) { const ok = globalThis.confirm ? globalThis.confirm(message) : true; return ok ? Promise.resolve(true) : Promise.reject(new Error('cancelled')); }, sanitizeRichHtml(v) { return String(v ?? ''); }, sanitizeRichHtmlAsync(v) { return Promise.resolve(String(v ?? '')); }, hasRichTextLiteralTag() { return false; }, getResponseRecords(v) { return v?.records || v; }, debounce(fn, wait = 0) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); }; }, usePage() { }, usePagination() { }, unwrapTablesIn() { }, wrapTablesIn() { }, installMarkdownStyles() { }, installRichTextStyles() { }, isEmptyAttributeValue(v) { return v == null || v === ''; }, pruneEmptyAttribute() { }, pruneEmptyAttributeTree() { }, pruneEmptyAttributes() { }, resolveTableRowTemplate() { }, compileTableRowTemplate() { }, createRowDeleteHandler() { }, createSearchActions() { }, getSharedStyleSheet, getShadowInnerHTMLDescriptor, flushPendingAdoptedSheets() { }, scheduleAdoptedSheetsFlush() { }, supportsAdoptedStyleSheets, tableTemplateCache: new Map(), shadowTemplateCache, shadowStyleSheetCache, normalizedCssCache: new Map(), pendingAdoptedSheets: new Map(), scrollLockNodes: new Set(), scrollLockOwners: new Set(), shadowInnerHTMLDescriptor: null, adoptedSheetsFlushScheduled: false, toastInstance: null, toastTimer: null, SHADOW_TEMPLATE_CACHE_LIMIT: 200, TABLE_TEMPLATE_CACHE_LIMIT: 200, TABLE_TEMPLATE_RE: /$^/, shouldContainHost() { return true; }
};

componentContext.installOptionsOnlyProtocol = installOptionsOnlyProtocol;

function register(tag) {
  if (registered.has(tag) || typeof customElements === 'undefined') return;
  if (!isTagEnabled(tag) || !isBusinessTagEnabled(tag)) return;
  const entry = registry.find(([name]) => name === tag);
  if (!entry || typeof entry[1] !== 'function') return;
  const context = { ...componentContext, componentDefaults: scopeGet('__KNIU_UI_DEFAULTS__') || {}, ...(entry[2] || {}) };
  entry[1](context);
  registered.add(tag);
}

const isWellFormedTag = (tag) => /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(tag);

function unresolvedCustomTags(root) {
  const tags = new Set();
  root.querySelectorAll(':not(:defined)').forEach((element) => {
    const tag = element.localName;
    if (tag.includes('-') && !tag.startsWith('kniu-') && isWellFormedTag(tag)) tags.add(tag);
  });
  return [...tags];
}

export async function loadCustomComponents(root = document) {
  const customTags = unresolvedCustomTags(root);
  if (customTags.length) await Promise.all(customTags.map((tag) => import(customComponentUrl(tag))));
  await Promise.all(pendingCustomUses);
  customTags.forEach((tag) => {
    root.querySelectorAll(tag).forEach((element) => {
      if (!element.shadowRoot) {
        throw new Error(`[Kniu component] ${tag} 必须通过 COMPONENT.use 使用 Shadow DOM 渲染。`);
      }
    });
  });
}

export async function load(root = document) {
  const ui = (await import('./Kniu-Ui/Kniu-Ui.mjs')).default;
  ui.registerBusinessComponents?.();
  const tags = new Set([...root.querySelectorAll('*')].map((element) => element.localName));
  if (tags.has('kniu-smsvcode')) {
    tags.add('kniu-input');
    tags.add('kniu-btn');
  }
  if (tags.has('kniu-gvcode')) {
    tags.add('kniu-input');
    tags.add('kniu-image');
  }
  registry.forEach(([tag]) => {
    if (tags.has(tag)) register(tag);
  });
  await loadCustomComponents(root);
}

export async function preload() {
  const ui = (await import('./Kniu-Ui/Kniu-Ui.mjs')).default;
  ui.registerBusinessComponents?.();
  registry.forEach(([tag]) => register(tag));
  await Promise.all(pendingCustomUses);
}

const pendingCustomUses = [];

async function use(spec = {}) {
  const tag = spec && spec.tag;
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(tag || '') || typeof spec.setup !== 'function') {
    throw new TypeError('COMPONENT.use requires a valid tag and setup(ctx)');
  }
  if (customElements.get(tag)) return customComponents.get(tag);
  const { default: ui } = await import('./Kniu-Ui/Kniu-Ui.mjs');
  const done = (async () => {
    ui.useComponent(spec);
    if (!customElements.get(tag)) return null;
    const value = Object.freeze({ tag });
    customComponents.set(tag, value);
    return value;
  })();
  pendingCustomUses.push(done);
  done.finally(() => {
    const index = pendingCustomUses.indexOf(done);
    if (index !== -1) pendingCustomUses.splice(index, 1);
  });
  return done;
}
const COMPONENT = Object.freeze({ use });
export default COMPONENT;
export const UI = Object.freeze({
  msg: (options) => showMsg(options),
  confirm: async (message, title, options) => {
    const { default: ui } = await import('./Kniu-Ui/Kniu-Ui.mjs');
    return ui.confirm(message, title, options);
  },
  state: componentContext.state
});
export {
  isTagEnabled, configureComponentRegistry, getEnabledTags,
  getComponentManifest, resetComponentRegistry,
  CORE_COMPONENT_TAGS, BUSINESS_COMPONENT_TAGS,
  customComponentName, customComponentUrl
};
export const configureUiI18n = configureI18n;
export function getRegisteredTags() { return [...registered]; }