import PROCESS_ENV from '../core/kniuenv.mjs';
const SERVER_MAP = {
  development: {
    // 时区设置。
    TIMEZONE: 'Asia/Shanghai',
    // 域名。
    HOST: 'localhost',
    // 端口号。
    PORT: 6173,
    // 初始页。
    HOME: 'index/home',
    // 视图路径。
    VIEWS: '/client/views',
    // 路径别名。
    ALIAS: {
      '@': './',
      '@style': './public/static/css',
      '@img': './public/static/img',
      '@upload': './public/upload',
      '@plugin': './public/static/plugin',
      '@kniu': './public/static/plugin/kniu'
    },
    // API 代理。
    PROXY: {
      '/api': {
        URL: 'http://localhost:9900',
        CHANGE_ORIGIN: true
      }
    }
  },
  production: {
    // 时区设置。
    TIMEZONE: 'Asia/Shanghai',
    // 域名。
    HOST: '',
    // 端口号。
    PORT: 6173,
    // 初始页。
    HOME: 'index/home',
    // 视图路径。
    VIEWS: '/client/views',
    // 路径别名。
    ALIAS: {
      '@': './',
      '@style': './public/static/css',
      '@img': './public/static/img',
      '@upload': './public/upload',
      '@plugin': './public/static/plugin',
      '@kniu': './public/static/plugin/kniu'
    },
    // API 代理。
    PROXY: {
      '/api': {
        URL: '',
        CHANGE_ORIGIN: true
      }
    }
  }
};
export default SERVER_MAP[PROCESS_ENV];