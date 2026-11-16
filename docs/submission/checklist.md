# Submission checklist (vibeapps.dev, due 6:30 PM PT)

## Final paste-ready block
Copy each field into the form as is. Sponsor details and file pointers: `sponsors.md`.

```text
Name: Wishwell

Tagline: Wishes that travel friend to friend until they come true

Description:
Wishwell turns "does anyone know someone who..." into a lantern paper boat. Louise wishes to try a Japanese tea ceremony. Her AI coach suggests Katie, whose daily boat she passed 3 weeks ago. Katie opens a no-app link page, vouches, and passes it to Darren, whose friend Dazi says "That's me": California to Osaka to Kyoto in 3 passes. Anyone helping from a link gets a free wish of their own. You meet, snap a photo, and the wish is GRANTED. On the World tab, a real-geography globe, every completed wish can "Fly the route" in 3D while AI bots keep wishes travelling across 18 countries. A person always taps Send; the AI only drafts.

How we used Capy:
- Capy agents built core PRs: scaffold, pass-on page, phone auth, relation graph + AI coach, paper boat UX.
- Workflow: brainstorm, plan, subagent-driven build; cheap implementer subagents on fresh machines, parent thread reviews every task.
- Capy may squash-merge clean capy/* PRs on its own; human PRs and anything touching secrets still need a person.

How we used Revyl:
- iOS and Android dev/preview build profiles run on Revyl devices against our dev Convex deployment.
- A device smoke test walks the Pool and toss flow on an iOS device.
- A native launch-config module signs Revyl device sessions in without SMS; key elements carry stable testIDs.

How we used Convex:
- The entire backend, no other server: realtime database, live Pool updates, phone OTP auth, and file storage for meet-up photos.
- Scheduler and crons send SMS and reminders; rate limiter guards OTP and AI calls; actions keep OpenAI/Twilio keys server-side.
- Static hosting serves the no-app link page and share previews from gallant-seal-635.convex.site.

Team: Darren, Louise, Katie (design by Katie-Lan and Louise)

Repo: https://github.com/Daedalus-AI-Forge/ai-forge-hackathon

Live link (no-app link page): https://gallant-seal-635.convex.site

Demo ending (granted tea-ceremony wish): https://gallant-seal-635.convex.site/e/jn72jhcrt9geza5qs4vk47w5eh8jaae8
```

## Still to attach
- [ ] **Demo video (≤2 min):** follow `demo-script.md`. Upload, then paste the link.
- [ ] **Screenshots** (save to `docs/submission/screens/`):
  1. `pool.png`: night-garden fountain home, then the dive into the pool
  2. `toss.png`: night sheet with AI coach picks and evidence, "Text all N"
  3. `link.png`: no-app link page in Safari (vouch + free wish)
  4. Meet-up photo and the GRANTED reveal
  5. World globe: a completed wish flying its route, with the meet-up photo

## Pre-demo checklist
- [ ] Reseed: `npx convex run teamSeed:run '{...}'` (add `"global": true` for the worldwide network map) with phone numbers passed at run time (never committed). Run it 5+ minutes before the demo so Supermemory indexes the edges. If `seed:run` was run, re-run `teamSeed:run`.
- [ ] Check with `npx convex run teamSeed:status '{}'`. Rehearse once with `node scripts/team-chain.mjs <url> --rehearse --fake`.
- [ ] Bound devices: if you rehearsed with `bindDevices`, re-run `teamSeed:run` without it.
- [ ] Test numbers: the demo login shown on the sign-in screen works (`DEMO_MODE=true` on dev).
- [ ] Twilio: account balance is topped up, and every demo phone is a verified recipient if the account is still on trial.
- [ ] `OPENAI_API_KEY` is set in the Convex env (the AI falls back without it, but the demo is weaker).
- [ ] Web build deployed: `scripts/deploy-web.sh`, then open a `/w/<hopId>` link in Safari once.
- [ ] Phones charged, Do Not Disturb on, brightness up, notifications from other apps muted.
- [ ] Developer Mode is on for the iPhones running the dev build, and the latest build is installed.
- [ ] Everyone is signed in with their own number before the demo starts.
- [ ] Backup video is downloaded locally on the presenting laptop.
