const PROCESS_ENV = (typeof process !== 'undefined' && process.env) ? (process.env.PROCESS_ENV || process.env.NODE_ENV || 'development') : 'development';
const LOGGER_MAP = {
  development: {
    // 控制台输出。
    CONSOLE: false,
    // 是否生成日志文件。
    LOGS: false,
    // 日志级别：开发=debug（最详细），生产=info。
    LEVEL: PROCESS_ENV === 'development' ? 'debug' : 'info',
    // 日志文件路径。
    FILE_PATH: 'client/runtime/logs/app.log',
    // 日志文件大小限制（5MB）。
    MAX_FILE_SIZE: 1024 * 1024 * 5,
    // 日志文件最大数量。
    MAX_FILES: 3
  },
  production: {
    // 控制台输出。
    CONSOLE: false,
    // 是否生成日志文件。
    LOGS: false,
    // 日志级别：开发=debug（最详细），生产=info。
    LEVEL: PROCESS_ENV === 'development' ? 'debug' : 'info',
    // 日志文件路径。
    FILE_PATH: 'client/runtime/logs/app.log',
    // 日志文件大小限制（5MB）。
    MAX_FILE_SIZE: 1024 * 1024 * 5,
    // 日志文件最大数量。
    MAX_FILES: 3
  }
};
export const LOGGER = LOGGER_MAP[PROCESS_ENV];