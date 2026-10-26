export function installErrorBoundary(app, handler = console.error) {
  // 幂等守卫：多次调用只注册一次，避免同一错误重复上报（与 observability 规则 289 同类）。
  if (installErrorBoundary.installed) return app;
  installErrorBoundary.installed = true;
  const report = (error) => {
    handler('[kniu] 运行时错误：', error);
    app.onError?.(error);
    if (typeof globalThis.dispatchEvent === 'function') {
      try { globalThis.dispatchEvent(new CustomEvent('kniu:runtime-error', { detail: error })); } catch {}
    }
  };
  addEventListener('error', (event) => report(event.error || event));
  addEventListener('unhandledrejection', (event) => report(event.reason || event));
  return app;
}
export const ERROR = { name: 'error', install(app) { installErrorBoundary(app); } };
