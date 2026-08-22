import { readFile, writeFile } from 'node:fs/promises';
import { load } from 'cheerio';

const dataUrl = new URL('../data/terms.json', import.meta.url);
const sourceUrl = 'https://almanac.upenn.edu/penn-academic-calendar';
const monthIndex = new Map([
  ['January', 1], ['February', 2], ['March', 3], ['April', 4],
  ['May', 5], ['June', 6], ['July', 7], ['August', 8],
  ['September', 9], ['October', 10], ['November', 11], ['December', 12]
]);

function iso(year, monthName, day) {
  const month = monthIndex.get(monthName);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDateRange(value, defaultYear) {
  const clean = value.replace(/\([^)]*\)/g, '').trim();
  const full = clean.match(/^([A-Z][a-z]+)\s+(\d{1,2})\s*(?:-|–)\s*(?:([A-Z][a-z]+)\s+)?(\d{1,2})$/);
  if (full) {
    return {
      start: iso(defaultYear, full[1], Number(full[2])),
      end: iso(defaultYear, full[3] || full[1], Number(full[4]))
    };
  }
  const single = clean.match(/^([A-Z][a-z]+)\s+(\d{1,2})$/);
  if (!single) return null;
  const date = iso(defaultYear, single[1], Number(single[2]));
  return { start: date, end: date };
}

function expandWeekdays(startIso, endIso) {
  const dates = [];
  const cursor = new Date(`${startIso}T12:00:00Z`);
  const end = new Date(`${endIso}T12:00:00Z`);
  while (cursor <= end) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function parseTermRows(title, rows) {
  const match = title.match(/^(\d{4})\s+(Fall|Spring)\s+Term$/i);
  if (!match) return null;
  const year = Number(match[1]);
  const season = match[2][0].toUpperCase() + match[2].slice(1).toLowerCase();
  const label = `${season} ${year}`;
  const events = new Map(rows.map(({ name, date }) => [name, date]));
  const startRaw = events.get('First day of classes') || events.get('First day of classes (Monday classes)');
  const endRaw = events.get('Last day of classes');
  const startRange = startRaw && parseDateRange(startRaw, year);
  const endRange = endRaw && parseDateRange(endRaw, year);
  if (!startRange || !endRange) return null;

  const excludedDates = [];
  const scheduleOverrides = [];
  for (const { name, date } of rows) {
    if (/\(no classes\)|Term Break|Thanksgiving Break/i.test(name)) {
      const range = parseDateRange(date, year);
      if (range) excludedDates.push(...expandWeekdays(range.start, range.end));
    }
    const swap = name.match(/^Thur-Fri class schedule on Tue-Wed$/i);
    if (swap) {
      const range = parseDateRange(date, year);
      if (range) {
        const targetDates = expandWeekdays(range.start, range.end);
        if (targetDates[0]) scheduleOverrides.push({ date: targetDates[0], usesDay: 'TH' });
        if (targetDates[1]) scheduleOverrides.push({ date: targetDates[1], usesDay: 'FR' });
      }
    }
  }

  return {
    label,
    start: startRange.start,
    end: endRange.end,
    excludedDates: [...new Set(excludedDates)].filter((date) => date >= startRange.start && date <= endRange.end).sort(),
    scheduleOverrides
  };
}

async function update() {
  const fallback = JSON.parse(await readFile(dataUrl, 'utf8'));
  try {
    const response = await fetch(sourceUrl, { headers: { 'user-agent': 'pathcal-calendar-builder/1.0' } });
    if (!response.ok) throw new Error(`Penn calendar returned ${response.status}`);
    const $ = load(await response.text());
    const parsedTerms = {};
    let activeTitle = null;
    let rows = [];

    function flush() {
      if (!activeTitle) return;
      const term = parseTermRows(activeTitle, rows);
      if (term) parsedTerms[term.label] = term;
    }

    $('table tr').each((_, row) => {
      const heading = $(row).find('th').text().replace(/\s+/g, ' ').trim();
      if (/^\d{4}\s+(Fall|Spring)\s+Term$/i.test(heading)) {
        flush();
        activeTitle = heading;
        rows = [];
        return;
      }
      if (!activeTitle) return;
      const cells = $(row).find('td').map((__, cell) => $(cell).text().replace(/\s+/g, ' ').trim()).get();
      if (cells.length >= 2) rows.push({ name: cells[0], date: cells[1] });
    });
    flush();

    if (Object.keys(parsedTerms).length === 0) throw new Error('No fall or spring terms found');
    const next = {
      source: sourceUrl,
      updatedAt: new Date().toISOString(),
      terms: { ...fallback.terms, ...parsedTerms }
    };
    await writeFile(dataUrl, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`Updated ${Object.keys(parsedTerms).length} terms from Penn Almanac.`);
  } catch (error) {
    console.warn(`Using checked-in term data: ${error.message}`);
  }
}

await update();
