import KNIU_BACKTOP_TEMPLATE from './kniu-backtop.html?module';

export function registerBacktop(context) {
  const { BOOLEAN_ATTRIBUTES, IDENTITY, KNIU_BACKTOP_CSS, KNIU_BADGE_CSS, KNIU_BASE_CONTAIN_CSS, KNIU_BASE_FONT_CSS, KNIU_BTN_CSS, KNIU_BTN_GROUP_CSS, KNIU_BTN_METRICS_CSS, KNIU_BTN_OVERRIDES_CSS, KNIU_COMMENT_CSS, KNIU_CONTAIN_EXCLUDE_TAGS, KNIU_CONTENT_TABLE_CSS, KNIU_CONTENT_TABLE_DOC_CSS, KNIU_DATE_PICKER_CSS, KNIU_DATE_PICKER_OVERRIDES_CSS, KNIU_DROPDOWN_CSS, KNIU_DROPDOWN_OPTION_CSS, KNIU_EDITOR_CSS, KNIU_EDITOR_OVERRIDE_CSS, KNIU_EDITOR_PRINT_CSS, KNIU_EMPTY_CSS, KNIU_FONT_FACE_CSS, KNIU_FONT_FAMILY, KNIU_FONT_MONO_FAMILY, KNIU_FONT_SERIF_FAMILY, KNIU_I18N, KNIU_ICON_CSS, KNIU_ICON_FONT_NAMES, KNIU_ICON_NAMES, KNIU_ICON_SVG, KNIU_IMAGE_CSS, KNIU_IMAGE_OVERRIDES_CSS, KNIU_INPUT_AFFIX_CSS, KNIU_INPUT_CSS, KNIU_INPUT_GROUP_CSS, KNIU_INPUT_METRICS_CSS, KNIU_INPUT_PASSWORD_ACTIONS_CSS, KNIU_INPUT_PASSWORD_CSS, KNIU_INPUT_STATES_CSS, KNIU_INPUT_TEXTAREA_CSS, KNIU_INPUT_TIP_CSS, KNIU_LIKE_CSS, KNIU_LOADING_CSS, KNIU_MARKDOWN_CSS, KNIU_MODAL_CONFIRM_CSS, KNIU_MODAL_CSS, KNIU_MSG_CSS, KNIU_NAVBAR_CELLS_CSS, KNIU_NAVBAR_CELL_CSS, KNIU_NAVBAR_CSS, KNIU_NAVBAR_PLACEHOLDER_CSS, KNIU_PAGE_CSS, KNIU_RADIO_GROUP_CSS, KNIU_RICHTEXT_CSS, KNIU_SELECT_CSS, KNIU_STATUS_CSS, KNIU_SUB_NAVBAR_CSS, KNIU_SUB_NAVBAR_OVERRIDES_CSS, KNIU_SWITCH_CSS, KNIU_TABLE_CLASS, KNIU_TABLE_COL_CSS, KNIU_TABLE_CSS, KNIU_TABLE_WRAP_CLASS, KNIU_TAB_CSS, KNIU_TAG_CSS, KNIU_UPLOAD_CSS, KNIU_USER_LOGIN_CSS, KNIU_USER_LOGIN_OVERRIDES_CSS, PRUNABLE_ATTRIBUTE_NAMES, REQUEST, RICH_TEXT_LITERAL_TAG_RE, SCROLL_LOCK_FLAG, SEMANTIC_EMPTY_ATTRIBUTES, SHADOW_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_RE, TEMPLATE, adoptDropdownStyle, adoptSharedStyle, adoptedSheetsFlushScheduled, appendRawStyle, applyScrollLock, attachComponentShadow, buildIconElement, buildPageList, compileTableRowTemplate, componentDefaults, componentLang, componentText, computePopoverLayout, confirm, createRowDeleteHandler, createSearchActions, createTable, debounce, flushPendingAdoptedSheets, getResponseRecords, getShadowInnerHTMLDescriptor, getSharedStyleSheet, hasRichTextLiteralTag, installMarkdownStyles, installOptionsOnlyProtocol, installRichTextStyles, isEmptyAttributeValue, lockDocumentScroll, makeSwitchOptions, mountAffixSlots, mountPopoverPortal, msg, normalizeComponentCss, normalizedCssCache, pendingAdoptedSheets, pruneEmptyAttribute, pruneEmptyAttributeTree, pruneEmptyAttributes, pruneEmptyRootAttributes, readScrollLockOriginals, reconcileDocumentScrollLock, releaseScrollLock, replaceChildrenWithFragment, resolveIconName, resolveTableRowTemplate, sanitizeRichHtml, sanitizeRichHtmlAsync, scheduleAdoptedSheetsFlush, scrollLockNodes, scrollLockOriginals, scrollLockOwners, setLoading, shadowInnerHTMLDescriptor, shadowStyleSheetCache, shadowTemplateCache, shouldContainHost, state, supportsAdoptedStyleSheets, tableTemplateCache, toastInstance, toastTimer, trackPopoverPosition, unlockDocumentScroll, unwrapTablesIn, use, usePage, usePagination, wrapTablesIn, writeScrollLockOriginals } = context;
  if (typeof customElements === 'undefined' || customElements.get('kniu-backtop')) return;
  class KniuBacktop extends HTMLElement {
    static get observedAttributes() { return ['right', 'bottom']; }
    constructor() {
      super();
      attachComponentShadow(this);
      this.shadowRoot.innerHTML = `
          <style>${KNIU_BACKTOP_CSS}</style>
          ${KNIU_BACKTOP_TEMPLATE}`;
      this._handleScroll = this._syncVisible.bind(this);
      this._handleClick = this._scrollTop.bind(this);
    }
    connectedCallback() {
      this._target = this._findScrollTarget();
      const listenerTarget = this._target === document.scrollingElement ? globalThis : this._target;
      listenerTarget?.addEventListener('scroll', this._handleScroll, { passive: true });
      this.shadowRoot.querySelector('button').addEventListener('click', this._handleClick);
      this._syncPosition();
      this._syncVisible();
      // 可见性只由 scroll 事件驱动（B-m3）：200ms 轮询属冗余通道，已删除。
    }
    disconnectedCallback() {
      const listenerTarget = this._target === document.scrollingElement ? globalThis : this._target;
      listenerTarget?.removeEventListener('scroll', this._handleScroll);
      this.shadowRoot.querySelector('button')?.removeEventListener('click', this._handleClick);
    }
    attributeChangedCallback() { this._syncPosition(); }
    _findScrollTarget() {
      let node = this.parentNode;
      while (node) {
        if (node.nodeType === 1) {
          const style = globalThis.getComputedStyle?.(node);
          if (/(auto|scroll)/.test(style?.overflowY || '')) return node;
        }
        const root = node.getRootNode?.();
        node = node.parentNode || (root && root.host) || null;
      }
      return document.scrollingElement || document.documentElement;
    }
    _syncPosition() {
      const right = Math.max(0, Number(this.getAttribute('right')) || 40);
      const bottom = Math.max(0, Number(this.getAttribute('bottom')) || 40);
      this.style.setProperty('--right', right + 'px');
      this.style.setProperty('--bottom', bottom + 'px');
      const btn = this.shadowRoot?.querySelector('button');
      if (btn) btn.setAttribute('aria-label', componentText(componentLang(this.__kniuOptions), 'backtop.aria'));
    }
    _sync() { this._syncPosition(); }
    _syncVisible() {
      const target = this._target || document.scrollingElement || document.documentElement;
      const win = globalThis;
      const docEl = document.documentElement;
      const scrollTop = Math.max(
        win.scrollY || 0,
        docEl?.scrollTop || 0,
        document.body?.scrollTop || 0,
        target?.scrollTop || 0
      );
      const docOverflow = (docEl?.scrollHeight || 0) > (win.innerHeight || 0) + 1;
      const targetOverflow = target && target !== docEl && target !== document.body
        ? (target.scrollHeight - target.clientHeight) > 1
        : false;
      this.toggleAttribute('visible', (docOverflow || targetOverflow) && scrollTop > 1);
    }
    _scrollTop() {
      const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      this._target?.scrollTo?.({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      globalThis.scrollTo?.({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    }
  }
  customElements.define('kniu-backtop', KniuBacktop);
}