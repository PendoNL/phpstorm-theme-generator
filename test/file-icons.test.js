import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlugin } from '../src/lib/package.js';
import { resolveOptions } from '../src/lib/options.js';
import { ICON_SETS } from '../src/lib/icon-sets.js';
import { FILE_ICON_SLOTS, FILE_ICON_RULES, buildFileIconEntries, fileIconFor, fileIconSvg }
  from '../src/lib/file-icons.js';

const PAL = ['#1B1D23', '#D4D7DE', '#4C8DF6', '#E5A33C', '#5CC98A'];
const base = { palette: PAL, family: 'Acme', id: 'com.acme.theme' };
const paths = g => g.jarEntries.map(e => e.path);
const entry = (g, p) => g.jarEntries.find(e => e.path === p);
const text = b => typeof b === 'string' ? b : new TextDecoder().decode(b);
const SETS = Object.keys(ICON_SETS);
const SHAPE = /<(path|circle|rect|ellipse|polygon|polyline|line)\b[^>]*>/g;

test('the sets on offer', () => {
  assert.deepEqual(SETS, ['heroicons', 'bootstrap', 'tabler']);
  for (const id of SETS) {
    const s = ICON_SETS[id];
    assert.ok(s.label && s.source && s.version, `${id}: label, source, version`);
    assert.match(s.license, /Permission is hereby granted|MIT License/, `${id}: ships its licence text`);
    assert.ok(['fill', 'stroke'].includes(s.paint));
  }
});

test('the option: off by default, true means heroicons, unknown sets are refused', () => {
  assert.equal(resolveOptions().fileIcons, null);
  assert.equal(resolveOptions({ fileIcons: false }).fileIcons, null);
  assert.equal(resolveOptions({ fileIcons: true }).fileIcons, 'heroicons');
  assert.equal(resolveOptions({ fileIcons: 'tabler' }).fileIcons, 'tabler');
  assert.throws(() => resolveOptions({ fileIcons: 'comic-sans' }), /unknown icon set/);
});

test('off: the plugin is exactly what it was', () => {
  const plain = buildPlugin(base);
  const off = buildPlugin({ ...base, options: { fileIcons: null } });
  assert.deepEqual(plain.distZip, off.distZip);
  assert.ok(!paths(plain).some(p => p.startsWith('forge') || p.endsWith('.class')));
  assert.ok(!text(entry(plain, 'META-INF/plugin.xml').body).includes('iconProvider'));
  assert.ok(!text(entry(plain, 'META-INF/plugin.xml').body).includes('applicationListeners'));
  const theme = JSON.parse(text(entry(plain, 'themes/acme-dark.theme.json').body));
  assert.ok(!Object.keys(theme.icons.ColorPalette).some(k => k.startsWith('#')));
});

test('every set covers every role the rules use', () => {
  const roles = new Set(FILE_ICON_RULES.map(r => r[1]));
  for (const id of SETS) {
    for (const role of roles) {
      const glyph = ICON_SETS[id].roles[role];
      assert.ok(glyph, `${id} has no glyph for role "${role}"`);
      assert.ok(ICON_SETS[id].glyphs[glyph], `${id}: role "${role}" -> "${glyph}", which is not vendored`);
    }
    const used = new Set(Object.values(ICON_SETS[id].roles));
    for (const g of Object.keys(ICON_SETS[id].glyphs))
      assert.ok(used.has(g), `${id}: glyph "${g}" is vendored but unused`);
  }
});

for (const id of SETS) {
  test(`${id}: the jar carries the class, the icons, the rules and the licence`, () => {
    const g = buildPlugin({ ...base, options: { fileIcons: id } });
    const cls = entry(g, 'forge/ForgeIconProvider.class');
    assert.ok(cls, 'class file present');
    assert.deepEqual([...cls.body.slice(0, 4)], [0xCA, 0xFE, 0xBA, 0xBE], 'JVM magic number');
    assert.equal((cls.body[6] << 8) | cls.body[7], 61,
      'compiled for Java 17, the runtime of the oldest IDE we support (233)');
    assert.match(text(entry(g, 'META-INF/plugin.xml').body),
      /<iconProvider implementation="forge\.ForgeIconProvider" order="first"\/>/);
    // the same class listens for theme switches, so the tree is redrawn at once
    assert.match(text(entry(g, 'META-INF/plugin.xml').body),
      /<applicationListeners>\s*<listener class="forge\.ForgeIconProvider"\s+topic="com\.intellij\.ide\.ui\.LafManagerListener"\/>\s*<\/applicationListeners>/);
    assert.ok(entry(g, `forge-icons/LICENSE-${id}.txt`), 'licence notice ships with the icons');
    assert.equal(paths(g).filter(p => /forge-icons\/LICENSE-/.test(p)).length, 1, 'and only that set\'s');

    const lines = text(entry(g, 'forge-icons.properties').body).split('\n')
      .filter(l => l && !l.startsWith('#'));
    const rules = lines.filter(l => !l.startsWith('theme.'));
    assert.equal(rules.length, FILE_ICON_RULES.length);
    for (const line of rules) {
      const [key, path] = line.split('=');
      assert.match(key, /^(name|ext|dir)\.[^:=\s]+$/, `key "${key}" must survive Properties.load`);
      assert.ok(entry(g, path.slice(1)), `${key} -> ${path} is missing`);
    }
    for (const want of ['dir.*', 'dir.tests', 'ext.php', 'ext.blade.php', 'name.composer.json', 'name..env'])
      assert.ok(rules.some(l => l.startsWith(want + '=')), `no rule for ${want}`);
  });

  test(`${id}: 16px icons painted only in placeholder colours, on the shapes`, () => {
    const slots = new Set(Object.values(FILE_ICON_SLOTS).map(s => s.placeholder));
    const svgs = buildFileIconEntries(id, []).filter(e => e.path.endsWith('.svg'));
    assert.ok(svgs.length >= 18);
    for (const e of svgs) {
      assert.match(e.body, /width="16" height="16"/);
      assert.ok(!e.body.includes('currentColor'), e.path);
      // JetBrains' own icons colour the shapes, never the root; the palette patcher follows suit.
      assert.ok(!/<svg[^>]*\s(fill|stroke)="#/.test(e.body), `${e.path}: colour belongs on the shapes`);
      const shapes = e.body.match(SHAPE) || [];
      assert.ok(shapes.length >= 1, e.path);
      for (const s of shapes) {
        const m = s.match(new RegExp(`\\s${ICON_SETS[id].paint}="(#[0-9a-f]{6})"`));
        assert.ok(m, `${e.path}: a shape without its ${ICON_SETS[id].paint}: ${s.slice(0, 60)}`);
        assert.ok(slots.has(m[1]), `${e.path} uses ${m[1]}, which no theme will remap`);
      }
    }
  });
}

test('the plugin only dresses files under its own themes', () => {
  const g = buildPlugin({ ...base, family: 'Café Noir', options: { fileIcons: 'heroicons' } });
  const props = text(entry(g, 'forge-icons.properties').body);
  const names = props.split('\n').filter(l => l.startsWith('theme.')).map(l => l.split('=')[1]);
  assert.deepEqual(names, g.variants.map(v => v.name));
  assert.ok(names.includes('Café Noir Dark'), 'written as UTF-8, which is how the provider reads it');
});

test('every variant remaps every placeholder to one of its own colours', () => {
  const g = buildPlugin({ ...base, options: { fileIcons: 'bootstrap' } });
  for (const v of g.variants) {
    const pal = JSON.parse(text(entry(g, `themes/${v.slug}.theme.json`).body)).icons.ColorPalette;
    for (const [slot, { placeholder, token }] of Object.entries(FILE_ICON_SLOTS)) {
      // literal hex, not a token name: named values are only proven for the platform's own keys
      assert.equal(pal[placeholder.toLowerCase()], v.res.T[token], `${v.id}: ${slot}`);
      assert.equal(pal[placeholder.toUpperCase()], v.res.T[token], `${v.id}: ${slot} (upper-case key)`);
    }
  }
});

test('monochrome icons also flattens the file icons', () => {
  const g = buildPlugin({ ...base, options: { fileIcons: 'heroicons', monochromeIcons: true } });
  const pal = JSON.parse(text(entry(g, 'themes/acme-dark.theme.json').body)).icons.ColorPalette;
  for (const { placeholder } of Object.values(FILE_ICON_SLOTS))
    assert.match(pal[placeholder.toLowerCase()], /^#[0-9A-F]{6}$/i);
  assert.equal(new Set(Object.values(FILE_ICON_SLOTS).map(s => pal[s.placeholder])).size, 1, 'one neutral for all');
});

test('rule lookup mirrors the Java: exact name, then longest extension, then folder fallback', () => {
  assert.deepEqual(fileIconFor('invoice.blade.php', false), ['blade', 'danger']);
  assert.deepEqual(fileIconFor('Invoice.PHP', false), ['php', 'primary']);
  assert.deepEqual(fileIconFor('composer.json', false), ['composer', 'secondary']);
  assert.deepEqual(fileIconFor('.env', false), ['env', 'secondary']);
  assert.deepEqual(fileIconFor('tests', true), ['folder-tests', 'tertiary']);
  assert.deepEqual(fileIconFor('anything', true), ['folder', 'neutral']);
  assert.equal(fileIconFor('Makefile', false), null);
  assert.match(fileIconSvg('tabler', 'php', 'var(--t-accentPrimary)'), /stroke="var\(--t-accentPrimary\)"/);
});

test('the Gradle project gets the Java source, not the compiled class', () => {
  const g = buildPlugin({ ...base, options: { fileIcons: 'tabler' } });
  const src = g.src.map(e => e.path);
  assert.ok(src.includes('acme-src/src/main/java/forge/ForgeIconProvider.java'));
  assert.ok(!src.some(p => p.endsWith('.class')));
  assert.match(text(g.src.find(e => e.path.endsWith('build.gradle.kts')).body), /id\("java"\)/);
});
