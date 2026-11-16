# Submission checklist (vibeapps.dev, due 6:30 PM PT)

## Form fields
- [ ] **Name:** Wishwell
- [ ] **Tagline (≤60 chars), pick one:**
  - "Wishes that travel friend to friend until they come true" (56)
  - "Paper boats that find your person, one vouch at a time" (54)
  - "Six degrees of separation, made into a game" (43)
- [ ] **Description:** Fold a wish into a paper boat, like "someone to jam on drums with". An AI coach reads the reasons you gave when you passed boats before and suggests the 1-3 friends most likely to know someone. Each friend vouches for the last one and passes the boat on. Anyone can help from a link with no app, and gets a free wish of their own. A person always taps Send; the AI only drafts. Built on Convex, tested on Revyl, built with Capy agents.
- [ ] **Repo:** https://github.com/Daedalus-AI-Forge/ai-forge-hackathon
- [ ] **Demo video (≤2 min):** follow `demo-script.md`. Upload, then paste the link.
- [ ] **Screenshots:**
  1. Pool home (night-garden fountain with boats)
  2. Toss + AI coach suggestions with evidence
  3. "Text all N" with Messages prefilled
  4. Link page in Safari: vouch + free wish
  5. Link page done screen ("Your wish has set sail")
  6. Claim confirm with the vouch chain
  7. Me tab / community network map
- [ ] **Sponsors:** Capy, Revyl, Convex (details: `sponsors.md`)
- [ ] **Team:** Darren, Louise, Katie

## Pre-demo checklist
- [ ] Reseed: `npx convex run teamSeed:run '{...}'` with phone numbers passed at run time (never committed). Run it 5+ minutes before the demo so Supermemory indexes the edges. If `seed:run` was run, re-run `teamSeed:run`.
- [ ] Check with `npx convex run teamSeed:status '{}'`. Rehearse once with `node scripts/team-chain.mjs <url> --rehearse --fake`.
- [ ] Bound devices: if you rehearsed with `bindDevices`, re-run `teamSeed:run` without it.
- [ ] Test numbers: demo login +1 555 555 0100 / 000000 works (`DEMO_MODE=true` on dev).
- [ ] Twilio: account balance is topped up, and every demo phone is a verified recipient if the account is still on trial.
- [ ] `OPENAI_API_KEY` is set in the Convex env (the AI falls back without it, but the demo is weaker).
- [ ] Web build deployed: `scripts/deploy-web.sh`, then open a `/w/<hopId>` link in Safari once.
- [ ] Phones charged, Do Not Disturb on, brightness up, notifications from other apps muted.
- [ ] Developer Mode is on for the iPhones running the dev build, and the latest build is installed.
- [ ] Everyone is signed in with their own number before the demo starts.
- [ ] Backup video is downloaded locally on the presenting laptop.
