# The Well — Fountain Visual Design

## Intent

Make the Well home screen feel like a real, inviting wish fountain at golden hour, replacing the cool gray stone texture with warm ivory travertine, sculptural details, and teal water. Keep the coin toss as a small, clear ritual.

## Goals

- Give the circular pool a warm, photographic fountain setting with a restrained cornice or shallow relief and soft golden side light.
- Keep the existing holder avatars, wish data, and home-screen behavior intact while ripples visibly spread from the center coin.
- Add a minimal coin mark to “Toss a wish” without changing its copy.

## Non-goals

- Change wish creation, data models, ripple counts, holder placement, or navigation.
- Redesign other tabs or add new dependencies.
- Add ornate sculpture or coin detail that competes with the wish and avatars.

## Constraints

- Preserve the Expo SDK 58 / React Native implementation and existing `Well` component API.
- Keep the hero image square, locally bundled, and composed to crop cleanly inside the circular pool.
- Keep the existing design tokens and test IDs usable.

## Approaches

1. **Replace the pool image and refine the native overlays (chosen).** Use a custom warm fountain image, then keep ripples and live avatars native so they remain dynamic and legible. This is the best balance of immersion and fidelity to the existing screen.
2. **Overlay decorative trim on the current image.** This is a smaller asset change but leaves the cool gray surface visible, which conflicts with the requested direction.
3. **Draw the entire fountain in vector shapes.** This offers precise scaling but risks making the water and stone feel abstract rather than like a place.

## Implementation decisions

- Replace the existing pool artwork with a realistic ivory-stone and teal-water fountain view; include a classical rim, restrained relief or statue silhouette, subtle bronze coin highlights, and warm evening side light in the artwork.
- Use the provided fountain photograph as a material and composition reference, not as the final crop; preserve a clear central water area for the animated wish coin and ripples.
- Keep real-time pool motion and holder avatars in React Native, with ripple rings radiating from the center wish coin.
- Add a small coin glyph to the existing “Toss a wish” CTA and retain the English text.
- Limit code changes to the Well hero and its CTA; update `hackathon.md` with the shipped visual change.

## Builder calls

- Choose the final crop, image asset format, and coin glyph that fit the existing circular layout and platform conventions.
- Preserve the current avatar and caption layering unless the final device rendering reveals a collision.
