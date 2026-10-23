export function installErrorBoundary(app, handler = console.error) {
  const report = (error) => { handler('[kniu] 运行时错误：', error); app.onError?.(error); };
  addEventListener('error', (event) => report(event.error || event));
  addEventListener('unhandledrejection', (event) => report(event.reason || event));
}
export const ERROR = { name: 'error', install(app) { installErrorBoundary(app); } };
