export const CORE_COMPONENT_TAGS = Object.freeze([
  'kniu-router-view', 'kniu-badge', 'kniu-tag', 'kniu-status', 'kniu-empty', 'kniu-btn', 'kniu-btn-group',
  'kniu-switch', 'kniu-modal', 'kniu-table', 'kniu-msg', 'kniu-select',
  'kniu-radio-group', 'kniu-page', 'kniu-page-more', 'kniu-image', 'kniu-input',
  'kniu-smsvcode', 'kniu-gvcode', 'kniu-auth-layout', 'kniu-date-picker', 'kniu-form',
  'kniu-upload', 'kniu-icon', 'kniu-tab', 'kniu-editor', 'kniu-navbar', 'kniu-backtop',
  'kniu-comment', 'kniu-like', 'kniu-user-login', 'kniu-article-tab', 'kniu-vlist'
]);

export const BUSINESS_COMPONENT_TAGS = Object.freeze([
  'kniu-comment', 'kniu-like', 'kniu-article-tab', 'kniu-user-login',
  'kniu-smsvcode', 'kniu-gvcode', 'kniu-auth-layout'
]);

function normalize(options) {
  if (!options || typeof options !== 'object') return null;
  const include = Array.isArray(options.include) ? options.include.map(String) : null;
  const exclude = new Set(Array.isArray(options.exclude) ? options.exclude.map(String) : []);
  if (!include && !exclude.size) return null;
  const base = include || CORE_COMPONENT_TAGS;
  return new Set(base.filter((tag) => CORE_COMPONENT_TAGS.includes(tag) && !exclude.has(tag)));
}

function normalizeBusiness(options) {
  if (!options || typeof options !== 'object') return null;
  if (!Array.isArray(options.business)) return null;
  const wanted = new Set(options.business.map(String));
  return new Set(BUSINESS_COMPONENT_TAGS.filter((tag) => wanted.has(tag)));
}

const initial = (typeof globalThis !== 'undefined' && globalThis.__KNIU_COMPONENT_MANIFEST__)
  ? normalize(globalThis.__KNIU_COMPONENT_MANIFEST__)
  : null;

let enabled = new Set(initial || CORE_COMPONENT_TAGS);
let enabledBusiness = null;

export function configureComponentRegistry(options) {
  enabled = new Set(normalize(options) || CORE_COMPONENT_TAGS);
  enabledBusiness = normalizeBusiness(options);
  if (typeof globalThis !== 'undefined') globalThis.__KNIU_COMPONENT_MANIFEST__ = getComponentManifest();
  return getComponentManifest();
}

export function isBusinessTagEnabled(tag) {
  const name = String(tag);
  return !BUSINESS_COMPONENT_TAGS.includes(name) || !enabledBusiness || enabledBusiness.has(name);
}

export function getEnabledBusinessTags() {
  return BUSINESS_COMPONENT_TAGS.filter((tag) => isBusinessTagEnabled(tag));
}

export function isTagEnabled(tag) {
  return enabled.has(String(tag));
}

export function getEnabledTags() {
  return CORE_COMPONENT_TAGS.filter((tag) => enabled.has(tag));
}

export function getComponentManifest() {
  return Object.freeze({
    include: getEnabledTags(),
    exclude: CORE_COMPONENT_TAGS.filter((tag) => !enabled.has(tag)),
    business: getEnabledBusinessTags()
  });
}

export function resetComponentRegistry() {
  enabled = new Set(CORE_COMPONENT_TAGS);
  enabledBusiness = null;
  return getComponentManifest();
}

let businessProviders = null;

export function setBusinessComponentProviders(providers) {
  businessProviders = providers && typeof providers === 'object' ? { ...providers } : null;
  return getBusinessComponentManifest();
}

export function hasBusinessComponentProviders() {
  return businessProviders !== null;
}

export function getBusinessComponentProvider(tag) {
  if (!businessProviders) return undefined;
  const key = String(tag);
  return Object.prototype.hasOwnProperty.call(businessProviders, key) ? businessProviders[key] : null;
}

export function getBusinessComponentManifest() {
  return Object.freeze({
    configured: hasBusinessComponentProviders(),
    tags: businessProviders ? Object.keys(businessProviders).sort() : []
  });
}

export function resetBusinessComponentProviders() {
  businessProviders = null;
  return getBusinessComponentManifest();
}