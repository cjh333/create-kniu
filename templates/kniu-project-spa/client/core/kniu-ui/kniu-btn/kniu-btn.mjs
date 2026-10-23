import KNIU_BTN_TEMPLATE from './kniu-btn.html?module';

export function registerButton(context) {
  const { BOOLEAN_ATTRIBUTES, IDENTITY, KNIU_BACKTOP_CSS, KNIU_BADGE_CSS, KNIU_BASE_CONTAIN_CSS, KNIU_BASE_FONT_CSS, KNIU_BTN_CSS, KNIU_BTN_GROUP_CSS, KNIU_BTN_METRICS_CSS, KNIU_BTN_OVERRIDES_CSS, KNIU_COMMENT_CSS, KNIU_CONTAIN_EXCLUDE_TAGS, KNIU_CONTENT_TABLE_CSS, KNIU_CONTENT_TABLE_DOC_CSS, KNIU_DATE_PICKER_CSS, KNIU_DATE_PICKER_OVERRIDES_CSS, KNIU_DROPDOWN_CSS, KNIU_DROPDOWN_OPTION_CSS, KNIU_EDITOR_CSS, KNIU_EDITOR_OVERRIDE_CSS, KNIU_EDITOR_PRINT_CSS, KNIU_EMPTY_CSS, KNIU_FONT_FACE_CSS, KNIU_FONT_FAMILY, KNIU_FONT_MONO_FAMILY, KNIU_FONT_SERIF_FAMILY, KNIU_I18N, KNIU_ICON_CSS, KNIU_ICON_FONT_NAMES, KNIU_ICON_NAMES, KNIU_ICON_SVG, KNIU_IMAGE_CSS, KNIU_IMAGE_OVERRIDES_CSS, KNIU_INPUT_AFFIX_CSS, KNIU_INPUT_CSS, KNIU_INPUT_GROUP_CSS, KNIU_INPUT_METRICS_CSS, KNIU_INPUT_PASSWORD_ACTIONS_CSS, KNIU_INPUT_PASSWORD_CSS, KNIU_INPUT_STATES_CSS, KNIU_INPUT_TEXTAREA_CSS, KNIU_INPUT_TIP_CSS, KNIU_LIKE_CSS, KNIU_LOADING_CSS, KNIU_MARKDOWN_CSS, KNIU_MODAL_CONFIRM_CSS, KNIU_MODAL_CSS, KNIU_MSG_CSS, KNIU_NAVBAR_CELLS_CSS, KNIU_NAVBAR_CELL_CSS, KNIU_NAVBAR_CSS, KNIU_NAVBAR_PLACEHOLDER_CSS, KNIU_PAGE_CSS, KNIU_RADIO_GROUP_CSS, KNIU_RICHTEXT_CSS, KNIU_SELECT_CSS, KNIU_STATUS_CSS, KNIU_SUB_NAVBAR_CSS, KNIU_SUB_NAVBAR_OVERRIDES_CSS, KNIU_SWITCH_CSS, KNIU_TABLE_CLASS, KNIU_TABLE_COL_CSS, KNIU_TABLE_CSS, KNIU_TABLE_WRAP_CLASS, KNIU_TAB_CSS, KNIU_TAG_CSS, KNIU_UPLOAD_CSS, KNIU_USER_LOGIN_CSS, KNIU_USER_LOGIN_OVERRIDES_CSS, PRUNABLE_ATTRIBUTE_NAMES, REQUEST, RICH_TEXT_LITERAL_TAG_RE, SCROLL_LOCK_FLAG, SEMANTIC_EMPTY_ATTRIBUTES, SHADOW_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_RE, TEMPLATE, adoptDropdownStyle, adoptSharedStyle, adoptedSheetsFlushScheduled, appendRawStyle, applyScrollLock, attachComponentShadow, buildIconElement, buildPageList, compileTableRowTemplate, componentDefaults, componentLang, componentText, computePopoverLayout, confirm, createRowDeleteHandler, createSearchActions, createTable, debounce, flushPendingAdoptedSheets, getResponseRecords, getShadowInnerHTMLDescriptor, getSharedStyleSheet, hasRichTextLiteralTag, installMarkdownStyles, installOptionsOnlyProtocol, installRichTextStyles, isEmptyAttributeValue, lockDocumentScroll, makeSwitchOptions, mountAffixSlots, mountOptionsValue, mountPopoverPortal, msg, normalizeComponentCss, normalizedCssCache, pendingAdoptedSheets, pruneEmptyAttribute, pruneEmptyAttributeTree, pruneEmptyAttributes, pruneEmptyRootAttributes, readScrollLockOriginals, reconcileDocumentScrollLock, releaseScrollLock, replaceChildrenWithFragment, resolveIconName, resolveTableRowTemplate, sanitizeRichHtml, sanitizeRichHtmlAsync, scheduleAdoptedSheetsFlush, scrollLockNodes, scrollLockOriginals, scrollLockOwners, setLoading, shadowInnerHTMLDescriptor, shadowStyleSheetCache, shadowTemplateCache, shouldContainHost, state, supportsAdoptedStyleSheets, tableTemplateCache, toastInstance, toastTimer, trackPopoverPosition, unlockDocumentScroll, unwrapTablesIn, use, usePage, usePagination, wrapTablesIn, writeScrollLockOriginals } = context;
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
  if (customElements.get('kniu-btn')) return;
  class KniuSysButton extends HTMLElement {
    static get observedAttributes() {
      return ['size', 'type', 'plain', 'text', 'bg', 'link', 'round', 'circle', 'loading', 'loading-icon', 'disabled', 'icon', 'autofocus', 'native-type', 'auto-insert-space', 'color', 'dark', 'tag', 'block', 'unstyled'];
    }
    constructor() {
      super();
      attachComponentShadow(this);
      this.shadowRoot.innerHTML = `<style>${KNIU_BTN_CSS}</style>${KNIU_BTN_TEMPLATE}`;
      this._button = this.shadowRoot.querySelector('.kniu_sys_button');
      appendRawStyle(this.shadowRoot, KNIU_BTN_METRICS_CSS);
      this._bindButton();
      this.shadowRoot.querySelector('slot').addEventListener('slotchange', () => this._syncAutoSpace());
      adoptSharedStyle(this.shadowRoot, KNIU_BTN_OVERRIDES_CSS);
    }
    _bindButton() {
      this._icon = this._button.querySelector('.kniu_sys_button_icon');
      this._loadingIcon = this._button.querySelector('.kniu_sys_button_loading');
      this._label = this._button.querySelector('.kniu_sys_button_label');
      this._button.addEventListener('click', (event) => {
        if (this.hasAttribute('disabled') || this.hasAttribute('loading')) {
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        if (this._button.type !== 'submit' || this._button.disabled) return;
        const form = this.closest('form') || this.closest('kniu-form')?.querySelector('form');
        if (!form) return;
        event.preventDefault();
        form.requestSubmit();
      });
    }
    connectedCallback() { mountOptionsValue(this); this._sync(); }
    attributeChangedCallback() { if (this._button) this._sync(); }
    get nav() { return this._nav || ''; }
    set nav(value) {
      this._nav = value == null ? '' : String(value);
      if (this._nav) this.setAttribute('data-nav', this._nav);
      else this.removeAttribute('data-nav');
    }
    _syncTag() {
      const requested = (this.getAttribute('tag') || 'button').toLowerCase();
      const tag = /^[a-z][a-z0-9-]*$/.test(requested) ? requested : 'button';
      if (this._button.tagName.toLowerCase() === tag) return;
      const next = document.createElement(tag);
      [...this._button.attributes].forEach((attr) => next.setAttribute(attr.name, attr.value));
      while (this._button.firstChild) next.append(this._button.firstChild);
      this._button.replaceWith(next);
      this._button = next;
      this._bindButton();
    }
    _syncAutoSpace() {
      if (!this._label) return;
      const text = this.textContent.trim();
      this._label.dataset.autoSpace = String(this.hasAttribute('auto-insert-space') && /^[\u3400-\u9fff]{2}$/.test(text));
    }
    _sync() {
      this._syncTag();
      const type = ['primary', 'success', 'warning', 'danger', 'info'].includes(this.getAttribute('type')) ? this.getAttribute('type') : 'default';
      const requestedSize = this.getAttribute('size') || 'default';
      const size = requestedSize === 'medium' ? 'default' : (requestedSize === 'mini' ? 'small' : requestedSize);
      this._button.dataset.type = type;
      this._button.dataset.size = ['large', 'small'].includes(size) ? size : 'default';
      ['plain', 'text', 'bg', 'link', 'round', 'circle', 'loading', 'block', 'unstyled'].forEach((name) => {
        this._button.dataset[name] = String(this.hasAttribute(name));
      });
      if (this._button instanceof HTMLButtonElement) {
        this._button.type = this.getAttribute('native-type') || 'button';
        this._button.disabled = this.hasAttribute('disabled') || this.hasAttribute('loading');
        this._button.autofocus = this.hasAttribute('autofocus');
      } else {
        this._button.setAttribute('role', 'button');
        this._button.tabIndex = this.hasAttribute('disabled') ? -1 : 0;
        this._button.toggleAttribute('aria-disabled', this.hasAttribute('disabled') || this.hasAttribute('loading'));
      }
      const icon = (this.getAttribute('icon') || '').trim();
      const iconName = resolveIconName(icon);
      if (iconName) {
        this._icon.className = 'kniu_sys_button_icon kniu_sys_button_icon_glyph';
        this._icon.innerHTML = buildIconElement(iconName);
      } else {
        this._icon.className = `kniu_sys_button_icon${icon ? ` ${icon}` : ''}`;
        this._icon.innerHTML = '';
      }
      const loadingIcon = this.getAttribute('loading-icon') || '';
      this._loadingIcon.className = `kniu_sys_button_loading${loadingIcon ? ` ${loadingIcon}` : ''}`;
      const color = this.getAttribute('color') || '';
      if (color && CSS.supports('color', color)) {
        this._button.style.setProperty('--kniu-button-border', color);
        this._button.style.setProperty('--kniu-button-bg', this.hasAttribute('dark') ? `color-mix(in srgb,${color} 80%,#000)` : color);
        this._button.style.setProperty('--kniu-button-hover-border', `color-mix(in srgb,${color} 70%,#fff)`);
        this._button.style.setProperty('--kniu-button-hover-bg', `color-mix(in srgb,${color} 70%,#fff)`);
        this._button.style.setProperty('--kniu-button-color', '#fff');
        this._button.style.setProperty('--kniu-button-hover-color', '#fff');
      } else {
        ['--kniu-button-border', '--kniu-button-bg', '--kniu-button-hover-border', '--kniu-button-hover-bg', '--kniu-button-color', '--kniu-button-hover-color'].forEach((name) => this._button.style.removeProperty(name));
      }
      this._button.setAttribute('aria-busy', String(this.hasAttribute('loading')));
      this._syncAutoSpace();
    }
  }
  customElements.define('kniu-btn', KniuSysButton);
  // 启用 options-only 协议：:option 形参经 options setter 落地为属性，未升级时的形参包由 mountOptionsValue 兜底消费。
  installOptionsOnlyProtocol('kniu-btn');
}