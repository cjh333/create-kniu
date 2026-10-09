import KNIU_RADIO_GROUP_TEMPLATE from './kniu-radio-group.html?module';

export function registerRadioGroup(context) {
  const { BOOLEAN_ATTRIBUTES, IDENTITY, KNIU_BACKTOP_CSS, KNIU_BADGE_CSS, KNIU_BASE_CONTAIN_CSS, KNIU_BASE_FONT_CSS, KNIU_BTN_CSS, KNIU_BTN_GROUP_CSS, KNIU_BTN_METRICS_CSS, KNIU_BTN_OVERRIDES_CSS, KNIU_COMMENT_CSS, KNIU_CONTAIN_EXCLUDE_TAGS, KNIU_CONTENT_TABLE_CSS, KNIU_CONTENT_TABLE_DOC_CSS, KNIU_DATE_PICKER_CSS, KNIU_DATE_PICKER_OVERRIDES_CSS, KNIU_DROPDOWN_CSS, KNIU_DROPDOWN_OPTION_CSS, KNIU_EDITOR_CSS, KNIU_EDITOR_OVERRIDE_CSS, KNIU_EDITOR_PRINT_CSS, KNIU_EMPTY_CSS, KNIU_FONT_FACE_CSS, KNIU_FONT_FAMILY, KNIU_FONT_MONO_FAMILY, KNIU_FONT_SERIF_FAMILY, KNIU_I18N, KNIU_ICON_CSS, KNIU_ICON_FONT_NAMES, KNIU_ICON_NAMES, KNIU_ICON_SVG, KNIU_IMAGE_CSS, KNIU_IMAGE_OVERRIDES_CSS, KNIU_INPUT_AFFIX_CSS, KNIU_INPUT_CSS, KNIU_INPUT_GROUP_CSS, KNIU_INPUT_METRICS_CSS, KNIU_INPUT_PASSWORD_ACTIONS_CSS, KNIU_INPUT_PASSWORD_CSS, KNIU_INPUT_STATES_CSS, KNIU_INPUT_TEXTAREA_CSS, KNIU_INPUT_TIP_CSS, KNIU_LIKE_CSS, KNIU_LOADING_CSS, KNIU_MARKDOWN_CSS, KNIU_MODAL_CONFIRM_CSS, KNIU_MODAL_CSS, KNIU_MSG_CSS, KNIU_NAVBAR_CELLS_CSS, KNIU_NAVBAR_CELL_CSS, KNIU_NAVBAR_CSS, KNIU_NAVBAR_PLACEHOLDER_CSS, KNIU_PAGE_CSS, KNIU_RADIO_GROUP_CSS, KNIU_RICHTEXT_CSS, KNIU_SELECT_CSS, KNIU_STATUS_CSS, KNIU_SUB_NAVBAR_CSS, KNIU_SUB_NAVBAR_OVERRIDES_CSS, KNIU_SWITCH_CSS, KNIU_TABLE_CLASS, KNIU_TABLE_COL_CSS, KNIU_TABLE_CSS, KNIU_TABLE_WRAP_CLASS, KNIU_TAB_CSS, KNIU_TAG_CSS, KNIU_UPLOAD_CSS, KNIU_USER_LOGIN_CSS, KNIU_USER_LOGIN_OVERRIDES_CSS, PRUNABLE_ATTRIBUTE_NAMES, REQUEST, RICH_TEXT_LITERAL_TAG_RE, SCROLL_LOCK_FLAG, SEMANTIC_EMPTY_ATTRIBUTES, SHADOW_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_RE, TEMPLATE, adoptDropdownStyle, adoptSharedStyle, adoptedSheetsFlushScheduled, appendRawStyle, applyScrollLock, attachComponentShadow, buildIconElement, buildPageList, compileTableRowTemplate, componentDefaults, componentLang, componentText, computePopoverLayout, confirm, createRowDeleteHandler, createSearchActions, createTable, debounce, flushPendingAdoptedSheets, getResponseRecords, getShadowInnerHTMLDescriptor, getSharedStyleSheet, hasRichTextLiteralTag, installMarkdownStyles, installOptionsOnlyProtocol, installRichTextStyles, isEmptyAttributeValue, lockDocumentScroll, makeSwitchOptions, mountAffixSlots, mountPopoverPortal, msg, normalizeComponentCss, normalizedCssCache, pendingAdoptedSheets, pruneEmptyAttribute, pruneEmptyAttributeTree, pruneEmptyAttributes, pruneEmptyRootAttributes, readScrollLockOriginals, reconcileDocumentScrollLock, releaseScrollLock, replaceChildrenWithFragment, resolveIconName, resolveTableRowTemplate, sanitizeRichHtml, sanitizeRichHtmlAsync, scheduleAdoptedSheetsFlush, scrollLockNodes, scrollLockOriginals, scrollLockOwners, setLoading, shadowInnerHTMLDescriptor, shadowStyleSheetCache, shadowTemplateCache, shouldContainHost, state, supportsAdoptedStyleSheets, tableTemplateCache, toastInstance, toastTimer, trackPopoverPosition, unlockDocumentScroll, unwrapTablesIn, use, useListPage, usePagination, wrapTablesIn, writeScrollLockOriginals } = context;
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
  if (!customElements.get('kniu-radio')) {
    class KniuSysRadio extends HTMLElement {
      static get observedAttributes() { return ['label', 'value', 'disabled', 'size']; }
      constructor() {
        super();
        attachComponentShadow(this);
        this.shadowRoot.innerHTML = '<slot></slot>';
      }
      connectedCallback() { this._notifyGroup(); }
      attributeChangedCallback() { this._notifyGroup(); }
      get label() { return this.getAttribute('label') || this.textContent.trim(); }
      get value() { return this.getAttribute('value') || ''; }
      get disabled() { return this.hasAttribute('disabled'); }
      _notifyGroup() {
        const group = this.closest('kniu-radio-group');
        if (group && typeof group.syncOptions === 'function') group.syncOptions();
      }
    }
    customElements.define('kniu-radio', KniuSysRadio);
  }
  if (customElements.get('kniu-radio-group')) return;
  class KniuSysRadioGroup extends HTMLElement {
    static get observedAttributes() { return ['name', 'disabled', 'size']; }
    constructor() {
      super();
      attachComponentShadow(this);
      this._value = '';
      this._radioName = `kniu-radio-${Math.random().toString(36).slice(2)}`;
      this.shadowRoot.innerHTML = `<style>${KNIU_RADIO_GROUP_CSS}</style>${KNIU_RADIO_GROUP_TEMPLATE}`;
      this._group = this.shadowRoot.querySelector('.kniu_sys_radio_group');
      this._group.addEventListener('change', (event) => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || input.type !== 'radio') return;
        this._value = input.value;
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this.dispatchEvent(new CustomEvent('change', { detail: this._value, bubbles: true, composed: true }));
      });
      this._observer = new MutationObserver(() => this.syncOptions());
    }
    connectedCallback() {
      this._observer.observe(this, { childList: true, subtree: true, attributes: true, characterData: true });
      this.syncOptions();
    }
    disconnectedCallback() { this._observer.disconnect(); }
    attributeChangedCallback() { if (this._group) this.syncOptions(); }
    get value() { return this._value; }
    set value(value) { this._value = value == null ? '' : String(value); this._syncChecked(); }
    syncOptions() {
      if (!this._group) return;
      const groupDisabled = this.hasAttribute('disabled');
      const groupSize = this.getAttribute('size') || '';
      const name = this.getAttribute('name') || this._radioName;
      const radios = Array.from(this.querySelectorAll(':scope > kniu-radio')).map((source) => {
        const label = document.createElement('label');
        label.className = 'kniu_sys_radio';
        const disabled = groupDisabled || source.disabled;
        label.dataset.disabled = String(disabled);
        label.dataset.size = source.getAttribute('size') || groupSize;
        const input = document.createElement('input');
        input.className = 'kniu_sys_radio_input';
        input.type = 'radio';
        input.name = name;
        input.value = source.value;
        input.disabled = disabled;
        input.checked = source.value === this._value;
        const dot = document.createElement('span');
        dot.className = 'kniu_sys_radio_dot';
        const control = document.createElement('span');
        control.className = 'kniu_sys_radio_control';
        control.append(input, dot);
        const text = document.createElement('span');
        text.textContent = source.label;
        label.append(control, text);
        return label;
      });
      replaceChildrenWithFragment(this._group, radios);
    }
    _syncChecked() {
      if (!this._group) return;
      this._group.querySelectorAll('input[type="radio"]').forEach((input) => {
        input.checked = input.value === this._value;
      });
    }
  }
  customElements.define('kniu-radio-group', KniuSysRadioGroup);
}