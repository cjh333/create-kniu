import UI from '../../core/kniuui/kniuui.mjs';
import APP_RATING_TEMPLATE from './app-rating.html?module';
import APP_RATING_CSS from './app-rating.css?module';

UI.useComponent({
  tag: 'app-rating',
  style: APP_RATING_CSS,
  template: APP_RATING_TEMPLATE,
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