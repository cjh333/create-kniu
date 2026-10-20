import MVVM from '../../core/kniumvvm.mjs';
import IDENTITY from '../../core/kniuidentity.mjs';
import { debounce, getTransientSearchKeyword, setTransientSearchKeyword } from '../../core/kniuutil.mjs';

const { controller } = MVVM;

const headerController = controller(({ eventTo, navigateTo, request, reactive, onMounted }) => {
  const initialKeyword = getTransientSearchKeyword();

  const state = reactive({
    ready: true,
    logo: '',
    loggedIn: Boolean(IDENTITY.getIdentity().nickname),
    keyword: initialKeyword
  });

  const sync = () => { state.loggedIn = Boolean(IDENTITY.getIdentity().nickname); };

  async function loadSeoLogo() {
    try {
      const result = await request({
        url: '/getInfo',
        type: 'POST',
        mutation: false,
        data: { identity_token: IDENTITY.getIdentity().token },
        redirectOnUnauthorized: false
      });
      const info = result?.status === 1 && result.data && typeof result.data === 'object' ? result.data : null;
      state.logo = String(info?.logo || '').trim() || '/public/static/img/logo1.png';
    } catch { }
  }

  function dispatchSearch() {
    setTransientSearchKeyword(state.keyword);
    eventTo?.emit('home:search', { keyword: getTransientSearchKeyword() });
  }

  const debouncedSearch = debounce(dispatchSearch, 250);

  const syncSearch = function (payload) {
    state.keyword = setTransientSearchKeyword(payload?.keyword);
  };

  function searchList() {
    setTransientSearchKeyword(state.keyword);
    navigateTo('/');
  }

  onMounted(() => {
    const stopIdentity = IDENTITY.subscribe(sync);
    const stopSearch = eventTo?.on('home:search', syncSearch);
    loadSeoLogo();
    return function () {
      stopIdentity();
      stopSearch?.();
    };
  });

  return { state, loadSeoLogo, searchList, debouncedSearch };
});

export default headerController;