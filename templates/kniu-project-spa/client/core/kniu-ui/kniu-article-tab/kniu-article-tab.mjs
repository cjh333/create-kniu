import KNIU_ARTICLE_TAB_CSS from './kniu-article-tab.css?module';
import KNIU_ARTICLE_TAB_RENDER_CSS from './kniu-article-tab.render.css?module';
import KNIU_ARTICLE_TAB_TEMPLATE from './kniu-article-tab.html?module';

export function registerArticleTab(context) {
  const attachComponentShadow = context && context.attachComponentShadow;
  if (typeof attachComponentShadow !== 'function') throw new Error('[kniu-article-tab] missing context.attachComponentShadow');
  if (typeof customElements === 'undefined' || customElements.get('kniu-article-tab')) return;
  class KniuArticleTab extends HTMLElement {
    constructor() {
      super();
      attachComponentShadow(this);
      this._options = {};
    }
    connectedCallback() { this._render(); }
    set options(value) {
      this._options = value && typeof value === 'object' ? value : {};
      this._render();
    }
    get options() { return this._options; }
    _render() {
      const options = this._options || {};
      const rows = [
        { direction: 'previous', label: options.previous_label || '', article: options.previous },
        { direction: 'next', label: options.next_label || '', article: options.next }
      ].filter(function (row) {
        return row.article && Number(row.article.id) > 0;
      });
      if (rows.length === 0) {
        this.shadowRoot.innerHTML = '<style>' + KNIU_ARTICLE_TAB_CSS + '</style>';
        return;
      }
      const escape = function (text) {
        return String(text == null ? '' : text)
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      };
      this.shadowRoot.innerHTML = '<style>' + KNIU_ARTICLE_TAB_RENDER_CSS + '</style>' + KNIU_ARTICLE_TAB_TEMPLATE;
      this.shadowRoot.querySelector('.kniu_sys_article_tab_tabs').innerHTML = rows.map(function (row) {
        const title = row.article.title || '';
        const id = Number(row.article?.id) || 0;
        return '<button type="button" data-direction="' + row.direction + '" data-id="' + id + '"><span class="kniu_sys_article_tab_label">' + escape(row.label) + '：</span><span class="kniu_sys_article_tab_title">' + escape(title) + '</span></button>';
      }).join('');
      const component = this;
      this.shadowRoot.querySelectorAll('button').forEach(function (button) {
        button.addEventListener('click', function () {
          component.dispatchEvent(new CustomEvent('change', {
            detail: {
              direction: button.dataset.direction,
              id: Number(button.dataset.id) || null
            },
            bubbles: true,
            composed: true
          }));
        });
      });
    }
  }
  customElements.define('kniu-article-tab', KniuArticleTab);
}
