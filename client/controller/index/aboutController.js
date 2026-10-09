import MVVM from '../../core/kniumvvm.mjs';
import IDENTITY from '../../core/kniuidentity.mjs';

const { controller } = MVVM;

const aboutController = controller(({ navigateTo, request, reactive, onMounted, getRouteData }) => {
  const state = reactive({
    content: '',
    loading: true,
    currentYear: new Date().getFullYear()
  });

  let aboutRequest = null;

  async function loadAbout() {
    if (aboutRequest) return aboutRequest;
    state.loading = true;
    const run = request({
      url: getRouteData()?.role_id ? '/getPublisherAbout' : '/getAbout',
      type: 'POST',
      mutation: false,
      data: getRouteData()?.role_id ? { role_id: Number(getRouteData().role_id) } : { identity_token: IDENTITY.getIdentity().token }
    }).then(function (result) {
      state.content = result?.status === 1 ? String(result.data?.content || '') : '';
      state.loading = false;
    }).finally(function () {
      aboutRequest = null;
    });
    aboutRequest = run;
    return run;
  }

  function toBack() {
    navigateTo('/');
  }

  onMounted(loadAbout);

  return { state, loadAbout, toBack };
});

export default aboutController;