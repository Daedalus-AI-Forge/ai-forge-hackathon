# Wishwell — product spec

> YC Consumer Mobile Hackathon, 2026-11-15. This is the source of truth for the product.
> Replaces the earlier "Raincheck" idea. See "Stack adaptation" at the bottom for how this maps onto our repo.

## The idea in one line
Toss a wish into the well. Your friends pass it on, ripple by ripple, until it reaches the one person who can make it come true.

## Why
Finding the right person is hard: a drumming buddy, a local in Tokyo, someone who has been to Antarctica. That person is usually only 2–3 friends away, but you can't see them. Wishwell turns "does anyone know someone who…" into a playful wish that travels through real friends, and every friend along the way vouches for the person before them. It's Six Degrees of Separation, made into a game.

## What you can wish for (non-professional only)
Every wish asks for a TYPE of person, never a specific named person.
1. Someone to do something with: "someone to jam on drums with"
2. A local: "a local in Tokyo to show me izakayas"
3. Someone who's been there: "someone who has been to Antarctica"
4. Someone in the same boat: "someone who also just moved to SF"

Format: [type of person] + [what to do] + [why]. An "AI polish" button rewrites the wish with a short, warm "why" so friends want to help.
Not allowed: job referrals, specific celebrities, dating (for now).

## How a wish travels
- A wish is a tree, not a single line. The wisher sends it to up to 3 friends. Each person who receives it can pass it to up to 3 more people. The limit is on purpose: pick the people most likely to know someone, don't spam.
- Everyone who receives a wish gets their own unique link. The link page contains the wish, the full chain of vouches above them, how many ripples (degrees) it has traveled, and the time left.
- Each holder chooses one of three actions:
  - "It's me!" – I'm the person you're looking for
  - "I know someone" – pass it on to up to 3 people
  - "Share to a group chat" – pass it to a group (marked "via group chat")
- Vouching is required to pass it on: you write one line vouching for the person who sent it TO YOU (not the original wisher, whom you may not know). The AI drafts it from 3 quick taps: how you know them, how long, one word (reliable / fun / kind / adventurous). You can edit it.
- So the person at the end receives a trust chain, for example:
  - Ben: "Amy is my college roommate, known her 10 years, super reliable."
  - Amy: "Louise is my co-founder, the most fun person I know."
  - Louise's wish: "Someone to jam on drums with. I bought a drum kit but I'm too shy to play alone."
- Wish lifetime: 48 hours to find the person. More than 6 ripples or no one found in 48 hours = the wish fades.

## Fewer ripples is better (branch race)
- Branches of the same wish race each other. The first branch to reach a confirmed match wins.
- 1 ripple = Gold wish, 2 = Silver, 3 = Bronze, 4–6 = Red.
- Winning branch gets the full reward. Everyone else who helped gets a participation reward and still gets to see the ending.
- If two branches reach the same person, the shorter branch wins.

## How a wish comes true (two stages)
1. Found: someone taps "It's me!" and writes a one-line intro, then the wisher confirms "Yes, it's you" (or "Not quite", and the wish keeps traveling). Both swap one contact (phone, WeChat or Instagram).
2. Granted: within 7 days the two meet, online or in person, and either one uploads a photo together (selfie in person or a video-call screenshot). The other person confirms, and the wish is GRANTED. Meeting in person is encouraged with a bonus, not required.

- The ending is LOCKED for everyone on the tree until the photo is uploaded: "Waiting for them to meet…". After that, everyone gets the reveal: the photo, a thank-you note from the wisher, and the full ripple map.
- On reveal, generate a "Wish Granted" polaroid card: photo + mini ripple map + a 2-sentence AI story ("Tossed in SF, passed through Shanghai, granted 2 ripples later at a café in the Mission."). Shareable.
- Optional fun stats: each holder's city is recorded. Show ripples (lower = better) and total distance traveled in km (just for fun). Badges: Boomerang (starts and ends in the same city), Around the World (3+ countries), Right Next Door (the match lives under 5 km from the wisher).

## Wishes and stars
- New user gets 1 wish. Making a wish costs 1 wish.
- Wish granted: wisher +1 wish (so a granted wish is free), the person found +1 wish (so they can make their own wish), each helper on the winning branch +1 star.
- Gold wish: everyone on the winning branch +1 star. Met in person: wisher and match +1 star each.
- No one found in 48 hours: the wisher gets the wish back. Found but no photo in 7 days: no refund, no rewards, ending stays locked.
- Stars can be used to:
  1. Trade 2 stars for 1 wish.
  2. "Ask the well" (1 star): the AI searches everything your network's vouches say and suggests who to send your wish to first, with a reason.

## What helpers get (beyond stars)
- Reputation that travels: every vouch you receive is saved. Your future wishes carry your vouches, so they travel further. Helping more makes your own wishes come true faster.
- "Me too": after a wish is granted, helpers can opt in to meet the match too (for example, if you also love drums).
- Owed a favor: the wisher owes you one. When you make a wish, it goes to people you helped first.

Reputation (vouches received, wishes helped) is shown on the profile and is separate from stars; it can't be spent.

## AI features (use an LLM)
1. Polish a wish into a short, warm story.
2. Memory jogger when you don't know who to pass to: "Drummers are often in band clubs, church groups, music majors, live house regulars. Who do you know there?"
3. Draft a vouch from 3 taps.
4. Draft the pass-on message in a playful tone: "A wish just landed with you: Louise wants someone to jam on drums with. Know anyone? It's 2 ripples in, 31h left."
5. Remember every vouch and auto-extract tags (music, Iceland, climbing). Use them to recommend who to pass to and for "Ask the well".
6. "How friends see you" card: a summary of vouches written about you ("3 friends say you're reliable, fun, and know everyone in music"). Shareable.
7. Write the 2-sentence story for the Wish Granted card.

Privacy: you can always see vouches about you. Vouches are only visible to people downstream on that wish. You can hide any vouch about you.

## Screens
Bottom tab bar, 4 tabs:
1. **The Well (home)**
   - Top: my active wish shown as a pool. The wish is a red coin in the center. Three dashed rings = 1st, 2nd, 3rd ripple. Red ripples animate outward from the center on a loop. Avatars of people currently holding the wish sit on their ring; new holders animate from the center out to their ring in real time.
   - Under the pool: wish text, "2nd ripple · 4 holding it · 31h left".
   - Big button: "Toss a wish".
   - Below: "Friends' wishes you can help" cards, each with wish, ripple count, time left, and [It's me] [I know someone] [Share to group].
2. **Toss a wish** (center + button): pick type → write wish → "AI polish" → "Ask the well" suggestion of who to send to first → pick up to 3 people → share.
3. **My wishes**: wishes I made and wishes I helped. Detail view = the wish tree (branches, avatars, cities, each vouch), live status, and after granting the unlocked ending + polaroid card.
4. **Me**: wishes left, stars, Wish Granted card collection (gold/silver/bronze), badges, reputation, "How friends see you", and My Wish Network.

**Pass-on page (NO login required) at `/w/:hopId`.** This is the most important page; most helpers never install the app.
- Shows: the wish, the full vouch chain above you, the ripple count, time left, and a small ripple animation.
- Three big buttons: It's me! / I know someone / Share to a group chat.
- "I know someone" flow: your name + city → vouch for the person who sent it to you (3 taps + AI draft) → who you're passing it to + 2–3 tags about them → AI drafts the message → generate the next link → native share sheet / SMS / copy link. Up to 3 people.
- After acting: "You're ripple #2 on this wish! We'll show you how it ends." Collect one contact to send the ending. Then a soft prompt to get the app.
- Rich link preview (Open Graph): "Louise made a wish: someone to jam on drums with · 2 ripples in".
- Keep it very light and fast: it opens inside iMessage, WeChat and Instagram in-app browsers.

## My Wish Network
People I passed wishes to, people who passed wishes to me, and people I met through a granted wish (not distant strangers on the tree). Each entry: name, contact channel, tags from vouches, wishes done together. One tap to send them a wish (prefilled SMS or copy link). This list plus vouches powers the AI recommendations.

## Data model
- `users(id, name, avatar, city, wishes_left, stars)`
- `wishes(id, creator_id, type, text, status[traveling|found|granted|faded], created_at, expires_at, meet_deadline, winning_hop_id, photo_url, met_in_person, tier)`
- `hops(id, wish_id, parent_hop_id, depth, holder_name, holder_user_id nullable, holder_contact, city, lat, lng, vouch_for_parent, pass_message, action[pass|group|its_me], created_at)`
- `vouches(id, about_name, about_contact, about_user_id nullable, by_name, text, tags[], wish_id)`
- `network(owner_id, person_name, person_contact, channel)`

Realtime updates on hops and wishes.

## Design
Warm, playful, calm like water. Cream background, one strong red accent for the wish coin and ripples (`#E63946`), soft rounded cards. The pool with ripples is the visual hero. Countdown in a bold monospace font. Mobile-first (max width ~430px). Sentence case everywhere. Copy is light and friendly, never needy: "Toss a wish", "Pass it on", "It's me!", "Wish granted".

## Seed data for the demo
15 users across SF, Shanghai, London, New York and Tokyo.
- A Silver "Boomerang" wish, already granted: SF → Shanghai → SF, "someone to jam on drums with", with a photo and a full vouch chain.
- A traveling wish: "a local in Tokyo to show me izakayas", 3 branches, 2 ripples, 20h left.
- A wish where two branches are racing, 1 hour left.

## Build order if time is short
1. Pass-on page + Toss a wish + The Well with live ripples.
2. Found → confirm → photo → ending unlock → Wish Granted card.
3. Branch race and tiers, wishes and stars.
4. Me tab, vouch memory, "How friends see you", My Wish Network, badges.

---

## Stack adaptation (how this maps onto our repo)

Hackathon rule: we must use **Capy** (agents), **Revyl** (device testing) and **Convex** (backend). So:

- **One Expo codebase, two surfaces.** The existing Expo SDK 58 + expo-router app is the native iOS/Android app (the 4 tabs; tested on device with Revyl). The pass-on page `/w/[hopId]` is an expo-router route that also ships as **web** (`expo export --platform web`) so it opens in iMessage/WeChat/Instagram in-app browsers without install. Keep that route light: no heavy native-only deps, works without login.
- **Backend = Convex.** Tables per the data model above (camelCase fields, Convex `_id`/`_creationTime`), indexes for every lookup, realtime via `useQuery`. Photos in Convex file storage. 48h fade / 7-day meet deadline via `ctx.scheduler`. Read `convex/_generated/ai/guidelines.md` before writing Convex code.
- **AI = OpenAI from Convex actions.** `OPENAI_API_KEY` is already set in the Convex dev deployment env. Call the Responses API (`POST https://api.openai.com/v1/responses`, model `gpt-5-mini`) with `fetch` inside an action; never ship the key to the client. Optional sponsor track: Supermemory for vouch memory (AI feature 5).
- **Identity for the demo:** anonymous device identity in the app (no OAuth). The pass-on page asks only for name + city + one contact.
- **Branding:** rename Raincheck → Wishwell everywhere (app name, slug, scheme `wishwell`, bundle id / package `com.theaiforge.wishwell`, Revyl config, README, hackathon.md, AGENTS.md title).
- **Revyl:** add stable `testID`s on key elements (pool, toss button, pass-on buttons, share link) so device tests can assert them.
