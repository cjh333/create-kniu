import COMPONENT from '../../core/kniu-components.mjs';
import APP_RATING_TEMPLATE from './app-rating.html?module';
import APP_RATING_CSS from './app-rating.css?module';

COMPONENT.use({
  tag: 'app-rating',
  style: APP_RATING_CSS,
  template: APP_RATING_TEMPLATE,
  setup: function (ctx) {
    const state = ctx.reactive({
      value: 0,
      readonly: false
    });
    ctx.onMounted(function (host, root) {
      const initial = Number(host.getAttribute('value'));
      if (!Number.isNaN(initial) && host.getAttribute('value') != null) state.value = initial;
      root.addEventListener('click', function (e) {
        const btn = e.target && e.target.closest ? e.target.closest('button[data-v]') : null;
        if (!btn || state.readonly) return;
        state.value = Number(btn.dataset.v);
        ctx.emit('change', { value: state.value });
      });
    });
    return { state };
  }
});