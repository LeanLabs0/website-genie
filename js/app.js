// Website Genie app logic (classic script, no build, no modules).

// image-slot: lightweight stand-in for the design-canvas component.
// Fills its positioned parent; shows the placeholder label until a real image src is set.
// Reacts to a late `src` set via observedAttributes (the original element only read
// src in connectedCallback, so setting it after parse did nothing).
customElements.define('image-slot', class extends HTMLElement {
  static get observedAttributes() { return ['src']; }
  connectedCallback() { this.renderSlot(); }
  attributeChangedCallback() { if (this.isConnected) this.renderSlot(); }
  renderSlot() {
    const src = this.getAttribute('src');
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover';
      if (this.dataset.fit) img.style.objectPosition = this.dataset.fit;
      this.replaceChildren(img);
    } else {
      const ph = document.createElement('span');
      ph.className = 'ph';
      ph.textContent = this.dataset.placeholder || 'Image';
      this.replaceChildren(ph);
    }
  }
});

// ---------------------------------------------------------------------------
// Grade utilities
// ---------------------------------------------------------------------------

// Same thresholds as the engine's documented color rule:
// pct >= 70 good, 40-69 mid, < 40 bad.
function band(pct) {
  if (pct >= 70) return 'good';
  if (pct >= 40) return 'mid';
  return 'bad';
}

const BAND_COLORS = { good: '#00D492', mid: '#FFA600', bad: '#E5484D' };

// Letter bands mirror the backend's grading.py.
const LETTER_BANDS = [
  [97, 'A+'], [93, 'A'], [90, 'A-'], [87, 'B+'], [83, 'B'], [80, 'B-'],
  [77, 'C+'], [73, 'C'], [70, 'C-'], [67, 'D+'], [63, 'D'], [60, 'D-']
];

function letterFromPct(pct) {
  for (const [min, letter] of LETTER_BANDS) if (pct >= min) return letter;
  return 'F';
}

// Fallback pct when only a letter is available (band midpoints).
const LETTER_PCT = {
  'A+': 98, 'A': 94, 'A-': 91, 'B+': 88, 'B': 84, 'B-': 81,
  'C+': 78, 'C': 74, 'C-': 71, 'D+': 68, 'D': 64, 'D-': 61, 'F': 50
};

function clampPct(pct, gradeFallback) {
  if (typeof pct === 'number' && isFinite(pct)) return Math.max(0, Math.min(100, Math.round(pct)));
  if (gradeFallback && LETTER_PCT[gradeFallback] != null) return LETTER_PCT[gradeFallback];
  return 0;
}

function displayGrade(grade, pct) {
  if (grade) return grade;
  if (typeof pct === 'number' && isFinite(pct)) return letterFromPct(clampPct(pct));
  return 'N/A';
}

// ---------------------------------------------------------------------------
// deriveGenieView: backend report contract -> view model.
// Missing fields fall back to the demo report (window.GENIE_DEMO).
// ---------------------------------------------------------------------------

// Prototype pin positions (px inside the 340px-wide .shot), used when a
// finding carries no pin from the engine.
const DEFAULT_PINS = {
  copy:        [{ top: 24, left: 28 }, { top: 80, left: 240 }, { top: 130, left: 80 }, { top: 164, left: 200 }],
  credibility: [{ top: 28, left: 32 }, { top: 110, left: 66 }, { top: 76, left: 210 }, { top: 160, left: 160 }],
  conversion:  [{ top: 30, left: 36 }, { top: 88, left: 160 }, { top: 128, left: 64 }, { top: 162, left: 190 }]
};

const SECTION_KEYS = ['copy', 'credibility', 'conversion'];

function deriveGenieView(raw) {
  const demo = window.GENIE_DEMO || {};
  // Only the demo/mock render (raw is the demo report itself, or nothing) may fall
  // back to demo section data. A live report that omits a section is a contract
  // violation and must be treated as unavailable, never backfilled with demo grades.
  const isDemo = !raw || raw === demo;
  raw = raw || demo;
  const screenshots = raw.screenshots || demo.screenshots || {};

  const view = { url: raw.url || demo.url || '', brand: raw.brand || demo.brand || '', sections: {}, rollup: null };

  SECTION_KEYS.forEach(key => {
    view.sections[key] = deriveSection(key, raw[key], (demo[key] || {}), screenshots, isDemo);
  });

  const rollup = raw.rollup || demo.rollup || {};
  view.rollup = {
    available: rollup.grade != null || (rollup.pages || []).length > 0,
    grade: displayGrade(rollup.grade, rollup.pct),
    pct: clampPct(rollup.pct, rollup.grade),
    bars: (rollup.pages || []).map(pg => ({
      label: pg.label,
      display: displayGrade(pg.grade, pg.pct),
      pct: clampPct(pg.pct, pg.grade)
    })),
    summary: rollup.summary || '',
    fixes: (rollup.priority_fixes || []).map(f => ({ rank: f.rank, title: f.title || '', detail: f.detail || '' }))
  };
  return view;
}

function deriveSection(key, sec, demoSec, screenshots, isDemo) {
  // Missing section on a live report => unavailable (empty section), never demo data.
  // Demo/mock fall back to the demo section so ?mock=1 stays identical to the demo.
  sec = sec || (isDemo ? demoSec : {});
  const available = !sec.error && (sec.grade != null || (sec.subscores || []).length > 0);

  const bars = (sec.subscores || []).map(s => ({
    label: s.label,
    display: displayGrade(s.grade, s.pct),
    pct: clampPct(s.pct, s.grade)
  }));
  if (key === 'credibility') {
    const pc = sec.proof_coverage;
    if (pc) {
      bars.push({
        label: 'Proof coverage',
        display: pc.label || ((pc.covered != null ? pc.covered : 0) + ' / ' + (pc.total != null ? pc.total : 0)),
        pct: clampPct(pc.pct)
      });
    }
  }

  const findings = (sec.findings || []).map((f, i) => ({
    n: f.n != null ? f.n : i + 1,
    title: f.title || '',
    detail: f.detail || '',
    fix: f.fix || null,
    pass: !!f.pass,
    display: displayGrade(f.grade, f.pct),
    pct: clampPct(f.pct, f.grade),
    pin: f.pin && typeof f.pin.x_pct === 'number' && typeof f.pin.y_pct === 'number'
      ? { page: f.pin.page != null ? f.pin.page : null, xPct: f.pin.x_pct, yPct: f.pin.y_pct } : null
  }));

  const shotEntry = screenshots[sec.screenshot] || null;

  const derived = {
    available: available,
    error: sec.error || null,
    grade: displayGrade(sec.grade, sec.pct),
    pct: clampPct(sec.pct, sec.grade),
    verdict: sec.verdict || '',
    summary: sec.summary || '',
    metas: (sec.meta_tags || []).slice(),
    bars: bars,
    findings: findings,
    shotUrl: shotEntry ? (shotEntry.full_url || shotEntry.hero_url || null) : null,
    screenshot: sec.screenshot || null,
    overallNote: sec.overall_note || '',
    swp: { strength: sec.strength || '', weakness: sec.weakness || '', priority: sec.priority || '' }
  };
  if (key === 'credibility') derived.claims = (sec.claims || []).slice();
  if (key === 'conversion') {
    derived.offers = (sec.offer_ladder || []).map(o => ({ label: o.label || o.key || '', present: !!o.present }));
    derived.offerHeadline = offerHeadline(derived.offers);
  }
  return derived;
}

function offerHeadline(offers) {
  const n = offers.filter(o => o.present).length;
  if (n === 1) return 'You only have one offer';
  if (n === 0) return 'You have no offers yet';
  return 'You have ' + n + ' of ' + offers.length + ' offers';
}

// ---------------------------------------------------------------------------
// Builders: emit the prototype's exact markup patterns.
// All report strings go in via textContent, never innerHTML.
// ---------------------------------------------------------------------------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function buildBar(bar) {
  const cbar = el('div', 'cbar');
  const top = el('div', 'top');
  top.append(el('span', 'cn', bar.label), el('span', 'cg', bar.display));
  const track = el('div', 'track');
  const fill = el('div', 'fill g-' + band(bar.pct));
  fill.style.width = bar.pct + '%';
  track.appendChild(fill);
  cbar.append(top, track);
  return cbar;
}

function buildFinding(f) {
  const card = el('div', 'card rcard');
  const rh = el('div', 'rh');
  const rhl = el('div', 'rhl');
  rhl.append(el('span', 'rnum', String(f.n)), el('span', 'rt', f.title));
  rh.appendChild(rhl);
  if (f.pass) {
    rh.appendChild(el('span', 'passbadge', '✓ PASS'));
  } else {
    rh.appendChild(el('span', 'rgrade t-' + band(f.pct), f.display));
  }
  card.append(rh, el('div', 'rv', f.detail));
  if (f.fix) card.appendChild(el('div', 'rx', 'Fix · ' + f.fix));
  return card;
}

function buildPin(n, pos) {
  const pin = el('div', 'pin', String(n));
  if (pos.xPct != null) {
    pin.style.top = pos.yPct + '%';
    pin.style.left = pos.xPct + '%';
  } else {
    pin.style.top = pos.top + 'px';
    pin.style.left = pos.left + 'px';
  }
  return pin;
}

function buildClaimRow(row) {
  const tr = document.createElement('tr');
  tr.append(el('td', 'claim', row.claim), el('td', null, row.current_proof), el('td', null, row.recommendation));
  return tr;
}

function buildOffer(offer) {
  const div = el('div', 'offer ' + (offer.present ? 'have' : 'missing'));
  div.appendChild(el('span', 'ck', offer.present ? '✓' : '+'));
  div.appendChild(document.createTextNode(offer.label));
  return div;
}

function buildSwpCard(label, value, hot) {
  const card = el('div', 'card swpc' + (hot ? ' hot' : ''));
  card.append(el('div', 'sl', label), el('div', 'sv', value));
  return card;
}

function buildFix(f) {
  const card = el('div', 'card fix');
  card.appendChild(el('div', 'fixn', String(f.rank)));
  const body = document.createElement('div');
  body.append(el('div', 'ft', f.title), el('div', 'fd', f.detail));
  card.appendChild(body);
  return card;
}

// ---------------------------------------------------------------------------
// renderReport: bind a derived view onto the static screens.
// ---------------------------------------------------------------------------

function setDial(dialEl, grade, pct) {
  const color = BAND_COLORS[band(pct)];
  dialEl.style.background = 'conic-gradient(' + color + ' 0 ' + pct + '%,#212121 ' + pct + '% 100%)';
  const inner = dialEl.querySelector('.in');
  if (inner) inner.textContent = grade;
}

function bindText(root, name, value) {
  const node = root.querySelector('[data-bind="' + name + '"]');
  if (node && value != null) node.textContent = value;
}

// A rendered report with an unavailable section must NOT keep the prototype's
// sample markup: the print stylesheet reveals every hidden screen, so stale demo
// grades would print as if they were the customer's. Hide the sample report (kept
// in the DOM so a later successful re-scan can restore it) and show an explicit,
// honest "Not available" panel on screen and in print.
function renderUnavailableSection(root, key, sec) {
  const screen = root.querySelector('.screen');
  if (!screen) return;
  const report = screen.querySelector('.report');
  if (report) report.classList.add('genie-off');

  // Keep the screen's heading (the Genius Move pill + title) from the prototype.
  const pill = (report || root).querySelector('.movepill');
  const title = (report || root).querySelector('.movetitle');
  const pillText = pill ? pill.textContent : '';
  const titleText = title ? title.textContent : (key.charAt(0).toUpperCase() + key.slice(1));

  let panel = screen.querySelector('[data-unavail-panel]');
  if (!panel) {
    panel = el('div', 'card placeholder');
    panel.setAttribute('data-unavail-panel', key);
    screen.appendChild(panel);
  }
  panel.replaceChildren();
  if (pillText) panel.appendChild(el('span', 'movepill', pillText));
  const t = el('div', 'movetitle', titleText);
  t.style.marginTop = '18px';
  panel.appendChild(t);
  const head = el('div', 'ttl', 'This section is not available');
  head.style.marginTop = '14px';
  panel.appendChild(head);
  const note = el('div', 'hsum', sec && sec.error
    ? 'We ran into a problem grading this section, so we left it out instead of showing numbers we can’t stand behind.'
    : 'We couldn’t grade this section, so we left it out instead of showing numbers we can’t stand behind.');
  note.style.cssText = 'margin:14px auto 0;max-width:48ch';
  panel.appendChild(note);
}

// Undo any "Not available" state from an earlier render so a now-available section
// shows its real report again.
function restoreSection(root) {
  const panel = root.querySelector('[data-unavail-panel]');
  if (panel) panel.remove();
  const report = root.querySelector('.report');
  if (report) report.classList.remove('genie-off');
}

function renderSectionScreen(key, sec) {
  const root = document.querySelector('[data-screen="' + key + '"]');
  if (!root || !sec) return;
  if (!sec.available) { renderUnavailableSection(root, key, sec); return; }
  // Section is available: undo any "Not available" panel left by an earlier render.
  restoreSection(root);

  const dial = root.querySelector('[data-dial]');
  if (dial) setDial(dial, sec.grade, sec.pct);

  const barsEl = root.querySelector('[data-bars]');
  if (barsEl) barsEl.replaceChildren.apply(barsEl, sec.bars.map(buildBar));

  bindText(root, 'verdict', sec.verdict);
  bindText(root, 'summary', sec.summary);

  const metasEl = root.querySelector('[data-metas]');
  if (metasEl) metasEl.replaceChildren.apply(metasEl, sec.metas.map(m => el('span', 'mtag', m)));

  const findingsEl = root.querySelector('[data-findings]');
  if (findingsEl) findingsEl.replaceChildren.apply(findingsEl, sec.findings.map(buildFinding));

  // Screenshot + pins.
  const shot = root.querySelector('.shot');
  if (shot) {
    const slot = shot.querySelector('image-slot');
    if (slot && sec.shotUrl) {
      slot.dataset.fit = 'top';
      slot.setAttribute('src', sec.shotUrl);
    }
    shot.querySelectorAll('.pin').forEach(p => p.remove());
    const defaults = DEFAULT_PINS[key] || [];
    sec.findings.forEach((f, i) => {
      if (f.pin) {
        // Engine pin: place it only when it targets THIS section's screenshot.
        // A pin on another page would land on the wrong image, so skip it (the
        // finding card still carries the number n). A pin with no page is assumed
        // to belong here, matching the pre-contract behavior.
        if (f.pin.page != null && sec.screenshot != null && f.pin.page !== sec.screenshot) return;
        shot.appendChild(buildPin(f.n, f.pin));
      } else {
        const pos = defaults[i];
        if (pos) shot.appendChild(buildPin(f.n, pos));
      }
    });
  }

  // Copy screen extras: overall performance card + strength/weakness/priority.
  const overallEl = root.querySelector('[data-overall]');
  if (overallEl) {
    const og = overallEl.querySelector('.og');
    if (og) { og.className = 'og t-' + band(sec.pct); og.textContent = sec.grade; }
    const ot = overallEl.querySelector('.ot');
    if (ot) ot.textContent = 'Overall performance · Grade ' + sec.grade;
    const os = overallEl.querySelector('.os');
    if (os) os.textContent = sec.overallNote;
  }
  const swpEl = root.querySelector('[data-swp]');
  if (swpEl) {
    swpEl.replaceChildren(
      buildSwpCard('Biggest strength', sec.swp.strength, false),
      buildSwpCard('Biggest weakness', sec.swp.weakness, false),
      buildSwpCard('Improvement priority', sec.swp.priority, true)
    );
  }

  // Credibility extras: claims table.
  if (key === 'credibility') {
    const tbody = document.getElementById('claims-body');
    if (tbody) tbody.replaceChildren.apply(tbody, (sec.claims || []).map(buildClaimRow));
  }

  // Conversion extras: offer ladder.
  if (key === 'conversion') {
    bindText(root, 'offer-headline', sec.offerHeadline);
    const grid = document.getElementById('offer-grid');
    if (grid) grid.replaceChildren.apply(grid, (sec.offers || []).map(buildOffer));
  }
}

function renderRollup(rollup) {
  const root = document.querySelector('[data-screen="conversation"]');
  if (!root || !rollup || !rollup.available) return;
  const dial = root.querySelector('[data-dial="overall"]');
  if (dial) setDial(dial, rollup.grade, rollup.pct);
  const barsEl = root.querySelector('[data-bars]');
  if (barsEl) barsEl.replaceChildren.apply(barsEl, rollup.bars.map(buildBar));
  bindText(root, 'summary', rollup.summary);
  const list = document.getElementById('fix-list');
  if (list) list.replaceChildren.apply(list, rollup.fixes.map(buildFix));
}

function renderReport(view) {
  SECTION_KEYS.forEach(key => renderSectionScreen(key, view.sections[key]));
  renderRollup(view.rollup);
  // Prefill the email-gate URL field with the scanned URL.
  const gateUrl = document.getElementById('gate-url');
  if (gateUrl && view.url) gateUrl.value = view.url;
}

function updateToolLinks(url) {
  if (!url) return;
  const ps = document.querySelector('[data-tool-link="pagespeed"]');
  if (ps) ps.href = 'https://pagespeed.web.dev/report?url=' + encodeURIComponent(url);
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

const API_BASE = 'https://factor8-agent-sdk.fly.dev/api/v1/brand-slug/public-scanner/website-genie';
// Low-privilege public scanner key, same posture as the public AEO scanner:
// a key in static HTML is an identifier, not a secret. Real protection is the
// engine's per-IP rate limit. Ralph: paste the key before go-live.
const API_KEY = 'PASTE_PUBLIC_SCANNER_KEY_HERE';
const LEAD_URL = 'https://factor8-agent-sdk.fly.dev/api/v1/website-genie/lead';
const SCAN_TIMEOUT_MS = 200000;

function scanError(kind) {
  const messages = {
    429: 'High demand. Try again in a minute.',
    502: 'We couldn’t reach that URL. Check it and try again.',
    422: 'That doesn’t look like a URL we can scan. Check it and try again.',
    timeout: 'The scan took too long and timed out. Please try again.',
    network: 'We couldn’t reach the Genie engine. Check your connection and try again.',
    incomplete: 'The scan ended early. Please try again.'
  };
  const err = new Error(messages[kind] || 'Something went wrong running your scan. Please try again.');
  err.genie = true;
  err.kind = kind;
  return err;
}

// POST + incremental SSE parse (EventSource is GET-only, so we read the
// streamed body by hand). Events: {phase, pct, message}; final frame is
// {phase:"complete", pct:100, result}; failure is {phase:"error", status, detail}.
async function runScan(url, email, onPhase) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);
  try {
    let res;
    try {
      res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream', 'X-API-Key': API_KEY },
        body: JSON.stringify(email ? { url: url, email: email } : { url: url }),
        signal: controller.signal
      });
    } catch (err) {
      throw scanError(err && err.name === 'AbortError' ? 'timeout' : 'network');
    }
    if (!res.ok) throw scanError(res.status);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      let chunk;
      try {
        chunk = await reader.read();
      } catch (err) {
        throw scanError(err && err.name === 'AbortError' ? 'timeout' : 'network');
      }
      if (chunk.done) break;
      buf += decoder.decode(chunk.value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const data = frame.split('\n')
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trim())
          .join('\n');
        if (!data) continue; // heartbeats / comments
        let evt;
        try { evt = JSON.parse(data); } catch (e) { continue; }
        if (evt.phase === 'complete') return evt.result;
        if (evt.phase === 'error') throw scanError(evt.status);
        if (onPhase) onPhase(evt);
      }
    }
    throw scanError('incomplete');
  } finally {
    clearTimeout(timer);
  }
}

// Stubbed scan for UX testing without the engine: ?stub=1 succeeds with the
// demo report, ?stub=fail exercises the error path.
function stubScan(url, email, onPhase) {
  const fail = PARAMS.get('stub') === 'fail';
  const phases = [
    { phase: 'fetching', pct: 5, message: 'Fetching your pages…' },
    { phase: 'capturing', pct: 20, message: 'Capturing screenshots…' },
    { phase: 'grading', pct: 35, message: 'Grading your site…' },
    { phase: 'graded', pct: 55, message: 'Copy graded: B-' },
    { phase: 'graded', pct: 70, message: 'Credibility graded: C' },
    { phase: 'graded', pct: 85, message: 'Conversion graded: C-' },
    { phase: 'compiling', pct: 92, message: 'Compiling your report…' }
  ];
  return new Promise((resolve, reject) => {
    let i = 0;
    const tick = () => {
      if (i < phases.length) {
        if (onPhase) onPhase(phases[i]);
        i += 1;
        setTimeout(tick, 700);
      } else if (fail) {
        reject(scanError(502));
      } else {
        const report = JSON.parse(JSON.stringify(window.GENIE_DEMO));
        report.url = url;
        resolve(report);
      }
    };
    setTimeout(tick, 300);
  });
}

// Lead capture: non-blocking, optimistic. Failures are swallowed.
function postLead(email, url, overallGrade) {
  const payload = { email: email, url: url };
  if (overallGrade) payload.overall_grade = overallGrade;
  return fetch(LEAD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// State machine: demo -> scanning -> ready | error
// ---------------------------------------------------------------------------

const state = {
  mode: 'demo',                    // demo | scanning | ready | error
  phaseText: '',                   // live phase text shown on locked rail steps
  unlockedThrough: 'conversation', // last step reachable from the rail
  failed: {},                      // section key -> true (partial report)
  url: null,
  overallGrade: null,
  errorKind: null,                 // kind of the last scan error (429/502/422/timeout/...)
  hasReport: false                 // a real report has rendered at least once this session
};

function setProgress(pct, message) {
  if (message) state.phaseText = message;
  const card = document.getElementById('scan-progress');
  if (card) card.hidden = false;
  const phase = document.getElementById('scan-phase');
  if (phase && message) phase.textContent = message;
  const bar = document.getElementById('scan-bar');
  if (bar) bar.style.width = clampPct(pct) + '%';
  render();
}

function showScanError(err) {
  state.mode = 'error';
  state.phaseText = '';
  state.errorKind = err && err.kind != null ? err.kind : null;
  state.unlockedThrough = 'conversation';
  const progress = document.getElementById('scan-progress');
  if (progress) progress.hidden = true;
  const msg = document.getElementById('scan-error-msg');
  if (msg) msg.textContent = err.message;
  const card = document.getElementById('scan-error');
  if (card) card.hidden = false;
  render();
}

function startScan(url) {
  state.mode = 'scanning';
  state.unlockedThrough = 'entry';
  state.failed = {};
  state.url = url;
  const errCard = document.getElementById('scan-error');
  if (errCard) errCard.hidden = true;
  go('entry');
  setProgress(2, 'Starting your scan…');
  let email = null;
  try { email = sessionStorage.getItem('genie:lead'); } catch (e) {}
  const impl = PARAMS.get('stub') ? stubScan : runScan;
  impl(url, email, evt => setProgress(evt.pct, evt.message))
    .then(report => {
      try { sessionStorage.setItem('genie:report', JSON.stringify(report)); } catch (e) {}
      showReport(report);
      go('copy');
    })
    .catch(err => showScanError(err.genie ? err : scanError('network')));
}

function showReport(report) {
  const view = deriveGenieView(report);
  state.mode = 'ready';
  state.phaseText = '';
  state.unlockedThrough = 'conversation';
  state.failed = {};
  SECTION_KEYS.forEach(k => { if (!view.sections[k].available) state.failed[k] = true; });
  state.url = view.url;
  state.overallGrade = view.rollup && view.rollup.available ? view.rollup.grade : null;
  state.hasReport = true;
  renderReport(view);
  updateToolLinks(view.url);
  const progress = document.getElementById('scan-progress');
  if (progress) progress.hidden = true;
  const errCard = document.getElementById('scan-error');
  if (errCard) errCard.hidden = true;
  render();
}

function normalizeUrl(value) {
  value = (value || '').trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = 'https://' + value;
  try {
    const u = new URL(value);
    if (!u.hostname.includes('.')) return null;
    return u.href;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Navigation (step rail)
// ---------------------------------------------------------------------------

const ORDER = ['entry', 'copy', 'credibility', 'conversion', 'code', 'cost', 'conversation'];
let move = 'entry';

function isLockedStep(k) {
  if (state.mode === 'scanning') return ORDER.indexOf(k) > ORDER.indexOf(state.unlockedThrough);
  return !!state.failed[k];
}

function render() {
  const cur = ORDER.indexOf(move);
  document.querySelectorAll('.step').forEach(btn => {
    const i = ORDER.indexOf(btn.dataset.step);
    const k = btn.dataset.step;
    btn.classList.remove('done', 'active', 'sel', 'next', 'locked');
    let st;
    if (state.mode === 'scanning' && isLockedStep(k)) {
      btn.classList.add('locked');
      st = state.phaseText || 'Scanning…';
    } else if (state.failed[k]) {
      btn.classList.add('locked');
      st = 'Not available';
    } else if (i < cur) { btn.classList.add('done'); st = 'Complete'; }
    else if (i === cur) { btn.classList.add('active', 'sel'); st = 'You are here'; }
    else if (i === cur + 1) { btn.classList.add('next'); st = 'Up next'; }
    else { btn.classList.add('locked'); st = 'Locked'; }
    btn.querySelector('.sst').textContent = st;
  });
  document.querySelectorAll('[data-screen]').forEach(s => { s.hidden = s.dataset.screen !== move; });
}

function go(k) {
  if (isLockedStep(k)) return;
  move = k;
  history.replaceState(null, '', '#' + k);
  render();
  window.scrollTo(0, 0);
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-go]');
  if (t) go(t.dataset.go);
});

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

const scanForm = document.getElementById('scan-form');
if (scanForm) {
  scanForm.addEventListener('submit', e => {
    e.preventDefault();
    const input = document.getElementById('entry-url');
    const url = normalizeUrl(input ? input.value : '');
    if (!url) { showScanError(scanError(422)); return; }
    startScan(url);
  });
}

const retryBtn = document.getElementById('scan-retry');
if (retryBtn) {
  retryBtn.addEventListener('click', () => {
    const card = document.getElementById('scan-error');
    if (card) card.hidden = true;
    // A 422 means the URL itself is not scannable. Re-running state.url would
    // silently re-scan a stale/previous URL and ignore the user's correction, so
    // send them back to the entry field (their typed value is still there) instead.
    if (state.errorKind === 422 || !state.url) {
      state.mode = state.hasReport ? 'ready' : 'demo';
      go('entry');
      const input = document.getElementById('entry-url');
      if (input) input.focus();
      return;
    }
    startScan(state.url);
  });
}

const gateBtn = document.getElementById('gate-submit');
if (gateBtn) {
  gateBtn.addEventListener('click', () => {
    const emailInput = document.getElementById('gate-email');
    const email = (emailInput ? emailInput.value : '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (emailInput) emailInput.focus();
      return;
    }
    const urlInput = document.getElementById('gate-url');
    const url = normalizeUrl(urlInput ? urlInput.value : '') || state.url || '';
    postLead(email, url, state.overallGrade);
    try { sessionStorage.setItem('genie:lead', email); } catch (e) {}
    gateBtn.textContent = 'Got it! Your report is on its way.';
    gateBtn.disabled = true;
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

const PARAMS = new URLSearchParams(location.search);

// Modes:
//   (bare) / ?demo=1  untouched prototype sample data
//   ?mock=1           demo report rendered through the full derive/render pipeline
//   ?stub=1|fail      entry form runs a fake scan (success | error path)
//   live              entry form POSTs to the Genie engine (SSE)
//   ?r=<id>           dormant hook for shareable reports, pending backend
//                     GET /report/{id}; ignored for now.
(function boot() {
  if (PARAMS.get('demo') === '1') return;
  if (PARAMS.get('mock') === '1' && window.GENIE_DEMO) {
    showReport(window.GENIE_DEMO);
    return;
  }
  let saved = null;
  try { saved = sessionStorage.getItem('genie:report'); } catch (e) {}
  if (saved) {
    try { showReport(JSON.parse(saved)); } catch (e) {}
  }
  let lead = null;
  try { lead = sessionStorage.getItem('genie:lead'); } catch (e) {}
  if (lead) {
    const emailInput = document.getElementById('gate-email');
    if (emailInput) emailInput.value = lead;
  }
})();

const h = location.hash.slice(1);
if (ORDER.includes(h)) move = h;
render();
