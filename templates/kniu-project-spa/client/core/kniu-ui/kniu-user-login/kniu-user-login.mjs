import { getAuthConfig } from '../../kniu-auth-service.mjs';

export function registerUserLogin(context) {
  const { BOOLEAN_ATTRIBUTES, IDENTITY, KNIU_BACKTOP_CSS, KNIU_BADGE_CSS, KNIU_BASE_CONTAIN_CSS, KNIU_BASE_FONT_CSS, KNIU_BTN_CSS, KNIU_BTN_GROUP_CSS, KNIU_BTN_METRICS_CSS, KNIU_BTN_OVERRIDES_CSS, KNIU_COMMENT_CSS, KNIU_CONTAIN_EXCLUDE_TAGS, KNIU_CONTENT_TABLE_CSS, KNIU_CONTENT_TABLE_DOC_CSS, KNIU_DATE_PICKER_CSS, KNIU_DATE_PICKER_OVERRIDES_CSS, KNIU_DROPDOWN_CSS, KNIU_DROPDOWN_OPTION_CSS, KNIU_EDITOR_CSS, KNIU_EDITOR_OVERRIDE_CSS, KNIU_EDITOR_PRINT_CSS, KNIU_EMPTY_CSS, KNIU_FONT_FACE_CSS, KNIU_FONT_FAMILY, KNIU_FONT_MONO_FAMILY, KNIU_FONT_SERIF_FAMILY, KNIU_I18N, KNIU_ICON_CSS, KNIU_ICON_FONT_NAMES, KNIU_ICON_NAMES, KNIU_ICON_SVG, KNIU_IMAGE_CSS, KNIU_IMAGE_OVERRIDES_CSS, KNIU_INPUT_AFFIX_CSS, KNIU_INPUT_CSS, KNIU_INPUT_GROUP_CSS, KNIU_INPUT_METRICS_CSS, KNIU_INPUT_PASSWORD_ACTIONS_CSS, KNIU_INPUT_PASSWORD_CSS, KNIU_INPUT_STATES_CSS, KNIU_INPUT_TEXTAREA_CSS, KNIU_INPUT_TIP_CSS, KNIU_LIKE_CSS, KNIU_LOADING_CSS, KNIU_MARKDOWN_CSS, KNIU_MODAL_CONFIRM_CSS, KNIU_MODAL_CSS, KNIU_MSG_CSS, KNIU_NAVBAR_CELLS_CSS, KNIU_NAVBAR_CELL_CSS, KNIU_NAVBAR_CSS, KNIU_NAVBAR_PLACEHOLDER_CSS, KNIU_PAGE_CSS, KNIU_RADIO_GROUP_CSS, KNIU_RICHTEXT_CSS, KNIU_SELECT_CSS, KNIU_STATUS_CSS, KNIU_SUB_NAVBAR_CSS, KNIU_SUB_NAVBAR_OVERRIDES_CSS, KNIU_SWITCH_CSS, KNIU_TABLE_CLASS, KNIU_TABLE_COL_CSS, KNIU_TABLE_CSS, KNIU_TABLE_WRAP_CLASS, KNIU_TAB_CSS, KNIU_TAG_CSS, KNIU_UPLOAD_CSS, KNIU_USER_LOGIN_CSS, KNIU_USER_LOGIN_OVERRIDES_CSS, PRUNABLE_ATTRIBUTE_NAMES, REQUEST, RICH_TEXT_LITERAL_TAG_RE, SCROLL_LOCK_FLAG, SEMANTIC_EMPTY_ATTRIBUTES, SHADOW_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_RE, TEMPLATE, adoptDropdownStyle, adoptSharedStyle, adoptedSheetsFlushScheduled, appendRawStyle, applyScrollLock, attachComponentShadow, buildIconElement, buildPageList, compileTableRowTemplate, componentDefaults, componentLang, componentText, computePopoverLayout, confirm, createRowDeleteHandler, createSearchActions, createTable, debounce, flushPendingAdoptedSheets, getResponseRecords, getShadowInnerHTMLDescriptor, getSharedStyleSheet, hasRichTextLiteralTag, installMarkdownStyles, installOptionsOnlyProtocol, installRichTextStyles, isEmptyAttributeValue, lockDocumentScroll, makeSwitchOptions, mountAffixSlots, mountPopoverPortal, msg, normalizeComponentCss, normalizedCssCache, pendingAdoptedSheets, pruneEmptyAttribute, pruneEmptyAttributeTree, pruneEmptyAttributes, pruneEmptyRootAttributes, readScrollLockOriginals, reconcileDocumentScrollLock, releaseScrollLock, replaceChildrenWithFragment, resolveIconName, resolveTableRowTemplate, sanitizeRichHtml, sanitizeRichHtmlAsync, scheduleAdoptedSheetsFlush, scrollLockNodes, scrollLockOriginals, scrollLockOwners, setLoading, shadowInnerHTMLDescriptor, shadowStyleSheetCache, shadowTemplateCache, shouldContainHost, state, supportsAdoptedStyleSheets, tableTemplateCache, toastInstance, toastTimer, trackPopoverPosition, unlockDocumentScroll, unwrapTablesIn, use, usePage, usePagination, wrapTablesIn, writeScrollLockOriginals } = context;
  if (typeof customElements === 'undefined' || customElements.get('kniu-user-login')) return;
  const DEFAULT_USER_AVATAR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAIAAABt+uBvAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA4ZpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNi1jMDY3IDc5LjE1Nzc0NywgMjAxNS8wMy8zMC0yMzo0MDo0MiAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo3OTA5OWY0MC1hZTY2LTQ0NTktYjdlMS0zNWYxMTEzN2JhNzYiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6QzQ0RDAwQUUyRjM0MTFFNjhGNjNBRUJGNzk1RDg1REIiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6QzQ0RDAwQUQyRjM0MTFFNjhGNjNBRUJGNzk1RDg1REIiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTUgKE1hY2ludG9zaCkiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDoyNzdkNjVjNS01NmQxLTQwMGItYjY2NS00NjA2MDg3ZmFmMTAiIHN0UmVmOmRvY3VtZW50SUQ9ImFkb2JlOmRvY2lkOnBob3Rvc2hvcDo4MDM3NDc0YS03NzI0LTExNzktYmUy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';
  class KniuUserLogin extends HTMLElement {
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
      const accountName = identity.name || nickname;
      const t = (key) => componentText(componentLang(this._options), key);
      if (this._renderedNickname !== undefined && this._renderedNickname !== nickname) this._menuOpen = false;
      this._renderedNickname = nickname;
      this._cleanupMenuPopover();
      this.shadowRoot.innerHTML = `
          <style>${KNIU_USER_LOGIN_CSS}</style>
          <div class="kniu_sys_user_login_user${nickname ? '' : ' kniu_sys_user_login_user_guest'}" data-open="${this._menuOpen}">
            <button class="kniu_sys_user_login_trigger" type="button" aria-haspopup="menu" aria-expanded="${this._menuOpen}">
              <span class="kniu_sys_user_login_avatar" aria-hidden="true"><kniu-image src="${String(identity.avatar || DEFAULT_USER_AVATAR).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}" fit="cover" /></span>
              <span class="kniu_sys_user_login_hello"></span><span class="kniu_sys_user_login_arrow" aria-hidden="true"></span>
            </button>
            <div class="kniu_sys_user_login_menu kniu_sys_dropdown_panel" role="menu" data-open="${this._menuOpen}">
              ${nickname ? `
                <a class="kniu_sys_dropdown_option" href="#${getAuthConfig().USER_LOGIN.routes.profile || ''}" role="menuitem">${t('userLogin.profile')}</a>
                <a class="kniu_sys_dropdown_option" href="#${getAuthConfig().USER_LOGIN.routes.login || ''}" target="_blank" rel="noopener noreferrer" role="menuitem">${t('userLogin.admin')}</a>
                ${getAuthConfig().USER_LOGIN.feedback?.enabled ? `<button class="kniu_sys_user_login_feedback kniu_sys_dropdown_option" type="button" role="menuitem">${t('userLogin.feedback')}</button>` : ''}
                <button class="kniu_sys_user_login_logout kniu_sys_dropdown_option" type="button" role="menuitem" ${this._logoutLoading ? 'disabled' : ''}>${t('userLogin.logout')}</button>` : `
                <a class="kniu_sys_dropdown_option" href="#${getAuthConfig().USER_LOGIN.routes.login || ''}" role="menuitem">${t('userLogin.login')}</a>`}
            </div>
          </div>`;
      adoptDropdownStyle(this.shadowRoot);
      appendRawStyle(this.shadowRoot, KNIU_USER_LOGIN_OVERRIDES_CSS);
      const hello = this.shadowRoot.querySelector('.kniu_sys_user_login_hello');
      if (hello) hello.textContent = nickname ? t('userLogin.hello') + accountName : t('userLogin.guest');
      this.shadowRoot.querySelector('.kniu_sys_user_login_trigger')?.addEventListener('click', () => {
        this._setMenuOpen(!this._menuOpen);
      });
      this.shadowRoot.querySelector('.kniu_sys_user_login_logout')?.addEventListener('click', this._handleLogout);
      this.shadowRoot.querySelector('.kniu_sys_user_login_feedback')?.addEventListener('click', () => this._openFeedback());
      this._positionMenu();
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
      if (!this._menuOpen || event.composedPath().includes(this)) return;
      this._setMenuOpen(false);
    }
    _openFeedback() {
      this._setMenuOpen(false);
      if (this._feedbackModal?.isConnected) return;
      const t = (key) => componentText(componentLang(this._options), key);
      const modal = document.createElement('kniu-modal');
      modal.title = t('userLogin.feedback');
      modal.setAttribute('width', 'min(560px, 92vw)');
      modal.setAttribute('minmax', '');
      modal.innerHTML = `
        <style>
          .kniu_sys_user_login_feedback_form { display: grid; gap: 12px; padding: 4px 2px; }
          .kniu_sys_user_login_feedback_footer { display: flex; justify-content: flex-end; gap: 8px; }
        </style>
        <span slot="header">${t('userLogin.feedback')}</span>
        <div slot="default" class="kniu_sys_user_login_feedback_form">
          <kniu-form-cell>
            <kniu-input name="title" maxlength="200" placeholder="请输入问题标题"><span slot="prepend" label-width="80px">问题标题</span></kniu-input>
          </kniu-form-cell>
          <kniu-form-cell>
            <kniu-input name="content" type="textarea" rows="5" maxlength="2000" placeholder="请输入问题简述"><span slot="prepend" label-width="80px">问题简述</span></kniu-input>
          </kniu-form-cell>
          <kniu-form-cell>
            <kniu-input name="images">
              <span slot="prepend" label-width="80px">问题图片</span>
              <span slot="append" label-width="80px"><kniu-upload class="kniu_sys_fb_upload" multiple max-count="2" max-size="5" accept="image/*">选择图片</kniu-upload></span>
            </kniu-input>
          </kniu-form-cell>
        </div>
        <div slot="footer" class="kniu_sys_user_login_feedback_footer">
          <kniu-btn class="kniu_sys_fb_cancel">取 消</kniu-btn>
          <kniu-btn class="kniu_sys_fb_submit">提 交</kniu-btn>
        </div>`;
      modal.querySelector('.kniu_sys_fb_cancel')?.addEventListener('click', () => modal.close());
      modal.querySelector('.kniu_sys_fb_submit')?.addEventListener('click', () => this._submitFeedback(modal));
      modal.addEventListener('close', () => {
        if (this._feedbackModal === modal) this._feedbackModal = null;
        setTimeout(() => { if (modal.parentNode) modal.remove(); }, 320);
      });
      const submitBtn = modal.querySelector('.kniu_sys_fb_submit');
      if (submitBtn) submitBtn.options = { type: 'primary' };
      document.body.append(modal);
      this._feedbackModal = modal;
      modal.show = true;
    }
    async _submitFeedback(modal) {
      if (this._feedbackSubmitting) return;
      const title = String(modal.querySelector('kniu-input[name="title"]')?.value || '').trim();
      const content = String(modal.querySelector('kniu-input[name="content"]')?.value || '').trim();
      if (title === '') { msg({ content: '请输入问题标题', type: 'error' }); return; }
      if (content === '') { msg({ content: '请输入问题简述', type: 'error' }); return; }
      const files = modal.querySelector('.kniu_sys_fb_upload')?.files || [];
      const identityToken = IDENTITY.getIdentity().token || '';
      this._feedbackSubmitting = true;
      const submitBtn = modal.querySelector('.kniu_sys_fb_submit');
      try {
        if (submitBtn) submitBtn.setAttribute('disabled', '');
        // 图片逐张上传（后端单 file 字段），最多 2 张由 kniu-upload max-count 把关、后端再兜底。
        const urls = [];
        for (const file of files) {
          const formData = new FormData();
          formData.append('file', file, file.name);
          formData.append('identity_token', identityToken);
          const uploaded = await REQUEST({ url: getAuthConfig().USER_LOGIN.endpoints.feedback_upload, type: 'POST', data: formData, redirectOnUnauthorized: false });
          if (uploaded.status !== 1) {
            msg({ content: uploaded.msg || '图片上传失败', type: 'error' });
            return;
          }
          urls.push(String(uploaded.data?.url || ''));
        }
        const result = await REQUEST({
          url: getAuthConfig().USER_LOGIN.endpoints.feedback_submit,
          type: 'POST',
          redirectOnUnauthorized: false,
          data: { identity_token: identityToken, title, content, images: urls.join(',') }
        });
        if (result.status !== 1) {
          msg({ content: result.msg || '反馈提交失败', type: 'error' });
          return;
        }
        msg({ content: '反馈提交成功，感谢您的反馈', type: 'success' });
        modal.close();
      } finally {
        this._feedbackSubmitting = false;
        if (submitBtn) submitBtn.removeAttribute('disabled');
      }
    }
    async _logout() {
      if (this._logoutLoading) return;
      this._setMenuOpen(false);
      this._logoutLoading = true;
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
      if (result.status !== 1) {
        this._render();
        msg({ content: result.msg || componentText(componentLang(this._options), 'userLogin.logoutFail'), type: 'error' });
        return;
      }
      globalThis.location.hash = '#' + (getAuthConfig().USER_LOGIN.routes.home || '/');
    }
  }
  customElements.define('kniu-user-login', KniuUserLogin);
}
