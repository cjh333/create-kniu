import MVVM from '../../core/kniumvvm.mjs';
import UI from '../../core/kniuui/kniuui.mjs';
import { getCurrentRoutePath } from '../../core/kniuutil.mjs';
import { enhanceCodeBlocks, renderMarkdown } from '../../core/kniucode.mjs';
import AUTH from '../../core/kniuauth.mjs';

const { controller } = MVVM;
const HELP_DOC_PATH = '/public/docs/kniuSystem的使用手册.md';

function resolveHelpDocSource() {
  const docs = globalThis.__VIEW_DOCS__;
  if (!docs) return '';
  if (typeof docs[HELP_DOC_PATH] === 'string') return docs[HELP_DOC_PATH];
  const key = Object.keys(docs).find(function (path) { return path.endsWith('.md'); });
  return key && typeof docs[key] === 'string' ? docs[key] : '';
}

/**
 * 把「当前路径」映射到**侧栏菜单项**的路径。
 *
 * `kniu-navbar._syncActive()` 是拿 `active` 属性（本控制器下发的 `activeNavigationPath`）
 * 与每个 `kniu-navbar-cell` 的 `route` 做**字符串相等**判断的，不认识层级关系。
 * 「数据库管理」是三层独立页面，若原样下钻，进到第二/第三层后侧栏高亮会整个消失 ⇒
 * 子页面统一归到菜单项 `/database`。
 *
 * @param {string} path 当前路由路径。
 * @return {string} 侧栏应高亮的菜单路径。
 */
const MENU_ROOT_BY_PATH = {
  '/databasetables': '/database',
  '/databasetable': '/database'
};

function getActiveNavigationPath(path) {
  return MENU_ROOT_BY_PATH[path] || path;
}

const asideController = controller(({ $msg, eventTo, navigateTo, onRouteChange, root, reactive, onMounted }) => {
  const state = reactive({
    helpLabel: '帮助',
    helpTitle: 'KniuSystem 使用手册',
    showHelp: false,
    helpHtml: '',
    helpLoading: false,
    activeNavigationPath: getActiveNavigationPath(getCurrentRoutePath()),
    userAvatar: '·',
    userName: '—',
    userRole: '—',
    showWebsiteInfo: false,
    showDaily: false,
    showUserManagement: false,
    showDatabaseAdmin: false,
    logo: '/public/static/img/logo1.png'
  });

  function updateUser(info) {
    info = info || {};
    state.userName = info.name || '—';
    state.userAvatar = info.avatar || (info.name ? info.name.charAt(0) : '·');
    state.userRole = info.role || '管理员';
    state.showWebsiteInfo = Number(info.roleId || info.role || 0) === 1 || Number(info.roleAuth || 0) === 1;
    state.showDaily = state.showWebsiteInfo;
    state.showUserManagement = !!String(info.name || '').trim();
    // 数据库管理只对超级管理员开放：必须严格 role=1，不能沿用 showWebsiteInfo 的
    // 「role=1 或 role_auth=1」宽松口径（后端 /db_* 同样只认 role=1）。
    state.showDatabaseAdmin = Number(info.roleId || info.role || 0) === 1;
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

  // 帮助手册：读取构建期注入的 Markdown 原文 → 渲染 → 打开预览弹窗。
  // 开发环境若 __VIEW_DOCS__ 未注入（进程未重启），回退为按路径直接 fetch。
  async function loadHelpMarkdown() {
    let source = resolveHelpDocSource();
    if (!source) {
      const response = await fetch(HELP_DOC_PATH);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      source = await response.text();
    }
    return source;
  }

  async function handleHelpRequest() {
    if (state.helpLoading) return;
    if (state.helpHtml) {
      state.showHelp = true;
      return;
    }
    state.helpLoading = true;
    try {
      const source = await loadHelpMarkdown();
      if (!String(source || '').trim()) throw new Error('手册内容为空');
      state.helpHtml = enhanceCodeBlocks(renderMarkdown(source));
      UI.installMarkdownStyles(root);
      state.showHelp = true;
    } catch (error) {
      const reason = error && error.message ? error.message : '未知错误';
      $msg(`使用手册加载失败：${reason}`);
    } finally {
      state.helpLoading = false;
    }
  }

  function closeHelp() {
    state.showHelp = false;
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

  return { state, handleLogout, handleHelpRequest, closeHelp };
});

export default asideController;
