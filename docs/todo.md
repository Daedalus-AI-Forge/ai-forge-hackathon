# To do

## Pool home: redraw the fountain with lantern boats, not stars

The fountain painting on the Pool home still shows gold stars floating in the basin.
The water should hold boats instead: the **C · Lantern boat** (ivory folded paper lit
from inside, warm gold glow; the SVG is `src/components/lv/pool/PaperBoat.tsx` on the
`claude/lantern-boats` branch).

- Regenerate `assets/pool/fountain-night.jpg`. It is shown by `FountainScene.tsx` (the
  Pool's first screen) and behind `src/app/(tabs)/index.tsx` and `src/app/toss.tsx`.
  Keep the marble fountain, night garden, moon, and the same 585 × 1024 portrait framing
  with the fountain centred, so the dive zoom still lands in the water. Replace the
  floating stars on the water with a few lantern boats.
- Regenerate `assets/pool/night-ambient.jpg` (the same painting blurred and dimmed,
  293 × 512), the wallpaper behind the other screens.
- Update the image's `accessibilityLabel` in `FountainScene.tsx` ("...glowing with golden
  stars...").
- Check `assets/pool/pool-floor.jpg` too: it has small gold stars between the coins.

This reverses the lantern-boat design review, which kept the stars in the art as "granted
wishes" and redrew no art.
