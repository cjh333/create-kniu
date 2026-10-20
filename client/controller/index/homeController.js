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
    hotArticles: [],
    recommendArticles: [],
    keyword: initialKeyword,
    today: '',
    photo: '',
    note: '',
    loggedIn: Boolean(IDENTITY.getIdentity().nickname),
    currentYear: new Date().getFullYear(),
    pageMore: {
      text: '查看更多',
      noMore: '没有更多了',
      count: 10,
      block: true,
      loading: true,
      disabled: false,
      visible: false,
      onChange: null
    },
    error: '',
    advertises: [
      {
        id: 1,
        title: '百度',
        img: 'https://www.baidu.com/img/PCtm_d9c8750bed0b3c7d089fa7d55720d6cf.png',
        url: 'https://www.baidu.com',
        isShow: 0
      },
      {
        id: 2,
        title: '淘宝',
        img: 'https://img.alicdn.com/imgextra/i1/O1CN011YZ3P01zMCE6HGyhk_!!6000000006699-2-tps-480-144.png',
        url: 'https://www.taobao.com',
        isShow: 1
      }
    ]
  });

  let pageRequest = null;
  function updatePageMore(patch) {
    state.pageMore = Object.assign({}, state.pageMore, patch);
  }

  function pageMoreCount() {
    return Math.max(1, Number(state.pageMore.count));
  }

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
      { url: '/getArticle', type: 'POST', mutation: false, data: { page_current: 1, page_rows: pageMoreCount() }, redirectOnUnauthorized: false },
      { url: '/getHotArticles', type: 'POST', mutation: false, data: {}, redirectOnUnauthorized: false },
      { url: '/getRecommendArticles', type: 'POST', mutation: false, data: {}, redirectOnUnauthorized: false },
      { url: '/getInfo', type: 'POST', mutation: false, data: { identity_token: IDENTITY.getIdentity().token }, redirectOnUnauthorized: false }
    ]).then(function (results) {
      const daily = results[0];
      const article = results[1];
      const hot = results[2];
      const recommend = results[3];
      const info = results[4];
      state.dailys = daily?.status === 1 && Array.isArray(daily.data) ? daily.data.filter(function (item) { return Number(item?.is_show) === 1; }) : [];
      const articleRows = article?.status === 1
        ? (Array.isArray(article.data) ? article.data : (Array.isArray(article.data?.data) ? article.data.data : []))
        : [];
      state.allArticles = articleRows.filter(function (item) { return Number(item?.is_show) === 1; });
      state.hotArticles = hot?.status === 1 && Array.isArray(hot.data) ? hot.data : [];
      state.recommendArticles = recommend?.status === 1 && Array.isArray(recommend.data) ? recommend.data : [];
      const meta = article?.data && !Array.isArray(article.data) ? article.data : null;
      const total = Number(meta?.total ?? state.allArticles.length) || 0;
      updatePageMore({
        visible: total > pageMoreCount(),
        disabled: total <= pageMoreCount(),
        loading: false
      });
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

  async function loadMore() {
    if (state.pageMore.loading || state.pageMore.disabled) return;
    updatePageMore({ loading: true });
    const pageSize = pageMoreCount();
    const nextPage = Math.floor(state.allArticles.length / pageSize) + 1;
    try {
      const result = await request({
        url: '/getArticle',
        type: 'POST',
        mutation: false,
        data: {
          page_current: nextPage,
          page_rows: pageSize
        },
        redirectOnUnauthorized: false
      });
      if (result?.status !== 1) return;
      const payload = Array.isArray(result.data) ? { data: result.data, page_current: nextPage, page_total: nextPage } : (result.data || {});
      const rows = Array.isArray(payload.data) ? payload.data.filter(function (item) { return Number(item?.is_show) === 1; }) : [];
      state.allArticles = state.allArticles.concat(rows);
      applyArticleSearch();
      const noMore = rows.length === 0 || Number(payload.page_current || nextPage) >= Number(payload.page_total || nextPage);
      updatePageMore({ disabled: noMore, visible: true });
    } finally {
      updatePageMore({ loading: false });
    }
  }

  state.pageMore.onChange = loadMore;

  function toDetail(event) {
    const id = Number(event?.currentTarget?.__kniuOptionsValue?.articleId);
    if (Number.isInteger(id) && id > 0) navigateTo('/detail', { id: id });
  }

  function toAbout(event) {
    const roleId = Number(event?.currentTarget?.__kniuOptionsValue?.roleId);
    if (Number.isInteger(roleId) && roleId > 0) navigateTo('/about', { role_id: roleId });
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
  return { state, loadPage, loadMore, toDetail, toAbout, searchList, debouncedSearch };
});

export default homeController;