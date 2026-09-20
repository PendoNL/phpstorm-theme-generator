#!/usr/bin/env node
// Part of phpstorm-theme-generator — see LICENSE.
/**
 * CLI: five hex colours in, an installable plugin .zip out.
 *
 *   npx phpstorm-theme-generator \
 *     --name "Acme" --id com.acme.theme \
 *     "#1B1D23" "#D4D7DE" "#4C8DF6" "#E5A33C" "#5CC98A"
 */
import { writeFileSync } from 'node:fs';
import { buildPlugin, VARIANTS, deriveTokens, cr } from '../src/lib/index.js';

const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i === -1 ? def : argv[i + 1];
};
const has = name => argv.includes('--' + name);

if (has('help') || !argv.length) {
  console.log(`phpstorm-theme-generator

  theme-forge [options] <C1> <C2> <C3> <C4> <C5>

  C1  anchor / editor background      C2  ink / default text
  C3  primary accent                  C4  secondary accent
  C5  tertiary accent

Options
  --name <s>      theme family name            (default: Custom Theme)
  --id <s>        plugin id                    (default: com.example.<slug>-theme)
  --author <s>    vendor string
  --variants <s>  comma-separated subset of: ${VARIANTS.map(v => v.id).join(', ')}
  --out <path>    output .zip                  (default: ./<slug>.zip)

Style
  --density <n>   tree row height in px, 18-32, or
                  compact | default | comfortable   (default: 24)
  --radius <n>    corner arc in px, 0-12, or
                  sharp | soft | round              (default: 6)
  --underline <n> tab underline thickness, 0-4      (default: 2)
  --borderless    drop every border and separator
  --accent-scroll accent-coloured scrollbars
  --no-italics    plain comments instead of italic
  --no-bold       plain keywords instead of bold
  --mono-icons    collapse the icon palette to one neutral
  --wallpaper     generate a background image per variant
  --file-icons [set]  bundle file and folder icons: heroicons (default), bootstrap
                  or tabler. Adds a small precompiled class to the plugin.
  --editor-font <s>  editor font family (leaves the user's choice alone unless set)
  --font-size <n>    editor font size
  --line-spacing <n> editor line spacing
  --ligatures        enable font ligatures
  --console-font <s> console font family
  --sources       also write <slug>-src.zip (editable Gradle project)
  --audit         print the contrast audit and exit non-zero on a failure
`);
  process.exit(0);
}

const colours = argv.filter(a => /^#?[0-9a-fA-F]{6}$/.test(a))
  .map(c => (c.startsWith('#') ? c : '#' + c).toUpperCase());

if (colours.length !== 5) {
  console.error(`error: need exactly 5 hex colours, got ${colours.length}`);
  process.exit(2);
}

const family = flag('name', 'Custom Theme');

const editorFont = flag('editor-font', null);
const consoleFont = flag('console-font', null);
const num = (name) => { const v = flag(name, null); return v == null ? null : Number(v); };
const font = (editorFont || consoleFont || num('font-size') || num('line-spacing') || has('ligatures'))
  ? { editor: editorFont, editorSize: num('font-size'), lineSpacing: num('line-spacing'),
      ligatures: has('ligatures') ? true : null, console: consoleFont, consoleSize: num('console-size') }
  : null;

const styleOptions = {
  density: flag('density', 24),
  radius: flag('radius', 6),
  underlineHeight: num('underline') ?? 2,
  borderless: has('borderless'),
  accentScrollbars: has('accent-scroll'),
  italicComments: !has('no-italics'),
  boldKeywords: !has('no-bold'),
  monochromeIcons: has('mono-icons'),
  // a bare --file-icons means heroicons; a following word names the set
  fileIcons: has('file-icons') ? (/^[a-z][a-z0-9-]*$/.test(flag('file-icons', '') || '') ? flag('file-icons') : 'heroicons') : null,
  font,
  wallpaper: has('wallpaper') ? { transparency: 12, fill: 'scale', anchor: 'center' } : null
};
const variants = (flag('variants', '') || '').split(',').filter(Boolean);

let plugin;
try {
  plugin = buildPlugin({
    palette: colours, family,
    id: flag('id', undefined),
    author: flag('author', 'phpstorm-theme-generator'),
    options: styleOptions,
    ...(variants.length ? { variants } : {})
  });
} catch (err) {
  console.error('error:', err.message);
  process.exit(2);
}

if (has('audit')) {
  let failed = 0;
  for (const v of plugin.variants) {
    const T = v.res.T;
    const checks = [
      ['text / editor', T.fgDefault, T.bgEditor, 7],
      ['comment / editor', T.synComment, T.bgEditor, 4.5],
      ['keyword / editor', T.synKeyword, T.bgEditor, 4.5],
      ['string / editor', T.synString, T.bgEditor, 4.5],
      ['type / editor', T.synType, T.bgEditor, 4.5],
      ['function / editor', T.synFunction, T.bgEditor, 4.5],
      ['constant / editor', T.synConstant, T.bgEditor, 4.5],
      ['text / selection', T.fgDefault, T.bgSelection, 4.5]
    ];
    console.log(`\n${v.name}`);
    for (const [label, a, b, target] of checks) {
      const r = cr(a, b);
      const ok = r >= target;
      if (!ok) failed++;
      console.log(`  ${ok ? 'pass' : 'FAIL'}  ${label.padEnd(20)} ${r.toFixed(2)} (>= ${target})`);
    }
    if (v.res.repairs.length) console.log(`  repaired: ${v.res.repairs.join(', ')}`);
  }
  process.exit(failed ? 1 : 0);
}

const out = flag('out', `${plugin.root}.zip`);
writeFileSync(out, Buffer.from(plugin.distZip));
console.log(`${out}  (${plugin.variants.length} variants, ${(plugin.distZip.length / 1024).toFixed(0)} KB)`);
console.log('install: Settings > Plugins > gear > Install Plugin from Disk');

if (has('sources')) {
  const so = `${plugin.root}-src.zip`;
  writeFileSync(so, Buffer.from(plugin.srcZip));
  console.log(`${so}  (editable Gradle project)`);
}
