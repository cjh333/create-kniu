import { RUNTIME_ENV } from '../core/kniudotenv.mjs';
const SERVER_MAP = {
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
      url: 'http://localhost:9900',
      change_origin: true
    }
  }
};
export default { ...SERVER_MAP, HOST: RUNTIME_ENV.HOST || SERVER_MAP.HOST, PORT: Number(RUNTIME_ENV.PORT) || SERVER_MAP.PORT };