import KniuMvvm from '../../core/kniumvvm.mjs';
import KniuUI from '../../core/kniuui.js';
import REQUEST from '../../core/kniurequest.mjs';
import AUTH from '../../core/kniuauth.mjs';
import { debounce } from '../../core/kniuutil.mjs';

const { controller, onMounted, reactive } = KniuMvvm;
const { usePagination } = KniuUI;

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
      // 审核状态：'0'=待审核 / '1'=已通过 / ''=全部
      audit: '',
      commentTable: {
        data: [],
        rowKey: 'id',
        stripe: true,
        border: true,
        maxHeight: innerHeight - 220 / 1920 * innerWidth,
        loading: true,
        cols: [
          {
            type: 'checkbox',
            width: 60,
            align: 'center',
            fixed: true
          },
          {
            field: 'id',
            label: 'ID',
            width: 80,
            align: 'center',
            fixed: true,
            sortable: true
          },
          {
            field: 'name',
            label: '昵称',
            width: 80,
            showOverflowTooltip: true
          },
          {
            field: 'message',
            label: managementType === 'reply' ? '回复内容' : '评论内容',
            minWidth: 220,
            showOverflowTooltip: true
          },
          {
            field: 'article_title',
            label: '所属文章标题',
            minWidth: 160,
            showOverflowTooltip: true
          },
          ...(managementType === 'reply' ? [{
            field: 'parent_id',
            label: '所属评论ID',
            width: 100,
            align: 'center'
          }] : []),
          {
            field: 'likes',
            label: '点赞',
            width: 80,
            align: 'center',
            sortable: true
          },
          {
            field: 'create_time',
            label: '时间',
            width: 160,
            align: 'center'
          },
          {
            field: 'status_text',
            label: '状态',
            width: 100,
            align: 'center',
            status: {
              options: {
                type: (row) => Number(row.is_show) === 1 ? 'success' : 'warning'
              }
            }
          },
          {
            field: 'is_show',
            label: '审核',
            width: 90,
            align: 'center',
            condition: canEditContent,
            switch: {
              options: null,
              onChange: toggleAudit
            }
          },
          {
            label: '操作',
            width: 80,
            align: 'center',
            fixed: 'right',
            condition: canEditContent,
            actions: [
              {
                title: '删除',
                type: 'danger',
                size: 'small',
                link: true,
                onClick: ({ index, rows }) => deleteRow(index, rows)
              }
            ]
          }
        ]
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
      switchOptions: {
      name: 'is_show',
      activeValue: 1,
      inactiveValue: 0,
      activeColor: '#13ce66',
        inactiveColor: '#ff4949',
        disabled: !canEditContent
      },
      auditOptions: [
        { label: '全部状态', value: '' },
        { label: '待审核', value: '0' },
        { label: '已通过', value: '1' }
      ]
    });
    const auditSwitchColumn = state.commentTable.cols.find((column) => column.switch);
    if (auditSwitchColumn) auditSwitchColumn.switch.options = state.switchOptions;

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

    function searchList() {
      loadList(1);
    }

    const debouncedSearch = debounce(searchList, 250);

    function onFilterChange() {
      loadList(1);
    }

    async function toggleAudit(index, list, value) {
      const row = list[index];
      if (!row) return;
      await auditRequest(row.id, value);
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

    async function deleteRow(index, list) {
      const row = list[index];
      if (!row) return false;
      const isTop = Number(row.parent_id) === 0;
      const tip = isTop ? '此操作将永久删除该评论及其全部回复, 是否继续?' : '此操作将永久删除该回复, 是否继续?';
      const confirmed = await self.$confirm(tip, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(function () { return true; }).catch(function () { return false; });
      if (!confirmed) return false;
      await REQUEST({
        url: '/comment_delete',
        type: 'POST',
        data: { id: row.id },
        success(res) {
          if (res.status !== 1) {
            self.$msg({ content: res.msg, type: 'error' });
            return;
          }
          self.$msg({ content: '删除成功!', type: 'success' });
          loadList(state.currentPage);
        },
        fail(res) { self.$msg({ content: res.msg, type: 'error' }); }
      });
      return false;
    }

    function goBack() {
      self.navigateTo('/admin');
    }

    onMounted(function () { loadList(1); });
    return { state, changePage, changePageSize, searchList, debouncedSearch, onFilterChange, toggleAudit, deleteRow, goBack };
  });
}

const commentController = createCommentManagementController('comment');

export { createCommentManagementController };
export default commentController;
