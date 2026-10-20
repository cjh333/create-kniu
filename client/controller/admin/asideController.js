import MVVM from '../../core/kniumvvm.mjs';
import UI from '../../core/kniuui/kniuui.mjs';
import { getCurrentRoutePath } from '../../core/kniuutil.mjs';
import { applyNavFlags } from './adminShared.js';
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

const MENU_ROOT_BY_PATH = {
  '/database': '/dbconnect',
  '/databasetables': '/dbconnect',
  '/databasetable': '/dbconnect'
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
    applyNavFlags(state, info);
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