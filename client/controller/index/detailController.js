import KniuMvvm from '../../core/kniumvvm.mjs';
import KniuUI from '../../core/kniuui.js';
import REQUEST from '../../core/kniurequest.mjs';
import IDENTITY from '../../core/kniuidentity.mjs';

const { controller, onMounted, reactive } = KniuMvvm;

// 未登录时暂存待发评论，登录/注册成功后回到文章页自动补发。
const PENDING_COMMENT_KEY = 'kniu_pending_comment';

const detailController = controller(({ navigateTo, getRouteData }) => {
  const identity = IDENTITY.getIdentity();
  const state = reactive({
    title: '',
    content: '',
    loading: true,
    error: '',
    currentYear: new Date().getFullYear(),
    articleId: 0,
    likeOptions: {
      count: 0,
      liked: false,
      loading: false,
      own: false
    },
    favoriteOptions: { type: 'default' },
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
    navigateTo('/signin', {
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

  async function onLikeChange(detail) {
    const id = getArticleId();
    if (!id || state.likeOptions.loading) return;
    const liked = Boolean(detail?.liked);
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
        liked: liked
      });
    } finally {
      updateLikeOptions({ loading: false });
    }
  }

  async function toggleFavorite() {
    const identity = IDENTITY.getIdentity();
    if (!identity.nickname) {
      navigateTo('/signin', {
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
    state.favoriteOptions = { type: state.favorited ? 'primary' : 'default' };
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
    const id = getArticleId();
    if (!id) return;
    const content = detail?.content || '';
    if (!content.trim()) return;
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
      return;
    }
    KniuUI.msg({ content: result.msg || '评论提交失败', type: 'error' });
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

  async function loadDetail() {
    const id = Number(getRouteData()?.id);
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
      return;
    }
    state.title = result.data.title || '';
    state.content = result.data.content || '';
    updateLikeOptions({ count: Number(result.data.likes) || 0, liked: false, own: Boolean(result.data.isOwn) });
    state.favorited = Boolean(result.data.favorited);
    state.favoriteText = state.favorited ? '取消收藏' : '收藏文章';
    state.favoriteOptions = { type: state.favorited ? 'primary' : 'default' };
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
  }

  function toBack() {
    navigateTo('/');
  }

  state.commentOptions.onSubmit = onSubmitComment;
  state.commentOptions.onLike = onLikeComment;
  state.commentOptions.onDelete = onDeleteComment;
  state.likeOptions.onChange = onLikeChange;
  state.articleTabOptions.onChange = onArticleTabChange;

  onMounted(loadDetail);
  return { state, loadDetail, toBack, toggleFavorite };
});

export default detailController;
