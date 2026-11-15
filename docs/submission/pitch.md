# Wishwell: pitch

**One-liner:** Fold a wish into a paper boat. Friends pass it on, each one vouching for the last, until it reaches the one person who can make it come true.

## Problem
The person you need (a drummer to jam with, a local in Tokyo, someone who just moved to SF) is usually 2-3 friends away, and you can't see them. "Does anyone know someone who..." posts get lost in group chats. A cold intro from a stranger carries no trust.

## Solution
Wishwell turns that ask into a playful paper boat that travels through real friendships. Every hop adds a one-line vouch, so the person at the end gets a trust chain, not a cold DM.

## Why now
- LLMs can draft a warm vouch or a pass-on message from a few taps, so passing a wish on takes seconds.
- People want small real-world meetups, but the social apps they use are built for feeds.
- Links open in iMessage and other in-app browsers, so a whole flow can run without anyone installing an app.

## How it works
1. **Toss.** Write a wish (type of person + what to do + why). AI polishes it.
2. **AI coach over your relation graph.** Every pass you make records who you know and why (tags + a one-line reason). The coach ranks your own connections against the wish and suggests 1-3 people, with the evidence behind each pick. It prefills them, and "Text all N" opens Messages for each one.
3. **Paper boats hop friend to friend.** Each recipient gets a unique link. To pass it on, you vouch for the person who sent it to you. Fewer hops win (Gold/Silver/Bronze).
4. **No-app link page with a free wish.** The link opens in Safari or an in-app browser with no install and no sign-up. The visitor writes their own free wish first, then claims ("It's me") or pushes the boat to one more person, and leaves a contact. Their wish sets sail the moment they finish.
5. **Claim confirm.** The wisher confirms the match in the app and sends the first text from their own phone.

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
