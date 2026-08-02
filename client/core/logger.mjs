import { LOGGER } from '../config/logger.js';

// 日志级别权重：数值越大越严重。
const LEVELS = { TRACE: 0, DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4, FATAL: 5 };

function resolveLogLevel(name) {
  if (typeof name === 'number') return name;
  return LEVELS[String(name).toUpperCase()] ?? LEVELS.INFO;
}

// 本地标准时间 YYYY-MM-DD HH:mm:ss（去掉毫秒与 Z，用空格分隔，按本地时区）。
function padTwoDigits(value) {
  return String(value).padStart(2, '0');
}
function formatTimestamp(date = new Date()) {
  return (
    `${date.getFullYear()}-${padTwoDigits(date.getMonth() + 1)}-${padTwoDigits(date.getDate())} ` +
    `${padTwoDigits(date.getHours())}:${padTwoDigits(date.getMinutes())}:${padTwoDigits(date.getSeconds())}`
  );
}

function formatLogEntry(level, message, meta) {
  const ts = formatTimestamp();
  let body = message;
  if (meta !== undefined) {
    try {
      body += ` ${typeof meta === 'string' ? meta : JSON.stringify(meta)}`;
    } catch {
      body += ` ${String(meta)}`;
    }
  }
  // 输出顺序：消息,级别,时间戳（无空格分隔逗号）。
  return `${body},${level},${ts}`;
}

// 轻量日志收集器：按级别过滤，可同时输出到控制台与文件，并保留内存记录便于「收集」。
export class Logger {
  constructor(options = {}) {
    this.config = { ...LOGGER, ...options };
    this.threshold = resolveLogLevel(this.config.LEVEL);
    // 收集到的日志条目（内存）。
    this.entries = [];
    // 序列化文件写入，避免并发 append 错乱。
    this._writeChain = Promise.resolve();
    this._isNode =
      typeof process !== 'undefined' && process.versions && !!process.versions.node;
  }

  #shouldLog(level) {
    return resolveLogLevel(level) >= this.threshold;
  }

  log(level, message, meta) {
    const lvl = String(level).toUpperCase();
    if (!this.#shouldLog(lvl)) return null;
    const line = formatLogEntry(lvl, message, meta);
    this.entries.push({ time: formatTimestamp(), level: lvl, message, meta });
    if (this.config.CONSOLE) {
      const method =
        lvl === 'ERROR' || lvl === 'FATAL'
          ? 'error'
          : lvl === 'WARN'
            ? 'warn'
            : 'log';
      console[method](line);
    }
    if (this.config.LOGS && this._isNode) this.#appendLogFile(line);
    return line;
  }

  #appendLogFile(line) {
    this._writeChain = this._writeChain.then(async () => {
      try {
        const fs = await import('node:fs/promises');
        const path = await import('node:path');
        const file = path.isAbsolute(this.config.FILE_PATH)
          ? this.config.FILE_PATH
          : path.join(process.cwd(), this.config.FILE_PATH);
        await fs.mkdir(path.dirname(file), { recursive: true });
        let size = 0;
        try {
          ({ size } = await fs.stat(file));
        } catch {
          /* 文件尚不存在 */
        }
        if (size >= this.config.MAX_FILE_SIZE) await this.#rotateLogFiles(fs, path, file);
        await fs.appendFile(file, line + '\n', 'utf8');
      } catch (e) {
        if (this.config.CONSOLE) console.error('[logger] file write failed:', e.message);
      }
    });
  }

  // 超过单文件大小限制时按 .1/.2/... 滚动，保留 MAX_FILES 份。
  async #rotateLogFiles(fs, path, file) {
    const max = this.config.MAX_FILES;
    for (let i = max - 1; i >= 1; i--) {
      const src = i === 1 ? file : `${file}.${i - 1}`;
      const dst = `${file}.${i}`;
      try {
        await fs.rename(src, dst);
      } catch {
        /* 源不存在则跳过 */
      }
    }
    try {
      await fs.rename(file, `${file}.1`);
    } catch {
      /* 忽略 */
    }
  }

  trace(message, meta) {
    return this.log('TRACE', message, meta);
  }
  debug(message, meta) {
    return this.log('DEBUG', message, meta);
  }
  info(message, meta) {
    return this.log('INFO', message, meta);
  }
  warn(message, meta) {
    return this.log('WARN', message, meta);
  }
  error(message, meta) {
    return this.log('ERROR', message, meta);
  }
  fatal(message, meta) {
    return this.log('FATAL', message, meta);
  }

  // 返回收集到的日志条目（可按级别过滤）。
  getLogEntries(level) {
    if (!level) return [...this.entries];
    const threshold = resolveLogLevel(level);
    return this.entries.filter((entry) => resolveLogLevel(entry.level) >= threshold);
  }

  clearLogEntries() {
    this.entries.length = 0;
  }

  // 进程退出前等待所有异步文件写入完成。
  async flushPendingWrites() {
    await this._writeChain;
  }
}

// 默认实例：直接 import { logger } 使用，配置来自 logger.js 的 LOGGER。
export const logger = new Logger();
export default logger;
