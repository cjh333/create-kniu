import KNIU_TAB_CSS from './kniu-tab.css?module';
import KNIU_TAB_TEMPLATE from './kniu-tab.html?module';

export function registerTab(context) {
  const { attachComponentShadow } = context;
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;

  function tabPanels(root) {
    return Array.prototype.filter.call(root.children, function (child) {
      return child.tagName === 'KNIU-TAB-PANEL';
    });
  }

  function panelName(panel, index) {
    return panel.getAttribute('name') || String(index);
  }

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // tablist 一次性成行：DocumentFragment + replaceChildren，
  // 不重插 <style>、不逐个绑事件（点击委托挂在 .kniu_sys_tab 上）。
  function fillTablist(host, buttonsHtml) {
    const bar = host.shadowRoot.querySelector('.kniu_sys_tab');
    if (!bar) return;
    const template = (host.ownerDocument || document).createElement('template');
    template.innerHTML = buttonsHtml;
    bar.replaceChildren(template.content);
  }

  class KniuSysTab extends HTMLElement {
    static get observedAttributes() { return ['active']; }

    constructor() {
      super();
      attachComponentShadow(this);
      this._options = {};
      this._observer = null;
    }

    connectedCallback() {
      this._buildShell();
      this._renderHead();
      this._sync();
      this._observe();
    }

    disconnectedCallback() {
      if (this._observer) { this._observer.disconnect(); this._observer = null; }
    }

    attributeChangedCallback() { this._sync(); }

    set options(value) {
      this._options = value && typeof value === 'object' ? value : {};
      this._sync();
    }

    get options() { return this._options; }

    _observe() {
      if (this._observer) return;
      const component = this;
      this._observer = new MutationObserver(function () {
        component._renderHead();
        component._sync();
      });
      this._observer.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ['name', 'label'] });
    }

    _buildShell() {
      if (this._shellBuilt) return;
      this._shellBuilt = true;
      this.shadowRoot.innerHTML = '<style>' + KNIU_TAB_CSS + '</style>' + KNIU_TAB_TEMPLATE;
      this.shadowRoot.querySelector('.kniu_sys_tab').addEventListener('click', function (event) {
        const target = event.target instanceof Element ? event.target : null;
        const button = target && typeof target.closest === 'function' ? target.closest('.kniu_sys_tab_item') : null;
        if (button) this.activate(button.dataset.name || '');
      }.bind(this));
    }

    _renderHead() {
      const buttons = tabPanels(this).map(function (panel, index) {
        const name = panelName(panel, index);
        const label = panel.getAttribute('label') || name;
        return '<button type="button" class="kniu_sys_tab_item" role="tab" data-name="' + escapeHtml(name) + '">' + escapeHtml(label) + '</button>';
      }).join('');
      fillTablist(this, buttons);
    }

    _activeName() {
      const panels = tabPanels(this);
      if (!panels.length) return '';
      const controlled = this._options && this._options.active != null && this._options.active !== '' ? String(this._options.active) : '';
      const local = this.getAttribute('active') || '';
      const wanted = controlled || local;
      for (let i = 0; i < panels.length; i += 1) {
        if (panelName(panels[i], i) === wanted) return wanted;
      }
      return panelName(panels[0], 0);
    }

    _sync() {
      if (!this.shadowRoot.querySelector('.kniu_sys_tab')) this._renderHead();
      const active = this._activeName();
      tabPanels(this).forEach(function (panel, index) {
        if (panelName(panel, index) === active) panel.removeAttribute('hidden');
        else panel.setAttribute('hidden', '');
      });
      this.shadowRoot.querySelectorAll('.kniu_sys_tab_item').forEach(function (button) {
        if ((button.dataset.name || '') === active) button.setAttribute('data-active', 'true');
        else button.removeAttribute('data-active');
      });
    }

    activate(name) {
      if (!name || name === this._activeName()) return;
      this.setAttribute('active', name);
      this.dispatchEvent(new CustomEvent('change', { detail: { name: name }, bubbles: true, composed: true }));
      const onChange = (this._options || {}).onChange;
      if (typeof onChange === 'function') onChange({ name: name });
    }
  }

  class KniuSysTabBody extends HTMLElement {
    static get observedAttributes() { return ['active']; }

    constructor() {
      super();
      this._options = {};
    }

    connectedCallback() { this._sync(); }

    attributeChangedCallback() { this._sync(); }

    set options(value) {
      this._options = value && typeof value === 'object' ? value : {};
      this._applyOptions();
      this._sync();
    }

    get options() { return this._options; }

    _applyOptions() {
      const options = this._options;
      if (options.id != null && String(options.id) !== (this.getAttribute('id') || '')) this.setAttribute('id', String(options.id));
      if (options.active != null && String(options.active) !== (this.getAttribute('active') || '')) this.setAttribute('active', String(options.active));
    }

    _activeName() {
      const panels = tabPanels(this);
      if (!panels.length) return '';
      const wanted = this.getAttribute('active') || '';
      for (let i = 0; i < panels.length; i += 1) {
        if (panelName(panels[i], i) === wanted) return wanted;
      }
      return panelName(panels[0], 0);
    }

    _sync() {
      const active = this._activeName();
      tabPanels(this).forEach(function (panel, index) {
        if (panelName(panel, index) === active) panel.removeAttribute('hidden');
        else panel.setAttribute('hidden', '');
      });
    }

    activate(name) {
      if (!name || name === this._activeName()) return;
      this.setAttribute('active', name);
      this.dispatchEvent(new CustomEvent('change', { detail: { name: name }, bubbles: true, composed: true }));
      const onChange = (this._options || {}).onChange;
      if (typeof onChange === 'function') onChange({ name: name });
    }
  }

  class KniuSysTabHead extends HTMLElement {
    static get observedAttributes() { return ['for']; }

    constructor() {
      super();
      attachComponentShadow(this);
      this._options = {};
      this._body = null;
      this._observer = null;
      this._frame = 0;
      this.shadowRoot.innerHTML = '<style>' + KNIU_TAB_CSS + '</style>'
        + '<style>:host{display:inline-flex}</style>'
        + '<div class="kniu_sys_tab" role="tablist"></div>';
      this.shadowRoot.querySelector('.kniu_sys_tab').addEventListener('click', function (event) {
        const target = event.target instanceof Element ? event.target : null;
        const button = target && typeof target.closest === 'function' ? target.closest('.kniu_sys_tab_item') : null;
        if (button && this._body) this._selectItem(this._body, button);
      }.bind(this));
    }

    connectedCallback() { this._resolveBody(); }

    disconnectedCallback() {
      if (this._frame) { cancelAnimationFrame(this._frame); this._frame = 0; }
      this._detachBody();
    }

    attributeChangedCallback(name) {
      if (name === 'for') this._resolveBody();
    }

    set options(value) {
      this._options = value && typeof value === 'object' ? value : {};
      const target = this._options.for == null ? '' : String(this._options.for);
      if (target && target !== (this.getAttribute('for') || '')) this.setAttribute('for', target);
      else if (this._body) {
        this._pushActive(this._body);
        this._body._sync();
        this._renderBody(this._body);
      }
    }

    get options() { return this._options; }

    _configItems() {
      const data = (this._options || {}).data;
      return Array.isArray(data) && data.length ? data : null;
    }

    _hashMode() {
      return String((this._options || {}).type) === 'hash';
    }

    // 当前 URL 的尾锚点：#/databasetable#data → 'data'；无尾锚返回 ''。
    _hashActive() {
      if (typeof location === 'undefined') return '';
      const parts = String(location.hash || '').split('#');
      return parts.length >= 3 ? String(parts[2] || '') : '';
    }

    // hash 模式下把选中 tab 写入地址栏尾锚（#/databasetable#data）。
    // 用 history.replaceState：不触发 hashchange/popstate（不惊动路由重渲染）、
    // 不产生历史记录（tab 切换不膨胀浏览历史）；非路由 hash 环境不写。
    _syncHash(name) {
      if (!this._hashMode() || typeof history === 'undefined' || !history.replaceState) return;
      const hash = String(location.hash || '');
      if (hash.indexOf('#/') !== 0) return;
      const parts = hash.split('#');
      parts.splice(2);
      if (name) parts.push(String(name));
      const next = parts.join('#');
      if (next !== hash) history.replaceState(history.state, '', next);
    }

    // data 项内声明的初始选中（{name:'data', label:'数据', active:true}）。
    _configActive() {
      const items = this._configItems();
      if (!items) return '';
      for (let i = 0; i < items.length; i += 1) {
        if (items[i] && items[i].active === true) {
          return String(items[i].name != null ? items[i].name : i);
        }
      }
      return '';
    }

    _pushActive(body) {
      const items = this._configItems();
      // 初始选中优先级：URL 尾锚（hash 模式，用户意图最新）> data 项 active:true
      // > 首项。尾锚必须命中配置项才采纳——乱写/过期的锚点视为无效，回落声明默认。
      // （旧顶层 options.active 声明写法已废弃，不再兜底。）
      let active = '';
      if (this._hashMode()) {
        const fromHash = this._hashActive();
        if (fromHash && items) {
          for (let i = 0; i < items.length; i += 1) {
            if (String(items[i] && items[i].name) === fromHash) { active = fromHash; break; }
          }
        }
      }
      if (!active) active = this._configActive();
      if (!items || !active) return;
      let index = -1;
      for (let i = 0; i < items.length; i += 1) {
        if (String(items[i] && items[i].name) === active) { index = i; break; }
      }
      if (index < 0) return;
      const panels = tabPanels(body);
      const target = panels[index] ? panelName(panels[index], index) : '';
      if (target && target !== (body.getAttribute('active') || '')) body.setAttribute('active', target);
    }

    _resolveBody() {
      const component = this;
      if (this._frame) { cancelAnimationFrame(this._frame); this._frame = 0; }
      this._detachBody();
      const find = function () {
        if (!component.isConnected) return;
        const id = component.getAttribute('for') || '';
        const root = component.getRootNode();
        const body = id && root && root.getElementById ? root.getElementById(id) : null;
        if (body && body.tagName === 'KNIU-TAB-BODY') {
          component._attachBody(body);
          return;
        }
        component._frame = requestAnimationFrame(find);
      };
      find();
    }

    _detachBody() {
      if (this._observer) { this._observer.disconnect(); this._observer = null; }
      this._body = null;
      this.shadowRoot.querySelector('.kniu_sys_tab').replaceChildren();
    }

    _attachBody(body) {
      const component = this;
      this._body = body;
      this._pushActive(body);
      body._sync();
      this._renderBody(body);
      this._frame = 0;
      this._observer = new MutationObserver(function () {
        if (!component._body) return;
        component._pushActive(component._body);
        component._body._sync();
        component._renderBody(component._body);
      });
      this._observer.observe(body, { childList: true, subtree: true, attributes: true, attributeFilter: ['name', 'label', 'active'] });
    }

    _renderBody(body) {
      if (!body || !body.isConnected) return;
      const items = this._configItems();
      const panels = tabPanels(body);
      const active = body._activeName();
      let buttons = '';
      if (items) {
        buttons = items.map(function (item, index) {
          const name = item && item.name != null ? String(item.name) : String(index);
          const label = item && item.label != null ? String(item.label) : name;
          return '<button type="button" class="kniu_sys_tab_item" role="tab" data-name="' + escapeHtml(name) + '" data-index="' + index + '">' + escapeHtml(label) + '</button>';
        }).join('');
      } else {
        buttons = panels.map(function (panel, index) {
          const name = panelName(panel, index);
          const label = panel.getAttribute('label') || name;
          return '<button type="button" class="kniu_sys_tab_item" role="tab" data-name="' + escapeHtml(name) + '">' + escapeHtml(label) + '</button>';
        }).join('');
      }
      let activeIndex = -1;
      for (let i = 0; i < panels.length; i += 1) {
        if (panelName(panels[i], i) === active) { activeIndex = i; break; }
      }
      fillTablist(this, buttons);
      this.shadowRoot.querySelectorAll('.kniu_sys_tab_item').forEach(function (button) {
        const hit = items
          ? Number(button.dataset.index) === activeIndex
          : (button.dataset.name || '') === active;
        if (hit) button.setAttribute('data-active', 'true');
      });
    }

    _selectItem(body, button) {
      const items = this._configItems();
      const panels = tabPanels(body);
      let target = '';
      let name = '';
      if (items) {
        const index = Number(button.dataset.index);
        target = panels[index] ? panelName(panels[index], index) : '';
        name = button.dataset.name || String(index);
      } else {
        target = button.dataset.name || '';
        name = target;
      }
      if (!target) return;
      if (name === String((this._options || {}).active == null ? '' : this._options.active)) return;
      this._options = Object.assign({}, this._options, { active: name });
      if (target !== (body.getAttribute('active') || '')) body.setAttribute('active', target);
      // hash 模式：tab 切换同步地址栏尾锚（如 #data），刷新/分享链接恢复选中态。
      this._syncHash(name);
      this.shadowRoot.querySelectorAll('.kniu_sys_tab_item').forEach(function (item) {
        if (item === button) item.setAttribute('data-active', 'true');
        else item.removeAttribute('data-active');
      });
      this.dispatchEvent(new CustomEvent('change', { detail: { name: name }, bubbles: true, composed: true }));
      const onChange = (this._options || {}).onChange;
      if (typeof onChange === 'function') onChange({ name: name });
    }
  }

  class KniuSysTabPanel extends HTMLElement { }

  if (!customElements.get('kniu-tab')) customElements.define('kniu-tab', KniuSysTab);
  if (!customElements.get('kniu-tab-body')) customElements.define('kniu-tab-body', KniuSysTabBody);
  if (!customElements.get('kniu-tab-head')) customElements.define('kniu-tab-head', KniuSysTabHead);
  if (!customElements.get('kniu-tab-panel')) customElements.define('kniu-tab-panel', KniuSysTabPanel);
}