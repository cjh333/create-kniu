import KNIU_USER_LOGIN_TEMPLATE from './Kniu-UserLoginComponent.html?module';
import KNIU_USER_LOGIN_CELL_TEMPLATE from '../Kniu-UserLoginCellComponent/Kniu-UserLoginCellComponent.html?module';
import KNIU_USER_LOGIN_CELL_CSS from '../Kniu-UserLoginCellComponent/Kniu-UserLoginCellComponent.css?module';
import KNIU_USER_LOGIN_FEEDBACK_TEMPLATE from '../Kniu-UserLoginFeedbackComponent/Kniu-UserLoginFeedbackComponent.html?module';
import { loadComponents } from '../../Kniu-ComponentLoader.mjs';
import { isSuccessResponse, routeHref, getContracts } from '../../Kniu-Contracts.mjs';
import { setImageSource } from '../../Kniu-Proxy.mjs';
import { getAuthConfig, getAuthService } from '../../Kniu-AuthService.mjs';
import { getDefaultUserAvatar } from '../../Kniu-DefaultAvatar.mjs';

export function registerUserLogin(context) {
  const { BOOLEAN_ATTRIBUTES, IDENTITY, KNIU_BACKTOP_CSS, KNIU_BADGE_CSS, KNIU_BASE_CONTAIN_CSS, KNIU_BASE_FONT_CSS, KNIU_BTN_CSS, KNIU_BTN_GROUP_CSS, KNIU_BTN_METRICS_CSS, KNIU_BTN_OVERRIDES_CSS, KNIU_COMMENT_CSS, KNIU_CONTAIN_EXCLUDE_TAGS, KNIU_CONTENT_TABLE_CSS, KNIU_CONTENT_TABLE_DOC_CSS, KNIU_DATE_PICKER_CSS, KNIU_DATE_PICKER_OVERRIDES_CSS, KNIU_DROPDOWN_CSS, KNIU_DROPDOWN_OPTION_CSS, KNIU_EDITOR_CSS, KNIU_EDITOR_OVERRIDE_CSS, KNIU_EDITOR_PRINT_CSS, KNIU_EMPTY_CSS, KNIU_FONT_FACE_CSS, KNIU_FONT_FAMILY, KNIU_FONT_MONO_FAMILY, KNIU_FONT_SERIF_FAMILY, KNIU_I18N, KNIU_ICON_CSS, KNIU_ICON_FONT_NAMES, KNIU_ICON_NAMES, KNIU_ICON_SVG, KNIU_IMAGE_CSS, KNIU_IMAGE_OVERRIDES_CSS, KNIU_INPUT_AFFIX_CSS, KNIU_INPUT_CSS, KNIU_INPUT_GROUP_CSS, KNIU_INPUT_METRICS_CSS, KNIU_INPUT_PASSWORD_ACTIONS_CSS, KNIU_INPUT_PASSWORD_CSS, KNIU_INPUT_STATES_CSS, KNIU_INPUT_TEXTAREA_CSS, KNIU_INPUT_TIP_CSS, KNIU_LIKE_CSS, KNIU_MARKDOWN_CSS, KNIU_MODAL_CONFIRM_CSS, KNIU_MODAL_CSS, KNIU_MSG_CSS, KNIU_NAVBAR_CELLS_CSS, KNIU_NAVBAR_CELL_CSS, KNIU_NAVBAR_CSS, KNIU_NAVBAR_PLACEHOLDER_CSS, KNIU_PAGE_CSS, KNIU_RADIO_GROUP_CSS, KNIU_RICHTEXT_CSS, KNIU_SELECT_CSS, KNIU_STATUS_CSS, KNIU_SUB_NAVBAR_CSS, KNIU_SUB_NAVBAR_OVERRIDES_CSS, KNIU_SWITCH_CSS, KNIU_TABLE_CLASS, KNIU_TABLE_COL_CSS, KNIU_TABLE_CSS, KNIU_TABLE_WRAP_CLASS, KNIU_TAB_CSS, KNIU_TAG_CSS, KNIU_UPLOAD_CSS, KNIU_USER_LOGIN_CSS, KNIU_USER_LOGIN_OVERRIDES_CSS, PRUNABLE_ATTRIBUTE_NAMES, REQUEST, RICH_TEXT_LITERAL_TAG_RE, SCROLL_LOCK_FLAG, SEMANTIC_EMPTY_ATTRIBUTES, SHADOW_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_RE, TEMPLATE, adoptDropdownStyle, adoptSharedStyle, adoptedSheetsFlushScheduled, appendRawStyle, applyScrollLock, attachComponentShadow, buildIconElement, buildPageList, compileTableRowTemplate, componentDefaults, componentLang, componentText, computePopoverLayout, confirm, createRowDeleteHandler, createSearchActions, createTable, debounce, flushPendingAdoptedSheets, getResponseRecords, getShadowInnerHTMLDescriptor, getSharedStyleSheet, hasRichTextLiteralTag, installMarkdownStyles, installOptionsOnlyProtocol, installRichTextStyles, isEmptyAttributeValue, lockDocumentScroll, makeSwitchOptions, mountAffixSlots, mountPopoverPortal, msg, normalizeComponentCss, normalizedCssCache, pendingAdoptedSheets, pruneEmptyAttribute, pruneEmptyAttributeTree, pruneEmptyAttributes, pruneEmptyRootAttributes, readScrollLockOriginals, reconcileDocumentScrollLock, releaseScrollLock, replaceChildrenWithFragment, resolveIconName, resolveTableRowTemplate, sanitizeRichHtml, sanitizeRichHtmlAsync, scheduleAdoptedSheetsFlush, scrollLockNodes, scrollLockOriginals, scrollLockOwners, setLoading, shadowInnerHTMLDescriptor, shadowStyleSheetCache, shadowTemplateCache, shouldContainHost, state, supportsAdoptedStyleSheets, tableTemplateCache, toastInstance, toastTimer, trackPopoverPosition, unlockDocumentScroll, unwrapTablesIn, use, usePage, usePagination, wrapTablesIn, writeScrollLockOriginals } = context;
  if (typeof customElements === 'undefined' || customElements.get('kniu-user-login')) return;
  if (!customElements.get('kniu-user-login-cell')) {
    class KniuUserLoginCell extends HTMLElement {
      constructor() {
        super();
        attachComponentShadow(this);
        this.shadowRoot.innerHTML = `<style>${KNIU_USER_LOGIN_CELL_CSS}</style>${KNIU_USER_LOGIN_CELL_TEMPLATE}`;
        this._link = this.shadowRoot.querySelector('a');
        this._link.addEventListener('keydown', (event) => {
          if (!this._link.hasAttribute('href') && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            this._link.click();
          }
        });
      }
      set options(value) { this._options = value || {}; this._sync(); }
      get options() { return this._options || {}; }
      connectedCallback() { this._sync(); }
      _sync() {
        const route = this.options.route;
        if (route) this._link.setAttribute('href', '#' + String(route).replace(/^#/, ''));
        else { this._link.removeAttribute('href'); this._link.setAttribute('tabindex', '0'); }
        const target = this.options.target;
        if (route && target) this._link.setAttribute('target', String(target));
        else this._link.removeAttribute('target');
        if (route && String(target).toLowerCase() === '_blank') this._link.setAttribute('rel', 'noopener noreferrer');
        else this._link.removeAttribute('rel');
      }
    }
    customElements.define('kniu-user-login-cell', KniuUserLoginCell);
  }
  class KniuUserLogin extends HTMLElement {
    static get slots() { return new Set(['default']); }
    constructor() {
      super();
      attachComponentShadow(this);
      this._options = {};
      this._logoutLoading = false;
      this._menuOpen = false;
      this._menuState = null;
      this._feedbackModal = null;
      this._feedbackSubmitting = false;
      this._handleIdentityChange = this._render.bind(this);
      this._handleLogout = this._logout.bind(this);
      this._handleDocumentClick = this._onDocumentClick.bind(this);
      this._menuPositionFrame = 0;
      this._menuAnchor = null;
    }
    connectedCallback() {
      globalThis.addEventListener?.('kniu-identity-change', this._handleIdentityChange);
      this.ownerDocument?.addEventListener('click', this._handleDocumentClick);
      this._render();
    }
    disconnectedCallback() {
      globalThis.removeEventListener?.('kniu-identity-change', this._handleIdentityChange);
      this.ownerDocument?.removeEventListener('click', this._handleDocumentClick);
      this.shadowRoot.querySelector('.kniu_sys_user_login_logout')?.removeEventListener('click', this._handleLogout);
      this._cleanupMenuPopover();
      if (this._feedbackModal?.isConnected) this._feedbackModal.remove();
      this._feedbackModal = null;
    }
    set options(value) {
      this._options = value && typeof value === 'object' ? value : {};
      this._render();
    }
    get options() { return this._options; }
    _render() {
      const identity = IDENTITY.getIdentity();
      const nickname = identity.nickname;
      const t = (key) => componentText(componentLang(this._options), key);
      if (this._renderedNickname !== undefined && this._renderedNickname !== nickname) this._menuOpen = false;
      this._renderedNickname = nickname;
      this._cleanupMenuPopover();
      this.shadowRoot.innerHTML = `<style>${KNIU_USER_LOGIN_CSS}</style>${KNIU_USER_LOGIN_TEMPLATE}`;
      const user = this.shadowRoot.querySelector('.kniu_sys_user_login_user');
      const trigger = this.shadowRoot.querySelector('.kniu_sys_user_login_trigger');
      const menu = this.shadowRoot.querySelector('.kniu_sys_user_login_menu');
      user.classList.toggle('kniu_sys_user_login_user_guest', !nickname);
      user.dataset.open = String(this._menuOpen);
      trigger.setAttribute('aria-expanded', String(this._menuOpen));
      menu.dataset.open = String(this._menuOpen);
      setImageSource(this.shadowRoot.querySelector('.kniu_sys_user_login_avatar img'), identity.avatar || getDefaultUserAvatar());
      adoptDropdownStyle(this.shadowRoot);
      appendRawStyle(this.shadowRoot, KNIU_USER_LOGIN_OVERRIDES_CSS);
      const hello = this.shadowRoot.querySelector('.kniu_sys_user_login_hello');
      if (hello) hello.textContent = nickname ? t('userLogin.hello') + nickname : t('userLogin.guest');
      this.shadowRoot.querySelector('.kniu_sys_user_login_trigger')?.addEventListener('click', () => {
        this._setMenuOpen(!this._menuOpen);
      });
      this.shadowRoot.querySelector('.kniu_sys_user_login_menu')?.addEventListener('click', () => {
        setTimeout(() => { if (this.isConnected) this._setMenuOpen(false); }, 0);
      });
      this._syncMenuItems(menu);
      this._positionMenu();
    }
    _syncMenuItems(panel) {
      const menu = panel || this.shadowRoot?.querySelector('.kniu_sys_user_login_menu');
      if (!menu) return;
      [...this.children]
        .filter((cell) => cell.localName === 'kniu-user-login-cell')
        .forEach((cell) => {
          cell.__kniuUserLoginOwner = this;
          menu.appendChild(cell);
        });
    }
    _setMenuOpen(open) {
      this._menuOpen = Boolean(open);
      const user = this.shadowRoot?.querySelector('.kniu_sys_user_login_user');
      const trigger = this.shadowRoot?.querySelector('.kniu_sys_user_login_trigger');
      const menu = this._menuState?.panel || this.shadowRoot?.querySelector('.kniu_sys_user_login_menu');
      if (user) user.dataset.open = String(this._menuOpen);
      if (trigger) trigger.setAttribute('aria-expanded', String(this._menuOpen));
      if (menu) menu.dataset.open = String(this._menuOpen);
      if (!this._menuOpen) {
        this._cleanupMenuPopover();
        return;
      }
      this._positionMenu();
    }
    _positionMenu() {
      const menu = this._menuState?.panel || this.shadowRoot?.querySelector('.kniu_sys_user_login_menu');
      if (this._disposeMenuTrack) { this._disposeMenuTrack(); this._disposeMenuTrack = null; }
      if (!this._menuOpen || !menu) return;
      this._syncMenuItems(menu);
      if (!this._menuState || !this._menuState.portal?.isConnected) {
        if (this._menuState) this._menuState.unmount();
        this._menuState = mountPopoverPortal(menu, this.shadowRoot, { zIndex: 10030, attribute: 'data-kniu-userlogin-popover' });
      }
      if (!this._menuState) return;
      this._menuAnchor = this.shadowRoot.querySelector('.kniu_sys_user_login_trigger');
      if (!this._menuAnchor) return;
      menu.style.position = 'fixed';
      menu.style.left = '0px';
      menu.style.top = '0px';
      menu.style.right = 'auto';
      menu.style.bottom = 'auto';
      menu.style.transform = 'none';
      menu.style.visibility = 'hidden';
      menu.dataset.open = 'true';
      const anchor = this._menuAnchor;
      const apply = (rect) => {
        if (!this._menuOpen || !menu.isConnected || this._menuState?.panel !== menu) return;
        if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return;
        const layout = computePopoverLayout(menu, rect, { offset: 4 });
        menu.style.right = 'auto';
        menu.style.bottom = 'auto';
        menu.style.transform = 'none';
        menu.style.left = layout.left + 'px';
        menu.style.top = layout.top + 'px';
        menu.style.visibility = 'visible';
      };
      const applyNextFrame = () => {
        this._menuPositionFrame = 0;
        if (!this._menuOpen || this._menuState?.panel !== menu || !this._menuAnchor) return;
        apply(this._menuAnchor.getBoundingClientRect());
      };
      if (this._menuPositionFrame) globalThis.cancelAnimationFrame?.(this._menuPositionFrame);
      if (typeof globalThis.requestAnimationFrame === 'function') this._menuPositionFrame = globalThis.requestAnimationFrame(applyNextFrame);
      else applyNextFrame();
      this._disposeMenuTrack = trackPopoverPosition(
        () => { if (!this.isConnected || !this._menuOpen || this._menuState?.panel !== menu) return null; return this._menuAnchor?.getBoundingClientRect(); },
        apply,
        null,
        this._menuAnchor
      );
    }
    _cleanupMenuPopover() {
      const menuItems = this._menuState?.panel || this.shadowRoot?.querySelector('.kniu_sys_user_login_menu');
      [...(menuItems?.children || [])].filter((cell) => cell.localName === 'kniu-user-login-cell').forEach((cell) => this.appendChild(cell));
      if (this._disposeMenuTrack) { this._disposeMenuTrack(); this._disposeMenuTrack = null; }
      if (this._menuPositionFrame) {
        globalThis.cancelAnimationFrame?.(this._menuPositionFrame);
        this._menuPositionFrame = 0;
      }
      const menu = this._menuState?.panel || this.shadowRoot?.querySelector('.kniu_sys_user_login_menu');
      if (menu) menu.dataset.open = 'false';
      if (this._menuState) { this._menuState.unmount(); this._menuState = null; }
      if (menu) {
        menu.style.removeProperty('position');
        menu.style.removeProperty('left');
        menu.style.removeProperty('top');
        menu.style.removeProperty('right');
        menu.style.removeProperty('bottom');
        menu.style.removeProperty('transform');
        menu.style.removeProperty('visibility');
        menu.style.removeProperty('pointer-events');
      }
      this._menuAnchor = null;
    }
    _onDocumentClick(event) {
      if (!this._menuOpen || event.composedPath().includes(this) || event.composedPath().includes(this._menuState?.panel)) return;
      this._setMenuOpen(false);
    }
    async openFeedback(request) {
      this._setMenuOpen(false);
      if (this._feedbackModal?.isConnected) return;
      if (!request || typeof request.post !== 'function') throw new TypeError('反馈需要请求服务');
      this._feedbackRequest = request;
      const t = (key) => componentText(componentLang(this._options), key);
      const modal = document.createElement('kniu-modal');
      modal.innerHTML = KNIU_USER_LOGIN_FEEDBACK_TEMPLATE;
      document.body.append(modal);
      this._feedbackModal = modal;
      try {
        await loadComponents(modal);
      } catch (error) {
        modal.remove();
        if (this._feedbackModal === modal) this._feedbackModal = null;
        msg({ content: error?.message || '反馈窗口加载失败', type: 'error' });
        return;
      }
      if (!modal.isConnected || this._feedbackModal !== modal) return;
      modal.title = t('userLogin.feedback');
      const header = modal.querySelector('[slot="header"]');
      if (header) header.textContent = t('userLogin.feedback');
      const inputs = modal.querySelectorAll('kniu-input');
      if (inputs[0]) inputs[0].options = { name: 'title', maxlength: 200, placeholder: '请输入问题标题' };
      if (inputs[1]) inputs[1].options = { name: 'content', type: 'textarea', rows: 5, maxlength: 2000, placeholder: '请输入问题简述' };
      if (inputs[2]) inputs[2].options = { name: 'images', readonly: true };
      const upload = modal.querySelector('.kniu_sys_fb_upload');
      if (upload) {
        upload.options = { multiple: true, maxCount: 2, maxSize: 5, accept: 'image/*' };
        upload.addEventListener('change', () => {
          if (inputs[2]) inputs[2].value = upload.files.map((file) => typeof file === 'string' ? file : file.name).join(', ');
        });
      }
      modal.querySelector('.kniu_sys_fb_cancel')?.addEventListener('click', () => modal.close());
      modal.querySelector('.kniu_sys_fb_submit')?.addEventListener('click', () => this._submitFeedback(modal));
      modal.addEventListener('close', () => {
        if (this._feedbackModal === modal) this._feedbackModal = null;
        setTimeout(() => { if (modal.parentNode) modal.remove(); }, 320);
      });
      const submitBtn = modal.querySelector('.kniu_sys_fb_submit');
      if (submitBtn) submitBtn.options = { type: 'primary' };
      modal.options = { show: true, width: 'min(560px, 92vw)', minmax: true };
    }
    async _submitFeedback(modal) {
      if (this._feedbackSubmitting) return;
      const inputs = modal.querySelectorAll('kniu-input');
      const title = String(inputs[0]?.value || '').trim();
      const content = String(inputs[1]?.value || '').trim();
      if (title === '') { msg({ content: '请输入问题标题', type: 'error' }); return; }
      if (content === '') { msg({ content: '请输入问题简述', type: 'error' }); return; }
      const files = modal.querySelector('.kniu_sys_fb_upload')?.files || [];
      const identityToken = IDENTITY.getIdentity().token || '';
      this._feedbackSubmitting = true;
      const submitBtn = modal.querySelector('.kniu_sys_fb_submit');
      try {
        if (submitBtn) submitBtn.setAttribute('disabled', '');
        const urls = [];
        for (const file of files) {
          const formData = new FormData();
          formData.append('file', file, file.name);
          formData.append('identity_token', identityToken);
          const uploaded = await this._feedbackRequest.post(getAuthConfig().USER_LOGIN.endpoints.feedback_upload, formData);
          if (!isSuccessResponse(uploaded)) {
            msg({ content: uploaded.msg || '图片上传失败', type: 'error' });
            return;
          }
          urls.push(String(uploaded.data?.url || ''));
        }
        const result = await this._feedbackRequest.post(getAuthConfig().USER_LOGIN.endpoints.feedback_submit,
          { identity_token: identityToken, title, content, images: urls.join(',') });
        if (!isSuccessResponse(result)) {
          msg({ content: result.msg || '反馈提交失败', type: 'error' });
          return;
        }
        msg({ content: '反馈提交成功，感谢您的反馈', type: 'success' });
        modal.close();
      } catch (error) {
        msg({ content: error?.message || '反馈提交失败', type: 'error' });
      } finally {
        this._feedbackSubmitting = false;
        if (submitBtn) submitBtn.removeAttribute('disabled');
      }
    }
    async _logout() {
      if (this._logoutLoading) return;
      this._setMenuOpen(false);
      this._logoutLoading = true;
      const auth = getAuthService();
      if (auth?.isLoggedIn()) {
        try {
          await auth.logout();
          globalThis.location.hash = routeHref(getAuthConfig().USER_LOGIN.routes.home || '/', getContracts());
        } catch (error) {
          msg({ content: error?.message || componentText(componentLang(this._options), 'userLogin.logoutFail'), type: 'error' });
        } finally {
          this._logoutLoading = false;
          if (this.isConnected) this._render();
        }
        return;
      }
      const identity = IDENTITY.getIdentity();
      IDENTITY.clearIdentity();
      try {
        globalThis.localStorage?.setItem(getAuthConfig().STORAGE.logout_signal, String(Date.now()));
      } catch (_) { }
      this._render();
      const result = await REQUEST({
        url: getAuthConfig().USER_LOGIN.endpoints.clear_front_profile,
        type: 'POST',
        data: { identity_token: identity.token },
        redirectOnUnauthorized: false
      });
      this._logoutLoading = false;
      if (!isSuccessResponse(result)) {
        this._render();
        msg({ content: result.msg || componentText(componentLang(this._options), 'userLogin.logoutFail'), type: 'error' });
        return;
      }
      globalThis.location.hash = routeHref(getAuthConfig().USER_LOGIN.routes.home || '/', getContracts());
    }
  }
  customElements.define('kniu-user-login', KniuUserLogin);
}