import KniuMvvm from '../../core/kniumvvm.mjs';
import REQUEST from '../../core/kniurequest.mjs';
import { getResponseRecords, removeListRecord } from '../../core/kniuutil.mjs';

const { controller, reactive, onMounted } = KniuMvvm;

const navController = controller(({ navigateTo }) => {
    const state = reactive({
      tableData: [],
      dialogVisible: false
    });

    async function loadTableData() {
      await REQUEST({
        url: '/nav_list',
        type: 'POST',
        data: {
          page_current: 1,
          page_rows: 100,
          field: 'sid',
          sort: 'asc'
        },
        success(res) {
          if (res.status !== 1) {
            state.tableData = [];
            this.$msg({ content: res.msg, type: 'error' });
            return;
          }
          state.tableData = getResponseRecords(res.data);
        },
        fail(res) {
          state.tableData = [];
          this.$msg({ content: res.msg, type: 'error' });
        }
      });
    }

    function deleteRow(index, tableData) {
      const row = tableData[index];
      if (!row) return false;
      this.$confirm('此操作将永久删除该文件, 是否继续?', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        await REQUEST({
          url: '/nav_delete',
          type: 'POST',
          data: { id: row.id },
          success: (res) => {
            if (res.status !== 1) {
              this.$msg({ type: 'error', content: res.msg });
              return;
            }
            state.tableData = removeListRecord(state.tableData, row);
            this.$msg({ type: 'success', content: '删除成功!' });
          },
          fail: (res) => {
            this.$msg({ type: 'error', content: res.msg });
          }
        });
        return false;
      }).catch(() => {
        this.$msg({ type: 'info', content: '已取消删除' });
        return false;
      });
    }

    function viewRow(index, tableData) {
      const row = tableData[index];
      if (!row) return false;
      const text = ((row.name || '') + ' ' + (row.url || '')).toLowerCase();
      const target = /文章|article/.test(text) ? '/articledetail' : '/dailydetail';
      navigateTo(target);
      return false;
    }

    async function updateShow(index, tableData, value) {
      const row = tableData[index];
      if (!row) return false;
      let saved = false;
      await REQUEST({
        url: '/nav_update',
        type: 'POST',
        data: { id: row.id, is_show: value },
        success(res) {
          if (res.status !== 1) {
            this.$msg({ content: res.msg, type: 'error' });
            return;
          }
          saved = true;
          this.$msg({ content: res.msg, type: 'success' });
        },
        fail(res) { this.$msg({ content: res.msg, type: 'error' }); }
      });
      return saved;
    }

    async function updateSort(index, tableData, value) {
      const row = tableData[index];
      if (!row) return false;
      let saved = false;
      await REQUEST({
        url: '/nav_update',
        type: 'POST',
        data: { id: row.id, sid: value },
        success(res) {
          if (res.status !== 1) {
            this.$msg({ content: res.msg, type: 'error' });
            return;
          }
          saved = true;
          this.$msg({ content: res.msg, type: 'success' });
        },
        fail(res) { this.$msg({ content: res.msg, type: 'error' }); }
      });
      return saved;
    }

    onMounted(loadTableData);
    return { state, deleteRow, viewRow, updateShow, updateSort };
});

export default navController;
