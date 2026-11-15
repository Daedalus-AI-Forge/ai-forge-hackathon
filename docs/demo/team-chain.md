# Team demo chain: Darren → Louise → Katie → Dazi

Four phones, four real team members, one wish that hops friend to friend until it reaches the
right person. Seed: `convex/teamSeed.ts`. Rehearsal: `scripts/team-chain.mjs`.

## 1. Seed (once, before the demo)

Phone numbers are passed at run time only. Never commit them.

```sh
npx convex run teamSeed:run '{"members":[
  {"key":"darren","name":"Darren","phone":"<DARREN_E164>"},
  {"key":"louise","name":"Louise","phone":"<LOUISE_E164>"},
  {"key":"katie","name":"Katie","phone":"<KATIE_E164>"},
  {"key":"dazi","name":"Dazi","phone":"<DAZI_E164>"}
]}'
```

What it does, per member:

- Finds or creates the `users` row for that phone and the Convex Auth `authAccounts` row
  (`provider: "phone"`, `providerAccountId` = the E.164 number), the same row phone sign-in
  looks up. If you already signed in, your existing user is reused.
- Writes 20 generated close friends (same names every run), each with job, habit and city
  tags plus a one-line reason, and the other three teammates. Every member is coach-ready
  (about 90 edges each).
- Writes the chain edges: Darren knows Louise (`music, band, sf, jam`), Louise knows Katie
  (`drums, music, oakland`), Katie knows Dazi (`drums, jam, berkeley`).

Re-running is safe. It replaces only this seed's rows (the graph wish tagged `teamKey` and
everything under it) and never touches other users or `seed:run` data. Note that `seed:run`
wipes every table, so run `teamSeed:run` again after any `seed:run`.

Run it at least a few minutes before the demo so Supermemory has indexed the teammate edges.

Other commands:

- `npx convex run teamSeed:status '{}'` lists who is seeded, without phone numbers.
- `npx convex run teamSeed:clear '{}'` removes the seed data and keeps the users.
- `npx convex run teamSeed:removeRehearsalWish '{"wishId":"<id>"}'` undoes one practice wish.

## 2. Live script

Everyone opens the app and signs in with their own number before you start.

| Step | Who | Does | Coach should suggest |
| --- | --- | --- | --- |
| 1 | **Darren** | New wish, mode *serious*, type *do together*: **"someone to jam on drums with in the Bay Area"**. Opens the coach. Picks **Louise**, reason: *"Plays bass in a Mission garage band — knows every musician in SF"*. Tosses and shares the `/w/<hopId>` link with Louise. | **Louise** |
| 2 | **Louise** | Opens the link **in the app** (that claims the hop for her account). Vouches for Darren, taps Pass, passes to **Katie**, reason: *"Took drum lessons with her; she knows every drummer in the East Bay"*. Shares the new link with Katie. | **Katie** |
| 3 | **Katie** | Opens the link in the app, vouches for Louise, passes to **Dazi**, reason: *"Drummer in a Berkeley jam collective — plays every week"*. Shares the link with Dazi. | **Dazi** |
| 4 | **Dazi** | Opens the link, taps **It's me**, writes a one-line intro and a contact. Darren's wish is found. | — |

Today the coach panel only shows on the toss screen, so Darren sees step 1 live. For steps 2 and 3
the rehearsal script checks `ai.coach` for Louise and Katie through the API.

## 3. Rehearse

```sh
# Against fake +1555 members (seeds them, rehearses, deletes them). Refuses to run if real members are seeded.
node scripts/team-chain.mjs https://<deployment>.convex.cloud --rehearse --fake

# Against the real seeded members: seed with "bindDevices": true first (see warning below).
node scripts/team-chain.mjs https://<deployment>.convex.cloud --rehearse
```

The script acts as each member through the public API using the device id `dev_team_<key>`,
which `teamSeed.run` binds only when called with `"bindDevices": true`. It prints the `/w/<hopId>`
link for each step and PASS/FAIL for each coach assertion. Then it removes the rehearsal wish,
its hops, vouches and edges, and gives Darren back his wish. The seed stays.

**Warning:** `dev_team_<key>` is a guessable id. While it is bound, anyone who knows it can act as
that member and read their user row, phone number included, through `users.me`. After a
rehearsal, re-run `teamSeed:run` without `bindDevices` to unbind the ids.

## Why the chain wins

The demo wish tokenizes to `jam, drum, bay, area`. Keyword ranking scores a tag match +2 and each
matching reason word +1, so each chain person outscores everyone else in that owner's graph. Generated
friends for Darren, Louise and Katie never get music habits. Generated friends are not indexed in
Supermemory. When Supermemory has hits, `graphRank` ranks by semantic score alone, and in a rehearsal
20 loosely similar friends ("San Mateo (in the Bay Area)", "board game nights") outranked the chain.
Louise also carries a `jam` tag on top of `music, band, sf`, because none of those three words occur
in the wish.
