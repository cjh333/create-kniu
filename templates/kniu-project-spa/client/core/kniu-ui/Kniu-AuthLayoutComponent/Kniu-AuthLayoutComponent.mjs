import KNIU_AUTH_LAYOUT_CSS from './Kniu-AuthLayoutComponent.css?module';
import KNIU_AUTH_LAYOUT_TEMPLATE from './Kniu-AuthLayoutComponent.html?module';

export function registerAuthLayout(context) {
  const { attachComponentShadow } = context;
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined' || customElements.get('kniu-auth-layout')) return;
  class KniuAuthLayout extends HTMLElement {
    static get observedAttributes() { return ['brand', 'brand-mark', 'subtitle', 'footer']; }
    constructor() {
      super();
      attachComponentShadow(this);
      this.shadowRoot.innerHTML = `<style>${KNIU_AUTH_LAYOUT_CSS}</style>${KNIU_AUTH_LAYOUT_TEMPLATE}`;
      this._brand = this.shadowRoot.querySelector('.kniu_sys_auth_name');
      this._brandMark = this.shadowRoot.querySelector('.kniu_sys_auth_mark');
      this._subtitle = this.shadowRoot.querySelector('.kniu_sys_auth_subtitle');
      this._footer = this.shadowRoot.querySelector('.kniu_sys_auth_footer');
    }
    connectedCallback() { this._sync(); }
    attributeChangedCallback() { this._sync(); }
    _sync() {
      if (!this._subtitle) return;
      this._brand.textContent = this.getAttribute('brand') || 'Kniu';
      this._brandMark.textContent = this.getAttribute('brand-mark') || this._brand.textContent.slice(0, 1);
      this._subtitle.textContent = this.getAttribute('subtitle') || '';
      this._footer.textContent = this.getAttribute('footer') || '';
    }
  }
  customElements.define('kniu-auth-layout', KniuAuthLayout);
}