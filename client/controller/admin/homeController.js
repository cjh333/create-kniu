import MVVM from '../../core/kniumvvm.mjs';
import SERVER from '../../config/server.js';
import AUTH from '../../core/kniuauth.mjs';
import { createCadence } from '../../core/kniucadence.mjs';
import { requireLogin } from './adminShared.js';

const { controller } = MVVM;

const SYSTEM_FIELDS = [
  'username', 'role', 'role_id', 'role_auth', 'platform', 'arch', 'server', 'ip', 'rootDir', 'mysqlVer', 'uptime', 'totalMemory', 'currentMemory', 'uploadMaxSize'
];
const CLOCK_INTERVAL_MS = 1000;
const SYSTEM_CACHE_KEY = 'kniu_admin_system_info_' + SERVER.VERSION;
const homeController = controller(({ formatTime, getTimeInZone, navigateTo, request, requestAnimationFrame, reactive, $msg, onMounted, onUnmounted }) => {
  const state = reactive({
    name: '控制台',
    icon: 'home',
    color: '#ff5c35',
    loading: true,
    isAuthenticated: false,
    error: null,
    username: '—',
    role: '—',
    role_id: 0,
    role_auth: 0,
    platform: '—',
    arch: '—',
    server: '—',
    ip: '—',
    rootDir: '—',
    mysqlVersion: '—',
    uptime: '—',
    totalMemory: '—',
    currentMemory: '—',
    uploadMaxSize: '—',
    memoryRefreshMs: 0,
    uptimeRefreshMs: 0,
    currentTime: '',
    utcTime: ''
  });

  const cadence = createCadence(requestAnimationFrame);

  function readSystemCache() {
    try {
      const cached = JSON.parse(globalThis.sessionStorage?.getItem(SYSTEM_CACHE_KEY) || '');
      return cached && typeof cached === 'object' ? cached : null;
    } catch (_) { return null; }
  }

  function writeSystemCache(systemInfo) {
    try { globalThis.sessionStorage?.setItem(SYSTEM_CACHE_KEY, JSON.stringify(systemInfo)); } catch (_) { }
  }

  function applySystemInfo(systemInfo) {
    SYSTEM_FIELDS.forEach(function assignSystemField(field) {
      const stateField = field === 'mysqlVer' ? 'mysqlVersion' : field;
      state[stateField] = systemInfo[field] || '—';
    });
    state.memoryRefreshMs = Number(systemInfo.memoryRefreshMs) || 0;
    state.uptimeRefreshMs = Number(systemInfo.uptimeRefreshMs) || 0;
  }

  function refreshMemory() {
    return request({
      url: '/system',
      type: 'POST',
      data: { scope: 'memory' },
      mutation: false,
      redirectOnUnauthorized: false,
      success(res) {
        if (res.status !== 1) return;
        const systemInfo = res.data || {};
        if (systemInfo.currentMemory) state.currentMemory = systemInfo.currentMemory;
        if (systemInfo.totalMemory) state.totalMemory = systemInfo.totalMemory;
        if (Number(systemInfo.memoryRefreshMs) > 0) state.memoryRefreshMs = Number(systemInfo.memoryRefreshMs);
      }
    });
  }

  function refreshUptime() {
    return request({
      url: '/system',
      type: 'POST',
      data: { scope: 'uptime' },
      mutation: false,
      redirectOnUnauthorized: false,
      success(res) {
        if (res.status !== 1) return;
        const systemInfo = res.data || {};
        if (systemInfo.uptime) state.uptime = systemInfo.uptime;
        if (Number(systemInfo.uptimeRefreshMs) > 0) state.uptimeRefreshMs = Number(systemInfo.uptimeRefreshMs);
      }
    });
  }

  function updateClock() {
    state.currentTime = formatTime(new Date());
    state.utcTime = formatTime(getTimeInZone(SERVER.TIMEZONE));
  }

  async function loadSystemInfo() {
    if (!requireLogin(AUTH, { $msg, navigateTo })) {
      state.loading = false;
      return;
    }
    const cachedInfo = readSystemCache();
    if (cachedInfo) {
      applySystemInfo(cachedInfo);
      state.loading = false;
      state.isAuthenticated = true;
    }
    await request({
      url: '/system',
      type: 'POST',
      mutation: false,
      success(res) {
        if (res.status !== 1) {
          state.loading = false;
          state.error = res.msg || '系统信息加载失败';
          return;
        }
        const systemInfo = res.data || {};
        const previous = cachedInfo ? JSON.stringify(cachedInfo) : '';
        const next = JSON.stringify(systemInfo);
        if (next !== previous) writeSystemCache(systemInfo);
        applySystemInfo(systemInfo);
        state.loading = false;
        state.isAuthenticated = true;
        if (state.username !== '—') {
          AUTH.setUser({
            name: state.username,
            avatar: state.username.charAt(0),
            role: state.role !== '—' ? state.role : '管理员',
            roleId: Number(state.role_id || 0),
            roleAuth: Number(state.role_auth || 0)
          });
        }
      },
      fail() {
        state.loading = false;
        state.error = '网络异常，请稍后重试';
      }
    });
  }

  cadence.every('clock', CLOCK_INTERVAL_MS, updateClock);
  cadence.every('memory', () => state.memoryRefreshMs, refreshMemory);
  cadence.every('uptime', () => state.uptimeRefreshMs, refreshUptime);

  onMounted(() => {
    updateClock();
    loadSystemInfo();
  });

  onUnmounted(() => { cadence.stop(); });

  return { state };
});

export default homeController;