# To do

## Pool home: fountain art with lantern boats, not stars

Done in the working tree on `claude/world-network`, not yet committed. The fountain
painting now shows the **C · Lantern boat** (ivory folded paper lit from inside) floating
on the water instead of gold stars.

- `assets/pool/fountain-night.jpg`: new painting, generated with Figma AI
  (gpt-image-2.5-flare) in the "Wishwell fountain art" Figma draft, cropped to the old
  585 : 1024 aspect at 864 × 1512 so `FountainScene`'s dive origin (34% 72%) still lands
  in the water.
- `assets/pool/night-ambient.jpg`: rebuilt from the new painting with the old settings
  (293 × 512, Gaussian blur 18, saturation 1.2, brightness 0.6, fitted against the old file).
- `FountainScene.tsx`: the image's accessibility label now describes the boats.

Still open:
- Check on a phone that the boats read well under the Pool's 0.55 opacity and the
  toss screen's 0.4.
- `assets/pool/pool-floor.jpg` still has small gold stars between the coins. Decide
  whether they stay.
- The sky and garden in the new painting are slightly more realistic than the old one;
  regenerate if it clashes with the other art.
