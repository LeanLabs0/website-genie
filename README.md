# Website Genie — Prototype (Design Handoff)

Working prototype of the Website Genie grade report: the funnel where a prospect enters their solution-page URL and gets a graded breakdown across 6 "Genius Moves", ending in a call with Kevin.

**Live click-through: https://leanlabs0.github.io/website-genie/**

(Or clone the repo and open `index.html` in a browser. No build, no install.)

- Design source of truth: [Claude Design project "Website Genie Output Wireframes"](https://claude.ai/design/p/329527b4-99dc-40ab-885f-f141bb267731?file=Website+Genie+Prototype.dc.html)
- This repo: the implemented, clickable version of that design. Single HTML file, vanilla JS, no dependencies.

---

## Screen map

One page, 7 screens toggled by the step rail. Each screen is deep-linkable by hash.

| # | Screen | Hash | What it shows |
|---|--------|------|---------------|
| 0 | Enter URL | `#entry` | Opt-in: URL field, "Reveal Your Genius Moves" CTA, preview of the 6 moves |
| 1 | Copy | `#copy` | Grade dial (B-), 5 sub-scores, 4 finding cards, strengths/weakness/priority row, teaser to next move |
| 2 | Credibility | `#credibility` | Grade dial (C), EEAT sub-scores, proof-point audit cards, claims table |
| 3 | Conversion | `#conversion` | Grade dial (C-), email-gate card (yellow outline), offer-ladder grid, finding cards |
| 4 | Code | `#code` | 3 external tool cards: Schema Score, Google PageSpeed, Agent Ready (open in new tab) |
| 5 | Cost & ROI | `#cost` | Placeholder screen — content not designed yet |
| 6 | Conversation | `#conversation` | Overall grade (C+), "what we'd fix first" priority list, booking card + scheduler slot |

## Interaction spec

- **Step rail** (sticky, under the top bar): each step shows one of 4 states — `done` (green check number), `active` (white number, highlighted), `next` (outlined number, "Up next"), `locked` (45% opacity). All steps are clickable in the prototype; in production, lock future steps until reached.
- **Funnel breadcrumb** (top bar): Opt In → Genie → Accelerator → Blueprint. Only "Opt In" navigates (back to entry). Genie is the current stage. Accelerator/Blueprint are future funnel stages, not built.
- **Teaser cards** at the bottom of each report screen advance to the next move.
- Navigation scrolls to top and updates the URL hash.

## Visual language

- Dark theme only. Page `#0D0D0D`, cards `#141414`, inset 1px border `#2B2B2B`, raised elements `#212121`.
- Grade colors: good `#00D492` · mid `#FFA600` · bad `#E5484D`. Gate/priority highlight: `#FDE68A` (pale yellow outline).
- Type: **Plus Jakarta Sans** 600/700 for headings, grades, labels; **Roboto** 400/500 for body. Loaded from Google Fonts.
- Grade dial: conic-gradient ring, percentage = grade. Sub-scores: 6px progress bars.
- All labels/eyebrows: uppercase, letter-spaced, 10–12px.

## Image slots (need real assets)

Marked with `<image-slot>` placeholders. Fill by setting a `src` attribute or swapping for `<img>`:

1. `shot-copy` — screenshot of graded homepage, with 4 numbered pins overlaid (pins already positioned)
2. `shot-cred` — screenshot of solution page, 4 pins
3. `shot-conv` — screenshot of landing page, 4 pins
4. `kevin-photo` — Kevin Barber headshot, 220×220 rounded
5. `scheduler` — scheduling calendar embed (booking tool TBD)

## Open items (decisions needed before production)

- **CTA targets**: "Book a Website Makeover Call" / "Book with Kevin" buttons have no URL yet.
- **Email gate** (Conversion screen): form fields exist, no submit endpoint.
- **Cost & ROI screen**: placeholder only — needs design.
- **"Email me the full report (PDF)"**: print stylesheet exists (page-per-screen), no generation flow.
- **Agent Ready link**: points at `agentready.com` per the design — confirm final tool URL.
- Real grades/copy are hardcoded sample data (Lean Labs' own site graded). Production pulls from the Genie engine.

## Files

```
index.html                 the whole prototype (markup + styles + logic)
assets/leanlabs-icon.svg   Lean Labs mark (also inlined in the HTML)
```
