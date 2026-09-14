import MVVM from '../../core/kniumvvm.mjs';
import IDENTITY from '../../core/kniuidentity.mjs';

const { controller, reactive, onMounted, onUnmounted } = MVVM;

const headerController = controller(() => {
  const state = reactive({ ready: true, loggedIn: Boolean(IDENTITY.getIdentity().nickname) });
  const sync = () => { state.loggedIn = Boolean(IDENTITY.getIdentity().nickname); };
  onMounted(() => globalThis.addEventListener('kniu-identity-change', sync));
  onUnmounted(() => globalThis.removeEventListener('kniu-identity-change', sync));
  return { state };
});

export default headerController;
