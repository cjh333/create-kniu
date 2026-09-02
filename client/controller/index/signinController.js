import KniuMvvm from '../../core/kniumvvm.mjs';
import REQUEST from '../../core/kniurequest.mjs';
import IDENTITY from '../../core/kniuidentity.mjs';
import { optionsToValues } from '../../core/kniuutil.mjs';

const { controller, reactive, onMounted, onUnmounted } = KniuMvvm;

const signinController = controller(({ navigateTo, getRouteData }) => {
  const routeData = getRouteData() || {};
  const state = reactive({
    tab: routeData.tab === 'register' ? 'register' : 'login',
    subtitle: routeData.tab === 'register' ? '注册账号后即可发表评论与收藏文章' : '登录后可发表评论、点赞与收藏',
    captchaImageUrl: '',
    isSubmitting: false,
    // kniu-form 的全部配置：labelPosition / labelWidth 是表单级保留键，
    // 其余每个键是一个字段——带 condition 即需验证，value 为默认值。
    loginModel: {
      labelPosition: 'top',
      labelWidth: 'auto',
      username: {
        value: '',
        condition: /^[\u4e00-\u9fa5A-Za-z0-9_-]{2,30}$/,
        message: '请输入2-30位账号'
      },
      password: {
        value: '',
        condition: /^\S{6,20}$/,
        message: '请输入6-20位密码'
      },
      gvcode: {
        value: '',
        condition: /^-?\d{1,4}$/,
        message: '请输入验证码计算结果'
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
      gvcode: {
        value: '',
        condition: /^-?\d{1,4}$/,
        message: '请输入验证码计算结果'
      }
    }
  });
  let captchaObjectUrl = '';

  async function refreshCaptcha() {
    await REQUEST({
      url: '/captcha',
      type: 'POST',
      dataType: 'blob',
      success(res) {
        if (res.status !== 1) {
          this.$msg({ content: res.msg, type: 'error' });
          return;
        }
        if (captchaObjectUrl) URL.revokeObjectURL(captchaObjectUrl);
        captchaObjectUrl = URL.createObjectURL(res.data);
        state.captchaImageUrl = captchaObjectUrl;
      },
      fail(res) {
        this.$msg({ content: res.msg, type: 'error' });
      }
    });
  }

  function toLogin() {
    if (state.tab === 'login') return;
    state.tab = 'login';
    state.subtitle = '登录后可发表评论、点赞与收藏';
    refreshCaptcha();
  }

  function toRegister() {
    if (state.tab === 'register') return;
    state.tab = 'register';
    state.subtitle = '注册账号后即可发表评论与收藏文章';
    refreshCaptcha();
  }

  // 登录后回到来源页：评论被拦截时会带上 redirect=/detail 与文章 id。
  function goBackAfterSignin() {
    if (routeData.redirect === '/detail' && Number(routeData.id) > 0) {
      navigateTo('/detail', { id: Number(routeData.id) });
      return;
    }
    navigateTo('/');
  }

  async function onSubmit() {
    if (state.isSubmitting) return;
    // 校验已由 kniu-form 在 submit 阶段按对应模型的 condition 完成，不通过不会进到这里
    const isRegister = state.tab === 'register';
    const model = isRegister ? state.registerModel : state.loginModel;
    const form = optionsToValues(model);
    state.isSubmitting = true;

    await REQUEST({
      url: isRegister ? '/frontRegister' : '/frontLogin',
      type: 'POST',
      data: {
        username: form.username,
        password: form.password,
        confirm: isRegister ? form.confirm : '',
        gvcode: form.gvcode,
        identity_token: IDENTITY.getIdentity().token
      },
      success(res) {
        if (res.status !== 1) {
          state.isSubmitting = false;
          model.gvcode.value = '';
          this.$msg({ content: res.msg, type: 'error' });
          refreshCaptcha();
          return;
        }
        // account=1 标记本机注册过账号，之后被拦截的评论一律引导去登录而非注册
        IDENTITY.setIdentity({ nickname: res.data?.nickname || form.username, account: 1 });
        this.$msg({ content: isRegister ? '注册成功' : '登录成功', type: 'success' });
        goBackAfterSignin();
      },
      fail(res) {
        state.isSubmitting = false;
        this.$msg({ content: res.msg, type: 'error' });
      }
    });
  }

  onMounted(() => {
    if (IDENTITY.getIdentity().nickname) {
      goBackAfterSignin();
      return;
    }
    refreshCaptcha();
  });

  onUnmounted(() => {
    captchaObjectUrl && URL.revokeObjectURL(captchaObjectUrl);
    captchaObjectUrl = '';
  });

  return { state, refreshCaptcha, onSubmit, toLogin, toRegister };
});

export default signinController;
