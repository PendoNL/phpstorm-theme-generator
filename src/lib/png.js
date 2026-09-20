// Part of phpstorm-theme-generator — see LICENSE.
/**
 * A tiny PNG encoder — no dependencies, works in Node and the browser.
 *
 * Deflate blocks are written STORED (uncompressed), the same trick the ZIP
 * writer uses: a real compressor is a lot of code for an image that is a
 * smooth gradient nobody will zoom into. The image is generated small and
 * relies on `fill: "scale"` to stretch, which a gradient survives happily,
 * so "uncompressed" costs ~150 KB rather than megabytes.
 */
import { toOklch, fromOklch, mix } from './color.js';
import { crc32 } from './zip.js';

const adler32 = b => {
  let a = 1, s = 0;
  for (let i = 0; i < b.length; i++) { a = (a + b[i]) % 65521; s = (s + a) % 65521; }
  return ((s << 16) | a) >>> 0;
};

const be32 = v => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];

function chunk(type, data) {
  const name = [...type].map(c => c.charCodeAt(0));
  const body = new Uint8Array([...name, ...data]);
  return new Uint8Array([...be32(data.length), ...body, ...be32(crc32(body))]);
}

/** Wrap raw bytes in a zlib stream made of stored deflate blocks. */
function zlibStored(raw) {
  const out = [0x78, 0x01];
  const MAX = 65535;
  for (let i = 0; i < raw.length; i += MAX) {
    const part = raw.subarray(i, Math.min(i + MAX, raw.length));
    const last = i + MAX >= raw.length ? 1 : 0;
    out.push(last, part.length & 0xff, (part.length >> 8) & 0xff,
             ~part.length & 0xff, (~part.length >> 8) & 0xff, ...part);
  }
  out.push(...be32(adler32(raw)));
  return new Uint8Array(out);
}

/**
 * @param {number} width
 * @param {number} height
 * @param {(x:number,y:number)=>[number,number,number]} pixel  0-255 RGB
 */
export function encodePng(width, height, pixel) {
  const raw = new Uint8Array(height * (1 + width * 3));
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0;                                   // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      raw[p++] = r; raw[p++] = g; raw[p++] = b;
    }
  }
  const ihdr = new Uint8Array([...be32(width), ...be32(height), 8, 2, 0, 0, 0]);
  return new Uint8Array([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    ...chunk('IHDR', ihdr),
    ...chunk('IDAT', zlibStored(raw)),
    ...chunk('IEND', [])
  ]);
}

const hexToRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/**
 * A wallpaper derived from the theme's own tokens: a soft diagonal wash from
 * the editor background to a faintly accent-tinted corner. Deliberately very
 * low contrast — it sits behind code at ~12% opacity.
 */
export function wallpaperPng(T, { width = 240, height = 150 } = {}) {
  const base = T.bgEditor;
  const o = toOklch(T.accentPrimary);
  const glow = mix(base, fromOklch(toOklch(base).l + 0.10, 0.05, o.h), 1);
  const a = hexToRgb(base), b = hexToRgb(glow);

  return encodePng(width, height, (x, y) => {
    const nx = x / (width - 1), ny = y / (height - 1);
    // two offset radial falloffs, so it reads as light rather than a ramp
    const d1 = Math.hypot(nx - 0.15, ny - 0.1);
    const d2 = Math.hypot(nx - 0.9, ny - 0.95);
    const t = Math.max(0, 1 - d1 * 1.25) * 0.75 + Math.max(0, 1 - d2 * 1.4) * 0.35;
    const k = Math.min(1, t);
    return [
      Math.round(a[0] + (b[0] - a[0]) * k),
      Math.round(a[1] + (b[1] - a[1]) * k),
      Math.round(a[2] + (b[2] - a[2]) * k)
    ];
  });
}
