import MVVM from '../../core/kniumvvm.mjs';
import IDENTITY from '../../core/kniuidentity.mjs';

const { controller } = MVVM;

const aboutController = controller(({ request, reactive, onMounted }) => {
  const state = reactive({ content: '', loading: true, currentYear: new Date().getFullYear() });
  let aboutRequest = null;
  async function loadAbout() {
    if (aboutRequest) return aboutRequest;
    state.loading = true;
    const run = request({
      url: '/getAbout',
      type: 'POST',
      mutation: false,
      data: { identity_token: IDENTITY.getIdentity().token }
    }).then(function (result) {
      state.content = result?.status === 1 ? String(result.data?.content || '') : '';
      state.loading = false;
    }).finally(function () {
      aboutRequest = null;
    });
    aboutRequest = run;
    return run;
  }

  onMounted(loadAbout);
  return { state, loadAbout };
});

export default aboutController;