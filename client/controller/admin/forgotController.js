import MVVM from '../../core/kniumvvm.mjs';
import UI from '../../core/kniuui/kniuui.mjs';
import { withSubmitting, sendEmailCode, clearCodeTimer } from './adminShared.js';
import { optionsToValues } from '../../core/kniuutil.mjs';

const { controller } = MVVM;

const forgotController = controller(({ navigateTo, getRouteData, request, reactive, onMounted, onUnmounted }) => {
  const state = reactive({
    subtitle: '通过邮箱验证码重置密码，无需原密码',
    isSubmitting: false,
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
          return /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,./?])[^<>]{8,}$/.test(String(v.value || ''));
        },
        message: '密码为8位以上，含大小写字母、数字和特殊字符'
      },
      confirm: {
        value: '',
        condition: function (v) { return v.value === v.password; },
        message: '两次输入的密码不一致'
      }
    },
    currentYear: new Date().getFullYear()
  });
  const codeHolder = { codeTimer: null };

  function toLogin() {
    navigateTo('/login', getRouteData() || {});
  }

  function sendResetCode() {
    sendEmailCode('reset', state.resetModel, state, codeHolder, request);
  }

  async function onResetSubmit() {
    await withSubmitting(state, async () => {
      const form = optionsToValues(state.resetModel);
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
    });
  }

  onMounted(() => {
    state.codeCountdown = 0;
  });

  onUnmounted(() => {
    clearCodeTimer(codeHolder);
  });

  return { state, onResetSubmit, toLogin, sendResetCode };
});

export default forgotController;