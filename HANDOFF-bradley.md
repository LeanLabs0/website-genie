# Delivery message to bradley

Hey bradley,

Handing over website genie. It is working end to end right now, not a mockup. Here is everything you need.

**Try it first**
https://leanlabs0.github.io/website-genie/
Put in any real solution page url. Takes about 30 seconds.

**What it does**
Someone drops in a url and gets a graded report across 6 steps. Copy, credibility, conversion, code, cost and roi, conversation. It is two scans, not one.

1. Step 0 scan grades copy and credibility. About 30 seconds.
2. Conversion is graded separately. It only runs when the visitor puts their offer or landing page url into the form on step 3. That is on purpose, it is a different page than the one they started with.

**The code**

Frontend, github.com/LeanLabs0/website-genie, branch main. Static site, no build, no install. Three files that matter, index.html for markup and css, js/app.js for logic, js/demo-data.js for the sample report. Deployed by github pages on push.

Backend, LeanLabs0/factor8-agent-sdk, branch website-genie-engine. Python, fastapi. Lives at src/factor8/website_genie/. Deployed to fly as factor8-agent-sdk, currently release v805.

**Heads up, that backend branch is not pushed yet.** 31 commits sitting on my machine. I will push it before you start, just do not go looking for it until I say it is up.

**The contract**
src/factor8/website_genie/api_schemas.py is the single source of truth for the report json. The frontend binds to those exact field names. If you change one, change both. js/demo-data.js is the frontend's executable copy of the same shape, so it doubles as a contract test.

Endpoint is POST /api/v1/brand-slug/public-scanner/website-genie
Body is {url, scope, email?, refresh?} where scope is main or conversion.
Send accept text/event-stream and you get progress events, otherwise plain json.

**Modes for testing without burning api spend**
?demo=1 shows the original sample data
?mock=1 renders the sample through the real render pipeline
?stub=1 fakes a scan so you can test the flow

**Design**
Chris's figma is the reference, file AEO-Designs, frames 241:211, 241:297, 241:674, 241:497. I matched the tokens already, fonts, colours, radii, the rail, the dial, the cards. Kevin's headshot is committed at assets/kevin-barber.png, pulled from that file.

**Things that are deliberately not finished, your call with kevin**

1. Booking goes to lean-labs.com/contact, not kevin's real calendar. It is one constant at the top of js/app.js called BOOKING_URL. Swap it and everything updates.
2. The scheduler panel on the last screen looks like chris's design but does not hold slots. Every day links out to the booking page and it says so plainly. I did not want a calendar that looks bookable and does nothing. If kevin has a real embed, that replaces it.
3. Screenshot pins are removed. The engine returns coordinates as a percentage of a full page capture, sometimes 15,000px tall, but we show a 340x200 cropped frame. The maths does not survive that, the pins all landed in the nav. Needs a per finding crop on the backend before they go back.
4. Schema score does not receive the url. Their page ignores the query param. Pagespeed and isitagentready both prefill fine.
5. The demo sample now grades D minus. That is honest, it uses the same curve as the live scanner. It used to use a friendlier one, which was a bad look since the file is public. If kevin wants a nicer showcase, raise the sample scores, do not add a second curve.

**Two things worth knowing before you change anything**

Reports are cached for 24 hours per url. Same url gives you the identical report back, marked cached, with the original timestamp kept. Send refresh true to force a fresh run. This was not an optimisation, it was the fix for the report contradicting itself between runs.

Grades are computed in python, never by the model. The agents only return numbers 0 to 100. grading.py owns every letter and the colours follow the letter, not a separate threshold. Keep it that way or letters and colours drift apart again.

**Quality bar**
Three testers walked this as real prospects and graded it. It went from D to B, C plus to A minus, and mobile and error handling both to A. Their notes are the reason for a lot of the odd looking decisions above, mostly around not showing anything we cannot stand behind. Worth a skim before you redesign something.

Shout if anything is unclear. Happy to walk it with you.

Thanks!
Ralph
