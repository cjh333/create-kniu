import { AUTH } from '../core/kniuauth.mjs';
import { defineComponent, onMounted, reactive, toRefs } from '../core/kniumvvm.mjs';

const NAVIGATION_PATHS = ['/', '/seo', '/nav', '/insights'];

function getCurrentRoutePath() {
  const hash = location.hash.slice(1) || '/';
  return hash.split('?')[0].split('#')[0] || '/';
}

function getNavigationIndex(path) {
  const index = NAVIGATION_PATHS.indexOf(path);
  return index >= 0 ? index : 0;
}

export const asideController = defineComponent({
  setup({ eventTo, navigateTo, onRouteChange }) {
    const state = reactive({
      brandMark: 'K',
      brandName: 'Kniu',
      brandSuffix: 'System',
      workspaceLabel: '工作台',
      helpLabel: '帮助',
      activeNavigationIndex: getNavigationIndex(getCurrentRoutePath()),
      badge: 12,
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
      eventTo?.emit('toast', '帮助文档正在建设中');
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
        state.activeNavigationIndex = getNavigationIndex(path);
      });
      return function () {
        stopAuthSubscription();
        stopUserSubscription?.();
        stopRouteSubscription?.();
      };
    });

    toRefs({ state, handleNavigationClick, handleLogout, handleHelpRequest });
  }
});
