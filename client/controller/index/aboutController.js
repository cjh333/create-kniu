import MVVM from '../../core/kniumvvm.mjs';
import UI from '../../core/kniuui/kniuui.mjs';
import { STATUS_UNAUTHORIZED } from '../../core/kniurequest.mjs';
import IDENTITY from '../../core/kniuidentity.mjs';
import { getLastRoute } from '../../core/kniulastroute.mjs';

const { controller } = MVVM;

const aboutController = controller(({ navigateTo, request, reactive, onMounted, getRouteData }) => {
  const state = reactive({
    content: '',
    loading: true,
    nickname: '',
    avatar: '',
    nicknameFirstChar: '?',
    articleCount: 0,
    articleLikeCount: 0,
    commentLikeCount: 0,
    commentCount: 0,
    favoriteCount: 0,
    isSelf: false,
    followed: false,
    showFollow: false,
    followText: '关注',
    followOptions: { type: 'default' },
    currentYear: new Date().getFullYear()
  });

  let aboutRequest = null;
  let followRequestActive = false;

  function publisherRoleId() {
    const roleId = Number(getRouteData()?.role_id);
    return Number.isInteger(roleId) && roleId > 0 ? roleId : 0;
  }

  function syncFollowView() {
    state.showFollow = publisherRoleId() > 0 && !state.isSelf && !state.loading;
    state.followText = state.followed ? '已关注' : '关注';
    state.followOptions = { type: state.followed ? 'primary' : 'default' };
  }

  async function loadAbout() {
    if (aboutRequest) return aboutRequest;
    state.loading = true;
    const run = request({
      url: publisherRoleId() ? '/getPublisherAbout' : '/getAbout',
      type: 'POST',
      mutation: false,
      data: publisherRoleId()
        ? { role_id: publisherRoleId(), identity_token: IDENTITY.getIdentity().token }
        : { identity_token: IDENTITY.getIdentity().token }
    }).then(function (result) {
      const data = result?.status === 1 ? (result.data || {}) : {};
      state.content = String(data.content || '');
      state.nickname = String(data.nickname || '');
      state.avatar = String(data.avatar || '');
      state.nicknameFirstChar = Array.from(state.nickname)[0] || '?';
      state.articleCount = Number(data.articleCount) || 0;
      state.articleLikeCount = Number(data.articleLikeCount) || 0;
      state.commentLikeCount = Number(data.commentLikeCount) || 0;
      state.commentCount = Number(data.commentCount) || 0;
      state.favoriteCount = Number(data.favoriteCount) || 0;
      state.isSelf = data.isSelf === true;
      state.followed = data.followed === true;
      state.loading = false;
      syncFollowView();
    }).finally(function () {
      aboutRequest = null;
    });
    aboutRequest = run;
    return run;
  }

  async function toggleFollow() {
    if (followRequestActive || !publisherRoleId()) return;
    const followed = !state.followed;
    followRequestActive = true;
    try {
      const result = await request({
        url: '/followToggle',
        type: 'POST',
        redirectOnUnauthorized: false,
        data: { role_id: publisherRoleId(), followed: followed, identity_token: IDENTITY.getIdentity().token }
      });
      if (result.status === STATUS_UNAUTHORIZED) {
        navigateTo(IDENTITY.hasAccount() ? '/login' : '/register', { redirect: '/about', role_id: publisherRoleId() });
        return;
      }
      if (result.status !== 1) {
        UI.msg({ content: result.msg || '关注操作失败', type: 'error' });
        return;
      }
      state.followed = Boolean(result.data?.followed);
      syncFollowView();
    } finally {
      followRequestActive = false;
    }
  }

  function toBack() {
    // 从哪页进来的就返回到哪页（含来源数据，如文章 id）；无记录时回落首页。
    const last = getLastRoute();
    if (last && last.path && last.path !== '/about') {
      navigateTo(last.path, last.data || null);
      return;
    }
    navigateTo('/');
  }

  onMounted(loadAbout);

  return { state, loadAbout, toggleFollow, toBack };
});

export default aboutController;