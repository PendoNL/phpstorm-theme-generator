import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toOklch, fromOklch, mix, cr, ensure, lighten, alpha } from '../src/lib/color.js';

test('hex -> OKLCH -> hex round-trips within 1/255', () => {
  for (const hex of ['#000000', '#FFFFFF', '#1B1D23', '#4C8DF6', '#E5A33C', '#5CC98A', '#7F7F7F']) {
    const o = toOklch(hex);
    const back = fromOklch(o.l, o.c, o.h);
    for (let i = 1; i < 7; i += 2) {
      const a = parseInt(hex.slice(i, i + 2), 16);
      const b = parseInt(back.slice(i, i + 2), 16);
      assert.ok(Math.abs(a - b) <= 1, `${hex} -> ${back}`);
    }
  }
});

test('mix does not take a hue detour through magenta', () => {
  // A warm red blended into a blue-tinted dark background must stay warm.
  // Polar hue interpolation is what produced purple "deleted line" gutters.
  const out = mix('#DA685E', '#1A1D23', 0.6);
  const h = toOklch(out).h;
  const warm = h < 60 || h > 330;
  assert.ok(warm, `expected a warm hue, got ${h.toFixed(1)}deg (${out})`);
});

test('mix endpoints are exact', () => {
  assert.equal(mix('#4C8DF6', '#1A1D23', 0), '#4C8DF6');
  assert.equal(mix('#4C8DF6', '#1A1D23', 1), '#1A1D23');
});

test('contrast ratio matches known WCAG values', () => {
  assert.ok(Math.abs(cr('#FFFFFF', '#000000') - 21) < 0.01);
  assert.ok(Math.abs(cr('#777777', '#FFFFFF') - 4.48) < 0.05);
  assert.equal(cr('#4C8DF6', '#4C8DF6').toFixed(2), '1.00');
});

test('ensure() lifts a colour until it clears the floor', () => {
  const bg = '#1A1D23';
  const dim = '#2A2D33';
  assert.ok(cr(dim, bg) < 4.5);
  const fixed = ensure(dim, bg, 4.5, 1);
  assert.ok(cr(fixed, bg) >= 4.5, `got ${cr(fixed, bg)}`);
});

test('ensure() gives up rather than looping forever', () => {
  // 21:1 against mid-grey is unreachable; must still terminate and return hex.
  const out = ensure('#808080', '#808080', 21, 1);
  assert.match(out, /^#[0-9A-F]{6}$/);
});

test('alpha appends 8-digit hex', () => {
  assert.equal(alpha('#4c8df6', 1), '#4C8DF6FF');
  assert.equal(alpha('#4c8df6', 0), '#4C8DF600');
});

test('lighten clamps at the ends of the lightness range', () => {
  assert.match(lighten('#FFFFFF', 0.5), /^#[0-9A-F]{6}$/);
  assert.match(lighten('#000000', -0.5), /^#[0-9A-F]{6}$/);
});
