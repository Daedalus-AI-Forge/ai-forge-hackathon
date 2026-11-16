# Wishwell: pitch

## Final paste-ready block
Same block as `checklist.md`; keep the two in sync.

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


**Tagline:** Wishes that travel friend to friend until they come true.

**One-liner:** Fold a wish into a paper boat. Friends pass it on, each one vouching for the last, until it reaches the one person who can make it come true.

## Problem
The person you need (someone in Kyoto who hosts a tea ceremony, a local in Osaka, someone who just moved to SF) is usually 2-3 friends away, and you can't see them. "Does anyone know someone who..." posts get lost in group chats. A cold intro from a stranger carries no trust.

## Solution
Wishwell turns that ask into a playful paper boat that travels through real friendships. Every hop adds a one-line vouch, so the person at the end gets a trust chain, not a cold DM.

## Why now
- LLMs can draft a warm vouch or a pass-on message from a few taps, so passing a wish on takes seconds.
- People want small real-world meetups, but the social apps they use are built for feeds.
- Links open in iMessage and other in-app browsers, so a whole flow can run without anyone installing an app.

## Demo story: a Japanese tea ceremony
Louise wishes to try a Japanese tea ceremony. Her AI coach suggests Katie, "from a daily boat 3 weeks ago". Katie opens the no-app link page, vouches, and passes it to Darren. Darren sends it to Dazi, who says "That's me". California → Osaka → Kyoto in 3 passes. Ending: https://gallant-seal-635.convex.site/e/jn72jhcrt9geza5qs4vk47w5eh8jaae8

## How it works
1. **Toss.** On the Well tab (no floating button), whisper a wish (type of person + what to do + why), AI polishes it, and the coin sinks into real WebGL water. The lantern paper boat is also the app icon.
2. **AI coach over your relation graph.** Every pass you make records who you know and why (tags + a one-line reason). The coach ranks your own connections against the wish and suggests 1-3 people, with the evidence behind each pick. It prefills them, and "Text all N" opens Messages for each one.
3. **Paper boats hop friend to friend.** Each recipient gets a unique link. To pass it on, you vouch for the person who sent it to you. Fewer hops win (Gold/Silver/Bronze).
4. **No-app link page with a free wish.** The link opens in Safari or an in-app browser with no install and no sign-up. The visitor writes their own free wish first, then claims ("It's me") or pushes the boat to one more person, and leaves a contact. Their wish sets sail the moment they finish.
5. **Claim confirm.** The wisher confirms the match in the app and sends the first text from their own phone.
6. **Meet, photo, GRANTED.** The two meet up, add a photo, and the wish is revealed as GRANTED.
7. **World globe.** The World tab is a real-geography 3D globe. Every completed wish shows its route on an interactive globe ("Fly the route"), and success stories carry meet-up photos. AI wish bots keep boats travelling across 18 countries.

**A person taps Send every time.** The AI only drafts and suggests. It never messages anyone, and every vouch and reason can be edited.

## What's new here
- Trust is passed along: each hop vouches for the hop before it, so trust builds up as the boat travels.
- The relation graph is built as a side effect of helping. You never fill out a profile; the reasons you write when you pass a boat become your graph, and the coach only uses what you wrote (with forget controls).
- The free wish turns a helper into a wisher, so every link you send can bring in a new user.

## Metrics we instrument
Events (`convex/linkMetrics.ts`: `open`, `wish_written`, `skip_wish`, `claim`, `push`, `contact`, `download_click`) feed `linkMetrics.metrics`:
- **Link funnel completion rate** = (claim + push) / opens. This is the main metric.
- **Wish-first vs skip**: completion rate for visitors who wrote a free wish vs those who tapped "just help". This tests whether asking for a wish first makes people more likely to finish.
- Also tracked: contact capture and download clicks.
