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

test('term detection checks the visible Primary Cart info bar', async () => {
  const source = await readFile(new URL('../src/bookmarklet-source.js', import.meta.url), 'utf8');
  assert.match(source, /panel__info-bar/);
  assert.match(source, /primaryCartText/);
});

test('telemetry always sends parser health but keeps labels out of the identified event', async () => {
  const source = await readFile(new URL('../src/bookmarklet-source.js', import.meta.url), 'utf8');
  const telemetry = source.slice(source.indexOf('function buildTelemetryProperties'), source.indexOf('function posthogCapture'));
  assert.match(telemetry, /course_count/);
  assert.match(telemetry, /meeting_pattern_count/);
  assert.match(telemetry, /parse_status/);
  assert.match(telemetry, /parsed_label_count/);
  const usageProperties = telemetry.slice(telemetry.indexOf('const usageProperties'), telemetry.indexOf('const diagnosticLabels'));
  assert.doesNotMatch(usageProperties, /diagnostic_labels/);
});

test('diagnostic labels are redacted, anonymous, optional, and selected by default', async () => {
  const source = await readFile(new URL('../src/bookmarklet-source.js', import.meta.url), 'utf8');
  const helpers = source.slice(source.indexOf('function redactDiagnosticLabel'), source.indexOf('function posthogCapture'));
  const buildTelemetryProperties = new Function(
    'TELEMETRY_SCHEMA_VERSION',
    'DIAGNOSTIC_LABEL_LIMIT',
    `${helpers}; return buildTelemetryProperties;`
  )(2, 50);
  const label = 'CIS 1200 section 001 - Monday from 10:15am to 11:14am. You are registered for this section';
  const input = {
    name: 'Student', email: 'student@upenn.edu', detectedTerm: 'Fall 2026', termLabel: 'Fall 2026',
    courseCount: 1, meetingCount: 1, calendarLabels: [label], registeredLabelCount: 1,
    parsedLabelCount: 1, pathVersion: '700.79.116', shareDiagnostics: true
  };
  const shared = buildTelemetryProperties(input);
  assert.equal(shared.usageProperties.$set.email, 'student@upenn.edu');
  assert.doesNotMatch(JSON.stringify(shared.usageProperties), /CIS 1200|10:15am/);
  assert.deepEqual(shared.diagnosticProperties.diagnostic_labels, [
    '<course> - Monday from 00:00am to 00:00am. You are registered for this section'
  ]);
  assert.equal(shared.diagnosticProperties.$process_person_profile, false);
  assert.equal(buildTelemetryProperties({ ...input, shareDiagnostics: false }).diagnosticProperties, null);
  assert.match(source, /id="pc-share-diagnostics" type="checkbox" checked/);
});
