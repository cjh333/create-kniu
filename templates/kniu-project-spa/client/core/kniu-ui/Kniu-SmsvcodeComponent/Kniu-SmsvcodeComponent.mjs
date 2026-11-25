import KNIU_SMSVCODE_CSS from './Kniu-SmsvcodeComponent.css?module';
import KNIU_SMSVCODE_TEMPLATE from './Kniu-SmsvcodeComponent.html?module';

export function registerSmsVcode(context) {
  const { attachComponentShadow } = context;
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined' || customElements.get('kniu-smsvcode')) return;

  class KniuSmsVcode extends HTMLElement {
    static get observedAttributes() { return ['name', 'placeholder', 'autocomplete', 'autocapitalize', 'maxlength', 'disabled', 'readonly', 'required', 'button-text', 'button-disabled']; }
    constructor() {
      super();
      attachComponentShadow(this);
      const pendingValue = Object.prototype.hasOwnProperty.call(this, 'value') ? this.value : undefined;
      if (pendingValue !== undefined) delete this.value;
      this.shadowRoot.innerHTML = `<style>${KNIU_SMSVCODE_CSS}</style>${KNIU_SMSVCODE_TEMPLATE}`;
      this._input = this.shadowRoot.querySelector('kniu-input');
      this._button = this.shadowRoot.querySelector('kniu-btn');
      this._input.addEventListener('input', () => this.dispatchEvent(new Event('input', { bubbles: true, composed: true })));
      this._input.addEventListener('change', () => this.dispatchEvent(new Event('change', { bubbles: true, composed: true })));
      this._input.addEventListener('click', (event) => event.stopPropagation());
      this.addEventListener('click', (event) => {
        const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
        if (!path.includes(this._button)) event.stopPropagation();
      });
      if (pendingValue !== undefined) this.value = pendingValue;
    }
    connectedCallback() { this._sync(); }
    attributeChangedCallback() { if (this._input) this._sync(); }
    get value() { return this._input?.value || ''; }
    set value(value) { if (this._input) this._input.value = value; else this.__kniuPendingValue = value; }
    get options() { return this.__kniuOptionsValue || {}; }
    set options(value) {
      this.__kniuOptionsValue = value && typeof value === 'object' ? value : {};
      const options = this.__kniuOptionsValue;
      ['name', 'placeholder', 'autocomplete', 'autocapitalize', 'maxlength', 'disabled', 'readonly', 'required', 'buttonDisabled'].forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(options, key)) return;
        const attr = key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
        if (options[key] === true) this.setAttribute(attr, '');
        else if (options[key] === false || options[key] == null) this.removeAttribute(attr);
        else this.setAttribute(attr, String(options[key]));
      });
      const text = options.buttonText ?? options.text;
      if (text != null) this.setAttribute('button-text', String(text));
      this._sync();
    }
    focus() { this._input?.focus(); }
    _sync() {
      ['name', 'placeholder', 'autocomplete', 'autocapitalize', 'maxlength', 'disabled', 'readonly', 'required'].forEach((key) => {
        const attr = key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
        if (this.hasAttribute(attr)) this._input.setAttribute(attr, this.getAttribute(attr));
        else this._input.removeAttribute(attr);
      });
      this._button.toggleAttribute('disabled', this.hasAttribute('disabled') || this.hasAttribute('button-disabled'));
      this._button.textContent = this.getAttribute('button-text') || '发送验证码';
    }
  }
  customElements.define('kniu-smsvcode', KniuSmsVcode);
}