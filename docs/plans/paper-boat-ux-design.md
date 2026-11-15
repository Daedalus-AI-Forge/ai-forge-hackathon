# Paper boat UX — design

Source: Louise's product notes (2026-11-15). This replaces the "Well / Toss a wish / My wishes / Me" app shell
with one loop the user can remember in a sentence: **push one paper boat a day, and see who it met the next morning.**

## Vocabulary (English UI copy; keep the existing visual style in `src/theme/tokens.ts`)

| Concept | UI word | Backend |
| --- | --- | --- |
| A wish travelling friend to friend | **paper boat** / boat | `hops` on a `wishes` row |
| Today's AI boat (absurd, everyone gets one) | **Today's boat** | the daily wish (`convex/daily.ts`) |
| A friend's real wish pushed to me | **{Name}'s real wish** | a held hop on a normal wish (`wishes.home.helpCards`) |
| My own real wish | **coin** ("toss a coin") | `wishes.toss`, credits = `users.wishesLeft` |
| Pass it on | **push** ("Push to someone") | `hops.act` + `hops.passTo` |
| It's me | **That's me** | `hops.itsMe` |
| Each pass | hop | `depth` |
| Status | Drifting / Landed / Granted / Faded | `traveling` / its_me found / `granted` / `faded` |

## Rules
- The water always has at least one boat: Today's boat. Friends' boats are extra and sort **before** it.
- Same action for both: pick a person, write a vouch, push. Absurd lives in Today's boat; serious lives in friends' real wishes.
- Every 5 boats pushed earns 1 coin (`BOATS_PER_COIN`, `users.boatProgress` 0–4, `hops.act` increments it).
- Voyage log every morning: where the daily boat I pushed most recently before today drifted, who found it.
- "Meeting" a finder of Today's boat means **seeing** them (name, city, one-line story), never exchanging contacts.
- Privacy: a finder chooses whether their name and city show (`hops.itsMe({ showNameAndCity })`); Me has a
  default toggle (`users.showInLogs`, missing = on).

## App shell — 3 tabs
| Tab | Route | Job |
| --- | --- | --- |
| Pool (home) | `src/app/(tabs)/index.tsx` | Today's to-do: voyage log, push boats, toss a coin |
| Voyages | `src/app/(tabs)/voyages.tsx` | Boats I pushed and coins I tossed: where they drifted, how they ended |
| Me | `src/app/(tabs)/me.tsx` | How friends see me, my network map, coins & progress, privacy |

No other entry points: every flow starts from a boat or the primary button on the Pool.

## 1. First open (`src/app/welcome.tsx`)
One screen: "Push a paper boat. Tomorrow, see who it met." with a boat drifting past a few avatars, then
"Start" → phone sign-in when `AUTH_ENABLED` (existing `/sign-in`), else straight to the Pool where Today's boat glows.
Shown once (AsyncStorage key `wishwell.onboarded`).

## 2. Pool (home), top to bottom
1. **Voyage log card** (`api.pool.voyageLog`, dismissible for the day): "Yesterday your boat passed through 4 people,
   from SF to Shanghai. It found Mia: <story>. You're only 4 people apart." + "Fastest line today: 2 hops" when `fastest`.
   Tap → that boat's detail (`/boat/[hopId]`).
2. **The water**: friends' boats first (tag "Amy's real wish"), then Today's boat (glow, absurd title). Pushed boats leave.
3. **Pool floor — my coins**: each traveling coin shows ripple count (= hops) and time left; granted coins glow.
4. **Edge of the pool — progress**: 5 dots ●●○○○ + "Push 3 more to toss a coin" / "You have a coin to toss".
5. **One primary button** (only one at a time):
   unpushed boat → "Push today's boat"; else coin available (`wishesLeft > 0`) → "Toss a coin";
   else no button, just "Come back tomorrow morning for your voyage log".

## 3. Boat → push (`src/app/w/[hopId].tsx`)
Card: title/wish on top, source under it ("Today's boat" / "Louise's real wish"), vouch chain as one vertical line
("Louise → Amy: my college roommate…"), two buttons **That's me** / **Push to someone**.
Push = 3 steps: (who are you, if unknown) → **vouch** for the sender (existing chips + AI draft; skipped for Today's boat
from the well) → **pick + send** (name, reason/tags, share link prefilled). Done: a prophecy line + "Progress x/5".

## 4. That's me
- Today's boat: one-line story + "Show my name and city" toggle → done, the boat lands.
- Real wish: one-line intro + contact → "Waiting for {creator} to confirm". (Confirm + photo come from PR #16.)

## 5. Toss a coin (`src/app/toss.tsx`)
Write one line (AI polish) → pick 1–3 starting friends (AI coach); if every pick shares one tag, hint
"Try a friend from a different circle — boats drift farther" → splash + prophecy → back to the Pool.

## 6. Confirm the finder
Entry only for now: a coin in status `found` shows "{Name} says they're who you're looking for" on its detail.

## 7. Voyages tab
List of boats I pushed (`api.pool.voyages`) and coins I tossed (`api.wishes.mine`). Card: mini route (city → city),
hop count, status pill. Detail: boats → `/boat/[hopId]` (chain, route, ending locked/unlocked);
coins → `/threads/[id]` (existing, relabelled).

## 8. Me tab
How friends see you (`api.pool.friendsSay`), network map (existing `MeNetwork`, deletable rows), coins & progress,
privacy toggle (`api.pool.setShowInLogs`), profile name/city.

## Out of scope for this pass
Push notifications, proof photo upload (needs `expo-image-picker` + a new dev build), confirm-finder backend
(PR #16), star tiers (PR #14).
