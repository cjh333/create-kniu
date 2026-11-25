import KNIU_GVCODE_CSS from './Kniu-GvcodeComponent.css?module';
import KNIU_GVCODE_TEMPLATE from './Kniu-GvcodeComponent.html?module';

export function registerGvcode(context) {
  const { attachComponentShadow } = context;
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined' || customElements.get('kniu-gvcode')) return;

  class KniuGvcode extends HTMLElement {
    static get observedAttributes() { return ['name', 'placeholder', 'autocomplete', 'autocapitalize', 'maxlength', 'disabled', 'readonly', 'required', 'src', 'alt', 'fit']; }
    constructor() {
      super();
      attachComponentShadow(this);
      const pendingValue = Object.prototype.hasOwnProperty.call(this, 'value') ? this.value : undefined;
      if (pendingValue !== undefined) delete this.value;
      this.shadowRoot.innerHTML = `<style>${KNIU_GVCODE_CSS}</style>${KNIU_GVCODE_TEMPLATE}`;
      this._input = this.shadowRoot.querySelector('kniu-input');
      this._image = this.shadowRoot.querySelector('kniu-image');
      this._input.addEventListener('input', () => this.dispatchEvent(new Event('input', { bubbles: true, composed: true })));
      this._input.addEventListener('change', () => this.dispatchEvent(new Event('change', { bubbles: true, composed: true })));
      this._input.addEventListener('click', (event) => event.stopPropagation());
      this.addEventListener('click', (event) => {
        const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
        if (!path.includes(this._image)) event.stopPropagation();
      });
      if (pendingValue !== undefined) this.value = pendingValue;
    }
    connectedCallback() { this._sync(); }
    attributeChangedCallback() { if (this._input) this._sync(); }
    get value() { return this._input?.value || ''; }
    set value(value) { if (this._input) this._input.value = value; else this.__kniuPendingValue = value; }
    get src() { return this.getAttribute('src') || ''; }
    set src(value) { if (value == null) this.removeAttribute('src'); else this.setAttribute('src', String(value)); }
    get options() { return this.__kniuOptionsValue || {}; }
    set options(value) {
      this.__kniuOptionsValue = value && typeof value === 'object' ? value : {};
      ['name', 'placeholder', 'autocomplete', 'autocapitalize', 'maxlength', 'disabled', 'readonly', 'required', 'src', 'alt', 'fit'].forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(this.__kniuOptionsValue, key)) return;
        const attr = key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
        const item = this.__kniuOptionsValue[key];
        if (item === true) this.setAttribute(attr, '');
        else if (item === false || item == null) this.removeAttribute(attr);
        else this.setAttribute(attr, String(item));
      });
      this._sync();
    }
    focus() { this._input?.focus(); }
    _sync() {
      ['name', 'placeholder', 'autocomplete', 'autocapitalize', 'maxlength', 'disabled', 'readonly', 'required'].forEach((key) => {
        const attr = key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
        if (this.hasAttribute(attr)) this._input.setAttribute(attr, this.getAttribute(attr));
        else this._input.removeAttribute(attr);
      });
      ['src', 'alt', 'fit'].forEach((key) => {
        if (this.hasAttribute(key)) this._image.setAttribute(key, this.getAttribute(key));
        else this._image.removeAttribute(key);
      });
    }
  }
  customElements.define('kniu-gvcode', KniuGvcode);
}