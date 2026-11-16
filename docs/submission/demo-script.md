# 2-minute live demo script: the tea ceremony

Chain: **Louise (California) → Katie (Osaka) → Darren (Kyoto) → Dazi (Kyoto, the tea teacher)**.
Seed first (members' phones at run time only):
`npx convex run teamSeed:run '{"global":true,"members":[{"key":"darren",...},{"key":"louise",...},{"key":"katie",...},{"key":"dazi",...}]}'`.
The seed gives Louise a daily-boat edge to Katie dated 21 days ago ("someone who has lived abroad", tags japan, osaka,
lived-abroad, traditional-arts-adjacent, reason "Spent two years in Osaka") and puts the members in California, Osaka and Kyoto.

## Exact inputs

| Step | Who | Type / tap exactly |
| --- | --- | --- |
| Wish | Louise | `Talk to someone who really practices the Japanese tea ceremony` (type *do together*, mode *serious*) |
| Coach | Louise | Tap **Who should get it first?** → one card: **Katie** · `Katie · Japan · from a daily boat 3 weeks ago` |
| Send | Louise | Keep only Katie → **Text** → Messages opens with the text → **Send** (one person) |
| Pass on | Katie (Safari) | AI card asks `Who do you know in Japan's traditional arts?` → name `Darren` → tap reason `Makes ceramics in Kyoto` |
| Pass on | Darren (Safari) | name `Dazi` → reason/vouch `My teacher Dazi has practiced tea for twenty years` |
| Claim | Dazi (Safari) | **That's me** → intro `That's me! I've practiced tea for twenty years.` → if a phone is asked: `+15555550100`, code `000000` |
| Confirm | Louise | Confirm the claim in the app → ending |

## Beats

| Time | Phone | Say | Show |
| --- | --- | --- | --- |
| 0:00-0:15 | Louise | "I want to talk to someone who really practices the Japanese tea ceremony. I don't know anyone." | Pool home → dive in → type the wish. |
| 0:15-0:35 | Louise | "Wishwell remembers how my friends helped before." | Coach suggests ONE name: **Katie · Japan · from a daily boat 3 weeks ago**. Three weeks ago a daily boat asked for someone who had lived abroad; I passed it to Katie, who spent two years in Osaka. |
| 0:35-0:45 | Louise | "One tap, and *I* send it." | Messages opens with the text written → Send. |
| 0:45-1:05 | Katie | "Katie doesn't need the app." | Link opens in Safari, no install: Louise's line about her and the wish. AI card: "Who do you know in Japan's traditional arts?" → types `Darren` → taps "Makes ceramics in Kyoto". |
| 1:05-1:15 | Louise | "Live, the boat crosses the Pacific." | Pass count goes 2 → 3; on the map the boat arcs California → Osaka. |
| 1:15-1:35 | Darren → Dazi | "Darren passes it to his teacher." | Darren passes to Dazi; Dazi taps **That's me** (tea for twenty years). |
| 1:35-1:50 | Louise | "Three passes, two countries, one cup of tea." | Ending screen: **California → Osaka → Kyoto, 3 passes**. |
| 1:50-1:55 | Katie | "And every helper gets their own wish." | Katie's page: "You can make a wish too" → **Get Wishwell** card. |
| 1:55-2:00 | — | "Every hop is a real friend vouching." | Close: many paper boats on water fanning out. |

## Fallbacks
- **Live chain breaks before the ending:** open the pre-completed copy of the same story (granted, meet-up photo, Dazi's claim):
  https://gallant-seal-635.convex.site/e/jn7fj07bhp4j56qdrseg3g3gfd8jbjzf
  (the wish id changes after every `teamSeed:run`; get the current one with `npx convex run teamSeed:teaStory`).
- **Coach or OpenAI is slow:** ranking is keyword-first from Louise's own edges, so Katie still comes first with the same line.
- **Link page AI is slow:** the Japan question and "Makes ceramics in Kyoto" are deterministic for tea/Japan wishes; no model call.
- **Sign-in fails / no SMS:** sign in with the demo number on the sign-in screen (`DEMO_MODE=true` on dev).
- **Messages won't open:** copy the link from the share sheet and AirDrop it.
- **Web build on the laptop:** https://gallant-seal-635.convex.site
- **Backup:** the pre-recorded video (≤2 min).
