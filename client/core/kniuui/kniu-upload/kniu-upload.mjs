import KNIU_UPLOAD_TEMPLATE from './kniu-upload.html?module';
export function registerUpload(context) {
  const { BOOLEAN_ATTRIBUTES, IDENTITY, KNIU_BACKTOP_CSS, KNIU_BADGE_CSS, KNIU_BASE_CONTAIN_CSS, KNIU_BASE_FONT_CSS, KNIU_BTN_CSS, KNIU_BTN_GROUP_CSS, KNIU_BTN_METRICS_CSS, KNIU_BTN_OVERRIDES_CSS, KNIU_COMMENT_CSS, KNIU_CONTAIN_EXCLUDE_TAGS, KNIU_CONTENT_TABLE_CSS, KNIU_CONTENT_TABLE_DOC_CSS, KNIU_DATE_PICKER_CSS, KNIU_DATE_PICKER_OVERRIDES_CSS, KNIU_DROPDOWN_CSS, KNIU_DROPDOWN_OPTION_CSS, KNIU_EDITOR_CSS, KNIU_EDITOR_OVERRIDE_CSS, KNIU_EDITOR_PRINT_CSS, KNIU_EMPTY_CSS, KNIU_FONT_FACE_CSS, KNIU_FONT_FAMILY, KNIU_FONT_MONO_FAMILY, KNIU_FONT_SERIF_FAMILY, KNIU_I18N, KNIU_ICON_CSS, KNIU_ICON_FONT_NAMES, KNIU_ICON_NAMES, KNIU_ICON_SVG, KNIU_IMAGE_CSS, KNIU_IMAGE_OVERRIDES_CSS, KNIU_INPUT_AFFIX_CSS, KNIU_INPUT_CSS, KNIU_INPUT_GROUP_CSS, KNIU_INPUT_METRICS_CSS, KNIU_INPUT_PASSWORD_ACTIONS_CSS, KNIU_INPUT_PASSWORD_CSS, KNIU_INPUT_STATES_CSS, KNIU_INPUT_TEXTAREA_CSS, KNIU_INPUT_TIP_CSS, KNIU_LIKE_CSS, KNIU_LOADING_CSS, KNIU_MARKDOWN_CSS, KNIU_MODAL_CONFIRM_CSS, KNIU_MODAL_CSS, KNIU_MSG_CSS, KNIU_NAVBAR_CELLS_CSS, KNIU_NAVBAR_CELL_CSS, KNIU_NAVBAR_CSS, KNIU_NAVBAR_PLACEHOLDER_CSS, KNIU_PAGE_CSS, KNIU_RADIO_GROUP_CSS, KNIU_RICHTEXT_CSS, KNIU_SELECT_CSS, KNIU_STATUS_CSS, KNIU_SUB_NAVBAR_CSS, KNIU_SUB_NAVBAR_OVERRIDES_CSS, KNIU_SWITCH_CSS, KNIU_TABLE_CLASS, KNIU_TABLE_COL_CSS, KNIU_TABLE_CSS, KNIU_TABLE_WRAP_CLASS, KNIU_TAB_CSS, KNIU_TAG_CSS, KNIU_UPLOAD_CSS, KNIU_USER_LOGIN_CSS, KNIU_USER_LOGIN_OVERRIDES_CSS, PRUNABLE_ATTRIBUTE_NAMES, REQUEST, RICH_TEXT_LITERAL_TAG_RE, SCROLL_LOCK_FLAG, SEMANTIC_EMPTY_ATTRIBUTES, SHADOW_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_RE, TEMPLATE, adoptDropdownStyle, adoptSharedStyle, adoptedSheetsFlushScheduled, appendRawStyle, applyScrollLock, attachComponentShadow, buildIconElement, buildPageList, compileTableRowTemplate, componentDefaults, componentLang, componentText, computePopoverLayout, confirm, createRowDeleteHandler, createSearchActions, createTable, debounce, flushPendingAdoptedSheets, getResponseRecords, getShadowInnerHTMLDescriptor, getSharedStyleSheet, hasRichTextLiteralTag, installMarkdownStyles, installOptionsOnlyProtocol, installRichTextStyles, isEmptyAttributeValue, lockDocumentScroll, makeSwitchOptions, mountAffixSlots, mountPopoverPortal, msg, normalizeComponentCss, normalizedCssCache, pendingAdoptedSheets, pruneEmptyAttribute, pruneEmptyAttributeTree, pruneEmptyAttributes, pruneEmptyRootAttributes, readScrollLockOriginals, reconcileDocumentScrollLock, releaseScrollLock, replaceChildrenWithFragment, resolveIconName, resolveTableRowTemplate, sanitizeRichHtml, sanitizeRichHtmlAsync, scheduleAdoptedSheetsFlush, scrollLockNodes, scrollLockOriginals, scrollLockOwners, setLoading, shadowInnerHTMLDescriptor, shadowStyleSheetCache, shadowTemplateCache, shouldContainHost, state, supportsAdoptedStyleSheets, tableTemplateCache, toastInstance, toastTimer, trackPopoverPosition, unlockDocumentScroll, unwrapTablesIn, use, useListPage, usePagination, wrapTablesIn, writeScrollLockOriginals } = context;
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
  if (customElements.get('kniu-upload')) return;
  class KniuSysUpload extends HTMLElement {
    static get observedAttributes() { return ['accept', 'multiple', 'max-count', 'max-size', 'disabled']; }
    constructor() {
      super();
      attachComponentShadow(this);
      this._files = [];
      this._objectUrls = new Map();
      this.shadowRoot.innerHTML = `<style>${KNIU_UPLOAD_CSS}</style>${KNIU_UPLOAD_TEMPLATE}`;
      this._input = this.shadowRoot.querySelector('.kniu_sys_upload_input');
      this._button = this.shadowRoot.querySelector('.kniu_sys_upload_btn');
      this._hint = this.shadowRoot.querySelector('.kniu_sys_upload_hint');
      this._wall = this.shadowRoot.querySelector('.kniu_sys_upload_wall');
      this._button.addEventListener('click', () => this._input.click());
      this._input.addEventListener('change', () => this._select(Array.from(this._input.files || [])));
      this._wall.addEventListener('click', (event) => {
        if (this.hasAttribute('disabled')) return;
        const target = event.target instanceof Element ? event.target : event.target.parentElement;
        const button = target && target.closest('.kniu_sys_upload_remove');
        if (button) this.removeAt(Number(button.dataset.index));
      });
    }
    connectedCallback() { this._sync(); this._render(); }
    disconnectedCallback() { this._revokeUrls(); }
    attributeChangedCallback() { if (this._input) this._sync(); }
    get value() { return this._files.slice(); }
    set value(value) {
      const next = Array.isArray(value) ? value.filter((file) => {
        return (typeof File !== 'undefined' && file instanceof File)
          || (typeof file === 'string' && file.trim().length > 0);
      }) : [];
      if (next.length === this._files.length && next.every((file, index) => file === this._files[index])) return;
      this._files.forEach((file) => { if (!next.includes(file)) this._revokeFileUrl(file); });
      this._files = next;
      this._render();
    }
    get files() { return this.value; }
    clear() { this._revokeUrls(); this._files = []; this._input.value = ''; this._render(); this._emitInput(); }
    removeAt(index) {
      if (!Number.isInteger(index) || index < 0 || index >= this._files.length) return;
      const removed = this._files.splice(index, 1)[0];
      this._revokeFileUrl(removed);
      this._render();
      this._emitInput();
      this.dispatchEvent(new CustomEvent('remove', { detail: removed, bubbles: true, composed: true }));
    }
    _limits() {
      const size = Number(this.getAttribute('max-size'));
      const count = this.hasAttribute('multiple') ? Number.parseInt(this.getAttribute('max-count'), 10) : 1;
      return {
        bytes: Number.isFinite(size) && size > 0 ? size * 1024 * 1024 : Infinity,
        count: Number.isFinite(count) && count > 0 ? count : (this.hasAttribute('multiple') ? Infinity : 1)
      };
    }
    _select(selected) {
      const limits = this._limits();
      const valid = selected.filter((file) => {
        if (file.size <= limits.bytes) return true;
        this._notice(componentText(componentLang(this.__kniuOptions), 'upload.tooLarge', { '1': file.name, '2': this.getAttribute('max-size') }), 'error');
        return false;
      });
      if (!this.hasAttribute('multiple')) {
        if (valid.length) {
          this._revokeUrls();
          this._files = [valid[valid.length - 1]];
        }
        this._input.value = '';
        this._render();
        this._emitInput();
        return;
      }
      const room = Math.max(0, limits.count - this._files.length);
      if (valid.length > room) {
        this._notice(componentText(componentLang(this.__kniuOptions), 'upload.maxCount', { '1': limits.count }), 'warning');
        this.dispatchEvent(new CustomEvent('exceed', { detail: { files: valid, maxCount: limits.count }, bubbles: true, composed: true }));
      }
      this._files.push(...valid.slice(0, room));
      this._input.value = '';
      this._render();
      this._emitInput();
    }
    _emitInput() {
      this.dispatchEvent(new CustomEvent('input', { detail: this.value, bubbles: true, composed: true }));
      this.dispatchEvent(new CustomEvent('change', { detail: this.value, bubbles: true, composed: true }));
    }
    _notice(content, type) {
      if (typeof this.$msg === 'function') this.$msg({ content: content, type: type });
      else if (typeof msg === 'function') msg({ content: content, type: type });
    }
    _revokeFileUrl(file) {
      const url = this._objectUrls.get(file);
      if (!url) return;
      URL.revokeObjectURL(url);
      this._objectUrls.delete(file);
    }
    _revokeUrls() { this._objectUrls.forEach((url) => URL.revokeObjectURL(url)); this._objectUrls.clear(); }
    _render() {
      const previews = this._files.map((file, index) => {
        const item = document.createElement('div');
        item.className = 'kniu_sys_upload_item';
        const image = document.createElement('img');
        image.className = 'kniu_sys_upload_image';
        const isStoredImage = typeof file === 'string';
        const uploadT = (k, p) => componentText(componentLang(this.__kniuOptions), k, p);
        image.alt = isStoredImage ? uploadT('upload.uploaded') : file.name;
        let url = isStoredImage ? file : this._objectUrls.get(file);
        if (!url && !isStoredImage) {
          url = URL.createObjectURL(file);
          this._objectUrls.set(file, url);
        }
        image.src = url;
        const remove = document.createElement('button');
        remove.className = 'kniu_sys_upload_remove';
        remove.type = 'button';
        remove.disabled = this.hasAttribute('disabled');
        remove.dataset.index = String(index);
        remove.setAttribute('aria-label', uploadT('upload.deleteAria', { '1': isStoredImage ? uploadT('upload.uploaded') : file.name }));
        remove.textContent = '×';
        item.append(image, remove);
        return item;
      });
      if (previews.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'kniu_sys_upload_item kniu_sys_upload_empty';
        const emptyNote = this.__kniuOptions?.note ?? componentText(componentLang(this.__kniuOptions), 'upload.empty');
        empty.setAttribute('aria-label', String(emptyNote));
        empty.innerHTML = '<kniu-icon icon="picture" aria-hidden="true"></kniu-icon><span></span>';
        empty.querySelector('span').textContent = String(emptyNote);
        previews.push(empty);
      }
      replaceChildrenWithFragment(this._wall, previews);
      this._wall.hidden = false;
      this._sync();
    }
    _sync() {
      const limits = this._limits();
      this._input.accept = this.getAttribute('accept') || 'image/*';
      this._input.multiple = this.hasAttribute('multiple');
      this._input.disabled = this.hasAttribute('disabled')
        || (this.hasAttribute('multiple') && this._files.length >= limits.count);
      this._button.disabled = this._input.disabled;
      const t = (k, p) => componentText(componentLang(this.__kniuOptions), k, p);
      this._hint.textContent = this._files.length
        ? t('upload.selectedCount', { '1': this._files.length })
        : (this.hasAttribute('multiple') ? t('upload.selectPreview', { '1': limits.count }) : t('upload.selectPreviewSingle'));
      const btnSlot = this.shadowRoot.querySelector('.kniu_sys_upload_btn > slot');
      if (btnSlot && (!btnSlot.assignedNodes || btnSlot.assignedNodes().length === 0)) btnSlot.textContent = t('upload.select');
    }
  }
  customElements.define('kniu-upload', KniuSysUpload);
}
