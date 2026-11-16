# 2-minute live demo script

Chain: **Darren → Louise → Katie → Dazi test phone**. Seed and rehearse first: `docs/demo/team-chain.md`.
Wish: **"someone to jam on drums with in the Bay Area"** (mode *serious*, type *do together*).

| Time | Phone | Say | Show |
| --- | --- | --- | --- |
| 0:00-0:15 | Darren | "The person you need is 2-3 friends away. You just can't see them." | **Pool home** (night-garden fountain): my boats drifting, live ripples. |
| 0:15-0:45 | Darren | "I make a wish. The coach reads *my own* graph, the reasons I gave when I passed boats before." | **Toss** → type the wish → AI polish → **AI coach** suggests Louise with evidence ("plays bass in a Mission garage band"). Prefilled picks → **Text all N** → Messages opens; *I* tap Send. |
| 0:45-1:05 | Louise | "Louise opens it in the app, vouches for me, and passes it on." | Boat screen: wish, hops, time left → vouch for Darren → pass to Katie with a reason → share. |
| 1:05-1:30 | Katie | "Katie doesn't need the app at all." | Link in **Safari**: Louise's vouch at the top → **claim your free wish** (writes one, AI polish) → push to Dazi → contact → done screen "Your wish has set sail". |
| 1:30-1:45 | Dazi test phone | "Dazi is the drummer." | Link page → **It's me** → one-line intro + contact → "Waiting for the wisher to confirm". |
| 1:45-2:00 | Darren | "Darren confirms. The trust chain is how you get introduced." | **Claim confirm** in the app → vouch chain Dazi ← Katie ← Louise ← Darren → text Dazi from his own phone. Pool ripples update live. |

Closing line: "Every hop is a real friend vouching. AI drafts, people send. Built on Convex, tested on Revyl, built with Capy agents."

## Fallbacks
- **Sign-in fails / no SMS:** sign in with the demo number **+1 555 555 0100**, code **000000** (`DEMO_MODE=true` on dev).
- **Coach is slow or the AI is down:** it falls back to ranking only and still suggests Louise. Keep talking; don't wait.
- **Messages won't open / no signal:** copy the link from the share sheet and AirDrop it, or open the printed `/w/<hopId>` link from `node scripts/team-chain.mjs <url> --rehearse --fake`.
- **A teammate's phone dies:** skip that hop. Pass straight from Louise to the Dazi phone (the chain still ends in a match).
- **Live chain breaks:** switch to the web build on the laptop (`<deployment>.convex.site`) and walk the same link page.
- **Backup:** have the pre-recorded video (≤2 min) ready to play.
