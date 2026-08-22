import { readFile, writeFile } from 'node:fs/promises';
import { minify } from 'terser';
import { toBookmarkletUrl } from './bookmarklet-url.mjs';

const sourceUrl = new URL('../src/bookmarklet-source.js', import.meta.url);
const termsUrl = new URL('../data/terms.json', import.meta.url);
const outputUrl = new URL('../src/generated-bookmarklet.js', import.meta.url);

const [source, termData] = await Promise.all([
  readFile(sourceUrl, 'utf8'),
  readFile(termsUrl, 'utf8')
]);

const hydrated = source.replace('__PATHCAL_TERM_DATA__', JSON.stringify(JSON.parse(termData)));
const result = await minify(hydrated, {
  compress: true,
  mangle: true,
  format: { comments: false }
});

if (!result.code) throw new Error('Bookmarklet build produced no code');
// Dragging or copying a raw JavaScript URL can alter backslashes, quotes, and
// Unicode characters. Percent-encode the payload so browsers receive it intact.
const bookmarklet = toBookmarkletUrl(result.code);
await writeFile(outputUrl, `export default ${JSON.stringify(bookmarklet)};\n`);
console.log(`Built bookmarklet (${bookmarklet.length.toLocaleString()} characters).`);
