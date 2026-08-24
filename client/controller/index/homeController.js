import KniuMvvm from '../../core/kniumvvm.mjs';
import REQUEST from '../../core/kniurequest.mjs';

const { controller, onMounted, reactive } = KniuMvvm;

const homeController = controller(({ navigateTo }) => {
  const state = reactive({
    dailys: [],
    articles: [],
    today: '',
    photo: '',
    note: '',
    currentYear: new Date().getFullYear(),
    loading: true,
    error: ''
  });

  async function loadPage() {
    state.loading = true;
    state.error = '';
    const results = await REQUEST([
      { url: '/getDaily', type: 'POST', data: {}, redirectOnUnauthorized: false },
      { url: '/getArticle', type: 'POST', data: {}, redirectOnUnauthorized: false },
      { url: '/getInfo', type: 'POST', data: {}, redirectOnUnauthorized: false }
    ]);
    const daily = results[0];
    const article = results[1];
    const info = results[2];
    state.dailys = daily?.status === 1 && Array.isArray(daily.data)
      ? daily.data.filter(function (item) { return Number(item?.is_show) === 1; })
      : [];
    state.articles = article?.status === 1 && Array.isArray(article.data)
      ? article.data.filter(function (item) { return Number(item?.is_show) === 1; })
      : [];
    if (info?.status === 1 && info.data) {
      state.today = info.data.today ?? '';
      state.photo = info.data.photo || '';
      state.note = info.data.note || '';
    }
    const failed = results.find(function (result) { return result?.status !== 1; });
    state.error = failed?.msg || '';
    state.loading = false;
  }

  function toDetail(event) {
    const id = Number(event?.currentTarget?.dataset?.articleId);
    if (Number.isInteger(id) && id > 0) navigateTo('/detail', { id: id });
  }

  onMounted(loadPage);
  return { state, loadPage, toDetail };
});

export default homeController;