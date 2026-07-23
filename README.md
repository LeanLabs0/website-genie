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

Color rule (computed client-side, not sent): **colour follows the letter, never a second threshold.** A/B good `#00D492`, C/D mid `#FFA600`, F bad `#E5484D`. Readouts that are not letters (proof coverage's "1 / 6") take the letter their `pct` would earn. Bar and dial *widths* are still `pct`.

There used to be a separate pct rule (`>= 70` good, `40-69` mid, `< 40` bad) running alongside the backend's letter bands, which paints an F orange at 58 and a C- green at 72. The two scales are now one.

Every grade is shown with the number behind it (`85/100` beside the letter on bars and dials, in the tooltip on finding chips). A letter on its own is an assertion the reader cannot check.

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
- **Email gate** (Conversion screen): captures the lead AND triggers scan 2 (the Conversion critique of the URL entered here). Both fields validate inline with a visible message before anything is sent. The URL field is deliberately **not** prefilled with the entry URL: this critique wants the page where visitors actually convert, which is usually a different page, and prefilling made the gate a pure email wall. Submits to the engine's lead endpoint (non-blocking), then runs a `scope: "conversion"` scan with progress in a card under the gate, merges the result, and re-renders the Conversion screen and the rollup. On success the form is replaced by a confirmation naming the URL that was graded.
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

`<image-slot>` elements render an `<img>` when a `src` attribute is set (also late, after parse). Live reports fill `shot-copy`, `shot-cred`, `shot-conv` with the engine's full-page screenshots (`object-position: top`). A section with no screenshot hides its frame entirely rather than showing an empty labelled box, and a screenshot that 404s after the retries collapses the same way (`.shot.noshot`).

**Pins are annotations, not decoration.** One is drawn only when the engine supplied real `{x_pct, y_pct}` for that finding AND the pin's `page` matches the screenshot this section is showing. No coordinates, no pin. The prototype's `DEFAULT_PINS` are gone: they sat at fixed CSS positions unrelated to the findings, so pin 4 landed on the nav while finding 4 was about a hero button.

The `kevin-photo` and `scheduler` slots are gone. They rendered the literal text "Photo of Kevin" and "Scheduling calendar" in empty grey boxes on the final screen. Kevin's slot is now a text block (name + role); the scheduler slot is the booking CTA plus what the call covers.

## Open items (decisions needed before production)

- **Kevin's calendar link**: `BOOKING_URL` at the top of `js/app.js` currently points at `https://www.lean-labs.com/contact` as a documented placeholder. Change that one line and all five booking CTAs follow. The same URL is duplicated on the `<a href>` tags so the buttons work without JS; update both when it changes.
- **Public API key**: `API_KEY` in `js/app.js` is a placeholder; paste the low-privilege public scanner key before go-live.
- **Email gate scope**: v1 locks nothing; decide if it should gate pages 3-6 or the print output.
- **Shareable report links**: pending backend `report_id` + `GET /report/{id}`; frontend hook (`?r=`) is dormant.
- **Schema Score deep link**: the Code screen passes `https://schemascore.ai/?url=<encoded>`. Verified 2026-07-23: that URL loads (the `/{host}` path form 404s) but SchemaScore does not yet read the param into its field. Recheck later.

## Honesty rules (do not regress)

These came out of prospect audits of the live site. Each one shipped as a fix:

1. **Sample data renders only behind `?demo=1` / `?mock=1`.** On any other visit, report screens show a "Run a scan to see this" panel. A deep link to `#copy` or `#cost` used to hand a fresh visitor a complete, unlocked report with letter grades and dollar figures about a business nobody scanned.
2. **Print carries the visitor's report and nothing else.** No entry hero, no decorative art, no forms, and nothing at all when no scan has run. It used to lead with the sample "B- / 1,240 words" card above the user's real grade.
3. **One grading scale.** Colour comes from the letter, `js/demo-data.js` letters are computed from their pct on the engine's bands, and the static sample markup matches. The demo file is publicly readable, so a second, kinder curve in it is a competitor's screenshot.
4. **Every grade shows its number.**
5. **Nothing invented on screen.** No fake grades in decoration, no prefilled dollar figures on Cost & ROI, no hardcoded findings in "why this move matters" copy, no pins without coordinates.
6. **Nothing fails silently.** The gate validates both fields inline; an empty entry box does not claim a scan failed.

Resolved since the prototype handoff:

- ~~Agent Ready link: confirm final tool URL.~~ It is `isitagentready.com/{domain}`; the Code screen link carries the scanned host.
- ~~Email gate: form fields exist, no submit endpoint.~~ Wired to `POST /api/v1/website-genie/lead`.
- ~~Real grades/copy are hardcoded sample data. Production pulls from the Genie engine.~~ Wired: live scans render engine reports; the sample data now lives in `js/demo-data.js` as the demo/mock dataset.
- ~~CTA targets: "Book a Website Makeover Call" / "Book with Kevin" buttons have no URL yet.~~ All five booking CTAs run off `BOOKING_URL`; only the destination is still a placeholder.
- ~~"Email me the full report (PDF)": print stylesheet exists, no generation flow.~~ The button calls `window.print()` and says "Print / save the full report", which is what it does.
- ~~Cost & ROI screen: placeholder only, needs design.~~ Built. It multiplies out the visitor's own numbers and starts empty, so nothing is asserted about their business until they type it.

## Files

```
index.html                 markup + styles (logic now external)
js/app.js                  nav, state machine, derive/render pipeline, SSE API client
js/demo-data.js            window.GENIE_DEMO: the full report contract with sample values
assets/leanlabs-icon.svg   Lean Labs mark (also inlined in the HTML)
```
