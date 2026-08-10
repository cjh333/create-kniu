import { AUTH } from '../core/kniuauth.mjs';
import { defineComponent, reactive, onMounted, onUnmounted, toRefs } from '../core/kniumvvm.mjs';
import { REQUEST } from '../core/kniurequest.mjs';

export const loginController = defineComponent({
  setup({ eventTo, navigateTo, root }) {
    const state = reactive({
      username: '',
      password: '',
      verificationCode: '',
      captchaImageUrl: '',
      isCaptchaLoading: true,
      isSubmitting: false,
      error: '',
      showError: false
    });
    let captchaObjectUrl = '';

    async function refreshCaptcha() {
      state.isCaptchaLoading = true;
      const result = await REQUEST({ url: '/captcha', type: 'POST', dataType: 'blob' });
      if (result.status !== 1) {
        state.isCaptchaLoading = false;
        state.error = result.msg;
        state.showError = true;
        eventTo?.emit('toast', result.msg);
        return;
      }
      if (captchaObjectUrl) URL.revokeObjectURL(captchaObjectUrl);
      captchaObjectUrl = URL.createObjectURL(result.data);
      state.captchaImageUrl = captchaObjectUrl;
      state.isCaptchaLoading = false;
    }

    async function onSubmit() {
      if (state.isSubmitting) {
        return;
      }
      state.isSubmitting = true;
      state.showError = false;

      const result = await REQUEST({
        url: '/logup',
        type: 'POST',
        data: {
          name: state.username,
          password: state.password,
          gvcode: state.verificationCode
        }
      });
      if (result.status === 1) {
        const user = result.data || {};
        const userName = user.name || state.username;
        AUTH.setUser({
          name: userName,
          avatar: user.avatar || userName.charAt(0),
          role: user.role
        });
        navigateTo('/');
        return;
      }

      state.isSubmitting = false;
      state.verificationCode = '';
      state.error = result.msg;
      state.showError = true;
      eventTo?.emit('toast', result.msg);
      await refreshCaptcha();
    }

    onMounted(() => {
      refreshCaptcha();
      kniu.form({ el: root.querySelector('#loginform') });
    });

    onUnmounted(() => {
      captchaObjectUrl && URL.revokeObjectURL(captchaObjectUrl);
      captchaObjectUrl = '';
    });

    toRefs({ state, refreshCaptcha, onSubmit });
  }
});
