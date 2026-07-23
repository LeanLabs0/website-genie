// Website Genie — app logic (classic script, no build, no modules).

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
  raw = raw || demo;
  const screenshots = raw.screenshots || demo.screenshots || {};

  const view = { url: raw.url || demo.url || '', brand: raw.brand || demo.brand || '', sections: {}, rollup: null };

  SECTION_KEYS.forEach(key => {
    view.sections[key] = deriveSection(key, raw[key], (demo[key] || {}), screenshots);
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

function deriveSection(key, sec, demoSec, screenshots) {
  sec = sec || demoSec;
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
      ? { xPct: f.pin.x_pct, yPct: f.pin.y_pct } : null
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

function renderSectionScreen(key, sec) {
  const root = document.querySelector('[data-screen="' + key + '"]');
  if (!root || !sec || !sec.available) return;

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
      const pos = f.pin || defaults[i];
      if (pos) shot.appendChild(buildPin(f.n, pos));
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

// ---------------------------------------------------------------------------
// Navigation (step rail)
// ---------------------------------------------------------------------------

const ORDER = ['entry', 'copy', 'credibility', 'conversion', 'code', 'cost', 'conversation'];
let move = 'entry';

function render() {
  const cur = ORDER.indexOf(move);
  document.querySelectorAll('.step').forEach(btn => {
    const i = ORDER.indexOf(btn.dataset.step);
    btn.classList.remove('done', 'active', 'sel', 'next', 'locked');
    let st;
    if (i < cur) { btn.classList.add('done'); st = 'Complete'; }
    else if (i === cur) { btn.classList.add('active', 'sel'); st = 'You are here'; }
    else if (i === cur + 1) { btn.classList.add('next'); st = 'Up next'; }
    else { btn.classList.add('locked'); st = 'Locked'; }
    btn.querySelector('.sst').textContent = st;
  });
  document.querySelectorAll('[data-screen]').forEach(s => { s.hidden = s.dataset.screen !== move; });
}

function go(k) {
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
// Boot
// ---------------------------------------------------------------------------

const PARAMS = new URLSearchParams(location.search);

// ?mock=1: render the demo report through the full derive/render pipeline.
// Acceptance: output must be visually identical to the untouched static page.
if (PARAMS.get('mock') === '1' && window.GENIE_DEMO) {
  renderReport(deriveGenieView(window.GENIE_DEMO));
}

const h = location.hash.slice(1);
if (ORDER.includes(h)) move = h;
render();
