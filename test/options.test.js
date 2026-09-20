import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOptions, DENSITY, RADIUS } from '../src/lib/options.js';
import { deriveTokens, VARIANTS } from '../src/lib/derive.js';
import { buildThemeJson } from '../src/lib/emit-theme.js';
import { buildSchemeXml } from '../src/lib/emit-scheme.js';
import { buildPlugin } from '../src/lib/package.js';
import { cr } from '../src/lib/color.js';

const PAL = ['#1B1D23', '#D4D7DE', '#4C8DF6', '#E5A33C', '#5CC98A'];
const theme = (opts, variant = 'dark') => JSON.parse(buildThemeJson(
  deriveTokens(PAL, variant), { name: 'T', author: 'a', slug: 't' }, opts));

test('resolveOptions fills defaults and rejects nonsense', () => {
  assert.equal(resolveOptions({}).density, 24);
  assert.throws(() => resolveOptions({ density: 'huge' }), /unknown density/);
  assert.throws(() => resolveOptions({ radius: 'blobby' }), /unknown radius/);
  assert.equal(resolveOptions({ underlineHeight: 99 }).underlineHeight, 4);
  assert.equal(resolveOptions({ underlineHeight: -3 }).underlineHeight, 0);
});

test('density drives every row height and header together', () => {
  for (const [name, d] of Object.entries(DENSITY)) {
    const ui = theme({ density: name }).ui;
    assert.equal(ui.Tree.rowHeight, d.treeRow, name);
    assert.equal(ui.List.rowHeight, d.listRow, name);
    assert.equal(ui.ToolWindow.Header.height, d.toolHeader, name);
    assert.equal(ui.MainToolbar.Button.size, d.toolbarBtn, name);
    assert.equal(ui.PopupMenuSeparator.height, d.sepHeight, name);
  }
  assert.ok(theme({ density: 'compact' }).ui.Tree.rowHeight
          < theme({ density: 'comfortable' }).ui.Tree.rowHeight);
});

test('radius drives every corner together', () => {
  for (const [name, r] of Object.entries(RADIUS)) {
    const ui = theme({ radius: name }).ui;
    assert.equal(ui.Component.arc, r.component, name);
    assert.equal(ui.Button.arc, r.component, name);
    assert.equal(ui.Tree.Selection.arc, r.selection, name);
    assert.equal(ui.Notification.arc, r.notification, name);
    assert.equal(ui.Island.arc, r.island, name);
  }
});

test('tab underline thickness reaches all four tab families', () => {
  const ui = theme({ underlineHeight: 3 }).ui;
  assert.equal(ui.EditorTabs.underlineHeight, 3);
  assert.equal(ui.DefaultTabs.underlineHeight, 3);
  assert.equal(ui.DebuggerTabs.underlineHeight, 3);
  assert.equal(ui.ToolWindow.HeaderTab.underlineHeight, 3);
  assert.equal(ui.TabbedPane.tabSelectionHeight, 3);
});

test('borderless points borders at transparent rather than dropping keys', () => {
  // Deleting the keys would let the base look-and-feel show through.
  const t = theme({ borderless: true });
  assert.equal(t.colors.borderDefault, '#00000000');
  assert.equal(t.colors.separator, '#00000000');
  assert.equal(t.ui.Popup.paintBorder, false);
  assert.equal(t.ui.Window.border, '0,0,0,0');
  assert.ok('borderColor' in t.ui['*'], 'the wildcard key must still exist');
});

test('accent scrollbars swap the thumb for the accent', () => {
  const plain = theme({});
  const accent = theme({ accentScrollbars: true });
  assert.notEqual(plain.colors.sbThumb, accent.colors.sbThumb);
  assert.equal(accent.colors.sbThumbHover, accent.colors.accentPrimary);
});

test('monochrome icons collapse Actions and Objects but keep checkboxes', () => {
  const pal = theme({ monochromeIcons: true }).icons.ColorPalette;
  assert.equal(pal['Actions.Red'], 'fgMuted');
  assert.equal(pal['Objects.Purple'], 'fgMuted');
  assert.notEqual(pal['Checkbox.Background.Selected.Dark'], 'fgMuted',
    'checkbox glyph colours are structural, not decorative');
});

test('fonts are written only when asked for', () => {
  const bare = buildSchemeXml(deriveTokens(PAL, 'dark'), { name: 'T' }, {});
  assert.ok(!/EDITOR_FONT_NAME/.test(bare), "a theme must not stomp the user's font by default");

  const withFont = buildSchemeXml(deriveTokens(PAL, 'dark'), { name: 'T' },
    { font: { editor: 'JetBrains Mono', editorSize: 14, lineSpacing: 1.3, ligatures: true } });
  assert.match(withFont, /<option name="EDITOR_FONT_NAME" value="JetBrains Mono" \/>/);
  assert.match(withFont, /<option name="EDITOR_FONT_SIZE" value="14" \/>/);
  assert.match(withFont, /<option name="LINE_SPACING" value="1.3" \/>/);
  assert.match(withFont, /<option name="EDITOR_LIGATURES" value="true" \/>/);
});

test('comment italics and keyword bold are switchable', () => {
  const on = buildSchemeXml(deriveTokens(PAL, 'dark'), { name: 'T' },
    { italicComments: true, boldKeywords: true });
  const off = buildSchemeXml(deriveTokens(PAL, 'dark'), { name: 'T' },
    { italicComments: false, boldKeywords: false });
  const block = (xml, key) => xml.slice(xml.indexOf(`name="${key}"`), xml.indexOf(`name="${key}"`) + 200);
  assert.match(block(on, 'DEFAULT_LINE_COMMENT'), /FONT_TYPE" value="2"/);
  assert.ok(!/FONT_TYPE/.test(block(off, 'DEFAULT_LINE_COMMENT')));
  assert.match(block(on, 'DEFAULT_KEYWORD'), /FONT_TYPE" value="1"/);
  assert.ok(!/FONT_TYPE/.test(block(off, 'DEFAULT_KEYWORD')));
});

test('a wallpaper ships one image per variant and every theme points at its own', () => {
  const p = buildPlugin({ palette: PAL, family: 'W', id: 'com.w.t',
                          options: { wallpaper: { transparency: 10 } } });
  const paths = new Set(p.jarEntries.map(e => e.path));
  const pngs = [...paths].filter(n => n.endsWith('-bg.png'));
  assert.equal(pngs.length, VARIANTS.length);

  for (const e of p.jarEntries) {
    if (!e.path.endsWith('.theme.json')) continue;
    const t = JSON.parse(e.body);
    assert.ok(t.background, `${e.path} has no background`);
    assert.equal(t.background.transparency, 10);
    assert.ok(paths.has(t.background.image.replace(/^\//, '')),
      `${e.path} points at a missing image`);
    assert.ok(t.emptyFrameBackground.transparency > t.background.transparency,
      'the empty frame can carry a stronger wash than the editor');
  }
});

test('no background block at all when the wallpaper is off', () => {
  assert.equal(theme({}).background, undefined);
});

test('the OLED variant is a true black editor with chrome that still lifts off it', () => {
  const { T } = deriveTokens(PAL, 'oled');
  assert.equal(T.bgEditor, '#000000');
  assert.ok(cr(T.bgBase, T.bgEditor) > 1.2, 'panels must be distinguishable from the editor');
  assert.ok(cr(T.fgDefault, T.bgEditor) >= 7);
  assert.ok(cr(T.bgSelection, T.bgEditor) >= 1.2, 'selection must be visible on black');
});

test('OLED inverts a light palette rather than putting dark text on black', () => {
  const light = ['#FBFAF6', '#23262B', '#2F6FB0', '#B7791F', '#3F7A54'];
  const { T } = deriveTokens(light, 'oled');
  assert.equal(T.bgEditor, '#000000');
  assert.ok(cr(T.fgDefault, T.bgEditor) >= 7, 'text must be readable on black');
});

test('options survive a round trip through buildPlugin', () => {
  const p = buildPlugin({ palette: PAL, family: 'O', id: 'com.o.t',
    options: { density: 'compact', radius: 'round', underlineHeight: 4, borderless: true } });
  const t = JSON.parse(p.jarEntries.find(e => e.path.endsWith('.theme.json')).body);
  assert.equal(t.ui.Tree.rowHeight, DENSITY.compact.treeRow);
  assert.equal(t.ui.Component.arc, RADIUS.round.component);
  assert.equal(t.ui.EditorTabs.underlineHeight, 4);
  assert.equal(t.colors.borderDefault, '#00000000');
});

test('density and radius are sliders: any px value, with the old names as anchors', () => {
  assert.equal(resolveOptions({}).density, 24);
  assert.equal(resolveOptions({}).radius, 6);
  assert.equal(resolveOptions({ density: 'compact' }).density, 20);
  assert.equal(resolveOptions({ density: 'comfortable' }).density, 30);
  assert.equal(resolveOptions({ radius: 'sharp' }).radius, 0);
  assert.equal(resolveOptions({ radius: 'round' }).radius, 10);
  assert.equal(resolveOptions({ density: '27' }).density, 27, 'CLI hands over strings');
  assert.equal(resolveOptions({ density: 99 }).density, 32);
  assert.equal(resolveOptions({ density: 3 }).density, 18);
  assert.equal(resolveOptions({ radius: 99 }).radius, 12);
  assert.equal(resolveOptions({ radius: -4 }).radius, 0);

  assert.deepEqual(theme({ density: 20 }).ui, theme({ density: 'compact' }).ui);
  assert.deepEqual(theme({ radius: 10 }).ui, theme({ radius: 'round' }).ui);

  let prev = null;
  for (let px = 18; px <= 32; px++) {
    const ui = theme({ density: px }).ui;
    assert.equal(ui.Tree.rowHeight, px);
    for (const v of [ui.List.rowHeight, ui.ToolWindow.Header.height, ui.MainToolbar.Button.size, ui.PopupMenuSeparator.height])
      assert.ok(Number.isInteger(v) && v > 0, `integer at ${px}`);
    if (prev) assert.ok(ui.List.rowHeight >= prev.List.rowHeight && ui.ToolWindow.Header.height >= prev.ToolWindow.Header.height);
    prev = ui;
  }
  prev = null;
  for (let px = 0; px <= 12; px++) {
    const ui = theme({ radius: px }).ui;
    assert.equal(ui.Tree.Selection.arc, px);
    assert.equal(ui.Component.arc, px);
    assert.ok(Number.isInteger(ui.Island.arc) && Number.isInteger(ui.Notification.arc));
    if (prev) assert.ok(ui.Island.arc >= prev.Island.arc && ui.Notification.arc >= prev.Notification.arc);
    prev = ui;
  }
});
