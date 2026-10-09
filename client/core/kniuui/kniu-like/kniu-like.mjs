export function registerLike(context) {
  const { BOOLEAN_ATTRIBUTES, IDENTITY, KNIU_BACKTOP_CSS, KNIU_BADGE_CSS, KNIU_BASE_CONTAIN_CSS, KNIU_BASE_FONT_CSS, KNIU_BTN_CSS, KNIU_BTN_GROUP_CSS, KNIU_BTN_METRICS_CSS, KNIU_BTN_OVERRIDES_CSS, KNIU_COMMENT_CSS, KNIU_CONTAIN_EXCLUDE_TAGS, KNIU_CONTENT_TABLE_CSS, KNIU_CONTENT_TABLE_DOC_CSS, KNIU_DATE_PICKER_CSS, KNIU_DATE_PICKER_OVERRIDES_CSS, KNIU_DROPDOWN_CSS, KNIU_DROPDOWN_OPTION_CSS, KNIU_EDITOR_CSS, KNIU_EDITOR_OVERRIDE_CSS, KNIU_EDITOR_PRINT_CSS, KNIU_EMPTY_CSS, KNIU_FONT_FACE_CSS, KNIU_FONT_FAMILY, KNIU_FONT_MONO_FAMILY, KNIU_FONT_SERIF_FAMILY, KNIU_I18N, KNIU_ICON_CSS, KNIU_ICON_FONT_NAMES, KNIU_ICON_NAMES, KNIU_ICON_SVG, KNIU_IMAGE_CSS, KNIU_IMAGE_OVERRIDES_CSS, KNIU_INPUT_AFFIX_CSS, KNIU_INPUT_CSS, KNIU_INPUT_GROUP_CSS, KNIU_INPUT_METRICS_CSS, KNIU_INPUT_PASSWORD_ACTIONS_CSS, KNIU_INPUT_PASSWORD_CSS, KNIU_INPUT_STATES_CSS, KNIU_INPUT_TEXTAREA_CSS, KNIU_INPUT_TIP_CSS, KNIU_LIKE_CSS, KNIU_LOADING_CSS, KNIU_MARKDOWN_CSS, KNIU_MODAL_CONFIRM_CSS, KNIU_MODAL_CSS, KNIU_MSG_CSS, KNIU_NAVBAR_CELLS_CSS, KNIU_NAVBAR_CELL_CSS, KNIU_NAVBAR_CSS, KNIU_NAVBAR_PLACEHOLDER_CSS, KNIU_PAGE_CSS, KNIU_RADIO_GROUP_CSS, KNIU_RICHTEXT_CSS, KNIU_SELECT_CSS, KNIU_STATUS_CSS, KNIU_SUB_NAVBAR_CSS, KNIU_SUB_NAVBAR_OVERRIDES_CSS, KNIU_SWITCH_CSS, KNIU_TABLE_CLASS, KNIU_TABLE_COL_CSS, KNIU_TABLE_CSS, KNIU_TABLE_WRAP_CLASS, KNIU_TAB_CSS, KNIU_TAG_CSS, KNIU_UPLOAD_CSS, KNIU_USER_LOGIN_CSS, KNIU_USER_LOGIN_OVERRIDES_CSS, PRUNABLE_ATTRIBUTE_NAMES, REQUEST, RICH_TEXT_LITERAL_TAG_RE, SCROLL_LOCK_FLAG, SEMANTIC_EMPTY_ATTRIBUTES, SHADOW_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_RE, TEMPLATE, adoptDropdownStyle, adoptSharedStyle, adoptedSheetsFlushScheduled, appendRawStyle, applyScrollLock, attachComponentShadow, buildIconElement, buildPageList, compileTableRowTemplate, componentDefaults, componentLang, componentText, computePopoverLayout, confirm, createRowDeleteHandler, createSearchActions, createTable, debounce, flushPendingAdoptedSheets, getResponseRecords, getShadowInnerHTMLDescriptor, getSharedStyleSheet, hasRichTextLiteralTag, installMarkdownStyles, installOptionsOnlyProtocol, installRichTextStyles, isEmptyAttributeValue, lockDocumentScroll, makeSwitchOptions, mountAffixSlots, mountPopoverPortal, msg, normalizeComponentCss, normalizedCssCache, pendingAdoptedSheets, pruneEmptyAttribute, pruneEmptyAttributeTree, pruneEmptyAttributes, pruneEmptyRootAttributes, readScrollLockOriginals, reconcileDocumentScrollLock, releaseScrollLock, replaceChildrenWithFragment, resolveIconName, resolveTableRowTemplate, sanitizeRichHtml, sanitizeRichHtmlAsync, scheduleAdoptedSheetsFlush, scrollLockNodes, scrollLockOriginals, scrollLockOwners, setLoading, shadowInnerHTMLDescriptor, shadowStyleSheetCache, shadowTemplateCache, shouldContainHost, state, supportsAdoptedStyleSheets, tableTemplateCache, toastInstance, toastTimer, trackPopoverPosition, unlockDocumentScroll, unwrapTablesIn, use, useListPage, usePagination, wrapTablesIn, writeScrollLockOriginals } = context;
  if (typeof customElements === 'undefined' || customElements.get('kniu-like')) return;
  class KniuSysLike extends HTMLElement {
    constructor() {
      super();
      attachComponentShadow(this);
      this._options = {};
      this._handleClick = this._click.bind(this);
    }
    connectedCallback() { this._render(); }
    disconnectedCallback() {
      this.shadowRoot.querySelector('button')?.removeEventListener('click', this._handleClick);
    }
    set options(value) {
      this._options = value && typeof value === 'object' ? value : {};
      this._render();
    }
    get options() { return this._options; }
    _render() {
      const options = this._options || {};
      const count = Math.max(0, Number.parseInt(options.count, 10) || 0);
      const liked = Boolean(options.liked);
      const own = Boolean(options.own);
      const disabled = Boolean(options.disabled || options.loading || own);
      const feedback = Number(options.feedback) || 0;
      this._plusPlaying = false;
      this.toggleAttribute('data-own', own);
      this.shadowRoot.innerHTML = `
          <style>${KNIU_LIKE_CSS}</style>
          <button type="button" aria-label="${liked ? '取消点赞' : '点赞'}" aria-pressed="${liked}" ${disabled ? 'disabled' : ''}>
            <kniu-icon icon="like" aria-hidden="true"></kniu-icon>
            <span class="kniu_sys_like_count">(${count})</span>
          </button>`;
      const button = this.shadowRoot.querySelector('button');
      button?.addEventListener('click', this._handleClick);
      if (liked && feedback > 0 && feedback !== this._lastFeedback) {
        this._lastFeedback = feedback;
        const play = () => {
          if (this._options?.liked && Number(this._options?.feedback) === feedback) {
            this._playPlusOne();
          }
        };
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(play);
        else setTimeout(play, 0);
      }
    }
    _click() {
      if (this._options?.disabled || this._options?.loading || this._options?.own) return;
      const now = Date.now();
      if (this._lastClickAt && now - this._lastClickAt < 500) return;
      this._lastClickAt = now;
      this.dispatchEvent(new CustomEvent('change', {
        detail: { liked: !Boolean(this._options?.liked), count: Math.max(0, Number(this._options?.count) || 0) },
        bubbles: true,
        composed: true
      }));
    }
    _playPlusOne() {
      if (this._plusPlaying) return;
      this._plusPlaying = true;
      const button = this.shadowRoot.querySelector('button');
      if (!button) { this._plusPlaying = false; return; }
      const plus = (this.ownerDocument || document).createElement('span');
      plus.className = 'kniu_sys_like_plus';
      plus.textContent = '+1';
      plus.setAttribute('aria-hidden', 'true');
      plus.addEventListener('animationend', function () { plus.remove(); this._plusPlaying = false; }.bind(this), { once: true });
      button.appendChild(plus);
    }
  }
  customElements.define('kniu-like', KniuSysLike);
}