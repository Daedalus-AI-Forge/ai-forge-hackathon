# Meeting completion backend

User scope: ship and merge backend support while preserving the existing UI.
Based on main `d694390`; no changes to routes, components, styles, app config,
assets, dependencies or frontend interaction handlers.

## Behavior
- A verified, accepted claim binds the winning participant and starts a seven-day
  meeting window. Existing creator confirmation and SMS return contracts remain usable.
- Either confirmed participant may upload a meeting image and optional thank-you.
  Only the other participant may approve or reject the exact current photo.
- Upload tickets bind identity, wish, expiry and revision. Replacing or rejecting
  a photo invalidates stale tickets and approvals.
- The server enforces the deadline and grants completion rewards once, atomically.
- Public ending data withholds pending meeting photos and notes; after approval it
  exposes the photo, note, winning route, tier and ending story. Daily behavior is
  kept separate.

## Compatibility boundary
Existing `/w` clients do not supply new device arguments to legacy hop APIs, and
existing claim cards expect a verified phone. Their existing contracts must remain
compatible. Legacy claim acceptance/contact repair that requires new UI is excluded.
New participant endpoints are backend capabilities; this PR does not add upload or
confirmation controls, change navigation, or wire the new lifecycle into UI.

## Verification
Run the integrated full test suite and root/Convex TypeScript checks. Review the
backend-only diff for identity, stale revision, expiration, storage privacy and
one-time rewards; verify all current UI/config/assets match the base revision.
No cloud deployment or live-user communication is part of verification.

## Verification result
- Full test suite: 252 tests across 27 files passed.
- Root and Convex TypeScript and whitespace checks passed.
- Existing UI, assets, app config, dependencies, legacy hop module and existing
  AI modules match the main base byte-for-byte.
- Historical verified claims without a holder identity keep their current
  confirmation behavior; participant actions require a safely bound identity.
- No deployment or live-user communication was performed.
