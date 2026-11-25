const VLIST_CSS = `
:host{display:block;overflow-y:auto;position:relative;contain:strict}
.kniu-vlist-spacer{width:1px;pointer-events:none}
.kniu-vlist-window{position:absolute;left:0;right:0;top:0;will-change:transform}
.kniu-vlist-row{box-sizing:border-box;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;align-items:center;display:flex;gap:8px;border-bottom:1px solid var(--kniu-vlist-border, rgba(0,0,0,.06))}
.kniu-vlist-empty{padding:24px;text-align:center;opacity:.55}
`;

export function registerVList(context) {
  const { attachComponentShadow } = context;
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
  if (customElements.get('kniu-vlist')) return;

  class KniuSysVList extends HTMLElement {
    static get observedAttributes() { return ['items', 'item-height', 'height', 'row-field', 'key-field']; }

    constructor() {
      super();
      attachComponentShadow(this);
      this._rows = [];
      this._pollRaf = 0;
      this._lastScrollTop = -1;
      this._lastStartIndex = -1;
    }
    connectedCallback() {
      this.addEventListener('scroll', () => this._scheduleRender());
      this._render();
      this._pollScroll();
    }
    disconnectedCallback() {
      if (this._pollRaf) { cancelAnimationFrame(this._pollRaf); this._pollRaf = 0; }
    }
    _pollScroll() {
      this._pollRaf = requestAnimationFrame(() => {
        this._pollRaf = 0;
        if (this.isConnected) {
          if (this.scrollTop !== this._lastScrollTop) this._scheduleRender();
          this._pollScroll();
        }
      });
    }
    attributeChangedCallback(name, previous, next) {
      if (previous === next) return;
      this._rows = [];
      if (this.isConnected) this._render();
    }
    _config() {
      const itemHeight = Math.max(1, parseInt(this.getAttribute('item-height'), 10) || 48);
      const viewport = Math.max(1, parseInt(this.getAttribute('height'), 10) || this.clientHeight || 320);
      let rows = [];
      try {
        const parsed = JSON.parse(this.getAttribute('items') || '[]');
        if (Array.isArray(parsed)) rows = parsed;
      } catch { }
      return { itemHeight, viewport, rows, rowField: this.getAttribute('row-field') || 'title', keyField: this.getAttribute('key-field') || '' };
    }
    _scheduleRender() {
      const { itemHeight } = this._config();
      const startIndex = Math.max(0, Math.floor(this.scrollTop / itemHeight) - 1);
      if (startIndex === this._lastStartIndex && this._lastScrollTop === this.scrollTop) return;
      this._lastScrollTop = this.scrollTop;
      this._renderWindow();
    }
    _render() {
      const { itemHeight, viewport, rows } = this._config();
      const shadow = this.shadowRoot;
      shadow.innerHTML = `<style>${VLIST_CSS}</style><div class="kniu-vlist-spacer"></div><div class="kniu-vlist-window"></div>`;
      if (!rows.length) {
        shadow.appendChild(Object.assign(document.createElement('div'), { className: 'kniu-vlist-empty', textContent: '暂无数据' }));
        return;
      }
      this.style.height = `${viewport}px`;
      shadow.querySelector('.kniu-vlist-spacer').style.height = `${rows.length * itemHeight}px`;
      this._rows = rows;
      this._windowElement = shadow.querySelector('.kniu-vlist-window');
      this._renderWindow();
    }
    _renderWindow() {
      const { itemHeight, rows, rowField } = this._config();
      const windowElement = this._windowElement;
      if (!windowElement || !rows.length) return;
      const scrollTop = this.scrollTop;
      const visibleCount = Math.ceil(this.clientHeight / itemHeight) + 2;
      const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 1);
      const endIndex = Math.min(rows.length, startIndex + visibleCount + 1);
      this._lastStartIndex = startIndex;
      windowElement.style.transform = `translateY(${startIndex * itemHeight}px)`;
      const fragment = document.createDocumentFragment();
      for (let index = startIndex; index < endIndex; index += 1) {
        const row = rows[index] || {};
        const line = document.createElement('div');
        line.className = 'kniu-vlist-row';
        line.style.height = `${itemHeight}px`;
        const value = row[rowField];
        line.textContent = value == null ? '' : String(value);
        fragment.appendChild(line);
      }
      windowElement.replaceChildren(fragment);
    }
  }
  customElements.define('kniu-vlist', KniuSysVList);
}