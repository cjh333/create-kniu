import KNIU_MORE_TEMPLATE from './kniu-page-more.html?module';
import KNIU_MORE_CSS from './kniu-page-more.css?module';

export function registerPageMore(context) {
  const { attachComponentShadow, installOptionsOnlyProtocol } = context;
  if (typeof customElements === 'undefined' || customElements.get('kniu-page-more')) return;
  class KniuSysPageMore extends HTMLElement {
    constructor() {
      super();
      attachComponentShadow(this);
      this.shadowRoot.innerHTML = `<style>${KNIU_MORE_CSS}</style>${KNIU_MORE_TEMPLATE}`;
      this._button = this.shadowRoot.querySelector('.kniu_sys_page_more_btn');
      this._icon = this.shadowRoot.querySelector('.kniu_sys_page_more_icon');
      this._text = this.shadowRoot.querySelector('.kniu_sys_page_more_text');
      this._options = {};
      this._button.addEventListener('click', () => {
        if (this._button.disabled) return;
        const handler = this._options && this._options.onChange;
        if (typeof handler === 'function') handler({ count: Number(this._options.count) || 10 });
      });
    }
    set options(value) {
      this._options = value && typeof value === 'object' ? value : {};
      this._sync();
    }
    get options() { return this._options; }
    connectedCallback() { this._sync(); }
    _sync() {
      const options = this._options || {};
      const text = options.loading ? (options.loadingText || '加载中…') : (options.disabled && options.noMore ? options.noMore : (options.text || '查看更多'));
      this._text.textContent = String(text);
      this._icon.toggleAttribute('hidden', !options.loading);
      this._button.disabled = !!options.loading || !!options.disabled;
      this._button.dataset.block = String(!!options.block);
      this._button.dataset.count = String(Math.max(1, Number(options.count) || 10));
      this.toggleAttribute('hidden', options.visible === false);
      this._button.setAttribute('aria-label', String(text));
    }
  }
  customElements.define('kniu-page-more', KniuSysPageMore);
  installOptionsOnlyProtocol?.('kniu-page-more');
}
