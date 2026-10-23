import KNIU_IMAGE_TEMPLATE from './kniu-image.html?module';

export function registerImage(context) {
  const { BOOLEAN_ATTRIBUTES, IDENTITY, KNIU_BACKTOP_CSS, KNIU_BADGE_CSS, KNIU_BASE_CONTAIN_CSS, KNIU_BASE_FONT_CSS, KNIU_BTN_CSS, KNIU_BTN_GROUP_CSS, KNIU_BTN_METRICS_CSS, KNIU_BTN_OVERRIDES_CSS, KNIU_COMMENT_CSS, KNIU_CONTAIN_EXCLUDE_TAGS, KNIU_CONTENT_TABLE_CSS, KNIU_CONTENT_TABLE_DOC_CSS, KNIU_DATE_PICKER_CSS, KNIU_DATE_PICKER_OVERRIDES_CSS, KNIU_DROPDOWN_CSS, KNIU_DROPDOWN_OPTION_CSS, KNIU_EDITOR_CSS, KNIU_EDITOR_OVERRIDE_CSS, KNIU_EDITOR_PRINT_CSS, KNIU_EMPTY_CSS, KNIU_FONT_FACE_CSS, KNIU_FONT_FAMILY, KNIU_FONT_MONO_FAMILY, KNIU_FONT_SERIF_FAMILY, KNIU_I18N, KNIU_ICON_CSS, KNIU_ICON_FONT_NAMES, KNIU_ICON_NAMES, KNIU_ICON_SVG, KNIU_IMAGE_CSS, KNIU_IMAGE_OVERRIDES_CSS, KNIU_INPUT_AFFIX_CSS, KNIU_INPUT_CSS, KNIU_INPUT_GROUP_CSS, KNIU_INPUT_METRICS_CSS, KNIU_INPUT_PASSWORD_ACTIONS_CSS, KNIU_INPUT_PASSWORD_CSS, KNIU_INPUT_STATES_CSS, KNIU_INPUT_TEXTAREA_CSS, KNIU_INPUT_TIP_CSS, KNIU_LIKE_CSS, KNIU_LOADING_CSS, KNIU_MARKDOWN_CSS, KNIU_MODAL_CONFIRM_CSS, KNIU_MODAL_CSS, KNIU_MSG_CSS, KNIU_NAVBAR_CELLS_CSS, KNIU_NAVBAR_CELL_CSS, KNIU_NAVBAR_CSS, KNIU_NAVBAR_PLACEHOLDER_CSS, KNIU_PAGE_CSS, KNIU_RADIO_GROUP_CSS, KNIU_RICHTEXT_CSS, KNIU_SELECT_CSS, KNIU_STATUS_CSS, KNIU_SUB_NAVBAR_CSS, KNIU_SUB_NAVBAR_OVERRIDES_CSS, KNIU_SWITCH_CSS, KNIU_TABLE_CLASS, KNIU_TABLE_COL_CSS, KNIU_TABLE_CSS, KNIU_TABLE_WRAP_CLASS, KNIU_TAB_CSS, KNIU_TAG_CSS, KNIU_UPLOAD_CSS, KNIU_USER_LOGIN_CSS, KNIU_USER_LOGIN_OVERRIDES_CSS, PRUNABLE_ATTRIBUTE_NAMES, REQUEST, RICH_TEXT_LITERAL_TAG_RE, SCROLL_LOCK_FLAG, SEMANTIC_EMPTY_ATTRIBUTES, SHADOW_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_RE, TEMPLATE, adoptDropdownStyle, adoptSharedStyle, adoptedSheetsFlushScheduled, appendRawStyle, applyScrollLock, attachComponentShadow, buildIconElement, buildPageList, compileTableRowTemplate, componentDefaults, componentLang, componentText, computePopoverLayout, confirm, createRowDeleteHandler, createSearchActions, createTable, debounce, flushPendingAdoptedSheets, getResponseRecords, getShadowInnerHTMLDescriptor, getSharedStyleSheet, hasRichTextLiteralTag, installMarkdownStyles, installOptionsOnlyProtocol, installRichTextStyles, isEmptyAttributeValue, lockDocumentScroll, makeSwitchOptions, mountAffixSlots, mountPopoverPortal, msg, normalizeComponentCss, normalizedCssCache, pendingAdoptedSheets, pruneEmptyAttribute, pruneEmptyAttributeTree, pruneEmptyAttributes, pruneEmptyRootAttributes, readScrollLockOriginals, reconcileDocumentScrollLock, releaseScrollLock, replaceChildrenWithFragment, resolveIconName, resolveTableRowTemplate, sanitizeRichHtml, sanitizeRichHtmlAsync, scheduleAdoptedSheetsFlush, scrollLockNodes, scrollLockOriginals, scrollLockOwners, setLoading, shadowInnerHTMLDescriptor, shadowStyleSheetCache, shadowTemplateCache, shouldContainHost, state, supportsAdoptedStyleSheets, tableTemplateCache, toastInstance, toastTimer, trackPopoverPosition, unlockDocumentScroll, unwrapTablesIn, use, usePage, usePagination, wrapTablesIn, writeScrollLockOriginals } = context;
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
  if (customElements.get('kniu-image')) return;
  class KniuSysImage extends HTMLElement {
    static get observedAttributes() { return ['src', 'alt', 'fit']; }
    constructor() {
      super();
      attachComponentShadow(this);
      this._fit = 'contain';
      this.shadowRoot.innerHTML = `<style>${KNIU_IMAGE_CSS}</style>${KNIU_IMAGE_TEMPLATE}`;
      this._image = null;
      adoptSharedStyle(this.shadowRoot, KNIU_IMAGE_OVERRIDES_CSS);
      this._status = this.shadowRoot.querySelector('.kniu_sys_image_status');
    }
    connectedCallback() {
      this._mountAffixes();
      queueMicrotask(() => this._mountAffixes());
      this._sync();
    }
    attributeChangedCallback(name) {
      if (name === 'src' || name === 'alt') this._sync();
      else if (name === 'fit') this.fit = this.getAttribute('fit');
    }
    _mountAffixes() {
      mountAffixSlots(this, '.kniu_sys_image_group', 'kniu_sys_image');
      const group = this.shadowRoot.querySelector('.kniu_sys_image_group');
      if (group.dataset.affix !== 'true') return;
      const w = this.style.width || '80px';
      const h = this.style.height || '40px';
      this.style.width = '100%';
      this.style.height = 'auto';
      const wrap = this.shadowRoot.querySelector('.kniu_sys_image_wrap');
      wrap.style.width = w;
      wrap.style.height = h;
    }
    set fit(value) {
      this._fit = ['fill', 'contain', 'cover', 'none', 'scale-down'].includes(value) ? value : 'contain';
      if (this._image) this._image.style.objectFit = this._fit;
    }
    get fit() { return this._fit; }
    get src() { return this.getAttribute('src') || ''; }
    set src(value) { if (value == null) this.removeAttribute('src'); else this.setAttribute('src', String(value)); }
    _createImage() {
      if (this._image) return this._image;
      const image = document.createElement('img');
      image.className = 'kniu_sys_image';
      image.addEventListener('load', () => {
        this._status.dataset.hidden = 'true';
        this.dispatchEvent(new Event('load', { bubbles: true, composed: true }));
      });
      image.addEventListener('error', () => {
        this._status.textContent = componentText(componentLang(this.__kniuOptions), 'image.error');
        this._status.dataset.hidden = 'false';
        this.dispatchEvent(new Event('error', { bubbles: true, composed: true }));
      });
      this.shadowRoot.querySelector('.kniu_sys_image_wrap').prepend(image);
      this._image = image;
      return image;
    }
    _removeImage() {
      if (!this._image) return;
      this._image.remove();
      this._image = null;
    }
    _sync() {
      const src = this.getAttribute('src') || '';
      if (src.indexOf('{{') !== -1) return;
      if (!src) {
        this._removeImage();
        this._status.textContent = componentText(componentLang(this.__kniuOptions), 'image.empty');
        this._status.dataset.hidden = 'false';
        return;
      }
      const image = this._createImage();
      image.alt = this.getAttribute('alt') || '';
      const fitAttr = this.getAttribute('fit');
      if (fitAttr) this.fit = fitAttr;
      image.style.objectFit = this._fit;
      if (image.src !== src) {
        this._status.textContent = componentText(componentLang(this.__kniuOptions), 'image.loading');
        this._status.dataset.hidden = 'false';
        image.src = src;
      }
    }
  }
  customElements.define('kniu-image', KniuSysImage);
}