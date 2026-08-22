import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fromBookmarkletUrl, toBookmarkletUrl } from '../scripts/bookmarklet-url.mjs';

test('bookmarklet source compiles after term data is embedded', async () => {
  const [source, termData] = await Promise.all([
    readFile(new URL('../src/bookmarklet-source.js', import.meta.url), 'utf8'),
    readFile(new URL('../data/terms.json', import.meta.url), 'utf8')
  ]);
  const hydrated = source.replace('__PATHCAL_TERM_DATA__', JSON.stringify(JSON.parse(termData)));
  assert.doesNotThrow(() => new Function(hydrated));
});

test('bookmarklet URL preserves syntax and Unicode through browser-safe encoding', () => {
  const source = '(()=>{const message="Penn – ×";return message})()';
  const bookmarklet = toBookmarkletUrl(source);
  const decoded = fromBookmarkletUrl(bookmarklet);

  assert.match(bookmarklet, /^javascript:/);
  assert.equal(decoded, source);
  assert.doesNotThrow(() => new Function(decoded));
});
