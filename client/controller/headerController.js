import { defineComponent, onMounted, reactive, toRefs } from '../core/kniumvvm.mjs';

const NAVIGATION_ITEMS = [
  { path: '/', name: '控制台', icon: '⌂' },
  { path: '/seo', name: '网站信息', icon: '▤' },
  { path: '/nav', name: '栏目管理', icon: '◇' },
  { path: '/insights', name: '数据洞察', icon: '↗' }
];

const APPLICATION_NAMES = Object.fromEntries(
  NAVIGATION_ITEMS.map(function mapApplicationName(item) { return [item.path, item.name]; })
);

function getCurrentRoutePath() {
  const hash = location.hash.slice(1) || '/';
  return hash.split('?')[0].split('#')[0] || '/';
}

export const headerController = defineComponent({
  setup({ eventTo, navigateTo, onRouteChange, root }) {
    const initialPath = getCurrentRoutePath();
    const state = reactive({
      brandMark: 'K',
      workspaceLabel: '工作台',
      navigation: NAVIGATION_ITEMS,
      currentPath: initialPath,
      currentApp: { name: APPLICATION_NAMES[initialPath] || '控制台' },
      searchQuery: ''
    });

    function updateCurrentApplication(path) {
      state.currentPath = path;
      state.currentApp = { name: APPLICATION_NAMES[path] || '控制台' };
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
      eventTo?.emit('toast', '暂无新通知');
    }

    onMounted(function () {
      kniu.form({ el: root.querySelector('#searchform') });
      return onRouteChange(updateCurrentApplication);
    });

    toRefs({
      state,
      handleNavigation,
      handleHomeNavigation,
      handleNotificationRequest
    });
  }
});
