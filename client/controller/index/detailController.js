import KniuMvvm from '../../core/kniumvvm.mjs';
import KniuUI from '../../core/kniuui.js';
import REQUEST from '../../core/kniurequest.mjs';

const { controller, onMounted, reactive } = KniuMvvm;

const detailController = controller(({ navigateTo, getRouteData }) => {
  const state = reactive({
    title: '',
    content: '',
    loading: true,
    error: '',
    currentYear: new Date().getFullYear(),
    articleId: 0,
    commentOptions: {
      list: [],
      placeholder: '请输入评论...',
      submitText: '发表评论',
      emptyText: '暂无评论，快来抢沙发吧！',
      currentUser: '游客'
    }
  });

  function getArticleId() {
    return state.articleId;
  }

  // 模板以 {{commentOptions}} 订阅 state 的 commentOptions 键；
  // 嵌套变更（list 内字段）不触发顶层键订阅，因此任何评论状态更新
  // 都必须整体重建 commentOptions 对象（内存铁律：深层路径不响应式）。
  function updateCommentOptions(patch) {
    state.commentOptions = Object.assign({}, state.commentOptions, patch);
  }

  async function loadComments() {
    const id = getArticleId();
    if (!id) return;
    const result = await REQUEST({
      url: '/getComments',
      type: 'POST',
      data: { article_id: id },
      redirectOnUnauthorized: false
    });
    if (result.status === 1 && Array.isArray(result.data)) {
      updateCommentOptions({ list: result.data });
    }
  }

  async function onSubmitComment(detail) {
    const id = getArticleId();
    if (!id) return;
    const content = detail?.content || '';
    if (!content.trim()) return;
    const result = await REQUEST({
      url: '/submitComment',
      type: 'POST',
      data: {
        article_id: id,
        parent_id: detail?.parentId || 0,
        name: state.commentOptions.currentUser || '游客',
        message: content
      },
      redirectOnUnauthorized: false
    });
    if (result.status === 1) {
      // 提交即待审核：评论不会立即显示，给用户明确反馈。
      KniuUI.msg({ content: '评论已提交，审核通过后将展示', type: 'success' });
      await loadComments();
    }
  }

  async function onLikeComment(detail) {
    const commentId = Number(detail?.commentId);
    if (!commentId) return;
    const liked = !!detail?.liked;
    const result = await REQUEST({
      url: '/likeComment',
      type: 'POST',
      data: { comment_id: commentId, liked: liked },
      redirectOnUnauthorized: false
    });
    if (result.status !== 1) return;
    const next = (state.commentOptions.list || []).map(function (item) {
      if (Number(item.id) !== commentId) return item;
      return Object.assign({}, item, {
        likes: Number(result.data?.likes ?? item.likes),
        liked: liked
      });
    });
    updateCommentOptions({ list: next });
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
      data: { id },
      redirectOnUnauthorized: false
    });
    if (result.status !== 1 || !result.data) {
      state.error = result.msg || '文章加载失败';
      state.loading = false;
      return;
    }
    state.title = result.data.title || '';
    state.content = result.data.content || '';
    state.loading = false;
    loadComments();
  }

  function toBack() {
    navigateTo('/');
  }

  // 注入事件回调：kniu-comment 通过 options 协议把 onSubmit/onLike 映射为
  // 组件的 submit/like 事件监听。必须在 handler 定义后注入，且随 updateCommentOptions
  // 整体重建时保留。
  state.commentOptions.onSubmit = onSubmitComment;
  state.commentOptions.onLike = onLikeComment;

  onMounted(loadDetail);
  return { state, loadDetail, toBack };
});

export default detailController;
