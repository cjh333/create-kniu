import UI from '../../core/kniuui/kniuui.mjs';
import APP_RATING_TEMPLATE from './app-rating.html?module';
import APP_RATING_CSS from './app-rating.css?module';

UI.useComponent({
  // 标签名。
  tag: 'app-rating',
  // 组件样式。
  style: APP_RATING_CSS,
  // 组件模板。
  template: APP_RATING_TEMPLATE,
  // 组件设置函数。
  setup: function (ctx) {
    const state = ctx.reactive({
      value: 0,
      readonly: false
    });
    ctx.onMounted(function (host) {
      host.shadowRoot.addEventListener('click', function (e) {
        const btn = e.target && e.target.closest ? e.target.closest('button[data-v]') : null;
        if (!btn || state.readonly) return;
        state.value = Number(btn.dataset.v);
        host.emit('change', { value: state.value });
      });
    });
    return { state };
  }
});