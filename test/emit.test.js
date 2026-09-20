import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VARIANTS, deriveTokens } from '../src/lib/derive.js';
import { buildThemeJson } from '../src/lib/emit-theme.js';
import { buildSchemeXml } from '../src/lib/emit-scheme.js';
import { buildPluginXml, uuidFrom } from '../src/lib/emit-plugin.js';
import { buildPlugin } from '../src/lib/package.js';

const PAL = ['#1B1D23', '#D4D7DE', '#4C8DF6', '#E5A33C', '#5CC98A'];
const res = deriveTokens(PAL, 'dark');
const themeJson = buildThemeJson(res, { name: 'Acme Dark', author: 'test', slug: 'acme-dark' });
const theme = JSON.parse(themeJson);
const xml = buildSchemeXml(res, { name: 'Acme Dark' });

const leaves = o => Object.values(o).reduce((n, v) =>
  n + (v && typeof v === 'object' ? leaves(v) : 1), 0);

test('theme.json is valid JSON with the expected shape', () => {
  assert.equal(theme.name, 'Acme Dark');
  assert.equal(theme.dark, true);
  assert.equal(theme.editorScheme, '/themes/acme-dark.xml');
  assert.ok(leaves(theme.ui) > 700, `only ${leaves(theme.ui)} ui keys`);
});

test('every ui value is a token reference, a hex, a number or an insets string', () => {
  const colours = new Set(Object.keys(theme.colors));
  const bad = [];
  (function walk(o, path) {
    for (const [k, v] of Object.entries(o)) {
      const p = path ? `${path}.${k}` : k;
      if (v && typeof v === 'object') walk(v, p);
      else if (typeof v === 'string') {
        if (v.startsWith('#')) {
          if (![7, 9].includes(v.length)) bad.push([p, v, 'bad hex length']);
        } else if (/^\d+(,\d+){3}(,[0-9A-Fa-f]{6})?$/.test(v)) { /* insets/border */ }
        else if (!colours.has(v)) bad.push([p, v, 'undefined colour token']);
      } else if (typeof v !== 'number' && typeof v !== 'boolean') {
        bad.push([p, v, 'unexpected type']);
      }
    }
  })(theme.ui, '');
  assert.deepEqual(bad, [], `dangling ui values: ${JSON.stringify(bad.slice(0, 5))}`);
});

test('icon palette values all resolve too', () => {
  const colours = new Set(Object.keys(theme.colors));
  for (const [k, v] of Object.entries(theme.icons.ColorPalette))
    assert.ok(v.startsWith('#') || colours.has(v), `${k} -> ${v}`);
});

test('a dark theme writes .Dark checkbox keys and plain Objects keys', () => {
  const pal = theme.icons.ColorPalette;
  assert.ok('Checkbox.Background.Default.Dark' in pal);
  assert.ok(!('Objects.Yellow.Dark' in pal), 'Objects.* has no dark variants in the platform');
  assert.ok('Objects.Yellow' in pal);
});

test('a light theme drops the .Dark suffixes', () => {
  const lightRes = deriveTokens(PAL, 'light');
  const pal = JSON.parse(buildThemeJson(lightRes,
    { name: 'Acme Light', author: 't', slug: 'acme-light' })).icons.ColorPalette;
  assert.ok('Checkbox.Background.Default' in pal);
  assert.ok(!('Checkbox.Background.Default.Dark' in pal));
});

test('scheme XML is well-formed and uses bare hex', () => {
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<scheme name="Acme Dark" version="142" parent_scheme="Darcula">/);
  assert.equal((xml.match(/<colors>/g) || []).length, 1);
  assert.ok(!/value="#/.test(xml), 'scheme XML values must not carry a leading #');
  const opens = (xml.match(/<option /g) || []).length;
  assert.ok(opens > 400, `only ${opens} options`);
});

test('a light theme inherits the Default scheme, not Darcula', () => {
  const l = buildSchemeXml(deriveTokens(PAL, 'light'), { name: 'Acme Light' });
  assert.match(l, /parent_scheme="Default"/);
});

test('the PHP traps are encoded', () => {
  // Verified against real PhpStorm .icls exports: the key has a literal space.
  assert.ok(xml.includes('<option name="PHP_PREDEFINED SYMBOL">'),
    'PHP_PREDEFINED SYMBOL must contain a space, not an underscore');
  assert.ok(!/PHP_PREDEFINED_SYMBOL/.test(xml));
  // Left inherited, it paints a grey band behind PHP inside Blade/HTML.
  assert.ok(xml.includes('<option name="PHP_SCRIPTING_BACKGROUND"><value /></option>'),
    'PHP_SCRIPTING_BACKGROUND must be explicitly cleared');
  assert.ok(!/"PHP\.[A-Z]/.test(xml), 'dotted PHP.* keys do not exist');
});

test('console ANSI slots use the platform’s irregular names', () => {
  for (const k of ['CONSOLE_BLACK_OUTPUT', 'CONSOLE_GRAY_OUTPUT',
                   'CONSOLE_DARKGRAY_OUTPUT', 'CONSOLE_WHITE_OUTPUT'])
    assert.ok(xml.includes(`<option name="${k}">`), `missing ${k}`);
  for (const k of ['CONSOLE_BLACK_BRIGHT_OUTPUT', 'CONSOLE_WHITE_BRIGHT_OUTPUT'])
    assert.ok(!xml.includes(k), `${k} does not exist in the platform`);
});

test('all four scrollbar families are present', () => {
  for (const p of ['ScrollBar.', 'ScrollBar.Transparent.', 'ScrollBar.Mac.', 'ScrollBar.Mac.Transparent.'])
    assert.ok(xml.includes(`<option name="${p}thumbColor"`), `missing ${p}`);
});

test('plugin.xml registers one provider per variant with stable ids', () => {
  const variants = VARIANTS.map(v => ({ ...v, name: `Acme ${v.label}`, slug: `acme-${v.id}` }));
  const meta = { family: 'Acme', id: 'com.acme.theme', author: 'test' };
  const a = buildPluginXml(meta, variants);
  const b = buildPluginXml(meta, variants);
  assert.equal(a, b, 'ids must be deterministic — they are the persisted LaF identity');
  assert.equal((a.match(/<themeProvider /g) || []).length, VARIANTS.length);
  assert.match(a, /<depends>com\.intellij\.modules\.platform<\/depends>/);
  assert.ok(!/until-build/.test(a), 'until-build makes the plugin expire each release');
  const ids = [...a.matchAll(/id="([0-9a-f-]{36})"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, VARIANTS.length, 'ids must be unique');
});

test('uuidFrom is stable and well-formed', () => {
  assert.equal(uuidFrom('x'), uuidFrom('x'));
  assert.notEqual(uuidFrom('x'), uuidFrom('y'));
  assert.match(uuidFrom('x'), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('buildPlugin rejects a malformed palette', () => {
  assert.throws(() => buildPlugin({ palette: ['#000000'] }), /exactly 5/);
  assert.throws(() => buildPlugin({ palette: ['#000000', '#fff', 'nope', '#111111', '#222222'] }), /bad hex/);
});

test('every generated theme references a scheme that exists in the jar', () => {
  const p = buildPlugin({ palette: PAL, family: 'Acme', id: 'com.acme.theme' });
  const paths = new Set(p.jarEntries.map(e => e.path));
  for (const e of p.jarEntries) {
    if (!e.path.endsWith('.theme.json')) continue;
    const ref = JSON.parse(e.body).editorScheme.replace(/^\//, '');
    assert.ok(paths.has(ref), `${e.path} points at missing ${ref}`);
  }
});

test('the theme licence travels with the plugin, in the jar and in the source project', () => {
  const p = buildPlugin({ palette: PAL, family: 'Acme', id: 'com.acme.theme' });
  const inJar = p.jarEntries.find(e => e.path === 'LICENSE.txt');
  assert.ok(inJar, 'jar carries LICENSE.txt');
  assert.match(inJar.body, /creativecommons\.org\/licenses\/by-nc-sa\/4\.0/);
  const inSrc = p.src.find(e => e.path === 'acme-src/src/main/resources/LICENSE.txt');
  assert.ok(inSrc, 'source project carries it too');
  assert.equal(inSrc.body, inJar.body);
});

test('the scheme takes its caret row from the token, so neon gets its tint', () => {
  const neon = deriveTokens(['#0D0221', '#F5F0FF', '#FF2A6D', '#05D9E8', '#39FF14'], 'neon');
  const neonXml = buildSchemeXml(neon, { name: 'Acme Neon' });
  assert.ok(neonXml.includes(`name="CARET_ROW_COLOR" value="${neon.T.caretRow.slice(1).toLowerCase()}"`));
});
