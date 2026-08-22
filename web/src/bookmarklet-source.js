(() => {
  const TERM_DATA = __PATHCAL_TERM_DATA__;
  const ROOT_ID = 'pathcal-exporter-root';
  const POSTHOG_KEY = 'phc_uo5R9K8TzXAeF3WmOUqsKJ2cxdR8N0x14BylN5xeLOl';
  const POSTHOG_ENDPOINT = 'https://us.i.posthog.com/i/v0/e/';
  const PATH_TERM_SELECTOR = 'body > main > div.panel.panel--kind-results.panel--visible.cart.cart--primary > div > div.panel__info-bar > div';
  const DAY_CODES = {
    Sunday: 'SU', Monday: 'MO', Tuesday: 'TU', Wednesday: 'WE',
    Thursday: 'TH', Friday: 'FR', Saturday: 'SA'
  };
  const DAY_INDEX = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

  document.getElementById(ROOT_ID)?.remove();

  function escapeIcs(value) {
    return String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  }

  function compactDate(isoDate) {
    return isoDate.replaceAll('-', '');
  }

  function toMinutes(raw) {
    const match = raw.toLowerCase().replaceAll('.', '').match(/(\d{1,2}):(\d{2})\s*([ap]m)/);
    if (!match) return null;
    let hour = Number(match[1]) % 12;
    if (match[3] === 'pm') hour += 12;
    return hour * 60 + Number(match[2]);
  }

  function compactTime(minutes) {
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}${String(minutes % 60).padStart(2, '0')}00`;
  }

  function detectTerm() {
    const primaryCartText = document.querySelector(PATH_TERM_SELECTOR)?.textContent || '';
    const selectedText = Array.from(document.querySelectorAll('select option:checked, [aria-selected="true"]'))
      .map((node) => node.textContent || '')
      .join(' ');
    const pageText = `${primaryCartText} ${selectedText} ${document.body.innerText.slice(0, 50000)}`;
    const candidates = Object.keys(TERM_DATA.terms);
    return candidates.find((label) => pageText.toLowerCase().includes(label.toLowerCase())) ||
      candidates.find((label) => {
        const [season, year] = label.split(' ');
        return pageText.match(new RegExp(`${year}\\s+${season}|${season}\\s+${year}`, 'i'));
      }) || null;
  }

  function parseMeetingLabel(label) {
    const clean = String(label || '').replace(/\s+/g, ' ').trim();
    if (!/Registered/i.test(clean)) return null;
    const summary = clean.split(' - ')[0].replace(/\s*Registered\s*/gi, '').trim();
    const dayMatches = [...clean.matchAll(/\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/gi)];
    const timeMatches = [...clean.matchAll(/(\d{1,2}:\d{2}\s*[ap]\.?(?:m)\.?)\s*(?:-|–|—|to)\s*(\d{1,2}:\d{2}\s*[ap]\.?(?:m)\.?)/gi)];
    if (!summary || dayMatches.length === 0 || timeMatches.length === 0) return null;

    const ranges = timeMatches.map((match) => ({
      start: toMinutes(match[1]),
      end: toMinutes(match[2]),
      index: match.index
    })).filter((range) => range.start !== null && range.end !== null);
    if (!ranges.length) return null;

    if (ranges.length === 1) {
      return [{ summary, days: [...new Set(dayMatches.map((match) => DAY_CODES[match[1][0].toUpperCase() + match[1].slice(1).toLowerCase()]))], start: ranges[0].start, end: ranges[0].end, raw: clean }];
    }

    return ranges.map((range, index) => {
      const nextIndex = ranges[index + 1]?.index ?? clean.length;
      const previousIndex = ranges[index - 1]?.index ?? 0;
      let nearby = dayMatches.filter((match) => match.index >= previousIndex && match.index < nextIndex);
      if (!nearby.length) nearby = dayMatches.filter((match) => match.index < range.index).slice(-1);
      return {
        summary,
        days: [...new Set(nearby.map((match) => DAY_CODES[match[1][0].toUpperCase() + match[1].slice(1).toLowerCase()]))],
        start: range.start,
        end: range.end,
        raw: clean
      };
    }).filter((meeting) => meeting.days.length);
  }

  function collectMeetings() {
    const labels = Array.from(document.querySelectorAll('[aria-label]'))
      .map((node) => node.getAttribute('aria-label'))
      .filter((label) => label && /Registered/i.test(label));
    const uniqueLabels = [...new Set(labels)];
    return uniqueLabels.flatMap((label) => parseMeetingLabel(label) || []);
  }

  function dateForFirstDay(termStart, dayCode) {
    const date = new Date(`${termStart}T12:00:00Z`);
    const delta = (DAY_INDEX[dayCode] - date.getUTCDay() + 7) % 7;
    date.setUTCDate(date.getUTCDate() + delta);
    return date.toISOString().slice(0, 10);
  }

  function stableHash(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function foldLine(line) {
    const chunks = [];
    let rest = line;
    while (rest.length > 73) {
      chunks.push(rest.slice(0, 73));
      rest = ` ${rest.slice(73)}`;
    }
    chunks.push(rest);
    return chunks.join('\r\n');
  }

  function buildIcs(meetings, term) {
    const stamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Pathcal//Penn Schedule Export//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Penn Classes',
      'X-WR-TIMEZONE:America/New_York'
    ];

    for (const meeting of meetings) {
      const firstDay = dateForFirstDay(term.start, meeting.days[0]);
      const startTime = compactTime(meeting.start);
      const endTime = compactTime(meeting.end);
      const uidSeed = `${term.label}|${meeting.summary}|${meeting.days.join(',')}|${startTime}|${endTime}`;
      const normalOverrideDates = term.scheduleOverrides.map((item) => item.date);
      const excluded = [...new Set([
        ...term.excludedDates,
        ...normalOverrideDates.filter((date) => meeting.days.includes(['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][new Date(`${date}T12:00:00Z`).getUTCDay()]))
      ])].sort();
      const rdates = term.scheduleOverrides
        .filter((override) => meeting.days.includes(override.usesDay))
        .map((override) => `${compactDate(override.date)}T${startTime}`);

      lines.push(
        'BEGIN:VEVENT',
        `UID:${stableHash(uidSeed)}@pathcal.intelchen.com`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=America/New_York:${compactDate(firstDay)}T${startTime}`,
        `DTEND;TZID=America/New_York:${compactDate(firstDay)}T${endTime}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${meeting.days.join(',')};UNTIL=${compactDate(term.end)}T235959Z`,
        ...(excluded.length ? [`EXDATE;TZID=America/New_York:${excluded.map((date) => `${compactDate(date)}T${startTime}`).join(',')}`] : []),
        ...(rdates.length ? [`RDATE;TZID=America/New_York:${rdates.join(',')}`] : []),
        `SUMMARY:${escapeIcs(meeting.summary)}`,
        'END:VEVENT'
      );
    }
    lines.push('END:VCALENDAR');
    return `${lines.map(foldLine).join('\r\n')}\r\n`;
  }

  function downloadCalendar(ics, termLabel) {
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `penn-classes-${termLabel.toLowerCase().replace(/\s+/g, '-')}.ics`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function telemetryId() {
    const storageKey = 'pathcal_telemetry_id';
    try {
      const existing = localStorage.getItem(storageKey);
      if (existing) return existing;
      const created = crypto.randomUUID();
      localStorage.setItem(storageKey, created);
      return created;
    } catch {
      return crypto.randomUUID();
    }
  }

  function captureTelemetry({ name, email, termLabel, courseCount, meetingCount }) {
    const person = {};
    if (name) person.name = name;
    if (email) person.email = email;
    const properties = {
      source: 'pathcal_bookmarklet',
      term: termLabel,
      course_count: courseCount,
      meeting_pattern_count: meetingCount,
      ...(Object.keys(person).length ? { $set: person } : { $process_person_profile: false })
    };
    return fetch(POSTHOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        distinct_id: telemetryId(),
        event: 'calendar downloaded',
        properties
      }),
      keepalive: true
    }).catch(() => {});
  }

  function showModal() {
    const detectedLabel = detectTerm();
    const meetings = collectMeetings();
    const availableTerms = Object.keys(TERM_DATA.terms).sort().reverse();
    const selectedLabel = detectedLabel || availableTerms[0];
    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML = `
      <style>
        #${ROOT_ID}{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:20px;background:rgba(1,31,91,.28);font-family:Arial,sans-serif;color:#011f5b}
        #${ROOT_ID} *{box-sizing:border-box}
        #${ROOT_ID} .pc-box{width:min(540px,100%);max-height:calc(100vh - 32px);overflow:auto;padding:26px;border:1px solid rgba(1,31,91,.16);border-radius:18px;background:#fff;box-shadow:0 24px 80px rgba(1,31,91,.22)}
        #${ROOT_ID} .pc-top{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}
        #${ROOT_ID} h2{margin:0 0 6px;font:400 30px/1.05 Georgia,serif;color:#011f5b}
        #${ROOT_ID} p{margin:0;color:#52617b;font-size:13px;line-height:1.45}
        #${ROOT_ID} .pc-close{border:0;background:transparent;color:#52617b;font-size:22px;cursor:pointer}
        #${ROOT_ID} .pc-contact{margin:20px 0 14px;padding:16px;border:1px solid #b8cbe3;border-radius:12px;background:#eef4fb}
        #${ROOT_ID} .pc-contact-title{display:flex;justify-content:space-between;gap:12px;align-items:baseline;margin-bottom:12px}
        #${ROOT_ID} .pc-contact-title strong{font-size:14px;color:#011f5b}
        #${ROOT_ID} .pc-contact-title span{color:#52617b;font-size:10px;text-transform:uppercase;letter-spacing:.06em}
        #${ROOT_ID} .pc-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        #${ROOT_ID} label{display:block;color:#17559b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
        #${ROOT_ID} input,#${ROOT_ID} select{width:100%;margin-top:6px;padding:10px;border:1px solid #9eb3d1;border-radius:8px;background:#fff;color:#011f5b;font:600 13px Arial,sans-serif}
        #${ROOT_ID} input::placeholder{color:#8491a7;font-weight:400}
        #${ROOT_ID} input:focus,#${ROOT_ID} select:focus{outline:2px solid rgba(23,85,155,.2);border-color:#17559b}
        #${ROOT_ID} .pc-privacy{margin-top:10px;font-size:10px;color:#52617b;line-height:1.4}
        #${ROOT_ID} .pc-term{margin:12px 0 14px;border:1px solid rgba(1,31,91,.13);border-radius:10px;background:#fff}
        #${ROOT_ID} .pc-term summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 13px;cursor:pointer;list-style:none}
        #${ROOT_ID} .pc-term summary::-webkit-details-marker{display:none}
        #${ROOT_ID} .pc-term summary div{display:flex;align-items:baseline;gap:8px}
        #${ROOT_ID} .pc-term summary span{color:#52617b;font-size:10px;text-transform:uppercase;letter-spacing:.05em}
        #${ROOT_ID} .pc-term summary strong{font-size:13px;color:#011f5b}
        #${ROOT_ID} .pc-change{color:#17559b;font-size:11px;font-weight:700}
        #${ROOT_ID} .pc-term-edit{padding:0 13px 13px}
        #${ROOT_ID} .pc-source{margin-top:7px;font-size:10px;color:#52617b}
        #${ROOT_ID} .pc-error{margin:12px 0;padding:11px 12px;border-radius:9px;background:#fff1f1;color:#820000;font-size:12px;line-height:1.4}
        #${ROOT_ID} .pc-summary{display:flex;gap:18px;margin:16px 0;color:#52617b;font-size:12px}
        #${ROOT_ID} .pc-summary strong{color:#011f5b}
        #${ROOT_ID} .pc-actions{display:flex;justify-content:flex-end;padding-top:16px;border-top:1px solid rgba(1,31,91,.13)}
        #${ROOT_ID} .pc-download{padding:11px 18px;border:0;border-radius:999px;background:#011f5b;color:#fff;font-weight:700;cursor:pointer}
        #${ROOT_ID} .pc-download:disabled{cursor:not-allowed;opacity:.45}
        #${ROOT_ID} .pc-byline{margin-top:14px;color:#758198;font-size:10px;text-align:center}
        #${ROOT_ID} .pc-byline a{color:#17559b;text-decoration:none}
        @media(max-width:520px){#${ROOT_ID} .pc-fields{grid-template-columns:1fr}#${ROOT_ID} .pc-contact-title{display:block}#${ROOT_ID} .pc-contact-title span{display:block;margin-top:4px}}
      </style>
      <div class="pc-box" role="dialog" aria-modal="true" aria-labelledby="pc-title">
        <div class="pc-top"><div><h2 id="pc-title">Your calendar is ready.</h2><p>Optionally introduce yourself, then download your class schedule.</p></div><button class="pc-close" aria-label="Close">×</button></div>
        ${meetings.length ? '' : '<div class="pc-error">No registered meetings were found. Open the Primary Cart calendar in Path@Penn, then click the bookmark again.</div>'}
        <div class="pc-contact">
          <div class="pc-contact-title"><strong>Help me improve Pathcal</strong><span>Optional</span></div>
          <div class="pc-fields">
            <label for="pc-name">Name<input id="pc-name" autocomplete="name" placeholder="Your name" /></label>
            <label for="pc-email">Email<input id="pc-email" type="email" autocomplete="email" placeholder="you@upenn.edu" /></label>
          </div>
          <div class="pc-privacy">If provided, these details go to PostHog with the detected term and aggregate counts. Course names and meeting times never leave this page.</div>
        </div>
        <details class="pc-term">
          <summary><div><span>Detected term</span><strong class="pc-term-name">${selectedLabel}</strong></div><span class="pc-change">Change</span></summary>
          <div class="pc-term-edit">
            <label for="pc-term-select">Semester<select id="pc-term-select">${availableTerms.map((label) => `<option ${label === selectedLabel ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
            <div class="pc-source">Dates and breaks from Penn Almanac</div>
          </div>
        </details>
        <div class="pc-summary"><span><strong>${new Set(meetings.map((item) => item.summary)).size}</strong> courses</span><span><strong>${meetings.length}</strong> meeting patterns</span><span><strong>New York</strong> time</span></div>
        <div class="pc-actions"><button class="pc-download" ${meetings.length ? '' : 'disabled'}>Download .ics</button></div>
        <div class="pc-byline">A project by <a href="https://www.instagram.com/intel.build.stuff/" target="_blank" rel="noreferrer">Intel Chen · @intel.build.stuff ↗</a></div>
      </div>`;
    document.body.appendChild(root);
    root.querySelector('.pc-close').addEventListener('click', () => root.remove());
    root.addEventListener('click', (event) => { if (event.target === root) root.remove(); });
    root.querySelector('#pc-term-select').addEventListener('change', (event) => {
      root.querySelector('.pc-term-name').textContent = event.target.value;
    });
    root.querySelector('.pc-download').addEventListener('click', () => {
      const label = root.querySelector('#pc-term-select').value;
      const name = root.querySelector('#pc-name').value.trim();
      const emailInput = root.querySelector('#pc-email');
      const email = emailInput.value.trim();
      if (email && !emailInput.checkValidity()) {
        emailInput.reportValidity();
        return;
      }
      void captureTelemetry({
        name,
        email,
        termLabel: label,
        courseCount: new Set(meetings.map((item) => item.summary)).size,
        meetingCount: meetings.length
      });
      downloadCalendar(buildIcs(meetings, TERM_DATA.terms[label]), label);
      root.remove();
    });
  }

  showModal();
})();
