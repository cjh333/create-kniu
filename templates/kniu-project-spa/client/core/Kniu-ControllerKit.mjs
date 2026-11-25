import { createSearchActions } from './Kniu-Util.mjs';
import {
  getContracts, isSuccessResponse, responseMessage, responseData, responseRecords,
  failureResult, paginationRequest, readPagination, isAdminUser, isSuperUser,
  applyContractNavFlags, routeFromLocation, isIdentityErrorCode
} from './Kniu-Contracts.mjs';

let uiAdapter = null;

export function configureControllerKit(adapter) {
  uiAdapter = adapter || null;
  return uiAdapter;
}

function notify(options) {
  if (typeof uiAdapter?.msg === 'function') return uiAdapter.msg(options);
}

function confirmDialog(message) {
  if (typeof uiAdapter?.confirm === 'function') return uiAdapter.confirm(message);
  return Promise.resolve(false);
}

export async function safePost(request, url, data, fallbackMessage) {
  const messages = getContracts().messages;
  if (typeof request?.post !== 'function') {
    return failureResult(messages.requestClientMissing);
  }
  try {
    return await request.post(url, data);
  } catch (error) {
    return failureResult(error?.message || fallbackMessage || messages.requestFailed);
  }
}

export async function postOrFail(request, url, data, options = {}) {
  const res = await safePost(request, url, data, options.fallbackMessage);
  const ok = isSuccessResponse(res);
  const message = responseMessage(res, getContracts().messages.requestFailed);
  const result = { ok, res, message };
  if (ok) return result;
  if (typeof options.onFail === 'function') options.onFail(result);
  else if (options.notify !== false && typeof options.msg === 'function') {
    options.msg({ content: message, type: 'error' });
  }
  return result;
}

export async function runRequest(task, fallbackMessage) {
  try {
    return { ok: true, value: await task() };
  } catch (error) {
    return {
      ok: false,
      value: undefined,
      message: error?.message || fallbackMessage || getContracts().messages.requestFailed
    };
  }
}

export function makeFail($msg) {
  return function (res) {
    $msg({ content: responseMessage(res, getContracts().messages.requestFailed), type: 'error' });
  };
}

export function confirmYes($confirm, msg, title, type = 'warning', confirmText) {
  const messages = getContracts().messages;
  void (title ?? messages.confirmTitle); void type; void (confirmText ?? messages.confirmText);
  return Promise.resolve($confirm(msg)).then(function () { return true; }).catch(function () { return false; });
}

export function createSubmitHandler(options) {
  options = options || {};
  const request = options.request;
  const state = options.state;
  const submittingKey = options.submittingKey || 'isSubmitting';
  const messages = getContracts().messages;
  const successMsg = options.successMsg || options.defaultSuccessMsg || messages.saveSuccess;
  const showErrorOnFailure = options.showErrorOnFailure !== false;
  const $msg = options.$msg || (globalThis.UI && globalThis.UI.msg) || notify;

  return async function submit(url, data, extraParams) {
    extraParams = extraParams || {};
    const setSubmitting = function (value) {
      if (state) state[submittingKey] = value;
    };
    if (!extraParams.skipSubmitting) setSubmitting(true);
    let res;
    try {
      res = await request.post(url, data);
    } catch (error) {
      res = { status: 0, msg: error?.message || messages.requestFailed };
    } finally {
      if (!extraParams.skipSubmitting) setSubmitting(false);
    }

    if (res.status !== 1) {
      if (showErrorOnFailure) {
        $msg({ content: res.msg || (options.errorPrefix || '') + messages.operationFailed, type: 'error' });
      }
      if (typeof options.onError === 'function') options.onError(res);
      return { success: false, response: res };
    }

    if (typeof options.onSuccess === 'function') {
      await options.onSuccess(res, { url, data });
    } else if (!extraParams.suppressSuccessMsg) {
      $msg({ content: res.msg || successMsg, type: 'success' });
    }
    return { success: true, response: res };
  };
}

export function createToBack(navigate, fallbackPath = '/') {
  return function toBack() {
    if (globalThis.history && globalThis.history.length > 1) { globalThis.history.back(); return; }
    navigate(fallbackPath);
  };
}

export function guardActionResult(result, options) {
  const msg = options && options.msg;
  if (isIdentityErrorCode(result && result.status)) {
    if (msg) msg({ content: (options && options.loginMessage) || getContracts().messages.loginRequired, type: 'info' });
    return false;
  }
  if (!result || result.status !== 1) {
    if (msg) msg({ content: (result && result.msg) || (options && options.fallbackMessage) || getContracts().messages.operationFailed, type: 'error' });
    return false;
  }
  return true;
}

export function requireLogin(AUTH, opts) {
  const options = opts || {};
  const auth = getContracts().auth;
  const messages = getContracts().messages;
  if (AUTH.isLoggedIn()) return true;
  if (options.$msg) options.$msg({ content: options.failMsg || messages.loginExpired, type: 'error' });
  if (options.navigateTo) {
    const route = routeFromLocation(globalThis.location, getContracts(), '/');
    if (route !== auth.loginRoute && !auth.anonymousRoutes.includes(route)) {
      options.navigateTo(auth.loginRoute, { [auth.redirectParam]: route });
    }
  }
  return false;
}

export function isAdminRole(user) { return isAdminUser(user); }

export function isSuperRole(user) { return isSuperUser(user); }

export function applyNavFlags(state, user) { return applyContractNavFlags(state, user); }

export function viewportHeight(offsetRatio) {
  const height = Number(globalThis.innerHeight) || 0;
  const width = Number(globalThis.innerWidth) || 0;
  return height - Number(offsetRatio || 0) * width;
}

export function adminTableMaxHeight() {
  return viewportHeight(220 / 1920);
}

export function adminEditorMaxHeight() {
  return viewportHeight(590 / 1920);
}

export function createRequestActions({ request, msg }) {
  const $msg = msg || notify;
  async function post(url, data, options = {}) {
    const res = await safePost(request, url, data);
    if (res && isSuccessResponse(res)) {
      if (typeof options.onOk === 'function') await options.onOk(res);
      return true;
    }
    $msg({ content: responseMessage(res, getContracts().messages.operationFailed), type: 'error' });
    return false;
  }
  async function updateRow(url, row, changes) {
    return post(url, { id: row.id, ...changes });
  }
  return { post, updateRow };
}

export function createSortUpdateHandler(options) {
  return async function updateSort(index, list, value) {
    const row = list && list[index];
    if (!row) return false;
    const res = await options.actions.post(options.url, { id: row.id, sid: Math.max(0, Number(value) || 0) });
    if (res) await options.reload();
    return !!res;
  };
}

export function createRowDeleteHandler(config) {
  const { request, self, state, loadList, url, confirmMessage, gate = null, getSuccessMessage = null, onSuccess = null,
    reloadOnSuccess = true, idOf = null, buildData = null, reload = null,
    confirmTitle = null, confirmText = null } = config || {};
  return async function deleteRow(index, list) {
    const messages = getContracts().messages;
    const row = list && list[index];
    if (!row) return false;
    if (typeof gate === 'function' && !gate()) return false;
    const confirmed = await confirmYes(self.$confirm,
      typeof confirmMessage === 'function' ? confirmMessage(row) : confirmMessage,
      confirmTitle || messages.confirmTitle, 'warning', confirmText || messages.confirmText);
    if (!confirmed) return false;
    const res = await safePost(request, url, buildData ? buildData(row) : { id: idOf ? idOf(row) : row.id }, messages.deleteFailed);
    if (!isSuccessResponse(res)) {
      self.$msg({ content: responseMessage(res, messages.deleteFailed), type: 'error' });
      return false;
    }
    self.$msg({ content: typeof getSuccessMessage === 'function' ? getSuccessMessage(res) : messages.deleteSuccess, type: 'success' });
    if (typeof onSuccess === 'function') onSuccess(row, res);
    if (reloadOnSuccess) {
      if (typeof reload === 'function') reload();
      else if (loadList && state) await loadList(state.currentPage);
    }
    return true;
  };
}

export function usePagination(options) {
  const { request, state, self, url, field = 'id', sort = 'asc', params = null, transform = null, tableKey = null, pageKey = null, table = null, page = null, stateStore = null, storeRecordKey = '', onLoaded = null } = options;
  if (!state || !self || !url || !request) {
    throw new Error('usePagination 需要 request、state、self、url 四个参数');
  }
  const paging = getContracts().pagination;
  const messages = getContracts().messages;
  const $msg = self.$msg || notify;
  if (tableKey && (!state[tableKey] || typeof state[tableKey] !== 'object')) {
    state[tableKey] = Object.assign({ data: [], rowKey: 'id', loading: true }, table && typeof table === 'object' ? table : {});
  }
  if (pageKey && (!state[pageKey] || typeof state[pageKey] !== 'object')) {
    state[pageKey] = Object.assign({ currentPage: 1, pageSize: paging.defaultPageSize, total: 0 }, page && typeof page === 'object' ? page : {});
  }
  const pageOptions = pageKey && state[pageKey] && typeof state[pageKey] === 'object' ? state[pageKey] : {};
  const configuredPageSize = Number(pageOptions.pageSize);
  state.pageRows = Math.max(1, Number.isFinite(configuredPageSize) ? configuredPageSize : paging.fallbackPageSize);
  state.currentPage = Math.max(1, Number(pageOptions.currentPage) || 1);
  state.pageTotal = Math.max(1, Number(state.pageTotal) || 1);
  state.total = Math.max(0, Number(pageOptions.total ?? state.total) || 0);

  function resolveExtraParams() {
    const extra = typeof params === 'function' ? params() : params;
    return extra && typeof extra === 'object' ? extra : {};
  }

  function syncOptions() {
    if (tableKey && state[tableKey] && typeof state[tableKey] === 'object') {
      const prev = state[tableKey];
      state[tableKey] = { ...prev, data: state.list, loading: state.loading };
    }
    if (pageKey && state[pageKey] && typeof state[pageKey] === 'object') {
      const prev = state[pageKey];
      state[pageKey] = { ...prev, total: state.total, currentPage: state.currentPage, pageSize: state.pageRows };
    }
  }

  let activeLoadKey = '';
  let activeLoadPromise = null;

  function serializeLoadParams(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(serializeLoadParams).join(',') + ']';
    return '{' + Object.keys(value).sort().map(function (key) {
      return JSON.stringify(key) + ':' + serializeLoadParams(value[key]);
    }).join(',') + '}';
  }

  let loadSequence = 0;
  function boundTargets() {
    return [options.refs?.table, options.refs?.page].filter(Boolean);
  }
  function commit(targets, mutate) {
    if (targets.length && options.context?.updateBindings) {
      if (targets.some((element) => !element.isConnected)) return false;
      options.context.updateBindings(targets, mutate);
    } else mutate();
    return true;
  }

  async function loadList(page, loadOptions) {
    const targetPage = Math.min(Math.max(Number(page) || 1, 1), state.pageTotal || 1);
    const requestData = paginationRequest(targetPage, state.pageRows, { field, sort, ...resolveExtraParams() });
    const loadKey = `${url}:${serializeLoadParams(requestData)}`;
    if (activeLoadPromise && activeLoadKey === loadKey) return activeLoadPromise;
    const sequence = ++loadSequence;
    const targets = boundTargets();
    const silent = !!loadOptions?.silent;
    const run = (async function () {
      if (!silent) commit(targets, () => { state.loading = true; syncOptions(); });
      const res = await safePost(request, url, requestData, messages.loadFailed);
      if (sequence !== loadSequence || targets.some((element) => !element.isConnected)) return;
      if (!isSuccessResponse(res)) {
        commit(targets, () => {
          state.error = responseMessage(res, messages.loadFailed);
          if (!silent) state.loading = false;
          syncOptions();
        });
        $msg({ content: state.error, type: 'error' });
        return;
      }
      const payload = responseData(res) || {};
      const records = responseRecords(payload);
      const { current, totalPages, total } = readPagination(payload);
      commit(targets, () => {
        state.list = typeof transform === 'function' ? transform(records) : records;
        state.currentPage = current;
        state.pageTotal = totalPages;
        state.total = total;
        state.error = '';
        if (!silent) state.loading = false;
        syncOptions();
        if (onLoaded) onLoaded();
      });
      if (stateStore && storeRecordKey && typeof stateStore.track === 'function') {
        await stateStore.track(storeRecordKey, {
          records: state.list, total: state.total,
          currentPage: state.currentPage, pageRows: state.pageRows
        }, 'records-changed');
      }
    }());
    activeLoadKey = loadKey;
    activeLoadPromise = run;
    try { return await run; }
    finally {
      if (activeLoadPromise === run) { activeLoadPromise = null; activeLoadKey = ''; }
    }
  }

  function changePage(event) {
    const page = Number(event?.detail?.page ?? event?.currentTarget?.dataset.page);
    if (!Number.isFinite(page) || page < 1 || page > state.pageTotal) return;
    return loadList(page);
  }

  function changePageSize(event) {
    const raw = event?.detail?.size ?? Number(event?.target?.value ?? state.pageRows);
    const size = Math.max(1, Math.min(paging.maxPageSize, Math.floor(raw) || paging.fallbackPageSize));
    if (size === state.pageRows) return;
    if (!commit(boundTargets(), () => { state.pageRows = size; state.currentPage = 1; })) return;
    return loadList(1);
  }

  if (pageKey && state[pageKey] && typeof state[pageKey] === 'object') {
    state[pageKey] = {
      ...state[pageKey],
      onCurrentChange: function (detail) { return changePage({ detail: detail }); },
      onSizeChange: function (detail) { return changePageSize({ detail: detail }); }
    };
  }

  return { loadList, changePage, changePageSize, syncOptions };
}

export function usePage(config) {
  const options = config || {};
  const pager = usePagination(options);
  const search = createSearchActions(pager.loadList, options.searchWait);
  const deleteRow = options.deleteUrl
    ? createRowDeleteHandler({
      request: options.request,
      self: options.self,
      state: options.state,
      loadList: pager.loadList,
      url: options.deleteUrl,
      confirmMessage: options.deleteMessage || getContracts().messages.deleteConfirm,
      gate: options.deleteGate || null,
      onSuccess: options.onDeleteSuccess || null,
      reloadOnSuccess: options.reloadOnDeleteSuccess !== false
    })
    : null;
  return Object.assign({}, pager, search, { deleteRow: deleteRow });
}

const CONTROLLER_KIT_PLUGIN_NAME = 'controllerKit';

export function createControllerKit(context, options = {}) {
  if (arguments.length === 1 && context && typeof context === 'object'
    && (typeof context.msg === 'function' || typeof context.confirm === 'function')
    && typeof context.request !== 'function') {
    return {
      name: CONTROLLER_KIT_PLUGIN_NAME,
      install() { configureControllerKit(context); }
    };
  }
  const adapter = options.ui || uiAdapter;
  const $msg = options.msg || ((value) => (typeof adapter?.msg === 'function' ? adapter.msg(value) : notify(value)));
  const $confirm = options.confirm || ((message) => (typeof adapter?.confirm === 'function' ? adapter.confirm(message) : confirmDialog(message)));
  const navigateTo = typeof options.navigate === 'function'
    ? options.navigate
    : ((path, data) => context?.navigate?.(path, data));
  const self = { $msg, $confirm, navigateTo };
  const request = options.request || context?.request;
  const actions = createRequestActions({ request, msg: $msg });
  const requireAuth = (AUTH, extra) => requireLogin(AUTH, { $msg, navigateTo, ...(extra || {}) });
  return { context, request, self, $msg, $confirm, navigateTo, actions, requireAuth };
}