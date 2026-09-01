import KniuMvvm from '../../core/kniumvvm.mjs';
import SERVER from '../../config/server.js';
import REQUEST from '../../core/kniurequest.mjs';
import AUTH from '../../core/kniuauth.mjs';

const { controller, onMounted, reactive } = KniuMvvm;

const SYSTEM_FIELDS = [
  'username', 'role', 'role_id', 'role_auth', 'platform', 'arch', 'server', 'ip', 'rootDir', 'mysqlVer', 'uptime', 'totalMemory', 'currentMemory'
];

const homeController = controller(({ formatTime, getTimeInZone, navigateTo, setInterval }) => {
    const state = reactive({
      name: '控制台',
      icon: 'house',
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
      await REQUEST({
        url: '/system',
        type: 'POST',
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