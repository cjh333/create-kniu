import KNIU_INPUT_TEMPLATE from './kniu-input.html?module';
import KNIU_INPUT_GROUP_TEMPLATE from './kniu-input.group.html?module';

export function registerInput(context) {
  const { BOOLEAN_ATTRIBUTES, IDENTITY, KNIU_BACKTOP_CSS, KNIU_BADGE_CSS, KNIU_BASE_CONTAIN_CSS, KNIU_BASE_FONT_CSS, KNIU_BTN_CSS, KNIU_BTN_GROUP_CSS, KNIU_BTN_METRICS_CSS, KNIU_BTN_OVERRIDES_CSS, KNIU_COMMENT_CSS, KNIU_CONTAIN_EXCLUDE_TAGS, KNIU_CONTENT_TABLE_CSS, KNIU_CONTENT_TABLE_DOC_CSS, KNIU_DATE_PICKER_CSS, KNIU_DATE_PICKER_OVERRIDES_CSS, KNIU_DROPDOWN_CSS, KNIU_DROPDOWN_OPTION_CSS, KNIU_EDITOR_CSS, KNIU_EDITOR_OVERRIDE_CSS, KNIU_EDITOR_PRINT_CSS, KNIU_EMPTY_CSS, KNIU_FONT_FACE_CSS, KNIU_FONT_FAMILY, KNIU_FONT_MONO_FAMILY, KNIU_FONT_SERIF_FAMILY, KNIU_I18N, KNIU_ICON_CSS, KNIU_ICON_FONT_NAMES, KNIU_ICON_NAMES, KNIU_ICON_SVG, KNIU_IMAGE_CSS, KNIU_IMAGE_OVERRIDES_CSS, KNIU_INPUT_AFFIX_CSS, KNIU_INPUT_CSS, KNIU_INPUT_GROUP_CSS, KNIU_INPUT_METRICS_CSS, KNIU_INPUT_PASSWORD_ACTIONS_CSS, KNIU_INPUT_PASSWORD_CSS, KNIU_INPUT_STATES_CSS, KNIU_INPUT_TEXTAREA_CSS, KNIU_INPUT_TIP_CSS, KNIU_LIKE_CSS, KNIU_LOADING_CSS, KNIU_MARKDOWN_CSS, KNIU_MODAL_CONFIRM_CSS, KNIU_MODAL_CSS, KNIU_MSG_CSS, KNIU_NAVBAR_CELLS_CSS, KNIU_NAVBAR_CELL_CSS, KNIU_NAVBAR_CSS, KNIU_NAVBAR_PLACEHOLDER_CSS, KNIU_PAGE_CSS, KNIU_RADIO_GROUP_CSS, KNIU_RICHTEXT_CSS, KNIU_SELECT_CSS, KNIU_STATUS_CSS, KNIU_SUB_NAVBAR_CSS, KNIU_SUB_NAVBAR_OVERRIDES_CSS, KNIU_SWITCH_CSS, KNIU_TABLE_CLASS, KNIU_TABLE_COL_CSS, KNIU_TABLE_CSS, KNIU_TABLE_WRAP_CLASS, KNIU_TAB_CSS, KNIU_TAG_CSS, KNIU_UPLOAD_CSS, KNIU_USER_LOGIN_CSS, KNIU_USER_LOGIN_OVERRIDES_CSS, PRUNABLE_ATTRIBUTE_NAMES, REQUEST, RICH_TEXT_LITERAL_TAG_RE, SCROLL_LOCK_FLAG, SEMANTIC_EMPTY_ATTRIBUTES, SHADOW_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_RE, TEMPLATE, adoptDropdownStyle, adoptSharedStyle, adoptedSheetsFlushScheduled, appendRawStyle, applyScrollLock, attachComponentShadow, buildIconElement, buildPageList, compileTableRowTemplate, componentDefaults, componentLang, componentText, computePopoverLayout, confirm, createRowDeleteHandler, createSearchActions, createTable, debounce, deferAffixTemplateMount, flushPendingAdoptedSheets, getResponseRecords, getShadowInnerHTMLDescriptor, getSharedStyleSheet, hasRichTextLiteralTag, installMarkdownStyles, installOptionsOnlyProtocol, installRichTextStyles, isEmptyAttributeValue, lockDocumentScroll, makeSwitchOptions, mountAffixSlots, mountPopoverPortal, msg, normalizeComponentCss, normalizedCssCache, pendingAdoptedSheets, pruneEmptyAttribute, pruneEmptyAttributeTree, pruneEmptyAttributes, pruneEmptyRootAttributes, readScrollLockOriginals, reconcileDocumentScrollLock, releaseScrollLock, replaceChildrenWithFragment, resolveIconName, resolveTableRowTemplate, sanitizeRichHtml, sanitizeRichHtmlAsync, scheduleAdoptedSheetsFlush, scrollLockNodes, scrollLockOriginals, scrollLockOwners, setLoading, shadowInnerHTMLDescriptor, shadowStyleSheetCache, shadowTemplateCache, shouldContainHost, state, supportsAdoptedStyleSheets, tableTemplateCache, toastInstance, toastTimer, trackPopoverPosition, unlockDocumentScroll, unwrapTablesIn, use, usePage, usePagination, wrapTablesIn, writeScrollLockOriginals } = context;
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
  if (!customElements.get('kniu-input')) {
    class KniuSysInput extends HTMLElement {
      static get observedAttributes() { return ['type', 'name', 'placeholder', 'autocomplete', 'autocapitalize', 'maxlength', 'rows', 'disabled', 'readonly', 'required', 'show-password', 'clearable', 'label-width', 'tip']; }
      constructor() {
        super();
        attachComponentShadow(this);
        if (Object.prototype.hasOwnProperty.call(this, 'value')) {
          this.__kniuPendingValue = this.value;
          delete this.value;
        }
        this.shadowRoot.innerHTML = `<style>${KNIU_INPUT_CSS}</style>${KNIU_INPUT_TEMPLATE}`;
        adoptSharedStyle(this.shadowRoot, KNIU_INPUT_STATES_CSS);
        this._input = this.shadowRoot.querySelector('.kniu_sys_input');
        appendRawStyle(this.shadowRoot, KNIU_INPUT_AFFIX_CSS);
        this._affixObserver = null;
        this._passwordVisible = false;
        adoptSharedStyle(this.shadowRoot, KNIU_INPUT_PASSWORD_CSS);
        const wrap = document.createElement('span');
        wrap.className = 'kniu_sys_input_wrap';
        const passwordButton = document.createElement('span');
        passwordButton.className = 'kniu_sys_input_password';
        passwordButton.setAttribute('role', 'button');
        passwordButton.tabIndex = -1;
        const clearButton = document.createElement('span');
        clearButton.className = 'kniu_sys_input_clear';
        clearButton.setAttribute('role', 'button');
        clearButton.tabIndex = -1;
        clearButton.textContent = '×';
        clearButton.setAttribute('aria-label', '清空输入内容');
        const tipPanel = document.createElement('div');
        tipPanel.className = 'kniu_sys_input_tip';
        tipPanel.setAttribute('role', 'tooltip');
        tipPanel.setAttribute('aria-hidden', 'true');
        this._input.replaceWith(wrap);
        wrap.append(this._input, clearButton, passwordButton, tipPanel);
        adoptSharedStyle(this.shadowRoot, KNIU_INPUT_PASSWORD_ACTIONS_CSS);
        adoptSharedStyle(this.shadowRoot, KNIU_INPUT_TIP_CSS);
        this._wrap = wrap;
        this._passwordButton = passwordButton;
        this._clearButton = clearButton;
        this._tipPanel = tipPanel;
        this._tipState = null;
        const keepInputFocused = (event) => event.preventDefault();
        passwordButton.addEventListener('pointerdown', keepInputFocused);
        clearButton.addEventListener('pointerdown', keepInputFocused);
        passwordButton.addEventListener('click', () => {
          if (passwordButton.disabled) return;
          this._passwordVisible = !this._passwordVisible;
          this._sync();
          this._input.focus();
        });
        clearButton.addEventListener('click', () => {
          if (clearButton.disabled) return;
          this._input.value = '';
          this._syncClearable();
          this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
          this.dispatchEvent(new CustomEvent('clear', { bubbles: true, composed: true }));
          if (this.shadowRoot.activeElement !== this._input) this._input.focus({ preventScroll: true });
        });
        this._bindControl(this._input);
        adoptSharedStyle(this.shadowRoot, KNIU_INPUT_TEXTAREA_CSS);
        appendRawStyle(this.shadowRoot, KNIU_INPUT_METRICS_CSS);
        if (this.__kniuPendingValue !== undefined) {
          this.value = this.__kniuPendingValue;
          delete this.__kniuPendingValue;
        }
        // 升级前经参数包分支写入的 options（模板克隆路径绑定发生在升级前）在此回放，补齐 type/name 等属性反射。
        if (Object.prototype.hasOwnProperty.call(this, '__kniuOptionsValue')) {
          const pendingOptions = this.__kniuOptionsValue;
          delete this.__kniuOptionsValue;
          this.options = pendingOptions;
        }
      }
      connectedCallback() {
        if (!this.hasAttribute('autocomplete')) this.setAttribute('autocomplete', 'off');
        if (!this.hasAttribute('clearable')) this.setAttribute('clearable', '');
        this._mountAffixes();
        this._sync();
        queueMicrotask(() => this._mountAffixes());
        if (!this._affixObserver) {
          this._affixObserver = new MutationObserver(() => this._mountAffixes());
          this._affixObserver.observe(this, { childList: true });
        }
      }
      disconnectedCallback() {
        if (this._affixObserver) this._affixObserver.disconnect();
        this._affixObserver = null;
        if (this._disposeTipTrack) { this._disposeTipTrack(); this._disposeTipTrack = null; }
        if (this._tipState) { this._tipState.unmount(); this._tipState = null; }
      }
      attributeChangedCallback(name) {
        if (!this._input) return;
        if (name === 'label-width') this._mountAffixes();
        this._sync();
      }
      get value() { return this._input.value; }
      set value(value) { this._input.value = value == null ? '' : String(value); this._syncClearable(); }
      static get OPTION_ATTRIBUTES() { return ['type', 'name', 'placeholder', 'autocomplete', 'autocapitalize', 'maxlength', 'rows', 'disabled', 'readonly', 'required', 'show-password', 'clearable', 'label-width', 'tip']; }
      get options() { return this.__kniuOptionsValue || {}; }
      set options(value) {
        this.__kniuOptionsValue = value && typeof value === 'object' ? value : {};
        const keys = this.constructor.OPTION_ATTRIBUTES;
        Object.keys(this.__kniuOptionsValue).forEach((key) => {
          const item = this.__kniuOptionsValue[key];
          if (typeof item === 'function') return;
          const name = String(key).replace(/[A-Z]/g, (char) => '-' + char.toLowerCase());
          if (keys.indexOf(name) === -1) return;
          if (item === true) this.setAttribute(name, '');
          else if (item === false || item == null) this.removeAttribute(name);
          else this.setAttribute(name, String(item));
        });
      }
      focus() { this._input.focus(); }
      select() { this._input.select(); }
      _bindControl(node) {
        node.addEventListener('input', () => {
          this.removeAttribute('data-invalid');
          this._syncClearable();
          this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        });
        node.addEventListener('change', () => this.dispatchEvent(new Event('change', { bubbles: true, composed: true })));
        node.addEventListener('focus', () => this._showTip());
        node.addEventListener('blur', () => this._hideTip());
        if (node.tagName.toLowerCase() !== 'textarea') {
          node.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' || event.isComposing) return;
            const form = this.closest('form') || this.closest('kniu-form')?.querySelector('form');
            if (!form) return;
            event.preventDefault();
            form.requestSubmit();
          });
        }
      }
      _ensureControl() {
        const wantTextarea = (this.getAttribute('type') || 'text') === 'textarea';
        const isTextarea = this._input.tagName.toLowerCase() === 'textarea';
        if (wantTextarea === isTextarea) return;
        const old = this._input;
        const value = old.value;
        const node = wantTextarea ? document.createElement('textarea') : document.createElement('input');
        node.className = 'kniu_sys_input';
        old.replaceWith(node);
        this._input = node;
        this._bindControl(node);
        this._input.value = value;
      }
      _mountAffixes() {
        const group = this.shadowRoot.querySelector('.kniu_sys_input_group');
        ['prepend', 'append'].forEach((name) => {
          const affix = this.shadowRoot.querySelector(`.kniu_sys_input_${name}`);
          const template = Array.from(this.children).find((child) => child.tagName === 'TEMPLATE' && child.hasAttribute(`#${name}`));
          if (template) {
            deferAffixTemplateMount(template, () => {
              const templateLabelWidth = template.getAttribute('label-width')
                || (template.__kniuOptionsValue && template.__kniuOptionsValue.labelWidth)
                || template.getAttribute('data-label-width')
                || '';
              const frag = document.createDocumentFragment();
              Array.from(template.content.childNodes).forEach((node) => {
                if (node.nodeType === 1) {
                  node.setAttribute('slot', name);
                  if (templateLabelWidth) node.dataset.labelWidth = templateLabelWidth;
                  frag.appendChild(node);
                } else if (node.nodeType === 3 && node.textContent.trim()) {
                  const span = document.createElement('span');
                  span.setAttribute('slot', name);
                  if (templateLabelWidth) span.dataset.labelWidth = templateLabelWidth;
                  span.appendChild(node);
                  frag.appendChild(span);
                }
              });
              template.replaceWith(frag);
            }, () => this._mountAffixes());
          }
          const slotContent = this.querySelector(`[slot="${name}"]`);
          const hasSlot = Boolean(slotContent);
          const labelWidth = this.getAttribute('label-width')
            || (slotContent ? (slotContent.dataset.labelWidth || slotContent.getAttribute('label-width') || '') : '');
          if (labelWidth && CSS.supports('width', labelWidth)) {
            // affix 为 border-box 且横向恰有 1px 外边框（append 在右、prepend 在左），宽度补偿 1px 使内容区等于配置的 labelWidth。
            const sized = `calc(${labelWidth} + 1px)`;
            affix.style.width = sized;
            affix.style.flexBasis = sized;
          } else {
            affix.style.removeProperty('width');
            affix.style.removeProperty('flex-basis');
          }
          group.dataset[`has${name[0].toUpperCase()}${name.slice(1)}`] = String(hasSlot);
        });
        ['prepend', 'append'].forEach((name) => {
          const slots = this.querySelectorAll(`[slot="${name}"]`);
          let hasUpload = false;
          let hasButton = false;
          slots.forEach((el) => {
            if (el.matches && el.matches('kniu-upload')) hasUpload = true;
            if (el.querySelector('kniu-upload')) hasUpload = true;
            if (el.matches && el.matches('kniu-btn')) {
              hasButton = true;
              el.setAttribute('block', '');
              if (name === 'append') el.setAttribute('append-borderless', '');
            }
            const nestedButton = el.querySelector('kniu-btn');
            if (nestedButton) {
              hasButton = true;
              nestedButton.setAttribute('block', '');
              if (name === 'append') nestedButton.setAttribute('append-borderless', '');
            }
          });
          if (name === 'append') group.dataset.uploadAppend = String(hasUpload);
          const cap = name[0].toUpperCase() + name.slice(1);
          group.dataset[`has${cap}Btn`] = String(hasButton);
        });
      }
      _sync() {
        this._ensureControl();
        const configuredType = this.getAttribute('type') || 'text';
        const isTextarea = this._input.tagName.toLowerCase() === 'textarea';
        const canShowPassword = !isTextarea && this.hasAttribute('show-password') && configuredType === 'password';
        if (!isTextarea) {
          this._input.type = canShowPassword && this._passwordVisible ? 'text' : configuredType;
        } else {
          const rows = this.getAttribute('rows') || this.getAttribute('row') || '3';
          this._input.setAttribute('rows', rows);
        }
        const group = this.shadowRoot.querySelector('.kniu_sys_input_group');
        if (group) group.dataset.isTextarea = String(isTextarea);
        this._wrap.dataset.showPassword = String(canShowPassword);
        this._passwordButton.innerHTML = this._passwordVisible
          ? '<kniu-icon class="kniu_sys_input_password_icon" icon="eye"></kniu-icon>'
          : '<kniu-icon class="kniu_sys_input_password_icon" icon="uneye"></kniu-icon>';
        this._passwordButton.setAttribute('aria-label', componentText(componentLang(this.__kniuOptions), this._passwordVisible ? 'input.hidePassword' : 'input.showPassword'));
        this._wrap.dataset.clearable = String(this.hasAttribute('clearable'));
        if (this._clearButton) this._clearButton.setAttribute('aria-label', componentText(componentLang(this.__kniuOptions), 'input.clear'));
        ['name', 'placeholder', 'autocomplete', 'autocapitalize', 'maxlength'].forEach((name) => {
          const value = this.getAttribute(name);
          if (value == null) this._input.removeAttribute(name);
          else this._input.setAttribute(name, value);
        });
        ['disabled', 'readonly', 'required'].forEach((name) => { this._input.toggleAttribute(name, this.hasAttribute(name)); });
        this._passwordButton.disabled = this.hasAttribute('disabled');
        this._clearButton.disabled = this.hasAttribute('disabled') || this.hasAttribute('readonly');
        this._passwordButton.setAttribute('aria-disabled', String(this._passwordButton.disabled));
        this._clearButton.setAttribute('aria-disabled', String(this._clearButton.disabled));
        this._passwordButton.tabIndex = -1;
        this._clearButton.tabIndex = -1;
        this._syncClearable();
        this._syncTip();
      }
      _syncClearable() {
        if (!this._wrap || !this._clearButton) return;
        const visible = this.hasAttribute('clearable')
          && this._input.value.length > 0
          && !this.hasAttribute('disabled')
          && !this.hasAttribute('readonly');
        this._wrap.dataset.clearVisible = String(visible);
      }
      _syncTip() {
        if (!this._tipPanel) return;
        const tip = this.getAttribute('tip');
        if (tip == null || tip === '') {
          this._tipPanel.innerHTML = '';
          this._wrap.dataset.hasTip = 'false';
          return;
        }
        const items = String(tip).split(/\n|;/).map((s) => s.trim()).filter(Boolean);
        if (items.length > 1) {
          this._tipPanel.classList.remove('kniu_sys_input_tip--single');
          this._tipPanel.innerHTML = '<ul>' + items.map((item) => '<li>' + String(item).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) + '</li>').join('') + '</ul>';
        } else {
          this._tipPanel.classList.add('kniu_sys_input_tip--single');
          this._tipPanel.textContent = tip;
        }
        this._wrap.dataset.hasTip = 'true';
      }
      _showTip() {
        if (!this._wrap || this.getAttribute('tip') == null || this.getAttribute('tip') === '') return;
        if (!this._tipState) this._tipState = mountPopoverPortal(this._tipPanel, this.shadowRoot, { zIndex: 10030, attribute: 'data-kniu-input-tip-popover' });
        this._tipPanel.dataset.open = 'true';
        this._tipPanel.setAttribute('aria-hidden', 'false');
        const apply = (rect) => {
          const layout = computePopoverLayout(this._tipPanel, rect, { offset: 6 });
          this._tipPanel.style.left = layout.left + 'px';
          this._tipPanel.style.top = layout.top + 'px';
        };
        apply(this._input.getBoundingClientRect());
        if (this._disposeTipTrack) this._disposeTipTrack();
        this._disposeTipTrack = trackPopoverPosition(
          () => { if (!this.isConnected || this._tipPanel.dataset.open !== 'true') return null; return this._input.getBoundingClientRect(); },
          apply,
          null,
          this._input
        );
      }
      _hideTip() {
        if (!this._wrap) return;
        if (this._disposeTipTrack) { this._disposeTipTrack(); this._disposeTipTrack = null; }
        this._tipPanel.dataset.open = 'false';
        this._tipPanel.setAttribute('aria-hidden', 'true');
        if (this._tipState) { this._tipState.unmount(); this._tipState = null; }
      }
    }
    customElements.define('kniu-input', KniuSysInput);
  }
  if (!customElements.get('kniu-input-group')) {
    class KniuSysInputGroup extends HTMLElement {
      static get observedAttributes() { return ['label', 'required', 'label-position', 'label-width']; }
      constructor() {
        super();
        attachComponentShadow(this);
        this._templateObserver = null;
        this.shadowRoot.innerHTML = `<style>${KNIU_INPUT_GROUP_CSS}</style>${KNIU_INPUT_GROUP_TEMPLATE}`;
      }
      connectedCallback() {
        this._mountTemplates();
        this._sync();
        this._detectInput();
        this.shadowRoot.querySelector('slot').addEventListener('slotchange', () => this._detectInput());
        if (!this._templateObserver) {
          this._templateObserver = new MutationObserver(() => {
            this._mountTemplates();
            this._sync();
            this._detectInput();
          });
          this._templateObserver.observe(this, { childList: true });
        }
        queueMicrotask(() => this._syncSiblingMargin());
      }
      disconnectedCallback() {
        if (this._templateObserver) this._templateObserver.disconnect();
        this._templateObserver = null;
      }
      attributeChangedCallback() { if (this.shadowRoot) this._sync(); }
      _mountTemplates() {
        const prepend = Array.from(this.children).find((child) => child.tagName === 'TEMPLATE' && child.hasAttribute('#prepend'));
        if (prepend) {
          const label = prepend.content.textContent.trim();
          const labelWidth = prepend.getAttribute('label-width');
          this.setAttribute('data-template-affix', 'true');
          if (label) this.setAttribute('label', label);
          if (labelWidth) this.setAttribute('label-width', labelWidth);
          prepend.remove();
        }
        const append = Array.from(this.children).find((child) => child.tagName === 'TEMPLATE' && child.hasAttribute('#append'));
        if (append) {
          const content = document.createDocumentFragment();
          content.append(...Array.from(append.content.childNodes));
          append.replaceWith(content);
        }
      }
      _detectInput() {
        const hasControl = this.querySelector(':scope > kniu-input, :scope > kniu-date-picker, :scope > kniu-image, :scope > kniu-switch, :scope > kniu-editor, :scope > kniu-select') != null;
        this.shadowRoot.querySelector('.kniu_sys_input_group').dataset.containsInput = String(hasControl);
      }
      _sync() {
        const position = ['left', 'right', 'top'].includes(this.getAttribute('label-position'))
          ? this.getAttribute('label-position')
          : 'right';
        const group = this.shadowRoot.querySelector('.kniu_sys_input_group');
        group.dataset.position = position;
        const label = (this.getAttribute('label') || '').trim();
        const hasLabel = Boolean(label);
        group.dataset.hasLabel = String(hasLabel);
        const contentEl = this.shadowRoot.querySelector('.kniu_sys_input_content');
        let labelEl = this.shadowRoot.querySelector('.kniu_sys_input_label');
        if (hasLabel) {
          if (!labelEl) {
            labelEl = document.createElement('span');
            labelEl.className = 'kniu_sys_input_label';
            group.insertBefore(labelEl, contentEl);
          }
          labelEl.textContent = label;
          labelEl.dataset.required = String(this.hasAttribute('required'));
          labelEl.style.color = this.getAttribute('data-template-affix') === 'true' ? 'var(--kniu-color-info, #909399)' : '';
        } else if (labelEl) {
          labelEl.remove();
        }
        if (this.hasAttribute('label-width')) this.style.setProperty('--kniu-label-width', this.getAttribute('label-width'));
      }
      _syncSiblingMargin() {
        const next = this.nextElementSibling;
        const hasGroupNext = !!(next && (next.tagName === 'KNIU-INPUT-GROUP' || next.tagName === 'KNIU-FORM-CELL'));
        this.style.marginBottom = hasGroupNext ? 'calc(20/var(--kniu_vw))' : '';
      }
    }
    customElements.define('kniu-input-group', KniuSysInputGroup);
    if (!customElements.get('kniu-form-cell')) {
      class KniuSysFormCell extends KniuSysInputGroup { }
      customElements.define('kniu-form-cell', KniuSysFormCell);
    }
  }
}