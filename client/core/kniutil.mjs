import { reactive } from './kniutemplate.mjs';

export function resolveAliasReferences(source, aliases = {}) {
  return Object.entries(aliases)
    .sort(function ([left], [right]) { return right.length - left.length; })
    .reduce(function (result, [alias, target]) {
      const aliasPrefix = alias.replace(/\/+$/g, '') + '/';
      const normalizedTarget = String(target)
        .replaceAll('\\', '/')
        .replace(/^\.\//, '')
        .replace(/^\/+|\/+$/g, '');
      const targetPrefix = normalizedTarget ? `/${normalizedTarget}/` : '/';
      return result.replaceAll(aliasPrefix, targetPrefix);
    }, String(source));
}

var KniUtil = (function () {
  var state = reactive({
    loading: false,
    toast: '',
    toastShow: false
  });
  var toastTimer = null;

  // 切换路由加载态。
  function setLoading(value) {
    state.loading = !!value;
  }

  // 提示框。
  function showToast(message) {
    state.toast = message == null ? '' : String(message);
    state.toastShow = true;
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    toastTimer = setTimeout(function () {
      state.toastShow = false;
    }, 2600);
  }

  // 通用分页器：负责页码边界、总页数计算与当前页数据截取。
  function createPagination(options = {}) {
    const target = options.state;
    if (!target || typeof target !== 'object') {
      throw new TypeError('[UTIL] createPagination() requires a state object');
    }
    const pageSize = Math.max(1, Number.parseInt(options.pageSize, 10) || 10);
    const itemsKey = options.itemsKey || 'items';
    const currentPageKey = options.currentPageKey || 'currentPage';
    const totalPagesKey = options.totalPagesKey || 'totalPages';
    const totalItemsKey = options.totalItemsKey || 'totalItems';
    let sourceItems = [];

    function goToPage(page = 1) {
      const totalPages = Math.max(1, Math.ceil(sourceItems.length / pageSize));
      const currentPage = Math.min(Math.max(Number.parseInt(page, 10) || 1, 1), totalPages);
      const startIndex = (currentPage - 1) * pageSize;
      target[totalItemsKey] = sourceItems.length;
      target[totalPagesKey] = totalPages;
      target[currentPageKey] = currentPage;
      target[itemsKey] = sourceItems.slice(startIndex, startIndex + pageSize);
      return target[itemsKey];
    }

    function setItems(items, page = 1) {
      sourceItems = Array.isArray(items) ? items : [];
      return goToPage(page);
    }

    function previousPage() {
      return goToPage(target[currentPageKey] - 1);
    }

    function nextPage() {
      return goToPage(target[currentPageKey] + 1);
    }

    return {
      setItems: setItems,
      goToPage: goToPage,
      previousPage: previousPage,
      nextPage: nextPage
    };
  }

  return {
    state: state,
    setLoading: setLoading,
    showToast: showToast,
    createPagination: createPagination,
    resolveAliasReferences: resolveAliasReferences
  };
}());

export const UTIL = KniUtil;
