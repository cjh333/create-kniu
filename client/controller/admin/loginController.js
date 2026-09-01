import KniuMvvm from '../../core/kniumvvm.mjs';
import REQUEST from '../../core/kniurequest.mjs';
import AUTH from '../../core/kniuauth.mjs';
import { optionsToValues } from '../../core/kniuutil.mjs';

const { controller, reactive, onMounted, onUnmounted } = KniuMvvm;

const loginController = controller(({ navigateTo }) => {
    const state = reactive({
      captchaImageUrl: '',
      isCaptchaLoading: true,
      isSubmitting: false,
      // kniu-form 的全部配置：labelPosition / labelWidth 是表单级保留键，
      // 其余每个键是一个字段——带 condition 即需验证，value 为默认值。
      loginModel: {
        labelPosition: 'top',
        labelWidth: 'auto',
        username: {
          value: '',
          condition: /^(?=.*\S).+$/,
          message: '请输入用户名'
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
      // 校验已由 kniu-form 在 submit 阶段按 loginModel 的 condition 完成，不通过不会进到这里
      const form = optionsToValues(state.loginModel);
      state.isSubmitting = true;

      await REQUEST({
        url: '/logup',
        type: 'POST',
        data: {
          username: form.username,
          password: form.password,
          gvcode: form.gvcode
        },
        success(res) {
          if (res.status === 1) {
            const user = res.data || {};
            const userName = user.username || user.name || form.username;
            AUTH.setUser({
              name: userName,
              avatar: user.avatar || userName.charAt(0),
              role: user.role,
              roleAuth: Number(user.role_auth || 0)
            });
            navigateTo('/admin');
            return;
          }
          state.isSubmitting = false;
          state.loginModel.gvcode.value = '';
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