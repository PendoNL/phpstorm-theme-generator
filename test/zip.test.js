import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipBytes } from '../src/lib/zip.js';
import { buildPlugin } from '../src/lib/package.js';
import { VARIANTS } from '../src/lib/derive.js';

const u32 = (b, o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24);

/** Minimal reader: walk the central directory and return {name: bytes}. */
function readZip(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && u32(buf, eocd) !== 0x06054b50) eocd--;
  assert.ok(eocd >= 0, 'no end-of-central-directory record');
  const count = buf[eocd + 10] | (buf[eocd + 11] << 8);
  let off = u32(buf, eocd + 16);
  const out = {};
  for (let i = 0; i < count; i++) {
    assert.equal(u32(buf, off), 0x02014b50, 'bad central directory signature');
    const size = u32(buf, off + 24);
    const nameLen = buf[off + 28] | (buf[off + 29] << 8);
    const extraLen = buf[off + 30] | (buf[off + 31] << 8);
    const cmtLen = buf[off + 32] | (buf[off + 33] << 8);
    const local = u32(buf, off + 42);
    const name = new TextDecoder().decode(buf.slice(off + 46, off + 46 + nameLen));
    const lNameLen = buf[local + 26] | (buf[local + 27] << 8);
    const lExtraLen = buf[local + 28] | (buf[local + 29] << 8);
    const dataAt = local + 30 + lNameLen + lExtraLen;
    out[name] = buf.slice(dataAt, dataAt + size);
    off += 46 + nameLen + extraLen + cmtLen;
  }
  return out;
}

test('round-trips text entries', () => {
  const z = zipBytes([
    { path: 'a.txt', body: 'hello' },
    { path: 'dir/' },
    { path: 'dir/b.json', body: '{"k":1}' }
  ]);
  const got = readZip(z);
  assert.deepEqual(Object.keys(got), ['a.txt', 'dir/', 'dir/b.json']);
  assert.equal(new TextDecoder().decode(got['a.txt']), 'hello');
  assert.equal(new TextDecoder().decode(got['dir/b.json']), '{"k":1}');
  assert.equal(got['dir/'].length, 0);
});

test('round-trips UTF-8 beyond ASCII', () => {
  const body = 'café — 中文 — ✓';
  const got = readZip(zipBytes([{ path: 'u.txt', body }]));
  assert.equal(new TextDecoder().decode(got['u.txt']), body);
});

test('nests a jar inside a zip byte-for-byte', () => {
  const jar = zipBytes([{ path: 'META-INF/plugin.xml', body: '<idea-plugin/>' }]);
  const dist = zipBytes([{ path: 'p/lib/p.jar', body: jar }]);
  const inner = readZip(readZip(dist)['p/lib/p.jar']);
  assert.equal(new TextDecoder().decode(inner['META-INF/plugin.xml']), '<idea-plugin/>');
});

test('the distribution has the layout Install-from-Disk requires', () => {
  const p = buildPlugin({ palette: ['#1B1D23', '#D4D7DE', '#4C8DF6', '#E5A33C', '#5CC98A'],
                          family: 'Acme', id: 'com.acme.theme' });
  const outer = readZip(p.distZip);
  assert.deepEqual(Object.keys(outer), ['acme/', 'acme/lib/', 'acme/lib/acme.jar']);
  const jar = readZip(outer['acme/lib/acme.jar']);
  assert.ok('META-INF/plugin.xml' in jar, 'descriptor must live inside the jar');
  assert.equal(Object.keys(jar).filter(k => k.endsWith('.theme.json')).length, VARIANTS.length);
});

test('CRC32 matches the standard check vector', () => {
  // Stored entries carry a real CRC; java.util.zip will reject a wrong one.
  const z = zipBytes([{ path: 'c', body: '123456789' }]);
  let off = 0;
  assert.equal(u32(z, off), 0x04034b50);
  assert.equal(u32(z, off + 14) >>> 0, 0xCBF43926);
});
