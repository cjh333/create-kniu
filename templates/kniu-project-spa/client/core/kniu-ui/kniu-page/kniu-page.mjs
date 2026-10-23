import KNIU_PAGE_TEMPLATE from './kniu-page.html?module';

export function registerPage(context) {
  const { BOOLEAN_ATTRIBUTES, IDENTITY, KNIU_BACKTOP_CSS, KNIU_BADGE_CSS, KNIU_BASE_CONTAIN_CSS, KNIU_BASE_FONT_CSS, KNIU_BTN_CSS, KNIU_BTN_GROUP_CSS, KNIU_BTN_METRICS_CSS, KNIU_BTN_OVERRIDES_CSS, KNIU_COMMENT_CSS, KNIU_CONTAIN_EXCLUDE_TAGS, KNIU_CONTENT_TABLE_CSS, KNIU_CONTENT_TABLE_DOC_CSS, KNIU_DATE_PICKER_CSS, KNIU_DATE_PICKER_OVERRIDES_CSS, KNIU_DROPDOWN_CSS, KNIU_DROPDOWN_OPTION_CSS, KNIU_EDITOR_CSS, KNIU_EDITOR_OVERRIDE_CSS, KNIU_EDITOR_PRINT_CSS, KNIU_EMPTY_CSS, KNIU_FONT_FACE_CSS, KNIU_FONT_FAMILY, KNIU_FONT_MONO_FAMILY, KNIU_FONT_SERIF_FAMILY, KNIU_I18N, KNIU_ICON_CSS, KNIU_ICON_FONT_NAMES, KNIU_ICON_NAMES, KNIU_ICON_SVG, KNIU_IMAGE_CSS, KNIU_IMAGE_OVERRIDES_CSS, KNIU_INPUT_AFFIX_CSS, KNIU_INPUT_CSS, KNIU_INPUT_GROUP_CSS, KNIU_INPUT_METRICS_CSS, KNIU_INPUT_PASSWORD_ACTIONS_CSS, KNIU_INPUT_PASSWORD_CSS, KNIU_INPUT_STATES_CSS, KNIU_INPUT_TEXTAREA_CSS, KNIU_INPUT_TIP_CSS, KNIU_LIKE_CSS, KNIU_LOADING_CSS, KNIU_MARKDOWN_CSS, KNIU_MODAL_CONFIRM_CSS, KNIU_MODAL_CSS, KNIU_MSG_CSS, KNIU_NAVBAR_CELLS_CSS, KNIU_NAVBAR_CELL_CSS, KNIU_NAVBAR_CSS, KNIU_NAVBAR_PLACEHOLDER_CSS, KNIU_PAGE_CSS, KNIU_RADIO_GROUP_CSS, KNIU_RICHTEXT_CSS, KNIU_SELECT_CSS, KNIU_STATUS_CSS, KNIU_SUB_NAVBAR_CSS, KNIU_SUB_NAVBAR_OVERRIDES_CSS, KNIU_SWITCH_CSS, KNIU_TABLE_CLASS, KNIU_TABLE_COL_CSS, KNIU_TABLE_CSS, KNIU_TABLE_WRAP_CLASS, KNIU_TAB_CSS, KNIU_TAG_CSS, KNIU_UPLOAD_CSS, KNIU_USER_LOGIN_CSS, KNIU_USER_LOGIN_OVERRIDES_CSS, PRUNABLE_ATTRIBUTE_NAMES, REQUEST, RICH_TEXT_LITERAL_TAG_RE, SCROLL_LOCK_FLAG, SEMANTIC_EMPTY_ATTRIBUTES, SHADOW_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_RE, TEMPLATE, adoptDropdownStyle, adoptSharedStyle, adoptedSheetsFlushScheduled, appendRawStyle, applyScrollLock, attachComponentShadow, buildIconElement, buildPageList, compileTableRowTemplate, componentDefaults, componentLang, componentText, computePopoverLayout, confirm, createRowDeleteHandler, createSearchActions, createTable, debounce, flushPendingAdoptedSheets, getResponseRecords, getShadowInnerHTMLDescriptor, getSharedStyleSheet, hasRichTextLiteralTag, installMarkdownStyles, installOptionsOnlyProtocol, installRichTextStyles, isEmptyAttributeValue, lockDocumentScroll, makeSwitchOptions, mountAffixSlots, mountPopoverPortal, msg, normalizeComponentCss, normalizedCssCache, pendingAdoptedSheets, pruneEmptyAttribute, pruneEmptyAttributeTree, pruneEmptyAttributes, pruneEmptyRootAttributes, readScrollLockOriginals, reconcileDocumentScrollLock, releaseScrollLock, replaceChildrenWithFragment, resolveIconName, resolveTableRowTemplate, sanitizeRichHtml, sanitizeRichHtmlAsync, scheduleAdoptedSheetsFlush, scrollLockNodes, scrollLockOriginals, scrollLockOwners, setLoading, shadowInnerHTMLDescriptor, shadowStyleSheetCache, shadowTemplateCache, shouldContainHost, state, supportsAdoptedStyleSheets, tableTemplateCache, toastInstance, toastTimer, trackPopoverPosition, unlockDocumentScroll, unwrapTablesIn, use, usePage, usePagination, wrapTablesIn, writeScrollLockOriginals } = context;
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
  if (customElements.get('kniu-page')) return;

  const LAYOUT_ALIASES = {
    total: 'total', 总数: 'total',
    first: 'first', 首页: 'first',
    prev: 'prev', 上一页: 'prev',
    pager: 'pager', page: 'pager', 页码: 'pager',
    next: 'next', 下一页: 'next',
    last: 'last', 末页: 'last', 尾页: 'last',
    sizes: 'sizes', rows: 'sizes', 条数: 'sizes',
    jumper: 'jumper', jump: 'jumper', 跳转: 'jumper'
  };

  class KniuSysPage extends HTMLElement {
    static get observedAttributes() {
      return [];
    }

    constructor() {
      super();
      attachComponentShadow(this);
      this._total = 0;
      this._pageSize = 10;
      this._baseSize = 10;
      this._baseSizeInitialized = false;
      this._currentPage = 1;
      this._layout = 'total,prev,pager,next,sizes';
      this._background = false;
      this._firstText = null;
      this._prevText = null;
      this._nextText = null;
      this._lastText = null;
      this._sizes = [10, 20, 50, 100];
      this._options = null;
      this.shadowRoot.innerHTML = `
          <style>${KNIU_PAGE_CSS}</style>
          ${KNIU_PAGE_TEMPLATE}
        `;
      this._root = this.shadowRoot.querySelector('.kniu_sys_page');
      this._totalEl = this.shadowRoot.querySelector('.kniu_sys_page_total');
      this._firstEl = this.shadowRoot.querySelector('.kniu_sys_page_first');
      this._prevEl = this.shadowRoot.querySelector('.kniu_sys_page_prev');
      this._pagerEl = this.shadowRoot.querySelector('.kniu_sys_page_pager');
      this._nextEl = this.shadowRoot.querySelector('.kniu_sys_page_next');
      this._lastEl = this.shadowRoot.querySelector('.kniu_sys_page_last');
      this._sizesEl = this.shadowRoot.querySelector('.kniu_sys_page_sizes');
      this._jumperEl = this.shadowRoot.querySelector('.kniu_sys_page_jumper');
      this._jumperInput = this.shadowRoot.querySelector('.kniu_sys_page_jumper_input');
      this._jumperPrefix = this.shadowRoot.querySelector('.kniu_sys_page_jumper_prefix');
      this._jumperSuffix = this.shadowRoot.querySelector('.kniu_sys_page_jumper_suffix');
      this._sizesEl.options = { size: 'small' };
      this._firstEl.addEventListener('click', () => this._goto(1));
      this._prevEl.addEventListener('click', () => this._goto(this._currentPage - 1));
      this._nextEl.addEventListener('click', () => this._goto(this._currentPage + 1));
      this._lastEl.addEventListener('click', () => this._goto(this._pageTotal()));
      this._sizesEl.addEventListener('change', () => this._emit('size-change', { size: Number(this._sizesEl.value) || 10 }));
      this._jumperInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        this._goto(this._jumperInput.value);
        this._jumperInput.value = String(this._currentPage);
      });
      this._jumperInput.addEventListener('change', () => {
        this._goto(this._jumperInput.value);
        this._jumperInput.value = String(this._currentPage);
      });
    }

    connectedCallback() { this._render(); }

    get total() { return this._total; }
    set total(value) { this._total = Math.max(0, Number(value) || 0); this._render(); }
    get pageSize() { return this._pageSize; }
    set pageSize(value) {
      this._pageSize = Math.max(1, Number(value) || 10);
      if (!this._baseSizeInitialized || this._pageSize < this._baseSize || this._pageSize % this._baseSize !== 0) {
        this._baseSize = this._pageSize;
        this._baseSizeInitialized = true;
      }
      this._render();
    }
    get currentPage() { return this._currentPage; }
    set currentPage(value) { this._currentPage = Math.max(1, Number(value) || 1); this._render(); }
    set options(value) {
      const o = value && typeof value === 'object' ? value : {};
      this._options = o;
      if (o.total != null) this._total = Math.max(0, Number(o.total) || 0);
      if (o.pageSize != null) {
        const next = Math.max(1, Number(o.pageSize) || 10);
        this._pageSize = next;
        if (!this._baseSizeInitialized || next < this._baseSize || next % this._baseSize !== 0) {
          this._baseSize = next;
          this._baseSizeInitialized = true;
        }
      }
      if (o.currentPage != null) this._currentPage = Math.max(1, Number(o.currentPage) || 1);
      if (o.layout != null) this._layout = String(o.layout);
      if (o.background != null) this._background = !!o.background;
      if (o.firstText != null) this._firstText = String(o.firstText);
      if (o.prevText != null) this._prevText = String(o.prevText);
      if (o.nextText != null) this._nextText = String(o.nextText);
      if (o.lastText != null) this._lastText = String(o.lastText);
      if (Array.isArray(o.sizes) && o.sizes.length) this._sizes = o.sizes.map(function (n) { return Number(n) || 10; });
      this._render();
    }
    get options() { return this._options; }

    _parseLayout() {
      return this._layout.split(/[,，]/).map(function (item) {
        const token = item.trim();
        return LAYOUT_ALIASES[token] || LAYOUT_ALIASES[token.toLowerCase()] || token.toLowerCase();
      }).filter(Boolean);
    }

    _isEnglishLayout() {
      const tokens = this._layout.split(/[,，]/).map(function (item) { return item.trim(); }).filter(Boolean);
      return tokens.length > 0 && tokens.every(function (token) {
        return ['first', 'prev', 'page', 'pager', 'next', 'last', 'total', 'rows', 'sizes', 'jumper', 'jump'].includes(token.toLowerCase());
      });
    }

    _pageTotal() {
      return Math.max(1, Math.ceil(this._total / this._pageSize));
    }

    _buildSizes() {
      // 显式传入的 sizes 优先（此前只赋值不消费，options.sizes 是死属性）。
      if (Array.isArray(this._sizes) && this._sizes.length) {
        const custom = Array.from(new Set(this._sizes.map(function (n) { return Number(n) || 10; })))
          .sort(function (a, b) { return a - b; });
        if (custom.indexOf(this._pageSize) < 0) {
          custom.push(this._pageSize);
          custom.sort(function (a, b) { return a - b; });
        }
        return custom;
      }
      const base = this._baseSize;
      const arr = [];
      for (let i = 1; i <= 6; i++) arr.push(base * i);
      const sizes = Array.from(new Set(arr)).sort(function (a, b) { return a - b; });
      if (sizes.indexOf(this._pageSize) < 0) {
        sizes.push(this._pageSize);
        sizes.sort(function (a, b) { return a - b; });
      }
      return sizes;
    }

    _goto(page) {
      const total = this._pageTotal();
      const target = Math.min(Math.max(Number(page) || 1, 1), total);
      if (target === this._currentPage) return;
      this._currentPage = target;
      this._emit('current-change', { page: target });
      this._render();
    }

    _emit(name, detail) {
      this.dispatchEvent(new CustomEvent(name, { detail: detail, bubbles: true, composed: true }));
    }

    _render() {
      const total = this._total;
      const pageSize = this._pageSize;
      const current = this._currentPage;
      const pageTotal = this._pageTotal();
      const layout = this._parseLayout();
      const english = this._isEnglishLayout();

      this._totalEl.textContent = english ? `Total ${total}` : `共 ${total} 条`;
      if (pageTotal <= 1) {
        this._root.hidden = true;
        return;
      }
      this._root.hidden = false;
      this._firstEl.textContent = this._firstText ?? (english ? 'First' : '首页');
      this._prevEl.textContent = this._prevText ?? (english ? 'Prev' : '上一页');
      this._nextEl.textContent = this._nextText ?? (english ? 'Next' : '下一页');
      this._lastEl.textContent = this._lastText ?? (english ? 'Last' : '末页');
      this._jumperPrefix.textContent = english ? 'Go to' : '去';
      this._jumperSuffix.textContent = english ? 'Page' : '页';
      this._jumperInput.max = String(pageTotal);
      this._jumperInput.value = String(current);
      this._jumperInput.setAttribute('aria-label', english ? 'Jump to page' : '跳转页码');
      this._firstEl.disabled = current <= 1;
      this._prevEl.disabled = current <= 1;
      this._nextEl.disabled = current >= pageTotal;
      this._lastEl.disabled = current >= pageTotal;
      this._firstEl.dataset.background = String(this._background);
      this._prevEl.dataset.background = String(this._background);
      this._nextEl.dataset.background = String(this._background);
      this._lastEl.dataset.background = String(this._background);
      const sizes = this._buildSizes();
      const sizesFragment = document.createDocumentFragment();
      sizes.forEach((s) => {
        const opt = document.createElement('kniu-option');
        opt.value = String(s);
        opt.label = english ? `${s} rows/page` : `${s} 条/页`;
        sizesFragment.appendChild(opt);
      });
      this._sizesEl.replaceChildren(sizesFragment);
      this._sizesEl.value = String(pageSize);

      const pagerFragment = document.createDocumentFragment();
      const pageList = buildPageList(current, pageTotal);
      const self = this;
      pageList.forEach(function (p) {
        const btn = document.createElement('button');
        btn.className = 'kniu_sys_page_btn';
        btn.type = 'button';
        btn.dataset.background = String(self._background);
        btn.textContent = String(p);
        if (p === current) btn.classList.add('kniu_sys_page_btn_active');
        btn.addEventListener('click', function () { self._goto(p); });
        pagerFragment.appendChild(btn);
      });
      this._pagerEl.replaceChildren(pagerFragment);
      const orderMap = { total: this._totalEl, first: this._firstEl, prev: this._prevEl, pager: this._pagerEl, next: this._nextEl, last: this._lastEl, sizes: this._sizesEl, jumper: this._jumperEl };
      const rowFragment = document.createDocumentFragment();
      layout.forEach(function (key) {
        const el = orderMap[key];
        if (el) {
          el.style.display = '';
          rowFragment.appendChild(el);
        }
      });
      Object.keys(orderMap).forEach(function (key) {
        if (!layout.includes(key)) orderMap[key].style.display = 'none';
      });
      this._root.replaceChildren(rowFragment);
    }
  }

  customElements.define('kniu-page', KniuSysPage);
}