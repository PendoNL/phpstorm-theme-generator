import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { encodePng, wallpaperPng } from '../src/lib/png.js';
import { deriveTokens } from '../src/lib/derive.js';

const be32 = (b, o) => (b[o] << 24 | b[o + 1] << 16 | b[o + 2] << 8 | b[o + 3]) >>> 0;

/** Walk the chunk list, returning {type: data}. */
function chunks(png) {
  assert.deepEqual([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'PNG signature');
  const out = {};
  let p = 8;
  while (p < png.length) {
    const len = be32(png, p);
    const type = String.fromCharCode(...png.slice(p + 4, p + 8));
    out[type] = png.slice(p + 8, p + 8 + len);
    p += 12 + len;
  }
  return out;
}

test('produces a structurally valid PNG', () => {
  const png = encodePng(4, 3, (x, y) => [x * 10, y * 20, 30]);
  const c = chunks(png);
  assert.ok(c.IHDR && c.IDAT && c.IEND !== undefined);
  assert.equal(be32(c.IHDR, 0), 4, 'width');
  assert.equal(be32(c.IHDR, 4), 3, 'height');
  assert.equal(c.IHDR[8], 8, 'bit depth');
  assert.equal(c.IHDR[9], 2, 'colour type: truecolour');
});

test('the zlib stream really inflates, and the pixels round-trip', () => {
  // Blocks are written stored rather than compressed; this proves the framing
  // (block headers, LEN/NLEN, adler32) is right, which is the part that bites.
  const w = 5, h = 4;
  const px = (x, y) => [x * 7, y * 11, (x + y) * 3];
  const raw = inflateSync(Buffer.from(chunks(encodePng(w, h, px)).IDAT));
  assert.equal(raw.length, h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    assert.equal(raw[y * (1 + w * 3)], 0, 'filter byte');
    for (let x = 0; x < w; x++) {
      const at = y * (1 + w * 3) + 1 + x * 3;
      assert.deepEqual([raw[at], raw[at + 1], raw[at + 2]], px(x, y), `pixel ${x},${y}`);
    }
  }
});

test('spans more than one stored block', () => {
  // Stored deflate blocks cap at 65535 bytes; a wallpaper is comfortably over.
  const png = encodePng(200, 200, () => [1, 2, 3]);
  const raw = inflateSync(Buffer.from(chunks(png).IDAT));
  assert.ok(raw.length > 65535 * 1.5, 'expected a multi-block stream');
  assert.equal(raw.length, 200 * (1 + 200 * 3));
});

test('the wallpaper is derived from the theme and stays subtle', () => {
  const { T } = deriveTokens(['#1B1D23', '#D4D7DE', '#4C8DF6', '#E5A33C', '#5CC98A'], 'dark');
  const png = wallpaperPng(T, { width: 32, height: 20 });
  const raw = inflateSync(Buffer.from(chunks(png).IDAT));

  const lum = [];
  for (let y = 0; y < 20; y++)
    for (let x = 0; x < 32; x++) {
      const at = y * (1 + 32 * 3) + 1 + x * 3;
      lum.push(0.2126 * raw[at] + 0.7152 * raw[at + 1] + 0.0722 * raw[at + 2]);
    }
  const min = Math.min(...lum), max = Math.max(...lum);
  assert.ok(max > min, 'it should actually be a gradient');
  assert.ok(max - min < 60, `wallpaper too contrasty (${(max - min).toFixed(0)}) — it sits behind code`);
});
