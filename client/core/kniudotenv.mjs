const IS_NODE = typeof process !== 'undefined' && !!(process.versions && process.versions.node);
const nodeFs = IS_NODE ? await import('node:fs').catch(function () { return null; }) : null;

function parseEnv(source = '') {
  return source.split(/\r?\n/).reduce(function (env, line) {
    const content = line.trim();
    if (!content || content.startsWith('#') || !content.includes('=')) return env;
    const separator = content.indexOf('=');
    const name = content.slice(0, separator).trim();
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(name)) return env;
    let value = content.slice(separator + 1).trim();
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    env[name] = value;
    return env;
  }, {});
}

function loadEnv() {
  let env = {};
  if (!nodeFs || typeof process === 'undefined' || !process.env) return env;
  try {
    env = parseEnv(nodeFs.readFileSync(new URL('../../.env', import.meta.url), 'utf8'));
  } catch { }
  Object.entries(env).forEach(function ([name, value]) {
    if (process.env[name] === undefined) process.env[name] = value;
  });
  return env;
}

export const DOT_ENV = loadEnv();
export const RUNTIME_ENV = typeof process !== 'undefined' && process.env ? process.env : {};
export const PROCESS_ENV = globalThis.PROCESS_ENV || RUNTIME_ENV.PROCESS_ENV || RUNTIME_ENV.NODE_ENV || 'development';
export { loadEnv, parseEnv };
export default PROCESS_ENV;