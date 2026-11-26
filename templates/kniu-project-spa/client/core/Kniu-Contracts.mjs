export const DEFAULT_FONT_FAMILY = 'KniuSans_Regular';
export const DEFAULT_FONT_BASE = '/public/static/font/';
export const DEFAULT_WEB_CSS_PATTERN = /\/public\/static\/css\/web(?:\.[a-f0-9]+)?\.min\.css$/i;

const clonePlain = (value) => {
  if (Array.isArray(value)) return value.slice();
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return value;
  return Object.keys(value).reduce((result, key) => {
    result[key] = clonePlain(value[key]);
    return result;
  }, {});
};

const isPlainObject = (value) => !!value && typeof value === 'object'
  && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

const merge = (base, patch) => {
  if (!patch || typeof patch !== 'object') return base;
  Object.keys(patch).forEach((key) => {
    const value = patch[key];
    if (value === undefined) return;
    const current = base[key];
    if (isPlainObject(value) && isPlainObject(current)) {
      merge(current, value);
    } else {
      base[key] = clonePlain(value);
    }
  });
  return base;
};

function createDefaultContracts() {
  return {
    response: {
      statusField: 'status',
      messageField: 'msg',
      dataField: 'data',
      successValues: [1],
      failureValue: 0,
      codeField: 'code',
      recordsOf: (payload, contracts) => {
        if (Array.isArray(payload)) return payload;
        if (!payload || typeof payload !== 'object') return [];
        const inner = payload[contracts.response.dataField];
        return Array.isArray(inner) ? inner : [payload];
      }
    },
    pagination: {
      pageField: 'page_current',
      rowsField: 'page_rows',
      currentField: 'page_current',
      totalPagesField: 'page_total',
      totalField: 'total',
      defaultPageSize: 20,
      fallbackPageSize: 10,
      maxPageSize: 200
    },
    auth: {
      loginRoute: '/',
      anonymousRoutes: [],
      privateRoutePrefixes: [],
      identityStatusCodes: [1001, 1006],
      sessionBodyKey: 'identityToken',
      identityFailureCodes: [1001, 1006, 'AUTH_EXPIRED', 'AUTH_INVALID'],
      identityFailureHttpStatus: [401],
      redirectParam: 'redirect',
      loginRedirect: (route, contracts) => `#${contracts.auth.loginRoute}?${contracts.auth.redirectParam}=${encodeURIComponent(route)}`
    },
    http: {
      apiPrefix: '/api',
      csrfHeader: 'X-CSRF-Token',
      csrfCookie: 'KNIU_CLI_XSRF_TOKEN',
      authScheme: 'Bearer',
      uploadFileField: 'file',
      csrfRotateStatus: 403,
      csrfRotateCode: 1008,
      parseBody: null
    },
    roles: {
      isAdmin: (user) => {
        const source = user || {};
        return Number(source.roleId || source.role || 0) === 1 || Number(source.roleAuth || 0) === 1;
      },
      isSuper: (user) => Number((user || {}).roleId || (user || {}).role || 0) === 1
    },
    paths: {
      templates: '/client/views/',
      controllers: '/client/controller/',
      manifest: '/templates.js',
      publicBase: '/public',
      customComponents: '../custom',
      uploadPrefix: '/upload/',
      fontBase: DEFAULT_FONT_BASE,
      webCssPattern: DEFAULT_WEB_CSS_PATTERN,
      templatesGlobal: '__VIEW_TEMPLATES__',
      docsGlobal: '__VIEW_DOCS__',
      hmrDispatcherGlobal: '__KNIU_HMR_DISPATCH__',
      hmrSourceGlobal: '__KNIU_HMR_SOURCE__'
    },
    router: {
      mode: 'hash',
      base: '',
      unknownRoute: 'home',
      scrollBehavior: 'top',
      layoutContainerSelector: null,
      isInternalLink: (href, mode) => (mode === 'history' ? String(href || '').startsWith('/') : String(href || '').startsWith('#/')),
      toHref: (path, mode, separator) => `${mode === 'history' ? '' : separator}${path}`,
      fromLocation: (address, mode, separator, fallback) => {
        const raw = mode === 'history'
          ? `${address?.pathname || ''}${address?.search || ''}`
          : String(address?.hash || '');
        const value = mode === 'history' ? raw : raw.replace(separator, '');
        const path = value.split(/[?#]/)[0] || fallback;
        return path;
      }
    },
    messages: {
      requestFailed: '请求失败',
      operationFailed: '操作失败',
      saveSuccess: '已更新',
      loginRequired: '请先登录',
      loadFailed: '加载失败',
      deleteFailed: '删除失败',
      deleteSuccess: '删除成功!',
      deleteConfirm: '此操作将永久删除该条数据, 是否继续?',
      loginExpired: '登录已失效，请重新登录',
      confirmTitle: '提示',
      confirmText: '确定',
      requestClientMissing: '请求客户端未注入（createControllerKit 需传 { request }）',
      mountNodeMissing: '找不到挂载节点：',
      logoutFailed: '退出登录失败',
      manifestLoadFailed: '模板清单加载失败：'
    },
    uiText: {},
    theme: {
      fontFamily: DEFAULT_FONT_FAMILY,
      fontMonoFamily: DEFAULT_FONT_FAMILY,
      fontSerifFamily: DEFAULT_FONT_FAMILY,
      presets: {
        light: {},
        dark: {
          '--kniu-color-primary': '#5b9cff',
          '--kniu-color-primary-hover': '#8ab8ff',
          '--kniu-color-primary-light': '#24334a',
          '--kniu-color-primary-lighter': '#1d2a3d',
          '--kniu-text-color': '#d6dae1',
          '--kniu-text-color-disabled': '#6b7280',
          '--kniu-border-color': '#3a414d',
          '--kniu-border-color-light': '#2d333d',
          '--kniu-fill-color': '#292f39',
          '--kniu-fill-color-dark': '#222731',
          '--kniu-surface-color': '#1f2329'
        }
      }
    },
    assets: {
      defaultAvatar: null
    },
    debug: {
      enabled: false,
      categories: null
    },
    limits: {
      requestTimeout: 15_000,
      workerTimeout: 30_000,
      debounceWait: 250,
      refreshDebounceWait: 150,
      cacheLimit: 200,
      proxyCacheLimit: 120,
      shadowCacheLimit: 200,
      breakpointSmall: 220,
      breakpointLarge: 1920,
      containedMinVisible: 360,
      containedSettle: 200,
      requestTrackingTimeout: 16_000,
      editorDebounceWait: 150,
      reconnectMaxDelay: 30_000,
      loopGuardLimit: 4_000,
      affixTemplateDeadline: 50
    },
    i18n: {}
  };
}

let contracts = createDefaultContracts();

export function configureContracts(patch) {
  return merge(contracts, patch);
}

export function getContracts() {
  return contracts;
}

export function limitValue(key, fallback) {
  const value = contracts.limits?.[key];
  return Number.isFinite(value) ? value : fallback;
}

export function resetContracts() {
  contracts = createDefaultContracts();
  return contracts;
}

export const DEFAULT_CONTRACTS = createDefaultContracts();

export function isSuccessResponse(result) {
  if (!result || typeof result !== 'object') return false;
  const { statusField, successValues } = contracts.response;
  return successValues.includes(result[statusField]);
}

export function responseMessage(result, fallback) {
  const { messageField } = contracts.response;
  return (result && result[messageField]) || fallback || contracts.messages.requestFailed;
}

export function responseData(result) {
  return result ? result[contracts.response.dataField] : undefined;
}

export function responseRecords(payload) {
  const { recordsOf } = contracts.response;
  return typeof recordsOf === 'function' ? recordsOf(payload, contracts) : [];
}

export function failureResult(message) {
  const { statusField, messageField, failureValue } = contracts.response;
  return { [statusField]: failureValue, [messageField]: message || contracts.messages.requestFailed };
}

export function paginationRequest(page, rows, extra = {}) {
  const { pageField, rowsField } = contracts.pagination;
  return { [pageField]: page, [rowsField]: rows, ...extra };
}

export function readPagination(payload) {
  const p = contracts.pagination;
  const source = payload || {};
  return {
    current: source[p.currentField] || 1,
    totalPages: source[p.totalPagesField] || 1,
    total: source[p.totalField] || 0
  };
}

export function normalizeRoute(path) {
  return String(path || '').replace(/^#/, '').split('?')[0];
}

export function routeSeparator(mode) {
  return mode === 'history' ? '' : '#';
}

export function routeHref(path, contracts) {
  const router = contracts?.router || {};
  const mode = router.mode || 'hash';
  const value = normalizeRoute(path);
  const base = String(router.base || '').replace(/\/$/, '');
  if (mode === 'history') return `${base}${value.startsWith('/') ? value : `/${value}`}`;
  if (typeof router.toHref === 'function') return router.toHref(value, mode, routeSeparator(mode));
  return `${routeSeparator(mode)}${value}`;
}

export function routeFromLocation(location, contracts, fallback = '/') {
  const router = contracts?.router || {};
  const mode = router.mode || 'hash';
  if (typeof router.fromLocation === 'function') return router.fromLocation(location, mode, routeSeparator(mode), fallback);
  return normalizeRoute(location?.hash || '') || fallback;
}

export function isAnonymousRoute(path) {
  const auth = contracts.auth;
  const value = normalizeRoute(path);
  if (value === auth.loginRoute) return true;
  return Array.isArray(auth.anonymousRoutes) && auth.anonymousRoutes.includes(value);
}

export function isPrivateRoute(path) {
  const value = normalizeRoute(path);
  const prefixes = Array.isArray(contracts.auth.privateRoutePrefixes)
    ? contracts.auth.privateRoutePrefixes : [];
  return prefixes.some((prefix) => {
    if (!prefix) return false;
    return value === prefix || value.startsWith(`${prefix}/`);
  });
}

export function isIdentityErrorCode(status) {
  const codes = contracts.auth.identityStatusCodes;
  return Array.isArray(codes) ? codes.includes(status) : false;
}

export function identityFailureCodes() {
  return contracts.auth.identityFailureCodes;
}

export function isIdentityFailure(result) {
  if (!result) return false;
  const auth = contracts.auth;
  const body = result.data && typeof result.data === 'object' ? result.data : null;
  const code = body ? (body[contracts.response.statusField] ?? body[contracts.response.codeField]) : undefined;
  if (auth.identityFailureCodes.includes(code)) return true;
  return auth.identityFailureHttpStatus.includes(result.status);
}

export function sessionBody(token) {
  return { [contracts.auth.sessionBodyKey]: token };
}

export function loginRedirectHash(route) {
  const { loginRedirect } = contracts.auth;
  return typeof loginRedirect === 'function'
    ? loginRedirect(route, contracts)
    : `#${contracts.auth.loginRoute}?${contracts.auth.redirectParam}=${encodeURIComponent(route)}`;
}

export function isAdminUser(user) {
  return typeof contracts.roles.isAdmin === 'function' ? !!contracts.roles.isAdmin(user, contracts) : false;
}

export function isSuperUser(user) {
  return typeof contracts.roles.isSuper === 'function' ? !!contracts.roles.isSuper(user, contracts) : false;
}

export function applyContractNavFlags(state, user) {
  if (typeof contracts.roles.navFlags === 'function') contracts.roles.navFlags(state, user, contracts);
  return state;
}

export function translatedText(lang, key) {
  const dict = contracts.i18n?.[lang] || contracts.i18n?.cn;
  return dict && Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : undefined;
}

export function configureI18n(dictionary) {
  return configureContracts({ i18n: dictionary && typeof dictionary === 'object' ? dictionary : {} });
}