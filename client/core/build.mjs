import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { build } from 'esbuild';
import { BUILDER } from '../config/builder.js';
import { logger } from './logger.mjs';
import { collectTemplates } from './base.mjs';
const IS_PROD = process.env.PROCESS_ENV === 'production';
const outfile = BUILDER.OUTFILE.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
const outputTemplateDir = join(BUILDER.OUTPUT_DIR, outfile);
const outputTemplateUrl = `/${outfile}`;

async function clearOutputDirectory(directory) {
  let entries;
  try {
    entries = await readdir(directory);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  await Promise.all(entries.map((entryName) => (
    rm(join(directory, entryName), { recursive: true, force: true })
  )));
}

await clearOutputDirectory(BUILDER.OUTPUT_DIR);
logger.info('Start building', { OUTPUT_DIR: BUILDER.OUTPUT_DIR });
await mkdir(BUILDER.OUTPUT_DIR, { recursive: true });
await mkdir(outputTemplateDir, { recursive: true });

const result = await build({
  entryPoints: ['client/core/base.mjs'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  external: ['node:*'],
  minify: IS_PROD,
  write: false,
});
await writeFile(join(outputTemplateDir, 'client.js'), result.outputFiles[0].text);

await Promise.all(BUILDER.SOURCES.map((source) => copySourceTree(source, join(BUILDER.OUTPUT_DIR, source))));

async function copySourceTree(sourcePath, destinationPath) {
  const info = await stat(sourcePath);
  if (info.isDirectory()) {
    await mkdir(destinationPath, { recursive: true });
    const entries = await readdir(sourcePath);
    await Promise.all(entries.map((name) => copySourceTree(join(sourcePath, name), join(destinationPath, name))));
  } else {
    await mkdir(dirname(destinationPath), { recursive: true });
    await writeFile(destinationPath, await readFile(sourcePath));
  }
}

const templates = await collectTemplates('client/views');
await writeFile(
  join(outputTemplateDir, 'templates.js'),
  `globalThis.__VIEW_TEMPLATES__ = ${JSON.stringify(templates)};\n`,
);

const outputIndex = join(BUILDER.OUTPUT_DIR, 'index.html');
const indexHtml = await readFile(outputIndex, 'utf8');
const clientScriptUrl = `${outputTemplateUrl}/client.js`;
const escapedClientScriptUrl = clientScriptUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clientScriptPattern = new RegExp(
  `<script\\b(?=[^>]*\\btype=["']module["'])(?=[^>]*\\bsrc=["']${escapedClientScriptUrl}["'])[^>]*>\\s*</script>`,
  'i',
);
const productionScripts =
  `<script src="${outputTemplateUrl}/templates.js"></script>\n` +
  `<script type="module" src="${clientScriptUrl}"></script>`;
await writeFile(
  outputIndex,
  indexHtml
    .replace('/client/core/base.mjs', `${outputTemplateUrl}/client.js`)
    .replace(clientScriptPattern, productionScripts),
);
console.log(BUILDER.SUCCESS_MESSAGE);
logger.info(BUILDER.SUCCESS_MESSAGE);
await logger.flushPendingWrites();
