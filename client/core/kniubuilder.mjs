import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, extname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BUILDER } from '../config/builder.js';
import { SERVER } from '../config/server.js';
import { resolveAliasReferences } from './kniutil.mjs';
import { appLogger } from './kniulogger.mjs';

const viewDirectory = String(SERVER.VIEWS || '/views').replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
const viewIndexPath = join(viewDirectory, 'index.html');

export async function collectTemplates(directory = viewDirectory, rootDirectory = directory) {
  const { readdir, readFile } = await import('node:fs/promises');
  const { join, relative } = await import('node:path');
  const templates = {};
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(
    entries.map(async function (entry) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        Object.assign(templates, await collectTemplates(path, rootDirectory));
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        if (relative(rootDirectory, path).replaceAll('\\', '/') === 'index.html') return;
        const templatePath = `/${relative('.', path).replaceAll('\\', '/')}`;
        templates[templatePath] = resolveAliasReferences(await readFile(path, 'utf8'), SERVER.ALIAS);
      }
    }),
  );
  return templates;
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
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
    .sort(function ([left], [right]) { return right.length - left.length; })
    .reduce(function (result, [originalPath, hashedPath]) { return result.replaceAll(originalPath, toUrl(hashedPath)); }, source);
}

function rewriteCssAssetUrls(content, fileDir, manifest) {
  return content.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, function (full, quote, ref) {
    if (/^(?:https?:)?\/\//i.test(ref) || /^(?:data:|#)/i.test(ref)) return full;
    const marker = ref.search(/[?#]/);
    const pathPart = marker === -1 ? ref : ref.slice(0, marker);
    const suffix = marker === -1 ? '' : ref.slice(marker);
    const resolved = join(fileDir, pathPart);
    const originalUrl = relative(process.cwd(), resolved).replaceAll('\\', '/');
    const hashed = manifest.get(originalUrl);
    if (!hashed) return full;
    const relativeHashed = relative(fileDir, hashed).replaceAll('\\', '/');
    return `url(${quote}${relativeHashed}${suffix}${quote})`;
  });
}

function minifyHtml(content) {
  return content
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .trim();
}

async function clearOutputDirectory(directory) {
  let entries;
  try {
    entries = await readdir(directory);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  await Promise.all(entries.map(function (entryName) { return rm(join(directory, entryName), { recursive: true, force: true }); }));
}

if (isMain) {
  await clearOutputDirectory(BUILDER.OUTPUT_DIR);
  appLogger.info('Start building', { OUTPUT_DIR: BUILDER.OUTPUT_DIR });
  await mkdir(BUILDER.OUTPUT_DIR, { recursive: true });
  await mkdir(outputTemplateDir, { recursive: true });
  const { build, transform } = await import('esbuild');
  const result = await build({
    entryPoints: ['client/client.mjs'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    external: ['node:*'],
    minify: IS_PROD,
    legalComments: 'none',
    supported: { 'template-literal': false },
    write: false,
  });
  const clientSource = result.outputFiles[0].text.trim();
  const clientFileName = `client.${contentHash(clientSource)}.js`;
  await writeFile(join(outputTemplateDir, clientFileName), clientSource);
  const assetManifest = new Map();
  const deferredCssAssets = [];
  for (const source of BUILDER.SOURCES) {
    if (source === 'index.html') continue;
    await copyHashedSourceTree(source, join(BUILDER.OUTPUT_DIR, source), assetManifest);
  }
  for (const asset of deferredCssAssets) {
    const fileDir = relative(BUILDER.OUTPUT_DIR, dirname(asset.destinationPath));
    const rewritten = rewriteCssAssetUrls(asset.content, fileDir, assetManifest);
    const transformed = await transform(rewritten, {
      loader: 'css',
      minify: IS_PROD,
      legalComments: 'none',
    });
    const content = transformed.code.trim();
    const hashedDestination = addContentHash(asset.destinationPath, contentHash(content));
    const hashedUrl = relative(BUILDER.OUTPUT_DIR, hashedDestination).replaceAll('\\', '/');
    assetManifest.set(asset.originalUrl, hashedUrl);
    await mkdir(dirname(hashedDestination), { recursive: true });
    await writeFile(hashedDestination, content);
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
      const extension = extname(sourcePath).toLowerCase();
      const originalUrl = relative(process.cwd(), sourcePath).replaceAll('\\', '/');
      if (extension === '.css') {
        deferredCssAssets.push({
          sourcePath,
          destinationPath,
          originalUrl,
          content: await readFile(sourcePath, 'utf8'),
        });
        return;
      }
      let content = await readFile(sourcePath);
      if (extension === '.js') {
        const transformed = await transform(content.toString('utf8'), {
          loader: 'js',
          minify: IS_PROD,
          legalComments: 'none',
          supported: { 'template-literal': false },
        });
        content = transformed.code.trim();
      }
      const hashedDestination = addContentHash(destinationPath, contentHash(content));
      const hashedUrl = relative(BUILDER.OUTPUT_DIR, hashedDestination).replaceAll('\\', '/');
      manifest.set(originalUrl, hashedUrl);
      await mkdir(dirname(hashedDestination), { recursive: true });
      await writeFile(hashedDestination, content);
    }
  }

  const templates = await collectTemplates();
  const rewrittenTemplates = Object.fromEntries(
    Object.entries(templates)
      .sort(function ([left], [right]) { return left.localeCompare(right); })
      .map(function ([templatePath, source]) {
        return [
          templatePath,
          replaceAssetReferences(source, assetManifest),
        ];
      }),
  );
  const templatesSource = `globalThis.__VIEW_TEMPLATES__=${JSON.stringify(rewrittenTemplates)};`;
  const templatesFileName = `templates.${contentHash(templatesSource)}.js`;
  await writeFile(join(outputTemplateDir, templatesFileName), templatesSource);
  const outputIndex = join(BUILDER.OUTPUT_DIR, 'index.html');
  const indexHtml = replaceAssetReferences(
    resolveAliasReferences(await readFile(viewIndexPath, 'utf8'), SERVER.ALIAS),
    assetManifest
  );
  const clientScriptUrl = `${outputTemplateUrl}/${clientFileName}`;
  const productionScripts =
    `<script src="${outputTemplateUrl}/${templatesFileName}"></script>` +
    `<script type="module" src="${clientScriptUrl}"></script>`;
  await writeFile(
    outputIndex,
    minifyHtml(indexHtml
      .replace(/<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["']client\/client\.(?:js|mjs)["'])[^>]*>\s*<\/script>/i, productionScripts)),
  );
  console.log(BUILDER.SUCCESS_MESSAGE);
  appLogger.info(BUILDER.SUCCESS_MESSAGE);
  await appLogger.flushPendingWrites();
}
