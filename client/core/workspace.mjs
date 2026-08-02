const DEFAULT_WORKSPACE = Object.freeze({
  brandMark: 'K',
  brandName: 'Kniu',
  brandSuffix: 'System',
  workspaceLabel: '工作空间',
  helpLabel: '帮助中心',
  user: Object.freeze({ avatar: '林', name: '林夕', role: '企业管理员' }),
  helpMessage: '帮助中心即将开放',
  notificationMessage: '暂无新通知',
  outletSelector: '#micro-app-outlet',
  searchSelector: '.header-actions input',
  toastSelector: '.toast',
});

function createAppMetadata(definition) {
  return {
    name: definition?.name ?? '',
    icon: definition?.icon ?? '',
    color: definition?.color ?? '',
  };
}

/**
 * 挂载工作台外壳，并返回统一清理函数。
 * options 可覆盖品牌、用户、提示文本和元素选择器。
 */
export function mountWorkspace(kniusystem, options = {}) {
  const settings = {
    ...DEFAULT_WORKSPACE,
    ...options,
    user: { ...DEFAULT_WORKSPACE.user, ...options.user },
  };
  const { $, reactive, eventTo, ROUTER, useToastNotifications, createAppRuntime, on } = kniusystem;
  if (!ROUTER?.length) throw new Error('mountWorkspace requires at least one route');

  const initialApp = ROUTER.find((route) => route.path === '/') ?? ROUTER[0];
  const navigation = ROUTER.filter((route) => route.path !== '/');
  const initialNavigation =
    navigation.find((route) => route.template === initialApp.template) ?? navigation[0];

  let runtime;
  let defaultRoute;
  const state = reactive({
    brandMark: settings.brandMark,
    brandName: settings.brandName,
    brandSuffix: settings.brandSuffix,
    workspaceLabel: settings.workspaceLabel,
    helpLabel: settings.helpLabel,
    user: { ...settings.user },
    navigation,
    currentPath: initialNavigation?.path ?? initialApp.path,
    currentApp: createAppMetadata(initialApp),
    searchQuery: '',
    handleNavigation(event) {
      runtime.navigateTo(event.currentTarget.dataset.nav);
    },
    handleHomeNavigation() {
      runtime.navigateTo(defaultRoute);
    },
    handleHelpRequest() {
      this.emit('toast', settings.helpMessage);
    },
    handleNotificationRequest() {
      this.emit('toast', settings.notificationMessage);
    },
  });

  ({ runtime, defaultRoute } = createAppRuntime({
    outlet: $(settings.outletSelector),
    eventTo,
    routes: ROUTER,
    onRouteChange(definition) {
      const navigationRoute = definition.path === '/'
        ? navigation.find((route) => route.template === definition.template)
        : definition;
      state.currentPath = navigationRoute?.path ?? definition.path;
      state.currentApp = createAppMetadata(definition);
      settings.onChange?.(definition, state);
    },
  }));

  const handleShortcut = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      $(settings.searchSelector).focus();
    }
  };
  const stopShortcutListener = on(document, 'keydown', handleShortcut);
  const stopToastNotifications = useToastNotifications(eventTo, { target: $(settings.toastSelector) });

  return () => {
    stopToastNotifications();
    stopShortcutListener();
    runtime.dispose();
  };
}
