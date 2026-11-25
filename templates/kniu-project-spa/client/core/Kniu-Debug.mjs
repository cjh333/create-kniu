import { getContracts } from './Kniu-Contracts.mjs';

export const KNDEBUG = {
  ROUTER: 'router',
  WATCH: 'watch',
  REQUEST: 'request',
  BINDING: 'binding',
  COMPONENT: 'component',
  CONTROLLER: 'controller',
  MVC: 'mvc',
  VIEW: 'view',
  TEMPLATE: 'template',
  SHADOW: 'shadow',
  RUNTIME: 'runtime'
};

const CATEGORY_PREFIX = '[kniu]';
const URL_KEY = 'kniu_debug';
const STORAGE_KEY = 'kniu_debug';
let _forced = null;

function isUrlForced() {
  try {
    const hash = globalThis.location?.hash || '';
    const search = globalThis.location?.search || '';
    return new URLSearchParams((search + '?' + hash.split('?')[1]).split('#')[1]).get(URL_KEY) === '1';
  } catch { return false; }
}

const HAS_BROWSER_STORAGE = typeof document !== 'undefined';

function isStorageForced() {
  if (!HAS_BROWSER_STORAGE) return false;
  try { return globalThis.localStorage?.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

function isEnabled(category) {
  if (_forced == null) _forced = isUrlForced() || isStorageForced();
  if (_forced) return true;
  const cfg = getContracts().debug || {};
  if (!cfg.enabled) return false;
  if (!category || !cfg.categories) return true;
  return Array.isArray(cfg.categories) && cfg.categories.includes(category);
}

function _print(level, category, args) {
  const parts = [CATEGORY_PREFIX];
  if (category) parts.push('[' + category + ']');
  parts.push(...args);
  const target = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  try { target.apply(console, parts); } catch { target(parts.join(' ')); }
}

export function kniuDebug(category, ...args) {
  _record('debug', category, args);
  if (!isEnabled(category)) return;
  _print('log', category, args);
}

export function kniuWarn(category, ...args) {
  _record('warn', category, args);
  if (!isEnabled(category)) return;
  _print('warn', category, args);
}

export function kniuError(category, ...args) {
  _record('error', category, args);
  _print('error', category, args);
}

export function kniuErrorIfDebug(category, ...args) {
  _record('error', category, args);
  if (!isEnabled(category)) return;
  _print('error', category, args);
}

const LOG_CAP = 1000;
const LOG_STORAGE_KEY = 'KNIU_CLI_RUNTIME_LOG';
let _logBuffer = null;

function _ensureBuffer() {
  if (_logBuffer) return _logBuffer;
  _logBuffer = [];
  return _logBuffer;
}

function _record(level, category, args) {
  const buf = _ensureBuffer();
  if (buf.length >= LOG_CAP) buf.shift();
  const stamp = new Date().toISOString();
  const ts = (globalThis.performance?.now?.() || 0).toFixed(1);
  let text = '';
  try {
    text = args.map(function (a) {
      if (a == null) return String(a);
      if (typeof a === 'object') {
        try { return JSON.stringify(a); } catch { return String(a); }
      }
      return String(a);
    }).join(' ');
  } catch { text = '<unserializable>'; }
  buf.push({ t: stamp, ms: ts, lvl: level, cat: category, msg: text });
}

try {
  function _shouldUpload() {
    try { return !!getContracts().debug?.log; } catch { return false; }
  }
  function _uploadLogs() {
    if (!_shouldUpload()) return;
    const buf = _ensureBuffer();
    if (!buf.length) return;
    try {
      const body = JSON.stringify(buf.slice(-LOG_CAP));
      const blob = new Blob([body], { type: 'application/json' });
      if (globalThis.navigator?.sendBeacon) {
        globalThis.navigator.sendBeacon('/__kniu_logs', blob);
      } else {
        fetch('/__kniu_logs', {
          method: 'POST',
          credentials: 'same-origin',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: body
        }).catch(function () { });
      }
    } catch { }
  }
  let _flushTimer = null;
  const DEBOUNCE_MS = 3000;
  function _scheduleFlush() {
    if (!_shouldUpload()) return;
    if (_flushTimer) clearTimeout(_flushTimer);
    _flushTimer = setTimeout(function () {
      _flushTimer = null;
      _uploadLogs();
    }, DEBOUNCE_MS);
  }
  const INTERACTION_EVENTS = ['keydown', 'click', 'touchstart', 'wheel', 'scroll'];
  function _onInteraction() { _scheduleFlush(); }
  INTERACTION_EVENTS.forEach(function (name) {
    try { globalThis.addEventListener?.(name, _onInteraction, { passive: true }); } catch { }
  });

  globalThis.addEventListener?.('beforeunload', function () {
    try {
      const buf = _ensureBuffer();
      if (buf.length) globalThis.localStorage?.setItem(LOG_STORAGE_KEY, JSON.stringify(buf));
    } catch { }
    if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }
    _uploadLogs();
  });
  try {
    const saved = HAS_BROWSER_STORAGE ? globalThis.localStorage?.getItem(LOG_STORAGE_KEY) : null;
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) {
        _ensureBuffer().push(...parsed.slice(-LOG_CAP));
      }
    }
  } catch { }
} catch { }

export const debug = {
  enable() { if (HAS_BROWSER_STORAGE) { try { globalThis.localStorage?.setItem(STORAGE_KEY, '1'); } catch { } } _forced = true; },
  disable() { if (HAS_BROWSER_STORAGE) { try { globalThis.localStorage?.removeItem(STORAGE_KEY); } catch { } } _forced = false; },
  isEnabled() { return _forced == null ? (_forced = isUrlForced() || isStorageForced()) : _forced || !!getContracts().debug?.enabled; },
  categories() { return getContracts().debug?.categories || null; },
  getLog() { return _ensureBuffer().slice(); },
  clearLog() { _logBuffer = []; if (HAS_BROWSER_STORAGE) { try { globalThis.localStorage?.removeItem(LOG_STORAGE_KEY); } catch { } } },
  downloadLog(filename) {
    const buf = _ensureBuffer();
    if (!buf.length) { kniuWarn(KNDEBUG.RUNTIME, 'runtime 日志为空，无可导出'); return; }
    const lines = buf.map(function (e) {
      return '[' + e.t + '] [' + e.ms + 'ms] [' + e.lvl + '] [' + (e.cat || '-') + '] ' + e.msg;
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = filename || ('kniu-runtime-' + ts + '.log');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    try { URL.revokeObjectURL(url); } catch { }
  }
};
try {
  globalThis.kniuDebug = debug;
} catch { }