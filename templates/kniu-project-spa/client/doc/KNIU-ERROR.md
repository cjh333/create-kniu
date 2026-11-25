# Kniu Error 错误模块使用文档

客户端默认监听全局 `error` 与 `unhandledrejection`，未捕获错误会统一输出 `[kniu] 运行时错误`，业务代码只处理可恢复错误。

- 仅未捕获的 JS 运行时异常（`ErrorEvent`）会触发 `[kniu] 运行时错误` 上报。
- DOM 资源加载失败（img/script/link 等）与组件派发的冒泡 `error` 事件（如 `<kniu-image>` 图片加载失败时 `dispatchEvent(new Event('error', { bubbles: true, composed: true }))`）属于普通 `Event`，不会误报为运行时错误。
- `unhandledrejection` 上报的 `event.reason` 可能是非 Error 值（字符串/Promise），按原样记录。