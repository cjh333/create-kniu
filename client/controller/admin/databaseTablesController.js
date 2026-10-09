import MVVM from '../../core/kniumvvm.mjs';
import AUTH from '../../core/kniuauth.mjs';
// ⚠ import 必须写成**单行**：构建器的 import 正则带 `m` 不跨行，多行写法 dev 正常、
// 构建时被原样留进产物 ⇒ dist 里 `import` 出现在非 module 脚本中、整站崩。
// 常驻闸门见 `test/check_single_line_imports.mjs`。
import { IDENTIFIER_PATTERN, FIELD_TYPES, formatBytes, nodeById, clearNode, readNativeValue, makeInput, rowAt, routeParams } from './databaseShared.js';

const { controller } = MVVM;

/** 本页视图宿主标签名（`client/views/admin/databasetables.html`）。 */
const PAGE_TAG = 'KNIU-SYSTEM-ADMIN-DATABASETABLES';

/**
 * 「数据库管理」第二层：某个库的数据表列表（`#/databasetables`）。
 *
 * 库名来自上一层的 `navigateTo('/databasetables', { database })`，用 `getRouteData()` 取回；
 * 也接受直达链接 `#/databasetables?database=xxx`（查询串打底、路由数据覆盖）。两者都没有
 * 就不发请求、退回第一层——绝不在无库上下文上操作。
 * 层级分工与「为什么必须有三个控制器文件」见 `./databaseShared.js` 顶部注释。
 */
const databaseTablesController = controller(({ $confirm, $msg, getRouteData, navigateTo, request, reactive, onMounted }) => {
  const self = { $confirm, $msg, navigateTo };
  const isSuperAdmin = Number(AUTH.getUser()?.roleId || AUTH.getUser()?.role || 0) === 1;
  const params = routeParams(getRouteData, ['database']);

  const state = reactive({
    isSuperAdmin,
    database: params.database,
    showCreateTable: false,
    // ⚠ **不要**给这里的表格加 `maxHeight`：那是给「固定高度、内部滚动」的场景用的，
    // 一旦写上，表体高度就被钉死成那个值，几行数据也会出现滚动条、末行还会被切掉半行
    // （实测 12 行需要 539px，而写死 520 就多出一条滚动条）。表格保持自然高度，
    // 行多到一屏放不下时由页面滚动容器 `.kniu_web_aside_view` 统一出一个滚动条 —— 全页只有一个。
    tableTable: {
      data: [],
      rowKey: 'name',
      stripe: true,
      border: true
    }
  });

  let tableFieldRows = [];

  /* ────────────────────────── 数据加载 ────────────────────────── */

  async function loadTables() {
    const res = await request({
      url: '/db_tables', type: 'POST', mutation: false, data: { database: state.database }
    });
    if (res.status !== 1) {
      // 库不存在（NOT_FOUND）等情形：留在本页只会得到一个空壳，直接退回上一层。
      self.$msg({ content: res.msg || '读取数据表失败', type: 'error' });
      self.navigateTo('/database');
      return;
    }
    const list = (res.data && res.data.list) || [];
    state.tableTable = {
      ...state.tableTable,
      data: list.map(function (row) {
        return {
          ...row,
          type_text: row.type === 'VIEW' ? '视图' : '数据表',
          size_text: formatBytes(Number(row.data_length) + Number(row.index_length))
        };
      })
    };
  }

  /* ─────────────────── 建表弹窗：动态字段行 ─────────────────── */

  /**
   * 追加一行字段定义。
   *
   * 单元格必须给**确定宽度**（`flex:0 0 Wpx`）而不是 `min-width`：`kniu-input` 是块级、
   * 内层控件宽度 100%，其 max-content 约 185px，只写 min-width 时每个单元格都被撑到 185px，
   * 5 个单元格 + 两个开关 + 删除按钮一定换行（实测每个字段占两行）。
   *
   * @param {Object} [preset] 预置字段（形如 `{ name, type, length, nullable, primary, default, comment }`）。
   * @return {void}
   */
  function addFieldRow(preset) {
    const box = nodeById(PAGE_TAG, 'newTableFields');
    if (!box) return;
    // `kniu@click` 的处理器会收到事件对象（含 `detail`），必须与「预置字段对象」区分开。
    const model = preset && typeof preset === 'object' && typeof preset.name === 'string' && !('detail' in preset)
      ? preset
      : { name: '', type: 'VARCHAR', length: 255, nullable: false, primary: false, default: '', comment: '' };
    const line = document.createElement('div');
    line.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap;';

    const nameInput = makeInput(model.name, { placeholder: '列名', maxlength: '64' });
    const typeInput = makeInput(model.type, { placeholder: FIELD_TYPES.slice(0, 3).join('/') });
    const lengthInput = makeInput(model.length || '', { placeholder: '长度', maxlength: '5' });
    const defaultInput = makeInput(model.default || '', { placeholder: '默认值' });
    const commentInput = makeInput(model.comment || '', { placeholder: '注释' });
    const primaryBox = document.createElement('kniu-switch');
    primaryBox.options = { name: 'primary', activeValue: true, inactiveValue: false };
    primaryBox.value = !!model.primary;
    const nullableBox = document.createElement('kniu-switch');
    nullableBox.options = { name: 'nullable', activeValue: true, inactiveValue: false };
    nullableBox.value = !!model.nullable;

    function cell(node, width) {
      const box2 = document.createElement('div');
      box2.style.cssText = `display:flex;align-items:center;gap:6px;flex:0 0 ${width};width:${width};`;
      box2.appendChild(node);
      return box2;
    }
    function tag(text) {
      const span = document.createElement('span');
      span.textContent = text;
      span.style.cssText = 'font-size:12px;color:#909399;';
      return span;
    }

    line.appendChild(cell(nameInput, '140px'));
    line.appendChild(cell(typeInput, '100px'));
    line.appendChild(cell(lengthInput, '60px'));
    line.appendChild(cell(defaultInput, '100px'));
    line.appendChild(cell(commentInput, '110px'));

    const flags = document.createElement('div');
    flags.style.cssText = 'display:flex;align-items:center;gap:6px;';
    flags.appendChild(tag('主键'));
    flags.appendChild(primaryBox);
    flags.appendChild(tag('可空'));
    flags.appendChild(nullableBox);
    line.appendChild(flags);

    const remove = document.createElement('kniu-btn');
    remove.options = { type: 'danger', size: 'small', link: true, text: true, nativeType: 'button' };
    remove.textContent = '删除';
    remove.addEventListener('click', function () {
      const index = tableFieldRows.findIndex((item) => item.line === line);
      if (index >= 0) tableFieldRows.splice(index, 1);
      line.remove();
    });
    line.appendChild(remove);

    box.appendChild(line);
    tableFieldRows.push({
      line,
      read: function () {
        return {
          name: readNativeValue(nameInput).trim(),
          type: readNativeValue(typeInput).trim().toUpperCase(),
          length: Number(readNativeValue(lengthInput)) || 0,
          nullable: nullableBox.value === true,
          primary: primaryBox.value === true,
          default: readNativeValue(defaultInput).trim(),
          comment: readNativeValue(commentInput).trim()
        };
      }
    });
  }

  function openCreateTable() {
    if (!state.database) {
      self.$msg({ content: '缺少数据库上下文，请重新从数据库列表进入', type: 'error' });
      self.navigateTo('/database');
      return;
    }
    clearNode(nodeById(PAGE_TAG, 'newTableFields'));
    tableFieldRows = [];
    const nameBox = nodeById(PAGE_TAG, 'newTableName');
    if (nameBox) nameBox.value = '';
    addFieldRow({ name: 'id', type: 'BIGINT', length: 0, nullable: false, primary: true, default: '', comment: '主键' });
    addFieldRow({ name: '', type: 'VARCHAR', length: 255, nullable: false, primary: false, default: '', comment: '' });
    state.showCreateTable = true;
  }

  function closeCreateTable() {
    state.showCreateTable = false;
  }

  async function submitCreateTable() {
    const nameBox = nodeById(PAGE_TAG, 'newTableName');
    const tableName = nameBox ? readNativeValue(nameBox).trim() : '';
    if (!IDENTIFIER_PATTERN.test(tableName)) {
      self.$msg({ content: '表名只能由字母、数字和下划线组成（1-64 位）', type: 'error' });
      return;
    }
    const fields = tableFieldRows.map((item) => item.read()).filter((item) => item.name !== '');
    if (!fields.length) {
      self.$msg({ content: '至少需要一个字段', type: 'error' });
      return;
    }
    if (!fields.some((item) => item.primary)) {
      self.$msg({ content: '请至少指定一个主键字段（没有主键的表无法在数据库管理里写入）', type: 'error' });
      return;
    }
    const res = await request({
      url: '/db_table_create', type: 'POST',
      data: { database: state.database, table: tableName, fields }
    });
    if (res.status !== 1) {
      self.$msg({ content: res.msg, type: 'error' });
      return;
    }
    state.showCreateTable = false;
    self.$msg({ content: res.msg, type: 'success' });
    await loadTables();
  }

  /* ─────────────────────── 库级动作 ─────────────────────── */

  async function doExport() {
    if (!state.database) return;
    const confirmed = await self.$confirm(`确定导出数据库「${state.database}」为 .sql 文件吗？`, '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
    }).then(function () { return true; }).catch(function () { return false; });
    if (!confirmed) return;
    const res = await request({
      // 导出虽只读数据，但后端会写一条审计日志（`writeAudit('db_export')`）⇒ 属于写操作，
      // 不能标 `mutation:false`（`test/core-state-sync.mjs` 的「已审计只读白名单」会拦下）。
      url: '/db_export', type: 'POST', dataType: 'text',
      data: { database: state.database }
    });
    const text = typeof res === 'string' ? res : '';
    if (!text || text.indexOf('-- KniuSystem') !== 0) {
      self.$msg({ content: (res && res.msg) || '导出失败', type: 'error' });
      return;
    }
    const blob = new Blob([text], { type: 'application/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${state.database}.sql`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    self.$msg({ content: `已导出 ${formatBytes(text.length)}`, type: 'success' });
  }

  /* ─────────────────────── 进入下一层（换页） ─────────────────────── */

  /**
   * 「数据表」列表操作列：查看 → 进入该表的结构与数据页面。
   *
   * **只有这一个入口**：表格没有绑 `kniu@row-click`，点行不跳转——行点击在
   * 「列表里想选中/复制内容」时太容易误触发换页。
   *
   * @param {number} index 行下标。
   * @param {Array<Object>} list 当前页数据。
   * @return {boolean} 恒 false，阻止按钮的默认行为。
   */
  function viewTable(index, list) {
    const row = rowAt(index, list);
    if (!row || !row.name) return false;
    self.navigateTo('/databasetable', { database: state.database, table: row.name });
    return false;
  }

  function goDatabases() {
    self.navigateTo('/database');
  }

  onMounted(async function () {
    if (!isSuperAdmin) {
      self.$msg({ content: '数据库管理仅对超级管理员开放', type: 'error' });
      self.navigateTo('/admin');
      return;
    }
    if (!state.database) {
      self.$msg({ content: '请先在数据库列表里选择数据库', type: 'error' });
      self.navigateTo('/database');
      return;
    }
    await loadTables();
  });

  return {
    state,
    addFieldRow,
    openCreateTable,
    closeCreateTable,
    submitCreateTable,
    doExport,
    viewTable,
    goDatabases
  };
});

export default databaseTablesController;
