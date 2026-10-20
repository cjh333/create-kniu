export function registerTable(context) {
  const { BOOLEAN_ATTRIBUTES, IDENTITY, KNIU_BACKTOP_CSS, KNIU_BADGE_CSS, KNIU_BASE_CONTAIN_CSS, KNIU_BASE_FONT_CSS, KNIU_BTN_CSS, KNIU_BTN_GROUP_CSS, KNIU_BTN_METRICS_CSS, KNIU_BTN_OVERRIDES_CSS, KNIU_COMMENT_CSS, KNIU_CONTAIN_EXCLUDE_TAGS, KNIU_CONTENT_TABLE_CSS, KNIU_CONTENT_TABLE_DOC_CSS, KNIU_DATE_PICKER_CSS, KNIU_DATE_PICKER_OVERRIDES_CSS, KNIU_DROPDOWN_CSS, KNIU_DROPDOWN_OPTION_CSS, KNIU_EDITOR_CSS, KNIU_EDITOR_OVERRIDE_CSS, KNIU_EDITOR_PRINT_CSS, KNIU_EMPTY_CSS, KNIU_FONT_FACE_CSS, KNIU_FONT_FAMILY, KNIU_FONT_MONO_FAMILY, KNIU_FONT_SERIF_FAMILY, KNIU_I18N, KNIU_ICON_CSS, KNIU_ICON_FONT_NAMES, KNIU_ICON_NAMES, KNIU_ICON_SVG, KNIU_IMAGE_CSS, KNIU_IMAGE_OVERRIDES_CSS, KNIU_INPUT_AFFIX_CSS, KNIU_INPUT_CSS, KNIU_INPUT_GROUP_CSS, KNIU_INPUT_METRICS_CSS, KNIU_INPUT_PASSWORD_ACTIONS_CSS, KNIU_INPUT_PASSWORD_CSS, KNIU_INPUT_STATES_CSS, KNIU_INPUT_TEXTAREA_CSS, KNIU_INPUT_TIP_CSS, KNIU_LIKE_CSS, KNIU_LOADING_CSS, KNIU_MARKDOWN_CSS, KNIU_MODAL_CONFIRM_CSS, KNIU_MODAL_CSS, KNIU_MSG_CSS, KNIU_NAVBAR_CELLS_CSS, KNIU_NAVBAR_CELL_CSS, KNIU_NAVBAR_CSS, KNIU_NAVBAR_PLACEHOLDER_CSS, KNIU_PAGE_CSS, KNIU_RADIO_GROUP_CSS, KNIU_RICHTEXT_CSS, KNIU_SELECT_CSS, KNIU_STATUS_CSS, KNIU_SUB_NAVBAR_CSS, KNIU_SUB_NAVBAR_OVERRIDES_CSS, KNIU_SWITCH_CSS, KNIU_TABLE_CLASS, KNIU_TABLE_COL_CSS, KNIU_TABLE_CSS, KNIU_TABLE_WRAP_CLASS, KNIU_TAB_CSS, KNIU_TAG_CSS, KNIU_UPLOAD_CSS, KNIU_USER_LOGIN_CSS, KNIU_USER_LOGIN_OVERRIDES_CSS, PRUNABLE_ATTRIBUTE_NAMES, REQUEST, RICH_TEXT_LITERAL_TAG_RE, SCROLL_LOCK_FLAG, SEMANTIC_EMPTY_ATTRIBUTES, SHADOW_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_RE, TEMPLATE, adoptDropdownStyle, adoptSharedStyle, adoptedSheetsFlushScheduled, appendRawStyle, applyScrollLock, attachComponentShadow, buildIconElement, buildPageList, compileTableRowTemplate, componentDefaults, componentLang, componentText, computePopoverLayout, confirm, createRowDeleteHandler, createSearchActions, createTable, debounce, flushPendingAdoptedSheets, getResponseRecords, getShadowInnerHTMLDescriptor, getSharedStyleSheet, hasRichTextLiteralTag, installMarkdownStyles, installOptionsOnlyProtocol, installRichTextStyles, isEmptyAttributeValue, lockDocumentScroll, makeSwitchOptions, mountAffixSlots, mountPopoverPortal, msg, normalizeComponentCss, normalizedCssCache, pendingAdoptedSheets, pruneEmptyAttribute, pruneEmptyAttributeTree, pruneEmptyAttributes, pruneEmptyRootAttributes, readScrollLockOriginals, reconcileDocumentScrollLock, releaseScrollLock, replaceChildrenWithFragment, resolveIconName, resolveTableRowTemplate, sanitizeRichHtml, sanitizeRichHtmlAsync, scheduleAdoptedSheetsFlush, scrollLockNodes, scrollLockOriginals, scrollLockOwners, setLoading, shadowInnerHTMLDescriptor, shadowStyleSheetCache, shadowTemplateCache, shouldContainHost, state, supportsAdoptedStyleSheets, tableTemplateCache, toastInstance, toastTimer, trackPopoverPosition, unlockDocumentScroll, unwrapTablesIn, use, usePage, usePagination, wrapTablesIn, writeScrollLockOriginals } = context;

  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;

  if (!customElements.get('kniu-table-col')) {
    class KniuSysTableColumn extends HTMLElement {
      constructor() {
        super();
        attachComponentShadow(this);
        this.shadowRoot.innerHTML = '<style>' + KNIU_TABLE_COL_CSS + '</style><slot></slot>';
      }
      set onChange(value) { this._onChange = typeof value === 'function' ? value : null; }
      get onChange() { return this._onChange; }
      set formatter(value) { this._formatter = typeof value === 'function' ? value : null; }
      get formatter() { return this._formatter; }
      set sortMethod(value) { this._sortMethod = typeof value === 'function' ? value : null; }
      get sortMethod() { return this._sortMethod; }
      set selectable(value) { this._selectable = typeof value === 'function' ? value : null; }
      get selectable() { return this._selectable; }
    }
    customElements.define('kniu-table-col', KniuSysTableColumn);
  }

  if (customElements.get('kniu-table')) return;

  class KniuSysTable extends HTMLElement {
    static get observedAttributes() {
      return [];
    }

    constructor() {
      super();
      attachComponentShadow(this);
      this._config = {};
      this._table = null;
      this._columns = [];
      this._columnDefinitionsCleared = false;
      this._loading = false;
      this._loadingText = '';
      this._renderQueued = false;
    }

    connectedCallback() {
      this._queueRender();
    }

    attributeChangedCallback() {
      if (this.isConnected) this._queueRender();
    }

    disconnectedCallback() {
      this._destroyTable();
    }

    set config(value) {
      this._config = value && typeof value === 'object' ? value : null;
      if (this.isConnected) this._queueRender();
    }

    get config() {
      return this._config;
    }

    set tableConfig(value) {
      this.config = value;
    }

    get tableConfig() {
      return this.config;
    }

    set options(value) {
      const opts = value && typeof value === 'object' ? value : {};
      const langChanged = Object.hasOwn(opts, 'lang') && componentLang(opts) !== componentLang(this._config);
      if (!this._config) this._config = {};
      this._config = { ...this._config, ...opts };
      if (Object.hasOwn(opts, 'loading')) this._loading = !!opts.loading;
      if (Object.hasOwn(opts, 'loadingText')) this._loadingText = opts.loadingText == null ? '' : String(opts.loadingText);
      if (this._table) this._table.setLoading(this._loading, this._loadingText);
      if (this._table && Object.hasOwn(opts, 'maxHeight')) this._table.setMaxHeight(opts.maxHeight);
      if (langChanged) { this._queueRender(); this._clearColumnDefinitions(); return; }
      if (Array.isArray(opts.data)) {
        if (this._table) {
          queueMicrotask(() => {
            this._readColumns();
            if (this._table) this._table.setData(this._config.data || []);
          });
        } else if (this.isConnected) this._queueRender();
      } else if (this.isConnected) this._queueRender();
      this._clearColumnDefinitions();
    }

    get options() {
      return this._config;
    }

    set data(value) {
      if (!this._config) this._config = {};
      this._config.data = Array.isArray(value) ? value : [];
      if (this._table) this._table.setData(this._config.data);
      else if (this.isConnected) this._queueRender();
      this._clearColumnDefinitions();
    }

    get data() {
      return this._config?.data || [];
    }

    set loading(value) {
      this._loading = !!value;
      if (this._table) this._table.setLoading(this._loading, this._loadingText);
    }

    get loading() {
      return this._loading;
    }

    set loadingText(value) {
      this._loadingText = value == null ? '' : String(value);
      if (this._table) this._table.setLoading(this._loading, this._loadingText);
    }

    get loadingText() {
      return this._loadingText;
    }

    _clearColumnDefinitions() {
      return;
    }

    _readColumns() {
      let columnElements = [...this.querySelectorAll(':scope > kniu-table-col')];
      if (!columnElements.length && this._columnElements && this._columnElements.length) {
        columnElements = this._columnElements;
      }
      if (!columnElements.length) return;
      this._columnElements = columnElements;
      const columns = columnElements.map((element) => {
        const fixedAttribute = element.getAttribute('fixed');
        const template = element.querySelector('template');
        const imageElement = template?.content.querySelector('kniu-image');
        const tagElement = template?.content.querySelector('kniu-tag');
        const statusElement = template?.content.querySelector('kniu-status');
        // 兼容两条 option 注入路径（与下方 onChange 同口径）：模板引擎对自定义组件写 node.options，
        // 非 options-only 路径才写 __kniuOptionsValue；函数型配置（formatter/sortMethod/selectable）
        // 不会反射成属性，只能从 options 读取。
        const columnOptions = element.__kniuOptionsValue && typeof element.__kniuOptionsValue === 'object'
          ? element.__kniuOptionsValue
          : (element.options && typeof element.options === 'object' ? element.options : null);
        const optionOrAttr = (optionName, attributeName) => {
          if (columnOptions && columnOptions[optionName] !== undefined && columnOptions[optionName] !== null) {
            return columnOptions[optionName];
          }
          return attributeName === undefined ? element.getAttribute(optionName) : element.getAttribute(attributeName);
        };
        const fixedSource = columnOptions && columnOptions.fixed !== undefined && columnOptions.fixed !== null
          ? columnOptions.fixed
          : (element.hasAttribute('fixed') ? String(fixedAttribute) : null);
        const fixed = fixedSource === false || fixedSource === '' || fixedSource === null
          ? false
          : (String(fixedSource).toLowerCase() === 'right' ? 'right' : 'left');
        const editableSource = columnOptions && columnOptions.editable !== undefined && columnOptions.editable !== null
          ? columnOptions.editable
          : (element.hasAttribute('editable') ? element.getAttribute('editable') : undefined);
        const editable = editableSource === undefined
          ? false
          : (editableSource === 'number'
            ? 'number'
            : editableSource === 'text'
              ? 'text'
              : editableSource !== false && editableSource !== 'false');
        const editMinSource = columnOptions && columnOptions.editMin !== undefined && columnOptions.editMin !== null
          ? columnOptions.editMin
          : (element.hasAttribute('edit-min') ? element.getAttribute('edit-min') : null);
        const column = {
          type: optionOrAttr('type') || 'default',
          field: optionOrAttr('field') || '',
          label: optionOrAttr('label') || '',
          width: optionOrAttr('width') || (element.style && element.style.width) || '',
          minWidth: optionOrAttr('minWidth', 'min-width') || '',
          align: ['left', 'center', 'right'].includes(optionOrAttr('align'))
            ? optionOrAttr('align')
            : ((element.style && element.style.textAlign) || 'left'),
          headerAlign: ['left', 'center', 'right'].includes(optionOrAttr('headerAlign', 'header-align'))
            ? optionOrAttr('headerAlign', 'header-align')
            : '',
          showOverflowTooltip: (columnOptions && columnOptions.showOverflowTooltip === true) || element.hasAttribute('show-overflow-tooltip'),
          sortable: (columnOptions && columnOptions.sortable === true) || element.hasAttribute('sortable'),
          sortMethod: (columnOptions && columnOptions.sortMethod) || element.sortMethod,
          formatter: (columnOptions && columnOptions.formatter) || element.formatter,
          selectable: (columnOptions && columnOptions.selectable) || element.selectable,
          index: optionOrAttr('index') || 1,
          editable: editable,
          editMin: editMinSource === null ? null : Number(editMinSource),
          image: imageElement ? {
            attributes: Object.fromEntries([...imageElement.attributes].map(function (attribute) {
              return [attribute.name, attribute.value];
            })),
            width: imageElement.style.width || '80px',
            height: imageElement.style.height || '80px'
          } : null,
          tag: tagElement ? {
            attributes: Object.fromEntries([...tagElement.attributes].map(function (attribute) {
              return [attribute.name, attribute.value === '' ? true : attribute.value];
            }))
          } : null,
          status: statusElement ? {
            attributes: Object.fromEntries([...statusElement.attributes].map(function (attribute) {
              return [attribute.name, attribute.value === '' ? true : attribute.value];
            }))
          } : null,
          onChange: (...args) => {
            // 兼容两条 option 注入路径：模板引擎对自定义组件走 node.options（options-only 协议），
            // 非 options-only 路径才写 __kniuOptionsValue；缺失回调时按既有口径视为保存成功。
            const optionOnChange = element.__kniuOptionsValue?.onChange
              ?? (element.options && typeof element.options === 'object' ? element.options.onChange : undefined);
            if (typeof optionOnChange === 'function') return optionOnChange(...args);
            if (typeof element.onChange === 'function') return element.onChange(...args);
            return true;
          },
          fixed: fixed
        };
        const buttons = [
          ...element.querySelectorAll(':scope > kniu-btn'),
          ...(template ? template.content.querySelectorAll('kniu-btn') : [])
        ].filter(function (button) {
          return !button.hasAttribute('data-kniu-if') || button.getAttribute('data-kniu-if') === 'true';
        });
        const switchElement = element.querySelector(':scope > kniu-switch')
          || template?.content.querySelector('kniu-switch');
        if (switchElement) {
          column.switch = {
            get options() {
              const direct = typeof switchElement.options === 'object' && switchElement.options
                ? switchElement.options : null;
              if (direct) return direct;
              const expando = switchElement.__kniuOptionsValue;
              return expando && typeof expando === 'object' ? expando : null;
            },
            onChange: (index, rows, value) => {
              const handler = element.__kniuTableScopedSwitchHandler
                || switchElement.__kniuTableScopedHandler;
              if (typeof handler === 'function') return handler(index, rows, value);
              if (typeof element.onChange === 'function') return element.onChange(index, rows, value);
              return true;
            }
          };
        }
        const radioGroupElement = element.querySelector(':scope > kniu-radio-group')
          || template?.content.querySelector('kniu-radio-group');
        if (radioGroupElement) {
          const radioOptions = Array.from(radioGroupElement.querySelectorAll(':scope > kniu-radio')).map(function (radio) {
            return {
              value: radio.getAttribute('value') || '',
              label: radio.getAttribute('label') || (radio.textContent || '').trim()
            };
          });
          column.radio = {
            options: radioOptions,
            onChange: (...args) => {
              if (typeof radioGroupElement.__kniuTableScopedHandler === 'function') {
                return radioGroupElement.__kniuTableScopedHandler(...args);
              }
              if (typeof element.onChange === 'function') return element.onChange(...args);
              return true;
            }
          };
        }
        if (buttons.length) {
          column.actions = buttons.map(function (button) {
            const buttonOptions = (button.__kniuOptionsValue && typeof button.__kniuOptionsValue === 'object'
              ? button.__kniuOptionsValue
              : (button.options && typeof button.options === 'object' ? button.options : null)) || {};
            const optionValue = (name, fallback = '') => buttonOptions[name] !== undefined ? buttonOptions[name] : fallback;
            const optionFlag = (name, fallback = false) => buttonOptions[name] !== undefined ? !!buttonOptions[name] : fallback;
            return {
              title: button.textContent.trim() || '操作',
              className: button.getAttribute('class') || optionValue('className'),
              type: optionValue('type', button.getAttribute('type') || ''),
              size: optionValue('size', button.getAttribute('size') || ''),
              plain: optionFlag('plain', button.hasAttribute('plain')),
              text: optionFlag('text', button.hasAttribute('text')),
              bg: optionFlag('bg', button.hasAttribute('bg')),
              link: optionFlag('link', button.hasAttribute('link')),
              round: optionFlag('round', button.hasAttribute('round')),
              circle: optionFlag('circle', button.hasAttribute('circle')),
              disabled: optionFlag('disabled', button.hasAttribute('disabled')),
              // 条件同时兼容 kniu:if 与 :if 两种写法，只认 kniu:if 会让视图的 :if 恒显。
              condition: (button.getAttribute('kniu:if') || button.getAttribute(':if') || null),
              icon: button.getAttribute('icon') || '',
              onClick: ({ index, rows }) => {
                const handler = button.__kniuTableScopedHandler;
                if (typeof handler === 'function') return handler(index, rows);
                return false;
              }
            };
          });
        }
        return column;
      });
      this._columns.length = 0;
      this._columns.push(...columns);
    }

    _destroyTable() {
      if (!this._table) return;
      this._table.destroy();
      this._table = null;
    }

    _queueRender() {
      if (this._renderQueued) return;
      this._renderQueued = true;
      queueMicrotask(() => {
        this._renderQueued = false;
        if (this.isConnected) this._renderTable();
      });
    }

    _renderTable() {
      this._readColumns();
      const columns = this._columns;
      if (!Array.isArray(columns) || !columns.length) return;
      this._destroyTable();
      const cfg = this._config || {};
      this._table = createTable({
        ...cfg,
        cols: columns,
        data: this.data,
        host: this,
        height: cfg.height,
        maxHeight: cfg.maxHeight ?? this.style.maxHeight,
        stripe: cfg.stripe === true,
        border: cfg.border === true,
        size: cfg.size || 'default',
        fit: cfg.fit !== false,
        showHeader: cfg.showHeader !== false,
        highlightCurrentRow: cfg.highlightCurrentRow === true,
        rowKey: cfg.rowKey || '',
        emptyText: cfg.emptyText ?? componentText(componentLang(this.options), 'table.empty'),
        emptySlot: !!this.querySelector('[slot="empty"]'),
        loading: this._loading,
        loadingText: this._loadingText,
        lang: componentLang(this.options),
        el: this.shadowRoot
      });
    }

    clearSelection() { return this._table?.clearSelection(); }

    refreshColumns() {
      if (this.isConnected) this._renderTable();
    }

    getSelectionRows() { return this._table?.getSelectionRows() || []; }

    toggleRowSelection(row, selected) { return this._table?.toggleRowSelection(row, selected); }

    setCurrentRow(row) { return this._table?.setCurrentRow(row); }

    sort(field, order) { return this._table?.sort(field, order); }

    clearSort() { return this._table?.clearSort(); }

    doLayout() { return this._table?.doLayout(); }
  }

  customElements.define('kniu-table', KniuSysTable);
}