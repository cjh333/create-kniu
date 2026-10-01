import MVVM from '../../core/kniumvvm.mjs';
import IDENTITY from '../../core/kniuidentity.mjs';
import { debounce, getTransientSearchKeyword, setTransientSearchKeyword } from '../../core/kniuutil.mjs';

const { controller } = MVVM;

const homeController = controller(({ eventTo, navigateTo, request, reactive, onMounted }) => {
  const initialKeyword = getTransientSearchKeyword();
  const state = reactive({
    dailys: [],
    articles: [],
    allArticles: [],
    keyword: initialKeyword,
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

  function applyArticleSearch() {
    const keyword = String(state.keyword || '').trim().toLocaleLowerCase();
    state.articles = !keyword
      ? state.allArticles.slice()
      : state.allArticles.filter(function (article) {
        return String(article?.title || '').toLocaleLowerCase().includes(keyword);
      });
  }

  function searchList() {
    setTransientSearchKeyword(state.keyword);
    applyArticleSearch();
    eventTo?.emit('home:search', { keyword: getTransientSearchKeyword() });
  }

  const debouncedSearch = debounce(searchList, 250);

  async function loadPage() {
    if (pageRequest) return pageRequest;
    state.loading = true;
    state.error = '';
    const run = request([
      { url: '/getDaily', type: 'POST', mutation: false, data: {}, redirectOnUnauthorized: false },
      { url: '/getArticle', type: 'POST', mutation: false, data: {}, redirectOnUnauthorized: false },
      { url: '/getInfo', type: 'POST', mutation: false, data: { identity_token: IDENTITY.getIdentity().token }, redirectOnUnauthorized: false }
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
    });
    pageRequest = run;
    return run;
  }

  function toDetail(event) {
    const id = Number(event?.currentTarget?.dataset?.articleId);
    if (Number.isInteger(id) && id > 0) navigateTo('/detail', { id: id });
  }

  onMounted(function () {
    const syncLogin = function (identity) { state.loggedIn = Boolean(identity?.nickname); };
    const syncSearch = function (payload) {
      state.keyword = setTransientSearchKeyword(payload?.keyword);
      applyArticleSearch();
    };
    const stopIdentity = IDENTITY.subscribe(syncLogin);
    const stopSearch = eventTo?.on('home:search', syncSearch);
    loadPage();
    return function () {
      stopIdentity();
      stopSearch?.();
    };
  });
  return { state, loadPage, toDetail, searchList, debouncedSearch };
});

export default homeController;
