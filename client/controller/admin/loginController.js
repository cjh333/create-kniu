import MVVM from '../../core/kniumvvm.mjs';
import AUTH from '../../core/kniuauth.mjs';
import IDENTITY from '../../core/kniuidentity.mjs';
import UI from '../../core/kniuui/kniuui.mjs';
import { withSubmitting, buildRedirectTarget, toBackRoute } from './adminShared.js';
import { optionsToValues, required } from '../../core/kniuutil.mjs';

const { controller } = MVVM;

const loginController = controller(({ navigateTo, getRouteData, request, reactive, onMounted, onUnmounted }) => {
  const state = reactive({
    subtitle: '简单好用的工作台',
    captchaImageUrl: '',
    isCaptchaLoading: true,
    isSubmitting: false,
    loginModel: {
      labelPosition: 'top',
      labelWidth: 'auto',
      username: required('请输入账号'),
      password: required('请输入密码'),
      gvcode: {
        value: '',
        condition: function (v) {
          return /^(?=.*\S).+/.test(v.value) && v.value.length <= 4;
        },
        message: '请输入验证码'
      }
    },
    currentYear: new Date().getFullYear()
  });
  let captchaObjectUrl = '';

  function finishAuth() {
    const target = buildRedirectTarget(getRouteData);
    if (target) {
      navigateTo(target.path, target.data || null);
      return;
    }
    navigateTo('/admin');
  }

  async function refreshCaptcha() {
    state.isCaptchaLoading = true;
    await request({
      url: '/captcha',
      type: 'POST',
      mutation: false,
      redirectOnUnauthorized: false,
      dataType: 'blob',
      success(res) {
        if (res.status !== 1) {
          state.isCaptchaLoading = false;
          UI.msg({ content: res.msg, type: 'error' });
          return;
        }
        if (captchaObjectUrl) URL.revokeObjectURL(captchaObjectUrl);
        captchaObjectUrl = URL.createObjectURL(res.data);
        state.captchaImageUrl = captchaObjectUrl;
        state.isCaptchaLoading = false;
      },
      fail(res) {
        state.isCaptchaLoading = false;
        UI.msg({ content: res.msg, type: 'error' });
      }
    });
  }

  function toRegister() {
    navigateTo('/register', getRouteData() || {});
  }

  function toForgot() {
    navigateTo('/forgot', getRouteData() || {});
  }

  function toBack() {
    toBackRoute(navigateTo);
  }

  function submitFailed(model, res) {
    model.gvcode.value = '';
    UI.msg({ content: res.msg || '操作失败', type: 'error' });
    refreshCaptcha();
  }

  async function onSubmit() {
    await withSubmitting(state, async () => {
      const form = optionsToValues(state.loginModel);
      const res = await request({
        url: '/logup',
        type: 'POST',
        data: {
          username: form.username,
          password: form.password,
          gvcode: form.gvcode,
          identity_token: IDENTITY.getIdentity().token
        },
        redirectOnUnauthorized: false
      });
      if (res.status !== 1) {
        submitFailed(state.loginModel, res);
        return;
      }

      const info = res.data || {};
      const name = info.nickname || info.name || form.username;
      IDENTITY.setIdentity({ nickname: name, account: 1 });
      AUTH.setUser({
        name: name,
        avatar: info.avatar || name.charAt(0),
        role: info.role || '',
        roleId: Number(info.role_id || info.id || 0),
        roleAuth: Number(info.role_auth || 0)
      });
      UI.msg({ content: '登录成功', type: 'success' });
      finishAuth();
    });
  }

  onMounted(() => {
    if (AUTH.isLoggedIn()) {
      finishAuth();
      return;
    }
    if (IDENTITY.getIdentity().nickname) {
      if (buildRedirectTarget(getRouteData)) {
        finishAuth();
        return;
      }
    }
    refreshCaptcha();
  });

  onUnmounted(() => {
    captchaObjectUrl && URL.revokeObjectURL(captchaObjectUrl);
    captchaObjectUrl = '';
  });

  return { state, refreshCaptcha, onSubmit, toRegister, toForgot, toBack };
});

export default loginController;