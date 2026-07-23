# Website Genie

The Website Genie grade report: the funnel where a prospect enters their solution-page URL and gets a graded breakdown across 6 "Genius Moves", ending in a call with Kevin. Started as a design prototype; now wired to render real reports from the Genie engine (factor8 `website-genie` pipeline).

**Live click-through: https://leanlabs0.github.io/website-genie/**

(Or clone the repo and open `index.html` in a browser. No build, no install, classic scripts only. `file://` works.)

- Design source of truth: [Claude Design project "Website Genie Output Wireframes"](https://claude.ai/design/p/329527b4-99dc-40ab-885f-f141bb267731?file=Website+Genie+Prototype.dc.html)
- Engine: factor8_app (`LeanLabs0/factor8-agent-sdk`, Fly app `factor8-agent-sdk`), route `POST /api/v1/brand-slug/public-scanner/website-genie`.

---

## Modes

| Mode | URL | What happens |
|------|-----|--------------|
| Demo | (bare) or `?demo=1` | Untouched prototype: hardcoded sample data, all steps clickable. `?demo=1` forces this even when a scanned report is in sessionStorage. |
| Mock | `?mock=1` | The demo report (`js/demo-data.js`) is rendered through the full derive/render pipeline. Must look identical to the demo. This is the frontend contract test. |
| Stub | `?stub=1` / `?stub=fail` | The entry form runs a fake scan (phase events, then the demo report / an error). For testing the scan UX without the engine. |
| Live | (bare, submit the entry form) | POST to the engine, SSE progress, report rendered on complete. Report persists in sessionStorage for the session. |

Planned: `?r=<report_id>` shareable links. The hook is dormant in `js/app.js` until the backend ships `report_id` plus `GET /report/{id}`.

## Two-scan flow

The report is produced by **two** scans, matching the original grader design where the landing-page critique was a separate step:

1. **Scan 1 (entry URL)** grades **Copy + Credibility** only. The request carries `scope: "main"`. The engine skips the Conversion agent, so that section ships with `skipped: true` and the rollup covers 2 pages (~40s).
2. **Scan 2 (Conversion screen)** runs only when the visitor enters their offer/landing URL into the email-gate card on step 3. The request carries `scope: "conversion"` and grades only that URL's Conversion critique (~30s). The frontend merges the result into the stored report and recomputes the rollup to 3 pages.

Until scan 2 runs, the Conversion screen shows the gate card with a short teaser (not a report), rail step 3 reads "Enter your page URL", and the Conversation rollup covers the 2 graded pages. `scope: "full"` (all three at once) exists for internal/testing use.

A `skipped: true` section is distinct from a failed one: it carries no `error` and is not counted as a failure in the rollup.

## Report contract

Single source of truth on the backend: `factor8_app` `src/factor8/website_genie/api_schemas.py`. The frontend's executable copy of the same shape, populated with the prototype's sample values, is `js/demo-data.js` (`window.GENIE_DEMO`). Field names must match exactly on both sides.

Shape summary:

- Top level: `version`, `scan_id`, `url`, `homepage_url`, `brand`, `generated_at`, `duration_ms`, `cost_usd`, `screenshots` (`home` / `solution`, each `hero_url`, `full_url`, `width`, `hero_height`, `full_height`), `meta` (`pages_analyzed`, `word_count`, `reading_level`).
- `copy`, `credibility`, `conversion` (one per graded page): `grade` (letter), `pct` (0-100 int), `verdict`, `summary`, `meta_tags[]`, `subscores[]` (`key`, `label`, `grade`, `pct`), `findings[]` (exactly 4: `n`, `title`, `detail`, `fix|null`, `grade`, `pct`, `pass`, `pin|null` with `page`, `x_pct`, `y_pct`), `strength`, `weakness`, `priority`, `overall_note`, `screenshot` (which screenshots entry feeds the image slot), `error` (string when the agent failed, else null).
- `credibility` extras: `proof_coverage` (`covered`, `total`, `label`, `pct`; rendered as the 5th bar) and `claims[]` (3-6 rows: `claim`, `current_proof`, `recommendation`).
- `conversion` extras: `offer_ladder[]`, always all 9 in fixed order (`demo_call`, `mini_class`, `workshop`, `template`, `checklist`, `toolkit`, `calculator`, `webinar`, `accelerator`), each `key`, `label`, `present`, `evidence`.
- `rollup` (page 6 Conversation): `grade`, `pct`, `pages[]` (`key`, `label`, `grade`, `pct`), `summary`, `priority_fixes[]` (3: `rank`, `title`, `detail`).

Color rule (computed client-side, not sent): `pct >= 70` good `#00D492`, `40-69` mid `#FFA600`, `< 40` bad `#E5484D`.

Partial failure: a failed section keeps its shape with `grade: null`, empty `subscores`/`findings` and an `error` message; the frontend keeps that step locked ("Not available") and renders the rest. All three failed becomes an SSE error.

## Screen map

One page, 7 screens toggled by the step rail. Each screen is deep-linkable by hash.

| # | Screen | Hash | What it shows |
|---|--------|------|---------------|
| 0 | Enter URL | `#entry` | Opt-in: URL field, "Reveal Your Genius Moves" CTA, scan progress/error cards, preview of the 6 moves |
| 1 | Copy | `#copy` | Grade dial, 5 sub-scores, 4 finding cards, strengths/weakness/priority row, teaser to next move |
| 2 | Credibility | `#credibility` | Grade dial, EEAT sub-scores + proof coverage bar, proof-point audit cards, claims table |
| 3 | Conversion | `#conversion` | Grade dial, email-gate card (yellow outline), offer-ladder grid, finding cards |
| 4 | Code | `#code` | 3 external tool cards: Schema Score, Google PageSpeed (link carries the scanned URL), Agent Ready |
| 5 | Cost & ROI | `#cost` | Placeholder screen, content not designed yet |
| 6 | Conversation | `#conversation` | Overall grade rollup, "what we'd fix first" priority list, booking card + scheduler slot |

## Interaction spec

- **Step rail** (sticky, under the top bar): each step shows one of 4 states: `done` (green check number), `active` (white number, highlighted), `next` (outlined number, "Up next"), `locked` (45% opacity). In demo/ready modes all steps navigate; once a real report is rendered, remaining steps read "View" (not "Locked", which is only the prototype's relative-position wording). While scanning, only the next upcoming step shows the live phase text ("Copy graded: B-"); the others read "Locked". The Conversion step reads "Enter your page URL" until scan 2 runs. Failed report sections stay locked with "Not available".
- **Entry form**: URL is normalized (scheme added if missing) and validated client-side before the scan starts.
- **Scan errors**: mapped to plain messages (429 high demand, 502 unreachable URL, 422 bad URL, timeout, network) in the `#scan-error` card with a retry button.
- **Email gate** (Conversion screen): captures the lead AND triggers scan 2 (the Conversion critique of the URL entered here). Submits to the engine's lead endpoint (non-blocking), then runs a `scope: "conversion"` scan with inline progress on the gate button, merges the result, and re-renders the Conversion screen and the rollup.
- **Funnel breadcrumb** (top bar): Opt In > Genie > Accelerator > Blueprint. Only "Opt In" navigates. Accelerator/Blueprint are future funnel stages, not built.
- **Teaser cards** at the bottom of each report screen advance to the next move.
- Navigation scrolls to top and updates the URL hash.

## Visual language

- Dark theme only. Page `#0D0D0D`, cards `#141414`, inset 1px border `#2B2B2B`, raised elements `#212121`.
- Grade colors: good `#00D492` / mid `#FFA600` / bad `#E5484D`. Gate/priority highlight: `#FDE68A` (pale yellow outline).
- Type: **Plus Jakarta Sans** 600/700 for headings, grades, labels; **Roboto** 400/500 for body. Loaded from Google Fonts.
- Grade dial: conic-gradient ring, percentage = `pct`. Sub-scores: 6px progress bars.
- All labels/eyebrows: uppercase, letter-spaced, 10-12px.

## Image slots

`<image-slot>` elements render an `<img>` when a `src` attribute is set (also late, after parse) and a placeholder label otherwise. Live reports fill `shot-copy`, `shot-cred`, `shot-conv` with the engine's full-page screenshots (`object-position: top`); finding pins position by the engine's `{x_pct, y_pct}` when present, else keep the prototype's default spots. Still needing real assets:

1. `kevin-photo`: Kevin Barber headshot, 220x220 rounded
2. `scheduler`: scheduling calendar embed (booking tool TBD)

## Open items (decisions needed before production)

- **CTA targets**: "Book a Website Makeover Call" / "Book with Kevin" buttons have no URL yet.
- **Cost & ROI screen**: placeholder only, needs design.
- **"Email me the full report (PDF)"**: print stylesheet exists (page-per-screen), no generation flow.
- **Public API key**: `API_KEY` in `js/app.js` is a placeholder; paste the low-privilege public scanner key before go-live.
- **Email gate scope**: v1 locks nothing; decide if it should gate pages 3-6 or the PDF.
- **Shareable report links**: pending backend `report_id` + `GET /report/{id}`; frontend hook (`?r=`) is dormant.

Resolved since the prototype handoff:

- ~~Agent Ready link: confirm final tool URL.~~ It is `isitagentready.com/{domain}`; the Code screen link carries the scanned host.
- ~~Email gate: form fields exist, no submit endpoint.~~ Wired to `POST /api/v1/website-genie/lead`.
- ~~Real grades/copy are hardcoded sample data. Production pulls from the Genie engine.~~ Wired: live scans render engine reports; the sample data now lives in `js/demo-data.js` as the demo/mock dataset.

## Files

```
index.html                 markup + styles (logic now external)
js/app.js                  nav, state machine, derive/render pipeline, SSE API client
js/demo-data.js            window.GENIE_DEMO: the full report contract with sample values
assets/leanlabs-icon.svg   Lean Labs mark (also inlined in the HTML)
```
