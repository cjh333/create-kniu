import KNIU_SELECT_TEMPLATE from './kniu-select.html?module';

export function registerSelect(context) {
  const { BOOLEAN_ATTRIBUTES, IDENTITY, KNIU_BACKTOP_CSS, KNIU_BADGE_CSS, KNIU_BASE_CONTAIN_CSS, KNIU_BASE_FONT_CSS, KNIU_BTN_CSS, KNIU_BTN_GROUP_CSS, KNIU_BTN_METRICS_CSS, KNIU_BTN_OVERRIDES_CSS, KNIU_COMMENT_CSS, KNIU_CONTAIN_EXCLUDE_TAGS, KNIU_CONTENT_TABLE_CSS, KNIU_CONTENT_TABLE_DOC_CSS, KNIU_DATE_PICKER_CSS, KNIU_DATE_PICKER_OVERRIDES_CSS, KNIU_DROPDOWN_CSS, KNIU_DROPDOWN_OPTION_CSS, KNIU_EDITOR_CSS, KNIU_EDITOR_OVERRIDE_CSS, KNIU_EDITOR_PRINT_CSS, KNIU_EMPTY_CSS, KNIU_FONT_FACE_CSS, KNIU_FONT_FAMILY, KNIU_FONT_MONO_FAMILY, KNIU_FONT_SERIF_FAMILY, KNIU_I18N, KNIU_ICON_CSS, KNIU_ICON_FONT_NAMES, KNIU_ICON_NAMES, KNIU_ICON_SVG, KNIU_IMAGE_CSS, KNIU_IMAGE_OVERRIDES_CSS, KNIU_INPUT_AFFIX_CSS, KNIU_INPUT_CSS, KNIU_INPUT_GROUP_CSS, KNIU_INPUT_METRICS_CSS, KNIU_INPUT_PASSWORD_ACTIONS_CSS, KNIU_INPUT_PASSWORD_CSS, KNIU_INPUT_STATES_CSS, KNIU_INPUT_TEXTAREA_CSS, KNIU_INPUT_TIP_CSS, KNIU_LIKE_CSS, KNIU_LOADING_CSS, KNIU_MARKDOWN_CSS, KNIU_MODAL_CONFIRM_CSS, KNIU_MODAL_CSS, KNIU_MSG_CSS, KNIU_NAVBAR_CELLS_CSS, KNIU_NAVBAR_CELL_CSS, KNIU_NAVBAR_CSS, KNIU_NAVBAR_PLACEHOLDER_CSS, KNIU_PAGE_CSS, KNIU_RADIO_GROUP_CSS, KNIU_RICHTEXT_CSS, KNIU_SELECT_CSS, KNIU_STATUS_CSS, KNIU_SUB_NAVBAR_CSS, KNIU_SUB_NAVBAR_OVERRIDES_CSS, KNIU_SWITCH_CSS, KNIU_TABLE_CLASS, KNIU_TABLE_COL_CSS, KNIU_TABLE_CSS, KNIU_TABLE_WRAP_CLASS, KNIU_TAB_CSS, KNIU_TAG_CSS, KNIU_UPLOAD_CSS, KNIU_USER_LOGIN_CSS, KNIU_USER_LOGIN_OVERRIDES_CSS, PRUNABLE_ATTRIBUTE_NAMES, REQUEST, RICH_TEXT_LITERAL_TAG_RE, SCROLL_LOCK_FLAG, SEMANTIC_EMPTY_ATTRIBUTES, SHADOW_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_RE, TEMPLATE, adoptDropdownStyle, adoptSharedStyle, adoptedSheetsFlushScheduled, appendRawStyle, applyScrollLock, attachComponentShadow, buildIconElement, buildPageList, compileTableRowTemplate, componentDefaults, componentLang, componentText, computePopoverLayout, confirm, createRowDeleteHandler, createSearchActions, createTable, debounce, flushPendingAdoptedSheets, getResponseRecords, getShadowInnerHTMLDescriptor, getSharedStyleSheet, hasRichTextLiteralTag, installMarkdownStyles, installOptionsOnlyProtocol, installRichTextStyles, isEmptyAttributeValue, lockDocumentScroll, makeSwitchOptions, mountAffixSlots, mountPopoverPortal, msg, normalizeComponentCss, normalizedCssCache, pendingAdoptedSheets, pruneEmptyAttribute, pruneEmptyAttributeTree, pruneEmptyAttributes, pruneEmptyRootAttributes, readScrollLockOriginals, reconcileDocumentScrollLock, releaseScrollLock, replaceChildrenWithFragment, resolveIconName, resolveTableRowTemplate, sanitizeRichHtml, sanitizeRichHtmlAsync, scheduleAdoptedSheetsFlush, scrollLockNodes, scrollLockOriginals, scrollLockOwners, setLoading, shadowInnerHTMLDescriptor, shadowStyleSheetCache, shadowTemplateCache, shouldContainHost, state, supportsAdoptedStyleSheets, tableTemplateCache, toastInstance, toastTimer, trackPopoverPosition, unlockDocumentScroll, unwrapTablesIn, use, useListPage, usePagination, wrapTablesIn, writeScrollLockOriginals } = context;
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
  if (!customElements.get('kniu-option')) {
    class KniuSysOption extends HTMLElement {
      static get observedAttributes() { return ['label', 'value', 'disabled']; }
      constructor() {
        super();
        attachComponentShadow(this);
        this.shadowRoot.innerHTML = '<slot></slot>';
      }
      connectedCallback() { this._notifySelect(); }
      attributeChangedCallback() { this._notifySelect(); }
      get label() { return this.getAttribute('label') || this.textContent.trim(); }
      set label(value) { this.setAttribute('label', value == null ? '' : String(value)); }
      get value() { return this.getAttribute('value') || ''; }
      set value(value) { this.setAttribute('value', value == null ? '' : String(value)); }
      get disabled() { return this.hasAttribute('disabled'); }
      set disabled(value) { value ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }
      _notifySelect() {
        const select = this.closest('kniu-select');
        if (select && typeof select.syncOptions === 'function') select.syncOptions();
      }
    }
    customElements.define('kniu-option', KniuSysOption);
  }
  if (customElements.get('kniu-select')) return;
  class KniuSysSelect extends HTMLElement {
    static get observedAttributes() { return ['placeholder', 'name', 'disabled', 'required', 'size']; }
    constructor() {
      super();
      attachComponentShadow(this);
      this._value = '';
      this.shadowRoot.innerHTML = `<style>${KNIU_SELECT_CSS}</style>${KNIU_SELECT_TEMPLATE}`;
      adoptDropdownStyle(this.shadowRoot);
      this._wrap = this.shadowRoot.querySelector('.kniu_sys_select_wrap');
      this._select = this.shadowRoot.querySelector('.kniu_sys_select');
      this._dropdown = this.shadowRoot.querySelector('.kniu_sys_select_dropdown');
      this._select.addEventListener('click', () => this._setOpen(this._wrap.dataset.open !== 'true'));
      this._select.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' || event.key === 'Tab') this._setOpen(false);
        else if (event.key === 'Enter' || event.key === ' ' || (event.altKey && event.key === 'ArrowDown')) this._setOpen(true);
      });
      this._dropdown.addEventListener('click', (event) => {
        const option = event.target.closest('.kniu_sys_select_option');
        if (!option || option.disabled) return;
        this._value = option.dataset.value || '';
        this.syncOptions();
        this._setOpen(false);
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this.dispatchEvent(new CustomEvent('change', { detail: this._value, bubbles: true, composed: true }));
      });
      this._outside = (event) => {
        const path = event.composedPath();
        if (path.includes(this) || path.includes(this._dropdown)) return;
        this._setOpen(false);
      };
      this._observer = new MutationObserver(() => this.syncOptions());
    }
    connectedCallback() {
      this._observer.observe(this, { childList: true, subtree: true, attributes: true, characterData: true });
      this.syncOptions();
      this._syncAttributes();
      window.addEventListener('pointerdown', this._outside, true);
    }
    disconnectedCallback() { this._observer.disconnect(); window.removeEventListener('pointerdown', this._outside, true); if (this._disposeSelectTrack) { this._disposeSelectTrack(); this._disposeSelectTrack = null; } if (this._popoverState) { this._popoverState.unmount(); this._popoverState = null; } }
    attributeChangedCallback() { if (this._select) this._syncAttributes(); }
    get value() { return this._value; }
    set value(value) {
      this._value = value == null ? '' : String(value);
      if (this._select) this.syncOptions();
    }
    get disabled() { return this.hasAttribute('disabled'); }
    set disabled(value) { value ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }
    _setOpen(open) {
      const expanded = !!open && !this._select.disabled;
      if (!expanded) {
        if (this._disposeSelectTrack) { this._disposeSelectTrack(); this._disposeSelectTrack = null; }
        if (this._popoverState) { this._popoverState.unmount(); this._popoverState = null; }
      }
      this._wrap.dataset.open = String(expanded);
      this._dropdown.dataset.open = String(expanded);
      this._select.setAttribute('aria-expanded', String(expanded));
      if (!expanded) return;
      if (!this._popoverState) this._popoverState = mountPopoverPortal(this._dropdown, this.shadowRoot, { zIndex: 10030, attribute: 'data-kniu-select-popover' });
      this._dropdown.dataset.open = 'true';
      const trigger = this._select;
      const triggerRect = trigger.getBoundingClientRect();
      this._dropdown.style.width = triggerRect.width + 'px';
      const applyPosition = (rect) => {
        const layout = computePopoverLayout(this._dropdown, rect, { offset: 6, width: rect.width, height: 220 });
        this._dropdown.dataset.placement = layout.placement;
        this._dropdown.style.left = layout.left + 'px';
        this._dropdown.style.top = layout.top + 'px';
      };
      applyPosition(triggerRect);
      if (this._disposeSelectTrack) this._disposeSelectTrack();
      this._disposeSelectTrack = trackPopoverPosition(
        () => { if (!this.isConnected) return null; return this._select.getBoundingClientRect(); },
        applyPosition
      );
    }
    syncOptions() {
      if (!this._select) return;
      const options = [];
      const placeholder = this.getAttribute('placeholder') || '';
      if (placeholder) {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'kniu_sys_select_option kniu_sys_dropdown_option';
        option.dataset.value = '';
        option.textContent = placeholder;
        option.disabled = this.hasAttribute('required');
        options.push(option);
      }
      this.querySelectorAll(':scope > kniu-option').forEach(function (source) {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'kniu_sys_select_option kniu_sys_dropdown_option';
        option.dataset.value = source.value;
        option.textContent = source.label;
        option.disabled = source.disabled;
        options.push(option);
      });
      options.forEach((option) => option.classList.toggle('kniu_sys_select_selected', option.dataset.value === this._value));
      replaceChildrenWithFragment(this._dropdown, options);
      const selected = options.find((option) => option.dataset.value === this._value);
      this._select.textContent = selected?.textContent || placeholder || '';
    }
    _syncAttributes() {
      this._select.disabled = this.hasAttribute('disabled');
      if (this._select.disabled) this._setOpen(false);
      const size = this.getAttribute('size');
      const height = size === 'small' ? 30 : (size === 'large' ? 48 : 40);
      this._select.style.setProperty('--kniu-select-h', String(height));
      this.syncOptions();
    }
  }
  customElements.define('kniu-select', KniuSysSelect);
}