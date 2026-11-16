# Complete meeting UI integration

The user now authorizes connecting all existing Convex capabilities to the interface,
while retaining the current visual design. Build on main e173295 (including #51 and #52),
not the earlier replacement UI. Keep the night Pool, light glass screens, typography,
existing three tabs and current toss interaction.

Add a persistent wish action compatible with the existing bar and Pool composer.
Use existing MeetCard/GrantedCard throughout the flow: accept a verified claim, arrange
the meeting using persisted contact, pick and preview a full image, submit consent,
have the other participant review/reject/confirm the exact version, and reveal the
photo, thank-you, story, tier, winning route and sharing. Preserve all existing Convex
privacy, revision, deadline and reward guarantees. Existing /w real claims must use
the supported verified claim path; daily claims retain their lighter behavior.

No redesign, no duplicated alternative meeting system, no cloud fixture writes.
Only add controls, navigation and state handling needed to complete this journey.
