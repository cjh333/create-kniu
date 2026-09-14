import MVVM from '../../core/kniumvvm.mjs';
import REQUEST from '../../core/kniurequest.mjs';
import IDENTITY from '../../core/kniuidentity.mjs';

const { controller, reactive, onMounted } = MVVM;

const aboutController = controller(({ autoSync }) => {
  const state = reactive({ content: '', loading: true, currentYear: new Date().getFullYear() });

  // reason 为字符串时表示由数据变更信号自动重放：静默刷新，不闪 loading。
  async function loadAbout(reason) {
    if (typeof reason !== 'string') state.loading = true;
    const result = await REQUEST({
      url: '/getAbout',
      type: 'POST',
      data: { identity_token: IDENTITY.getIdentity().token },
      redirectOnUnauthorized: false
    });
    state.content = result?.status === 1 ? String(result.data?.content || '') : '';
    state.loading = false;
  }

  onMounted(loadAbout);
  // 后台维护「关于我」后，在线前台自动重放。
  autoSync(loadAbout);
  return { state, loadAbout };
});

export default aboutController;
