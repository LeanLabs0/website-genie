// Website Genie app logic (classic script, no build, no modules).

// ---------------------------------------------------------------------------
// Where every "book a call" button goes.
// PLACEHOLDER: this is the Lean Labs contact page, standing in until Kevin's
// real calendar link exists. Change this ONE line and every booking CTA on the
// page follows: the top bar, the three report sidebars, and the Conversation
// screen. The same URL is also hardcoded on the <a> tags so the buttons still
// work if this script fails to load.
// ---------------------------------------------------------------------------
const BOOKING_URL = 'https://www.lean-labs.com/contact';

function wireBookingLinks() {
  document.querySelectorAll('[data-book]').forEach(a => {
    a.href = BOOKING_URL;
    a.target = '_blank';
    a.rel = 'noopener';
  });
}
wireBookingLinks();

// "Print / save the full report" does exactly that: the print stylesheet lays
// the report out one screen per page. No PDF is generated or emailed, so the
// button no longer claims to.
const printBtn = document.getElementById('print-report');
if (printBtn) printBtn.addEventListener('click', () => window.print());

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
      img.alt = '';
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover';
      if (this.dataset.fit) img.style.objectPosition = this.dataset.fit;
      // Screenshot uploads finish in the background, so the URL can 404 for a
      // moment after the report renders. Retry a few times before giving up.
      let tries = 0;
      img.addEventListener('error', () => {
        if (tries++ < 4) {
          setTimeout(() => { img.src = src + '?r=' + tries; }, 1500 * tries);
        } else {
          this.closest('.shot')?.classList.add('noshot');
        }
      });
      img.addEventListener('load', () => {
        this.closest('.shot')?.classList.remove('noshot');
      });
      img.src = src;
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

// Colour follows the LETTER, never a second set of thresholds.
// There used to be two scales running side by side: the letter came from the
// backend's bands (under 60 is F) while the colour came from pct >= 70 / >= 40.
// That painted an F orange at 58%, a C- green at 72%, and put an orange
// "Authoritativeness F" next to a red "Trust F" in the same list.
// A/B good, C/D mid, F bad.
function bandFromLetter(letter) {
  const c = String(letter || '').trim().charAt(0).toUpperCase();
  if (c === 'A' || c === 'B') return 'good';
  if (c === 'C' || c === 'D') return 'mid';
  return 'bad';
}

// Some readouts are not letters at all (proof coverage shows "1 / 6"). Those
// fall back to the letter their pct would earn, so they sit on the same scale.
const GRADE_RE = /^[ABCDF][+-]?$/i;

function gradeBand(display, pct) {
  const d = String(display || '').trim();
  if (GRADE_RE.test(d)) return bandFromLetter(d);
  return bandFromLetter(letterFromPct(clampPct(pct)));
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
  const skipped = !!sec.skipped;
  const available = !skipped && !sec.error && (sec.grade != null || (sec.subscores || []).length > 0);

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
    skipped: skipped,
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
  // The letter leads, the number backs it up. A naked letter is an assertion;
  // the score is the evidence for it.
  const gw = el('span', 'cgw');
  gw.append(el('span', 'cg', bar.display), el('span', 'cp', bar.pct + '/100'));
  top.append(el('span', 'cn', bar.label), gw);
  const track = el('div', 'track');
  const fill = el('div', 'fill g-' + gradeBand(bar.display, bar.pct));
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
    const chip = el('span', 'rgrade t-' + gradeBand(f.display, f.pct), f.display);
    chip.title = f.display + ' · ' + f.pct + ' out of 100';
    rh.appendChild(chip);
  }
  card.append(rh, el('div', 'rv', f.detail));
  if (f.fix) card.appendChild(el('div', 'rx', 'Fix · ' + f.fix));
  return card;
}

// Pins only ever come from engine coordinates now, so the position is always
// a percentage of the screenshot.
function buildPin(n, pos) {
  const pin = el('div', 'pin', String(n));
  pin.style.top = pos.yPct + '%';
  pin.style.left = pos.xPct + '%';
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
  const color = BAND_COLORS[gradeBand(grade, pct)];
  // Ring width still tracks pct; only the colour comes from the letter.
  dialEl.style.background = 'conic-gradient(' + color + ' 0 ' + pct + '%,#212121 ' + pct + '% 100%)';
  const inner = dialEl.querySelector('.in');
  if (inner) inner.replaceChildren(el('span', 'dg', grade), el('span', 'dp', pct + '/100'));
}

function bindText(root, name, value) {
  const node = root.querySelector('[data-bind="' + name + '"]');
  if (node && value != null) node.textContent = value;
}

// Swap a screen's prototype sample markup for an honest panel that keeps the
// screen's own identity (Genius Move pill + title). The sample report stays in
// the DOM, hidden, so a later successful scan can bind onto it again.
// Used for two cases: a section the engine could not grade, and a screen nobody
// has run a scan for yet.
function renderEmptyPanel(root, key, headText, noteText, ctaText) {
  const screen = root.querySelector('.screen');
  if (!screen) return;
  const report = screen.querySelector('.report');
  if (report) report.classList.add('genie-off');

  const pill = (report || root).querySelector('.movepill');
  const title = (report || root).querySelector('.movetitle');
  const pillText = pill ? pill.textContent : '';
  const titleText = title ? title.textContent : (key.charAt(0).toUpperCase() + key.slice(1));

  let panel = screen.querySelector('[data-unavail-panel]');
  if (!panel) {
    panel = el('div', 'card placeholder');
    screen.appendChild(panel);
  }
  panel.setAttribute('data-unavail-panel', key);
  panel.replaceChildren();
  if (pillText) panel.appendChild(el('span', 'movepill', pillText));
  const t = el('div', 'movetitle', titleText);
  t.style.marginTop = '18px';
  panel.appendChild(t);
  const head = el('div', 'ttl', headText);
  head.style.marginTop = '14px';
  panel.appendChild(head);
  const note = el('div', 'hsum', noteText);
  note.style.cssText = 'margin:14px auto 0;max-width:50ch';
  panel.appendChild(note);
  if (ctaText) {
    const wrap = el('div', null);
    wrap.style.marginTop = '22px';
    const btn = el('button', 'btnp', ctaText);
    btn.type = 'button';
    btn.dataset.go = 'entry';
    wrap.appendChild(btn);
    panel.appendChild(wrap);
  }
}

// A rendered report with an unavailable section must NOT keep the prototype's
// sample markup: stale demo grades would print as if they were the customer's.
function renderUnavailableSection(root, key, sec) {
  renderEmptyPanel(root, key, 'This section is not available',
    sec && sec.error
      ? 'We ran into a problem grading this section, so we left it out instead of showing numbers we can’t stand behind.'
      : 'We couldn’t grade this section, so we left it out instead of showing numbers we can’t stand behind.',
    null);
}

// No scan has run this session and the sample was not explicitly requested.
// The step still exists and is still reachable; it just has nothing in it yet.
// Anything else here would be invented grades about a site we never looked at.
const AWAITING_KEYS = ['copy', 'credibility', 'conversion', 'conversation'];

function renderAwaitingScan() {
  AWAITING_KEYS.forEach(key => {
    const root = document.querySelector('[data-screen="' + key + '"]');
    if (!root) return;
    renderEmptyPanel(root, key, 'Run a scan to see this',
      'Nothing has been graded yet. Put your page URL in on step 0 and the Genie fills this screen in with your own results.',
      'Enter your URL →');
  });
}

// Undo any "Not available" state from an earlier render so a now-available section
// shows its real report again.
function restoreSection(root) {
  const panel = root.querySelector('[data-unavail-panel]');
  if (panel) panel.remove();
  const report = root.querySelector('.report');
  if (report) report.classList.remove('genie-off');
}

// Conversion awaiting its own scan: hide the sample report but keep the gate
// card front and center. The gate node is MOVED into the panel (listeners
// survive a move) and a marker comment holds its original spot for restore.
function renderGateSection(root) {
  const screen = root.querySelector('.screen');
  if (!screen) return;
  const report = screen.querySelector('.report');
  if (report) report.classList.add('genie-off');

  let panel = screen.querySelector('[data-gate-panel]');
  if (!panel) {
    panel = el('div', 'card placeholder');
    panel.setAttribute('data-gate-panel', '1');
    panel.appendChild(el('span', 'movepill', 'GENIUS MOVE #3'));
    const t = el('div', 'movetitle', 'Conversion');
    t.style.marginTop = '18px';
    panel.appendChild(t);
    const teaser = el('div', 'hsum',
      'This critique runs on the page where you actually convert visitors. ' +
      'Enter your offer or landing page URL below and the Genie grades it in about 30 seconds.');
    teaser.style.cssText = 'margin:14px auto 0;max-width:52ch';
    panel.appendChild(teaser);
    const gate = (report || screen).querySelector('.gate');
    if (gate) {
      const marker = document.createComment('gate-home');
      gate.parentNode.insertBefore(marker, gate);
      gate.dataset.moved = '1';
      const wrap = el('div', null);
      wrap.style.cssText = 'margin-top:22px;text-align:left';
      wrap.appendChild(gate);
      panel.appendChild(wrap);
    }
    screen.appendChild(panel);
  }
}

function restoreGateSection(root) {
  const panel = root.querySelector('[data-gate-panel]');
  if (!panel) return;
  const gate = panel.querySelector('.gate');
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  let marker = null;
  while (walker.nextNode()) {
    if (walker.currentNode.nodeValue === 'gate-home') { marker = walker.currentNode; break; }
  }
  if (gate && marker && marker.parentNode) {
    marker.parentNode.insertBefore(gate, marker);
    marker.remove();
    delete gate.dataset.moved;
  }
  panel.remove();
}

function renderSectionScreen(key, sec) {
  const root = document.querySelector('[data-screen="' + key + '"]');
  if (!root || !sec) return;
  if (sec.skipped && key === 'conversion') { renderGateSection(root); return; }
  if (sec.skipped) { renderUnavailableSection(root, key, sec); return; }
  if (!sec.available) { renderUnavailableSection(root, key, sec); return; }
  // Section is available: undo any "Not available" or gate panel left by an
  // earlier render.
  restoreGateSection(root);
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
    // No screenshot means no frame. A grey box labelled "Screenshot of your
    // page" in a finished report reads as something that failed to load.
    shot.hidden = !sec.shotUrl;
    if (slot && sec.shotUrl) {
      slot.dataset.fit = 'top';
      slot.setAttribute('src', sec.shotUrl);
    }
    shot.querySelectorAll('.pin').forEach(p => p.remove());
    // A pin is an annotation, not decoration. It is drawn only when the engine
    // gave real coordinates for that finding AND those coordinates belong to the
    // screenshot this section is showing. No coordinates means no pin: a marker
    // sitting on the wrong element is worse than no marker at all.
    // (This must never `return` from the function: everything below still needs
    // binding when a section has no screenshot.)
    if (sec.shotUrl) {
      sec.findings.forEach(f => {
        if (!f.pin) return;
        if (f.pin.page != null && sec.screenshot != null && f.pin.page !== sec.screenshot) return;
        shot.appendChild(buildPin(f.n, f.pin));
      });
    }
  }

  // Copy screen extras: overall performance card + strength/weakness/priority.
  const overallEl = root.querySelector('[data-overall]');
  if (overallEl) {
    const og = overallEl.querySelector('.og');
    if (og) { og.className = 'og t-' + gradeBand(sec.grade, sec.pct); og.textContent = sec.grade; }
    const ot = overallEl.querySelector('.ot');
    if (ot) ot.textContent = 'Overall performance · Grade ' + sec.grade + ' · ' + sec.pct + ' out of 100';
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
  // Undo the "run a scan first" panel now that there is a real rollup.
  restoreSection(root);
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
  // isitagentready.com takes the bare host as a path segment, not a query.
  const ar = document.querySelector('[data-tool-link="agentready"]');
  if (ar) {
    let host = '';
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) {}
    ar.href = host ? 'https://isitagentready.com/' + host : 'https://isitagentready.com/';
  }
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

// Engine base. For local testing serve this repo and run the engine on
// 127.0.0.1:8300, then add ?engine=local to the URL.
const LOCAL_ENGINE = new URLSearchParams(location.search).get('engine') === 'local';
const ENGINE = LOCAL_ENGINE ? 'http://127.0.0.1:8300' : 'https://factor8-agent-sdk.fly.dev';
const API_BASE = ENGINE + '/api/v1/brand-slug/public-scanner/website-genie';
// Dedicated low-privilege Website Genie key, same posture as the public AEO
// scanner: a key in static HTML is an identifier, not a secret. Real
// protection is the engine's per-IP rate limit. Rotate by replacing this
// entry in the engine's FACTOR8_API_KEYS list.
const API_KEY = 'wg_pub_884e5dc48cd9e33f210ccdb1';
const LEAD_URL = ENGINE + '/api/v1/website-genie/lead';
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
async function runScan(url, email, onPhase, scope) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);
  try {
    let res;
    try {
      const body = { url: url, scope: scope || 'main' };
      if (email) body.email = email;
      res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream', 'X-API-Key': API_KEY },
        body: JSON.stringify(body),
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
        if (evt.phase === 'complete') {
          // Accept both the bare report and the JSON path's
          // {report, duration_ms, cost_usd} wrapper.
          const r = evt.result;
          return (r && r.report && !r.copy) ? r.report : r;
        }
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
function stubScan(url, email, onPhase, scope) {
  const fail = PARAMS.get('stub') === 'fail';
  const conversionOnly = scope === 'conversion';
  const phases = conversionOnly
    ? [
        { phase: 'fetching', pct: 5, message: 'Fetching your page…' },
        { phase: 'capturing', pct: 20, message: 'Capturing screenshots…' },
        { phase: 'grading', pct: 35, message: 'Grading your page…' },
        { phase: 'graded', pct: 55, message: 'Conversion graded: C-' },
        { phase: 'compiling', pct: 92, message: 'Compiling your report…' }
      ]
    : [
        { phase: 'fetching', pct: 5, message: 'Fetching your pages…' },
        { phase: 'capturing', pct: 20, message: 'Capturing screenshots…' },
        { phase: 'grading', pct: 35, message: 'Grading your site…' },
        { phase: 'graded', pct: 55, message: 'Copy graded: B-' },
        { phase: 'graded', pct: 70, message: 'Credibility graded: C' },
        { phase: 'compiling', pct: 92, message: 'Compiling your report…' }
      ];
  return new Promise((resolve, reject) => {
    let i = 0;
    const tick = () => {
      if (i < phases.length) {
        if (onPhase) onPhase(phases[i]);
        i += 1;
        setTimeout(tick, 500);
      } else if (fail) {
        reject(scanError(502));
      } else {
        const report = JSON.parse(JSON.stringify(window.GENIE_DEMO));
        report.url = url;
        if (conversionOnly) {
          report.copy.skipped = true;
          report.credibility.skipped = true;
        } else {
          report.conversion.skipped = true;
          report.conversion.grade = null;
          report.conversion.pct = null;
          const pages = (report.rollup.pages || []).filter(p => p.key !== 'conversion');
          report.rollup.pages = (report.rollup.pages || []).map(p =>
            p.key === 'conversion' ? { key: p.key, label: p.label, grade: null, pct: null } : p);
          const pcts = pages.map(p => p.pct);
          report.rollup.pct = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
          report.rollup.grade = letterFromPct(report.rollup.pct);
        }
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
  phaseText: '',                   // live phase text shown on the next rail step
  unlockedThrough: 'conversation', // last step reachable from the rail
  failed: {},                      // section key -> true (partial report)
  skipped: {},                     // section key -> true (awaiting its own scan, e.g. conversion gate)
  url: null,
  overallGrade: null,
  errorKind: null,                 // kind of the last scan error (429/502/422/timeout/...)
  hasReport: false                 // a real report has rendered at least once this session
};

// The raw report of the last successful scan; scan 2 (conversion gate) merges
// into this and re-renders.
let lastReport = null;

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
  setCtaScanning(false);
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

function setCtaScanning(on) {
  const cta = document.getElementById('entry-submit');
  if (!cta) return;
  cta.disabled = on;
  cta.style.opacity = on ? '.6' : '';
  if (on) { cta.dataset.label = cta.textContent; cta.textContent = 'Scanning…'; }
  else if (cta.dataset.label) { cta.textContent = cta.dataset.label; }
}

function startScan(url) {
  state.mode = 'scanning';
  state.unlockedThrough = 'entry';
  state.failed = {};
  state.url = url;
  const errCard = document.getElementById('scan-error');
  if (errCard) errCard.hidden = true;
  setCtaScanning(true);
  go('entry');
  setProgress(2, 'Starting your scan…');
  const card = document.getElementById('scan-progress');
  if (card && card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
  lastReport = report;
  const view = deriveGenieView(report);
  state.mode = 'ready';
  state.phaseText = '';
  setCtaScanning(false);
  state.unlockedThrough = 'conversation';
  state.failed = {};
  state.skipped = {};
  SECTION_KEYS.forEach(k => {
    if (view.sections[k].skipped) state.skipped[k] = true;
    else if (!view.sections[k].available) state.failed[k] = true;
  });
  state.url = view.url;
  state.overallGrade = view.rollup && view.rollup.available ? view.rollup.grade : null;
  state.hasReport = true;
  setReportFlag();
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

// The top bar wraps to two rows on narrow screens, so the rail's sticky offset
// (and the sidebar's below it) has to be measured, not guessed. A wrong guess
// leaves a strip of page showing through between the two sticky bars.
function syncStickyOffsets() {
  const root = document.documentElement;
  const bar = document.querySelector('.topbar');
  const rail = document.querySelector('.railwrap');
  if (bar) root.style.setProperty('--topbar-h', Math.round(bar.getBoundingClientRect().height) + 'px');
  if (rail) {
    const h = rail.hidden ? 0 : Math.round(rail.getBoundingClientRect().height);
    root.style.setProperty('--rail-h', h + 'px');
  }
}

// Only about 3 of the 7 steps fit on a phone. Fade whichever edge has more
// steps behind it, and keep the current step in view after every move.
function syncRailScroll() {
  const wrap = document.querySelector('.railwrap');
  const rail = document.querySelector('.rail');
  if (!wrap || !rail) return;
  const max = rail.scrollWidth - rail.clientWidth;
  wrap.classList.toggle('more-left', rail.scrollLeft > 4);
  wrap.classList.toggle('more-right', max > 4 && rail.scrollLeft < max - 4);
}

function scrollActiveStepIntoView() {
  const rail = document.querySelector('.rail');
  const btn = rail && rail.querySelector('.step.sel');
  if (!rail || !btn) return;
  const target = btn.offsetLeft - (rail.clientWidth - btn.offsetWidth) / 2;
  rail.scrollLeft = Math.max(0, Math.min(target, rail.scrollWidth - rail.clientWidth));
  syncRailScroll();
}

// Only a running scan blocks navigation. A section that failed or is awaiting
// its own scan is still reachable: its screen shows an honest panel. Blocking
// it made visible buttons ("Continue to Conversion") silently do nothing.
function isLockedStep(k) {
  if (state.mode === 'scanning') return ORDER.indexOf(k) > ORDER.indexOf(state.unlockedThrough);
  return false;
}

function render() {
  const cur = ORDER.indexOf(move);
  // During a scan the live phase text shows on ONE step (the first locked
  // one), not spammed across the whole rail.
  let firstLocked = null;
  if (state.mode === 'scanning') {
    firstLocked = ORDER.find(k => isLockedStep(k)) || null;
  }
  document.querySelectorAll('.step').forEach(btn => {
    const i = ORDER.indexOf(btn.dataset.step);
    const k = btn.dataset.step;
    btn.classList.remove('done', 'active', 'sel', 'next', 'locked');
    let st;
    if (state.mode === 'scanning' && isLockedStep(k)) {
      btn.classList.add('locked');
      st = k === firstLocked ? (state.phaseText || 'Scanning…') : 'Locked';
    } else if (state.skipped[k]) {
      btn.classList.add('next');
      st = 'Enter your page URL';
    } else if (state.failed[k]) {
      btn.classList.add('locked');
      st = 'Not available';
    } else if (i < cur) { btn.classList.add('done'); st = 'Complete'; }
    else if (i === cur) { btn.classList.add('active', 'sel'); st = 'You are here'; }
    else if (i === cur + 1) { btn.classList.add('next'); st = 'Up next'; }
    else {
      // Every step stays reachable whenever a scan is not in flight, so calling
      // it "Locked" would be a lie about a button that works. Base styling (no
      // extra class) reads as "available, not current".
      st = 'View';
    }
    btn.querySelector('.sst').textContent = st;
  });
  document.querySelectorAll('[data-screen]').forEach(s => { s.hidden = s.dataset.screen !== move; });
  // The entry screen carries no step rail in the design; it appears once the
  // visitor is inside the report.
  const rail = document.querySelector('.railwrap');
  if (rail) rail.hidden = move === 'entry';
  syncStickyOffsets();
  scrollActiveStepIntoView();
}

window.addEventListener('resize', () => { syncStickyOffsets(); syncRailScroll(); });
const railEl = document.querySelector('.rail');
if (railEl) railEl.addEventListener('scroll', syncRailScroll, { passive: true });

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

// Merge the conversion-scan response into the last report and recompute the
// rollup client-side (same letter bands as the engine's grading.py).
function mergeConversionScan(resp) {
  const base = lastReport ? JSON.parse(JSON.stringify(lastReport)) : resp;
  if (base !== resp) {
    base.conversion = resp.conversion;
    if (resp.screenshots) {
      base.screenshots = Object.assign({}, base.screenshots || {}, resp.screenshots);
    }
    const pcts = SECTION_KEYS
      .map(k => base[k] && !base[k].skipped ? base[k].pct : null)
      .filter(p => typeof p === 'number');
    if (pcts.length) {
      const overall = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
      base.rollup = base.rollup || {};
      base.rollup.pct = overall;
      base.rollup.grade = letterFromPct(overall);
      base.rollup.pages = SECTION_KEYS.map(k => ({
        key: k,
        label: k.charAt(0).toUpperCase() + k.slice(1),
        grade: base[k] && !base[k].skipped ? base[k].grade : null,
        pct: base[k] && !base[k].skipped ? base[k].pct : null
      }));
      base.rollup.summary = (base.brand || 'Your site') + ' grades ' + base.rollup.grade +
        ' overall across ' + pcts.length + ' graded page' + (pcts.length === 1 ? '' : 's') + '.';
      const convFixes = ((resp.rollup || {}).priority_fixes || []);
      if (convFixes.length) {
        const fixes = ((base.rollup.priority_fixes || []).filter(f => f)).slice(0, 2);
        fixes.push(convFixes[0]);
        base.rollup.priority_fixes = fixes.map((f, i) => ({ rank: i + 1, title: f.title, detail: f.detail }));
      }
    }
  }
  return base;
}

// Scan 2 progress renders as a card under the gate, the same shape as the
// entry screen's scan card. The button only locks; it is not a status line.
function gateProgressCard() {
  const gate = document.querySelector('[data-screen="conversion"] .gate');
  if (!gate) return null;
  let card = document.getElementById('gate-progress');
  if (!card) {
    card = el('div', 'card no-print');
    card.id = 'gate-progress';
    card.style.cssText = 'padding:24px;margin-top:20px';
    const up = el('div', 'tup', 'Scanning your page');
    const ttl = el('div', 'ttl', 'Starting your scan…');
    ttl.id = 'gate-phase';
    ttl.style.marginTop = '8px';
    const track = el('div', 'track');
    track.style.marginTop = '18px';
    const fill = el('div', 'fill g-good');
    fill.id = 'gate-bar';
    fill.style.width = '0%';
    track.appendChild(fill);
    const note = el('div', 'fnote', 'This takes about 30 seconds. Keep this tab open.');
    note.style.marginTop = '12px';
    card.append(up, ttl, track, note);
    gate.appendChild(card);
  }
  return card;
}

function setGateScanning(on, message, pct) {
  const btn = document.getElementById('gate-submit');
  if (btn) {
    btn.disabled = on;
    btn.style.opacity = on ? '.6' : '';
    if (on) { btn.dataset.label = btn.dataset.label || btn.textContent; btn.textContent = 'Scanning…'; }
    else if (btn.dataset.label) { btn.textContent = btn.dataset.label; }
  }
  const card = gateProgressCard();
  if (!card) return;
  card.hidden = !on;
  if (!on) return;
  const phase = document.getElementById('gate-phase');
  if (phase && message) phase.textContent = message;
  const bar = document.getElementById('gate-bar');
  if (bar && pct != null) bar.style.width = clampPct(pct) + '%';
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
    const url = normalizeUrl(urlInput ? urlInput.value : '');
    if (!url) {
      if (urlInput) urlInput.focus();
      return;
    }
    postLead(email, url, state.overallGrade);
    try { sessionStorage.setItem('genie:lead', email); } catch (e) {}

    // Scan 2: the conversion critique runs on the URL entered HERE.
    setGateScanning(true, 'Starting your scan…', 2);
    const impl = PARAMS.get('stub') ? stubScan : runScan;
    impl(url, email, evt => setGateScanning(true, evt.message, evt.pct), 'conversion')
      .then(resp => {
        const merged = mergeConversionScan(resp);
        try { sessionStorage.setItem('genie:report', JSON.stringify(merged)); } catch (e) {}
        setGateScanning(false);
        showReport(merged);
        go('conversion');
      })
      .catch(err => {
        setGateScanning(false);
        const card = gateProgressCard();
        if (card) {
          card.hidden = false;
          card.style.boxShadow = 'inset 0 0 0 1px #E5484D';
          const up = card.querySelector('.tup');
          if (up) { up.textContent = 'Scan failed'; up.style.color = '#E5484D'; }
          const phase = document.getElementById('gate-phase');
          if (phase) phase.textContent = err && err.genie ? err.message : 'Something went wrong. Please try again.';
          const track = card.querySelector('.track');
          if (track) track.hidden = true;
          const note = card.querySelector('.fnote');
          if (note) note.textContent = 'Check the URL and submit again.';
        }
      });
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

const PARAMS = new URLSearchParams(location.search);

// The prototype's sample report is real-looking fiction. It may ONLY render when
// it was explicitly asked for (?demo=1 / ?mock=1). On any other visit a deep link
// like #copy or #cost must land on the entry screen, never on invented grades and
// dollar figures about a business we never scanned.
const DEMO_ALLOWED = PARAMS.get('demo') === '1' || PARAMS.get('mock') === '1';

// True when the page is allowed to show report screens at all: a real scan ran
// this session, or the sample was explicitly requested.
function reportUnlocked() {
  return state.hasReport || DEMO_ALLOWED;
}

// Print and deep-link behaviour both hang off this flag.
function setReportFlag() {
  document.body.classList.toggle('has-report', reportUnlocked());
}

// Modes:
//   (bare) / ?demo=1  untouched prototype sample data
//   ?mock=1           demo report rendered through the full derive/render pipeline
//   ?stub=1|fail      entry form runs a fake scan (success | error path)
//   live              entry form POSTs to the Genie engine (SSE)
//   ?r=<id>           dormant hook for shareable reports, pending backend
//                     GET /report/{id}; ignored for now.
(function boot() {
  setReportFlag();
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
  // Still nothing real to show: blank the sample out of every report screen.
  if (!state.hasReport) renderAwaitingScan();
})();

const h = location.hash.slice(1);
if (ORDER.includes(h)) move = h;
render();

// ---------------------------------------------------------------------------
// Cost & ROI: the visitor's own numbers, multiplied out. No invented benchmarks.
// ---------------------------------------------------------------------------

function money(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function renderRoi() {
  const vEl = document.getElementById('roi-value');
  const dEl = document.getElementById('roi-deals');
  const lEl = document.getElementById('roi-lift');
  if (!vEl || !dEl || !lEl) return;
  const value = Math.max(0, Number(vEl.value) || 0);
  const deals = Math.max(0, Number(dEl.value) || 0);
  const lift = Math.max(0, Number(lEl.value) || 0);

  const now = value * deals;
  const gain = now * (lift / 100);

  const liftv = document.getElementById('roi-liftv');
  if (liftv) liftv.textContent = lift + '%';
  const setText = (id, t) => { const n = document.getElementById(id); if (n) n.textContent = t; };
  const nowEl = document.getElementById('roi-now');
  const gainEl = document.getElementById('roi-gain');
  // Nothing here is measured, so nothing is shown until the visitor supplies the
  // inputs. A pre-filled "$20,000/mo" reads as a finding about their business.
  if (!value || !deals) {
    if (nowEl) nowEl.replaceChildren(document.createTextNode('—'));
    if (gainEl) gainEl.replaceChildren(document.createTextNode('—'));
    setText('roi-nowy', 'Fill in your numbers on the left.');
    setText('roi-gainy', 'Fill in your numbers on the left.');
    setText('roi-note', 'Put in your numbers above and this fills in.');
    return;
  }
  if (nowEl) { nowEl.replaceChildren(document.createTextNode(money(now)), el('span', null, '/mo')); }
  setText('roi-nowy', money(now * 12) + ' per year');
  if (gainEl) { gainEl.replaceChildren(document.createTextNode('+' + money(gain)), el('span', null, '/mo')); }
  setText('roi-gainy', '+' + money(gain * 12) + ' per year');

  // Say it in a unit a human feels, not just a number.
  let note;
  {
    const extra = gain / value;
    if (extra >= 1) {
      const n = Math.round(extra * 10) / 10;
      note = 'That is ' + (n === 1 ? 'one extra customer' : n + ' extra customers') + ' a month, from the same traffic.';
    } else {
      note = 'That is ' + money(gain * 12) + ' a year from the same traffic, without spending more on ads.';
    }
  }
  setText('roi-note', note);
}

['roi-value', 'roi-deals', 'roi-lift'].forEach(id => {
  const n = document.getElementById(id);
  if (n) n.addEventListener('input', renderRoi);
});
renderRoi();
