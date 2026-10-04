import MVVM from '../../core/kniumvvm.mjs';
import AUTH from '../../core/kniuauth.mjs';
import IDENTITY from '../../core/kniuidentity.mjs';
import UI from '../../core/kniuui/kniuui.js';
import { optionsToValues } from '../../core/kniuutil.mjs';

const { controller } = MVVM;

const loginController = controller(({ navigateTo, getRouteData, request, reactive, onMounted, onUnmounted }) => {
  const routeData = getRouteData() || {};
  const routePath = String(globalThis.location?.hash || '').replace(/^#/, '').split('?')[0];
  const state = reactive({
    tab: routePath === '/register' || routeData.tab === 'register' ? 'register' : (routeData.tab === 'reset' ? 'reset' : 'login'),
    subtitle: routePath === '/register' || routeData.tab === 'register'
      ? '注册后即可评论、收藏，并直接进入工作台'
      : (routeData.tab === 'reset'
        ? '通过邮箱验证码重置密码，无需原密码'
        : '简单好用的工作台'),
    captchaImageUrl: '',
    isCaptchaLoading: true,
    isSubmitting: false,
    loginModel: {
      labelPosition: 'top',
      labelWidth: 'auto',
      username: {
        value: '',
        condition: /^(?=.*\S).+$/,
        message: '请输入账号'
      },
      password: {
        value: '',
        condition: /^(?=.*\S).+$/,
        message: '请输入密码'
      },
      gvcode: {
        value: '',
        condition: function (v) {
          return /^(?=.*\S).+/.test(v.value) && v.value.length <= 4;
        },
        message: '请输入验证码'
      }
    },
    registerModel: {
      labelPosition: 'top',
      labelWidth: 'auto',
      username: {
        value: '',
        condition: /^[\u4e00-\u9fa5A-Za-z0-9_-]{2,30}$/,
        message: '账号为2-30位中文、字母、数字、下划线或短横线'
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
    codeCountdown: 0,
    codeSending: false,
    resetModel: {
      labelPosition: 'top',
      labelWidth: 'auto',
      username: {
        value: '',
        condition: /^[\u4e00-\u9fa5A-Za-z0-9_-]{2,30}$/,
        message: '请输入注册时的账号'
      },
      email: {
        value: '',
        condition: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        message: '请输入有效的邮箱地址'
      },
      code: {
        value: '',
        condition: /^\d{6}$/,
        message: '请输入6位邮箱验证码'
      },
      password: {
        value: '',
        condition: function (v) {
          const password = String(v.value || '');
          if (!state.isAddDialog && password === '') return true;
          return /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,./?])[^<>]{8,}$/.test(password);
        },
        message: '密码为8位以上，含大小写字母、数字和特殊字符'
      },
      confirm: {
        value: '',
        condition: function (v) { return v.value === v.password; },
        message: '两次输入的密码不一致'
      }
    }
  });
  let captchaObjectUrl = '';
  let codeTimer = null;

  function redirectTarget() {
    const redirect = String(routeData?.redirect || '').replace(/^#/, '');
    const id = Number(routeData?.id || 0);
    if (redirect === '/detail' && id > 0) return { path: '/detail', id: id };
    if (redirect === '/profile' || redirect === '/about' || redirect === '/') return { path: redirect };
    return null;
  }

  function finishAuth() {
    const target = redirectTarget();
    if (target) {
      if (target.id) navigateTo(target.path, { id: target.id });
      else navigateTo(target.path);
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
    navigateTo('/login');
  }

  function toRegister() {
    navigateTo('/register');
  }

  function toReset() {
    state.tab = 'reset';
    state.subtitle = '通过邮箱验证码重置密码，无需原密码';
  }

  // 返回前台首页：与页脚「返回首页」同一去向，仅把入口提到主按钮行。
  function toHome() {
    navigateTo('/');
  }

  function clearCodeTimer() {
    if (codeTimer) { clearInterval(codeTimer); codeTimer = null; }
  }

  function startCodeCountdown(seconds) {
    clearCodeTimer();
    state.codeCountdown = Math.max(1, Number(seconds) || 60);
    codeTimer = setInterval(() => {
      state.codeCountdown -= 1;
      if (state.codeCountdown <= 0) {
        clearCodeTimer();
        state.codeCountdown = 0;
      }
    }, 1000);
  }

  function quickValidateEmail(model) {
    const email = String(model.email.value || '').trim();
    if (email === '') {
      UI.msg({ content: '请输入邮箱', type: 'error' });
      return '';
    }
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      UI.msg({ content: '邮箱格式不正确', type: 'error' });
      return '';
    }
    return email;
  }

  async function sendEmailCode(scene, model) {
    if (state.codeSending || state.codeCountdown > 0) return;
    const email = quickValidateEmail(model);
    if (email === '') return;
    state.codeSending = true;
    const res = await request({
      url: '/email_code',
      type: 'POST',
      data: { email: email, scene: scene },
      redirectOnUnauthorized: false
    });
    state.codeSending = false;
    if (res.status !== 1) {
      UI.msg({ content: res.msg || '验证码发送失败', type: 'error' });
      return;
    }
    const devMode = !!(res.data && res.data.dev);
    UI.msg({
      content: res.msg || (devMode ? '验证码已生成，但邮件未实际发送' : '验证码已发送，请查收邮箱'),
      type: devMode ? 'warning' : 'success'
    });
    startCodeCountdown((res.data && res.data.interval) ? res.data.interval : 60);
  }

  function sendRegisterCode() {
    sendEmailCode('register', state.registerModel);
  }

  function sendResetCode() {
    sendEmailCode('reset', state.resetModel);
  }

  async function onResetSubmit() {
    if (state.isSubmitting) return;
    const form = optionsToValues(state.resetModel);
    state.isSubmitting = true;
    const res = await request({
      url: '/password_reset',
      type: 'POST',
      data: {
        username: form.username,
        email: form.email,
        code: form.code,
        password: form.password,
        confirm: form.confirm
      },
      redirectOnUnauthorized: false
    });
    state.isSubmitting = false;
    if (res.status !== 1) {
      UI.msg({ content: res.msg || '密码重置失败', type: 'error' });
      return;
    }
    UI.msg({ content: res.msg || '密码重置成功，请使用新密码登录', type: 'success' });
    state.resetModel.username.value = '';
    state.resetModel.email.value = '';
    state.resetModel.code.value = '';
    state.resetModel.password.value = '';
    state.resetModel.confirm.value = '';
    toLogin();
  }

  function submitFailed(model, res) {
    state.isSubmitting = false;
    model.gvcode.value = '';
    UI.msg({ content: res.msg || '操作失败', type: 'error' });
    refreshCaptcha();
  }

  async function onSubmit() {
    if (state.isSubmitting) return;
    const isRegister = state.tab === 'register';
    const model = isRegister ? state.registerModel : state.loginModel;
    const form = optionsToValues(model);
    state.isSubmitting = true;

    const data = {
      username: form.username,
      password: form.password,
      gvcode: form.gvcode,
      identity_token: IDENTITY.getIdentity().token
    };
    if (isRegister) {
      data.confirm = form.confirm;
      data.email = form.email;
      data.email_code = form.email_code;
    }

    const res = await request({
      url: isRegister ? '/frontRegister' : '/logup',
      type: 'POST',
      data: data,
      redirectOnUnauthorized: false
    });
    if (res.status !== 1) {
      submitFailed(model, res);
      return;
    }

    const info = res.data || {};
    const name = info.nickname || info.name || form.username;
    IDENTITY.setIdentity({ nickname: name, account: 1 });
    AUTH.setUser({
      name: name,
      avatar: info.avatar || name.charAt(0),
      role: info.role || (isRegister ? '2' : ''),
      roleId: Number(info.role || (isRegister ? 2 : 0)),
      userId: Number(info.role_id || info.id || 0),
      roleAuth: Number(info.role_auth || 0)
    });
    state.isSubmitting = false;
    UI.msg({ content: isRegister ? '注册成功' : '登录成功', type: 'success' });
    finishAuth();
  }

  onMounted(() => {
    if (AUTH.isLoggedIn()) {
      finishAuth();
      return;
    }
    if (IDENTITY.getIdentity().nickname) {
      if (redirectTarget()) {
        finishAuth();
        return;
      }
    }
    refreshCaptcha();
  });

  onUnmounted(() => {
    captchaObjectUrl && URL.revokeObjectURL(captchaObjectUrl);
    captchaObjectUrl = '';
    clearCodeTimer();
  });

  return { state, refreshCaptcha, onSubmit, toLogin, toRegister, toReset, toHome, onResetSubmit, sendRegisterCode, sendResetCode };
});

export default loginController;
