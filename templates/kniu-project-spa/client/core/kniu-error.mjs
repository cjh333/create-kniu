export function reportRuntimeError(error, label = '') {
  console.error(`[kniu] 组件回调异常${label ? `（${label}）` : ''}：`, error);
  if (typeof globalThis.dispatchEvent === 'function' && typeof globalThis.CustomEvent === 'function') {
    try {
      globalThis.dispatchEvent(new globalThis.CustomEvent('kniu:runtime-error', { detail: error }));
    } catch { }
  }
}

export function invokeComponentCallback(handler, payload, label = '') {
  if (typeof handler !== 'function') return false;
  try {
    handler(typeof payload === 'function' ? payload() : payload);
  } catch (error) {
    reportRuntimeError(error, label);
  }
  return true;
}

function optionSources(element) {
  return [element.options, element._options, element.__kniuOptions, element.__kniuOptionsValue];
}

export function hasOptionCallback(element, name) {
  if (!element) return false;
  const sources = optionSources(element);
  for (let i = 0; i < sources.length; i += 1) {
    const source = sources[i];
    if (source && typeof source === 'object' && typeof source[name] === 'function') return true;
  }
  return false;
}

export function invokeOptionCallback(element, name, payload, label = '') {
  if (!element) return false;
  const sources = optionSources(element);
  for (let i = 0; i < sources.length; i += 1) {
    const source = sources[i];
    if (!source || typeof source !== 'object') continue;
    const handler = source[name];
    if (typeof handler === 'function') return invokeComponentCallback(handler, payload, label || name);
  }
  return false;
}

export function installErrorBoundary(app, handler = console.error) {
  if (installErrorBoundary.installed) return app;
  installErrorBoundary.installed = true;
  const isResizeObserverNotification = (error) => /ResizeObserver loop (?:completed with undelivered notifications|limit exceeded)/i
    .test(String(error?.message || error || ''));
  const report = (error) => {
    if (isResizeObserverNotification(error)) return;
    handler('[kniu] 运行时错误：', error);
    app.onError?.(error);
    if (typeof globalThis.dispatchEvent === 'function') {
      try { globalThis.dispatchEvent(new CustomEvent('kniu:runtime-error', { detail: error })); } catch { }
    }
  };
  addEventListener('error', (event) => {
    if (event instanceof ErrorEvent) report(event.error || event);
  });
  addEventListener('unhandledrejection', (event) => report(event.reason || event));
  return app;
}
export const ERROR = { name: 'error', install(app) { installErrorBoundary(app); } };