import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VARIANTS, deriveTokens, expandSeeds } from '../src/lib/derive.js';
import { cr, toOklch } from '../src/lib/color.js';

const PALETTES = {
  'blue/amber/green': ['#1B1D23', '#D4D7DE', '#4C8DF6', '#E5A33C', '#5CC98A'],
  nord:               ['#2E3440', '#D8DEE9', '#88C0D0', '#EBCB8B', '#A3BE8C'],
  gruvbox:            ['#282828', '#EBDBB2', '#83A598', '#FABD2F', '#B8BB26'],
  'light seed':       ['#FBFAF6', '#23262B', '#2F6FB0', '#B7791F', '#3F7A54'],
  'low chroma':       ['#111111', '#EEEEEE', '#777777', '#888888', '#999999'],
  synthwave:          ['#0D0221', '#F5F0FF', '#FF2A6D', '#05D9E8', '#39FF14']
};

const FLOORS = [
  ['fgDefault',   'bgEditor', 7.0],
  ['fgMuted',     'bgBase',   4.5],
  ['fgSubtle',    'bgBase',   3.5],
  ['synComment',  'bgEditor', 4.5],
  ['synKeyword',  'bgEditor', 4.5],
  ['synString',   'bgEditor', 4.5],
  ['synType',     'bgEditor', 4.5],
  ['synFunction', 'bgEditor', 4.5],
  ['synConstant', 'bgEditor', 4.5],
  ['synNumber',   'bgEditor', 4.5]
];

for (const [pname, palette] of Object.entries(PALETTES)) {
  for (const v of VARIANTS) {
    test(`${pname} / ${v.id}: every contrast floor holds`, () => {
      const { T } = deriveTokens(palette, v.id);
      for (const [fg, bg, target] of FLOORS) {
        const r = cr(T[fg], T[bg]);
        assert.ok(r >= target, `${fg} on ${bg} = ${r.toFixed(2)}, need ${target}`);
      }
      assert.ok(cr(T.fgDefault, T.bgSelection) >= 4.5, 'selected text must stay readable');
    });
  }
}

test('selection is visible but not shouting', () => {
  for (const [, palette] of Object.entries(PALETTES)) {
    for (const v of VARIANTS) {
      const { T } = deriveTokens(palette, v.id);
      const r = cr(T.bgSelection, T.bgEditor);
      assert.ok(r >= 1.15 && r <= 2.4, `selection contrast ${r.toFixed(2)} for ${v.id}`);
    }
  }
});

test('backgrounds stay near-neutral — a tinted background looks stained', () => {
  // The derivation caps background chroma at 0.012 in OKLCH, but the value is
  // then quantised to 8-bit sRGB, which can nudge it a little either way.
  // Assert the intent with room for that rounding, not the exact constant.
  const { T } = deriveTokens(PALETTES.nord, 'vivid');
  for (const k of ['bgEditor', 'bgBase', 'bgRaised', 'bgSunken', 'bgHover', 'bgPress']) {
    assert.ok(toOklch(T[k]).c <= 0.015, `${k} chroma ${toOklch(T[k]).c}`);
  }
});

test('the editor is the extreme end of the surface ramp', () => {
  for (const v of VARIANTS) {
    const { T, isDark } = deriveTokens(PALETTES['blue/amber/green'], v.id);
    const L = k => toOklch(T[k]).l;
    const others = ['bgBase', 'bgRaised', 'bgHover', 'bgPress', 'bgOverlay'].map(L);
    if (isDark) assert.ok(others.every(l => l >= L('bgEditor') - 1e-9), `${v.id}: editor not darkest`);
    else assert.ok(others.every(l => l <= L('bgEditor') + 1e-9), `${v.id}: editor not lightest`);
  }
});

test('light variant really is light, dark variants really are dark', () => {
  const p = PALETTES['blue/amber/green'];
  assert.equal(deriveTokens(p, 'light').isDark, false);
  for (const v of VARIANTS) assert.ok(['dark', 'light', 'other'].includes(v.mode), `${v.id} has a mode`);
  assert.deepEqual(VARIANTS.filter(v => v.mode === 'light').map(v => v.id),
    ['light', 'paper', 'tinted', 'light-contrast', 'soft', 'light-vivid']);
  // a light variant is light whichever way round the seeds came in
  for (const pal of Object.values(PALETTES))
    for (const v of VARIANTS.filter(v => v.mode === 'light'))
      assert.equal(deriveTokens(pal, v.id).isDark, false, v.id);
  for (const id of ['dark', 'darker', 'muted', 'vivid', 'contrast', 'oled', 'neon'])
    assert.equal(deriveTokens(p, id).isDark, true, id);
});

const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

test('a coloured anchor keeps its own hue instead of being repainted in the accent hue', () => {
  // Synthwave's anchor is a deep purple; its primary accent is hot pink. The
  // surfaces used to come out brown-black because they took the accent's hue.
  const anchor = toOklch(PALETTES.synthwave[0]);
  for (const id of ['dark', 'darker', 'vivid', 'neon']) {
    const { T } = deriveTokens(PALETTES.synthwave, id);
    for (const k of ['bgBase', 'bgRaised', 'bgOverlay'])
      assert.ok(hueGap(toOklch(T[k]).h, anchor.h) <= 40,
        `${id}.${k} hue ${toOklch(T[k]).h.toFixed(0)} vs anchor ${anchor.h.toFixed(0)}`);
  }
});

test('derived syntax colours keep their chroma when the accents oppose each other', () => {
  // Pink + green averaged in OKLab passes through grey; the function colour
  // came out a dull gold next to two neon accents.
  const { T } = deriveTokens(PALETTES.synthwave, 'dark');
  assert.ok(toOklch(T.synFunction).c >= 0.12, `synFunction chroma ${toOklch(T.synFunction).c.toFixed(3)}`);
});

test('the constant colour never lands on top of another syntax hue', () => {
  for (const [pname, palette] of Object.entries(PALETTES)) {
    if (pname === 'low chroma') continue;
    const { T } = deriveTokens(palette, 'dark');
    const h = k => toOklch(T[k]).h;
    for (const other of ['synKeyword', 'synString', 'synType'])
      assert.ok(hueGap(h('synConstant'), h(other)) >= 30,
        `${pname}: synConstant (${h('synConstant').toFixed(0)}) sits on ${other} (${h(other).toFixed(0)})`);
  }
});

test('neon: dark, saturated surfaces, accent-tinted chrome, unclamped colour', () => {
  assert.ok(VARIANTS.some(v => v.id === 'neon'), 'neon is a variant');
  assert.equal(deriveTokens(PALETTES['light seed'], 'neon').isDark, true, 'a light palette is inverted');

  const dark = deriveTokens(PALETTES.synthwave, 'dark').T;
  const neon = deriveTokens(PALETTES.synthwave, 'neon').T;
  const c = hex => toOklch(hex).c;

  for (const k of ['bgEditor', 'bgBase', 'bgRaised'])
    assert.ok(c(neon[k]) >= 0.025 && c(neon[k]) <= 0.085, `${k} chroma ${c(neon[k]).toFixed(3)}`);
  assert.ok(toOklch(neon.bgEditor).l <= 0.2, 'neon needs a dark stage');

  const accentHue = toOklch(neon.accentPrimary).h;
  for (const k of ['borderDefault', 'separator', 'guideIndentOn']) {
    assert.ok(c(neon[k]) >= 0.03, `${k} should carry accent colour, chroma ${c(neon[k]).toFixed(3)}`);
    // mixed over a purple stage, so the hue sits between accent and stage
    assert.ok(hueGap(toOklch(neon[k]).h, accentHue) <= 60, `${k} hue ${toOklch(neon[k]).h.toFixed(0)}`);
  }

  for (const k of ['ansiMagenta', 'ansiBlue', 'ansiYellow']) // hues with gamut to spare
    assert.ok(c(neon[k]) > c(dark[k]) + 0.01, `${k}: neon ${c(neon[k]).toFixed(3)} vs dark ${c(dark[k]).toFixed(3)}`);

  // a neutral anchor still gets a tinted stage in neon
  assert.ok(c(neon.synKeyword) >= c(dark.synKeyword) - 0.005, 'neon must not dull an already saturated accent');

  const plain = deriveTokens(PALETTES['low chroma'], 'neon').T;
  assert.ok(toOklch(plain.bgEditor).l <= 0.2);
});

test('derivation is deterministic', () => {
  const a = deriveTokens(PALETTES.nord, 'dark').T;
  const b = deriveTokens(PALETTES.nord, 'dark').T;
  assert.deepEqual(a, b);
});

test('keyword and string are tellable apart', () => {
  for (const [pname, palette] of Object.entries(PALETTES)) {
    const { T } = deriveTokens(palette, 'dark');
    const k = toOklch(T.synKeyword), s = toOklch(T.synString);
    const dh = Math.min(Math.abs(k.h - s.h), 360 - Math.abs(k.h - s.h));
    assert.ok(dh >= 40 || Math.abs(k.l - s.l) >= 0.12,
      `${pname}: keyword and string too close (dh=${dh.toFixed(0)})`);
  }
});

test('an accent whose hue already reads as green becomes the success colour', () => {
  const { T } = deriveTokens(PALETTES['blue/amber/green'], 'dark');
  assert.equal(T.semSuccess, '#5CC98A');
  assert.equal(T.semWarning, '#E5A33C');
});

test('every token is a valid hex string', () => {
  for (const v of VARIANTS) {
    const { T } = deriveTokens(PALETTES.gruvbox, v.id);
    for (const [k, val] of Object.entries(T))
      assert.match(val, /^#[0-9A-F]{6}([0-9A-F]{2})?$/, `${v.id}.${k} = ${val}`);
  }
});

test('the caret row is a token: neutral everywhere, accent-tinted in neon', () => {
  const dark = deriveTokens(PALETTES.synthwave, 'dark').T;
  const neon = deriveTokens(PALETTES.synthwave, 'neon').T;
  assert.ok(toOklch(dark.caretRow).c <= 0.02, 'dark caret row stays neutral');
  assert.ok(toOklch(neon.caretRow).c >= 0.04, `neon caret row chroma ${toOklch(neon.caretRow).c.toFixed(3)}`);
  for (const T of [dark, neon]) {
    const r = cr(T.caretRow, T.bgEditor);
    assert.ok(r > 1.02 && r < 1.5, `caret row is a whisper, not a band (${r.toFixed(2)})`);
    assert.ok(cr(T.fgDefault, T.caretRow) >= 7, 'text on the caret row stays readable');
  }
});

test('the light variants differ in the ways their names promise', () => {
  const p = PALETTES['blue/amber/green'];
  const bg = id => toOklch(deriveTokens(p, id).T.bgEditor);

  const paper = bg('paper');
  assert.ok(paper.h > 55 && paper.h < 110, `paper is warm, hue ${paper.h}`);
  assert.ok(paper.l < bg('light').l, 'paper is off-white, not white');

  const tinted = bg('tinted');
  assert.ok(hueGap(tinted.h, toOklch(p[2]).h) < 25, 'tinted carries the primary accent hue');
  assert.ok(tinted.c > bg('light').c + 0.008, 'and visibly more of it than Light');
  // the bounded exception to "backgrounds stay near-neutral"
  for (const pal of Object.values(PALETTES)) {
    const { T } = deriveTokens(pal, 'tinted');
    for (const k of ['bgEditor', 'bgBase', 'bgRaised', 'bgSunken', 'bgHover', 'bgPress'])
      assert.ok(toOklch(T[k]).c <= 0.04, `${k} chroma ${toOklch(T[k]).c}`);
  }

  const lc = deriveTokens(p, 'light-contrast').T;
  assert.ok(cr(lc.fgDefault, lc.bgEditor) >= 15, 'light contrast is near black on white');
  assert.ok(bg('light-contrast').l > 0.99);

  assert.ok(bg('soft').l < bg('light').l - 0.04, 'soft dims the page');
  const chroma = id => Math.max(...['accentPrimary', 'accentSecondary', 'accentTertiary']
    .map(k => toOklch(deriveTokens(p, id).T[k]).c));
  assert.ok(chroma('soft') < chroma('light'), 'soft mutes the accents');
  assert.ok(chroma('light-vivid') > chroma('light'), 'light vivid pushes them');
});

/* ---- palettes of two, three and four colours ---- */
const SYN = ['synKeyword', 'synString', 'synNumber', 'synType', 'synFunction', 'synConstant'];

test('five colours derive exactly what they did before shorter palettes existed', async () => {
  const { createHash } = await import('node:crypto');
  const P = [PALETTES['blue/amber/green'], ['#FBF9F3', '#2B2A26', '#3C6E9F', '#B07B26', '#4E7A45'],
             ['#122738', '#E1EFFF', '#3AD900', '#FFC600', '#80FCFF']];
  const all = P.map(p => VARIANTS.map(v => { const r = deriveTokens(p, v.id); return [r.T, r.P, r.repairs]; }));
  assert.equal(createHash('sha256').update(JSON.stringify(all)).digest('hex'),
    '75a86febcd7057dfc67c1aaca5ca94149c54c114dd2fd75e40ffb64498b3eb03');
});

test('expandSeeds fills a short palette up to five and keeps what it was given', () => {
  for (const p of [['#000000', '#00FF41'], ['#1B1D23', '#D4D7DE', '#4C8DF6'],
                   ['#1B1D23', '#D4D7DE', '#4C8DF6', '#E5A33C']]) {
    const { seeds } = expandSeeds(p);
    assert.equal(seeds.length, 5);
    assert.deepEqual(seeds.slice(0, p.length), p);
    for (const c of seeds) assert.match(c, /^#[0-9A-Fa-f]{6}$/);
  }
  const five = PALETTES.nord;
  assert.deepEqual(expandSeeds(five), { seeds: five, tonal: false });
  assert.throws(() => expandSeeds(['#000000']), /2 to 5/);
  assert.throws(() => expandSeeds([...five, '#FFFFFF']), /2 to 5/);
});

test('two colours: every syntax colour stays in the ink\'s hue and is told apart by lightness', () => {
  const ink = toOklch('#00FF41');
  for (const v of VARIANTS.filter(v => v.mode === 'dark')) {
    const { T } = deriveTokens(['#000000', '#00FF41'], v.id);
    for (const k of SYN) {
      const o = toOklch(T[k]);
      if (o.c >= 0.04) assert.ok(hueGap(o.h, ink.h) < 25, `${v.id} ${k} ${T[k]} left the green`);
      assert.ok(cr(T[k], T.bgEditor) >= 4.5, `${v.id} ${k} contrast`);
    }
    assert.ok(Math.abs(toOklch(T.synKeyword).l - toOklch(T.synString).l) >= 0.1, `${v.id} keyword vs string`);
    assert.ok(new Set(SYN.map(k => T[k])).size >= 5, `${v.id} has depth, not one flat green`);
  }
});

test('two colours: white on black stays grey', () => {
  const { T } = deriveTokens(['#000000', '#FFFFFF'], 'dark');
  for (const k of SYN) assert.ok(toOklch(T[k]).c < 0.04, `${k} ${T[k]} picked up colour`);
});

test('three colours: the two missing accents land well away from the one given, and from each other', () => {
  const { seeds, tonal } = expandSeeds(['#1B1D23', '#D4D7DE', '#4C8DF6']);
  assert.equal(tonal, false);
  const [h3, h4, h5] = seeds.slice(2).map(c => toOklch(c).h);
  assert.ok(hueGap(h3, h4) >= 60 && hueGap(h3, h5) >= 60 && hueGap(h4, h5) >= 60, seeds.join(' '));
});

test('three colours with a grey accent fall back to tone, not to invented hues', () => {
  const { seeds, tonal } = expandSeeds(['#111111', '#EEEEEE', '#888888']);
  assert.equal(tonal, true);
  for (const c of seeds) assert.ok(toOklch(c).c < 0.04);
});

test('four colours: the fifth takes the widest free stretch of the hue circle', () => {
  const { seeds } = expandSeeds(['#1B1D23', '#D4D7DE', '#4C8DF6', '#E5A33C']);
  const [h3, h4, h5] = seeds.slice(2).map(c => toOklch(c).h);
  assert.ok(hueGap(h5, h3) >= 45 && hueGap(h5, h4) >= 45, seeds.join(' '));
});

test('short palettes hold the contrast floors in every variant', () => {
  for (const p of [['#000000', '#00FF41'], ['#FFFFFF', '#1A1A1A'], ['#1B1D23', '#D4D7DE', '#4C8DF6'],
                   ['#122738', '#E1EFFF', '#3AD900', '#FFC600']])
    for (const v of VARIANTS) {
      const { T } = deriveTokens(p, v.id);
      for (const [k, c] of Object.entries(T)) assert.match(c, /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/, `${k} in ${v.id}`);
      for (const k of SYN) assert.ok(cr(T[k], T.bgEditor) >= 4.5, `${p.join(',')} ${v.id} ${k}`);
    }
});

test('a duotone keeps its depth on a light page too', () => {
  for (const p of [['#000000', '#00FF41'], ['#0B1020', '#FFB000'], ['#FFFFFF', '#1A1A1A']])
    for (const v of VARIANTS) {
      const { T } = deriveTokens(p, v.id);
      const L = ['synKeyword', 'synType', 'synString'].map(k => toOklch(T[k]).l).sort((a, b) => a - b);
      assert.ok(L[1] - L[0] >= 0.06 && L[2] - L[1] >= 0.06,
        `${p.join(' ')} ${v.id}: keyword/type/string lightness ${L.map(x => x.toFixed(2)).join(' ')}`);
    }
});

test('a plainly coloured anchor is honoured: a yellow page stays yellow', () => {
  const pal = ['#FFE600', '#000000', '#4C8DF6', '#E5A33C', '#5CC98A'];
  const want = toOklch(pal[0]);
  for (const id of ['dark', 'darker', 'contrast', 'muted', 'vivid']) {
    const { T } = deriveTokens(pal, id);
    for (const k of ['bgEditor', 'bgBase', 'bgRaised', 'bgSunken', 'bgOverlay', 'bgHover', 'bgPress']) {
      const o = toOklch(T[k]);
      assert.ok(o.c >= 0.12, `${id} ${k} ${T[k]} went grey (chroma ${o.c.toFixed(3)})`);
      assert.ok(hueGap(o.h, want.h) < 15, `${id} ${k} ${T[k]} changed hue`);
    }
    assert.ok(cr(T.fgDefault, T.bgEditor) >= 7, `${id} text`);
    for (const k of SYN) assert.ok(cr(T[k], T.bgEditor) >= 4.5, `${id} ${k}`);
  }
  // deep and saturated works too, and OLED still means black
  assert.ok(toOklch(deriveTokens(['#5B0A91', '#FFFFFF', '#FF2A6D', '#05D9E8', '#39FF14'], 'dark').T.bgEditor).c >= 0.12);
  assert.equal(deriveTokens(pal, 'oled').T.bgEditor, '#000000');
});
