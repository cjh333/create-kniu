export const SERVER = {
  // 进程环境。
  PROCESS_ENV: (typeof process !== 'undefined') ? (process.env?.PROCESS_ENV || 'development') : 'development',
  // 域名。
  HOST: 'localhost',
  // 端口号。
  PORT: 6173
};
