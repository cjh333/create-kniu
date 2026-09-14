import MVVM from '../../core/kniumvvm.mjs';
import UI from '../../core/kniuui.js';
import REQUEST from '../../core/kniurequest.mjs';
import AUTH from '../../core/kniuauth.mjs';

const { controller, onMounted, reactive } = MVVM;
const { usePagination, makeSwitchOptions, createSearchActions, createRowDeleteHandler } = UI;

function createCommentManagementController(managementType = 'comment') {
  return controller(function () {
    const self = this;
    const canEditContent = Number(AUTH.getUser()?.roleId || AUTH.getUser()?.role || 0) === 1 || Number(AUTH.getUser()?.roleAuth || 0) === 1;
    const state = reactive({
      canEditContent,
      list: [],
      loading: true,
      error: '',
      keyword: '',
      pageTitle: managementType === 'reply' ? '回复管理' : '评论管理',
      type: managementType,
      audit: '',
      commentTable: {
        data: [],
        rowKey: 'id',
        stripe: true,
        border: true,
        maxHeight: innerHeight - 220 / 1920 * innerWidth,
        loading: true
      },
      commentPage: {
        layout: '上一页,首页,页码,末页,下一页,跳转,总数,条数',
        currentPage: 1,
        pageSize: 20,
        total: 0,
        background: true,
        onCurrentChange: (detail) => changePage({ detail }),
        onSizeChange: (detail) => changePageSize({ detail })
      },
      switchOptions: makeSwitchOptions(canEditContent),
      auditOptions: [
        { label: '全部状态', value: '' },
        { label: '待审核', value: '0' },
        { label: '已通过', value: '1' }
      ]
    });

    const { loadList, changePage, changePageSize } = usePagination({
      state,
      self,
      url: '/comment_list',
      field: 'id',
      sort: 'asc',
      params: () => ({ keyword: state.keyword, type: state.type, audit: state.audit }),
      tableKey: 'commentTable',
      pageKey: 'commentPage'
    });

    const { searchList, debouncedSearch } = createSearchActions(loadList);

    function onFilterChange() {
      loadList(1);
    }

    async function toggleAudit(index, list, value) {
      const row = list[index];
      if (!row) return;
      await auditRequest(row.id, value);
    }

    async function toggleReadState(index, list, value) {
      const row = list[index];
      if (!row) return;
      await REQUEST({
        url: '/comment_reply_update',
        type: 'POST',
        data: { id: row.id, is_read: Number(value) === 1 ? 1 : 0 },
        success(res) {
          if (res.status !== 1) {
            self.$msg({ content: res.msg, type: 'error' });
            loadList(state.currentPage);
            return;
          }
          self.$msg({ content: res.msg, type: 'success' });
          globalThis.dispatchEvent(new CustomEvent('kniu:reply-notification-change'));
          loadList(state.currentPage);
        },
        fail(res) {
          self.$msg({ content: res.msg, type: 'error' });
          loadList(state.currentPage);
        }
      });
    }

    async function auditRequest(id, audit) {
      await REQUEST({
        url: '/comment_audit',
        type: 'POST',
        data: { id, audit },
        success(res) {
          if (res.status !== 1) {
            self.$msg({ content: res.msg, type: 'error' });
            return;
          }
          self.$msg({ content: res.msg, type: 'success' });
          loadList(state.currentPage);
        },
        fail(res) { self.$msg({ content: res.msg, type: 'error' }); }
      });
    }

    const deleteRow = createRowDeleteHandler({
      self,
      state,
      loadList,
      url: '/comment_delete',
      confirmMessage: (row) => Number(row.parent_id) === 0
        ? '此操作将永久删除该评论及其全部回复, 是否继续?'
        : '此操作将永久删除该回复, 是否继续?'
    });

    function goBack() {
      self.navigateTo('/admin');
    }

    onMounted(function () { loadList(1); });
    return { state, changePage, changePageSize, searchList, debouncedSearch, onFilterChange, toggleAudit, toggleReadState, deleteRow, goBack };
  });
}

const commentController = createCommentManagementController('comment');

export { createCommentManagementController };
export default commentController;
