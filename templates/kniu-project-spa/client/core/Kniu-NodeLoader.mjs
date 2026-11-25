export const NODE_TOOLS = Object.freeze({
  server: './Kniu-Server.mjs',
  build: './Kniu-BuildClient.mjs',
  preview: './Kniu-PreviewServer.mjs'
});

export async function loadServerModule() {
  return import('./Kniu-Server.mjs');
}

export async function loadBuildModule() {
  return import('./Kniu-BuildClient.mjs');
}

export async function loadPreviewModule() {
  return import('./Kniu-PreviewServer.mjs');
}