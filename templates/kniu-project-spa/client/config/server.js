import FRAMEWORK_CONFIG from '../client.config.js';

// 构建器的项目基座注入点；唯一配置源为 client/client.config.js。
export default { server: FRAMEWORK_CONFIG.server || {} };
