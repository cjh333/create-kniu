import KniuMvvm from '../../core/kniumvvm.mjs';
import REQUEST from '../../core/kniurequest.mjs';
import AUTH from '../../core/kniuauth.mjs';

const { controller, reactive, onMounted, onUnmounted } = KniuMvvm;

const loginController = controller(({ navigateTo }) => {
    const state = reactive({
      captchaImageUrl: '',
      isCaptchaLoading: true,
      isSubmitting: false,
      loginform: {
        username: '',
        password: '',
        gvcode: ''
      },
      rules: {
        username: {
          condition: /^(?=.*\S).+$/,
          message: '请输入用户名'
        },
        password: {
          condition: /^(?=.*\S).+$/,
          message: '请输入密码'
        },
        gvcode: {
          condition: function (v) {
            return /^(?=.*\S).+/.test(v.value) && v.value.length <= 4;
          },
          message: '请输入验证码'
        }
      }
    });
    let captchaObjectUrl = '';

    async function refreshCaptcha() {
      state.isCaptchaLoading = true;
      await REQUEST({
        url: '/captcha',
        type: 'POST',
        dataType: 'blob',
        success(res) {
          if (res.status !== 1) {
            state.isCaptchaLoading = false;
            this.$msg({ content: res.msg, type: 'error' });
            return;
          }
          if (captchaObjectUrl) URL.revokeObjectURL(captchaObjectUrl);
          captchaObjectUrl = URL.createObjectURL(res.data);
          state.captchaImageUrl = captchaObjectUrl;
          state.isCaptchaLoading = false;
        },
        fail(res) {
          state.isCaptchaLoading = false;
          this.$msg({ content: res.msg, type: 'error' });
        }
      });
    }

    async function onSubmit() {
      if (state.isSubmitting) {
        return;
      }
      state.isSubmitting = true;

      await REQUEST({
        url: '/logup',
        type: 'POST',
        data: {
          username: state.loginform.username,
          password: state.loginform.password,
          gvcode: state.loginform.gvcode
        },
        success(res) {
          if (res.status === 1) {
            const user = res.data || {};
            const userName = user.username || user.name || state.loginform.username;
            AUTH.setUser({ name: userName, avatar: user.avatar || userName.charAt(0), role: user.role });
            navigateTo('/admin');
            return;
          }
          state.isSubmitting = false;
          state.loginform.gvcode = '';
          this.$msg({ content: res.msg, type: 'error' });
          refreshCaptcha();
        },
        fail(res) {
          state.isSubmitting = false;
          this.$msg({ content: res.msg, type: 'error' });
        }
      });
    }

    onMounted(() => {
      refreshCaptcha();
    });

    onUnmounted(() => {
      captchaObjectUrl && URL.revokeObjectURL(captchaObjectUrl);
      captchaObjectUrl = '';
    });

    return { state, refreshCaptcha, onSubmit };
});

export default loginController;
