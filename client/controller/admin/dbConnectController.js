import MVVM from '../../core/kniumvvm.mjs';
import AUTH from '../../core/kniuauth.mjs';
// ⚠ import 必须写成**单行**：构建器的 import 正则带 `m` 不跨行，多行写法 dev 正常、
// 构建时匹配不到会被原样留进产物 ⇒ dist 里 `import` 出现在非 module 脚本中、整站崩。
// 常驻闸门见 `test/check_single_line_imports.mjs`。
import { IDENTIFIER_PATTERN, rowAt, CONNECT_REDIRECT_FLAG } from './databaseShared.js';

const { controller } = MVVM;

/** 主机地址白名单（与后端 `DbProfile::normalize()` 同口径）。 */
const HOST_PATTERN = /^[A-Za-z0-9._-]{1,190}$/;

/** 允许的字符集（与后端 `DbProfile` 的 `CHARSETS` 同口径）。 */
const CHARSETS = ['utf8mb4', 'utf8', 'latin1', 'gbk', 'big5'];

/**
 * 取 `kniu-form` 校验入参里的值。
 *
 * 框架把**整个字段对象**交给 `condition`（同 `databaseController.js` 的 `createDatabaseModel`），
 * 所以取值走 `v.value`；这里再兜一层裸值，免得将来口径变了导致校验**静默恒假**。
 *
 * @param {*} source 字段对象或裸值。
 * @return {string} 去首尾空白后的字符串值。
 */
function fieldValue(source) {
  const raw = (source && typeof source === 'object' && 'value' in source) ? source.value : source;
  return String(raw === null || raw === undefined ? '' : raw).trim();
}

/**
 * 「数据库连接」页（`#/dbconnect`）。
 *
 * 数据管理第 0 层：管理若干 **MySQL 连接档案**，并指定哪一条是「当前连接」。
 *
 * 两个设计要点：
 *   ① 本页是**修不出来的那条连接的修复入口**——后端这组接口刻意不接管当前连接，
 *      否则当前连接一坏，用户就被 4002 挡在自己的修复页面外面；
 *   ② 从 `databaseController` 首次进入且「连不上 / 一个库都没有」时会跳到这里
 *      （见那边的 `redirectToConnectOnFirstEntry()`）。
 *
 * ⚠ `self` 必须**全量转发** setup 参数，不要手搓 `{ $msg, ... }` 子集：
 * 手搓会漏掉框架注入的项，用到时是 undefined，而求值器把报错吞掉——
 * 表现成「点了按钮什么都不发生」（SKILL #151）。
 */
const dbConnectController = controller((setup) => {
  const self = setup;
  // 只解构「要作为裸标识符用」的四项；`$msg` / `$confirm` / `navigateTo` 一律走 `self.`，
  // 保持与三层数据库页面同一写法。
  const { $refs, request, reactive, onMounted } = setup;
  const isSuperAdmin = Number(AUTH.getUser()?.roleId || AUTH.getUser()?.role || 0) === 1;

  const state = reactive({
    isSuperAdmin,
    showForm: false,
    formTitle: '新建连接',
    /** 编辑中的档案 id；空串表示新建。 */
    editingId: '',
    connectModel: emptyModel(),
    // ⚠ **不要**给这里的表格加 `maxHeight`：写死高度会让几行的表格也长出滚动条、
    // 并把末行切掉半行（原因见 `databaseController.js` 的注释）。行多时由页面滚动容器出滚动条。
    connectTable: {
      data: [],
      rowKey: 'id',
      stripe: true,
      border: true
    }
  });

  /**
   * 造一份空的表单模型。
   *
   * 每次打开弹窗都**整体换一个新对象**（而不是原地改 `value`）：options-only 组件
   * 靠对象引用变化触发刷新，原地改子属性不会重新渲染。
   *
   * @return {Object} `kniu-form` 的 options。
   */
  function emptyModel() {
    return {
      labelPosition: 'top',
      labelWidth: 'auto',
      name: {
        value: '',
        condition: function (v) { return fieldValue(v) !== ''; },
        message: '请填写连接名称'
      },
      host: {
        value: '',
        condition: function (v) { return HOST_PATTERN.test(fieldValue(v)); },
        message: '主机地址只能由字母、数字、点、下划线和连字符组成'
      },
      port: {
        value: '3306',
        condition: function (v) {
          const port = Number(fieldValue(v));
          return Number.isInteger(port) && port >= 1 && port <= 65535;
        },
        message: '端口必须是 1-65535 之间的整数'
      },
      username: {
        value: '',
        condition: function () { return true; },
        message: ''
      },
      password: {
        value: '',
        condition: function () { return true; },
        message: ''
      },
      database: {
        value: '',
        condition: function (v) {
          const name = fieldValue(v);
          return name === '' || IDENTIFIER_PATTERN.test(name);
        },
        message: '默认数据库名只能由字母、数字和下划线组成'
      },
      charset: {
        value: 'utf8mb4',
        condition: function (v) { return CHARSETS.indexOf(fieldValue(v)) >= 0; },
        message: '不支持的字符集'
      }
    };
  }

  /* ────────────────────────── 数据加载 ────────────────────────── */

  /**
   * 读取连接档案列表。
   *
   * @return {Promise<void>}
   */
  async function loadConnections() {
    const res = await request({ url: '/db_connection_list', type: 'POST', mutation: false, data: {} });
    if (res.status !== 1) {
      self.$msg({ content: res.msg || '读取连接列表失败', type: 'error' });
      return;
    }
    const list = (res.data && res.data.list) || [];
    state.connectTable = {
      ...state.connectTable,
      data: list.map(function (row) {
        // 派生字段随列表**整批重算**：切换「当前连接」后旧行上的按钮状态必须跟着变，
        // 否则会出现两行都显示「当前」（或都不显示）的错位。
        //
        // ⚠「状态」列的文字必须**在这里算好**，不能靠视图里的条件标记：
        // `kniu-table-col` 的 `#default` 只认表格自己支持的控件（`kniu-btn` / `kniu-switch` /
        // `kniu-tag` / `kniu-status` / …），里面裸写的 `<span kniu:if>` 会被整块丢弃
        // （`_readColumns()` 只查这些控件），该列于是退化成「无 field 的纯文本列」⇒ 渲染成空。
        return {
          ...row,
          can_activate: !row.is_active,
          // 状态文字直接用后端下发的探测结果（mask() 里 probe → 正常/断开/异常）
          status_text: row.status || '未知',
          // 状态颜色：正常=success、断开=info、异常=danger
          status_type: row.status === '正常' ? 'success' : (row.status === '异常' ? 'danger' : 'info'),
          password_text: row.has_password ? '已设置' : '未设置'
        };
      })
    };
  }

  /* ────────────────────────── 表单读写 ────────────────────────── */

  /**
   * 读表单当前值（**不校验**）。
   *
   * 「测试连接」只需要参数本身，名称填没填与连通性无关——后端也刻意不要求名称。
   * 「保存」才走 `collect()`（带 `validate()`）。
   *
   * @return {Object} 请求体字段。
   */
  function readForm() {
    const form = $refs.connectForm;
    const values = (form && form.values) || {};
    return {
      id: state.editingId,
      name: fieldValue(values.name),
      host: fieldValue(values.host),
      port: Number(fieldValue(values.port)) || 0,
      username: fieldValue(values.username),
      password: String(values.password === null || values.password === undefined ? '' : values.password),
      database: fieldValue(values.database),
      charset: fieldValue(values.charset) || 'utf8mb4'
    };
  }

  /**
   * 读表单当前值（**带校验**），校验不通过返回 null。
   *
   * @return {Object|null} 请求体字段。
   */
  function collect() {
    const form = $refs.connectForm;
    if (!form || !form.validate()) return null;
    return readForm();
  }

  function openCreate() {
    state.editingId = '';
    state.formTitle = '新建连接';
    state.connectModel = emptyModel();
    state.showForm = true;
  }

  /**
   * 打开编辑弹窗。
   *
   * **不回填密码**：列表接口从不下发密码，所以密码框天然是空的，
   * 后端把「空密码」解释成「沿用原值」（见 `DbProfile::normalize()`）。
   *
   * @param {number} index 行下标。
   * @param {Array<Object>} list 当前页数据。
   * @return {boolean} 恒 false，阻止按钮默认行为。
   */
  function editConnection(index, list) {
    const row = rowAt(index, list);
    if (!row) return false;
    const model = emptyModel();
    model.name.value = row.name;
    model.host.value = row.host;
    model.port.value = String(row.port);
    model.username.value = row.username;
    model.database.value = row.database;
    model.charset.value = row.charset;
    state.editingId = row.id;
    state.formTitle = `编辑连接 · ${row.name}`;
    state.connectModel = model;
    state.showForm = true;
    return false;
  }

  function closeForm() {
    state.showForm = false;
  }

  /* ────────────────────────── 提交动作 ────────────────────────── */

  /**
   * 保存连接（后端会**先测通再落库**，连不通直接 4002）。
   *
   * @return {Promise<void>}
   */
  async function submitForm() {
    const payload = collect();
    if (!payload) return;
    const res = await request({ url: '/db_connection_save', type: 'POST', data: payload });
    if (res.status !== 1) {
      self.$msg({ content: res.msg, type: 'error' });
      return;
    }
    state.showForm = false;
    self.$msg({ content: res.msg || '已保存', type: 'success' });
    await loadConnections();
  }

  /**
   * 表单内「测试连接」：只测参数，不落库、不需要名称。
   *
   * @return {Promise<void>}
   */
  async function testFormConnection() {
    const payload = readForm();
    const res = await request({ url: '/db_connection_test', type: 'POST', mutation: false, data: payload });
    self.$msg({ content: res.msg || '测试完成', type: res.status === 1 ? 'success' : 'error' });
  }

  /* ────────────────────────── 行内动作 ────────────────────────── */

  /**
   * 把某条档案设为「当前连接」。
   *
   * 列模板内的 `kniu@click` 回调签名是 `(rowIndex, rows)`（表格的私有约定，
   * **不是**事件对象）。
   *
   * @param {number} index 行下标。
   * @param {Array<Object>} list 当前页数据。
   * @return {Promise<boolean>} 恒 false，阻止按钮默认行为。
   */
  async function activateConnection(index, list) {
    const row = rowAt(index, list);
    if (!row) return false;
    const res = await request({ url: '/db_connection_activate', type: 'POST', data: { id: row.id } });
    if (res.status !== 1) {
      self.$msg({ content: res.msg, type: 'error' });
      return false;
    }
    self.$msg({ content: res.msg || '已切换', type: 'success' });
    await loadConnections();
    return false;
  }

  /**
   * 行内「测试」：测一条已保存的档案。
   *
   * @param {number} index 行下标。
   * @param {Array<Object>} list 当前页数据。
   * @return {Promise<boolean>} 恒 false，阻止按钮默认行为。
   */
  async function testConnection(index, list) {
    const row = rowAt(index, list);
    if (!row) return false;
    const res = await request({ url: '/db_connection_test', type: 'POST', mutation: false, data: { id: row.id } });
    self.$msg({ content: res.msg || '测试完成', type: res.status === 1 ? 'success' : 'error' });
    return false;
  }

  /**
   * 删除一条档案。
   *
   * 删掉的若是当前连接，后端会一并取消接管、回到 `.env` 的系统连接。
   *
   * @param {number} index 行下标。
   * @param {Array<Object>} list 当前页数据。
   * @return {Promise<boolean>} 恒 false，阻止按钮默认行为。
   */
  async function deleteConnection(index, list) {
    const row = rowAt(index, list);
    if (!row) return false;
    const confirmed = await self.$confirm(`确定删除连接「${row.name}」吗？`, '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
    }).then(function () { return true; }).catch(function () { return false; });
    if (!confirmed) return false;
    const res = await request({ url: '/db_connection_delete', type: 'POST', data: { id: row.id } });
    if (res.status !== 1) {
      self.$msg({ content: res.msg, type: 'error' });
      return false;
    }
    self.$msg({ content: res.msg || '已删除', type: 'success' });
    await loadConnections();
    return false;
  }

  /**
   * 查看数据库：若该档案还不是当前连接则先激活，再进入数据库管理。
   *
   * 激活失败（连不上 / 认证失败）就留在本页并提示，不跳转——
   * 否则用户会进到数据库管理页然后被 4002 挡回来。
   *
   * @param {number} index 行下标。
   * @param {Array<Object>} list 当前页数据。
   * @return {Promise<boolean>} 恒 false，阻止按钮默认行为。
   */
  async function viewConnection(index, list) {
    const row = rowAt(index, list);
    if (!row) return false;
    if (!row.is_active) {
      const res = await request({ url: '/db_connection_activate', type: 'POST', data: { id: row.id } });
      if (res.status !== 1) {
        self.$msg({ content: res.msg, type: 'error' });
        return false;
      }
    }
    goDatabases();
    return false;
  }

  /* ─────────────────────── 离开本页 ─────────────────────── */

  /**
   * 去数据库列表。
   *
   * 走 `sessionStorage` 一次性标记（`CONNECT_REDIRECT_FLAG`）：用户从本页进入数据库管理时，
   * 即使库里一个数据库都没有，也**不再被弹回本页**——否则「新建数据库」按钮永远点不到。
   *
   * @return {void}
   */
  function goDatabases() {
    try {
      globalThis.sessionStorage?.setItem(CONNECT_REDIRECT_FLAG, '1');
    } catch (e) {
      // 隐私模式下可能不可用：标记失败最多多跳一次，不影响功能。
    }
    self.navigateTo('/database');
  }

  function goBack() {
    self.navigateTo('/admin');
  }

  onMounted(async function () {
    if (!isSuperAdmin) {
      self.$msg({ content: '数据库管理仅对超级管理员开放', type: 'error' });
      self.navigateTo('/admin');
      return;
    }
    await loadConnections();
  });

  return {
    state,
    openCreate,
    editConnection,
    closeForm,
    submitForm,
    testFormConnection,
    activateConnection,
    testConnection,
    deleteConnection,
    viewConnection,
    goDatabases,
    goBack
  };
});

export default dbConnectController;
