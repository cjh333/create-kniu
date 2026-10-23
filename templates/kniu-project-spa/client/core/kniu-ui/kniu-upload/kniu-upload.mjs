import KNIU_UPLOAD_TEMPLATE from './kniu-upload.html?module';
export function registerUpload(context) {
  const { BOOLEAN_ATTRIBUTES, IDENTITY, KNIU_BACKTOP_CSS, KNIU_BADGE_CSS, KNIU_BASE_CONTAIN_CSS, KNIU_BASE_FONT_CSS, KNIU_BTN_CSS, KNIU_BTN_GROUP_CSS, KNIU_BTN_METRICS_CSS, KNIU_BTN_OVERRIDES_CSS, KNIU_COMMENT_CSS, KNIU_CONTAIN_EXCLUDE_TAGS, KNIU_CONTENT_TABLE_CSS, KNIU_CONTENT_TABLE_DOC_CSS, KNIU_DATE_PICKER_CSS, KNIU_DATE_PICKER_OVERRIDES_CSS, KNIU_DROPDOWN_CSS, KNIU_DROPDOWN_OPTION_CSS, KNIU_EDITOR_CSS, KNIU_EDITOR_OVERRIDE_CSS, KNIU_EDITOR_PRINT_CSS, KNIU_EMPTY_CSS, KNIU_FONT_FACE_CSS, KNIU_FONT_FAMILY, KNIU_FONT_MONO_FAMILY, KNIU_FONT_SERIF_FAMILY, KNIU_I18N, KNIU_ICON_CSS, KNIU_ICON_FONT_NAMES, KNIU_ICON_NAMES, KNIU_ICON_SVG, KNIU_IMAGE_CSS, KNIU_IMAGE_OVERRIDES_CSS, KNIU_INPUT_AFFIX_CSS, KNIU_INPUT_CSS, KNIU_INPUT_GROUP_CSS, KNIU_INPUT_METRICS_CSS, KNIU_INPUT_PASSWORD_ACTIONS_CSS, KNIU_INPUT_PASSWORD_CSS, KNIU_INPUT_STATES_CSS, KNIU_INPUT_TEXTAREA_CSS, KNIU_INPUT_TIP_CSS, KNIU_LIKE_CSS, KNIU_LOADING_CSS, KNIU_MARKDOWN_CSS, KNIU_MODAL_CONFIRM_CSS, KNIU_MODAL_CSS, KNIU_MSG_CSS, KNIU_NAVBAR_CELLS_CSS, KNIU_NAVBAR_CELL_CSS, KNIU_NAVBAR_CSS, KNIU_NAVBAR_PLACEHOLDER_CSS, KNIU_PAGE_CSS, KNIU_RADIO_GROUP_CSS, KNIU_RICHTEXT_CSS, KNIU_SELECT_CSS, KNIU_STATUS_CSS, KNIU_SUB_NAVBAR_CSS, KNIU_SUB_NAVBAR_OVERRIDES_CSS, KNIU_SWITCH_CSS, KNIU_TABLE_CLASS, KNIU_TABLE_COL_CSS, KNIU_TABLE_CSS, KNIU_TABLE_WRAP_CLASS, KNIU_TAB_CSS, KNIU_TAG_CSS, KNIU_UPLOAD_CSS, KNIU_USER_LOGIN_CSS, KNIU_USER_LOGIN_OVERRIDES_CSS, PRUNABLE_ATTRIBUTE_NAMES, REQUEST, RICH_TEXT_LITERAL_TAG_RE, SCROLL_LOCK_FLAG, SEMANTIC_EMPTY_ATTRIBUTES, SHADOW_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_RE, TEMPLATE, adoptDropdownStyle, adoptSharedStyle, adoptedSheetsFlushScheduled, appendRawStyle, applyScrollLock, attachComponentShadow, buildIconElement, buildPageList, compileTableRowTemplate, componentDefaults, componentLang, componentText, computePopoverLayout, confirm, createRowDeleteHandler, createSearchActions, createTable, debounce, flushPendingAdoptedSheets, getResponseRecords, getShadowInnerHTMLDescriptor, getSharedStyleSheet, hasRichTextLiteralTag, installMarkdownStyles, installOptionsOnlyProtocol, installRichTextStyles, isEmptyAttributeValue, lockDocumentScroll, makeSwitchOptions, mountAffixSlots, mountOptionsValue, mountPopoverPortal, msg, normalizeComponentCss, normalizedCssCache, pendingAdoptedSheets, pruneEmptyAttribute, pruneEmptyAttributeTree, pruneEmptyAttributes, pruneEmptyRootAttributes, readScrollLockOriginals, reconcileDocumentScrollLock, releaseScrollLock, replaceChildrenWithFragment, resolveIconName, resolveTableRowTemplate, sanitizeRichHtml, sanitizeRichHtmlAsync, scheduleAdoptedSheetsFlush, scrollLockNodes, scrollLockOriginals, scrollLockOwners, setLoading, shadowInnerHTMLDescriptor, shadowStyleSheetCache, shadowTemplateCache, shouldContainHost, state, supportsAdoptedStyleSheets, tableTemplateCache, toastInstance, toastTimer, trackPopoverPosition, unlockDocumentScroll, unwrapTablesIn, use, usePage, usePagination, wrapTablesIn, writeScrollLockOriginals } = context;
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
  if (customElements.get('kniu-upload')) return;
  class KniuSysUpload extends HTMLElement {
    static get observedAttributes() { return ['accept', 'multiple', 'max-count', 'max-size', 'disabled']; }
    constructor() {
      super();
      if (Object.prototype.hasOwnProperty.call(this, 'value')) {
        this.__kniuPendingValue = this.value;
        delete this.value;
      }
      attachComponentShadow(this);
      this._files = [];
      this._objectUrls = new Map();
      this.shadowRoot.innerHTML = `<style>${KNIU_UPLOAD_CSS}</style>${KNIU_UPLOAD_TEMPLATE}`;
      this._input = this.shadowRoot.querySelector('.kniu_sys_upload_input');
      this._button = this.shadowRoot.querySelector('.kniu_sys_upload_btn');
      this._hint = this.shadowRoot.querySelector('.kniu_sys_upload_hint');
      this._hintWrap = this.shadowRoot.querySelector('.kniu_sys_upload_hint_wrap');
      this._hintInput = this.shadowRoot.querySelector('.kniu_sys_upload_hint_input');
      this._hintClear = this.shadowRoot.querySelector('.kniu_sys_upload_hint_clear');
      this._wall = this.shadowRoot.querySelector('.kniu_sys_upload_wall');
      this._fileList = this.shadowRoot.querySelector('.kniu_sys_upload_files');
      this._button.addEventListener('click', () => this._input.click());
      this._input.addEventListener('change', () => this._select(Array.from(this._input.files || [])));
      this._hintInput.addEventListener('input', () => this._onHintInput());
      this._hintInput.addEventListener('change', () => this._render());
      const keepHintFocused = (event) => event.preventDefault();
      this._hintClear.addEventListener('pointerdown', keepHintFocused);
      this._hintClear.addEventListener('click', () => {
        if (this._hintClear.getAttribute('aria-disabled') === 'true') return;
        this._hintInput.value = '';
        this._onHintInput();
        this._render();
        this._hintInput.focus();
      });
      this._wall.addEventListener('click', (event) => {
        if (this.hasAttribute('disabled')) return;
        const target = event.target instanceof Element ? event.target : event.target.parentElement;
        const button = target && target.closest('.kniu_sys_upload_remove');
        if (button) this.removeAt(Number(button.dataset.index));
      });
      this._fileList.addEventListener('click', (event) => {
        if (this.hasAttribute('disabled')) return;
        const target = event.target instanceof Element ? event.target : event.target.parentElement;
        const button = target && target.closest('.kniu_sys_upload_file_remove');
        if (button) this.removeAt(Number(button.dataset.index));
      });
    }
    get options() { return this.__kniuOptions || {}; }
    set options(value) {
      this.__kniuOptions = value && typeof value === 'object' ? value : {};
      const opt = this.__kniuOptions;
      if (opt.accept != null) this.setAttribute('accept', String(opt.accept));
      if (opt.maxSize != null) this.setAttribute('max-size', String(opt.maxSize));
      if (opt.maxCount != null) this.setAttribute('max-count', String(opt.maxCount));
      if ('multiple' in opt) {
        if (opt.multiple) this.setAttribute('multiple', '');
        else this.removeAttribute('multiple');
      }
      if ('disabled' in opt) {
        if (opt.disabled) this.setAttribute('disabled', '');
        else this.removeAttribute('disabled');
      }
      if (this._input) { this._sync(); this._render(); }
    }
    connectedCallback() {
      if (this.__kniuPendingValue !== undefined) {
        const pending = this.__kniuPendingValue;
        delete this.__kniuPendingValue;
        this.value = pending;
      }
      mountOptionsValue(this);
      this._sync();
      this._render();
    }
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
    _imageEnabled() {
      const accept = (this.getAttribute('accept') || 'image/*').toLowerCase();
      return accept.split(',').some((part) => part.trim().indexOf('image') === 0);
    }
    _renderFileList() {
      if (this._imageEnabled() || !this.hasAttribute('multiple')) {
        replaceChildrenWithFragment(this._fileList, []);
        this._fileList.hidden = true;
        return;
      }
      const rows = this._files.map((file, index) => {
        const row = document.createElement('div');
        row.className = 'kniu_sys_upload_file_row';
        const name = document.createElement('span');
        name.className = 'kniu_sys_upload_file_name';
        name.textContent = typeof file === 'string' ? file : file.name;
        name.title = name.textContent;
        const remove = document.createElement('button');
        remove.className = 'kniu_sys_upload_file_remove';
        remove.type = 'button';
        remove.disabled = this.hasAttribute('disabled');
        remove.dataset.index = String(index);
        remove.setAttribute('aria-label', '× ' + name.textContent);
        remove.textContent = '×';
        row.append(name, remove);
        return row;
      });
      replaceChildrenWithFragment(this._fileList, rows);
      this._fileList.hidden = rows.length === 0;
    }
    _render() {
      if (!this._imageEnabled()) {
        replaceChildrenWithFragment(this._wall, []);
        this._wall.hidden = true;
        this._renderFileList();
        this._sync();
        return;
      }
      this._fileList.hidden = true;
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
      const single = !this.hasAttribute('multiple');
      this._hint.style.display = single ? 'none' : 'flex';
      this._hintWrap.style.display = single ? 'flex' : 'none';
      if (single) {
        const current = this._files[0];
        const nextValue = current instanceof File ? current.name : (typeof current === 'string' ? current : '');
        if (this._hintInput.value !== nextValue) this._hintInput.value = nextValue;
        // 图片类型提示可选预览，非图片类型（如 .sql）提示请选择文件。
        this._hintInput.placeholder = String(this.__kniuOptions?.note ?? t(this._imageEnabled() ? 'upload.selectPreviewSingle' : 'upload.selectFileSingle'));
        const inputDisabled = this.hasAttribute('disabled');
        this._hintInput.disabled = inputDisabled;
        this._hintClear.setAttribute('aria-disabled', String(inputDisabled));
        this._hintWrap.dataset.clearVisible = String(!inputDisabled && this._hintInput.value.length > 0);
      } else {
        this._hint.textContent = this._files.length
          ? t(this._imageEnabled() ? 'upload.selectedCount' : 'upload.selectedFileCount', { '1': this._files.length })
          : t(this._imageEnabled() ? 'upload.selectPreview' : 'upload.selectFile', { '1': limits.count });
      }
      const btnSlot = this.shadowRoot.querySelector('.kniu_sys_upload_btn > slot');
      if (btnSlot && (!btnSlot.assignedNodes || btnSlot.assignedNodes().length === 0)) btnSlot.textContent = t('upload.select');
    }
    _onHintInput() {
      if (this.hasAttribute('multiple')) return;
      const text = this._hintInput.value.trim();
      const current = this._files[0];
      if (typeof current === 'string' && current === text) return;
      if (current instanceof File) this._revokeFileUrl(current);
      this._files = text ? [text] : [];
      this._hintWrap.dataset.clearVisible = String(!this.hasAttribute('disabled') && this._hintInput.value.length > 0);
      this._emitInput();
    }
  }
  customElements.define('kniu-upload', KniuSysUpload);
}