const runtimeProcessEnv = typeof process !== 'undefined' && process.env
  ? process.env.PROCESS_ENV || process.env.NODE_ENV
  : '';
export default globalThis.PROCESS_ENV || runtimeProcessEnv || 'development';