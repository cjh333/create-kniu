const IDENTITY_SERVICE_KEY = '__KNIU_IDENTITY_SERVICE__';

function configureIdentityService(service) {
  if (service !== null && (!service || typeof service !== 'object')) {
    throw new TypeError('[kniu] identity service must be an object or null.');
  }
  globalThis[IDENTITY_SERVICE_KEY] = service;
  return service;
}

function getIdentityService() {
  return globalThis[IDENTITY_SERVICE_KEY] || null;
}

const identity = new Proxy({}, {
  get(_, property) {
    const service = getIdentityService();
    const value = service?.[property];
    if (typeof value === 'function') return value.bind(service);
    if (value !== undefined) return value;
    throw new Error(`[kniu] Identity service is not installed; cannot access ${String(property)}.`);
  }
});

export { configureIdentityService, getIdentityService, identity };
export default identity;