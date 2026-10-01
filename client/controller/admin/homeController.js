import MVVM from '../../core/kniumvvm.mjs';
import SERVER from '../../config/server.js';
import AUTH from '../../core/kniuauth.mjs';

const { controller } = MVVM;

const SYSTEM_FIELDS = [
  'username', 'role', 'role_id', 'role_auth', 'platform', 'arch', 'server', 'ip', 'rootDir', 'mysqlVer', 'uptime', 'totalMemory', 'currentMemory'
];

const homeController = controller(({ formatTime, getTimeInZone, navigateTo, request, setInterval, reactive, onMounted }) => {
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
      currentTime: '',
      utcTime: ''
    });

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
              role: state.role !== '—' ? state.role : '管理员',
              roleId: Number(state.role_id || 0),
              roleAuth: Number(state.role_auth || 0)
            });
          }
        },
        fail() { navigateTo('/login'); }
      });
    }

    onMounted(() => {
      updateClock();
      setInterval(updateClock, 1000);
      loadSystemInfo();
    });

    return { state };
});

export default homeController;
