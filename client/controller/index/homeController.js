import MVVM from '../../core/kniumvvm.mjs';
import REQUEST from '../../core/kniurequest.mjs';
import IDENTITY from '../../core/kniuidentity.mjs';
import { debounce } from '../../core/kniuutil.mjs';

const { controller, onMounted, reactive } = MVVM;

const homeController = controller(({ navigateTo, getRouteData, autoSync }) => {
  const state = reactive({
    dailys: [],
    articles: [],
    allArticles: [],
    keyword: String(getRouteData()?.keyword || ''),
    today: '',
    photo: '',
    note: '',
    loggedIn: Boolean(IDENTITY.getIdentity().nickname),
    currentYear: new Date().getFullYear(),
    loading: true,
    error: '',
    advertises: [
      {
        id: 1,
        title: '百度',
        img: 'https://www.baidu.com/img/PCtm_d9c8750bed0b3c7d089fa7d55720d6cf.png',
        url: 'https://www.baidu.com'
      },
      {
        id: 2,
        title: '淘宝',
        img: 'https://img.alicdn.com/imgextra/i1/O1CN011YZ3P01zMCE6HGyhk_!!6000000006699-2-tps-480-144.png',
        url: 'https://www.taobao.com'
      }
    ]
  });

  let pageRequest = null;
  let pageRefreshPending = false;

  function applyArticleSearch() {
    const keyword = String(state.keyword || '').trim().toLocaleLowerCase();
    state.articles = !keyword
      ? state.allArticles.slice()
      : state.allArticles.filter(function (article) {
        return String(article?.title || '').toLocaleLowerCase().includes(keyword);
      });
  }

  function searchList() {
    applyArticleSearch();
  }

  const debouncedSearch = debounce(searchList, 250);

  async function loadPage(reason) {
    if (pageRequest) {
      // 初始加载尚未完成时收到 data-change，只记录一次待刷新，
      // 避免自动同步在请求结束边界再次发起同一组接口。
      if (typeof reason === 'string') pageRefreshPending = true;
      return pageRequest;
    }
    const silent = typeof reason === 'string';
    if (!silent) {
      state.loading = true;
      state.error = '';
    }
    const run = REQUEST([
      { url: '/getDaily', type: 'POST', data: {}, redirectOnUnauthorized: false },
      { url: '/getArticle', type: 'POST', data: {}, redirectOnUnauthorized: false },
      { url: '/getInfo', type: 'POST', data: { identity_token: IDENTITY.getIdentity().token }, redirectOnUnauthorized: false }
    ]).then(function (results) {
      const daily = results[0];
      const article = results[1];
      const info = results[2];
      state.dailys = daily?.status === 1 && Array.isArray(daily.data) ? daily.data.filter(function (item) { return Number(item?.is_show) === 1; }) : [];
      state.allArticles = article?.status === 1 && Array.isArray(article.data)
        ? article.data.filter(function (item) { return Number(item?.is_show) === 1; })
        : [];
      applyArticleSearch();
      if (info?.status === 1 && info.data) {
        state.today = info.data.today ?? '';
        state.photo = info.data.photo || '';
        state.note = info.data.note || '';
        state.loggedIn = Boolean(IDENTITY.getIdentity().nickname);
      }
      const failed = results.find(function (result) { return result?.status !== 1; });
      state.error = failed?.msg || '';
      state.loading = false;
    }).finally(function () {
      pageRequest = null;
      if (pageRefreshPending) {
        pageRefreshPending = false;
        queueMicrotask(function () { loadPage('sse'); });
      }
    });
    pageRequest = run;
    return run;
  }

  function toDetail(event) {
    const id = Number(event?.currentTarget?.dataset?.articleId);
    if (Number.isInteger(id) && id > 0) navigateTo('/detail', { id: id });
  }

  onMounted(function () {
    const syncLogin = function () { state.loggedIn = Boolean(IDENTITY.getIdentity().nickname); };
    const syncSearch = function (event) {
      state.keyword = String(event?.detail?.keyword || '');
      applyArticleSearch();
    };
    globalThis.addEventListener('kniu-identity-change', syncLogin);
    globalThis.addEventListener('kniu-home-search', syncSearch);
    loadPage();
    return function () {
      globalThis.removeEventListener('kniu-identity-change', syncLogin);
      globalThis.removeEventListener('kniu-home-search', syncSearch);
    };
  });
  autoSync(loadPage);
  return { state, loadPage, toDetail, searchList, debouncedSearch };
});

export default homeController;
