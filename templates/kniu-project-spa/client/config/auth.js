import FRAMEWORK_CONFIG from '../client.config.js';

// 认证协议注入点；业务项目按后端契约覆盖 client/client.config.js 的 auth 字段。
export default FRAMEWORK_CONFIG.auth || {};
