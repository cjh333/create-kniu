import KNIU_LIKE_TEMPLATE from './kniu-like.html?module';

export function registerLike(context) {
  const { KNIU_LIKE_CSS, attachComponentShadow } = context;
  if (typeof customElements === 'undefined' || customElements.get('kniu-like')) return;
  class KniuSysLike extends HTMLElement {
    constructor() {
      super();
      attachComponentShadow(this);
      this._options = {};
      this._built = false;
      this._handleClick = this._click.bind(this);
    }
    connectedCallback() {
      this._render();
      const button = this.shadowRoot.querySelector('button');
      button?.addEventListener('click', this._handleClick);
    }
    disconnectedCallback() {
      this.shadowRoot.querySelector('button')?.removeEventListener('click', this._handleClick);
    }
    set options(value) {
      this._options = value && typeof value === 'object' ? value : {};
      this._render();
    }
    get options() { return this._options; }
    _buildSkeleton() {
      if (this._built) return;
      this._built = true;
      this.shadowRoot.innerHTML = '<style>' + KNIU_LIKE_CSS + '</style>' + KNIU_LIKE_TEMPLATE;
    }
    _render() {
      const options = this._options || {};
      const count = Math.max(0, Number.parseInt(options.count, 10) || 0);
      const liked = Boolean(options.liked);
      const own = Boolean(options.own);
      const disabled = Boolean(options.disabled || options.loading || own);
      const feedback = Number(options.feedback) || 0;
      this._buildSkeleton();
      const button = this.shadowRoot.querySelector('button');
      if (!button) return;
      button.setAttribute('aria-label', liked ? '取消点赞' : '点赞');
      button.setAttribute('aria-pressed', liked ? 'true' : 'false');
      button.disabled = disabled;
      const countLabel = button.querySelector('.kniu_sys_like_count');
      if (countLabel) countLabel.textContent = `(${count})`;
      this.toggleAttribute('data-own', own);
      if (liked && feedback > 0 && feedback !== this._lastFeedback) {
        this._lastFeedback = feedback;
        const play = () => {
          if (this._options?.liked && Number(this._options?.feedback) === feedback) {
            this._playPlusOne();
          }
        };
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(play);
        else setTimeout(play, 0);
      }
    }
    _click() {
      if (this._options?.disabled || this._options?.loading || this._options?.own) return;
      const now = Date.now();
      if (this._lastClickAt && now - this._lastClickAt < 500) return;
      this._lastClickAt = now;
      this.dispatchEvent(new CustomEvent('change', {
        detail: { liked: !Boolean(this._options?.liked), count: Math.max(0, Number(this._options?.count) || 0) },
        bubbles: true,
        composed: true
      }));
    }
    _playPlusOne() {
      if (this._plusPlaying) return;
      this._plusPlaying = true;
      const button = this.shadowRoot.querySelector('button');
      if (!button) { this._plusPlaying = false; return; }
      const plus = (this.ownerDocument || document).createElement('span');
      plus.className = 'kniu_sys_like_plus';
      plus.textContent = '+1';
      plus.setAttribute('aria-hidden', 'true');
      plus.addEventListener('animationend', function () { plus.remove(); this._plusPlaying = false; }.bind(this), { once: true });
      button.appendChild(plus);
    }
  }
  customElements.define('kniu-like', KniuSysLike);
}