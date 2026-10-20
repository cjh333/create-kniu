import MVVM from '../../core/kniumvvm.mjs';
import UI from '../../core/kniuui/kniuui.mjs';
import AUTH from '../../core/kniuauth.mjs';
import { createRequestActions } from '../../core/kniupage.mjs';
import { adminTableMaxHeight, createSortUpdateHandler, isAdminRole, requireLogin } from './adminShared.js';

const { controller } = MVVM;
const { makeSwitchOptions, usePage } = UI;

function createCommentManagementController(managementType = 'comment') {
  return controller(({ $confirm, $msg, eventTo, navigateTo, request, reactive, onMounted }) => {
    const self = { $confirm, $msg, navigateTo };
    const canEditContent = isAdminRole(AUTH.getUser());
    const actions = createRequestActions({ request, msg: $msg });
    const state = reactive({
      canEditContent,
      list: [],
      loading: true,
      error: '',
      keyword: '',
      pageTitle: managementType === 'reply' ? '回复管理' : '评论管理',
      type: managementType,
      audit: '',
      switchOptions: makeSwitchOptions(canEditContent),
      auditOptions: [
        { label: '全部状态', value: '' },
        { label: '待审核', value: '0' },
        { label: '已通过', value: '1' }
      ]
    });

    const { loadList, searchList, debouncedSearch, deleteRow } = usePage({
      state,
      self,
      url: '/comment_list',
      field: 'sid',
      sort: 'asc',
      params: () => ({ keyword: state.keyword, type: state.type, audit: state.audit }),
      tableKey: 'commentTable',
      table: { maxHeight: adminTableMaxHeight() },
      pageKey: 'commentPage',
      deleteUrl: '/comment_delete',
      deleteMessage: (row) => Number(row.parent_id) === 0
        ? '此操作将永久删除该评论及其全部回复, 是否继续?'
        : '此操作将永久删除该回复, 是否继续?'
    });

    function onFilterChange() {
      loadList(1);
    }

    // 开关列回调必须回传保存结果（框架只在显式 false 时回滚），否则审核失败开关停在错误状态。
    async function toggleAudit(index, list, value) {
      const row = list[index];
      if (!row) return false;
      const res = await actions.post('/comment_audit', { id: row.id, audit: value }, {
        onOk() {
          row.is_show = Number(value) === 1 ? 1 : 0;
        }
      });
      return !!res;
    }

    async function toggleReadState(index, list, value) {
      const row = list[index];
      if (!row) return false;
      const res = await actions.post('/comment_reply_update', { id: row.id, is_read: Number(value) === 1 ? 1 : 0 }, {
        onOk(res) {
          row.is_read = Number(value) === 1 ? 1 : 0;
          eventTo?.emit('reply:notification-change');
        }
      });
      return !!res;
    }

    const updateSort = createSortUpdateHandler({
      actions,
      url: '/comment_update',
      reload: () => loadList(state.currentPage, { silent: true })
    });

    function goBack() {
      self.navigateTo('/admin');
    }

    onMounted(function () {
      if (!requireLogin(AUTH, { $msg, navigateTo })) return;
      loadList(1);
    });
    return { state, searchList, debouncedSearch, onFilterChange, toggleAudit, toggleReadState, updateSort, deleteRow, goBack };
  });
}

const commentController = createCommentManagementController('comment');

export { createCommentManagementController };
export default commentController;