import KNIU_SWITCH_TEMPLATE from './kniu-switch.html?module';

export function registerSwitch(context) {
  const { BOOLEAN_ATTRIBUTES, IDENTITY, KNIU_BACKTOP_CSS, KNIU_BADGE_CSS, KNIU_BASE_CONTAIN_CSS, KNIU_BASE_FONT_CSS, KNIU_BTN_CSS, KNIU_BTN_GROUP_CSS, KNIU_BTN_METRICS_CSS, KNIU_BTN_OVERRIDES_CSS, KNIU_COMMENT_CSS, KNIU_CONTAIN_EXCLUDE_TAGS, KNIU_CONTENT_TABLE_CSS, KNIU_CONTENT_TABLE_DOC_CSS, KNIU_DATE_PICKER_CSS, KNIU_DATE_PICKER_OVERRIDES_CSS, KNIU_DROPDOWN_CSS, KNIU_DROPDOWN_OPTION_CSS, KNIU_EDITOR_CSS, KNIU_EDITOR_OVERRIDE_CSS, KNIU_EDITOR_PRINT_CSS, KNIU_EMPTY_CSS, KNIU_FONT_FACE_CSS, KNIU_FONT_FAMILY, KNIU_FONT_MONO_FAMILY, KNIU_FONT_SERIF_FAMILY, KNIU_I18N, KNIU_ICON_CSS, KNIU_ICON_FONT_NAMES, KNIU_ICON_NAMES, KNIU_ICON_SVG, KNIU_IMAGE_CSS, KNIU_IMAGE_OVERRIDES_CSS, KNIU_INPUT_AFFIX_CSS, KNIU_INPUT_CSS, KNIU_INPUT_GROUP_CSS, KNIU_INPUT_METRICS_CSS, KNIU_INPUT_PASSWORD_ACTIONS_CSS, KNIU_INPUT_PASSWORD_CSS, KNIU_INPUT_STATES_CSS, KNIU_INPUT_TEXTAREA_CSS, KNIU_INPUT_TIP_CSS, KNIU_LIKE_CSS, KNIU_LOADING_CSS, KNIU_MARKDOWN_CSS, KNIU_MODAL_CONFIRM_CSS, KNIU_MODAL_CSS, KNIU_MSG_CSS, KNIU_NAVBAR_CELLS_CSS, KNIU_NAVBAR_CELL_CSS, KNIU_NAVBAR_CSS, KNIU_NAVBAR_PLACEHOLDER_CSS, KNIU_PAGE_CSS, KNIU_RADIO_GROUP_CSS, KNIU_RICHTEXT_CSS, KNIU_SELECT_CSS, KNIU_STATUS_CSS, KNIU_SUB_NAVBAR_CSS, KNIU_SUB_NAVBAR_OVERRIDES_CSS, KNIU_SWITCH_CSS, KNIU_TABLE_CLASS, KNIU_TABLE_COL_CSS, KNIU_TABLE_CSS, KNIU_TABLE_WRAP_CLASS, KNIU_TAB_CSS, KNIU_TAG_CSS, KNIU_UPLOAD_CSS, KNIU_USER_LOGIN_CSS, KNIU_USER_LOGIN_OVERRIDES_CSS, PRUNABLE_ATTRIBUTE_NAMES, REQUEST, RICH_TEXT_LITERAL_TAG_RE, SCROLL_LOCK_FLAG, SEMANTIC_EMPTY_ATTRIBUTES, SHADOW_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_RE, TEMPLATE, adoptDropdownStyle, adoptSharedStyle, adoptedSheetsFlushScheduled, appendRawStyle, applyScrollLock, attachComponentShadow, buildIconElement, buildPageList, compileTableRowTemplate, componentDefaults, componentLang, componentText, computePopoverLayout, confirm, createRowDeleteHandler, createSearchActions, createTable, debounce, flushPendingAdoptedSheets, getResponseRecords, getShadowInnerHTMLDescriptor, getSharedStyleSheet, hasRichTextLiteralTag, installMarkdownStyles, installOptionsOnlyProtocol, installRichTextStyles, isEmptyAttributeValue, lockDocumentScroll, makeSwitchOptions, mountAffixSlots, mountPopoverPortal, msg, normalizeComponentCss, normalizedCssCache, pendingAdoptedSheets, pruneEmptyAttribute, pruneEmptyAttributeTree, pruneEmptyAttributes, pruneEmptyRootAttributes, readScrollLockOriginals, reconcileDocumentScrollLock, releaseScrollLock, replaceChildrenWithFragment, resolveIconName, resolveTableRowTemplate, sanitizeRichHtml, sanitizeRichHtmlAsync, scheduleAdoptedSheetsFlush, scrollLockNodes, scrollLockOriginals, scrollLockOwners, setLoading, shadowInnerHTMLDescriptor, shadowStyleSheetCache, shadowTemplateCache, shouldContainHost, state, supportsAdoptedStyleSheets, tableTemplateCache, toastInstance, toastTimer, trackPopoverPosition, unlockDocumentScroll, unwrapTablesIn, use, useListPage, usePagination, wrapTablesIn, writeScrollLockOriginals } = context;
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
  if (customElements.get('kniu-switch')) return;
  class KniuSysSwitch extends HTMLElement {
    static get observedAttributes() {
      return [];
    }
    constructor() {
      super();
      attachComponentShadow(this);
      this._value = false;
      this._activeValue = undefined;
      this._inactiveValue = undefined;
      this._propDisabled = false;
      this._options = null;
      this.shadowRoot.innerHTML = `<style>${KNIU_SWITCH_CSS}</style>${KNIU_SWITCH_TEMPLATE}`;
      this._root = this.shadowRoot.querySelector('.kniu_sys_switch');
      this._input = this.shadowRoot.querySelector('.kniu_sys_switch_input');
      this._core = this.shadowRoot.querySelector('.kniu_sys_switch_core');
      this._icon = this.shadowRoot.querySelector('.kniu_sys_switch_icon');
      this._core.addEventListener('click', (event) => {
        event.preventDefault();
        if (!this.disabled) this._input.click();
      });
      this._input.addEventListener('change', () => {
        this._value = this._input.checked ? this.activeValue : this.inactiveValue;
        this._sync();
        const value = this._value;
        this.dispatchEvent(new CustomEvent('change', { detail: value, bubbles: true, composed: true }));
        this.dispatchEvent(new CustomEvent('input', { detail: value, bubbles: true, composed: true }));
      });
    }
    connectedCallback() {
      this._mountAffixes();
      if (this.getAttribute('mode') === 'markdown') this.setMode('markdown');
      this._sync();
    }
    attributeChangedCallback() { if (this._root) this._sync(); }
    _mountAffixes() {
      mountAffixSlots(this, '.kniu_sys_switch_group', 'kniu_sys_switch');
      const group = this.shadowRoot.querySelector('.kniu_sys_switch_group');
      if (group.dataset.affix !== 'true') return;
      this.style.display = 'block';
      this.style.width = '100%';
    }
    get activeValue() {
      if (this._activeValue !== undefined) return this._activeValue;
      if (this._options && this._options.activeValue !== undefined) return this._options.activeValue;
      return true;
    }
    set activeValue(value) { this._activeValue = value; this._sync(); }
    get inactiveValue() {
      if (this._inactiveValue !== undefined) return this._inactiveValue;
      if (this._options && this._options.inactiveValue !== undefined) return this._options.inactiveValue;
      return false;
    }
    set inactiveValue(value) { this._inactiveValue = value; this._sync(); }
    get value() { return this._value; }
    set value(value) { this._value = value; this._sync(); }
    get disabled() { return (this._options && this._options.disabled === true) || this._propDisabled === true; }
    set disabled(value) { this._propDisabled = !!value; this._sync(); }
    set options(value) {
      this._options = value && typeof value === 'object' ? value : null;
      this._sync();
    }
    get options() { return this._options; }
    _cfg(key, fallback) {
      const o = this._options || {};
      return (o[key] !== undefined && o[key] !== null) ? o[key] : fallback;
    }
    focus() { this._input.focus(); }
    _isActive() { return this._value === this.activeValue || String(this._value) === String(this.activeValue); }
    _sync() {
      const active = this._isActive();
      const disabled = this.disabled;
      const width = Math.max(20, Number.parseInt(this._cfg('width', 40), 10) || 40);
      this._root.dataset.active = String(active);
      this._root.dataset.disabled = String(disabled);
      this._input.checked = active;
      this._input.disabled = disabled;
      this._core.disabled = disabled;
      this._input.name = String(this._cfg('name', ''));
      this._core.style.width = `${width}px`;
      this._core.style.backgroundColor = active ? String(this._cfg('activeColor', 'var(--kniu-color-success, #13ce66)')) : String(this._cfg('inactiveColor', 'var(--kniu-color-danger, #f56c6c)'));
      this._root.style.setProperty('--kniu-switch-distance',
        `calc(${width}px - max(12px, calc(16 / var(--kniu_vw))) - 4 / var(--kniu_vw))`);
      const iconClass = active ? String(this._cfg('activeIconClass', '')) : String(this._cfg('inactiveIconClass', ''));
      this._icon.className = `kniu_sys_switch_icon${iconClass ? ` ${iconClass}` : ''}`;
      this.shadowRoot.querySelector('.kniu_sys_switch_active_text').textContent = iconClass ? '' : String(this._cfg('activeText', ''));
      this.shadowRoot.querySelector('.kniu_sys_switch_inactive_text').textContent = iconClass ? '' : String(this._cfg('inactiveText', ''));
      this.setAttribute('role', 'switch');
      this.setAttribute('aria-checked', String(active));
      this.setAttribute('aria-disabled', String(disabled));
    }
  }
  customElements.define('kniu-switch', KniuSysSwitch);
}