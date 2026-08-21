import KniuMvvm from '../core/kniumvvm.mjs';
import { getCurrentRoutePath, getApplicationName } from '../core/kniuutil.mjs';
import { NAVIGATION_ITEMS, ROUTE_TO_NAVIGATION } from '../config/navbar.js';

const { controller, onMounted, reactive } = KniuMvvm;

const headerController = controller(({ navigateTo, onRouteChange }) => {
    const initialPath = getCurrentRoutePath();
    const state = reactive({
      brandMark: 'K',
      workspaceLabel: '工作台',
      navigation: NAVIGATION_ITEMS,
      currentPath: initialPath,
      currentApp: { name: getApplicationName(initialPath, NAVIGATION_ITEMS, ROUTE_TO_NAVIGATION) },
      searchQuery: '',
      formConfig: {}
    });

    function updateCurrentApplication(path) {
      state.currentPath = path;
      state.currentApp = { name: getApplicationName(path, NAVIGATION_ITEMS, ROUTE_TO_NAVIGATION) };
    }

    function handleNavigation(event) {
      const path = event.currentTarget.dataset.nav;
      if (!path) return;
      updateCurrentApplication(path);
      navigateTo(path);
    }

    function handleHomeNavigation() {
      updateCurrentApplication('/');
      navigateTo('/');
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
