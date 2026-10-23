import KNIU_DATE_PICKER_TEMPLATE from './kniu-date-picker.html?module';
import KNIU_DATE_PICKER_RANGE_TEMPLATE from './kniu-date-picker.range.html?module';

export function registerDatePicker(context) {
  const { BOOLEAN_ATTRIBUTES, IDENTITY, anchorScrollRoots, KNIU_BACKTOP_CSS, KNIU_BADGE_CSS, KNIU_BASE_CONTAIN_CSS, KNIU_BASE_FONT_CSS, KNIU_BTN_CSS, KNIU_BTN_GROUP_CSS, KNIU_BTN_METRICS_CSS, KNIU_BTN_OVERRIDES_CSS, KNIU_COMMENT_CSS, KNIU_CONTAIN_EXCLUDE_TAGS, KNIU_CONTENT_TABLE_CSS, KNIU_CONTENT_TABLE_DOC_CSS, KNIU_DATE_PICKER_CSS, KNIU_DATE_PICKER_OVERRIDES_CSS, KNIU_DROPDOWN_CSS, KNIU_DROPDOWN_OPTION_CSS, KNIU_EDITOR_CSS, KNIU_EDITOR_OVERRIDE_CSS, KNIU_EDITOR_PRINT_CSS, KNIU_EMPTY_CSS, KNIU_FONT_FACE_CSS, KNIU_FONT_FAMILY, KNIU_FONT_MONO_FAMILY, KNIU_FONT_SERIF_FAMILY, KNIU_I18N, KNIU_ICON_CSS, KNIU_ICON_FONT_NAMES, KNIU_ICON_NAMES, KNIU_ICON_SVG, KNIU_IMAGE_CSS, KNIU_IMAGE_OVERRIDES_CSS, KNIU_INPUT_AFFIX_CSS, KNIU_INPUT_CSS, KNIU_INPUT_GROUP_CSS, KNIU_INPUT_METRICS_CSS, KNIU_INPUT_PASSWORD_ACTIONS_CSS, KNIU_INPUT_PASSWORD_CSS, KNIU_INPUT_STATES_CSS, KNIU_INPUT_TEXTAREA_CSS, KNIU_INPUT_TIP_CSS, KNIU_LIKE_CSS, KNIU_LOADING_CSS, KNIU_MARKDOWN_CSS, KNIU_MODAL_CONFIRM_CSS, KNIU_MODAL_CSS, KNIU_MSG_CSS, KNIU_NAVBAR_CELLS_CSS, KNIU_NAVBAR_CELL_CSS, KNIU_NAVBAR_CSS, KNIU_NAVBAR_PLACEHOLDER_CSS, KNIU_PAGE_CSS, KNIU_RADIO_GROUP_CSS, KNIU_RICHTEXT_CSS, KNIU_SELECT_CSS, KNIU_STATUS_CSS, KNIU_SUB_NAVBAR_CSS, KNIU_SUB_NAVBAR_OVERRIDES_CSS, KNIU_SWITCH_CSS, KNIU_TABLE_CLASS, KNIU_TABLE_COL_CSS, KNIU_TABLE_CSS, KNIU_TABLE_WRAP_CLASS, KNIU_TAB_CSS, KNIU_TAG_CSS, KNIU_UPLOAD_CSS, KNIU_USER_LOGIN_CSS, KNIU_USER_LOGIN_OVERRIDES_CSS, PRUNABLE_ATTRIBUTE_NAMES, REQUEST, RICH_TEXT_LITERAL_TAG_RE, SCROLL_LOCK_FLAG, SEMANTIC_EMPTY_ATTRIBUTES, SHADOW_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_RE, TEMPLATE, adoptDropdownStyle, adoptSharedStyle, adoptedSheetsFlushScheduled, appendRawStyle, applyScrollLock, attachComponentShadow, buildIconElement, buildPageList, compileTableRowTemplate, componentDefaults, componentLang, componentText, computePopoverLayout, confirm, createRowDeleteHandler, createSearchActions, createTable, debounce, deferAffixTemplateMount, flushPendingAdoptedSheets, getResponseRecords, getShadowInnerHTMLDescriptor, getSharedStyleSheet, hasRichTextLiteralTag, installMarkdownStyles, installOptionsOnlyProtocol, installRichTextStyles, isEmptyAttributeValue, lockDocumentScroll, makeSwitchOptions, mountAffixSlots, mountPopoverPortal, msg, normalizeComponentCss, normalizedCssCache, pendingAdoptedSheets, pruneEmptyAttribute, pruneEmptyAttributeTree, pruneEmptyAttributes, pruneEmptyRootAttributes, readScrollLockOriginals, reconcileDocumentScrollLock, releaseScrollLock, replaceChildrenWithFragment, resolveIconName, resolveTableRowTemplate, sanitizeRichHtml, sanitizeRichHtmlAsync, scheduleAdoptedSheetsFlush, scrollLockNodes, scrollLockOriginals, scrollLockOwners, setLoading, shadowInnerHTMLDescriptor, shadowStyleSheetCache, shadowTemplateCache, shouldContainHost, state, supportsAdoptedStyleSheets, tableTemplateCache, toastInstance, toastTimer, trackPopoverPosition, unlockDocumentScroll, unwrapTablesIn, use, usePage, usePagination, wrapTablesIn, writeScrollLockOriginals } = context;
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
  if (customElements.get('kniu-date-picker')) return;
  class KniuSysDatePicker extends HTMLElement {
    static get observedAttributes() { return ['name']; }
    constructor() {
      super();
      attachComponentShadow(this);
      let pendingValue;
      if (Object.prototype.hasOwnProperty.call(this, 'value')) {
        pendingValue = this.value;
        delete this.value;
      }
      let pendingOptions = null;
      if (Object.prototype.hasOwnProperty.call(this, 'options')) {
        pendingOptions = this.options;
        delete this.options;
      } else if (Object.prototype.hasOwnProperty.call(this, '__kniuOptionsValue')) {
        pendingOptions = this.__kniuOptionsValue;
        delete this.__kniuOptionsValue;
      }
      this.shadowRoot.innerHTML = `<style>${KNIU_DATE_PICKER_CSS}</style>${KNIU_DATE_PICKER_TEMPLATE}`;
      const datePanel = this.shadowRoot.querySelector('.kniu_sys_date_picker_panel');
      if (datePanel) datePanel.classList.add('kniu_sys_dropdown_panel');
      adoptDropdownStyle(this.shadowRoot);
      adoptSharedStyle(this.shadowRoot, KNIU_DATE_PICKER_OVERRIDES_CSS);
      this._input = this.shadowRoot.querySelector('.kniu_sys_date_picker_input');
      this._panel = this.shadowRoot.querySelector('.kniu_sys_date_picker_panel');
      this._days = this.shadowRoot.querySelector('.kniu_sys_date_picker_days');
      this._title = this.shadowRoot.querySelector('.kniu_sys_date_picker_title');
      this._chooser = this.shadowRoot.querySelector('.kniu_sys_date_picker_chooser');
      this._rangeCalendars = document.createElement('div');
      this._rangeCalendars.className = 'kniu_sys_date_picker_range_calendars';
      this._rangeCalendars.hidden = true;
      this._rangeCalendars.innerHTML = KNIU_DATE_PICKER_RANGE_TEMPLATE;
      this._chooser.after(this._rangeCalendars);
      this._panel.insertBefore(this._panel.querySelector('.kniu_sys_date_picker_time'), this._panel.querySelector('.kniu_sys_date_picker_head'));
      this._panelMode = 'day';
      this._draft = new Date();
      this._preferredDay = this._draft.getDate();
      this._viewYear = this._draft.getFullYear();
      this._viewMonth = this._draft.getMonth();
      this._panelMode = 'day';
      this._outsideHandler = (event) => {
        const path = event.composedPath();
        if (!path.includes(this) && !path.includes(this._panel)) this._close();
      };
      this._positionTimer = null;
      this._animationTimer = null;
      this._options = {};
      this._portalState = null;
      this._rangeValue = ['', ''];
      this._rangePhase = 'start';
      this._rangeChooser = { pane: '', mode: '' };
      this._input.addEventListener('click', () => this._open());
      this._input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') { event.preventDefault(); this._open(); }
        if (event.key === 'Escape') this._close();
      });
      this._panel.addEventListener('click', (event) => this._handleClick(event));
      ['hour', 'minute', 'second'].forEach((unit) => {
        const options = this._panel.querySelector(`[data-time-field="${unit}"] .kniu_sys_date_picker_time_options`);
        const max = unit === 'hour' ? 23 : 59;
        for (let number = 0; number <= max; number += 1) {
          const option = document.createElement('button');
          option.type = 'button'; option.className = 'kniu_sys_date_picker_time_option'; option.dataset.timeOption = unit; option.dataset.value = String(number);
          option.textContent = String(number).padStart(2, '0');
          options.appendChild(option);
        }
      });
      if (pendingOptions && typeof pendingOptions === 'object') this.options = pendingOptions;
      if (pendingValue !== undefined) this.value = pendingValue;
    }
    connectedCallback() { this._mountAffixes(); this._mountPortal(); this._sync(); }
    disconnectedCallback() {
      this._removeGlobalListeners();
      if (this._portalState) { this._portalState.unmount(); this._portalState = null; }
    }
    attributeChangedCallback() { if (this._input) { this._mountAffixes(); this._sync(); } }
    get value() { return this._options.range === true ? [...this._rangeValue] : (this._input.dataset.value || ''); }
    set value(value) {
      if (this._options.range === true) {
        const values = Array.isArray(value) ? value : String(value || '').split(this._options.rangeSeparator || ',').slice(0, 2);
        this._rangeValue = [values[0] || '', values[1] || ''].map((item) => {
          const parsed = this._parse(item);
          return parsed ? this._format(parsed) : '';
        });
        this._syncRangeDisplay();
        return;
      }
      const text = value == null ? '' : String(value);
      const date = this._parse(text);
      this._input.dataset.value = date ? this._format(date) : '';
      this._input.value = date ? this._formatDisplay(date) : '';
    }
    focus() { this._input.focus(); }
    open() { this._open(); }
    close() { this._close(); }
    get options() { return this._options; }
    set options(value) {
      const currentValue = this.value;
      this._options = value && typeof value === 'object' ? value : {};
      if ((Array.isArray(currentValue) && currentValue.some(Boolean)) || (!Array.isArray(currentValue) && currentValue)) this.value = currentValue;
      else if (this._options.value != null) this.value = this._options.value;
      if (this._input) this._sync();
      if (this.isConnected && !this._panel.hidden) this._render();
    }
    _mountPortal() {
      if (this._portalState?.portal?.isConnected) return;
      this._portalState = mountPopoverPortal(this._panel, this.shadowRoot, {
        zIndex: 10020,
        attribute: 'data-kniu-date-picker-portal',
      });
    }
    _mountAffixes() {
      const group = this.shadowRoot.querySelector('.kniu_sys_date_picker_group');
      ['prepend', 'append'].forEach((name) => {
        const template = Array.from(this.children).find((child) => child.tagName === 'TEMPLATE' && child.hasAttribute(`#${name}`));
        if (template) {
          deferAffixTemplateMount(template, () => {
            const templateWidth = template.getAttribute('label-width')
              || (template.__kniuOptionsValue && template.__kniuOptionsValue.labelWidth)
              || '';
            const fragment = document.createDocumentFragment();
            Array.from(template.content.childNodes).forEach((node) => {
              if (node.nodeType === 3 && !node.textContent.trim()) return;
              const item = node.nodeType === 3 ? document.createElement('span') : node;
              if (node.nodeType === 3) item.textContent = node.textContent;
              item.setAttribute('slot', name);
              if (templateWidth) item.dataset.labelWidth = templateWidth;
              fragment.appendChild(item);
            });
            template.replaceWith(fragment);
          }, () => this._mountAffixes());
        }
        const content = this.querySelector(`[slot="${name}"]`);
        const affix = this.shadowRoot.querySelector(`.kniu_sys_date_picker_${name}`);
        const width = content?.dataset.labelWidth || '';
        group.dataset[`has${name[0].toUpperCase()}${name.slice(1)}`] = String(Boolean(content));
        if (width && CSS.supports('width', width)) {
          const sized = `calc(${width} + 1px)`;
          affix.style.width = sized;
          affix.style.flexBasis = sized;
        }
      });
    }
    _sync() {
      const name = this._options.name;
      if (name == null) this._input.removeAttribute('name'); else this._input.name = name;
      const pickerLang = String(this._options.lang || 'cn').toLowerCase() === 'en';
      const defaultPlaceholder = this._options.range === true
        ? (pickerLang ? 'Select start and end time' : '请选择开始和结束时间')
        : (this._options.type === 'datetime' ? (pickerLang ? 'Select date and time' : '请选择日期时间')
          : (this._options.type === 'time' ? (pickerLang ? 'Select time' : '请选择时间')
            : (pickerLang ? 'Select date' : '请选择日期')));
      this._input.placeholder = this._options.placeholder || defaultPlaceholder;
      this._input.disabled = this._options.disabled === true;
      this._input.required = this._options.required === true;
      if (this._options.disabled === true || this._options.readonly === true) this._close();
    }
    _parse(value) {
      const timeMatch = String(value || '').trim().match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
      if (timeMatch) {
        const now = new Date();
        now.setHours(+timeMatch[1], +timeMatch[2], +(timeMatch[3] || 0), 0);
        return now;
      }
      const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
      if (!match) return null;
      const date = new Date(+match[1], +match[2] - 1, +match[3], +(match[4] || 0), +(match[5] || 0), +(match[6] || 0));
      return Number.isNaN(date.getTime()) ? null : date;
    }
    _format(date) {
      const pad = (number) => String(number).padStart(2, '0');
      if (this._options.type === 'time') return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
      const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      return this._options.type === 'datetime' ? `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` : day;
    }
    _formatDisplay(date) {
      const pad = (number) => String(number).padStart(2, '0');
      const format = this._normalizeFormat(this._options.format || (this._options.type === 'datetime' ? 'yyyy-MM-dd HH:mm:ss' : (this._options.type === 'time' ? 'HH:mm:ss' : 'yyyy-MM-dd')));
      return format
        .replace(/yyyy/g, String(date.getFullYear()))
        .replace(/MM/g, pad(date.getMonth() + 1))
        .replace(/mm|ii/g, pad(date.getMinutes()))
        .replace(/dd/g, pad(date.getDate()))
        .replace(/HH|hh/g, pad(date.getHours()))
        .replace(/ii/g, pad(date.getMinutes()))
        .replace(/ss/g, pad(date.getSeconds()));
    }
    _normalizeFormat(value) {
      const format = String(value || '');
      const colonIndex = format.indexOf(':');
      let timeStart = Number.POSITIVE_INFINITY;
      if (colonIndex >= 0) {
        const prefix = format.slice(0, colonIndex);
        const separatorIndex = Math.max(prefix.lastIndexOf(' '), prefix.lastIndexOf('T'), prefix.lastIndexOf('t'));
        if (separatorIndex >= 0) timeStart = separatorIndex + 1;
        else if (this._options.type === 'time' || !/[yYdD]/.test(prefix)) timeStart = 0;
        else {
          const hourIndex = prefix.search(/[hH]/);
          if (hourIndex >= 0) timeStart = hourIndex;
        }
      }
      return format.replace(/(?:[yY]+|[mM]+|[iI]+|[dD]+|[hH]+|[sS]+)/g, (token, offset) => {
        const unit = token[0].toLowerCase();
        if (unit === 'y' || unit === 'i' || unit === 'd' || unit === 's') return token.toLowerCase();
        if (unit === 'h') return token.toUpperCase();
        if (unit === 'm') return offset >= timeStart ? token.toLowerCase() : token.toUpperCase();
        return token;
      });
    }
    _syncRangeDisplay() {
      const display = this._rangeValue.map((item) => {
        const parsed = this._parse(item);
        return parsed ? this._formatDisplay(parsed) : '';
      });
      this._input.dataset.value = this._rangeValue.join(this._options.rangeSeparator || ',');
      this._input.value = display.filter(Boolean).join(this._options.displaySeparator || ' 至 ');
    }
    _firstDayOfWeek() {
      return Number(this._options.weekStart) === 0 ? 0 : 1;
    }
    _open() {
      if (this._options.disabled === true || this._options.readonly === true) return;
      if (this._animationTimer) globalThis.clearTimeout(this._animationTimer);
      this._animationTimer = null;
      this._mountPortal();
      this._draft = this._parse(this.value) || new Date();
      if (this._options.range === true) {
        this._rangeChooser = { pane: '', mode: '' };
        this._rangePhase = this._rangeValue[0] && !this._rangeValue[1] ? 'end' : 'start';
        const activeValue = this._rangePhase === 'end' ? this._rangeValue[0] : this._rangeValue[0];
        this._draft = this._parse(activeValue) || new Date();
      }
      this._preferredDay = this._draft.getDate();
      this._viewYear = this._draft.getFullYear();
      this._viewMonth = this._draft.getMonth();
      this._panelMode = 'day';
      this._render();
      this._panel.hidden = false;
      this.dataset.open = 'true';
      this._positionPanel();
      delete this._panel.dataset.state;
      void this._panel.offsetWidth;
      this._panel.dataset.state = 'open';
      this._startPositionTracking();
      if (this._positionTimer) globalThis.clearTimeout(this._positionTimer);
      this._positionTimer = globalThis.setTimeout(() => {
        this._positionTimer = null;
        if (!this._panel.hidden) this._positionPanel();
      }, 280);
      globalThis.addEventListener('pointerdown', this._outsideHandler, true);
      // 锚点跟随统一走 trackPopoverPosition（B-m2/规则 213）：rAF 同帧合并 + key 去重，
      // 替代逐事件同步 _positionPanel 的三通道直调（每帧强制布局）。
    }
    _close() {
      if (this._panel.hidden || this._panel.dataset.state === 'closing') return;
      delete this.dataset.open;
      if (this._positionTimer) globalThis.clearTimeout(this._positionTimer);
      this._positionTimer = null;
      this._removeGlobalListeners();
      this._closeTimeMenus();
      const finish = () => {
        if (this._animationTimer) globalThis.clearTimeout(this._animationTimer);
        this._animationTimer = null;
        this._panel.hidden = true;
        delete this._panel.dataset.state;
      };
      if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
      this._panel.dataset.state = 'closing';
      this._animationTimer = globalThis.setTimeout(finish, 170);
    }
    _removeGlobalListeners() {
      globalThis.removeEventListener('pointerdown', this._outsideHandler, true);
      if (this._disposeTrack) {
        this._disposeTrack();
        this._disposeTrack = null;
      }
    }
    _positionPanel() {
      const rect = this._input.getBoundingClientRect();
      const width = Math.min(this._panel.offsetWidth || 322, globalThis.innerWidth - 16);
      let left = Math.min(rect.left, globalThis.innerWidth - width - 8);
      left = Math.max(8, left);
      const panelHeight = this._panel.offsetHeight || 390;
      const spaceBelow = globalThis.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const placement = spaceBelow < panelHeight && spaceAbove >= panelHeight ? 'top' : 'bottom';
      const viewportTop = placement === 'top' ? rect.top - panelHeight - 6 : rect.bottom + 6;
      this._panel.dataset.placement = placement;
      this._panel.style.left = `${left}px`;
      this._panel.style.top = `${viewportTop}px`;
    }
    _startPositionTracking() {
      // 锚点跟随唯一入口 trackPopoverPosition（规则 213）：scroll composed 链逐级
      // capture + resize 由其内部接管，rAF 合批同帧只测一次、key 未变不重排。
      if (this._disposeTrack) {
        this._disposeTrack();
        this._disposeTrack = null;
      }
      const self = this;
      this._disposeTrack = trackPopoverPosition(
        function anchorRect() {
          return self._input ? self._input.getBoundingClientRect() : null;
        },
        function apply() {
          if (!self._panel.hidden) self._positionPanel();
        },
        function onDone(dispose) { self._disposeTrack = dispose; },
        this._input
      );
    }
    _render() {
      const isEnglish = String(this._options.lang || 'cn').toLowerCase() === 'en';
      const rangeMode = this._options.range === true;
      const yearPageStart = this._viewYear - 7;
      const yearTitle = this._title.querySelector('[data-action="choose-year"]');
      const monthTitle = this._title.querySelector('[data-action="choose-month"]');
      const monthNames = isEnglish ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : null;
      this._title.dataset.lang = isEnglish ? 'en' : 'cn';
      yearTitle.textContent = isEnglish ? String(this._viewYear) : `${this._viewYear} 年`;
      monthTitle.textContent = isEnglish ? monthNames[this._viewMonth] : `${this._viewMonth + 1} 月`;
      monthTitle.hidden = false;
      const timeOnly = this._options.type === 'time';
      const choosing = this._panelMode !== 'day';
      const week = this._panel.querySelector('.kniu_sys_date_picker_week');
      const weekLabels = isEnglish
        ? (this._firstDayOfWeek() === 1 ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'])
        : (this._firstDayOfWeek() === 1 ? ['一', '二', '三', '四', '五', '六', '日'] : ['日', '一', '二', '三', '四', '五', '六']);
      week.replaceChildren(...weekLabels.map((label) => {
        const item = document.createElement('span');
        item.textContent = label;
        return item;
      }));
      week.hidden = choosing || timeOnly || rangeMode;
      this._days.hidden = choosing || timeOnly || rangeMode;
      this._chooser.hidden = rangeMode || !choosing;
      this._chooser.dataset.mode = this._panelMode;
      this._rangeCalendars.hidden = !rangeMode;
      this._chooser.replaceChildren();
      if (this._panelMode === 'year') {
        const startYear = yearPageStart;
        for (let year = startYear; year < startYear + 15; year += 1) {
          const button = document.createElement('button');
          button.type = 'button'; button.textContent = isEnglish ? String(year) : `${year} 年`; button.dataset.year = String(year);
          if (year === this._viewYear) button.classList.add('kniu_sys_date_picker_selected');
          this._chooser.appendChild(button);
        }
      } else if (this._panelMode === 'month') {
        for (let month = 0; month < 12; month += 1) {
          const button = document.createElement('button');
          button.type = 'button'; button.textContent = isEnglish ? monthNames[month] : `${month + 1} 月`; button.dataset.month = String(month);
          if (month === this._viewMonth) button.classList.add('kniu_sys_date_picker_selected');
          this._chooser.appendChild(button);
        }
      }
      const first = new Date(this._viewYear, this._viewMonth, 1);
      const leadingDays = (first.getDay() - this._firstDayOfWeek() + 7) % 7;
      const start = new Date(this._viewYear, this._viewMonth, 1 - leadingDays);
      const today = new Date();
      this._days.replaceChildren();
      for (let index = 0; index < 42; index += 1) {
        const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'kniu_sys_date_picker_day'; button.textContent = String(date.getDate());
        button.dataset.date = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        if (date.getMonth() !== this._viewMonth) button.classList.add('kniu_sys_date_picker_other');
        if (this._isDateDisabled(date)) { button.disabled = true; button.classList.add('kniu_sys_date_picker_disabled'); }
        if (this._sameDay(date, today)) button.classList.add('kniu_sys_date_picker_today');
        const mark = this._resolveMark(date);
        if (mark) { button.dataset.mark = mark; button.title = mark; button.textContent = mark; }
        const selectedDay = Math.min(this._preferredDay, new Date(this._viewYear, this._viewMonth + 1, 0).getDate());
        if (date.getFullYear() === this._viewYear
          && date.getMonth() === this._viewMonth
          && date.getDate() === selectedDay) button.classList.add('kniu_sys_date_picker_selected');
        this._days.appendChild(button);
      }
      this._panel.querySelector('.kniu_sys_date_picker_head').hidden = timeOnly || rangeMode;
      this._chooser.hidden = timeOnly || rangeMode || !choosing;
      this._panel.dataset.range = String(rangeMode);
      this._panel.dataset.type = this._options.type || 'date';
      if (rangeMode) this._renderRangeCalendars(isEnglish);
      const timePanel = this._panel.querySelector('.kniu_sys_date_picker_time');
      const displayFormat = this._normalizeFormat(this._options.format || (this._options.type === 'datetime' ? 'yyyy-MM-dd HH:mm:ss' : 'HH:mm:ss'));
      const showHour = /HH|hh/.test(displayFormat);
      const showMinute = /mm|ii/.test(displayFormat);
      const showSeconds = /ss/.test(displayFormat);
      const timeColumns = Math.max(1, [showHour, showMinute, showSeconds].filter(Boolean).length);
      timePanel.hidden = (choosing && this._options.type !== 'datetime') || !['datetime', 'time'].includes(this._options.type);
      timePanel.dataset.label = isEnglish ? 'Select time' : '选择时间';
      timePanel.dataset.showHour = String(showHour);
      timePanel.dataset.showMinute = String(showMinute);
      timePanel.dataset.showSeconds = String(showSeconds);
      timePanel.dataset.showMinuteSeparator = String(showHour && showMinute);
      timePanel.dataset.showSecondSeparator = String(showSeconds && (showHour || showMinute));
      timePanel.dataset.timeColumns = String(timeColumns);
      this._panel.dataset.showSeconds = timePanel.dataset.showSeconds;
      this._panel.dataset.timeColumns = String(timeColumns);
      const timeLabels = isEnglish ? { hour: 'Hr', minute: 'Min', second: 'Sec' } : { hour: '时', minute: '分', second: '秒' };
      Object.entries(timeLabels).forEach(([unit, label]) => {
        this._panel.querySelector(`[data-time-field="${unit}"]`).dataset.label = label;
      });
      this._panel.querySelector('[data-action="reset"]').textContent = isEnglish ? 'Reset' : '重置';
      this._panel.querySelector('[data-action="today"]').textContent = isEnglish ? 'Now' : '现在';
      this._panel.querySelector('[data-action="confirm"]').textContent = isEnglish ? 'Confirm' : '确定';
      const preview = this._panel.querySelector('.kniu_sys_date_picker_date_preview');
      if (rangeMode) {
        preview.textContent = this._rangeValue.map((item) => {
          const parsed = this._parse(item);
          return parsed ? this._formatDisplay(parsed) : '';
        }).filter(Boolean).join(this._options.displaySeparator || ' 至 ');
      } else {
        const previewDate = new Date(this._draft);
        const previewDay = Math.min(this._preferredDay, new Date(this._viewYear, this._viewMonth + 1, 0).getDate());
        previewDate.setDate(1);
        previewDate.setFullYear(this._viewYear, this._viewMonth, previewDay);
        preview.textContent = this._formatDisplay(previewDate);
      }
      preview.title = preview.textContent;
      const values = { hour: this._draft.getHours(), minute: this._draft.getMinutes(), second: this._draft.getSeconds() };
      Object.entries(values).forEach(([unit, value]) => {
        const field = this._panel.querySelector(`[data-time-field="${unit}"]`);
        const button = field.querySelector('.kniu_sys_date_picker_time_value');
        button.dataset.value = String(value);
        button.textContent = String(value).padStart(2, '0');
        field.querySelectorAll('.kniu_sys_date_picker_time_option').forEach((option) => option.classList.toggle('kniu_sys_date_picker_selected', Number(option.dataset.value) === value));
        if (this._options.type === 'datetime' && !timePanel.hidden) {
          queueMicrotask(() => field.querySelector('.kniu_sys_date_picker_time_option.kniu_sys_date_picker_selected')?.scrollIntoView({ block: 'center' }));
        }
      });
    }
    _sameDay(left, right) { return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate(); }
    _resolveMark(date) {
      const marks = this._options.mark && typeof this._options.mark === 'object' ? this._options.mark : {};
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const keys = [`${year}-${month}-${day}`, `0-${month}-${day}`, `${year}-0-${day}`, `0-0-${day}`];
      const key = keys.find((item) => marks[item] != null);
      return key ? String(marks[key]) : '';
    }
    _renderRangeCalendars(isEnglish) {
      const weekLabels = isEnglish
        ? (this._firstDayOfWeek() === 1 ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'])
        : (this._firstDayOfWeek() === 1 ? ['一', '二', '三', '四', '五', '六', '日'] : ['日', '一', '二', '三', '四', '五', '六']);
      const panes = [
        { name: 'left', year: this._viewYear, month: this._viewMonth },
        { name: 'right', year: this._viewMonth === 11 ? this._viewYear + 1 : this._viewYear, month: (this._viewMonth + 1) % 12 }
      ];
      const rangeStart = this._parse(this._rangeValue[0]);
      const rangeEnd = this._parse(this._rangeValue[1]);
      panes.forEach((paneData) => {
        const pane = this._rangeCalendars.querySelector(`[data-range-pane="${paneData.name}"]`);
        const monthNames = isEnglish ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : null;
        const choosing = this._rangeChooser.pane === paneData.name ? this._rangeChooser.mode : '';
        const yearPageStart = paneData.year - 7;
        const title = pane.querySelector('.kniu_sys_date_picker_range_title');
        const yearButton = pane.querySelector('[data-range-choose="year"]');
        const monthButton = pane.querySelector('[data-range-choose="month"]');
        title.dataset.lang = isEnglish ? 'en' : 'cn';
        yearButton.textContent = isEnglish ? String(paneData.year) : `${paneData.year} 年`;
        monthButton.textContent = isEnglish ? monthNames[paneData.month] : `${paneData.month + 1} 月`;
        monthButton.hidden = false;
        const week = pane.querySelector('.kniu_sys_date_picker_range_week');
        week.replaceChildren(...weekLabels.map((label) => {
          const item = document.createElement('span'); item.textContent = label; return item;
        }));
        const days = pane.querySelector('.kniu_sys_date_picker_range_days');
        days.replaceChildren();
        week.hidden = Boolean(choosing);
        days.hidden = Boolean(choosing);
        const chooser = pane.querySelector('.kniu_sys_date_picker_range_chooser');
        chooser.hidden = !choosing;
        chooser.dataset.mode = choosing || 'day';
        chooser.replaceChildren();
        if (choosing === 'year') {
          for (let year = yearPageStart; year < yearPageStart + 15; year += 1) {
            const button = document.createElement('button');
            button.type = 'button'; button.dataset.rangeYear = String(year); button.dataset.pane = paneData.name;
            button.textContent = isEnglish ? String(year) : `${year} 年`;
            if (year === paneData.year) button.classList.add('kniu_sys_date_picker_selected');
            chooser.appendChild(button);
          }
        } else if (choosing === 'month') {
          for (let month = 0; month < 12; month += 1) {
            const button = document.createElement('button');
            button.type = 'button'; button.dataset.rangeMonth = String(month); button.dataset.pane = paneData.name;
            button.textContent = isEnglish ? monthNames[month] : `${month + 1} 月`;
            if (month === paneData.month) button.classList.add('kniu_sys_date_picker_selected');
            chooser.appendChild(button);
          }
        }
        const first = new Date(paneData.year, paneData.month, 1);
        const leadingDays = (first.getDay() - this._firstDayOfWeek() + 7) % 7;
        const start = new Date(paneData.year, paneData.month, 1 - leadingDays);
        for (let index = 0; index < 42; index += 1) {
          const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
          const button = document.createElement('button');
          button.type = 'button'; button.className = 'kniu_sys_date_picker_range_day';
          button.dataset.rangeDate = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
          button.textContent = String(date.getDate());
          if (date.getMonth() !== paneData.month) button.classList.add('kniu_sys_date_picker_other');
          if (this._isDateDisabled(date)) { button.disabled = true; button.classList.add('kniu_sys_date_picker_disabled'); }
          if (rangeStart && this._sameDay(date, rangeStart)) button.classList.add('kniu_sys_date_picker_range_start');
          if (rangeEnd && this._sameDay(date, rangeEnd)) button.classList.add('kniu_sys_date_picker_range_end');
          if (rangeStart && rangeEnd && date > rangeStart && date < rangeEnd) button.classList.add('kniu_sys_date_picker_in_range');
          const mark = this._resolveMark(date);
          if (mark) { button.dataset.mark = mark; button.title = mark; button.textContent = mark; }
          days.appendChild(button);
        }
      });
    }
    _isDateDisabled(date) {
      const dayValue = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const rangeMin = this._options.range === true && this._rangePhase === 'end' ? this._rangeValue[0] : null;
      const min = this._parse(rangeMin || this._options.min);
      const max = this._parse(this._options.max);
      const minValue = min ? new Date(min.getFullYear(), min.getMonth(), min.getDate()).getTime() : null;
      const maxValue = max ? new Date(max.getFullYear(), max.getMonth(), max.getDate()).getTime() : null;
      return (minValue != null && dayValue < minValue) || (maxValue != null && dayValue > maxValue);
    }
    _setDraftTime() {
      const timePanel = this._panel.querySelector('.kniu_sys_date_picker_time');
      const hours = timePanel.dataset.showHour === 'true' ? +this._panel.querySelector('[data-time-field="hour"] .kniu_sys_date_picker_time_value').dataset.value : 0;
      const minutes = timePanel.dataset.showMinute === 'true' ? +this._panel.querySelector('[data-time-field="minute"] .kniu_sys_date_picker_time_value').dataset.value : 0;
      const seconds = timePanel.dataset.showSeconds === 'true' ? +this._panel.querySelector('[data-time-field="second"] .kniu_sys_date_picker_time_value').dataset.value : 0;
      this._draft.setHours(hours, minutes, seconds, 0);
    }
    _handleClick(event) {
      const rangeChoose = event.target.closest('[data-range-choose]');
      if (rangeChoose) {
        const pane = rangeChoose.closest('[data-range-pane]').dataset.rangePane;
        this._rangeChooser = { pane: pane, mode: rangeChoose.dataset.rangeChoose };
        this._render();
        return;
      }
      const rangeYear = event.target.closest('[data-range-year]');
      if (rangeYear) {
        const pane = rangeYear.dataset.pane;
        const paneDate = this._getRangePaneDate(pane);
        this._setRangePaneView(pane, Number(rangeYear.dataset.rangeYear), paneDate.month);
        this._rangeChooser = { pane: pane, mode: 'month' };
        this._render();
        return;
      }
      const rangeMonth = event.target.closest('[data-range-month]');
      if (rangeMonth) {
        const pane = rangeMonth.dataset.pane;
        const paneDate = this._getRangePaneDate(pane);
        this._setRangePaneView(pane, paneDate.year, Number(rangeMonth.dataset.rangeMonth));
        this._rangeChooser = { pane: '', mode: '' };
        this._render();
        return;
      }
      const rangeDay = event.target.closest('[data-range-date]');
      if (rangeDay) {
        const [year, month, day] = rangeDay.dataset.rangeDate.split('-').map(Number);
        this._draft.setFullYear(year, month - 1, day);
        this._preferredDay = day;
        this._setDraftTime();
        const selectedValue = this._format(this._draft);
        if (this._rangePhase === 'start' || (this._rangeValue[0] && this._rangeValue[1])) {
          this._rangeValue = [selectedValue, ''];
          this._rangePhase = 'end';
        } else {
          this._rangeValue[1] = selectedValue;
          if (this._rangeValue[1] < this._rangeValue[0]) this._rangeValue.reverse();
          this._rangePhase = 'complete';
        }
        this._syncRangeDisplay();
        this._render();
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this.dispatchEvent(new CustomEvent('change', { detail: { value: this.value, kind: this._rangePhase === 'end' ? 'start-change' : 'end-change' }, bubbles: true, composed: true }));
        return;
      }
      const rangeAction = event.target.closest('[data-range-action]')?.dataset.rangeAction;
      if (rangeAction) {
        const pane = event.target.closest('[data-range-pane]').dataset.rangePane;
        const paneDate = this._getRangePaneDate(pane);
        const target = new Date(paneDate.year, paneDate.month, 1);
        if (rangeAction === 'prev-year') target.setFullYear(target.getFullYear() - 1);
        if (rangeAction === 'next-year') target.setFullYear(target.getFullYear() + 1);
        if (rangeAction === 'prev-month') target.setMonth(target.getMonth() - 1);
        if (rangeAction === 'next-month') target.setMonth(target.getMonth() + 1);
        this._setRangePaneView(pane, target.getFullYear(), target.getMonth());
        this._render();
        return;
      }
      const timeOption = event.target.closest('[data-time-option]');
      if (timeOption) {
        const unit = timeOption.dataset.timeOption;
        const field = this._panel.querySelector(`[data-time-field="${unit}"]`);
        const button = field.querySelector('.kniu_sys_date_picker_time_value');
        button.dataset.value = timeOption.dataset.value;
        button.textContent = timeOption.textContent;
        this._setDraftTime();
        this._closeTimeMenus();
        this._render();
        return;
      }
      const timeButton = event.target.closest('.kniu_sys_date_picker_time_value');
      if (timeButton) {
        const field = timeButton.closest('.kniu_sys_date_picker_time_field');
        const willOpen = field.dataset.open !== 'true';
        this._closeTimeMenus();
        if (willOpen) {
          field.dataset.open = 'true';
          const options = field.querySelector('.kniu_sys_date_picker_time_options');
          options.hidden = false;
          queueMicrotask(() => field.querySelector('.kniu_sys_date_picker_time_option.kniu_sys_date_picker_selected')?.scrollIntoView({ block: 'center' }));
        }
        return;
      }
      this._closeTimeMenus();
      const yearChoice = event.target.closest('[data-year]');
      if (yearChoice) {
        this._viewYear = Number(yearChoice.dataset.year);
        const dayOfMonth = this._preferredDay;
        this._draft.setDate(1);
        this._draft.setFullYear(this._viewYear);
        this._draft.setDate(Math.min(dayOfMonth, new Date(this._viewYear, this._draft.getMonth() + 1, 0).getDate()));
        this._panelMode = 'month'; this._render(); return;
      }
      const monthChoice = event.target.closest('[data-month]');
      if (monthChoice) {
        this._viewMonth = Number(monthChoice.dataset.month);
        const dayOfMonth = this._preferredDay;
        this._draft.setDate(1);
        this._draft.setMonth(this._viewMonth);
        this._draft.setDate(Math.min(dayOfMonth, new Date(this._viewYear, this._viewMonth + 1, 0).getDate()));
        this._panelMode = 'day'; this._render(); return;
      }
      const day = event.target.closest('.kniu_sys_date_picker_day');
      if (day) {
        const [year, month, date] = day.dataset.date.split('-').map(Number);
        this._draft.setFullYear(year, month - 1, date);
        this._preferredDay = date;
        this._viewYear = year; this._viewMonth = month - 1; this._render(); return;
      }
      let action = event.target.closest('[data-action]')?.dataset.action;
      if (!action) return;
      if (action === 'choose-year') this._panelMode = 'year';
      if (action === 'choose-month') this._panelMode = 'month';
      if (action === 'prev-year') this._viewYear -= 1;
      if (action === 'next-year') this._viewYear += 1;
      if (action === 'prev-month') {
        this._viewMonth -= 1;
        if (this._viewMonth < 0) { this._viewMonth = 11; this._viewYear -= 1; }
      }
      if (action === 'next-month') {
        this._viewMonth += 1;
        if (this._viewMonth > 11) { this._viewMonth = 0; this._viewYear += 1; }
      }
      if (action === 'today') {
        this._draft = new Date();
        this._preferredDay = this._draft.getDate();
        this._viewYear = this._draft.getFullYear();
        this._viewMonth = this._draft.getMonth();
        this._panelMode = 'day';
        if (this._options.range === true) {
          this._rangeValue = ['', ''];
          this._rangePhase = 'start';
        }
        this._render();
        action = 'confirm';
      }
      if (action === 'reset') {
        this._draft = new Date();
        if (this._options.range === true) {
          this._rangeValue = ['', ''];
          this._syncRangeDisplay();
          this._rangePhase = 'start';
        } else {
          this.value = '';
        }
        this._preferredDay = this._draft.getDate();
        this._viewYear = this._draft.getFullYear();
        this._viewMonth = this._draft.getMonth();
        this._panelMode = 'day';
        this._rangeChooser = { pane: '', mode: '' };
      }
      if (action === 'confirm') {
        const actualDay = Math.min(this._preferredDay, new Date(this._viewYear, this._viewMonth + 1, 0).getDate());
        this._draft.setDate(1);
        this._draft.setFullYear(this._viewYear, this._viewMonth, actualDay);
        this._setDraftTime();
        const selectedValue = this._format(this._draft);
        if (this._options.range === true) {
          if (!this._rangeValue[0]) this._rangeValue[0] = selectedValue;
          if (!this._rangeValue[1]) this._rangeValue[1] = this._rangeValue[0];
          if (this._rangeValue[0] && this._rangeValue[1] < this._rangeValue[0]) this._rangeValue.reverse();
          this._syncRangeDisplay();
        } else {
          this.value = selectedValue;
        }
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this.dispatchEvent(new CustomEvent('change', { detail: this._options.range === true ? { value: this.value, kind: 'end-change' } : this.value, bubbles: true, composed: true }));
        this._close(); return;
      }
      this._render();
    }
    _getRangePaneDate(pane) {
      if (pane !== 'right') return { year: this._viewYear, month: this._viewMonth };
      return { year: this._viewMonth === 11 ? this._viewYear + 1 : this._viewYear, month: (this._viewMonth + 1) % 12 };
    }
    _setRangePaneView(pane, year, month) {
      if (pane !== 'right') {
        this._viewYear = year;
        this._viewMonth = month;
        return;
      }
      const previous = new Date(year, month - 1, 1);
      this._viewYear = previous.getFullYear();
      this._viewMonth = previous.getMonth();
    }
    _closeTimeMenus() {
      this._panel.querySelectorAll('.kniu_sys_date_picker_time_field').forEach((field) => {
        delete field.dataset.open;
        field.querySelector('.kniu_sys_date_picker_time_options').hidden = true;
      });
    }
  }
  customElements.define('kniu-date-picker', KniuSysDatePicker);
}