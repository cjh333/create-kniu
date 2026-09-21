import MVVM from '../../core/kniumvvm.mjs';
import UI from '../../core/kniuui.js';
import IDENTITY from '../../core/kniuidentity.mjs';
import REQUEST from '../../core/kniurequest.mjs';

const { controller, reactive, onMounted, watch } = MVVM;

const footerController = controller(() => {
  const state = reactive({
    currentYear: new Date().getFullYear(),
    copyright: '',
    icp: '',
    loading: UI.state.loading
  });
  async function loadSeo() {
    try {
      const result = await REQUEST({
        url: '/getInfo',
        type: 'POST',
        data: { identity_token: IDENTITY.getIdentity().token },
        redirectOnUnauthorized: false
      });
      const info = result?.status === 1 && result.data && typeof result.data === 'object' ? result.data : null;
      state.copyright = String(info?.copyright || '').trim();
      state.icp = String(info?.icp || '').trim();
    } catch { }
  }
  watch(() => UI.state.loading, function (value) {
    state.loading = value;
  });
  onMounted(() => {
    loadSeo();
  });
  return { state, loadSeo };
});

export default footerController;