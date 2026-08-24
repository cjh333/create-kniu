import KniuMvvm from '../../core/kniumvvm.mjs';
import { getCurrentRoutePath } from '../../core/kniuutil.mjs';
import AUTH from '../../core/kniuauth.mjs';

const { controller, onMounted, reactive } = KniuMvvm;

function getActiveNavigationPath(path) {
  return path === '/dailydetail' || path === '/articledetail' ? '/nav' : path;
}

const asideController = controller(({ eventTo, navigateTo, onRouteChange }) => {
    const state = reactive({
      brandMark: 'K',
      brandName: 'Kniu',
      brandSuffix: 'System',
      workspaceLabel: '工作台',
      helpLabel: '帮助',
      activeNavigationPath: getActiveNavigationPath(getCurrentRoutePath()),
      userAvatar: '·',
      userName: '—',
      userRole: '—'
    });

    function updateUser(info) {
      state.userName = info.name || '—';
      state.userAvatar = info.avatar || (info.name ? info.name.charAt(0) : '·');
      state.userRole = info.role || '管理员';
    }

    async function handleLogout() {
      try {
        await AUTH.logout();
      } catch (error) {
        console.warn('[aside] logout request failed:', error);
      }
      sessionStorage.clear();
      navigateTo('/login');
    }

    function handleHelpRequest() {
      this.$msg('帮助文档正在建设中');
    }

    onMounted(function () {
      updateUser(AUTH.getUser());
      const stopAuthSubscription = AUTH.subscribe(function updateAuthenticatedUser(authState) {
        updateUser(authState.user);
      });
      const stopUserSubscription = eventTo?.on('user:update', function syncUser(info) {
        AUTH.setUser(info);
      });
      const stopRouteSubscription = onRouteChange(function updateActiveNavigation(path) {
        state.activeNavigationPath = getActiveNavigationPath(path);
      });
      return function () {
        stopAuthSubscription();
        stopUserSubscription?.();
        stopRouteSubscription?.();
      };
    });

    return { state, handleLogout, handleHelpRequest };
});

export default asideController;
