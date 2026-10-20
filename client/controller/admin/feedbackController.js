import MVVM from '../../core/kniumvvm.mjs';
import UI from '../../core/kniuui/kniuui.mjs';
import AUTH from '../../core/kniuauth.mjs';
import { createRequestActions } from '../../core/kniupage.mjs';
import { adminTableMaxHeight, createSortUpdateHandler, requireLogin } from './adminShared.js';

const { controller } = MVVM;
const { usePage } = UI;

const feedbackController = controller(({ $confirm, $msg, navigateTo, request, reactive, onMounted }) => {
  const self = { $confirm, $msg, navigateTo };
  const actions = createRequestActions({ request, msg: $msg });
  const state = reactive({
    list: [],
    loading: true,
    error: '',
    keyword: '',
    feedbackDetail: {
      show: false,
      id: 0,
      nickname: '',
      title: '',
      content: '',
      imageList: [],
      create_time: '',
      result: ''
    }
  });

  const { loadList, searchList, debouncedSearch } = usePage({
    state,
    self,
    url: '/feedback_list',
    field: 'sid',
    sort: 'asc',
    params: () => ({ keyword: state.keyword }),
    tableKey: 'feedbackTable',
    table: { maxHeight: adminTableMaxHeight() },
    pageKey: 'feedbackPage'
  });

  function openFeedback(index, list) {
    const row = list && list[index];
    if (!row) return;
    state.feedbackDetail.show = true;
    state.feedbackDetail.id = Number(row.id) || 0;
    state.feedbackDetail.nickname = row.nickname || '';
    state.feedbackDetail.title = row.title || '';
    state.feedbackDetail.content = row.content || '';
    state.feedbackDetail.imageList = Array.isArray(row.imageList) ? row.imageList : [];
    state.feedbackDetail.create_time = row.create_time || '';
    state.feedbackDetail.result = row.result || '';
  }

  function closeFeedbackDialog() {
    state.feedbackDetail.show = false;
  }

  function goBack() {
    self.navigateTo('/admin');
  }

  const updateSort = createSortUpdateHandler({
    actions,
    url: '/feedback_update',
    reload: () => loadList(state.currentPage, { silent: true })
  });

  async function saveFeedbackResult() {
    const detail = state.feedbackDetail;
    if (detail.id <= 0) return;
    const result = String(detail.result || '').trim();
    if (!result) {
      $msg({ content: '请输入反馈结果', type: 'error' });
      return;
    }
    await actions.post('/feedback_result', { id: detail.id, result }, {
      onOk() {
        const row = state.list.find(function (item) { return Number(item.id) === detail.id; });
        if (row) {
          row.result = result;
          row.status_text = result !== '' ? '已回复' : '待回复';
          row.status_type = result !== '' ? 'success' : 'warning';
        }
        closeFeedbackDialog();
      }
    });
  }

  onMounted(function () {
    if (!requireLogin(AUTH, { $msg, navigateTo })) return;
    loadList(1);
  });
  return { state, searchList, debouncedSearch, openFeedback, closeFeedbackDialog, saveFeedbackResult, updateSort, goBack };
});

export default feedbackController;