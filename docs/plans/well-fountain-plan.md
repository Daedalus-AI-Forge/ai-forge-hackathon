# The Well Fountain Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle The Well hero as a warm, realistic fountain while preserving its live wish and holder behavior.

**Architecture:** Replace the bundled square pool photo with custom fountain artwork and retain the native React Native layers for animated ripples, the wish coin, and holder avatars. Add a small coin glyph to the existing CTA and document the completed visual change in the hackathon log.

**Tech Stack:** Expo SDK 58, React Native, TypeScript, existing bundled image assets.

**Spec:** `docs/plans/well-fountain-design.md`

## Global Constraints

- Use the existing Expo SDK 58 and React Native stack; do not add packages for this visual change.
- Keep the `Well` component API, live holder data, wish text, and navigation behavior intact.
- Keep “Toss a wish” as the CTA copy and preserve current test IDs.
- Never hand-edit generated `ios/` or `android/` directories.
- Update `hackathon.md` after this meaningful UI change without exposing secrets or personal data.
- Verify with `npm run typecheck`, `npx expo-doctor`, and Revyl on iPhone 17 Pro Max / iOS 27.0.

## Review Focus

- The new art must crop cleanly inside the circular pool and keep the stone rim visible at the current 320-point size; inspect the Revyl device screenshot.
- The ivory travertine, teal water, classical edge detail, and golden-hour lighting must read as a real fountain, not a cool gray abstract texture; inspect the rendered device screenshot.
- Native ripples must still originate at the center coin while avatars remain visible and interactive; exercise the screen in Revyl and verify the existing pool test IDs.
- The CTA icon must read as a coin without reducing “Toss a wish” legibility or changing the button's accessible action; inspect the device screenshot and accessibility hierarchy.
- The image remains locally bundled so the screen does not depend on network availability; verify Expo export/build succeeds.

---

### Task 1: Refresh the Well fountain hero

**Files:**
- Modify: `assets/design/well-pool.jpg`
- Modify: `src/components/lv/home/Well.tsx`
- Modify: `src/app/(tabs)/index.tsx`
- Modify: `hackathon.md`

**Interfaces:**
- Consumes: `Well({ holders, size, testID })`, `lvImages.wellPool`, `lv.thread`, and the existing home-screen CTA.
- Produces: the same `Well` API and screen behavior, with updated local artwork, center-origin ripples, restrained fountain details, and a coin-marked “Toss a wish” button.

- [ ] Convert the staged square fountain artwork into the existing local JPEG asset, matching the approved photo reference with warm ivory travertine, teal water, restrained relief, a few bronze coin glints, soft golden side light, and a clear central water area; keep the asset optimized for app bundling.
- [ ] Refine `Well.tsx` so animated water waves radiate visibly from the red center coin without decorative static dashed rings, while retaining virtual avatar placement, avatar/caption legibility, and the warm stone rim.
- [ ] Add a small coin glyph beside the unchanged “Toss a wish” text in `src/app/(tabs)/index.tsx`, preserving its test ID, accessible button role, and navigation.
- [ ] Append one evidence-based `working tree` entry to `hackathon.md` describing the home-screen visual update and its files.
- [ ] Run `npm run typecheck` and `npx expo-doctor`; expected: no type errors and no new Expo diagnostics caused by this change.
- [ ] Build/install through Revyl and inspect the screen on iPhone 17 Pro Max / iOS 27.0; expected: the art reads as a warm fountain, the pool remains circular, live avatars and coin-origin ripples are visible, and the CTA icon/copy are clear.
