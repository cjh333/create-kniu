import { limitValue } from './Kniu-Contracts.mjs';

const DEFAULTS = {
  protocols: [],
  heartbeatInterval: 25_000,
  heartbeatMessage: 'ping',
  reconnect: true,
  reconnectDelay: 1_000,
  reconnectMaxRetries: Infinity,
  queueLimit: 100
};

function createEmitter() {
  const handlers = new Map();
  const on = (name, handler) => {
    if (typeof handler !== 'function') return () => { };
    const set = handlers.get(name) || new Set();
    set.add(handler);
    handlers.set(name, set);
    return () => set.delete(handler);
  };
  const off = (name, handler) => {
    const set = handlers.get(name);
    if (set) set.delete(handler);
  };
  const emit = (name, ...args) => {
    const set = handlers.get(name);
    if (!set) return;
    [...set].forEach((handler) => {
      try { handler(...args); } catch (error) { console.error(`[kniu-protocol] 事件处理器异常（${name}）：`, error); }
    });
  };
  return { on, off, emit };
}

function createSocketTransport(url, options, emitter) {
  const transport = {
    type: 'websocket',
    socket: null,
    isOpen: false,
    open() {
      if (transport.socket) return;
      const socket = new WebSocket(url, options.protocols);
      socket.onopen = () => {
        transport.isOpen = true;
        options.attempts = 0;
        options.scheduleHeartbeat();
        emitter.emit('open');
      };
      socket.onmessage = (event) => {
        options.touchHeartbeat();
        const raw = event.data;
        if (raw === options.heartbeatMessage) return;
        let data = raw;
        try { data = JSON.parse(raw); } catch { }
        emitter.emit('message', data);
        if (data && typeof data === 'object' && typeof data.type === 'string') emitter.emit(data.type, data);
      };
      socket.onclose = () => {
        transport.isOpen = false;
        transport.socket = null;
        options.cancelHeartbeat();
        emitter.emit('close');
        options.scheduleReconnect();
      };
      socket.onerror = (event) => emitter.emit('error', event);
      transport.socket = socket;
    },
    send(data) {
      if (!transport.socket || transport.socket.readyState !== WebSocket.OPEN) return false;
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      transport.socket.send(payload);
      return true;
    },
    close(code, reason) {
      options.cancelReconnect();
      options.cancelHeartbeat();
      if (transport.socket) {
        transport.socket.onclose = null;
        transport.socket.close(code, reason);
        transport.socket = null;
      }
      transport.isOpen = false;
    }
  };
  return transport;
}

function createSseTransport(url, options, emitter) {
  const transport = {
    type: 'sse',
    source: null,
    isOpen: false,
    open() {
      if (transport.source) return;
      const source = new EventSource(url, { withCredentials: options.withCredentials === true });
      source.onopen = () => {
        transport.isOpen = true;
        options.attempts = 0;
        emitter.emit('open');
      };
      source.onmessage = (event) => {
        let data = event.data;
        try { data = JSON.parse(event.data); } catch { }
        emitter.emit('message', data);
        if (data && typeof data === 'object' && typeof data.type === 'string') emitter.emit(data.type, data);
      };
      source.onerror = (event) => {
        transport.isOpen = false;
        emitter.emit('error', event);
        if (source.readyState === EventSource.CLOSED) {
          transport.source = null;
          options.scheduleReconnect();
        }
      };
      transport.source = source;
    },
    send() { return false; },
    close() {
      options.cancelReconnect();
      if (transport.source) {
        transport.source.onerror = null;
        transport.source.close();
        transport.source = null;
      }
      transport.isOpen = false;
    }
  };
  return transport;
}

export function createProtocol(options = {}) {
  const config = { ...DEFAULTS, reconnectMaxDelay: limitValue('reconnectMaxDelay', 30_000), ...options };
  const url = String(config.url || '');
  if (!url) throw new TypeError('[kniu-protocol] createProtocol() 需要提供 url');
  const kind = String(config.type || (url.startsWith('ws') ? 'websocket' : 'sse')).toLowerCase();
  if (kind !== 'websocket' && kind !== 'sse') {
    throw new TypeError(`[kniu-protocol] 不支持的协议类型：${kind}（仅支持 websocket / sse）`);
  }

  const emitter = createEmitter();
  const state = {
    attempts: 0,
    reconnectTimer: 0,
    heartbeatTimer: 0,
    queue: [],
    disposed: false
  };

  const cancelReconnect = () => { if (state.reconnectTimer) clearTimeout(state.reconnectTimer); state.reconnectTimer = 0; };
  const scheduleReconnect = () => {
    if (state.disposed || config.reconnect !== true) return;
    if (state.attempts >= config.reconnectMaxRetries) { emitter.emit('reconnect-failed'); return; }
    state.attempts += 1;
    const delay = Math.min(config.reconnectDelay * 2 ** (state.attempts - 1), config.reconnectMaxDelay);
    state.reconnectTimer = setTimeout(() => { state.reconnectTimer = 0; transport.open(); }, delay);
    emitter.emit('reconnect-schedule', { attempt: state.attempts, delay });
  };
  const cancelHeartbeat = () => { if (state.heartbeatTimer) clearTimeout(state.heartbeatTimer); state.heartbeatTimer = 0; };
  const scheduleHeartbeat = () => {
    if (kind !== 'websocket' || !config.heartbeatInterval) return;
    cancelHeartbeat();
    state.heartbeatTimer = setInterval(() => {
      if (transport.isOpen) transport.send(config.heartbeatMessage);
    }, config.heartbeatInterval);
  };
  const touchHeartbeat = () => { };

  const transport = kind === 'websocket'
    ? createSocketTransport(url, { ...config, scheduleReconnect, cancelReconnect, scheduleHeartbeat, cancelHeartbeat, touchHeartbeat }, emitter)
    : createSseTransport(url, { ...config, scheduleReconnect, cancelReconnect, scheduleHeartbeat, cancelHeartbeat, touchHeartbeat }, emitter);

  const send = (data) => {
    if (transport.isOpen) return transport.send(data);
    if (state.queue.length < config.queueLimit) state.queue.push(data);
    return false;
  };

  const flush = () => {
    while (state.queue.length && transport.isOpen) transport.send(state.queue.shift());
  };

  emitter.on('open', flush);

  return Object.freeze({
    type: kind,
    url,
    get isOpen() { return transport.isOpen; },
    get attempts() { return state.attempts; },
    on: emitter.on,
    off: emitter.off,
    send,
    flush,
    open: transport.open,
    close: transport.close,
    dispose() {
      state.disposed = true;
      transport.close();
      state.queue.length = 0;
    }
  });
}

export function createProtocolPlugin(options = {}) {
  return {
    name: 'protocol',
    install(app) {
      app.protocol = { create: createProtocol };
      if (options.default) {
        const instance = createProtocol(options.default);
        app.protocol.default = instance;
      }
    }
  };
}