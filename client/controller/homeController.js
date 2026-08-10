import { SERVER } from '../config/server.js';
import { AUTH } from '../core/kniuauth.mjs';
import { REQUEST } from '../core/kniurequest.mjs';
import { defineComponent, onMounted, reactive, toRefs } from '../core/kniumvvm.mjs';

const SYSTEM_FIELDS = [
  'username', 'role', 'platform', 'arch', 'server', 'ip', 'rootDir',
  'mysqlVer', 'uptime', 'totalMemory', 'currentMemory'
];

export const homeController = defineComponent({
  setup({ formatTime, getTimeInZone, navigateTo, setInterval }) {
    const state = reactive({
      name: '控制台',
      icon: '⌂',
      color: '#ff5c35',
      loading: true,
      isAuthenticated: false,
      error: null,
      username: '—',
      role: '—',
      platform: '—',
      arch: '—',
      server: '—',
      ip: '—',
      rootDir: '—',
      mysqlVersion: '—',
      uptime: '—',
      totalMemory: '—',
      currentMemory: '—',
      currentTime: '',
      utcTime: ''
    });

    function updateClock() {
      state.currentTime = formatTime(new Date());
      state.utcTime = formatTime(getTimeInZone(SERVER.TIMEZONE));
    }

    async function loadSystemInfo() {
      const result = await REQUEST({ url: '/system', type: 'POST' });
      if (result.status !== 1) {
        navigateTo('/login');
        return;
      }
      const systemInfo = result.data || {};
      SYSTEM_FIELDS.forEach(function assignSystemField(field) {
        const stateField = field === 'mysqlVer' ? 'mysqlVersion' : field;
        state[stateField] = systemInfo[field] || '—';
      });
      state.loading = false;
      state.isAuthenticated = true;
      if (state.username !== '—') {
        AUTH.setUser({
          name: state.username,
          avatar: state.username.charAt(0),
          role: state.role !== '—' ? state.role : '管理员'
        });
      }
    }

    onMounted(() => {
      updateClock();
      setInterval(updateClock, 1000);
      loadSystemInfo();
    });

    toRefs(state);
  }
});
