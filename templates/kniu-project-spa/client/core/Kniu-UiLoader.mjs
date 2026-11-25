export async function loadComponentsModule() {
  return import('./Kniu-Components.mjs');
}

export async function loadUiModule() {
  return import('./Kniu-Ui/Kniu-Ui.mjs');
}

export async function loadUiConfigModule() {
  return import('./Kniu-UiConfig.mjs');
}

export async function configureBrowserUi(options = {}) {
  const { configureUi } = await loadUiConfigModule();
  return configureUi(options);
}

export async function createBrowserClient(options = {}) {
  const { createClient } = await import('./Kniu-Client.mjs');
  return createClient(options);
}

export async function loadComponents(root) {
  const module = await loadComponentsModule();
  return module.load(root);
}

export async function preloadComponents() {
  const module = await loadComponentsModule();
  return module.preload();
}