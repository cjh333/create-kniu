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

  /**
   * 刷新「可用内存」。返回 Promise 是必需的：调度器据此判断上一轮是否落地，
   * 保证同一任务同时在途的请求永远只有 1 个；失败则 reject 触发退避。
   *
   * 轮询请求一律 `redirectOnUnauthorized: false`：会话过期由首屏那次 `/system` 统一处理，
   * 探测请求再跳一次登录只会和它抢着改 hash。
   */
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
    }).then(function ensureSuccess(result) {
      if (!result || result.status !== 1) throw new Error('[admin] 可用内存刷新失败');
      return result;
    });
  }

  /**
   * 刷新「运行时间」。同 `refreshMemory()`：返回 Promise + 失败 reject。
   *
   * 必须采纳响应里的 `uptimeRefreshMs`：后端在「开机不足 1 分钟」时会下调到 1000ms，
   * 跨过 1 分钟后要回到 60000ms —— 前端若不回写，就会把 1 秒档一直粘到页面关闭。
   */
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
    }).then(function ensureSuccess(result) {
      if (!result || result.status !== 1) throw new Error('[admin] 运行时间刷新失败');
      return result;
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