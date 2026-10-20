import MVVM from '../../core/kniumvvm.mjs';
import AUTH from '../../core/kniuauth.mjs';
import IDENTITY from '../../core/kniuidentity.mjs';
import UI from '../../core/kniuui/kniuui.mjs';
import { withSubmitting, buildRedirectTarget, toBackRoute, sendEmailCode, clearCodeTimer } from './adminShared.js';
import { optionsToValues } from '../../core/kniuutil.mjs';

const { controller } = MVVM;

const registerController = controller(({ navigateTo, getRouteData, request, reactive, onMounted, onUnmounted }) => {
  const state = reactive({
    subtitle: '注册后即可评论、收藏，并直接进入工作台',
    captchaImageUrl: '',
    isCaptchaLoading: true,
    isSubmitting: false,
    codeCountdown: 0,
    codeSending: false,
    registerModel: {
      labelPosition: 'top',
      labelWidth: 'auto',
      username: {
        value: '',
        condition: /^[\u4e00-\u9fa5A-Za-z0-9_-]{2,30}$/,
        message: '账号为2-30位中文、字母、数字、下划线或短横线'
      },
      nickname: {
        value: '',
        condition: /^[\u4e00-\u9fa5A-Za-z0-9_\- ]{1,30}$/,
        message: '昵称为1-30位中文、字母、数字、下划线、短横线或空格'
      },
      password: {
        value: '',
        condition: /^\S{6,20}$/,
        message: '密码为6-20位非空白字符'
      },
      confirm: {
        value: '',
        condition: function (v) { return v.value === v.password; },
        message: '两次输入的密码不一致'
      },
      email: {
        value: '',
        condition: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        message: '请输入有效的邮箱地址'
      },
      email_code: {
        value: '',
        condition: /^\d{6}$/,
        message: '请输入6位邮箱验证码'
      },
      gvcode: {
        value: '',
        condition: /^-?\d{1,4}$/,
        message: '请输入验证码计算结果'
      }
    },
    currentYear: new Date().getFullYear()
  });
  let captchaObjectUrl = '';
  const codeHolder = { codeTimer: null };

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

  function toLogin() {
    navigateTo('/login', getRouteData() || {});
  }

  function toBack() {
    toBackRoute(navigateTo);
  }

  function sendRegisterCode() {
    sendEmailCode('register', state.registerModel, state, codeHolder, request);
  }

  function submitFailed(model, res) {
    model.gvcode.value = '';
    UI.msg({ content: res.msg || '操作失败', type: 'error' });
    refreshCaptcha();
  }

  async function onSubmit() {
    await withSubmitting(state, async () => {
      const form = optionsToValues(state.registerModel);
      const res = await request({
        url: '/frontRegister',
        type: 'POST',
        data: {
          username: form.username,
          password: form.password,
          confirm: form.confirm,
          nickname: String(form.nickname || '').trim(),
          email: form.email,
          email_code: form.email_code,
          gvcode: form.gvcode,
          identity_token: IDENTITY.getIdentity().token
        },
        redirectOnUnauthorized: false
      });
      if (res.status !== 1) {
        submitFailed(state.registerModel, res);
        return;
      }
      UI.msg({ content: '注册成功，请登录', type: 'success' });
      // 注册成功后跳登录页（不自动登录），保留来源以便登录后回流。
      navigateTo('/login', getRouteData() || {});
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
    clearCodeTimer(codeHolder);
  });

  return { state, refreshCaptcha, onSubmit, toLogin, toBack, sendRegisterCode };
});

export default registerController;