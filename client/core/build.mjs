import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, extname, join, relative } from 'node:path';
import { build } from 'esbuild';
import { BUILDER } from '../config/builder.js';
import { logger } from './logger.mjs';
import { collectTemplates } from './base.mjs';
const IS_PROD = process.env.PROCESS_ENV === 'production';
const outfile = BUILDER.OUTFILE.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
const outputTemplateDir = join(BUILDER.OUTPUT_DIR, outfile);
const publicPath = BUILDER.PUBLIC_PATH.replaceAll('\\', '/').replace(/\/+$/g, '');
const outputTemplateUrl = publicPath ? `${publicPath}/${outfile}` : outfile;

function contentHash(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 10);
}

function addContentHash(filePath, hash) {
  const extension = extname(filePath);
  if (!extension) return `${filePath}.${hash}`;
  return `${filePath.slice(0, -extension.length)}.${hash}${extension}`;
}

function toUrl(filePath) {
  const normalizedPath = filePath.replaceAll('\\', '/').replace(/^\/+/, '');
  return publicPath ? `${publicPath}/${normalizedPath}` : normalizedPath;
}

function replaceAssetReferences(source, assets) {
  return [...assets.entries()]
    .sort(([left], [right]) => right.length - left.length)
    .reduce((result, [originalPath, hashedPath]) => (
      result.replaceAll(originalPath, toUrl(hashedPath))
    ), source);
}

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
const clientSource = result.outputFiles[0].text;
const clientFileName = `client.${contentHash(clientSource)}.js`;
await writeFile(join(outputTemplateDir, clientFileName), clientSource);

const assetManifest = new Map();
for (const source of BUILDER.SOURCES) {
  if (source === 'index.html') continue;
  await copyHashedSourceTree(source, join(BUILDER.OUTPUT_DIR, source), assetManifest);
}

async function copyHashedSourceTree(sourcePath, destinationPath, manifest) {
  const info = await stat(sourcePath);
  if (info.isDirectory()) {
    await mkdir(destinationPath, { recursive: true });
    const entries = await readdir(sourcePath);
    for (const name of entries) {
      await copyHashedSourceTree(join(sourcePath, name), join(destinationPath, name), manifest);
    }
  } else {
    const content = await readFile(sourcePath);
    const hashedDestination = addContentHash(destinationPath, contentHash(content));
    const originalUrl = relative(process.cwd(), sourcePath).replaceAll('\\', '/');
    const hashedUrl = relative(BUILDER.OUTPUT_DIR, hashedDestination).replaceAll('\\', '/');
    manifest.set(originalUrl, hashedUrl);
    await mkdir(dirname(hashedDestination), { recursive: true });
    await writeFile(hashedDestination, content);
  }
}

const templates = await collectTemplates('views');
const rewrittenTemplates = Object.fromEntries(
  Object.entries(templates)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([templatePath, source]) => [
      templatePath,
      replaceAssetReferences(source, assetManifest),
    ]),
);
const templatesSource = `globalThis.__VIEW_TEMPLATES__ = ${JSON.stringify(rewrittenTemplates)};\n`;
const templatesFileName = `templates.${contentHash(templatesSource)}.js`;
await writeFile(join(outputTemplateDir, templatesFileName), templatesSource);

const outputIndex = join(BUILDER.OUTPUT_DIR, 'index.html');
const indexHtml = replaceAssetReferences(await readFile('index.html', 'utf8'), assetManifest);
const clientScriptUrl = `${outputTemplateUrl}/${clientFileName}`;
const productionScripts =
  `<script src="${outputTemplateUrl}/${templatesFileName}"></script>\n` +
  `<script type="module" src="${clientScriptUrl}"></script>`;
await writeFile(
  outputIndex,
  indexHtml
    .replace(/<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["']client\/core\/base\.mjs["'])[^>]*>\s*<\/script>/i, productionScripts),
);
console.log(BUILDER.SUCCESS_MESSAGE);
logger.info(BUILDER.SUCCESS_MESSAGE);
await logger.flushPendingWrites();
