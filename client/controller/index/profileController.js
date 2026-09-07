import KniuMvvm from '../../core/kniumvvm.mjs';
import IDENTITY from '../../core/kniuidentity.mjs';
import REQUEST from '../../core/kniurequest.mjs';

const { controller, onMounted, reactive } = KniuMvvm;

const profileController = controller(({ navigateTo, autoSync }) => {
  const identity = IDENTITY.getIdentity();
  const state = reactive({
    nickname: identity.nickname,
    identityToken: identity.token,
    avatarText: Array.from(identity.nickname)[0] || '访',
    likes: 0,
    commentCount: 0,
    favorites: [],
    history: [],
    currentYear: new Date().getFullYear(),
    profileHint: identity.nickname ? '昵称设置后一个月内不可修改' : '登录后即可评论、点赞与收藏文章'
  });

  function toBack() { navigateTo('/'); }

  function toSignin() {
    navigateTo('/login', { tab: IDENTITY.hasAccount() ? 'login' : 'register', redirect: '/profile' });
  }

  function toFavorite(event) {
    const id = Number(event?.currentTarget?.dataset?.articleId);
    if (id > 0) navigateTo('/detail', { id: id });
  }

  async function loadProfile() {
    const result = await REQUEST({
      url: '/frontProfile',
      type: 'POST',
      data: { identity_token: state.identityToken },
      redirectOnUnauthorized: false
    });
    if (result.status !== 1) return;
    state.likes = Number(result.data?.likes) || 0;
    state.commentCount = Number(result.data?.commentCount) || 0;
    state.favorites = Array.isArray(result.data?.favorites) ? result.data.favorites : [];
    state.history = Array.isArray(result.data?.history) ? result.data.history : [];
    if (result.data?.nickname) {
      state.nickname = result.data.nickname;
      state.avatarText = Array.from(state.nickname)[0] || '访';
      IDENTITY.setIdentity({ token: state.identityToken, nickname: state.nickname });
      return;
    }
    state.profileHint = '登录后即可评论、点赞与收藏文章';
  }

  onMounted(loadProfile);
  // 获赞数/评论数/收藏与浏览历史随他人行为变化，信号到达时自动重放。
  autoSync(loadProfile);
  return { state, toBack, toFavorite, toSignin };
});

export default profileController;
