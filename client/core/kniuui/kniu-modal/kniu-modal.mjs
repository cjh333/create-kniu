import KNIU_MODAL_TEMPLATE from './kniu-modal.html?module';
import KNIU_MODAL_CONFIRM_TEMPLATE from './kniu-modal.confirm.html?module';

export function registerModal(context) {
  const { BOOLEAN_ATTRIBUTES, IDENTITY, KNIU_BACKTOP_CSS, KNIU_BADGE_CSS, KNIU_BASE_CONTAIN_CSS, KNIU_BASE_FONT_CSS, KNIU_BTN_CSS, KNIU_BTN_GROUP_CSS, KNIU_BTN_METRICS_CSS, KNIU_BTN_OVERRIDES_CSS, KNIU_COMMENT_CSS, KNIU_CONTAIN_EXCLUDE_TAGS, KNIU_CONTENT_TABLE_CSS, KNIU_CONTENT_TABLE_DOC_CSS, KNIU_DATE_PICKER_CSS, KNIU_DATE_PICKER_OVERRIDES_CSS, KNIU_DROPDOWN_CSS, KNIU_DROPDOWN_OPTION_CSS, KNIU_EDITOR_CSS, KNIU_EDITOR_OVERRIDE_CSS, KNIU_EDITOR_PRINT_CSS, KNIU_EMPTY_CSS, KNIU_FONT_FACE_CSS, KNIU_FONT_FAMILY, KNIU_FONT_MONO_FAMILY, KNIU_FONT_SERIF_FAMILY, KNIU_I18N, KNIU_ICON_CSS, KNIU_ICON_FONT_NAMES, KNIU_ICON_NAMES, KNIU_ICON_SVG, KNIU_IMAGE_CSS, KNIU_IMAGE_OVERRIDES_CSS, KNIU_INPUT_AFFIX_CSS, KNIU_INPUT_CSS, KNIU_INPUT_GROUP_CSS, KNIU_INPUT_METRICS_CSS, KNIU_INPUT_PASSWORD_ACTIONS_CSS, KNIU_INPUT_PASSWORD_CSS, KNIU_INPUT_STATES_CSS, KNIU_INPUT_TEXTAREA_CSS, KNIU_INPUT_TIP_CSS, KNIU_LIKE_CSS, KNIU_LOADING_CSS, KNIU_MARKDOWN_CSS, KNIU_MODAL_CONFIRM_CSS, KNIU_MODAL_CSS, KNIU_MSG_CSS, KNIU_NAVBAR_CELLS_CSS, KNIU_NAVBAR_CELL_CSS, KNIU_NAVBAR_CSS, KNIU_NAVBAR_PLACEHOLDER_CSS, KNIU_PAGE_CSS, KNIU_RADIO_GROUP_CSS, KNIU_RICHTEXT_CSS, KNIU_SELECT_CSS, KNIU_STATUS_CSS, KNIU_SUB_NAVBAR_CSS, KNIU_SUB_NAVBAR_OVERRIDES_CSS, KNIU_SWITCH_CSS, KNIU_TABLE_CLASS, KNIU_TABLE_COL_CSS, KNIU_TABLE_CSS, KNIU_TABLE_WRAP_CLASS, KNIU_TAB_CSS, KNIU_TAG_CSS, KNIU_UPLOAD_CSS, KNIU_USER_LOGIN_CSS, KNIU_USER_LOGIN_OVERRIDES_CSS, PRUNABLE_ATTRIBUTE_NAMES, REQUEST, RICH_TEXT_LITERAL_TAG_RE, SCROLL_LOCK_FLAG, SEMANTIC_EMPTY_ATTRIBUTES, SHADOW_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_RE, TEMPLATE, adoptDropdownStyle, adoptSharedStyle, adoptedSheetsFlushScheduled, appendRawStyle, applyScrollLock, attachComponentShadow, buildIconElement, buildPageList, compileTableRowTemplate, componentDefaults, componentLang, componentText, computePopoverLayout, confirm, createRowDeleteHandler, createSearchActions, createTable, debounce, flushPendingAdoptedSheets, getResponseRecords, getShadowInnerHTMLDescriptor, getSharedStyleSheet, hasRichTextLiteralTag, installMarkdownStyles, installOptionsOnlyProtocol, installRichTextStyles, isEmptyAttributeValue, lockDocumentScroll, makeSwitchOptions, mountAffixSlots, mountPopoverPortal, msg, normalizeComponentCss, normalizedCssCache, pendingAdoptedSheets, pruneEmptyAttribute, pruneEmptyAttributeTree, pruneEmptyAttributes, pruneEmptyRootAttributes, readScrollLockOriginals, reconcileDocumentScrollLock, releaseScrollLock, replaceChildrenWithFragment, resolveIconName, resolveTableRowTemplate, sanitizeRichHtml, sanitizeRichHtmlAsync, scheduleAdoptedSheetsFlush, scrollLockNodes, scrollLockOriginals, scrollLockOwners, setLoading, shadowInnerHTMLDescriptor, shadowStyleSheetCache, shadowTemplateCache, shouldContainHost, state, supportsAdoptedStyleSheets, tableTemplateCache, toastInstance, toastTimer, trackPopoverPosition, unlockDocumentScroll, unwrapTablesIn, use, usePage, usePagination, wrapTablesIn, writeScrollLockOriginals } = context;
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
  if (customElements.get('kniu-modal')) return;

  const GENERIC_HTML = '<style>' + KNIU_MODAL_CSS + '</style>' + KNIU_MODAL_TEMPLATE;
  const CONFIRM_HTML = '<style>' + KNIU_MODAL_CONFIRM_CSS + '</style>' + KNIU_MODAL_CONFIRM_TEMPLATE;

  class KniuModal extends HTMLElement {
    static get observedAttributes() { return ['show', 'mask', 'mask-alpha', 'mask-close', 'scrollbar', 'width', 'title', 'message', 'confirm-text', 'cancel-text', 'type', 'show-close', 'minmax', 'close-btn']; }
    constructor() {
      super();
      this._confirmMode = false;
      this._title = '';
      this._message = '';
      this._confirmText = '';
      this._cancelText = '';
      this._type = '';
      this._closeTimer = null;
      this._closeAnimEnd = null;
      this._wasShown = false;
      this._scrollLocked = false;
      this._shadowBuilt = false;
      this._renderedConfirmMode = null;
      this._windowControlsBound = false;
      this._handleKeydown = (e) => { if (e.key === 'Escape') this._onEscape(); };
      attachComponentShadow(this);
    }
    connectedCallback() {
      this._render();
      document.addEventListener('keydown', this._handleKeydown);
    }
    disconnectedCallback() {
      document.removeEventListener('keydown', this._handleKeydown);
      this._unlockScrollbar();
    }
    attributeChangedCallback(name, oldValue, newValue) {
      if (name === 'width') { this._syncWidth(); }
      else if (name === 'show') {
        if (newValue === 'true') this._wasShown = true;
        else this._requestClose();
      }
      else if (name === 'mask' || name === 'mask-alpha') { this._applyMask(); }
      else if (name === 'scrollbar') { if (this.getAttribute('show') === 'true') this._lockScrollbar(); }
      else if (name === 'minmax' || name === 'close-btn') {
        if (this.shadowRoot && !this._confirmMode) this._bindWindowControls();
      }
      else if (name === 'title' || name === 'message' || name === 'confirm-text' || name === 'cancel-text' || name === 'type') {
        if (this._confirmMode) this._fillConfirm();
      }
    }
    get show() { return this.getAttribute('show') === 'true'; }
    set show(val) { if (val) this.open(); else this._requestClose(); }
    get confirm() { return this._confirmMode; }
    set confirm(val) { this._confirmMode = !!val; }
    get title() { return this._title || this.getAttribute('title') || ''; }
    set title(val) { this._title = val; if (this._confirmMode && this.shadowRoot) this._fillConfirm(); }
    get message() { return this._message || this.getAttribute('message') || ''; }
    set message(val) { this._message = val; if (this._confirmMode && this.shadowRoot) this._fillConfirm(); }
    get confirmText() { return this._confirmText || this.getAttribute('confirm-text') || ''; }
    set confirmText(val) { this._confirmText = val; if (this._confirmMode && this.shadowRoot) this._fillConfirm(); }
    get cancelText() { return this._cancelText || this.getAttribute('cancel-text') || ''; }
    set cancelText(val) { this._cancelText = val; if (this._confirmMode && this.shadowRoot) this._fillConfirm(); }
    get type() { return this._type || this.getAttribute('type') || ''; }
    set type(val) { this._type = val; if (this._confirmMode && this.shadowRoot) this._fillConfirm(); }
    open() {
      if (this._closeTimer) { clearTimeout(this._closeTimer); this._closeTimer = null; }
      this._detachCloseAnimEnd();
      this._wasShown = true;
      this.removeAttribute('closing');
      this.removeAttribute('data-minimized');
      this.removeAttribute('data-maximized');
      this.setAttribute('show', 'true');
      this._applyMask();
      this._lockScrollbar();
      this._syncWindowControls();
    }
    close() {
      this._requestClose();
    }
    _requestClose() {
      if (this.hasAttribute('closing') || !this._wasShown) return;
      // close 事件与 onClose 下沉到唯一关闭出口：close()/show=false/setter/Esc 四条路径统一派发，
      // 此前仅 close() 派发，编程置 show=false 或 setter 关闭时监听方收不到。
      this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
      const onClose = this.__kniuOptions && this.__kniuOptions.onClose;
      if (typeof onClose === 'function') onClose();
      const finalize = () => {
        if (this._closeTimer) { clearTimeout(this._closeTimer); this._closeTimer = null; }
        this._detachCloseAnimEnd();
        this._wasShown = false;
        this.setAttribute('show', 'false');
        this.removeAttribute('closing');
        this._unlockScrollbar();
      };
      const reduce = (typeof matchMedia !== 'undefined') && matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) { finalize(); return; }
      this.setAttribute('closing', '');
      this._closeTimer = setTimeout(finalize, 280);
      const dialog = this.shadowRoot && this.shadowRoot.querySelector('.kniu_sys_modal_dialog');
      if (dialog) {
        this._detachCloseAnimEnd();
        this._closeAnimEnd = (e) => {
          if (e.animationName && e.animationName.indexOf('out') !== -1) finalize();
        };
        dialog.addEventListener('animationend', this._closeAnimEnd);
      }
    }
    _detachCloseAnimEnd() {
      if (!this._closeAnimEnd) return;
      const dialog = this.shadowRoot && this.shadowRoot.querySelector('.kniu_sys_modal_dialog');
      if (dialog) dialog.removeEventListener('animationend', this._closeAnimEnd);
      this._closeAnimEnd = null;
    }
    _render() {
      const needsBuild = !this._shadowBuilt || this._confirmMode !== this._renderedConfirmMode;
      if (needsBuild) {
        this.shadowRoot.innerHTML = this._confirmMode ? CONFIRM_HTML : GENERIC_HTML;
        this._shadowBuilt = true;
        this._renderedConfirmMode = this._confirmMode;
        // 影子重建 ⇒ 旧按钮（含监听）整体丢弃，必须允许重新绑定一次。
        this._windowControlsBound = false;
        if (this._confirmMode) {
          this.shadowRoot.querySelector('.kniu_sys_modal_close')?.addEventListener('click', () => this._cancel());
          this.shadowRoot.querySelector('.kniu_sys_modal_cancel')?.addEventListener('click', () => this._cancel());
          this.shadowRoot.querySelector('.kniu_sys_modal_confirm')?.addEventListener('click', () => this._confirm());
          this.shadowRoot.querySelector('.kniu_sys_modal_mask')?.addEventListener('click', (e) => {
            if (e.target === this.shadowRoot.querySelector('.kniu_sys_modal_mask') && this._maskClose()) this._cancel();
          });
        } else {
          this.shadowRoot.querySelector('.kniu_sys_modal_mask')?.addEventListener('click', (e) => {
            if (e.target === this.shadowRoot.querySelector('.kniu_sys_modal_mask') && this._maskClose()) this.close();
          });
          this._bindWindowControls();
        }
      }
      this._syncWidth();
      this._applyMask();
      if (this._confirmMode) this._fillConfirm();
    }
    _bindWindowControls() {
      const controls = this.shadowRoot.querySelector('.kniu_sys_modal_window_controls');
      if (!controls) return;
      const minmax = this._boolConfig('minmax', 'minmax', false);
      const closeVisible = this._boolConfig('closeBtn', 'close-btn', true);
      if (!minmax && !closeVisible) { controls.style.display = 'none'; return; }
      controls.style.display = 'flex';
      const minimizeBtn = controls.querySelector('.kniu_sys_modal_minimize');
      const maximizeBtn = controls.querySelector('.kniu_sys_modal_maximize');
      const closeBtn = controls.querySelector('.kniu_sys_modal_window_close');
      minimizeBtn.style.display = minmax ? '' : 'none';
      maximizeBtn.style.display = minmax ? '' : 'none';
      closeBtn.style.display = closeVisible ? '' : 'none';
      // 监听只绑一次：options 每次更新都会经 reflectOptions 重设 minmax/close-btn
      // 属性 ⇒ attributeChangedCallback 反复进来，若重复 addEventListener，
      // 点一次最小化会触发 N 次 toggleAttribute（偶数次时净效果为「无变化」），
      // 而关闭钮因 _requestClose 自带守卫看不出来 —— 最小化/最大化就这么失效的。
      // 显隐配置（minmax/close-btn）每次都要同步，故拆成「同步 + 一次性绑定」两段。
      if (this._windowControlsBound) { this._syncWindowControls(); return; }
      minimizeBtn.innerHTML = KNIU_ICON_SVG.reduce;
      closeBtn.innerHTML = KNIU_ICON_SVG.close;
      minimizeBtn.addEventListener('click', () => this._toggleMinimize());
      maximizeBtn.addEventListener('click', () => this._toggleMaximize());
      closeBtn.addEventListener('click', () => this.close());
      this._windowControlsBound = true;
      this._syncWindowControls();
    }
    _syncWindowControls() {
      const maximizeBtn = this.shadowRoot && this.shadowRoot.querySelector('.kniu_sys_modal_maximize');
      if (!maximizeBtn) return;
      const compact = this.hasAttribute('data-maximized') || this.hasAttribute('data-minimized');
      maximizeBtn.innerHTML = compact ? KNIU_ICON_SVG.fullscreen_exit : KNIU_ICON_SVG.fullscreen_open;
      maximizeBtn.setAttribute('aria-label', compact ? 'restore' : 'maximize');
      const minimizeBtn = this.shadowRoot.querySelector('.kniu_sys_modal_minimize');
      if (minimizeBtn) {
        const minmax = this._boolConfig('minmax', 'minmax', false);
        minimizeBtn.style.display = (!compact && minmax) ? '' : 'none';
      }
    }
    _toggleMinimize() {
      if (this.hasAttribute('data-maximized')) this.removeAttribute('data-maximized');
      this.toggleAttribute('data-minimized');
      this._syncWindowControls();
    }
    _toggleMaximize() {
      if (this.hasAttribute('data-maximized') || this.hasAttribute('data-minimized')) {
        this.removeAttribute('data-maximized');
        this.removeAttribute('data-minimized');
      } else {
        this.setAttribute('data-maximized', '');
      }
      this._syncWindowControls();
    }
    _syncWidth() {
      const attrW = this.getAttribute('width');
      const inlineW = (this.style && this.style.width) || '';
      const w = attrW || inlineW;
      if (w) {
        this.style.setProperty('--kniu-modal-width', w);
        if (!attrW && inlineW) this.style.width = '';
      }
    }
    _boolConfig(key, attributeName, defaultValue) {
      const opts = this.__kniuOptions;
      if (opts && Object.prototype.hasOwnProperty.call(opts, key)) return !!opts[key];
      const attr = this.getAttribute(attributeName);
      if (attr !== null) return attr === 'true' || attr === '';
      return defaultValue;
    }
    _applyMask() {
      const maskEl = this.shadowRoot && this.shadowRoot.querySelector('.kniu_sys_modal_mask');
      if (!maskEl) return;
      const maskOn = this._boolConfig('mask', 'mask', true);
      if (!maskOn) {
        maskEl.style.backgroundColor = 'transparent';
        maskEl.style.pointerEvents = 'none';
        return;
      }
      maskEl.style.pointerEvents = '';
      const alpha = parseFloat(this.getAttribute('mask-alpha'));
      const a = isNaN(alpha) ? 0.6 : Math.min(1, Math.max(0, alpha));
      maskEl.style.backgroundColor = 'rgba(0,0,0,' + a + ')';
    }
    _lockScrollbar() {
      const lock = !this._boolConfig('scrollbar', 'scrollbar', true);
      if (lock) {
        this._scrollLocked = lockDocumentScroll(this);
      }
    }
    _unlockScrollbar() {
      if (!this._scrollLocked) return;
      this._scrollLocked = false;
      unlockDocumentScroll(this);
    }
    _maskClose() {
      const opts = this.__kniuOptions;
      if (opts && Object.prototype.hasOwnProperty.call(opts, 'maskClose')) return !!opts.maskClose;
      const mc = this.getAttribute('mask-close');
      if (mc !== null) return mc === 'true' || mc === '';
      const a = this.getAttribute('close-on-click-modal');
      if (a !== null) return a === 'true' || a === '';
      const m = this.getAttribute('modal');
      if (m !== null) return m === 'true' || m === '';
      return false;
    }
    _fillConfirm() {
      if (!this.shadowRoot) return;
      const type = ['success', 'warning', 'info', 'error'].includes(this.type) ? this.type : 'warning';
      const ICON = { success: '✓', warning: '⚠', info: 'ℹ', error: '×' };
      const COLOR = { success: 'var(--kniu-color-success, #67c23a)', warning: 'var(--kniu-color-warning, #e6a23c)', info: 'var(--kniu-color-info, #909399)', error: 'var(--kniu-color-danger, #f56c6c)' };
      const t = this.shadowRoot.querySelector('.kniu_sys_modal_confirm_title');
      const m = this.shadowRoot.querySelector('.kniu_sys_modal_confirm_message');
      const i = this.shadowRoot.querySelector('.kniu_sys_modal_confirm_icon');
      const c = this.shadowRoot.querySelector('.kniu_sys_modal_cancel');
      const cf = this.shadowRoot.querySelector('.kniu_sys_modal_confirm');
      const close = this.shadowRoot.querySelector('.kniu_sys_modal_close');
      if (t) t.textContent = this.title || componentText(componentLang(this.__kniuOptions), 'modal.title');
      if (m) m.textContent = this.message || '';
      if (i) { i.textContent = ICON[type]; i.style.color = COLOR[type]; }
      if (c) c.textContent = this.cancelText || componentText(componentLang(this.__kniuOptions), 'modal.cancel');
      if (cf) cf.textContent = this.confirmText || componentText(componentLang(this.__kniuOptions), 'modal.ok');
      if (close) close.style.display = this.getAttribute('show-close') === 'false' ? 'none' : '';
      if (close) close.setAttribute('aria-label', componentText(componentLang(this.__kniuOptions), 'modal.close'));
    }
    _confirm() { this.dispatchEvent(new CustomEvent('confirm', { bubbles: true, composed: true })); this.show = false; }
    _cancel() { this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true })); this.show = false; }
    _sync() { if (this._confirmMode && this.shadowRoot) this._fillConfirm(); }
    _onEscape() {
      if (!this.show) return;
      if (this._confirmMode) this._cancel();
      else this.close();
    }
  }
  customElements.define('kniu-modal', KniuModal);
}