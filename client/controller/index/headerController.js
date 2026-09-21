import MVVM from '../../core/kniumvvm.mjs';
import IDENTITY from '../../core/kniuidentity.mjs';
import REQUEST from '../../core/kniurequest.mjs';
import { debounce } from '../../core/kniuutil.mjs';

const { controller, reactive, onMounted, onUnmounted } = MVVM;

const headerController = controller(({ navigateTo }) => {
  const state = reactive({
    ready: true,
    logo: '',
    loggedIn: Boolean(IDENTITY.getIdentity().nickname),
    keyword: ''
  });
  const sync = () => { state.loggedIn = Boolean(IDENTITY.getIdentity().nickname); };
  async function loadSeoLogo() {
    try {
      const result = await REQUEST({
        url: '/getInfo',
        type: 'POST',
        data: { identity_token: IDENTITY.getIdentity().token },
        redirectOnUnauthorized: false
      });
      const info = result?.status === 1 && result.data && typeof result.data === 'object' ? result.data : null;
      state.logo = String(info?.logo || '').trim() || '/public/static/img/logo01.png';
    } catch { }
  }
  function dispatchSearch() {
    globalThis.dispatchEvent(new CustomEvent('kniu-home-search', {
      detail: { keyword: String(state.keyword || '') }
    }));
  }
  const debouncedSearch = debounce(dispatchSearch, 250);
  function searchList() {
    navigateTo('/', { keyword: String(state.keyword || '') });
  }
  onMounted(() => {
    globalThis.addEventListener('kniu-identity-change', sync);
    loadSeoLogo();
  });
  onUnmounted(() => globalThis.removeEventListener('kniu-identity-change', sync));
  return { state, loadSeoLogo, searchList, debouncedSearch };
});

export default headerController;
