import LOGGER from '../config/logger.js';

var KniuLogger = (function () {
  const LEVELS = { TRACE: 0, DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4, FATAL: 5 };

  function resolveLogLevel(name) {
    if (typeof name === 'number') return name;
    return LEVELS[String(name).toUpperCase()] ?? LEVELS.INFO;
  }

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
    return `${body},${level},${ts}`;
  }

  class LoggerService {
    constructor(options = {}) {
      this.config = { ...LOGGER, ...options };
      this.threshold = resolveLogLevel(this.config.LEVEL);
      this.entries = [];
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
      this._writeChain = this._writeChain.then(async function () {
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
          } catch { }
          if (size >= this.config.MAX_FILE_SIZE) await this.#rotateLogFiles(fs, path, file);
          await fs.appendFile(file, line + '\n', 'utf8');
        } catch (e) {
          if (this.config.CONSOLE) console.error('[logger] file write failed:', e.message);
        }
      }.bind(this));
    }

    async #rotateLogFiles(fs, path, file) {
      const max = this.config.MAX_FILES;
      for (let i = max - 1; i >= 1; i--) {
        const src = i === 1 ? file : `${file}.${i - 1}`;
        const dst = `${file}.${i}`;
        try {
          await fs.rename(src, dst);
        } catch { }
      }
      try {
        await fs.rename(file, `${file}.1`);
      } catch { }
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

    getLogEntries(level) {
      if (!level) return [...this.entries];
      const threshold = resolveLogLevel(level);
      return this.entries.filter(function (entry) { return resolveLogLevel(entry.level) >= threshold; });
    }

    clearLogEntries() {
      this.entries.length = 0;
    }

    async flushPendingWrites() {
      await this._writeChain;
    }
  }

  const appLogger = new LoggerService();
  return { LoggerService: LoggerService, appLogger: appLogger };
}());

export const appLogger = KniuLogger.appLogger;
export default KniuLogger;