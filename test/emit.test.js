import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VARIANTS, deriveTokens } from '../src/lib/derive.js';
import { cr } from '../src/lib/color.js';
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

/* ---- other languages ----
   Python, Go, Java, Kotlin, Rust and the rest have no keys of their own here:
   they resolve through the platform's Language Defaults. So those must be
   complete, and legible, in every variant - not only the ones PHP exercises. */

// Every constant in com.intellij.openapi.editor.DefaultLanguageHighlighterColors
// (intellij.platform.core.jar, PhpStorm 2025). Extend it when the platform does.
const LANGUAGE_DEFAULTS = [
  'DEFAULT_ATTRIBUTE', 'DEFAULT_BLOCK_COMMENT', 'DEFAULT_BRACES',
  'DEFAULT_BRACKETS', 'DEFAULT_CLASS_NAME', 'DEFAULT_CLASS_REFERENCE',
  'DEFAULT_COMMA', 'DEFAULT_CONSTANT', 'DEFAULT_DOC_COMMENT',
  'DEFAULT_DOC_COMMENT_TAG', 'DEFAULT_DOC_COMMENT_TAG_VALUE', 'DEFAULT_DOC_MARKUP',
  'DEFAULT_DOT', 'DEFAULT_ENTITY', 'DEFAULT_FUNCTION_CALL',
  'DEFAULT_FUNCTION_DECLARATION', 'DEFAULT_GLOBAL_VARIABLE', 'DEFAULT_HIGHLIGHTED_REFERENCE',
  'DEFAULT_IDENTIFIER', 'DEFAULT_INSTANCE_FIELD', 'DEFAULT_INSTANCE_METHOD',
  'DEFAULT_INTERFACE_NAME', 'DEFAULT_INVALID_STRING_ESCAPE', 'DEFAULT_KEYWORD',
  'DEFAULT_LABEL', 'DEFAULT_LINE_COMMENT', 'DEFAULT_LOCAL_VARIABLE',
  'DEFAULT_METADATA', 'DEFAULT_NUMBER', 'DEFAULT_OPERATION_SIGN',
  'DEFAULT_PARAMETER', 'DEFAULT_PARENTHS', 'DEFAULT_PREDEFINED_SYMBOL',
  'DEFAULT_REASSIGNED_LOCAL_VARIABLE', 'DEFAULT_REASSIGNED_PARAMETER', 'DEFAULT_SEMICOLON',
  'DEFAULT_STATIC_FIELD', 'DEFAULT_STATIC_METHOD', 'DEFAULT_STRING',
  'DEFAULT_TAG', 'DEFAULT_TEMPLATE_LANGUAGE_COLOR', 'DEFAULT_VALID_STRING_ESCAPE'
];
const PALETTES = [
  PAL,
  ['#FBF9F3', '#2B2A26', '#3C6E9F', '#B07B26', '#4E7A45'],   // light-first
  ['#122738', '#E1EFFF', '#3AD900', '#FFC600', '#80FCFF'],   // loud accents, hard to carry to light
  ['#191724', '#E0DEF4', '#9CCFD8', '#F6C177', '#31748F']    // pastel accents
];
const SYNTAX_KEY = /^(DEFAULT_|PHP_|BLADE_|TWIG_|JS\.|TS\.|CSS\.|SASS_|HTML_|XML_|JSON\.|YAML_|MARKDOWN_|REGEXP\.|PROPERTIES\.)/;
const attributes = x => [...x.matchAll(/<option name="([A-Za-z0-9_.]+)">\s*<value>([\s\S]*?)<\/value>/g)]
  .map(m => [m[1], Object.fromEntries([...m[2].matchAll(/<option name="([A-Z_]+)" value="([^"]*)"/g)].map(o => [o[1], o[2]]))]);

test('every variant sets every platform language default', () => {
  for (const p of PALETTES) for (const v of VARIANTS) {
    const set = new Set(attributes(buildSchemeXml(deriveTokens(p, v.id), { name: 'x' })).map(a => a[0]));
    const missing = LANGUAGE_DEFAULTS.filter(k => !set.has(k));
    assert.deepEqual(missing, [], `${p[0]} ${v.id}`);
  }
});

test('no syntax colour of any language drops below 3:1 in any variant', () => {
  const hex = h => '#' + h.padStart(6, '0');
  for (const p of PALETTES) for (const v of VARIANTS) {
    const r = deriveTokens(p, v.id);
    for (const [key, o] of attributes(buildSchemeXml(r, { name: 'x' }))) {
      if (!SYNTAX_KEY.test(key) || !o.FOREGROUND) continue;
      const ratio = cr(hex(o.FOREGROUND), o.BACKGROUND ? hex(o.BACKGROUND) : r.T.bgEditor);
      assert.ok(ratio >= 3, `${key} is ${ratio.toFixed(2)}:1 in ${v.id} of ${p[0]}`);
    }
  }
});

test('text that has to be read - TODOs, warnings, errors, links, rainbow brackets - holds 4.5:1 in every variant', () => {
  const MUST_READ = /^(TODO_DEFAULT_ATTRIBUTES|HYPERLINK_ATTRIBUTES|CTRL_CLICKABLE|BAD_CHARACTER|WRONG_REFERENCES_ATTRIBUTES|RAINBOW_COLOR\d|LINE_(FULL|PARTIAL|NONE)_COVERAGE|LOG_(WARNING|ERROR)_OUTPUT|CONSOLE_(ERROR|SYSTEM)_OUTPUT|CONSOLE_USER_INPUT|DEBUGGER_INLINED_VALUES_MODIFIED|DEFAULT_INVALID_STRING_ESCAPE|MARKDOWN_LINK_TEXT)$/;
  const hex = h => '#' + h.padStart(6, '0');
  let seen = 0;
  for (const p of PALETTES) for (const v of VARIANTS) {
    const r = deriveTokens(p, v.id);
    for (const [key, o] of attributes(buildSchemeXml(r, { name: 'x' }))) {
      if (!MUST_READ.test(key) || !o.FOREGROUND || o.BACKGROUND) continue;
      seen++;
      const ratio = cr(hex(o.FOREGROUND), r.T.bgEditor);
      assert.ok(ratio >= 4.45, `${key} is ${ratio.toFixed(2)}:1 in ${v.id} of ${p[0]}`);
    }
  }
  assert.ok(seen > 500, 'the keys above really are in the scheme');
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

test('plugin.xml carries what a Marketplace listing needs', () => {
  const variants = VARIANTS.map(v => ({ ...v, name: `Acme ${v.label}`, slug: `acme-${v.id}` }));
  const meta = { family: 'Acme', id: 'com.acme.theme', author: 'A & B', version: '1.2.0',
                 url: 'https://acme.test/?a=1&b=2', changeNotes: 'Fixed <tabs>' };
  const x = buildPluginXml(meta, variants);
  assert.match(x, /<version>1\.2\.0<\/version>/);
  assert.match(x, /<vendor url="https:\/\/acme\.test\/\?a=1&amp;b=2">A &amp; B<\/vendor>/);
  assert.match(x, /<change-notes><!\[CDATA\[\s*<p>Fixed &lt;tabs&gt;<\/p>\s*\]\]><\/change-notes>/);
  assert.match(x, /<a href="https:\/\/phpstorm-theme-generator\.com[^"]*">/, 'links back to the generator');

  const bare = buildPluginXml({ family: 'Acme', id: 'com.acme.theme', author: 'test' }, variants);
  assert.match(bare, /<version>1\.0\.0<\/version>/);
  assert.match(bare, /<vendor>test<\/vendor>/);
  assert.ok(!/change-notes/.test(bare), 'no empty change-notes');
  assert.match(bare, /phpstorm-theme-generator\.com/, 'the backlink is not optional');
});

test('buildPlugin threads version, url and change notes through to the jar and the Gradle project', () => {
  const p = buildPlugin({ palette: PAL, family: 'Acme', id: 'com.acme.theme', author: 'Acme BV',
                          version: '2.0.1', url: 'https://acme.test', changeNotes: 'New light variant' });
  const xmlBody = p.jarEntries.find(e => e.path === 'META-INF/plugin.xml').body;
  assert.match(xmlBody, /<version>2\.0\.1<\/version>/);
  assert.match(xmlBody, /<vendor url="https:\/\/acme\.test">Acme BV<\/vendor>/);
  assert.match(xmlBody, /New light variant/);
  const gradle = p.src.find(e => e.path === 'acme-src/build.gradle.kts').body;
  assert.match(gradle, /^version = "2\.0\.1"$/m);
  assert.throws(() => buildPlugin({ palette: PAL, version: '1.0"; evil' }), /version/);
  assert.throws(() => buildPlugin({ palette: PAL, url: 'javascript:alert(1)' }), /url/);
});

test('uuidFrom is stable and well-formed', () => {
  assert.equal(uuidFrom('x'), uuidFrom('x'));
  assert.notEqual(uuidFrom('x'), uuidFrom('y'));
  assert.match(uuidFrom('x'), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('buildPlugin rejects a malformed palette', () => {
  assert.throws(() => buildPlugin({ palette: ['#000000'] }), /2 to 5/);
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

test('buildPlugin takes two to five colours', () => {
  for (const palette of [['#000000', '#00FF41'], PAL.slice(0, 3), PAL.slice(0, 4), PAL]) {
    const p = buildPlugin({ palette, family: 'Acme', id: 'com.acme.theme', variants: ['dark', 'light'] });
    assert.equal(p.variants.length, 2);
    const icon = p.jarEntries.find(e => e.path === 'META-INF/pluginIcon.svg').body;
    assert.equal((icon.match(/fill="#[0-9A-Fa-f]{6}"/g) || []).length, 4, 'the icon is drawn from derived seeds too');
  }
  assert.throws(() => buildPlugin({ palette: ['#000000'] }), /2 to 5/);
});
