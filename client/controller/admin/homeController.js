import MVVM from '../../core/kniumvvm.mjs';
import SERVER from '../../config/server.js';
import AUTH from '../../core/kniuauth.mjs';
import { createCadence } from '../../core/kniucadence.mjs';

const { controller } = MVVM;

const SYSTEM_FIELDS = [
  'username', 'role', 'role_id', 'role_auth', 'platform', 'arch', 'server', 'ip', 'rootDir', 'mysqlVer', 'uptime', 'totalMemory', 'currentMemory'
];
const CLOCK_INTERVAL_MS = 1000;
const homeController = controller(({ formatTime, getTimeInZone, navigateTo, request, requestAnimationFrame, reactive, onMounted, onUnmounted }) => {
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
    memoryRefreshMs: 0,
    uptimeRefreshMs: 0,
    currentTime: '',
    utcTime: ''
  });

  const cadence = createCadence(requestAnimationFrame);

  function applySystemInfo(systemInfo) {
    SYSTEM_FIELDS.forEach(function assignSystemField(field) {
      const stateField = field === 'mysqlVer' ? 'mysqlVersion' : field;
      state[stateField] = systemInfo[field] || '—';
    });
    state.memoryRefreshMs = Number(systemInfo.memoryRefreshMs) || 0;
    state.uptimeRefreshMs = Number(systemInfo.uptimeRefreshMs) || 0;
  }

  function refreshMemory() {
    request({
      url: '/system',
      type: 'POST',
      data: { scope: 'memory' },
      mutation: false,
      success(res) {
        if (res.status !== 1) return;
        const systemInfo = res.data || {};
        if (systemInfo.currentMemory) state.currentMemory = systemInfo.currentMemory;
        if (systemInfo.totalMemory) state.totalMemory = systemInfo.totalMemory;
      }
    });
  }

  function refreshUptime() {
    request({
      url: '/system',
      type: 'POST',
      data: { scope: 'uptime' },
      mutation: false,
      success(res) {
        if (res.status !== 1) return;
        const systemInfo = res.data || {};
        if (systemInfo.uptime) state.uptime = systemInfo.uptime;
      }
    });
  }

  function updateClock() {
    state.currentTime = formatTime(new Date());
    state.utcTime = formatTime(getTimeInZone(SERVER.TIMEZONE));
  }

  async function loadSystemInfo() {
    await request({
      url: '/system',
      type: 'POST',
      mutation: false,
      success(res) {
        if (res.status !== 1) {
          navigateTo('/login');
          return;
        }
        const systemInfo = res.data || {};
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
      fail() { navigateTo('/login'); }
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