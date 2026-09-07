import KniuMvvm from '../../core/kniumvvm.mjs';
import KniuUI from '../../core/kniuui.js';
import REQUEST from '../../core/kniurequest.mjs';
import IDENTITY from '../../core/kniuidentity.mjs';
import { marked } from '/node_modules/marked/lib/marked.esm.js';

const { controller, onMounted, reactive } = KniuMvvm;

// 未登录时暂存待发评论，登录/注册成功后回到文章页自动补发。
const PENDING_COMMENT_KEY = 'kniu_pending_comment';

function renderCodeBlocks(value) {
  marked.setOptions({
    highlight(code, lang) {
      return code;
    }
  });
  const source = String(value || '').replace(/&lt;br\s*\/??&gt;|<br\s*\/?>/gi, '\n');
  return marked.parse(source);
  /* legacy fallback retained below */
  /*
  const escape = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const source = String(value || '').replace(/&lt;br\s*\/??&gt;|<br\s*\/?>/gi, '\n');
  return source.replace(/```([\w+-]*)\s*\n?([\s\S]*?)```/g, function (_, lang, code) {
    const lines = code.replace(/^\n|\n$/g, '').split('\n');
    return '<pre class="article-code"><code' + (lang ? ' data-language="' + escape(lang) + '"' : '') + '>' + lines.map(function (line) { return '<span class="article-code-line">' + (escape(line) || ' ') + '</span>'; }).join('') + '</code></pre>';
  }); */
}

const detailController = controller(({ navigateTo, getRouteData, onRouteChange, onScopeDispose, autoSync }) => {
  const identity = IDENTITY.getIdentity();
  const state = reactive({
    title: '',
    content: '',
    publisher: '',
    create_time: '',
    hits: 0,
    loading: true,
    error: '',
    currentYear: new Date().getFullYear(),
    articleId: 0,
    isOwn: false,
    likeOptions: {
      count: 0,
      liked: false,
      loading: false,
      own: false,
      // onChange 必须在初始 options 中声明：框架的 installOptionsOnlyProtocol 只在
      // 首次 set options 时 bindCallbacks 绑定 change 监听器；若事后通过
      // state.likeOptions.onChange = onLikeChange 原地 mutate，不会触发重绑，
      // 导致点击点赞永远不触发请求（任何账号都点不了赞）。
      onChange: onLikeChange
    },
    favoriteOptions: { type: 'default', block: true },
    favoriteText: '收藏文章',
    favorited: false,
    articleTabOptions: {
      previous: null,
      next: null,
      previousLabel: '上一篇',
      nextLabel: '下一篇'
    },
    commentOptions: {
      list: [],
      maxLength: 500,
      submitText: '发表评论',
      emptyText: '暂无评论，快来抢沙发吧！',
      currentUser: identity.nickname,
      currentUserId: 0,
      filter: 'B,逼,屌,操',
      placeholder: '请输入评论...'
    }
  });

  function getArticleId() {
    return state.articleId;
  }

  function savePendingComment(payload) {
    try { globalThis.sessionStorage?.setItem(PENDING_COMMENT_KEY, JSON.stringify(payload)); } catch (_) { }
  }

  function takePendingComment(articleId) {
    try {
      const raw = globalThis.sessionStorage?.getItem(PENDING_COMMENT_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || Number(data.articleId) !== Number(articleId)) return null;
      globalThis.sessionStorage?.removeItem(PENDING_COMMENT_KEY);
      return data;
    } catch (_) {
      return null;
    }
  }

  // 未登录：初次访客引导去注册，本机注册过账号的直接去登录。
  function requireSignin(pending) {
    savePendingComment(pending);
    navigateTo('/login', {
      tab: IDENTITY.hasAccount() ? 'login' : 'register',
      redirect: '/detail',
      id: getArticleId()
    });
  }

  function updateCommentOptions(patch) {
    state.commentOptions = Object.assign({}, state.commentOptions, patch);
  }

  function updateLikeOptions(patch) {
    state.likeOptions = Object.assign({}, state.likeOptions, patch);
  }

  function updateArticleTabOptions(patch) {
    state.articleTabOptions = Object.assign({}, state.articleTabOptions, patch);
  }

  function onArticleTabChange(detail) {
    const id = Number(detail?.id);
    if (Number.isInteger(id) && id > 0) {
      navigateTo('/detail', { id: id });
      return;
    }
    navigateTo('/');
  }

  let likeRequestActive = false;
  let commentSubmitActive = false;

  async function onLikeChange(detail) {
    const id = getArticleId();
    if (!id || state.likeOptions.loading || likeRequestActive) return;
    const liked = Boolean(detail?.liked);
    likeRequestActive = true;
    updateLikeOptions({ loading: true });
    try {
      const result = await REQUEST({
        url: '/likeArticle',
        type: 'POST',
        data: { article_id: id, liked: liked },
        redirectOnUnauthorized: false
      });
      if (result.status !== 1) {
        KniuUI.msg({ content: result.msg || '点赞失败', type: 'error' });
        return;
      }
      updateLikeOptions({
        count: Number(result.data?.likes) || 0,
        liked: liked,
        // 点赞成功后立即锁定按钮，避免重复点击再次提交。
        disabled: result.data?.locked !== false
      });
    } finally {
      updateLikeOptions({ loading: false });
      likeRequestActive = false;
    }
  }

  async function toggleFavorite() {
    const identity = IDENTITY.getIdentity();
    if (!identity.nickname) {
      navigateTo('/login', {
        tab: IDENTITY.hasAccount() ? 'login' : 'register',
        redirect: '/detail',
        id: getArticleId()
      });
      return;
    }
    const favorited = !state.favorited;
    const result = await REQUEST({
      url: '/favoriteArticle',
      type: 'POST',
      data: { article_id: getArticleId(), favorited: favorited, identity_token: identity.token },
      redirectOnUnauthorized: false
    });
    if (result.status !== 1) {
      KniuUI.msg({ content: result.msg || '收藏操作失败', type: 'error' });
      return;
    }
    state.favorited = Boolean(result.data?.favorited);
    state.favoriteText = state.favorited ? '取消收藏' : '收藏文章';
    state.favoriteOptions = { type: state.favorited ? 'primary' : 'default', block: true, disabled: true };
  }

  async function loadComments() {
    const id = getArticleId();
    if (!id) return;
    const result = await REQUEST({
      url: '/getComments',
      type: 'POST',
      data: { article_id: id, identity_token: IDENTITY.getIdentity().token },
      redirectOnUnauthorized: false
    });
    if (result.status === 1 && Array.isArray(result.data)) {
      updateCommentOptions({ list: result.data });
    }
  }

  async function submitComment(detail) {
    if (commentSubmitActive) return;
    const id = getArticleId();
    if (!id) return;
    const content = detail?.content || '';
    if (!content.trim()) return;
    commentSubmitActive = true;
    const maxLength = Math.max(0, Number(state.commentOptions.maxLength) || 0);
    if (maxLength && Array.from(content).length > maxLength) {
      KniuUI.msg({ content: `评论不能超过 ${maxLength} 个字`, type: 'error' });
      return;
    }
    const result = await REQUEST({
      url: '/submitComment',
      type: 'POST',
      data: {
        article_id: id,
        parent_id: detail?.parentId || 0,
        identity_token: IDENTITY.getIdentity().token,
        message: content
      },
      redirectOnUnauthorized: false
    });
    if (result.status === 1) {
      KniuUI.msg({ content: '评论已提交，审核通过后将展示', type: 'success' });
      await loadComments();
      commentSubmitActive = false;
      return;
    }
    KniuUI.msg({ content: result.msg || '评论提交失败', type: 'error' });
    commentSubmitActive = false;
  }

  async function onSubmitComment(detail) {
    const content = String(detail?.content || '').trim();
    if (!content) return;
    if (!IDENTITY.getIdentity().nickname) {
      requireSignin({ articleId: getArticleId(), content: content, parentId: detail?.parentId || 0 });
      return;
    }
    await submitComment(detail);
  }

  async function onLikeComment(detail) {
    const commentId = Number(detail?.commentId);
    if (!commentId) return;
    const liked = !!detail?.liked;
    const result = await REQUEST({
      url: '/likeComment',
      type: 'POST',
      data: { comment_id: commentId, liked: liked, identity_token: IDENTITY.getIdentity().token },
      redirectOnUnauthorized: false
    });
    if (result.status !== 1) {
      KniuUI.msg({ content: result.msg || '点赞失败', type: 'error' });
      return;
    }
    const next = (state.commentOptions.list || []).map(function (item) {
      if (Number(item.id) !== commentId) return item;
      return Object.assign({}, item, {
        likes: Number(result.data?.likes ?? item.likes),
        liked: liked
      });
    });
    updateCommentOptions({ list: next });
  }

  async function onDeleteComment(detail) {
    const commentId = Number(detail?.commentId);
    if (!commentId) return;
    try {
      await KniuUI.confirm('确定删除这条评论吗？', '提示', { type: 'warning' });
    } catch (_) {
      return;
    }
    const result = await REQUEST({
      url: '/deleteComment',
      type: 'POST',
      data: { comment_id: commentId, identity_token: IDENTITY.getIdentity().token },
      redirectOnUnauthorized: false
    });
    if (result.status !== 1) {
      KniuUI.msg({ content: result.msg || '删除失败', type: 'error' });
      return;
    }
    KniuUI.msg({ content: '删除成功', type: 'success' });
    await loadComments();
  }

  async function loadCurrentIdentity() {
    const currentIdentity = IDENTITY.getIdentity();
    if (!currentIdentity.nickname) return;
    const result = await REQUEST({
      url: '/frontProfile',
      type: 'POST',
      data: { identity_token: currentIdentity.token },
      redirectOnUnauthorized: false
    });
    if (result.status !== 1 || !result.data?.nickname) return;
    updateCommentOptions({
      currentUser: result.data.nickname,
      currentUserId: Number(result.data.id) || 0,
      placeholder: '请输入评论...'
    });
  }

  let loadSeq = 0;
  let lastAutoSyncAt = 0;
  let detailRequestActive = false;
  let lastDetailStartAt = 0;

  async function loadDetail() {
    const startedAt = Date.now();
    // 首次挂载时 onMounted 与路由初始化回调可能几乎同时到达；两者视为同一次加载。
    if (startedAt - lastDetailStartAt < 500) return;
    lastDetailStartAt = startedAt;
    // 同一时刻只允许一个详情请求链路执行；页面挂载、路由回调和 SSE
    // 可能在同一时间触发，避免重复请求详情/身份/评论接口。
    if (detailRequestActive) return;
    detailRequestActive = true;
    const seq = ++loadSeq;
    const id = Number(getRouteData()?.id);
    if (!Number.isInteger(id) || id <= 0) {
      state.error = '文章参数无效';
      state.loading = false;
      detailRequestActive = false;
      return;
    }
    state.articleId = id;
    const result = await REQUEST({
      url: '/getDetail',
      type: 'POST',
      data: { id, identity_token: IDENTITY.getIdentity().token },
      redirectOnUnauthorized: false
    });
    // 快速连续切换文章（上一篇/下一篇）时只采纳最后一次加载的结果。
    if (seq !== loadSeq) { detailRequestActive = false; return; }
    if (result.status !== 1 || !result.data) {
      state.error = result.msg || '文章加载失败';
      state.loading = false;
      detailRequestActive = false;
      return;
    }
    state.title = result.data.title || '';
    state.content = renderCodeBlocks(result.data.content || '');
    state.publisher = result.data.publisher || '';
    state.create_time = result.data.create_time || '';
    state.hits = Number(result.data.hits) || 0;
    state.isOwn = Boolean(result.data.isOwn);
    updateLikeOptions({ count: Number(result.data.likes) || 0, liked: Boolean(result.data.likeLocked), own: Boolean(result.data.isOwn), disabled: Boolean(result.data.likeLocked) });
    state.favorited = Boolean(result.data.favorited);
    state.favoriteText = state.favorited ? '取消收藏' : '收藏文章';
    state.favoriteOptions = { type: state.favorited ? 'primary' : 'default', block: true, disabled: state.favorited };
    updateArticleTabOptions({
      previous: result.data.previous || null,
      next: result.data.next || null
    });
    state.loading = false;
    await loadCurrentIdentity();
    await loadComments();
    // 登录/注册后带着待发评论回到文章页：此时已登录，自动补发并刷新列表。
    if (!IDENTITY.getIdentity().nickname) return;
    const pending = takePendingComment(id);
    if (pending) await submitComment(pending);
    detailRequestActive = false;
  }

  function toBack() {
    navigateTo('/');
  }

  state.commentOptions.onSubmit = onSubmitComment;
  state.commentOptions.onLike = onLikeComment;
  state.commentOptions.onDelete = onDeleteComment;
  // likeOptions.onChange 已在初始 options 中声明（框架只在首次 set options 绑定监听器），此处不再原地赋值。
  state.articleTabOptions.onChange = onArticleTabChange;

  // 详情页内上一篇/下一篇走 navigateTo('/detail', { id })：hash 不变，_renderRoute 按同视图
  // 去重后不会重新挂载组件，必须订阅路由变化重读 routeData 刷新内容；浏览器前进/后退同样经此刷新。
  const offRouteChange = onRouteChange(function (hash, prev) {
    if (prev === null) return; // 注册时的同步初始化回调，首次加载交给 onMounted
    if (String(hash || '').split('?')[0] !== '/detail') return;
    loadDetail();
  });
  onScopeDispose(offRouteChange);

  onMounted(loadDetail);
  // 后台编辑文章或审核评论后，在线详情页自动重放（loadDetail 内部连带刷新评论列表），
  // 无需刷新页面。loadSeq 竞态守卫保证与"上一篇/下一篇"切换并发时只采纳最后一次结果。
  autoSync(function () {
    const now = Date.now();
    if (now - lastAutoSyncAt < 1200) return;
    lastAutoSyncAt = now;
    loadDetail();
  });
  return { state, loadDetail, toBack, toggleFavorite };
});

export default detailController;
