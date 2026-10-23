let identityService = null;

function configureIdentityService(service) {
  if (service !== null && (!service || typeof service !== 'object')) {
    throw new TypeError('[kniu] identity service must be an object or null.');
  }
  identityService = service;
  return identityService;
}

function getIdentityService() {
  return identityService;
}

const identity = new Proxy({}, {
  get(_, property) {
    const value = identityService?.[property];
    if (typeof value === 'function') return value.bind(identityService);
    if (value !== undefined) return value;
    throw new Error(`[kniu] Identity service is not installed; cannot access ${String(property)}.`);
  }
});

export { configureIdentityService, getIdentityService, identity };
export default identity;