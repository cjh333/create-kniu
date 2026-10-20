import KNIU_NAVBAR_TEMPLATE from './kniu-navbar.html?module';
import KNIU_NAVBAR_CELL_TEMPLATE from './kniu-navbar-cell.html?module';
import KNIU_SUB_NAVBAR_TEMPLATE from './kniu-sub-navbar.html?module';

export function registerNavbar(context) {
  const { BOOLEAN_ATTRIBUTES, IDENTITY, KNIU_BACKTOP_CSS, KNIU_BADGE_CSS, KNIU_BASE_CONTAIN_CSS, KNIU_BASE_FONT_CSS, KNIU_BTN_CSS, KNIU_BTN_GROUP_CSS, KNIU_BTN_METRICS_CSS, KNIU_BTN_OVERRIDES_CSS, KNIU_COMMENT_CSS, KNIU_CONTAIN_EXCLUDE_TAGS, KNIU_CONTENT_TABLE_CSS, KNIU_CONTENT_TABLE_DOC_CSS, KNIU_DATE_PICKER_CSS, KNIU_DATE_PICKER_OVERRIDES_CSS, KNIU_DROPDOWN_CSS, KNIU_DROPDOWN_OPTION_CSS, KNIU_EDITOR_CSS, KNIU_EDITOR_OVERRIDE_CSS, KNIU_EDITOR_PRINT_CSS, KNIU_EMPTY_CSS, KNIU_FONT_FACE_CSS, KNIU_FONT_FAMILY, KNIU_FONT_MONO_FAMILY, KNIU_FONT_SERIF_FAMILY, KNIU_I18N, KNIU_ICON_CSS, KNIU_ICON_FONT_NAMES, KNIU_ICON_NAMES, KNIU_ICON_SVG, KNIU_IMAGE_CSS, KNIU_IMAGE_OVERRIDES_CSS, KNIU_INPUT_AFFIX_CSS, KNIU_INPUT_CSS, KNIU_INPUT_GROUP_CSS, KNIU_INPUT_METRICS_CSS, KNIU_INPUT_PASSWORD_ACTIONS_CSS, KNIU_INPUT_PASSWORD_CSS, KNIU_INPUT_STATES_CSS, KNIU_INPUT_TEXTAREA_CSS, KNIU_INPUT_TIP_CSS, KNIU_LIKE_CSS, KNIU_LOADING_CSS, KNIU_MARKDOWN_CSS, KNIU_MODAL_CONFIRM_CSS, KNIU_MODAL_CSS, KNIU_MSG_CSS, KNIU_NAVBAR_CELLS_CSS, KNIU_NAVBAR_CELL_CSS, KNIU_NAVBAR_CSS, KNIU_NAVBAR_PLACEHOLDER_CSS, KNIU_PAGE_CSS, KNIU_RADIO_GROUP_CSS, KNIU_RICHTEXT_CSS, KNIU_SELECT_CSS, KNIU_STATUS_CSS, KNIU_SUB_NAVBAR_CSS, KNIU_SUB_NAVBAR_OVERRIDES_CSS, KNIU_SWITCH_CSS, KNIU_TABLE_CLASS, KNIU_TABLE_COL_CSS, KNIU_TABLE_CSS, KNIU_TABLE_WRAP_CLASS, KNIU_TAB_CSS, KNIU_TAG_CSS, KNIU_UPLOAD_CSS, KNIU_USER_LOGIN_CSS, KNIU_USER_LOGIN_OVERRIDES_CSS, PRUNABLE_ATTRIBUTE_NAMES, REQUEST, RICH_TEXT_LITERAL_TAG_RE, SCROLL_LOCK_FLAG, SEMANTIC_EMPTY_ATTRIBUTES, SHADOW_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_RE, TEMPLATE, adoptDropdownStyle, adoptSharedStyle, adoptedSheetsFlushScheduled, appendRawStyle, applyScrollLock, attachComponentShadow, buildIconElement, buildPageList, compileTableRowTemplate, componentDefaults, componentLang, componentText, computePopoverLayout, confirm, createRowDeleteHandler, createSearchActions, createTable, debounce, flushPendingAdoptedSheets, getResponseRecords, getShadowInnerHTMLDescriptor, getSharedStyleSheet, hasRichTextLiteralTag, installMarkdownStyles, installOptionsOnlyProtocol, installRichTextStyles, isEmptyAttributeValue, lockDocumentScroll, makeSwitchOptions, mountAffixSlots, mountPopoverPortal, msg, normalizeComponentCss, normalizedCssCache, pendingAdoptedSheets, pruneEmptyAttribute, pruneEmptyAttributeTree, pruneEmptyAttributes, pruneEmptyRootAttributes, readScrollLockOriginals, reconcileDocumentScrollLock, releaseScrollLock, replaceChildrenWithFragment, resolveIconName, resolveTableRowTemplate, sanitizeRichHtml, sanitizeRichHtmlAsync, scheduleAdoptedSheetsFlush, scrollLockNodes, scrollLockOriginals, scrollLockOwners, setLoading, shadowInnerHTMLDescriptor, shadowStyleSheetCache, shadowTemplateCache, shouldContainHost, state, supportsAdoptedStyleSheets, tableTemplateCache, toastInstance, toastTimer, trackPopoverPosition, unlockDocumentScroll, unwrapTablesIn, use, usePage, usePagination, wrapTablesIn, writeScrollLockOriginals } = context;
  if (typeof customElements === 'undefined') return;

  function ensureNavbarPlaceholderStyle(ownerDocument) {
    const doc = ownerDocument || document;
    if (!doc || doc.getElementById('kniu_sys_navbar_placeholder_style')) return;
    const style = doc.createElement('style');
    style.id = 'kniu_sys_navbar_placeholder_style';
    style.textContent = KNIU_NAVBAR_PLACEHOLDER_CSS;
    (doc.head || doc.documentElement).appendChild(style);
  }

  if (!customElements.get('kniu-navbar-cells')) {
    class KniuNavbarCells extends HTMLElement {
      constructor() {
        super();
        attachComponentShadow(this);
        this.shadowRoot.innerHTML = `
            <style>${KNIU_NAVBAR_CELLS_CSS}</style>
            <slot></slot>`;
      }
    }
    customElements.define('kniu-navbar-cells', KniuNavbarCells);
  }

  if (!customElements.get('kniu-navbar-cell')) {
    class KniuNavbarCell extends HTMLElement {
      static get observedAttributes() { return ['route', 'href', 'active', 'disabled', 'side', 'level']; }
      constructor() {
        super();
        attachComponentShadow(this);
        this.shadowRoot.innerHTML = `
            <style>${KNIU_NAVBAR_CELL_CSS}</style>
            ${KNIU_NAVBAR_CELL_TEMPLATE}`;
        this._link = this.shadowRoot.querySelector('a');
      }
      connectedCallback() { this._sync(); }
      attributeChangedCallback() { this._sync(); }
      _sync() {
        if (!this._link) return;
        this._link.href = this.getAttribute('href') || ('#' + (this.getAttribute('route') || '/'));
        this._link.setAttribute('aria-current', this.hasAttribute('active') ? 'page' : 'false');
        this._link.setAttribute('aria-disabled', String(this.hasAttribute('disabled')));
      }
    }
    customElements.define('kniu-navbar-cell', KniuNavbarCell);
  }

  if (!customElements.get('kniu-sub-navbar')) {
    class KniuSubNavbar extends HTMLElement {
      static get observedAttributes() { return ['active', 'level']; }
      constructor() {
        super();
        attachComponentShadow(this);
        this.shadowRoot.innerHTML = `
            <style>${KNIU_SUB_NAVBAR_CSS}</style>
            ${KNIU_SUB_NAVBAR_TEMPLATE}`;
        this._details = this.shadowRoot.querySelector('details');
        adoptDropdownStyle(this.shadowRoot);
        adoptSharedStyle(this.shadowRoot, KNIU_SUB_NAVBAR_OVERRIDES_CSS);
      }
      connectedCallback() { this._sync(); }
      attributeChangedCallback() { this._sync(); }
      _sync() {
        const level = Math.max(1, Number(this.getAttribute('level')) || 1);
        this.style.setProperty('--kniu-navbar-level', String(level));
        if (this.hasAttribute('active')) this._details.open = true;
      }
    }
    customElements.define('kniu-sub-navbar', KniuSubNavbar);
  }

  if (!customElements.get('kniu-navbar')) {
    class KniuNavbar extends HTMLElement {
      static get observedAttributes() { return ['brand', 'home', 'active', 'type', 'open', 'fixed', 'placeholder']; }
      constructor() {
        super();
        attachComponentShadow(this);
        this.shadowRoot.innerHTML = `
            <style>${KNIU_NAVBAR_CSS}</style>
            ${KNIU_NAVBAR_TEMPLATE}`;
        this._brand = this.shadowRoot.querySelector('.kniu_sys_navbar_brand');
        this._brandLabel = this.shadowRoot.querySelector('.kniu_sys_navbar_brand_label');
        this._toggle = this.shadowRoot.querySelector('.kniu_sys_navbar_toggle');
        this._menu = this.shadowRoot.querySelector('.kniu_sys_navbar_menu');
        this._defaultSlot = this.shadowRoot.querySelector('slot[name="default"]');
        this._slots = [...this.shadowRoot.querySelectorAll('slot')];
        this._handleHashChange = this._syncActive.bind(this);
        this._handleRouteChange = function () {
          this._syncActive();
          if (this.hasAttribute('open') && !this.hasAttribute('closing')) this._closeMenu();
        }.bind(this);
        this._handleViewportChange = this._syncSlotLayout.bind(this);
        this._desktopMedia = globalThis.matchMedia?.('(min-width:calc(1280px - 60px))') || null;
        this._headResizeObserver = null;
        this._handleWindowResize = this._syncMenuTop.bind(this);
        this._placeholder = null;
        this._placeholderResizeObserver = null;
        this._handleToggleClick = function (event) {
          event.stopPropagation();
          if (this.hasAttribute('open')) this._closeMenu();
          else this._openMenu();
        }.bind(this);
        this._handleMenuClick = function (event) {
          if (event.composedPath?.().includes(this._toggle)) return;
          const isNavigationLink = event.composedPath?.().some(function (node) {
            return node?.tagName === 'KNIU-NAVBAR-CELL';
          });
          if (!isNavigationLink) return;
          this._closeMenu();
        }.bind(this);
        this._pageScrollLocked = false;
      }
      connectedCallback() {
        this._toggle.addEventListener('click', this._handleToggleClick);
        this._slots.forEach(function (slot) { slot.addEventListener('slotchange', this._handleHashChange); }, this);
        if (this._desktopMedia) {
          if (this._desktopMedia.addEventListener) this._desktopMedia.addEventListener('change', this._handleViewportChange);
          else this._desktopMedia.addListener?.(this._handleViewportChange);
        }
        this._observeHeadSize();
        this._syncFixedLayout();
        this.addEventListener('click', this._handleMenuClick);
        globalThis.addEventListener?.('hashchange', this._handleRouteChange);
        globalThis.addEventListener?.('kniu-route-rendered', this._handleRouteChange);
        this._syncSlotLayout();
        this._sync();
      }
      disconnectedCallback() {
        this._toggle.removeEventListener('click', this._handleToggleClick);
        if (this._desktopMedia) {
          if (this._desktopMedia.removeEventListener) this._desktopMedia.removeEventListener('change', this._handleViewportChange);
          else this._desktopMedia.removeListener?.(this._handleViewportChange);
        }
        this._headResizeObserver?.disconnect();
        this._headResizeObserver = null;
        this._placeholderResizeObserver?.disconnect();
        this._placeholderResizeObserver = null;
        this._removePlaceholder();
        globalThis.removeEventListener?.('resize', this._handleWindowResize);
        globalThis.removeEventListener?.('hashchange', this._handleRouteChange);
        globalThis.removeEventListener?.('kniu-route-rendered', this._handleRouteChange);
        this._slots.forEach(function (slot) { slot.removeEventListener('slotchange', this._handleHashChange); }, this);
        this.removeEventListener('click', this._handleMenuClick);
        if (this._closeTimer) globalThis.clearTimeout(this._closeTimer);
        this._closeTimer = null;
        this._unlockPageScroll();
      }
      attributeChangedCallback() { this._syncSlotLayout(); this._syncFixedLayout(); this._sync(); }
      _syncSlotLayout() {
        if (!this._defaultSlot || !this._menu) return;
        const isDesktop = this._desktopMedia ? this._desktopMedia.matches : true;
        const keepDefaultInMenu = this.getAttribute('type') === 'side' || !isDesktop;
        if (keepDefaultInMenu) {
          if (this._defaultSlot.parentNode !== this._menu) this._menu.insertBefore(this._defaultSlot, this._menu.firstChild);
        } else if (this._defaultSlot.parentNode !== this._menu.parentNode) {
          this._menu.parentNode.insertBefore(this._defaultSlot, this._menu);
        }
      }
      _observeHeadSize() {
        const head = this.closest('.kniu_web_head');
        this._headElement = head || null;
        this._syncMenuTop();
        if (head && typeof ResizeObserver === 'function') {
          this._headResizeObserver = new ResizeObserver(this._handleWindowResize);
          this._headResizeObserver.observe(head);
        } else {
          globalThis.addEventListener?.('resize', this._handleWindowResize, { passive: true });
        }
      }
      _syncMenuTop() {
        const head = this._headElement || this.closest('.kniu_web_head');
        if (!head) return;
        const height = head.getBoundingClientRect?.().height || head.offsetHeight || 0;
        if (height > 0) this.style.setProperty('--kniu-navbar-menu-top', height + 'px');
      }
      _placeholderEnabled() {
        const options = this.__kniuOptions || {};
        if (Object.prototype.hasOwnProperty.call(options, 'placeholder')) {
          return options.placeholder !== false && options.placeholder !== 'false';
        }
        if (this.hasAttribute('placeholder')) return this.getAttribute('placeholder') !== 'false';
        return this.hasAttribute('fixed');
      }
      _syncFixedLayout() {
        if (!this.isConnected) return;
        if (this.hasAttribute('fixed') && !this.getAttribute('fixed')) this.setAttribute('fixed', 'top');
        if (!this._placeholderEnabled()) {
          this._removePlaceholder();
          return;
        }
        ensureNavbarPlaceholderStyle(this.ownerDocument || document);
        if (!this._placeholder) {
          this._placeholder = (this.ownerDocument || document).createElement('div');
          this._placeholder.className = 'kniu_sys_head_placeholder';
          this._placeholder.setAttribute('aria-hidden', 'true');
          this._placeholder.__kniuNavbarPlaceholder = true;
        }
        if (this.parentNode && this._placeholder.parentNode !== this.parentNode) {
          this.parentNode.insertBefore(this._placeholder, this.nextSibling);
        }
        this._syncPlaceholderSize();
        if (!this._placeholderResizeObserver && typeof ResizeObserver === 'function') {
          this._placeholderResizeObserver = new ResizeObserver(() => this._syncPlaceholderSize());
          this._placeholderResizeObserver.observe(this);
        }
      }
      _syncPlaceholderSize() {
        if (!this._placeholder) return;
        const height = this.getBoundingClientRect?.().height || this.offsetHeight || 0;
        if (height > 0) {
          this._placeholder.style.height = height + 'px';
          this.style.setProperty('--kniu-navbar-placeholder-height', height + 'px');
        }
        this._syncMenuTop();
      }
      _removePlaceholder() {
        this._placeholderResizeObserver?.disconnect();
        this._placeholderResizeObserver = null;
        if (this._placeholder?.__kniuNavbarPlaceholder) this._placeholder.remove();
        this._placeholder = null;
        this.style.removeProperty('--kniu-navbar-placeholder-height');
      }
      _sync() {
        if (!this._brand) return;
        const t = (k) => componentText(componentLang(this.__kniuOptions), k);
        this._brandLabel.textContent = this.getAttribute('brand') || t('navbar.home');
        this._brand.href = this.getAttribute('home') || '#/';
        this._syncActive();
        this._syncToggle();
        if (this.hasAttribute('open') && !this.hasAttribute('closing') && this.getAttribute('type') !== 'side') this._lockPageScroll();
        else if (!this.hasAttribute('open')) {
          this._closeNestedUserMenus();
          this._unlockPageScroll();
        }
      }
      _closeNestedUserMenus() {
        this.querySelectorAll('kniu-user-login').forEach(function (userLogin) {
          userLogin._setMenuOpen?.(false);
        });
      }
      _lockPageScroll() {
        if (this._pageScrollLocked) return;
        // 所有者用组件实例：同一 navbar 重复上锁幂等，多个 navbar 互不干扰。
        if (!lockDocumentScroll(this)) return;
        this._pageScrollLocked = true;
      }
      _unlockPageScroll() {
        if (!this._pageScrollLocked) return;
        this._pageScrollLocked = false;
        unlockDocumentScroll(this);
      }
      _syncToggle() {
        const open = this.hasAttribute('open') && !this.hasAttribute('closing');
        const t = (k) => componentText(componentLang(this.__kniuOptions), k);
        this._toggle.setAttribute('aria-expanded', String(open));
        this._toggle.setAttribute('aria-label', open ? t('navbar.collapse') : t('navbar.expand'));
      }
      _openMenu() {
        if (this._closeTimer) globalThis.clearTimeout(this._closeTimer);
        this._closeTimer = null;
        this.removeAttribute('closing');
        this.setAttribute('open', '');
        this._lockPageScroll();
        this._syncToggle();
      }
      _closeMenu() {
        if (!this.hasAttribute('open') || this.hasAttribute('closing')) return;
        this._closeNestedUserMenus();
        this.setAttribute('closing', '');
        this._syncToggle();
        const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        this._closeTimer = globalThis.setTimeout(function () {
          this.removeAttribute('open');
          this.removeAttribute('closing');
          this._closeTimer = null;
          this._unlockPageScroll();
          this._syncToggle();
        }.bind(this), reducedMotion ? 0 : 280);
      }
      _syncActive() {
        const active = this.getAttribute('active') || (globalThis.location?.hash || '#/').replace(/^#/, '').split('?')[0] || '/';
        this.querySelectorAll('kniu-navbar-cell').forEach(function (cell) {
          const route = cell.getAttribute('route') || cell.getAttribute('href')?.replace(/^#/, '').split('?')[0];
          cell.toggleAttribute('active', route === active);
          cell.toggleAttribute('side', this.getAttribute('type') === 'side');
          let level = 0;
          let parent = cell.parentElement?.closest('kniu-sub-navbar');
          while (parent) {
            level += 1;
            parent = parent.parentElement?.closest('kniu-sub-navbar');
          }
          level = Math.min(3, level);
          cell.setAttribute('level', String(level));
          cell.style.setProperty('--kniu-navbar-level', String(level));
        }, this);
        this.querySelectorAll('kniu-sub-navbar').forEach(function (subNavbar) {
          let level = 1;
          let parent = subNavbar.parentElement?.closest('kniu-sub-navbar');
          while (parent) {
            level += 1;
            parent = parent.parentElement?.closest('kniu-sub-navbar');
          }
          level = Math.min(3, level);
          subNavbar.setAttribute('level', String(level));
          subNavbar.style.setProperty('--kniu-navbar-level', String(level));
          subNavbar.toggleAttribute('active', Boolean(subNavbar.querySelector('kniu-navbar-cell[active]')));
        });
      }
    }
    customElements.define('kniu-navbar', KniuNavbar);
  }
}