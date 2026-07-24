// Website Genie demo report data.
// window.GENIE_DEMO is the FULL backend report contract (see README), populated with
// the prototype's hardcoded sample values (Lean Labs' own site graded).
// It doubles as the executable spec for the engine and as fallback defaults
// for deriveGenieView. Field names must match the backend contract exactly.
// Every letter here is computed from its pct with the SAME bands the engine
// uses (grading.py, mirrored in app.js LETTER_BANDS). This file is publicly
// readable on the Pages host, so any curve of its own would be a second,
// kinder grading scale sitting next to the real one in plain view.
window.GENIE_DEMO = {
  "version": "1.0",
  "scan_id": "wg_demo01",
  "url": "https://www.lean-labs.com/growth-marketing-team",
  "homepage_url": "https://www.lean-labs.com/",
  "brand": "Lean Labs",
  "generated_at": "2026-07-23T12:00:00Z",
  "duration_ms": 148000,
  "cost_usd": 0.41,
  "screenshots": {
    "home": {
      "hero_url": null,
      "full_url": null,
      "width": 1280,
      "hero_height": 900,
      "full_height": 6400
    },
    "solution": {
      "hero_url": null,
      "full_url": null,
      "width": 1280,
      "hero_height": 900,
      "full_height": 5200
    }
  },
  "meta": {
    "pages_analyzed": [
      "https://www.lean-labs.com/",
      "https://www.lean-labs.com/growth-marketing-team"
    ],
    "word_count": 1240,
    "reading_level": "Grade 9"
  },
  "copy": {
    "grade": "C+",
    "pct": 70,
    "verdict": "Your copy is clear and easy to read. However, it’s not designed for your buyers, or LLMs.",
    "summary": "We analyzed your home page & solution page. Your category and credentials stood out, but weren’t written for your buyers or AI search.",
    "meta_tags": [
      "Homepage + solution page",
      "1,240 words",
      "Reading level · Grade 9"
    ],
    "subscores": [
      {
        "key": "clarity",
        "label": "Clarity",
        "grade": "A-",
        "pct": 85
      },
      {
        "key": "message_market_fit",
        "label": "Message–market fit",
        "grade": "D",
        "pct": 58
      },
      {
        "key": "value_proposition",
        "label": "Value proposition",
        "grade": "C-",
        "pct": 63
      },
      {
        "key": "differentiation",
        "label": "Differentiation",
        "grade": "F",
        "pct": 48
      },
      {
        "key": "voice_emotion",
        "label": "Voice & emotion",
        "grade": "B",
        "pct": 78
      }
    ],
    "findings": [
      {
        "n": 1,
        "title": "You lack an intermediate CTA",
        "detail": "The hero offers three competing links and no single obvious next step.",
        "fix": "Lead with one primary action above the fold.",
        "grade": "D-",
        "pct": 55,
        "pass": false,
        "pin": null
      },
      {
        "n": 2,
        "title": "You overcome objections well",
        "detail": "Your FAQ and risk-reversal copy pre-empt the top buyer concerns before they’re asked.",
        "fix": null,
        "grade": "A",
        "pct": 91,
        "pass": true,
        "pin": null
      },
      {
        "n": 3,
        "title": "Your value proposition is “buried”",
        "detail": "The outcome appears below the fold, underneath your credentials and awards.",
        "fix": "Open with the result, a predictable pipeline.",
        "grade": "C-",
        "pct": 63,
        "pass": false,
        "pin": null
      },
      {
        "n": 4,
        "title": "Your differentiation is thin",
        "detail": "“HubSpot Diamond Partner” is a category, not a difference. Nothing only you could say.",
        "fix": "Make a claim unique to Lean Labs.",
        "grade": "F",
        "pct": 48,
        "pass": false,
        "pin": null
      }
    ],
    "strength": "Clarity & objection-handling",
    "weakness": "Buyer-outcome value prop",
    "priority": "Rewrite the hero headline",
    "overall_note": "Strong fundamentals; the goal is a buyer-first value proposition.",
    "screenshot": "home",
    "error": null
  },
  "credibility": {
    "grade": "D-",
    "pct": 55,
    "verdict": "Your website makes claims that can’t be substantiated, which hurts your credibility.",
    "summary": "An on-site proof-point audit of your solution page. For each claim we check whether it’s backed by a stat, whether the social proof is relevant, and whether that proof actually relates to the claim.",
    "meta_tags": [
      "On-site only",
      "Solution page",
      "EEAT"
    ],
    "subscores": [
      {
        "key": "experience",
        "label": "Experience",
        "grade": "B",
        "pct": 78
      },
      {
        "key": "expertise",
        "label": "Expertise",
        "grade": "A-",
        "pct": 85
      },
      {
        "key": "authoritativeness",
        "label": "Authoritativeness",
        "grade": "D",
        "pct": 58
      },
      {
        "key": "trust",
        "label": "Trust",
        "grade": "F",
        "pct": 48
      }
    ],
    "proof_coverage": {
      "covered": 1,
      "total": 6,
      "label": "1 / 6",
      "pct": 17
    },
    "findings": [
      {
        "n": 1,
        "title": "3 of 6 core claims have no proof",
        "detail": "“Predictable pipeline”, “used by high-growth teams”, and “2–3× faster” carry no stat or example.",
        "fix": "Add a sourced stat or named result to each claim.",
        "grade": "F",
        "pct": 32,
        "pass": false,
        "pin": null
      },
      {
        "n": 2,
        "title": "Your credential badges are strong",
        "detail": "Diamond Partner status and the client logo wall establish a solid baseline of authority.",
        "fix": null,
        "grade": "A",
        "pct": 88,
        "pass": true,
        "pin": null
      },
      {
        "n": 3,
        "title": "Your revenue stat has no source",
        "detail": "“$100M+ generated” appears with no source, date, or link, easy to doubt.",
        "fix": "Cite the source and timeframe.",
        "grade": "D-",
        "pct": 55,
        "pass": false,
        "pin": null
      },
      {
        "n": 4,
        "title": "No testimonials on your solution page",
        "detail": "Zero quotes tied to this specific offer; social proof lives elsewhere on the site.",
        "fix": "Add one named quote tied to the offer.",
        "grade": "F",
        "pct": 30,
        "pass": false,
        "pin": null
      }
    ],
    "claims": [
      {
        "claim": "“$100M+ in revenue generated”",
        "current_proof": "Stat, no source",
        "recommendation": "Add source + date + link"
      },
      {
        "claim": "“A predictable pipeline”",
        "current_proof": "None",
        "recommendation": "Add a named client result"
      },
      {
        "claim": "“Used by high-growth teams”",
        "current_proof": "Unnamed logos",
        "recommendation": "Name the logos / add a quote"
      }
    ],
    "strength": "Credential badges and logo wall",
    "weakness": "Unproven quantified claims",
    "priority": "Source the revenue stat",
    "overall_note": "Solid authority signals; the claims need proof attached.",
    "screenshot": "solution",
    "error": null
  },
  "conversion": {
    "grade": "F",
    "pct": 45,
    "verdict": "One of the nine offer types is on your page.",
    "summary": "On your growth-marketing-team solution page the demo is the only offer type we matched. Buyers who want a different conversion path have nothing else to take.",
    "meta_tags": [
      "Landing / solution page"
    ],
    "subscores": [
      {
        "key": "offer_diversity",
        "label": "Offer diversity",
        "grade": "F",
        "pct": 28
      },
      {
        "key": "solution_steps",
        "label": "On-page solution steps",
        "grade": "F",
        "pct": 34
      },
      {
        "key": "path_clarity",
        "label": "Path clarity",
        "grade": "D-",
        "pct": 55
      },
      {
        "key": "cta_strength",
        "label": "CTA strength",
        "grade": "C",
        "pct": 65
      }
    ],
    "offer_ladder": [
      {
        "key": "demo_call",
        "label": "Demo call",
        "present": true,
        "evidence": "Primary hero CTA; demo buttons repeat down the page."
      },
      {
        "key": "mini_class",
        "label": "Mini-class",
        "present": false,
        "evidence": null
      },
      {
        "key": "workshop",
        "label": "Workshop",
        "present": false,
        "evidence": null
      },
      {
        "key": "template",
        "label": "Template",
        "present": false,
        "evidence": null
      },
      {
        "key": "checklist",
        "label": "Checklist",
        "present": false,
        "evidence": null
      },
      {
        "key": "toolkit",
        "label": "Toolkit",
        "present": false,
        "evidence": null
      },
      {
        "key": "calculator",
        "label": "Calculator",
        "present": false,
        "evidence": null
      },
      {
        "key": "webinar",
        "label": "Webinar",
        "present": false,
        "evidence": null
      },
      {
        "key": "accelerator",
        "label": "Accelerator",
        "present": false,
        "evidence": null
      }
    ],
    "findings": [
      {
        "n": 1,
        "title": "You’re showing only one offer",
        "detail": "The demo call is the sole conversion point, nothing for visitors who aren’t sales-ready.",
        "fix": "Add a low-commitment offer (template, calculator, mini-class).",
        "grade": "F",
        "pct": 28,
        "pass": false,
        "pin": null
      },
      {
        "n": 2,
        "title": "Your page has no alternate conversion points",
        "detail": "No on-page steps or framework, the demo carries all the persuasion weight.",
        "fix": "Add a 3-step “how it works” on the page.",
        "grade": "F",
        "pct": 34,
        "pass": false,
        "pin": null
      },
      {
        "n": 3,
        "title": "Demo CTA is unmistakable",
        "detail": "For a ready-to-buy visitor, the primary action is obvious and repeated.",
        "fix": null,
        "grade": "A+",
        "pct": 92,
        "pass": true,
        "pin": null
      },
      {
        "n": 4,
        "title": "Users higher in the funnel are left out",
        "detail": "Visit → demo → exit. No nurture path captures the ~97% who don’t book.",
        "fix": "Route them to a lead magnet, then nurture.",
        "grade": "F",
        "pct": 45,
        "pass": false,
        "pin": null
      }
    ],
    "strength": "Unmistakable demo CTA",
    "weakness": "Single-offer conversion path",
    "priority": "Add a low-commitment offer",
    "overall_note": "The demo path works; everyone else needs a next step.",
    "screenshot": "solution",
    "error": null
  },
  "rollup": {
    "grade": "C-",
    "pct": 62,
    "pages": [
      {
        "key": "copy",
        "label": "Copy",
        "grade": "C+",
        "pct": 70
      },
      {
        "key": "credibility",
        "label": "Credibility",
        "grade": "D",
        "pct": 58
      },
      {
        "key": "conversion",
        "label": "Conversion",
        "grade": "F",
        "pct": 48
      }
    ],
    "summary": "Your site is clear and credible-looking, but it under-proves its claims and gives visitors only one way to act. Here’s what we’d fix first.",
    "priority_fixes": [
      {
        "rank": 1,
        "title": "Back your 3 unproven claims with sourced stats + one named result",
        "detail": "The quickest belief win. Add a source to the revenue stat and one client result to the solution page."
      },
      {
        "rank": 2,
        "title": "Add one low-commitment offer beyond the demo",
        "detail": "A template, calculator, or mini-class to capture visitors who aren’t ready to book yet."
      },
      {
        "rank": 3,
        "title": "Rewrite the hero to lead with the buyer’s outcome",
        "detail": "Open with the result, a predictable pipeline, before the credentials."
      }
    ]
  }
};
