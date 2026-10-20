import MVVM from '../../core/kniumvvm.mjs';
import UI from '../../core/kniuui/kniuui.mjs';
import IDENTITY from '../../core/kniuidentity.mjs';
import { getLastRoute } from '../../core/kniulastroute.mjs';

const { controller } = MVVM;

const profileController = controller(({ navigateTo, request, reactive, onMounted }) => {
  const identity = IDENTITY.getIdentity();
  const state = reactive({
    nickname: identity.nickname,
    editingNickname: false,
    nicknameDraft: identity.nickname,
    canEditNickname: false,
    identityToken: identity.token,
    avatar: '',
    avatarText: Array.from(identity.nickname)[0] || '访',
    articleCount: 0,
    articleLikeCount: 0,
    commentLikeCount: 0,
    commentCount: 0,
    favorites: [],
    history: [],
    follows: [],
    feedbacks: [],
    feedbackModalShow: false,
    // imageList 必须预置：视图对 feedbackDetail.imageList.length 求值，
    // 空对象会让首帧表达式抛错（引擎静默空串 → 图片区按 fail-open 不渲染）。
    feedbackDetail: { imageList: [] },
    currentYear: new Date().getFullYear(),
    profileHint: identity.nickname ? '昵称设置后一年内不可修改' : '登录后即可评论、点赞与收藏文章'
  });

  function toBack() {
    // 从哪页进来的就返回到哪页（含来源数据）；无记录时回落首页。
    const last = getLastRoute();
    if (last && last.path && last.path !== '/profile') {
      navigateTo(last.path, last.data || null);
      return;
    }
    navigateTo('/');
  }

  function toSignin() {
    navigateTo(IDENTITY.hasAccount() ? '/login' : '/register', { redirect: '/profile' });
  }

  function toFavorite(event) {
    const id = Number(event?.currentTarget?.dataset?.articleId);
    if (id > 0) navigateTo('/detail', { id: id });
  }

  let profileRequest = null;

  async function loadProfile() {
    if (profileRequest) return profileRequest;
    const run = request({
      url: '/frontProfile',
      type: 'POST',
      mutation: false,
      data: { identity_token: state.identityToken }
    }).then(function (result) {
      if (result.status !== 1) {
        state.nickname = '';
        state.nicknameDraft = '';
        state.avatar = '';
        state.avatarText = '访';
        state.profileHint = '登录后即可评论、点赞与收藏文章';
        return;
      }
      state.articleCount = Number(result.data?.articleCount) || 0;
      state.articleLikeCount = Number(result.data?.articleLikeCount) || 0;
      state.commentLikeCount = Number(result.data?.commentLikeCount) || 0;
      state.commentCount = Number(result.data?.commentCount) || 0;
      state.favorites = Array.isArray(result.data?.favorites) ? result.data.favorites : [];
      state.history = Array.isArray(result.data?.history) ? result.data.history : [];
      state.canEditNickname = result.data?.canEditNickname === true;
      if (result.data?.nickname) {
        state.nickname = result.data.nickname;
        state.nicknameDraft = state.nickname;
        state.avatar = String(result.data?.avatar || '');
        state.avatarText = Array.from(state.nickname)[0] || '访';
        IDENTITY.setIdentity({ token: state.identityToken, nickname: state.nickname });
        return;
      }
      state.profileHint = '登录后即可评论、点赞与收藏文章';
    }).finally(function () {
      profileRequest = null;
    });
    profileRequest = run;
    return run;
  }

  function editNickname() {
    if (state.canEditNickname) { state.nicknameDraft = state.nickname; state.editingNickname = true; }
  }

  async function saveNickname() {
    if (!state.canEditNickname) return;
    const nickname = String(state.nicknameDraft || '').trim();
    // 与注册页 registerModel.nickname 同口径：一年只能改一次，失败重试成本高，前端预校验拦住明显非法值。
    if (!nickname) {
      UI.msg({ content: '昵称不能为空', type: 'error' });
      return;
    }
    if (!/^[\u4e00-\u9fa5A-Za-z0-9_\- ]{1,30}$/.test(nickname)) {
      UI.msg({ content: '昵称为1-30位中文、字母、数字、下划线、短横线或空格', type: 'error' });
      return;
    }
    const result = await request({ url: '/frontProfileSave', type: 'POST', data: { identity_token: state.identityToken, nickname } });
    if (result.status !== 1) {
      UI.msg({ content: result.msg || '昵称保存失败', type: 'error' });
      return;
    }
    state.nickname = result.data?.nickname || nickname;
    state.nicknameDraft = state.nickname;
    state.editingNickname = false;
    state.canEditNickname = false;
    IDENTITY.setIdentity({ token: state.identityToken, nickname: state.nickname, name: IDENTITY.getIdentity().name });
  }

  let followListRequest = null;

  async function loadFollows() {
    if (followListRequest) return followListRequest;
    const run = request({
      url: '/followList',
      type: 'POST',
      mutation: false,
      data: { identity_token: state.identityToken }
    }).then(function (result) {
      if (result.status !== 1) return;
      const list = Array.isArray(result.data?.list) ? result.data.list : [];
      state.follows = list.map(function (item) {
        const nickname = String(item.nickname || '');
        return Object.assign({}, item, { avatarText: Array.from(nickname)[0] || '?' });
      });
    }).finally(function () {
      followListRequest = null;
    });
    followListRequest = run;
    return run;
  }

  let feedbackListRequest = null;

  async function loadFeedbacks() {
    if (feedbackListRequest) return feedbackListRequest;
    const run = request({
      url: '/feedbackList',
      type: 'POST',
      mutation: false,
      data: { identity_token: state.identityToken }
    }).then(function (result) {
      if (result.status !== 1) return;
      state.feedbacks = Array.isArray(result.data?.list) ? result.data.list : [];
    }).finally(function () {
      feedbackListRequest = null;
    });
    feedbackListRequest = run;
    return run;
  }

  function toFeedbackDetail(event) {
    const id = Number(event?.currentTarget?.dataset?.feedbackId);
    const item = state.feedbacks.find(function (row) { return Number(row.id) === id; });
    if (!item) return;
    state.feedbackDetail = item;
    state.feedbackModalShow = true;
  }

  function closeFeedbackDialog() {
    state.feedbackModalShow = false;
  }

  function toFollowAbout(event) {
    const roleId = Number(event?.currentTarget?.__kniuOptionsValue?.roleId);
    if (Number.isInteger(roleId) && roleId > 0) navigateTo('/about', { role_id: roleId });
  }

  let followRequestActive = false;

  async function toUnfollow(event) {
    if (followRequestActive) return;
    const host = event?.currentTarget;
    const roleId = Number(host?.options?.roleId ?? host?.getAttribute?.('role-id'));
    if (!Number.isInteger(roleId) || roleId <= 0) return;
    followRequestActive = true;
    try {
      const result = await request({
        url: '/followToggle',
        type: 'POST',
        data: { role_id: roleId, followed: false, identity_token: state.identityToken }
      });
      if (result.status !== 1) {
        UI.msg({ content: result.msg || '取消关注失败', type: 'error' });
        return;
      }
      loadFollows();
    } finally {
      followRequestActive = false;
    }
  }

  onMounted(function () {
    loadProfile();
    loadFollows();
    loadFeedbacks();
  });
  return { state, toBack, toFavorite, toSignin, toUnfollow, toFollowAbout, toFeedbackDetail, closeFeedbackDialog, editNickname, saveNickname };
});

export default profileController;