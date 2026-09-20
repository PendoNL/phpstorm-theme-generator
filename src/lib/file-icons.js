// Part of phpstorm-theme-generator — see LICENSE.
/**
 * Optional file and folder icons for the generated plugin.
 *
 *   - sets (icon-sets.js): vendored glyphs, one table per icon family.
 *   - slots: each icon is painted in one placeholder colour. Every generated
 *     theme remaps those placeholders to its own tokens through
 *     icons.ColorPalette, so one set of SVGs follows all the variants.
 *   - rules: which file or folder gets which *role* in which slot. Sets map
 *     roles to glyphs, so the rules are written once for all of them. They
 *     end up in forge-icons.properties, which is all ForgeIconProvider reads.
 */
import { ICON_SETS } from './icon-sets.js';

/* Placeholders are arbitrary on purpose: the palette remap is global, so they
   must not coincide with a colour the platform's own icons use. */
export const FILE_ICON_SLOTS = {
  neutral:   { placeholder: '#6c7a89', token: 'fgMuted' },
  primary:   { placeholder: '#3d8ef1', token: 'accentPrimary' },
  secondary: { placeholder: '#e0a131', token: 'accentSecondary' },
  tertiary:  { placeholder: '#4fc081', token: 'accentTertiary' },
  danger:    { placeholder: '#d9655b', token: 'semError' },
  constant:  { placeholder: '#b07ce1', token: 'synConstant' }
};

/* [rule key, role, slot] - keys are lower-case; see ForgeIconProvider.java. */
export const FILE_ICON_RULES = [
  ['dir.*',            'folder',          'neutral'],
  ['dir.tests',        'folder-tests',    'tertiary'],
  ['dir.config',       'folder-config',   'secondary'],
  ['dir.database',     'folder-database', 'constant'],
  ['dir.public',       'folder-public',   'primary'],
  ['dir.storage',      'folder-storage',  'neutral'],
  ['dir.vendor',       'folder-vendor',   'neutral'],
  ['dir.node_modules', 'folder-vendor',   'neutral'],

  ['name.composer.json',      'composer', 'secondary'],
  ['name.package.json',       'npm',      'tertiary'],
  ['name.artisan',            'artisan',  'primary'],
  ['name.dockerfile',         'docker',   'primary'],
  ['name.docker-compose.yml', 'docker',   'primary'],
  ['name..env',               'env',      'secondary'],
  ['name..env.example',       'env',      'neutral'],
  ['name..env.testing',       'env',      'tertiary'],

  ['ext.blade.php', 'blade', 'danger'],
  ['ext.php',   'php',      'primary'],
  ['ext.xml',   'xml',      'secondary'],
  ['ext.html',  'html',     'danger'],
  ['ext.json',  'json',     'secondary'],
  ['ext.yml',   'yaml',     'constant'],
  ['ext.yaml',  'yaml',     'constant'],
  ['ext.js',    'js',       'secondary'],
  ['ext.ts',    'ts',       'primary'],
  ['ext.vue',   'vue',      'tertiary'],
  ['ext.css',   'css',      'constant'],
  ['ext.scss',  'scss',     'danger'],
  ['ext.sql',   'sql',      'constant'],
  ['ext.csv',   'csv',      'tertiary'],
  ['ext.sh',    'shell',    'tertiary'],
  ['ext.md',    'markdown', 'neutral'],
  ['ext.txt',   'text',     'neutral'],
  ['ext.log',   'log',      'neutral'],
  ['ext.lock',  'lock',     'neutral'],
  ['ext.zip',   'archive',  'neutral'],
  ['ext.png',   'image',    'tertiary'],
  ['ext.jpg',   'image',    'tertiary'],
  ['ext.jpeg',  'image',    'tertiary'],
  ['ext.gif',   'image',    'tertiary'],
  ['ext.webp',  'image',    'tertiary'],
  ['ext.svg',   'svg',      'secondary'],
  ['ext.ico',   'image',    'secondary']
];

export const FILE_ICON_DIR = 'forge-icons';
const iconPath = (role, slot) => `${FILE_ICON_DIR}/${role}-${slot}.svg`;
const SHAPES = /<(path|circle|rect|ellipse|polygon|polyline|line)\b/g;

/**
 * One role's glyph from a set, as a standalone 16px SVG painted in `colour`
 * (a placeholder for the plugin, or any CSS colour for the preview).
 * The colour goes on every shape, as in JetBrains' own icons - a colour
 * inherited from the root is not something the IDE's palette patcher rewrites.
 */
export function fileIconSvg(setId, role, colour) {
  const set = ICON_SETS[setId];
  const shapes = set.glyphs[set.roles[role]].replace(SHAPES, `<$1 ${set.paint}="${colour}"`);
  const root = set.paint === 'stroke'
    ? ' fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="${set.viewBox}"${root}>${shapes}</svg>`;
}

/** The rule that ForgeIconProvider would pick, as [role, slot] - or null. Mirrors the Java. */
export function fileIconFor(name, isDir) {
  const n = name.toLowerCase();
  const find = key => FILE_ICON_RULES.find(r => r[0] === key);
  let rule = null;
  if (isDir) rule = find('dir.' + n) || find('dir.*');
  else {
    rule = find('name.' + n);
    for (let dot = n.indexOf('.'); !rule && dot >= 0; dot = n.indexOf('.', dot + 1))
      rule = find('ext.' + n.slice(dot + 1));
  }
  return rule ? [rule[1], rule[2]] : null;
}

/**
 * Jar entries for one set: the SVGs, the rules file and the set's licence.
 * `themeNames` are the plugin's own themes; the provider stays out of the way
 * under anybody else's. The class file itself is added by package.js.
 */
export function buildFileIconEntries(setId, themeNames) {
  const set = ICON_SETS[setId];
  const entries = [{ path: FILE_ICON_DIR + '/' }];
  const seen = new Set();
  for (const [, role, slot] of FILE_ICON_RULES) {
    const path = iconPath(role, slot);
    if (seen.has(path)) continue;
    seen.add(path);
    entries.push({ path, body: fileIconSvg(setId, role, FILE_ICON_SLOTS[slot].placeholder) + '\n' });
  }
  entries.push({ path: `${FILE_ICON_DIR}/LICENSE-${setId}.txt`,
    body: `${set.label} ${set.version} (${set.package}) - ${set.source}\n\n${set.license}` });
  // Read back as UTF-8 by the provider; a backslash is the only escape Properties applies to a value.
  const esc = v => v.replace(/\\/g, '\\\\');
  entries.push({ path: 'forge-icons.properties',
    body: '# Read by forge.ForgeIconProvider. name.<file>, ext.<extension>, dir.<folder>, dir.*, theme.<n>\n'
      + themeNames.map((n, i) => `theme.${i}=${esc(n)}`).join('\n') + (themeNames.length ? '\n' : '')
      + FILE_ICON_RULES.map(([key, role, slot]) => `${key}=/${iconPath(role, slot)}`).join('\n') + '\n' });
  return entries;
}

/**
 * Placeholder -> colour, for a theme's icons.ColorPalette. Literal hex on both
 * sides, and keys in both cases: the platform's matching has varied.
 * `T` is the variant's token table; `flatten` paints every slot in one token.
 */
export function fileIconPalette(T, flatten = null) {
  const out = {};
  for (const slot of Object.values(FILE_ICON_SLOTS)) {
    const hex = T[flatten || slot.token];
    out[slot.placeholder.toLowerCase()] = hex;
    out[slot.placeholder.toUpperCase()] = hex;
  }
  return out;
}
