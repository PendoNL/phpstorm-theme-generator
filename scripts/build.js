#!/usr/bin/env node
// Part of phpstorm-theme-generator — see LICENSE.
/**
 * Bundles src/ into a single self-contained dist/index.html.
 *
 * No bundler dependency on purpose: the module graph is small, fixed and
 * ours, so stripping import/export and concatenating in dependency order is
 * both sufficient and auditable. The single-file output is what makes the app
 * deployable to GitHub Pages and pasteable as a Claude artifact.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');

/** Dependency order. index.js is a re-export barrel and is not bundled. */
const ORDER = [
  'src/lib/color.js',
  'src/lib/icon-sets.js',
  'src/lib/options.js',
  'src/lib/zip.js',
  'src/lib/png.js',
  'src/lib/file-icons.js',
  'src/lib/icon-provider-class.js',
  'src/lib/derive.js',
  'src/lib/emit-theme.js',
  'src/lib/emit-scheme.js',
  'src/lib/emit-plugin.js',
  'src/lib/package.js',
  'src/ui/preview.js',
  'src/ui/app.js'
];

const strip = src => src
  .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?[ \t]*$/gm, '')
  .replace(/^export\s*\*\s*from\s+['"][^'"]+['"];?[ \t]*$/gm, '')
  .replace(/^export\s*\{[^}]*\}\s*;?[ \t]*$/gm, '')
  .replace(/^export\s+(const|let|var|function|class|async)\b/gm, '$1');

const modules = ORDER.map(f => ({ file: f, code: strip(read(f)).trim() }));

/* Modules keep their own scopes; the bundle does not. Two files may each
   define a private `crc32` quite legally and then collide once flattened, so
   check for that here rather than discovering it in the browser. */
const seen = new Map();
const clashes = [];
for (const { file, code } of modules) {
  for (const m of code.matchAll(/^(?:const|let|class|function)\s+([A-Za-z_$][\w$]*)/gm)) {
    const name = m[1];
    if (seen.has(name)) clashes.push(`${name}  (${seen.get(name)} and ${file})`);
    else seen.set(name, file);
  }
}
if (clashes.length) {
  console.error('build: duplicate top-level declarations would collide in the bundle:');
  for (const c of clashes) console.error('  ' + c);
  process.exit(1);
}

const js = modules.map(({ file, code }) => `/* ===== ${file} ===== */\n${code}`).join('\n\n');

const html = read('src/index.html')
  .replace(/<link rel="stylesheet" href="ui\/styles\.css">/,
           () => `<style>\n${read('src/ui/styles.css').trim()}\n</style>`)
  .replace(/<script type="module" src="ui\/app\.js"><\/script>/,
           () => `<script>\n${js}\n</script>`);

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/index.html'), html);

const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
if (/\bimport\s|\bexport\s/.test(js)) {
  console.error('build: module syntax survived stripping — bundle would not run');
  process.exit(1);
}
console.log(`dist/index.html  ${kb} KB`);
