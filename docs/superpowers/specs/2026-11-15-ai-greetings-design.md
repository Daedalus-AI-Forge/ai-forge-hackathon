# Wishwell AI greetings: pass-on, vouch, intro, OG preview

Date: 2026-11-15. Status: proposal (research-grounded). Scope: copy prompts only; no send path changes. The AI drafts, a human taps Send.

## Evidence (accessed 2026-11-15)
| # | Finding | Source |
|---|---|---|
| E1 | Chains that worked ran "primarily through intermediate to weak strength ties", "disproportionately relies on professional relationships", don't need hubs, and "success depends sensitively on individual incentives." | Dodds, Muhamad, Watts, *Science* 2003, abstract via https://api.crossref.org/works/10.1126/science.1081058 |
| E2 | Repo note: "similar profession" was the reason in 37.4% of successful forwards vs 8.0% of failed ones; "lots of friends" 1.6% vs 8.2%. | `docs/superpowers/specs/2026-11-15-wishwell-agent-graph-design.md` (taken from the paper body; not re-checked this session) |
| E3 | Double opt-in: "ask each of them to opt-in to the introduction before making it." | https://avc.com/2009/11/the-double-optin-introduction/ |
| E4 | iMessage preview = `og:title` + domain + `og:image`. "Titles should be short and specific"; "Do not put the site name … in the og:title"; "Avoid text in preview images"; no JS or meta-refresh redirects. | Apple TN3156, https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages |
| E5 | SMS: 160 chars GSM-7, or 70 chars UCS-2. One emoji or curly quote switches the whole body to UCS-2. | https://www.twilio.com/docs/glossary/what-sms-character-limit |
| E6 | WeChat 诱导分享 bans "分享后方可进行下一步操作", any copy that says or hints "分享给好友", and reward or task-based sharing (红包/助力/集卡). Penalty: links blocked. | 2016 rule text as quoted by https://www.ithome.com/0/217/760.htm ; 2026 Yuanbao case https://www.thepaper.cn/newsDetail_forward_32530069 (secondary sources, not the official page) |

**Inference** from E1, E2 and E3: one concrete, profession- or skill-shaped "why you" works better than flattery or "you know everyone". Ask, don't assume, which is the double opt-in idea. Never add an incentive to forward. **Unknown:** how many characters an iOS notification banner shows (Apple publishes no number). Put the hook in the first ~70 chars.

## Shared rules (append to `STYLE` for all 4 texts)
`Use ONLY the facts in FACTS. Never invent jobs, places, history or feelings. Never mention tags, graphs, apps' data or anyone not named in FACTS. No pressure: no deadlines-as-threats, no "forward to unlock", no rewards for sharing, no "share with friends". Plain ASCII quotes. At most one emoji, never in the first 70 characters. Output only the text.`
Post-checks in code: strip quotes; drop the output if it names a person who is not in FACTS, if it contains a digit that is not in FACTS, or if it matches `/unlock|forward this|share (this|with)|红包|助力/i`. Then use the fallback.

## Privacy boundary
These facts may appear in text **to** person X: the wish text, the wish-maker's first name, the sender's own reason about X (`edges.reason` / `hops.introVouch`, where owner = sender), the chain's first names plus depth, and city if `itsMePublic !== false`. These must never appear: tags or reasons that other users wrote about third parties, `recipientTags` (they are the sender's private labels; today's prompt leaks them as "they're into"), phones, `claimAnswers`, and vouches about upstream people. Vouches flow downstream only. The intro (#3) may quote the claimer's own `itsMeIntro` because they wrote it for the wish-maker.

## 1. Pass-on message (`ai.draftPassMessage`), sender to holder, with link
Inputs: `senderName`, `holderName`, `wisherName`, `wishText`, `depth`, `introVouch` (the sender's reason about the holder), chain first names (new field: `chain` = holderNames of ancestor hops). Drop `tags` and the `hoursLeft` urgency.
User template: `FACTS: from=<sender>; to=<holder>; wisher=<wisher>; wish="<wish>"; why_you="<introVouch>"; chain=<A → B → you>. Write a text from <sender> to <holder>, max 2 sentences, max 200 chars. Sentence 1: the wish in plain words plus why_you, in the sender's voice. Sentence 2: ask if it's them or someone they know. No link (the app appends it).`
Examples (Louise to Katie, chain Darren → Louise → Katie):
- "Katie! Darren's looking for someone to jam on drums with in the Bay. You took drum lessons with her and know every drummer in the East Bay. Is it you, or someone you'd ask?"
- "Darren wants a drum jam buddy in the Bay Area. I thought of you since you know every East Bay drummer. Anyone come to mind?"
- (Katie to Dazi) "Dazi, a friend of a friend wants someone to jam on drums with in the Bay. You play every week with the Berkeley collective, so this might be you?"
Fallback: `<wisher> is looking for <wish gist>. <introVouch ? "I thought of you: " + introVouch + "." : "">` + ` Is it you, or someone you know?`

## 2. Vouch (`linkAi.vouchFor`), one line at the top of the holder's link page
Inputs: `name`, `relation`, `reason` (the sender's own words, required as the only source of facts). Keep the current prompt and add: `Keep the reason's concrete detail (instrument, place, group). First person from the sender. Max 120 chars. Don't add praise words (amazing, best, legend).`
Examples: "Louise plays bass in a Mission garage band and knows every musician in SF." / "Katie took drum lessons with her, so she knows every drummer in the East Bay." / "Dazi drums in a Berkeley jam collective every single week."
Fallback: unchanged (`<name> is my <relation>: <reason>`).

## 3. Intro after a confirmed claim (`linkAi.introMessage`), wish-maker to claimer
Inputs: `wisherName`, `wishText`, the claimer's `holderName`, `itsMeIntro`/`claimAnswers[0]` (the claimer's own words), the full chain of first names, and the claimer's parent `introVouch` (it is about the claimer, so it is OK to show the claimer).
User template: `FACTS: me=<wisher>; you=<claimer>; wish="<wish>"; chain=<Darren → Louise → Katie → Dazi>; vouch="<introVouch>"; you_said="<itsMeIntro>". Write a first text from me to you, max 220 chars. Thank them by name for the chain (who connected us), mention one fact from vouch or you_said, and propose one easy next step as a question. No dates unless in FACTS.`
Examples: "Hi Dazi, it's Darren! Louise and Katie got my paper boat to you. Katie says you drum with a Berkeley collective every week. Up for a jam sometime?" / "Dazi! Darren here, Katie passed my drum wish your way. Would love to jam. What's a good week for you?" / "Hey Dazi, thanks for saying that's you! Louise → Katie → you, small world. Want to grab a session in Berkeley?"
Fallback: `Hi <claimer>, it's <wisher>! <chain middle> connected us about "<wish gist>". Want to set something up?`

## 4. OG preview (`linkMetrics.ogHtml`)
`og:title` (shown in bubble, keep ≤ ~60 chars; inference, not an Apple limit): `<sender> thought of you for a wish` when no vouch exists, else `<sender>: <vouch clipped to 50>`. `og:description`: `<wisher> wants <wish gist ≤ 80>`. Drop "🪙 free wish" from the description: it reads as a reward and risks E6. Keep the brand out of the title (E4). The image has no text (E4).
Examples: "Louise: You know every drummer in the East Bay" / "Darren wants someone to jam on drums with in the Bay Area".

## Eval checklist (run on the drums chain + 1 empty-reason hop)
1. Every proper noun and number appears in FACTS. 2. Length caps hold, and the hook fits in the first 70 chars. 3. The text has no recipientTags, phones, or third-party reasons. 4. It has no pressure, unlock, reward or share wording, in either English or 中文. 5. The pass-on and intro texts end in a question. 6. With an empty reason, the output is generic and does not invent anything. 7. If AI times out, the fallback renders within 3s. 8. The OG tags parse with no JS (curl the page).
