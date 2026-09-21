import MVVM from '../../core/kniumvvm.mjs';
import IDENTITY from '../../core/kniuidentity.mjs';
import REQUEST from '../../core/kniurequest.mjs';

const { controller, onMounted, reactive } = MVVM;

const profileController = controller(({ navigateTo, autoSync }) => {
  const identity = IDENTITY.getIdentity();
  const state = reactive({
    nickname: identity.nickname,
    editingNickname: false,
    nicknameDraft: identity.nickname,
    canEditNickname: false,
    identityToken: identity.token,
    avatarText: Array.from(identity.nickname)[0] || '访',
    articleLikeCount: 0,
    commentLikeCount: 0,
    commentCount: 0,
    favorites: [],
    history: [],
    currentYear: new Date().getFullYear(),
    profileHint: identity.nickname ? '昵称设置后一年内不可修改' : '登录后即可评论、点赞与收藏文章'
  });

  function toBack() { navigateTo('/'); }

  function toSignin() {
    navigateTo('/login', { tab: IDENTITY.hasAccount() ? 'login' : 'register', redirect: '/profile' });
  }

  function toFavorite(event) {
    const id = Number(event?.currentTarget?.dataset?.articleId);
    if (id > 0) navigateTo('/detail', { id: id });
  }

  let profileRequest = null;
  let profileRefreshPending = false;

  async function loadProfile(reason) {
    if (profileRequest) {
      if (typeof reason === 'string') profileRefreshPending = true;
      return profileRequest;
    }
    const run = REQUEST({
      url: '/frontProfile',
      type: 'POST',
      data: { identity_token: state.identityToken },
      redirectOnUnauthorized: false
    }).then(function (result) {
    if (result.status !== 1) return;
    state.articleLikeCount = Number(result.data?.articleLikeCount) || 0;
    state.commentLikeCount = Number(result.data?.commentLikeCount) || 0;
    state.commentCount = Number(result.data?.commentCount) || 0;
    state.favorites = Array.isArray(result.data?.favorites) ? result.data.favorites : [];
    state.history = Array.isArray(result.data?.history) ? result.data.history : [];
    state.canEditNickname = result.data?.canEditNickname === true;
    if (result.data?.nickname) {
      state.nickname = result.data.nickname;
      state.nicknameDraft = state.nickname;
      state.avatarText = Array.from(state.nickname)[0] || '访';
      IDENTITY.setIdentity({ token: state.identityToken, nickname: state.nickname });
      return;
    }
    state.profileHint = '登录后即可评论、点赞与收藏文章';
    }).finally(function () {
      profileRequest = null;
      if (profileRefreshPending) {
        profileRefreshPending = false;
        queueMicrotask(function () { loadProfile('sse'); });
      }
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
    if (!nickname) return;
    const result = await REQUEST({ url: '/frontProfileSave', type: 'POST', data: { identity_token: state.identityToken, nickname }, redirectOnUnauthorized: false });
    if (result.status !== 1) return;
    state.nickname = result.data?.nickname || nickname;
    state.nicknameDraft = state.nickname;
    state.editingNickname = false;
    state.canEditNickname = false;
    IDENTITY.setIdentity({ token: state.identityToken, nickname: state.nickname, name: IDENTITY.getIdentity().name });
  }

  onMounted(loadProfile);
  // 获赞数/评论数/收藏与浏览历史随他人行为变化，信号到达时自动重放。
  autoSync(loadProfile);
  return { state, toBack, toFavorite, toSignin, editNickname, saveNickname };
});

export default profileController;
