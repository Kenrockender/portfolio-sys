/**
 * Production build — minifies JS + CSS into dist/ for deployment.
 *
 * Design goals:
 *  - Dev stays build-free: `npm run serve` runs the source directly.
 *  - No bundling/renaming — every file keeps its path and import specifiers,
 *    so app.html, the service worker, and module graph work unchanged, just
 *    smaller. (esbuild bundle:false minifies each file in place.)
 *  - api/ is NOT emitted to dist — Vercel detects serverless functions at the
 *    repo root, independent of the static output directory.
 *
 * Usage: npm run build   ->   outputs dist/
 */
import esbuild from 'esbuild';
import { readdir, rm, mkdir, copyFile, cp } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

/** Recursively list files under `dir` (relative to root) matching `ext`. */
async function listFiles(dir, ext) {
  const out = [];
  async function walk(d) {
    let entries;
    try { entries = await readdir(d, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.name.endsWith(ext)) out.push(p);
    }
  }
  await walk(join(root, dir));
  return out;
}

async function run() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });

  // 1. Minify JS. bundle:false minifies each file independently and preserves
  //    top-level names — important because some files (i18n.js, router.js,
  //    shell.js, quickadd-ui.js) load as CLASSIC scripts and expose globals
  //    that other scripts read. We do NOT set `format`, so esbuild keeps each
  //    file's own shape (ES module vs classic) instead of rewriting it.
  const jsEntries = [
    ...await listFiles('js', '.js'),
    ...await listFiles('firebase', '.js'),
  ];
  await esbuild.build({
    entryPoints: jsEntries,
    outdir: dist,
    outbase: root,
    bundle: false,
    minify: true,
    logLevel: 'info',
  });

  // 2. Minify CSS.
  const cssEntries = await listFiles('css', '.css');
  await esbuild.build({
    entryPoints: cssEntries,
    outdir: dist,
    outbase: root,
    minify: true,
    loader: { '.css': 'css' },
    logLevel: 'info',
  });

  // 3. Copy the remaining static assets verbatim.
  const rootFiles = ['app.html', 'index.html', 'landing-skip.js', 'sw.js', 'manifest.json', 'favicon.ico', 'favicon.svg'];
  for (const f of rootFiles) {
    await copyFile(join(root, f), join(dist, f)).catch(() => {});
  }
  // icons/ directory (PWA assets)
  await cp(join(root, 'icons'), join(dist, 'icons'), { recursive: true }).catch(() => {});

  console.log('\n[build] dist/ ready — JS/CSS minified, static assets copied.');
}

run().catch(e => { console.error('[build] failed:', e); process.exit(1); });
