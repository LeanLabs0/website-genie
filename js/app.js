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

// A score we can actually print, or null. Null means "there is no number here",
// which is NOT zero. The old clampPct(null, null) returned 0, so a section
// nobody ran rendered as a hard-earned "N/A 0/100" with a red bar next to it.
// An ungraded thing never shows a number.
function pctOrNull(pct, gradeFallback) {
  if (typeof pct === 'number' && isFinite(pct)) return Math.max(0, Math.min(100, Math.round(pct)));
  if (gradeFallback && LETTER_PCT[gradeFallback] != null) return LETTER_PCT[gradeFallback];
  return null;
}

// Widths that are not scores (the scan progress bar) still need a number.
function clampPct(pct, gradeFallback) {
  const v = pctOrNull(pct, gradeFallback);
  return v == null ? 0 : v;
}

// One row of a score bar list. `graded` is false when the engine has no number
// for it, and then nothing numeric is ever built from this row.
function makeBar(label, grade, pct) {
  const p = pctOrNull(pct, grade);
  return {
    label: label,
    graded: p != null,
    display: p == null ? null : displayGrade(grade, p),
    pct: p
  };
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

// A fix line sometimes arrives cut off mid-clause ("...like 'publish-ready
// HubSpot pages in."). Intermittent, and being fixed engine-side, but a half
// sentence printed as advice is worse than no advice: the tells are an opened
// quote that never closes, or an ending on a dangling function word. The
// finding's own detail still renders either way.
const DANGLING_RE = /\b(?:in|on|at|to|for|with|of|and|or|the|a|an|by|from|into|about|as|that|which|like|than|so)\s*$/i;

function looksTruncated(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  const opens = (t.match(/(^|[\s(\[])["'“‘]/g) || []).length;
  const closes = (t.match(/["'”’]($|[\s.,;:)!?\]])/g) || []).length;
  if (opens > closes) return true;
  return DANGLING_RE.test(t.replace(/[.!?…]+$/, '').trim());
}

function deriveGenieView(raw) {
  const demo = window.GENIE_DEMO || {};
  // Only the demo/mock render (raw is the demo report itself, or nothing) may fall
  // back to demo section data. A live report that omits a section is a contract
  // violation and must be treated as unavailable, never backfilled with demo grades.
  const isDemo = !raw || raw === demo;
  raw = raw || demo;
  const screenshots = raw.screenshots || demo.screenshots || {};

  const meta = raw.meta || {};
  const view = {
    url: raw.url || demo.url || '',
    brand: raw.brand || demo.brand || '',
    // Counted from the data, never assumed. The sidebar used to state a fixed
    // "4 graded moves + 3 technical reports" that contradicted the summary
    // beside it.
    pagesAnalyzed: Array.isArray(meta.pages_analyzed) ? meta.pages_analyzed.length : 0,
    sections: {},
    rollup: null
  };

  SECTION_KEYS.forEach(key => {
    view.sections[key] = deriveSection(key, raw[key], (demo[key] || {}), screenshots, isDemo);
  });

  const rollup = raw.rollup || demo.rollup || {};
  const rollupPct = pctOrNull(rollup.pct, rollup.grade);
  const bars = (rollup.pages || []).map(pg => makeBar(pg.label, pg.grade, pg.pct));

  // Which moves carry no grade, and why. "Not graded yet" (the visitor has not
  // run that scan) and "we could not grade it" are different facts.
  const pending = [];
  const failedMoves = [];
  (rollup.pages || []).forEach((pg, i) => {
    if (bars[i] && bars[i].graded) return;
    const sec = pg.key ? view.sections[pg.key] : null;
    const label = pg.label || (pg.key ? pg.key.charAt(0).toUpperCase() + pg.key.slice(1) : 'One move');
    if (sec && sec.error) failedMoves.push(label);
    else pending.push(label);
  });

  view.rollup = {
    available: rollup.grade != null || (rollup.pages || []).length > 0,
    grade: rollupPct == null ? null : displayGrade(rollup.grade, rollupPct),
    pct: rollupPct,
    bars: bars,
    summary: rollupSummary(rollup.summary, {
      brand: view.brand, grade: displayGrade(rollup.grade, rollupPct), pct: rollupPct,
      bars: bars, pending: pending, failed: failedMoves
    }),
    fixes: orderFixes(rollup.priority_fixes || [], bars)
  };
  return view;
}

// ---------------------------------------------------------------------------
// Priority fixes: one list, one order, one "Start here".
//
// The engine writes the rank rationale INTO each fix ("Start here. This is the
// lowest-scoring finding (F) in your lowest-scoring move, Credibility."), and
// the conversion scan merges a fix that was also authored as a rank-1 line. The
// closing screen ended up saying "Start here" on cards 1 and 3, so the one
// screen whose job is to make the visitor book could not say what to do first.
// The rendered list is therefore re-derived here: worst move first, renumbered
// 1-2-3, and the rationale rewritten to match the rank each card actually gets.
// ---------------------------------------------------------------------------

const FIX_LEAD_RE = /^\s*(start here|next|then)\.\s+/i;

function parseFix(detail) {
  let text = String(detail || '').trim();
  const lead = text.match(FIX_LEAD_RE);
  let grade = null;
  let label = null;
  if (lead) {
    text = text.slice(lead[0].length);
    // The engine's rationale sentence, if it wrote one.
    const why = text.match(/^[^.]*\bfinding\b[^.]*\.\s*/i);
    if (why) {
      const g = why[0].match(/\(([^)]+)\)/);
      if (g) grade = g[1].trim();
      const byMove = why[0].match(/(?:move|page)[,:]?\s+([^.,]+)\.\s*$/i);
      const byIn = why[0].match(/\bin\s+([^.,]+)\.\s*$/i);
      if (byMove) label = byMove[1].trim();
      else if (byIn) label = byIn[1].trim();
      text = text.slice(why[0].length);
    }
  }
  return { action: text.trim(), grade: grade, label: label, hadLead: !!lead };
}

function fixRationale(rank, grade, label) {
  const g = grade ? ' (' + grade + ')' : '';
  const inMove = label ? ', in ' + label : '';
  if (rank === 1) {
    return 'Start here. This is the lowest-scoring finding' + g +
      ' in your lowest-scoring move' + (label ? ', ' + label : '') + '.';
  }
  if (rank === 2) return 'Next. The worst remaining finding' + g + inMove + '.';
  return 'Then. The worst finding left' + g + inMove + '.';
}

function orderFixes(rawFixes, bars) {
  const pctByLabel = {};
  bars.forEach(b => { if (b.graded && b.label) pctByLabel[String(b.label).toLowerCase()] = b.pct; });

  // The merge can hand us the same card twice. Two identical cards in a
  // three-item plan is not a plan.
  const seenTitle = {};
  const parsed = rawFixes.filter(f => f).map((f, i) => {
    const p = parseFix(f.detail);
    const key = p.label ? p.label.toLowerCase() : null;
    return {
      i: i,
      title: f.title || '',
      parsed: p,
      movePct: key != null && pctByLabel[key] != null ? pctByLabel[key] : null
    };
  }).filter(f => {
    const k = (f.title + '|' + f.parsed.action).toLowerCase().trim();
    if (seenTitle[k]) return false;
    seenTitle[k] = true;
    return true;
  });

  // Sort worst move first only when every card tells us which move it belongs
  // to. A half-known order is worse than the engine's own.
  const sortable = parsed.length > 1 && parsed.every(f => f.movePct != null);
  const ordered = sortable
    ? parsed.slice().sort((a, b) => (a.movePct - b.movePct) || (a.i - b.i))
    : parsed;

  return ordered.slice(0, 3).map((f, idx) => {
    const rank = idx + 1;
    const detail = f.parsed.hadLead
      ? (fixRationale(rank, f.parsed.grade, f.parsed.label) +
         (f.parsed.action ? ' ' + f.parsed.action : ''))
      : f.parsed.action;
    return { rank: rank, title: f.title, detail: detail };
  });
}

// A summary sentence that makes a countable claim about the report.
const COUNTABLE_RE = /\bgraded\s+(page|move)s?\b|\bweakest\b|\bstrongest\b|\bcould not be graded\b|\bnot graded\b/i;

function listLabels(items) {
  if (items.length < 2) return items[0] || '';
  return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
}

// The engine writes the rollup summary itself, and it writes "page" where it
// means "move": "Basecamp grades B- overall across 2 graded pages. Credibility
// is the weakest page at C+." Credibility is a MOVE, not a page, and that count
// is a count of moves, so the sentence contradicted the sidebar one inch away
// ("Covers 2 graded moves across 1 page"). Any summary that counts anything is
// rebuilt HERE, from the report itself, so every number and every noun on that
// screen comes from one place regardless of what the engine sent. A summary
// with no countable claim (the hand-written demo one) is left alone.
function rollupSummary(engineText, r) {
  const text = String(engineText || '').trim();
  const graded = r.bars.filter(b => b.graded);
  if (text && !COUNTABLE_RE.test(text)) return text;
  if (!graded.length) return '';

  const sorted = graded.slice().sort((a, b) => a.pct - b.pct);
  const worst = sorted[0];
  const best = sorted[sorted.length - 1];
  const n = graded.length;

  let s = (r.brand || 'Your site') + ' grades ' + r.grade + ' overall';
  if (r.pct != null) s += ' (' + r.pct + ' out of 100)';
  s += ' across ' + n + ' graded move' + (n === 1 ? '' : 's') + '.';
  if (n > 1 && worst.label !== best.label) {
    s += ' ' + worst.label + ' is the weakest move at ' + worst.display +
      '; ' + best.label + ' is the strongest at ' + best.display + '.';
  }
  if (r.pending.length) {
    s += ' ' + listLabels(r.pending) + (r.pending.length === 1 ? ' is' : ' are') + ' not graded yet.';
  }
  if (r.failed.length) {
    s += ' We could not grade ' + listLabels(r.failed) + ' this run.';
  }
  return s;
}

function deriveSection(key, sec, demoSec, screenshots, isDemo) {
  // Missing section on a live report => unavailable (empty section), never demo data.
  // Demo/mock fall back to the demo section so ?mock=1 stays identical to the demo.
  sec = sec || (isDemo ? demoSec : {});
  const skipped = !!sec.skipped;
  const available = !skipped && !sec.error && (sec.grade != null || (sec.subscores || []).length > 0);

  const bars = (sec.subscores || []).map(s => makeBar(s.label, s.grade, s.pct));
  if (key === 'credibility') {
    const pc = sec.proof_coverage;
    if (pc) {
      const cov = pctOrNull(pc.pct);
      bars.push({
        label: 'Proof coverage',
        graded: cov != null,
        display: cov == null ? null
          : (pc.label || ((pc.covered != null ? pc.covered : 0) + ' / ' + (pc.total != null ? pc.total : 0))),
        pct: cov
      });
    }
  }

  const findings = (sec.findings || []).map((f, i) => ({
    n: f.n != null ? f.n : i + 1,
    title: f.title || '',
    detail: f.detail || '',
    fix: f.fix && !looksTruncated(f.fix) ? f.fix : null,
    pass: !!f.pass,
    display: pctOrNull(f.pct, f.grade) == null ? null : displayGrade(f.grade, f.pct),
    pct: pctOrNull(f.pct, f.grade),
    pin: f.pin && typeof f.pin.x_pct === 'number' && typeof f.pin.y_pct === 'number'
      ? { page: f.pin.page != null ? f.pin.page : null, xPct: f.pin.x_pct, yPct: f.pin.y_pct } : null
  }));

  const shotEntry = screenshots[sec.screenshot] || null;

  const derived = {
    available: available,
    skipped: skipped,
    error: sec.error || null,
    grade: pctOrNull(sec.pct, sec.grade) == null ? null : displayGrade(sec.grade, sec.pct),
    pct: pctOrNull(sec.pct, sec.grade),
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
    // `evidence` explains WHY the engine judged an offer present. It is the most
    // interesting analysis in the product and it used to be dropped on the floor.
    derived.offers = (sec.offer_ladder || []).map(o => ({
      label: o.label || o.key || '',
      present: !!o.present,
      evidence: o.evidence || ''
    }));
    derived.offerHeadline = offerHeadline(derived.offers);
  }
  return derived;
}

// This headline is counted off the offer LADDER, a fixed list of 9 offer types.
// Written as "You only have one offer" it flatly contradicted a finding on the
// same screen ("Your free tier CTA gives hesitant visitors a safe next step"),
// so the screen refuted itself. It now says what it actually counted.
function offerHeadline(offers) {
  const n = offers.filter(o => o.present).length;
  const total = offers.length || 9;
  if (n === 0) return 'None of the ' + total + ' offer types show up on this page';
  if (n === 1) return 'One of the ' + total + ' offer types shows up on this page';
  return n + ' of the ' + total + ' offer types show up on this page';
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
  // Nothing was graded here, so there is no number and no bar. It used to
  // render "N/A 0/100" with a red track, which is a score, and a bad one.
  if (!bar.graded) {
    top.append(el('span', 'cn', bar.label), el('span', 'cstat', 'Not graded yet'));
    cbar.append(top);
    return cbar;
  }
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
  } else if (f.pct == null) {
    // No score means no chip with a number in it.
    rh.appendChild(el('span', 'nagrade', 'Not graded'));
  } else {
    // Same rule as the bars and the dials: the letter leads, the number backs
    // it up. The Conversation screen cites "the lowest-scoring finding (F)", so
    // the score behind that F has to be visible somewhere.
    const chip = el('span', 'rgrade t-' + gradeBand(f.display, f.pct));
    chip.append(el('span', 'rgl', f.display), el('span', 'rgn', f.pct + '/100'));
    chip.title = f.display + ' · ' + f.pct + ' out of 100';
    rh.appendChild(chip);
  }
  card.append(rh, el('div', 'rv', f.detail));
  if (f.fix) card.appendChild(el('div', 'rx', 'Fix · ' + f.fix));
  return card;
}

// ---------------------------------------------------------------------------
// Pins are gone, and here is why they are not coming back in this frame.
//
// The engine's x_pct/y_pct are percentages of the FULL-PAGE capture, which runs
// up to 15,816px tall. They were applied as CSS percentages of the .shot frame,
// which is 340x200 and shows the image with object-fit:cover + object-position:
// top. Two things break at once: the coordinate space is wrong (top: 9.1% of
// 200px is 18px, not 9.1% of the page), and the frame only shows the top ~5% of
// a tall page anyway, so most findings are not on screen at all. Rendered
// markup was top 9.1%, 3.3%, 13.1%, 2.2% and every left at 50%: four markers
// stacked inside the site's nav, two of them overlapping, pointing at things
// they were not about.
//
// Correct placement needs a per-finding crop, which is a different screenshot
// contract, so the honest move is no markers and no "and where" promise. The
// findings still say where they live in words. See README "Open items".
// ---------------------------------------------------------------------------

// The claim column is not a quotation. The engine shortens what it found (one
// row dropped "and creative breakthroughs that actually move the needle", the
// next dropped a middle clause) and the frontend has no way to tell a trimmed
// quote from a whole one. Quotation marks around a trimmed quote are the lie,
// so they come off and the column is headed "What the page claims".
function unquote(text) {
  return String(text == null ? '' : text)
    .trim()
    .replace(/^["'“”‘’]+/, '')
    .replace(/["'“”‘’]+$/, '')
    .trim();
}

function buildClaimRow(row) {
  const tr = document.createElement('tr');
  tr.append(el('td', 'claim', unquote(row.claim)), el('td', null, row.current_proof), el('td', null, row.recommendation));
  return tr;
}

function buildOffer(offer) {
  const div = el('div', 'offer ' + (offer.present ? 'have' : 'missing'));
  div.appendChild(el('span', 'ck', offer.present ? '✓' : '+'));
  div.appendChild(document.createTextNode(offer.label));
  div.title = offer.present
    ? (offer.evidence || 'Found on this page.')
    : 'Not found on this page.';
  return div;
}

// The evidence behind each offer we DID find, spelled out under the grid.
function buildOfferEvidence(offers) {
  const rows = offers.filter(o => o.present && o.evidence);
  if (!rows.length) return null;
  const wrap = el('div', 'offerev');
  // "and where" promised a location we no longer point at. The evidence lines
  // below still say where each offer lives, in words.
  wrap.appendChild(el('div', 'oevh', 'What we found'));
  rows.forEach(o => {
    const row = el('div', 'oevrow');
    row.append(el('span', 'oevl', o.label), el('span', 'oevd', o.evidence));
    wrap.appendChild(row);
  });
  return wrap;
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
  const inner0 = dialEl.querySelector('.in');
  // Nothing graded: an empty ring and words, never a letter over a 0.
  if (pct == null || grade == null) {
    dialEl.style.background = '#212121';
    if (inner0) inner0.replaceChildren(el('span', 'dna', 'Not graded yet'));
    return;
  }
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
    // No pins. A marker sitting on the wrong element is worse than no marker
    // at all, and in this frame every one of them was wrong (see the note above
    // buildPin's old home). Strip any left in the static markup.
    shot.querySelectorAll('.pin').forEach(p => p.remove());
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
    const evWrap = document.getElementById('offer-evidence');
    if (evWrap) {
      const built = buildOfferEvidence(sec.offers || []);
      evWrap.replaceChildren();
      if (built) evWrap.appendChild(built);
      evWrap.hidden = !built;
    }
  }
}

function renderRollup(rollup, pagesAnalyzed) {
  const root = document.querySelector('[data-screen="conversation"]');
  if (!root || !rollup || !rollup.available) return;
  // Undo the "run a scan first" panel now that there is a real rollup.
  restoreSection(root);
  const dial = root.querySelector('[data-dial="overall"]');
  if (dial) setDial(dial, rollup.grade, rollup.pct);
  const barsEl = root.querySelector('[data-bars]');
  if (barsEl) barsEl.replaceChildren.apply(barsEl, rollup.bars.map(buildBar));
  bindText(root, 'summary', rollup.summary);
  // Say what the report actually covers, counted from the report itself. This
  // line and the summary above it are built from the same numbers, so they
  // cannot disagree: moves are moves, pages are pages.
  const moves = rollup.bars.filter(b => b.graded).length;
  let scope = 'Covers ' + moves + ' graded move' + (moves === 1 ? '' : 's');
  if (pagesAnalyzed) scope += ' across ' + pagesAnalyzed + ' page' + (pagesAnalyzed === 1 ? '' : 's');
  bindText(root, 'scope', scope);
  const list = document.getElementById('fix-list');
  if (list) list.replaceChildren.apply(list, rollup.fixes.map(buildFix));
}

function renderReport(view) {
  SECTION_KEYS.forEach(key => renderSectionScreen(key, view.sections[key]));
  renderRollup(view.rollup, view.pagesAnalyzed);
  // The gate URL field is deliberately NOT prefilled with the page we already
  // scanned. Prefilling made the second scan require no new information, which
  // exposed the form as a pure email wall: the whole point is a DIFFERENT page,
  // the one where visitors actually convert.
  if (state.gateDoneUrl) renderGateConfirmation(state.gateDoneUrl);
}

// After the conversion scan succeeds the gate has done its job. Leaving the
// form on screen (with the URL field reset) left the visitor unable to tell
// whether anything happened.
function renderGateConfirmation(url) {
  const gate = document.querySelector('[data-screen="conversion"] .gate');
  if (!gate) return;
  gate.classList.add('done');
  gate.replaceChildren();
  const up = el('div', 'tup', 'Conversion critique complete');
  up.style.color = '#00D492';
  const t = el('div', 'ttl', 'We graded ' + url);
  t.style.marginTop = '8px';
  const note = el('div', 'fnote', 'Everything below is that page.');
  note.style.marginTop = '8px';
  gate.append(up, t, note);
}

// The printed report is the leave-behind, and seven pages of it carried no
// URL, no date and no grade: nothing said whose site it was or when we looked.
// Every printed page now leads with all three. Screen-invisible by design.
function renderPrintHeaders(report) {
  const screens = document.querySelectorAll('[data-screen]:not([data-screen="entry"]) .screen');
  if (!screens.length) return;

  let left = 'Website Genie sample report';
  let right = 'Not a real scan';
  if (state.hasReport) {
    left = 'Website Genie report · ' + (state.url || 'your site');
    const stamp = (report && report.generated_at) ? new Date(report.generated_at) : new Date();
    let when = '';
    try {
      when = stamp.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) { when = stamp.toDateString(); }
    right = 'Scanned ' + when;
    if (state.overallGrade) {
      right += ' · Overall ' + state.overallGrade +
        (state.overallPct != null ? ' · ' + state.overallPct + '/100' : '');
    }
  }

  screens.forEach(scr => {
    let head = scr.querySelector('.printhead');
    if (!head) {
      head = el('div', 'printhead');
      scr.insertBefore(head, scr.firstChild);
    }
    head.replaceChildren(el('span', 'phl', left), el('span', 'phr', right));
  });
}

function updateToolLinks(url) {
  if (!url) return;
  const ps = document.querySelector('[data-tool-link="pagespeed"]');
  if (ps) ps.href = 'https://pagespeed.web.dev/report?url=' + encodeURIComponent(url);
  // isitagentready.com takes the bare host as a path segment, not a query.
  const ar = document.querySelector('[data-tool-link="agentready"]');
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) {}
  if (ar) ar.href = host ? 'https://isitagentready.com/' + host : 'https://isitagentready.com/';
  // schemascore.ai: the path form (schemascore.ai/{host}) 404s, the query form
  // loads. Checked 2026-07-23: the tool does not yet read ?url= into its field,
  // so the visitor may still have to paste, but the link carries the page and
  // starts working the day SchemaScore honours it.
  const ss = document.querySelector('[data-tool-link="schema"]');
  if (ss) ss.href = 'https://schemascore.ai/?url=' + encodeURIComponent(url);
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
  overallPct: null,
  errorKind: null,                 // kind of the last scan error (429/502/422/timeout/...)
  hasReport: false,                // a real report has rendered at least once this session
  gateDoneUrl: null                // URL graded by scan 2, once it has succeeded
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

// Whenever the entry screen is showing progress or a problem, the decorative
// preview card gets out of the way. A visitor whose scan just failed should not
// be looking at a grade card next to the error.
function setEntryBusy(on) {
  const screen = document.querySelector('.entryscreen');
  if (screen) screen.classList.toggle('busy', !!on);
}

function showScanError(err) {
  state.mode = 'error';
  state.phaseText = '';
  setCtaScanning(false);
  state.errorKind = err && err.kind != null ? err.kind : null;
  state.unlockedThrough = 'conversation';
  const progress = document.getElementById('scan-progress');
  if (progress) progress.hidden = true;
  const title = document.getElementById('scan-error-title');
  if (title) title.textContent = 'Scan failed';
  const msg = document.getElementById('scan-error-msg');
  if (msg) msg.textContent = err.message;
  const retry = document.getElementById('scan-retry');
  if (retry) { retry.hidden = false; retry.textContent = 'Try again'; }
  const card = document.getElementById('scan-error');
  if (card) card.hidden = false;
  setEntryBusy(true);
  render();
}

// Nothing was sent, so claiming a scan failed would be a lie. The empty box and
// a typo are also different problems and get different messages.
function showEntryProblem(title, message) {
  state.mode = state.hasReport ? 'ready' : 'demo';
  state.errorKind = 'input';
  state.phaseText = '';
  setCtaScanning(false);
  const progress = document.getElementById('scan-progress');
  if (progress) progress.hidden = true;
  // Same rule as the gate: the alert node is revealed before its text changes,
  // so the message is announced and not just painted red.
  const card0 = document.getElementById('scan-error');
  if (card0) card0.hidden = false;
  const t = document.getElementById('scan-error-title');
  if (t) t.textContent = title;
  const msg = document.getElementById('scan-error-msg');
  if (msg) msg.textContent = message;
  // The field is right above and gets focus, so a "Try again" button here would
  // just be a second thing to ignore.
  const retry = document.getElementById('scan-retry');
  if (retry) retry.hidden = true;
  const card = document.getElementById('scan-error');
  if (card) card.hidden = false;
  setEntryBusy(true);
  const input = document.getElementById('entry-url');
  if (input) { input.classList.add('invalid'); input.setAttribute('aria-invalid', 'true'); input.focus(); }
  render();
}

function clearEntryProblem() {
  const card = document.getElementById('scan-error');
  if (card) card.hidden = true;
  const input = document.getElementById('entry-url');
  if (input) { input.classList.remove('invalid'); input.removeAttribute('aria-invalid'); }
  setEntryBusy(false);
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
  clearEntryProblem();
  setCtaScanning(true);
  setEntryBusy(true);
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
  state.overallPct = view.rollup && view.rollup.available ? view.rollup.pct : null;
  state.hasReport = true;
  setReportFlag();
  renderReport(view);
  renderRoiGrade();
  renderPrintHeaders(report);
  updateToolLinks(view.url);
  const progress = document.getElementById('scan-progress');
  if (progress) progress.hidden = true;
  clearEntryProblem();
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

// Steps where nothing is graded. Code says "We do not score this part" and
// Cost & ROI says "Fill in your numbers on the left": walking past either one
// finishes nothing, so neither may ever collect a green "Complete" check.
const UNGRADED_STEPS = { code: 'Tools to run', cost: 'Your numbers' };

// "Complete" means work actually finished here, not that you scrolled past it.
function stepDone(k) {
  if (UNGRADED_STEPS[k]) return false;
  if (!state.hasReport) return false;          // nothing has been graded at all
  if (k === 'entry') return true;              // a scan ran, so the URL step is done
  if (state.failed[k] || state.skipped[k]) return false;
  return true;
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
    } else if (i === cur) { btn.classList.add('active', 'sel'); st = 'You are here'; }
    else if (UNGRADED_STEPS[k]) {
      // Honest label instead of "Complete". Keeps the "up next" affordance.
      if (i === cur + 1) btn.classList.add('next');
      st = UNGRADED_STEPS[k];
    }
    else if (i < cur && stepDone(k)) { btn.classList.add('done'); st = 'Complete'; }
    else if (i === cur + 1) { btn.classList.add('next'); st = 'Up next'; }
    else if (i < cur && k === 'entry') { st = 'Start here'; }
    else {
      // Every step stays reachable whenever a scan is not in flight, so calling
      // it "Locked" would be a lie about a button that works. Base styling (no
      // extra class) reads as "available, not current".
      st = 'View';
    }
    btn.querySelector('.sst').textContent = st;
  });
  document.querySelectorAll('[data-screen]').forEach(s => { s.hidden = s.dataset.screen !== move; });
  // A fresh visitor gets the clean entry screen with no rail, as designed.
  // Once a report exists, hiding the rail on step 0 left the only route back
  // to it as the browser back button: the screen became a dead end.
  const rail = document.querySelector('.railwrap');
  if (rail) rail.hidden = move === 'entry' && !reportUnlocked();
  syncStickyOffsets();
  scrollActiveStepIntoView();
  syncHScroll();
}

// Any horizontally scrolling block (the claims table) advertises the fact.
function syncHScroll() {
  document.querySelectorAll('[data-hscroll]').forEach(box => {
    const wrap = box.parentElement;
    if (!wrap) return;
    const max = box.scrollWidth - box.clientWidth;
    wrap.classList.toggle('more-right', max > 4 && box.scrollLeft < max - 4);
  });
}

window.addEventListener('resize', () => { syncStickyOffsets(); syncRailScroll(); syncHScroll(); });
const railEl = document.querySelector('.rail');
if (railEl) railEl.addEventListener('scroll', syncRailScroll, { passive: true });
document.querySelectorAll('[data-hscroll]').forEach(box => {
  box.addEventListener('scroll', syncHScroll, { passive: true });
});

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
    const raw = (input ? input.value : '').trim();
    if (!raw) {
      showEntryProblem('Enter a URL first',
        'Nothing was sent. Put your product or solution page in the box above and the Genie will grade it.');
      return;
    }
    const url = normalizeUrl(raw);
    if (!url) {
      showEntryProblem('That URL does not look right',
        'We could not read “' + raw + '” as a web address. It should look like yourbrand.com/solution.');
      return;
    }
    startScan(url);
  });
}

const entryInput = document.getElementById('entry-url');
if (entryInput) {
  entryInput.addEventListener('input', () => {
    if (state.errorKind === 'input') clearEntryProblem();
  });
}

const retryBtn = document.getElementById('scan-retry');
if (retryBtn) {
  retryBtn.addEventListener('click', () => {
    clearEntryProblem();
    // A 422 means the URL itself is not scannable. Re-running state.url would
    // silently re-scan a stale URL and ignore the user's correction. Clearing
    // the box and focusing it is a visible outcome; leaving the broken URL sat
    // there looked like the button did nothing.
    if (state.errorKind === 422 || state.errorKind === 'input' || !state.url) {
      state.mode = state.hasReport ? 'ready' : 'demo';
      go('entry');
      const input = document.getElementById('entry-url');
      if (input) { input.value = ''; input.focus(); }
      render();
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
    // Scan 2 graded a page scan 1 never looked at. Without this the sidebar
    // kept saying "across 1 page" on a screen that names two of them.
    const seenPages = ((base.meta || {}).pages_analyzed || []).slice();
    ((resp.meta || {}).pages_analyzed || []).forEach(u => {
      if (u && seenPages.indexOf(u) === -1) seenPages.push(u);
    });
    base.meta = Object.assign({}, base.meta || {}, { pages_analyzed: seenPages });
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
      // Count the graded MOVES, which is what this number actually is. Calling
      // them pages contradicted meta.pages_analyzed. The wording is rebuilt
      // again at render time (rollupSummary), which is the single authority.
      base.rollup.summary = (base.brand || 'Your site') + ' grades ' + base.rollup.grade +
        ' overall (' + overall + ' out of 100) across ' + pcts.length +
        ' graded move' + (pcts.length === 1 ? '' : 's') + '.';
      const convFixes = ((resp.rollup || {}).priority_fixes || []);
      if (convFixes.length) {
        // Candidates only. Order, rank and rationale are re-derived in
        // orderFixes() so the rendered list has exactly one "Start here".
        const fixes = ((base.rollup.priority_fixes || []).filter(f => f)).slice(0, 2);
        fixes.push(convFixes[0]);
        base.rollup.priority_fixes = fixes.map(f => ({ title: f.title, detail: f.detail }));
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

// Inline validation with a visible message. Neither field was required and the
// submit is a type=button, so native validation never fired: bad input produced
// no border, no message and no request. Total silence at the highest-intent
// moment on the site.
// Sighted visitors got a red border and a red line; a screen reader user got
// silence. The field is marked invalid and the message lives in a role="alert"
// node, which has to be IN the accessibility tree before its text changes or
// the announcement never fires. So: unhide first, then write.
function setFieldError(inputId, errId, message) {
  const input = document.getElementById(inputId);
  const err = document.getElementById(errId);
  if (input) {
    input.classList.toggle('invalid', !!message);
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
  if (err) {
    if (message) { err.hidden = false; err.textContent = message; }
    else { err.textContent = ''; err.hidden = true; }
  }
  return !message;
}

['gate-email', 'gate-url'].forEach(id => {
  const n = document.getElementById(id);
  if (n) n.addEventListener('input', () => setFieldError(id, id + '-err', null));
});

const gateBtn = document.getElementById('gate-submit');
if (gateBtn) {
  gateBtn.addEventListener('click', () => {
    const emailInput = document.getElementById('gate-email');
    const urlInput = document.getElementById('gate-url');
    const email = (emailInput ? emailInput.value : '').trim();
    const rawUrl = (urlInput ? urlInput.value : '').trim();

    let emailMsg = null;
    // No PDF is generated and nothing is emailed, so this no longer promises a
    // delivery. The email is how Lean Labs follows up, and that is what it says.
    if (!email) emailMsg = 'We need an email so we know who to follow up with.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) emailMsg = '“' + email + '” is not a valid email address.';

    let urlMsg = null;
    const url = normalizeUrl(rawUrl);
    if (!rawUrl) urlMsg = 'Add the page you want graded. It is usually your landing or offer page.';
    else if (!url) urlMsg = 'We could not read “' + rawUrl + '” as a web address.';

    // Report BOTH problems at once rather than one field at a time.
    const emailOk = setFieldError('gate-email', 'gate-email-err', emailMsg);
    const urlOk = setFieldError('gate-url', 'gate-url-err', urlMsg);
    if (!emailOk || !urlOk) {
      const first = document.getElementById(emailOk ? 'gate-url' : 'gate-email');
      if (first) first.focus();
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
        state.gateDoneUrl = url;
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

// The grade is not an input to the arithmetic, so an A site and an F site get
// identical dollars out of it. It is tied to the scan by reference instead:
// the visitor's real overall grade is printed here, and the lift is named as
// their assumption rather than our finding. Hidden entirely until a scan runs,
// because there is no grade to name yet.
function renderRoiGrade() {
  const node = document.getElementById('roi-grade');
  if (!node) return;
  const grade = state.overallGrade;
  const pct = state.overallPct;
  if (!state.hasReport || !grade) { node.hidden = true; node.textContent = ''; return; }
  node.hidden = false;
  node.textContent = 'Your site graded ' + grade + (pct != null ? ' · ' + pct + '/100' : '') +
    '. That grade is not part of the sum below: the lift is your assumption, not something we measured.';
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
renderRoiGrade();
renderPrintHeaders(lastReport);
