import KniuMvvm from '../core/kniumvvm.mjs';
import { getCurrentRoutePath, getNavigationIndex } from '../core/kniuutil.mjs';
import AUTH from '../core/kniuauth.mjs';
import { NAVIGATION_PATHS, ROUTE_TO_NAVIGATION } from '../config/navbar.js';

const { controller, onMounted, reactive } = KniuMvvm;

const asideController = controller(({ eventTo, navigateTo, onRouteChange }) => {
    const state = reactive({
      brandMark: 'K',
      brandName: 'Kniu',
      brandSuffix: 'System',
      workspaceLabel: '工作台',
      helpLabel: '帮助',
      activeNavigationIndex: getNavigationIndex(getCurrentRoutePath(), NAVIGATION_PATHS, ROUTE_TO_NAVIGATION),
      userAvatar: '·',
      userName: '—',
      userRole: '—'
    });

    function updateUser(info) {
      state.userName = info.name || '—';
      state.userAvatar = info.avatar || (info.name ? info.name.charAt(0) : '·');
      state.userRole = info.role || '管理员';
    }

    function handleNavigationClick(event) {
      const index = Number.parseInt(event.currentTarget.dataset.nav, 10);
      const path = NAVIGATION_PATHS[index];
      state.activeNavigationIndex = index;
      navigateTo(path);
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
        state.activeNavigationIndex = getNavigationIndex(path, NAVIGATION_PATHS, ROUTE_TO_NAVIGATION);
      });
      return function () {
        stopAuthSubscription();
        stopUserSubscription?.();
        stopRouteSubscription?.();
      };
    });

    return { state, handleNavigationClick, handleLogout, handleHelpRequest };
});

export default asideController;
