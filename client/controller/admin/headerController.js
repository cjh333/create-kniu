import KniuMvvm from '../../core/kniumvvm.mjs';
import { getCurrentRoutePath } from '../../core/kniuutil.mjs';

const { controller, onMounted, reactive } = KniuMvvm;

function getAdminPageName(path) {
  if (path === '/seo') return '网站信息';
  if (path === '/nav' || path === '/dailydetail' || path === '/articledetail') return '栏目管理';
  return '控制台';
}

const headerController = controller(({ navigateTo, onRouteChange }) => {
    const initialPath = getCurrentRoutePath();
    const state = reactive({
      brandMark: 'K',
      workspaceLabel: '工作台',
      currentPath: initialPath,
      currentApp: { name: getAdminPageName(initialPath) }
    });

    function updateCurrentApplication(path) {
      state.currentPath = path;
      state.currentApp = { name: getAdminPageName(path) };
    }

    function handleNavigation(event) {
      const path = event.currentTarget.dataset.nav;
      if (!path) return;
      updateCurrentApplication(path);
      navigateTo(path);
    }

    function handleHomeNavigation() {
      updateCurrentApplication('/admin');
      navigateTo('/admin');
    }

    function handleNotificationRequest() {
      this.$msg('暂无新通知');
    }

    function handleRefresh() {
      location.reload();
    }

    onMounted(function () {
      return onRouteChange(updateCurrentApplication);
    });

    return {
      state,
      handleNavigation,
      handleHomeNavigation,
      handleNotificationRequest,
      handleRefresh
    };
});
export default headerController;
