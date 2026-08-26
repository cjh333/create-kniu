import KniuMvvm from '../../core/kniumvvm.mjs';
import REQUEST from '../../core/kniurequest.mjs';

const { controller, onMounted, reactive } = KniuMvvm;

const detailController = controller(({ navigateTo, getRouteData }) => {
  const state = reactive({
    title: '',
    content: '',
    loading: true,
    error: '',
    currentYear: new Date().getFullYear()
  });

  async function loadDetail() {
    const id = Number(getRouteData()?.id);
    if (!Number.isInteger(id) || id <= 0) {
      state.error = '文章参数无效';
      state.loading = false;
      return;
    }
    const result = await REQUEST({
      url: '/getDetail',
      type: 'POST',
      data: { id },
      redirectOnUnauthorized: false
    });
    if (result.status !== 1 || !result.data) {
      state.error = result.msg || '文章加载失败';
      state.loading = false;
      return;
    }
    state.title = result.data.title || '';
    state.content = result.data.content || '';
    state.loading = false;
  }

  function toBack() {
    navigateTo('/');
  }

  onMounted(loadDetail);
  return { state, loadDetail, toBack };
});

export default detailController;