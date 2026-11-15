# Daily wish and the wish network

How the well designs its daily wish, what it learns from it, and how that feeds real wishes.

## Two layers

- **What players see:** a wish chain. A passes to B, B passes to C, each hop carries a vouch.
- **What the well keeps:** every pass is a tagged edge, "owner → person, tag" (`edges` table). Mia passing the
  "can't cross a street without bumping into someone" wish to Amy records `Mia → Amy: knows everyone`.

The second layer is not hidden. The pass-on page says what is remembered before you pass
("Why is the well asking?"), and Me → My wish network shows every edge with a Forget button.

## How the well designs a daily wish

It works backwards from what it wants to know (`convex/daily.ts`). A daily wish travels through six people,
so the well plans five passes, each with its own clue.

1. **Line up the gaps.** `PROBES` lists the kinds of friend the well wants to map (art scene, night owl, new in
   town, career leap, knows everyone, food scout, outdoors, music). `planChain` counts existing edges per tag
   and takes the five least mapped, in order. The least mapped goes first, because the first ripple has the
   most players. Ties rotate by day.
2. **Write the portrait and the trail.** The `generate` action gives the model the ordered chain and asks for
   one absurd sentence describing the single person at the end of it, one clue per pass that nudges the holder
   toward that kind of friend without naming the tag, and a plain-language reason shown to players. Without an
   API key the hand-written copy in `PROBES` is used.
3. **Read the answers off the passes.** Each holder sees only their clue ("Clue 2 of 5"). When they pass the
   wish to a named friend, `hops.passTo` writes the edge with that step's tag (`source: "daily"`) plus any
   tags the passer picked themselves (`source: "pick"`). One wish that completes teaches the well five
   different links for five different people. The sixth person sees "End of the trail. Is this you?".

Every edge is someone the passer was willing to message, so it is a close tie by construction.

Tags are limited to interests and habits. The prompt and the list both exclude anything a person could mind
being tagged with: health, money, beliefs, appearance, dating.

## Where it pays off

- **Ask the well** (`ai.askTheWell`, Toss a wish → Who should get it first?): for a real wish, the model reads
  the player's own edges and names the one friend to start with, with a reason drawn only from those tags.
- **Pass-on page for people without the app** (`src/app/w/[hopId].tsx`): three-step "How it works", a
  "Why it works" line with live counts from `stats.summary` (people linked, passes, vouches, wishes granted),
  and after helping, "Now make a wish of your own" as the reason to install.

## Not built yet

- Routes longer than one hop (Amy → Ben → Priya) need other people's edges; that needs their consent first.
- Edges from people who pass on the web without the app are stored by name only and are not linked to an
  account if they install later.
- `EXPO_PUBLIC_APP_URL` should point at the store listing; until then the install button opens the web app.
