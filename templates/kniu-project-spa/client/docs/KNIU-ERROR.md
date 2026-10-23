# Kniu Error 错误模块使用文档

客户端默认监听全局 `error` 与 `unhandledrejection`，未捕获错误会统一输出 `[kniu] 运行时错误`，业务代码只处理可恢复错误。