import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as lib from '../src/lib/index.js';

/**
 * The bundle flattens every module into one scope, so a missing import in
 * src/ui still works in dist/ and only breaks under `npm run dev`, where the
 * files load as real modules. Shuffle once shipped that way.
 */
for (const file of ['app.js', 'preview.js']) {
  test(`src/ui/${file} imports every lib export it uses`, () => {
    const src = readFileSync(new URL('../src/ui/' + file, import.meta.url), 'utf8');
    const imported = new Set([...src.matchAll(/^import\s*\{([^}]*)\}/gm)]
      .flatMap(m => m[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop())));
    const declared = new Set([...src.matchAll(/^(?:export\s+)?(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm)]
      .map(m => m[1]));
    const missing = Object.keys(lib).filter(name =>
      new RegExp(`(?<![\\w$.'"\`-])${name.replace(/\$/g, '\\$')}\\s*\\(`).test(src)
      && !imported.has(name) && !declared.has(name));
    assert.deepEqual(missing, []);
  });
}
