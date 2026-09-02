import KniuMvvm from '../../core/kniumvvm.mjs';
import REQUEST from '../../core/kniurequest.mjs';
import IDENTITY from '../../core/kniuidentity.mjs';

const { controller, reactive, onMounted } = KniuMvvm;

const aboutController = controller(() => {
  const state = reactive({ content: '', loading: true, currentYear: new Date().getFullYear() });

  async function loadAbout() {
    state.loading = true;
    const result = await REQUEST({
      url: '/getAbout',
      type: 'POST',
      data: { identity_token: IDENTITY.getIdentity().token },
      redirectOnUnauthorized: false
    });
    state.content = result?.status === 1 ? String(result.data?.content || '') : '';
    state.loading = false;
  }

  onMounted(loadAbout);
  return { state, loadAbout };
});

export default aboutController;
