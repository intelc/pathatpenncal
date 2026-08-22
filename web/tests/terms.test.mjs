import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const terms = JSON.parse(await readFile(new URL('../data/terms.json', import.meta.url), 'utf8'));

test('every term has a valid date range', () => {
  for (const [label, term] of Object.entries(terms.terms)) {
    assert.match(label, /^(Fall|Spring) \d{4}$/);
    assert.match(term.start, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(term.end, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(term.start < term.end);
  }
});

test('excluded dates stay inside their term', () => {
  for (const term of Object.values(terms.terms)) {
    for (const date of term.excludedDates) {
      assert.ok(date >= term.start && date <= term.end, `${date} must be inside ${term.label}`);
    }
  }
});

test('Fall 2026 includes the Penn schedule swap', () => {
  assert.deepEqual(terms.terms['Fall 2026'].scheduleOverrides, [
    { date: '2026-11-24', usesDay: 'TH' },
    { date: '2026-11-25', usesDay: 'FR' }
  ]);
});
