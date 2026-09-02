import KniuMvvm from '../../core/kniumvvm.mjs';
import REQUEST from '../../core/kniurequest.mjs';
import AUTH from '../../core/kniuauth.mjs';
import IDENTITY from '../../core/kniuidentity.mjs';
import KniuUI from '../../core/kniuui.js';
import { optionsToValues } from '../../core/kniuutil.mjs';

const { controller, reactive, onMounted, onUnmounted } = KniuMvvm;

/**
 * 合并登录页：同一 #/login 承载「后台登录 + 前台登录/注册」。
 *
 * - 登录 tab：POST /logup 建后台会话（admin_token，校验验证码），成功后
 *   再 POST /frontBind 绑前台身份（front_token，不重复消费验证码）——
 *   一次登录前后台全通，杜绝「后台登录了前台仍当游客」的死循环。
 * - 注册 tab：POST /frontRegister 建 role=2 账号 + 前台会话，后端同时写
 *   admin_token，注册即进后台，无需二次登录。
 * - 落地：带 redirect(/detail+id | /profile | /about | /) 参数回跳来源页，
 *   否则进入工作台 /admin。
 */
const loginController = controller(({ navigateTo, getRouteData }) => {
  const routeData = getRouteData() || {};
  const state = reactive({
    tab: routeData.tab === 'register' ? 'register' : 'login',
    subtitle: routeData.tab === 'register'
      ? '注册后即可评论、收藏，并直接进入工作台'
      : '登录后可评论、收藏或进入工作台',
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
      gvcode: {
        value: '',
        condition: /^-?\d{1,4}$/,
        message: '请输入验证码计算结果'
      }
    }
  });
  let captchaObjectUrl = '';

  // redirect 参数只放行前台可回跳的页面；其余一律默认进工作台。
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
    await REQUEST({
      url: '/captcha',
      type: 'POST',
      dataType: 'blob',
      success(res) {
        if (res.status !== 1) {
          state.isCaptchaLoading = false;
          KniuUI.msg({ content: res.msg, type: 'error' });
          return;
        }
        if (captchaObjectUrl) URL.revokeObjectURL(captchaObjectUrl);
        captchaObjectUrl = URL.createObjectURL(res.data);
        state.captchaImageUrl = captchaObjectUrl;
        state.isCaptchaLoading = false;
      },
      fail(res) {
        state.isCaptchaLoading = false;
        KniuUI.msg({ content: res.msg, type: 'error' });
      }
    });
  }

  function toLogin() {
    if (state.tab === 'login') return;
    state.tab = 'login';
    state.subtitle = '登录后可评论、收藏或进入工作台';
    refreshCaptcha();
  }

  function toRegister() {
    if (state.tab === 'register') return;
    state.tab = 'register';
    state.subtitle = '注册后即可评论、收藏，并直接进入工作台';
    refreshCaptcha();
  }

  function submitFailed(model, res) {
    state.isSubmitting = false;
    model.gvcode.value = '';
    KniuUI.msg({ content: res.msg || '操作失败', type: 'error' });
    refreshCaptcha();
  }

  // 登录成功后补绑前台身份（frontBind 不消费验证码），打通前后台会话。
  async function bindFrontIdentity(username, password, fallbackName) {
    const bindRes = await REQUEST({
      url: '/frontBind',
      type: 'POST',
      data: {
        username: username,
        password: password,
        identity_token: IDENTITY.getIdentity().token
      },
      redirectOnUnauthorized: false
    });
    if (bindRes.status === 1) {
      IDENTITY.setIdentity({ nickname: bindRes.data?.nickname || fallbackName, account: 1 });
    }
  }

  async function onSubmit() {
    if (state.isSubmitting) return;
    // 校验已由 kniu-form 在 submit 阶段按对应 tab 模型的 condition 完成，不通过不会进到这里
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
    if (isRegister) data.confirm = form.confirm;

    const res = await REQUEST({
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
    // 前台身份：昵称/登录态、可评论收藏（注册接口本身已绑定，登录接口靠下方 frontBind）
    IDENTITY.setIdentity({ nickname: name, account: 1 });
    // 后台会话：登录接口由 /logup 建立，注册接口由后端一并写入 admin_token
    AUTH.setUser({
      name: name,
      avatar: info.avatar || name.charAt(0),
      role: info.role || (isRegister ? '2' : ''),
      roleId: Number(info.role_id || info.id || 0),
      roleAuth: Number(info.role_auth || 0)
    });
    if (!isRegister) {
      await bindFrontIdentity(form.username, form.password, name);
    }
    state.isSubmitting = false;
    KniuUI.msg({ content: isRegister ? '注册成功' : '登录成功', type: 'success' });
    finishAuth();
  }

  onMounted(() => {
    // 已有后台会话：直接按 redirect 回跳或进工作台（登录页不该出现）。
    if (AUTH.isLoggedIn()) {
      finishAuth();
      return;
    }
    // 仅前台已登录（访客下拉「管理后台」入口）：无 redirect 时展示后台登录表单；
    // 带 redirect 则无需再登录，直接回跳。
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
  });

  return { state, refreshCaptcha, onSubmit, toLogin, toRegister };
});

export default loginController;
