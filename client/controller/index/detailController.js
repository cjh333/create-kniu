import MVVM from '../../core/kniumvvm.mjs';
import UI from '../../core/kniuui.js';
import REQUEST from '../../core/kniurequest.mjs';
import IDENTITY from '../../core/kniuidentity.mjs';
import { enhanceCodeBlocks, renderMarkdown } from '../../core/kniucode.mjs';
import { sanitizeRichHtml } from '../../core/kniusanitizer.mjs';

const { controller, onBeforeMount, onMounted, reactive } = MVVM;
const PENDING_COMMENT_KEY = 'kniu_pending_comment';

function unwrapEditorCodeFence(value) {
  return String(value || '')
    .replace(/((?:^|<\/(?:p|div)>|<br\s*\/?>|\n)\s*)(?:<(?:p|div)[^>]*>\s*)?```[a-z0-9_-]*\s*(?:<\/(?:p|div)>|<br\s*\/?>|\n)+(\s*<pre\b)/gi, '$1$2')
    .replace(/(<\/pre>\s*)(?:<(?:p|div)[^>]*>\s*)?```\s*(?:<\/(?:p|div)>|<br\s*\/?>)?/gi, '$1');
}

function renderMarkdownArticle(value) {
  const source = unwrapEditorCodeFence(value);
  return enhanceCodeBlocks(renderMarkdown(source));
}

const detailController = controller(({ navigateTo, getRouteData, onRouteChange, onScopeDispose, root }) => {
  const identity = IDENTITY.getIdentity();
  const state = reactive({
    title: '',
    subtitle: '',
    content: '',
    content_mode: 'rich',
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
      onChange: onLikeChange
    },
    favoriteOptions: { type: 'default', block: true },
    favoriteText: '收藏文章',
    favorited: false,
    articleTabOptions: {
      previous: null,
      next: null,
      previousLabel: '上一篇',
      nextLabel: '下一篇',
      onChange: onArticleTabChange
    },
    commentOptions: {
      list: [],
      maxLength: 500,
      submitText: '发表评论',
      emptyText: '暂无评论，快来抢沙发吧！',
      currentUser: identity.nickname,
      currentUserId: 0,
      filter: 'B,逼,屌,操',
      placeholder: '说点什么吧...',
      canSubmit: Boolean(identity.nickname)
    }
  });

  function getArticleId() {
    return state.articleId;
  }

  function getRouteArticleId() {
    const routeId = Number(getRouteData()?.id);
    return Number.isInteger(routeId) && routeId > 0 ? routeId : 0;
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

  function scrollArticleToTop() {
    const documentRef = globalThis.document;
    const targets = [
      documentRef?.scrollingElement,
      documentRef?.documentElement,
      documentRef?.body
    ];
    let parent = root?.host || null;
    while (parent) {
      targets.push(parent);
      parent = parent.parentElement;
    }
    targets.filter(Boolean).forEach(function (target) {
      target.scrollTop = 0;
      target.scrollTo?.({ top: 0, behavior: 'auto' });
    });
    globalThis.scrollTo?.({ top: 0, behavior: 'auto' });
  }

  function onArticleTabChange(detail, event) {
    const payload = detail?.detail && typeof detail.detail === 'object'
      ? detail.detail
      : (detail && typeof detail === 'object' ? detail : event?.detail);
    const id = Number(payload?.id);
    if (Number.isInteger(id) && id > 0) {
      // 地址保持 /detail，文章 id 只放在应用路由状态中，避免污染地址栏。
      navigateTo('/detail', { id: id });
    }
  }

  let likeRequestActive = false;
  let favoriteRequestActive = false;
  let commentSubmitActive = false;
  let commentsRequest = null;

  async function onLikeChange(detail) {
    const id = getArticleId();
    if (!id || state.likeOptions.loading || likeRequestActive) return;
    const identity = IDENTITY.getIdentity();
    if (!identity.nickname) {
      navigateTo('/login', {
        tab: IDENTITY.hasAccount() ? 'login' : 'register',
        redirect: '/detail',
        id: id
      });
      return;
    }
    const liked = Boolean(detail?.liked);
    likeRequestActive = true;
    updateLikeOptions({ loading: true });
    let succeeded = false;
    try {
      const result = await REQUEST({
        url: '/likeArticle',
        type: 'POST',
        data: { article_id: id, liked: liked, identity_token: identity.token },
        redirectOnUnauthorized: false
      });
      if (result.status !== 1) {
        UI.msg({ content: result.msg || '点赞失败', type: 'error' });
        return;
      }
      succeeded = true;
      updateLikeOptions({
        count: Number(result.data?.likes) || 0,
        liked: result.data?.liked === true,
        disabled: false,
        loading: false,
        feedback: result.data?.liked === true ? Date.now() : 0
      });
    } finally {
      if (!succeeded) updateLikeOptions({ loading: false });
      likeRequestActive = false;
    }
  }

  async function toggleFavorite() {
    if (favoriteRequestActive) return;
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
    favoriteRequestActive = true;
    try {
      const result = await REQUEST({
        url: '/favoriteArticle',
        type: 'POST',
        data: { article_id: getArticleId(), favorited: favorited, identity_token: identity.token },
        redirectOnUnauthorized: false
      });
      if (result.status !== 1) {
        UI.msg({ content: result.msg || '收藏操作失败', type: 'error' });
        return;
      }
      state.favorited = Boolean(result.data?.favorited);
      state.favoriteText = state.favorited ? '取消收藏' : '收藏文章';
      state.favoriteOptions = { type: state.favorited ? 'primary' : 'default', block: true };
    } finally {
      favoriteRequestActive = false;
    }
  }

  async function loadComments() {
    const id = getArticleId();
    if (!id) return;
    if (commentsRequest && commentsRequest.id === id) return commentsRequest.promise;
    const promise = (async function () {
      const result = await REQUEST({
        url: '/getComments',
        type: 'POST',
        data: { article_id: id, identity_token: IDENTITY.getIdentity().token },
        headers: { 'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache' },
        redirectOnUnauthorized: false
      });
      if (result.status === 1) {
        updateCommentOptions({ list: Array.isArray(result.data) ? result.data : [] });
      }
    })();
    commentsRequest = { id: id, promise: promise };
    try {
      return await promise;
    } finally {
      if (commentsRequest?.promise === promise) commentsRequest = null;
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
      UI.msg({ content: `评论不能超过 ${maxLength} 个字`, type: 'error' });
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
      if (Number(result.data?.is_show) !== 1) {
        UI.msg({ content: '评论已提交，审核通过后将展示', type: 'success' });
      }
      await loadComments();
      commentSubmitActive = false;
      return;
    }
    UI.msg({ content: result.msg || '评论提交失败', type: 'error' });
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
    const identity = IDENTITY.getIdentity();
    if (!identity.nickname) {
      navigateTo('/login', { tab: IDENTITY.hasAccount() ? 'login' : 'register', redirect: '/detail', id: getArticleId() });
      return;
    }
    const liked = !!detail?.liked;
    const result = await REQUEST({
      url: '/likeComment',
      type: 'POST',
      data: { comment_id: commentId, liked: liked, identity_token: identity.token },
      redirectOnUnauthorized: false
    });
    if (result.status !== 1) {
      UI.msg({ content: result.msg || '点赞失败', type: 'error' });
      return;
    }
    const next = (state.commentOptions.list || []).map(function (item) {
      if (Number(item.id) !== commentId) {
        return item.likeFeedback ? Object.assign({}, item, { likeFeedback: 0 }) : item;
      }
      return Object.assign({}, item, {
        likes: Number(result.data?.likes ?? item.likes),
        liked: result.data?.liked === true,
        locked: false,
        likeFeedback: result.data?.liked === true ? Date.now() : 0
      });
    });
    updateCommentOptions({ list: next });
  }

  async function onDeleteComment(detail) {
    const commentId = Number(detail?.commentId);
    if (!commentId) return;
    try {
      await UI.confirm('确定删除这条评论吗？', '提示', { type: 'warning' });
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
      UI.msg({ content: result.msg || '删除失败', type: 'error' });
      return;
    }
    UI.msg({ content: '删除成功', type: 'success' });
    await loadComments();
  }

  async function loadCurrentIdentity() {
    const currentIdentity = IDENTITY.getIdentity();
    if (!currentIdentity.nickname) {
      updateCommentOptions({ currentUser: '', currentUserId: 0, canSubmit: false });
      return;
    }
    const result = await REQUEST({
      url: '/frontProfile',
      type: 'POST',
      data: { identity_token: currentIdentity.token },
      redirectOnUnauthorized: false
    });
    if (result.status !== 1 || !result.data?.nickname) return;
    updateCommentOptions({
      currentUser: result.data.nickname,
      currentUserId: Number(result.data.roleId || result.data.id) || 0,
      canSubmit: Number(result.data.comment_ban) !== 1
    });
  }

  let detailRequestActive = false;
  let detailReloadPending = false;

  async function loadDetail() {
    if (detailRequestActive) {
      const requestedId = getRouteArticleId();
      if (Number.isInteger(requestedId) && requestedId > 0 && requestedId !== state.articleId) {
        detailReloadPending = true;
      }
      return;
    }
    detailRequestActive = true;
    try {
      const id = getRouteArticleId();
      if (!Number.isInteger(id) || id <= 0) {
        state.error = '文章参数无效';
        state.loading = false;
        return;
      }
      state.articleId = id;
      const result = await REQUEST({
        url: '/getDetail',
        type: 'POST',
        data: { id, identity_token: IDENTITY.getIdentity().token },
        redirectOnUnauthorized: false
      });
      if (result.status !== 1 || !result.data) {
        state.error = result.msg || '文章加载失败';
        state.loading = false;
        detailRequestActive = false;
        return;
      }
      state.title = result.data.title || '';
      state.subtitle = result.data.subtitle || '';
      state.content_mode = result.data.content_mode === 'markdown' ? 'markdown' : 'rich';
      if (result.data.content_mode === 'markdown') {
        UI.installMarkdownStyles(root);
        state.content = renderMarkdownArticle(result.data.content || '');
      } else {
        UI.installRichTextStyles(root);
        // 富文本正文也通过统一清洗器：被转义保存的 <script setup> 会恢复为行内 code，
        // 同时避免服务端历史数据将危险标签再次作为真实 DOM 注入前台。
        state.content = sanitizeRichHtml(result.data.content || '');
      }
      state.publisher = result.data.publisher || '';
      state.create_time = result.data.create_time || '';
      state.hits = Number(result.data.hits) || 0;
      state.isOwn = Boolean(result.data.isOwn);
      updateLikeOptions({ count: Number(result.data.likes) || 0, liked: Boolean(result.data.liked ?? result.data.likeLocked), own: Boolean(result.data.isOwn), disabled: false });
      state.favorited = Boolean(result.data.favorited);
      state.favoriteText = state.favorited ? '取消收藏' : '收藏文章';
      state.favoriteOptions = { type: state.favorited ? 'primary' : 'default', block: true };
      updateArticleTabOptions({
        previous: result.data.previous || null,
        next: result.data.next || null
      });
      state.loading = false;
      await loadCurrentIdentity();
      await loadComments();
      if (!IDENTITY.getIdentity().nickname) return;
      const pending = takePendingComment(id);
      if (pending) await submitComment(pending);
    } finally {
      detailRequestActive = false;
      if (detailReloadPending) {
        detailReloadPending = false;
        queueMicrotask(loadDetail);
      }
    }
  }

  function toBack() {
    navigateTo('/');
  }

  state.commentOptions.onSubmit = onSubmitComment;
  state.commentOptions.onLike = onLikeComment;
  state.commentOptions.onDelete = onDeleteComment;
  const offRouteChange = onRouteChange(function (hash, prev) {
    if (prev === null || String(hash || '').split('?')[0] !== '/detail') return;
    const routeId = getRouteArticleId();
    if (!Number.isInteger(routeId) || routeId <= 0 || routeId === state.articleId) return;
    loadDetail();
  });
  onScopeDispose(offRouteChange);

  onBeforeMount(scrollArticleToTop);
  onMounted(loadDetail);
  return { state, loadDetail, toBack, toggleFavorite };
});

export default detailController;
