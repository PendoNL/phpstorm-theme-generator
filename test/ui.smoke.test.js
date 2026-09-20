import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { JSDOM } from 'jsdom';

/**
 * Boots the built single-file bundle in jsdom and drives it.
 *
 * This exists because a syntax check is not a smoke test: an early version
 * shipped with a truncated </script> and a Blade view that threw on render,
 * and both parsed fine.
 */
let dom, doc, errors, clicked;

before(() => {
  if (!existsSync(new URL('../dist/index.html', import.meta.url)))
    execFileSync(process.execPath, ['scripts/build.js'], { cwd: new URL('..', import.meta.url) });

  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  errors = [];
  dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(w) {
      w.addEventListener('error', e => errors.push(String(e.error?.stack || e.message)));
      w.addEventListener('unhandledrejection', e => errors.push('unhandled rejection: ' + e.reason));
      // jsdom omits a few standard browser globals depending on version.
      // Real browsers have all of these; provide them so the test exercises
      // the app rather than the harness.
      w.Element.prototype.scrollIntoView = () => {};
      if (!w.TextEncoder) w.TextEncoder = TextEncoder;
      if (!w.TextDecoder) w.TextDecoder = TextDecoder;
      w.URL.createObjectURL = () => 'blob:stub';
      w.URL.revokeObjectURL = () => {};
      clicked = [];
      const realClick = w.HTMLAnchorElement.prototype.click;
      w.HTMLAnchorElement.prototype.click = function () {
        if (this.download) clicked.push(this.download);
        else realClick.call(this);
      };
    }
  });
  doc = dom.window.document;
});

const $ = s => doc.querySelector(s);
const all = s => doc.querySelectorAll(s);
const click = el => {
  assert.ok(el, 'element to click is missing');
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
};

test('renders a populated UI at rest', () => {
  assert.equal(all('.seed').length, 5, 'five palette inputs');
  assert.ok(all('.varbtn').length >= 6, 'variant buttons');
  assert.ok(all('.preset').length >= 4, 'preset chips');
  assert.ok(all('.tok').length > 50, 'token table');
  assert.equal(all('.aud').length, 14, 'contrast audit rows');
  assert.ok($('#repairnote').textContent.length > 10, 'repair note');
  assert.ok($('#audit-title').textContent.length > 10, 'audit headline');
  assert.match($('#derivation').textContent, /^\d+ keys derived/);
});

test('the header links pendo.nl with its campaign tags, and the repo', () => {
  const made = $('.topbar a.madeby');
  assert.ok(made, 'made-by link');
  assert.equal(made.getAttribute('href'),
    'https://pendo.nl/?utm_campaign=tools&utm_source=phpstorm-theme-generator&utm_medium=header&utm_content=textlink');
  const gh = $('.topbar a#link-github');
  assert.ok(gh, 'GitHub link');
  assert.equal(gh.getAttribute('href'), 'https://github.com/PendoNL/phpstorm-theme-generator');
});

test('the theme name defaults to something generic', () => {
  assert.equal($('#famname').value, 'Custom Theme');
  click($('.view[data-view="files"]'));
  assert.ok([...all('.frow')].some(r => /custom-theme|Custom_Theme|Custom Theme/.test(r.textContent)), 'file names carry the default');
  click($('.view[data-view="preview"]'));
});

test('the four views switch, and only one shows at a time', () => {
  const shown = () => [...all('.pane')].filter(p => !p.hidden).map(p => p.id);
  assert.deepEqual(shown(), ['view-preview']);
  for (const v of ['tokens', 'contrast', 'files', 'preview']) {
    click($(`.view[data-view="${v}"]`));
    assert.deepEqual(shown(), ['view-' + v]);
    assert.equal($(`.view[data-view="${v}"]`).getAttribute('aria-selected'), 'true');
  }
  click($('#btn-audit'));
  assert.deepEqual(shown(), ['view-contrast'], '"See the derivation" opens the audit');
  click($('.view[data-view="preview"]'));
  assert.match($('#meta-tokens').textContent, /^\d{3,}$/);
  assert.match($('#meta-contrast').textContent, /^\d+\/14$/);
});

test('the token filter narrows the grid', () => {
  const total = all('.tok').length;
  const f = $('#tokfilter');
  f.value = 'ansi';
  f.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.ok(all('.tok').length > 0 && all('.tok').length < total);
  assert.match($('#tokcount').textContent, /match/);
  f.value = '';
  f.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.equal(all('.tok').length, total);
});

test('paints the preview from the derived tokens', () => {
  const ide = $('#ide');
  for (const k of ['--t-bgEditor', '--t-fgDefault', '--t-synKeyword', '--t-ansiRed'])
    assert.match(ide.style.getPropertyValue(k), /^#[0-9A-F]{6}/i, `${k} unset`);
  assert.equal(all('#tree .tr').length, 17, 'project tree');
  assert.equal(all('#code .ln').length, 32, 'PHP sample lines');
  assert.equal(all('#gutter .gl').length, 32, 'gutter lines');
  assert.ok(all('#term span').length > 20, 'terminal output');
  assert.equal(all('#diff .dl').length, 14, 'diff rows');
});

test('the Blade view actually renders', () => {
  // Regression: a malformed token array made this throw, leaving PHP on screen.
  click($('#lang-blade'));
  assert.equal(all('#code .ln').length, 22);
  click($('#lang-php'));
  assert.equal(all('#code .ln').length, 32);
});

test('switching variant repaints and marks the active pill', () => {
  const before = $('#ide').style.getPropertyValue('--t-bgEditor');
  click($('.varbtn[data-v="light"]'));
  assert.notEqual($('#ide').style.getPropertyValue('--t-bgEditor'), before);
  assert.equal($('.varbtn[data-v="light"]').getAttribute('aria-pressed'), 'true');
  assert.equal($('.varbtn[data-v="dark"]').getAttribute('aria-pressed'), 'false');
  click($('.varbtn[data-v="dark"]'));
});

test('variants sit in a dark, a light and an other row', () => {
  const rows = [...all('#varlist .varrow')];
  assert.deepEqual(rows.map(r => r.dataset.mode), ['dark', 'light', 'other']);
  assert.ok(rows[2].querySelector('.varbtn[data-v="neon"]'));
  assert.equal(rows[0].querySelectorAll('.varbtn').length, 6, 'as many dark as light, so the pills line up');
  assert.ok(rows[0].querySelector('.varbtn[data-v="oled"]'));
  assert.ok(rows[1].querySelector('.varbtn[data-v="paper"]'));
  assert.equal(all('#varlist .varrow .varbtn').length, all('.varbtn').length, 'no button outside a row');
  assert.equal(rows[1].querySelectorAll('.varbtn').length, 6);
});

test('presets and shuffle drive the whole pipeline', () => {
  click($('.preset[data-i="0"]'));
  assert.match($('#hex0').value, /^#[0-9A-F]{6}$/);
  click($('#btn-random'));
  assert.equal(all('.aud').length, 14, 'audit re-rendered');
});

test('style options collapse to a summary line', () => {
  assert.equal($('#stylebox').hidden, true);
  assert.equal($('#style-summary').textContent, '24px rows, 6px corners, 2 on');
  click($('#btn-style'));
  assert.equal($('#stylebox').hidden, false);
  assert.equal($('#style-summary').textContent, '');
});

test('style options change the preview', () => {
  const ide = $('#ide');
  const row = () => ide.style.getPropertyValue('--o-row');
  const before = row();
  const slide = (id, v) => { $(id).value = String(v); $(id).dispatchEvent(new dom.window.Event('input', { bubbles: true })); };
  assert.equal(before, '24px');
  slide('#opt-density', 19);
  assert.equal(row(), '19px', 'density must repaint the preview');
  assert.equal($('#opt-density-out').textContent, '19px');
  slide('#opt-radius', 9);
  assert.equal(ide.style.getPropertyValue('--o-arc'), '9px');
  assert.equal($('#opt-radius-out').textContent, '9px');

  const underline = $('#opt-underline');
  underline.value = '4';
  underline.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.equal(ide.style.getPropertyValue('--o-underline'), '4px');
  assert.equal($('#opt-underline-out').textContent, '4px');

  const borderless = $('#opt-borderless');
  borderless.checked = true;
  borderless.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.ok(ide.classList.contains('borderless'));

  const italic = $('#opt-italic');
  italic.checked = false;
  italic.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.ok(ide.classList.contains('no-italic'));

  // put it back so later tests see a normal theme
  borderless.checked = false; borderless.dispatchEvent(new dom.window.Event('change', {bubbles:true}));
  italic.checked = true; italic.dispatchEvent(new dom.window.Event('change', {bubbles:true}));
  slide('#opt-density', 24);
  slide('#opt-radius', 6);
});

test('the file browser lists real generated files', () => {
  click($('.view[data-view="files"]'));
  assert.ok(all('.frow').length >= 15, 'plugin.xml + icon + one theme.json and scheme per variant');
  assert.equal($('#meta-files').textContent, String(all('.frow').length));
  assert.ok($('#filepreview').textContent.length > 100, 'first file is shown without a click');
  click(all('.frow')[1]);
  assert.equal(all('.frow')[1].getAttribute('aria-pressed'), 'true');
  click($('.view[data-view="preview"]'));
});

test('the bottom panel is open by default and toggles to diff', () => {
  assert.equal($('#pan-toggle'), null, 'no show/hide control for the panel');
  assert.equal($('#panel').hidden, false);
  assert.equal($('#term').hidden, false);
  click($('#pan-diff'));
  assert.equal($('#diff').hidden, false);
  assert.equal($('#term').hidden, true);
});

test('file icons: the tree previews them and the plugin gains the class and the SVGs', () => {
  const sel = $('#opt-fileicons');
  const pick = v => { sel.value = v; sel.dispatchEvent(new dom.window.Event('change', { bubbles: true })); };
  assert.equal(sel.tagName, 'SELECT');
  assert.deepEqual([...sel.options].map(o => o.value),
    ['', 'heroicons', 'bootstrap', 'tabler'], 'Default first, then every set');
  assert.equal(sel.value, '');
  assert.equal(all('#tree .tr svg').length, 0, 'off by default');

  pick('tabler');
  assert.equal(all('#tree .tr svg').length, 17, 'every tree row gets a glyph');
  assert.match($('#tree .tr svg path').getAttribute('stroke'), /^var\(--t-/, 'tabler is stroked, from the live tokens');
  pick('heroicons');
  assert.equal(sel.value, 'heroicons');
  assert.match($('#tree .tr svg path').getAttribute('fill'), /^var\(--t-/, 'heroicons is filled');
  assert.match($('#fileicons-note').textContent, /Heroicons.*MIT/);

  click($('.view[data-view="files"]'));
  const names = [...all('.frow .fn2')].map(e => e.textContent);
  assert.ok(names.includes('ForgeIconProvider.class'));
  assert.ok(names.includes('forge-icons.properties'));
  click([...all('.frow')].find(r => r.textContent.includes('ForgeIconProvider.class')));
  assert.match($('#filepreview').textContent, /^Binary file, \d+ bytes/);

  pick('');
  assert.equal(all('#tree .tr svg').length, 0);
  assert.equal($('#fileicons-note').textContent, '');
  click($('.view[data-view="preview"]'));
});

test('there is no paste box', () => {
  assert.equal($('#paste'), null);
  assert.equal($('#btn-paste'), null);
  assert.equal($('#btn-apply-paste'), null);
  assert.ok($('#btn-swap'), 'swap stays');
});

test('presets live in a menu that opens on demand and closes on pick', () => {
  const menu = $('#presetmenu');
  assert.equal(menu.hidden, true);
  click($('#btn-presets'));
  assert.equal(menu.hidden, false);
  assert.equal($('#btn-presets').getAttribute('aria-expanded'), 'true');
  click($('.preset[data-i="1"]'));
  assert.equal(menu.hidden, true, 'picking closes the menu');
  assert.equal($('.preset[data-i="1"]').getAttribute('aria-pressed'), 'true');
  click($('#btn-presets'));
  click($('#ide'));
  assert.equal(menu.hidden, true, 'clicking elsewhere closes the menu');
});

test('editor font settings show in the preview', () => {
  const ide = $('#ide');
  const set = (id, v) => { $(id).value = v; $(id).dispatchEvent(new dom.window.Event('input', { bubbles: true })); };
  assert.equal(ide.style.getPropertyValue('--o-font-size'), '');
  set('#opt-font', 'Fira Code');
  set('#opt-fontsize', '16');
  set('#opt-linespacing', '1.5');
  assert.match(ide.style.getPropertyValue('--o-font'), /^"Fira Code"/);
  assert.equal(ide.style.getPropertyValue('--o-font-size'), '16px');
  assert.equal(ide.style.getPropertyValue('--o-line'), '24px');
  $('#opt-ligatures').checked = true;
  $('#opt-ligatures').dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.equal(ide.style.getPropertyValue('--o-liga'), 'normal');

  set('#opt-font', ''); set('#opt-fontsize', ''); set('#opt-linespacing', '');
  $('#opt-ligatures').checked = false;
  $('#opt-ligatures').dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.equal(ide.style.getPropertyValue('--o-font-size'), '', 'blank fields fall back to the defaults');
  assert.equal(ide.style.getPropertyValue('--o-line'), '');
});

test('the download button asks what to download: every variant, or a chosen set', () => {
  const ev = (el, type) => el.dispatchEvent(new dom.window.Event(type, { bubbles: true }));
  const themes = () => [...all('.frow')].filter(r => r.textContent.includes('.theme.json')).length;
  const box = id => $(`#dl-set input[value="${id}"]`);
  const mode = v => { const r = $(`#dlmenu input[name="dlmode"][value="${v}"]`); r.checked = true; ev(r, 'change'); };
  click($('.view[data-view="files"]'));
  const everything = themes();
  assert.ok(everything >= 13, 'all variants by default');

  assert.equal($('#dlmenu').hidden, true);
  click($('#btn-zip'));
  assert.equal($('#dlmenu').hidden, false, 'the button opens the choice instead of downloading blind');
  assert.equal($('#btn-zip').getAttribute('aria-expanded'), 'true');
  assert.deepEqual(clicked, [], 'nothing is saved yet');
  assert.equal($('#dl-set').hidden, true);

  mode('custom');
  assert.equal($('#dl-set').hidden, false);
  assert.equal(all('#dl-set input').length, everything, 'one box per variant');
  assert.equal(themes(), 2, 'a custom set starts as dark + light');
  assert.match($('#dl-go').textContent, /2 variants/);

  box('neon').checked = true; ev(box('neon'), 'change');
  assert.equal(themes(), 3);
  assert.ok([...all('.frow')].some(r => /neon\.theme\.json/.test(r.textContent)));

  // an empty set would be an empty plugin, so there is nothing to download
  for (const b of all('#dl-set input')) { b.checked = false; ev(b, 'change'); }
  assert.equal($('#dl-go').disabled, true);
  box('dark').checked = true; ev(box('dark'), 'change');
  assert.equal($('#dl-go').disabled, false);

  mode('all');
  assert.equal(themes(), everything);
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal($('#dlmenu').hidden, true, 'Escape closes it');
  click($('.view[data-view="preview"]'));
});

test('the palette can be two to five colours', () => {
  const pick = n => { $('#seedcount').value = String(n); $('#seedcount').dispatchEvent(new dom.window.Event('change', { bubbles: true })); };
  const shown = () => [...all('.seed')].filter(s => !s.hidden).length;
  const keyword = () => $('#ide').style.getPropertyValue('--t-synString');
  assert.equal($('#seedcount').value, '5');
  assert.equal(shown(), 5);
  const five = keyword();

  pick(2);
  assert.equal(shown(), 2, 'only anchor and ink are asked for');
  assert.notEqual(keyword(), five, 'the theme is re-derived from two colours');
  click($('.view[data-view="files"]'));
  assert.ok(all('.frow').length >= 15, 'and it still packages');
  click($('.view[data-view="preview"]'));

  pick(3); assert.equal(shown(), 3);
  pick(4); assert.equal(shown(), 4);

  // a preset is five colours, so picking one brings all five back
  click($('#btn-presets')); click(all('.preset')[1]);
  assert.equal($('#seedcount').value, '5');
  assert.equal(shown(), 5);
});

test('shuffling a two-colour palette gives a coloured ink, not grey on dark', async () => {
  const { toOklch } = await import('../src/lib/color.js');
  $('#seedcount').value = '2';
  $('#seedcount').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  for (let i = 0; i < 40; i++) {
    click($('#btn-random'));
    const ink = $('#hex1').value;
    // 0.06, not more: a dark ink for a light page has little chroma to give in yellow and brown
    assert.ok(toOklch(ink).c >= 0.06, `shuffle ${i}: ink ${ink} is grey, so the whole duotone is`);
  }
  // with accents to carry the colour, the ink stays the quiet near-neutral it was
  $('#seedcount').value = '5';
  $('#seedcount').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  click($('#btn-random'));
  assert.ok(toOklch($('#hex1').value).c < 0.04);
  click($('#btn-presets')); click(all('.preset')[0]);
});

test('shuffles can be stepped back and forth through', () => {
  const pal = () => [0, 1, 2, 3, 4].map(i => $('#hex' + i).value).join();
  const prev = $('#btn-shuffle-prev'), next = $('#btn-shuffle-next');
  const start = pal();

  click($('#btn-random')); const a = pal();
  click($('#btn-random')); const b = pal();
  click($('#btn-random')); const c = pal();
  assert.equal(next.disabled, true, 'the newest shuffle is the end of the line');

  click(prev); assert.equal(pal(), b);
  click(prev); assert.equal(pal(), a);
  click(prev); assert.equal(pal(), start, 'what was on screen before shuffling is kept too');
  assert.equal(next.disabled, false);
  click(next); click(next); click(next);
  assert.equal(pal(), c);

  // shuffling from the middle loses nothing: the new one goes on the end, and you with it
  click(prev); click($('#btn-random')); const d = pal();
  assert.equal(next.disabled, true);
  click(prev); assert.equal(pal(), c, 'what lay ahead is still there');
  click(prev); assert.equal(pal(), b);
  click(next); click(next); assert.equal(pal(), d);

  // the colour count travels with the entry
  $('#seedcount').value = '2';
  $('#seedcount').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  click($('#btn-random'));
  click(prev); assert.equal($('#seedcount').value, '2', 'the two-colour view you shuffled from');
  click(prev); assert.equal($('#seedcount').value, '5');
  click(next); click(next); assert.equal($('#seedcount').value, '2');
  click($('#btn-presets')); click(all('.preset')[0]);
});

test('an ordinary browser downloads without any capability', () => {
  // jsdom has no window.claude, i.e. it is any normal browser: GitHub Pages,
  // file://, npm run dev. The Blob + <a download> path must fire, and the
  // buttons must keep their own labels.
  assert.match($('#btn-zip').textContent, /^Download plugin/);
  assert.ok($('#btn-src'), 'the sources button must not be removed');

  click($('#btn-zip'));
  click($('#dl-go'));
  return new Promise(r => setTimeout(r, 50)).then(() => {
    // Derive the expected name from current state — an earlier test changes
    // the theme name, and this assertion must not depend on test order.
    const slug = $('#famname').value.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    assert.deepEqual(clicked, [`${slug}.zip`], 'expected a download to fire');
    assert.equal($('#dlmenu').hidden, true, 'and the choice closes once it is made');
  });
});

test('no runtime errors along the way', () => {
  assert.deepEqual(errors, []);
});
