import Svg, { Defs, Ellipse, LinearGradient, Path, Polygon, RadialGradient, Stop } from "react-native-svg";

/**
 * The lantern paper boat (folded ivory paper lit from inside), the same shape the water shader draws.
 * The SVG is 64 × 48 units; the boat's centre (its spot on the water) is at (32, 24) and its
 * half-width is 29 units, so a boat of half-width h px is drawn `boatBox(h)` big.
 */
export function boatBox(halfWidth: number) {
  const unit = halfWidth / 29;
  return { width: 64 * unit, height: 48 * unit, left: -32 * unit, top: -24 * unit };
}

export function PaperBoat({ halfWidth }: { halfWidth: number }) {
  const box = boatBox(halfWidth);
  return (
    <Svg width={box.width} height={box.height} viewBox="0 0 64 48">
      <Defs>
        <RadialGradient id="pbGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFD978" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#FFD978" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="pbHull" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFEFC6" />
          <Stop offset="1" stopColor="#CDBF9F" />
        </LinearGradient>
        <LinearGradient id="pbSailL" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor="#FFDC8E" />
          <Stop offset="1" stopColor="#F9F2E0" />
        </LinearGradient>
        <LinearGradient id="pbSailR" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor="#EDBD6B" />
          <Stop offset="1" stopColor="#D4C9AF" />
        </LinearGradient>
      </Defs>
      <Ellipse cx="32" cy="36" rx="31" ry="10" fill="url(#pbGlow)" />
      <Polygon points="3,20 19,26 14,38" fill="#D6C4A3" />
      <Polygon points="45,26 61,20 50,38" fill="#BBA683" />
      <Polygon points="19,26 45,26 50,38 14,38" fill="url(#pbHull)" />
      <Polygon points="32,3 19,26 32,26" fill="url(#pbSailL)" />
      <Polygon points="32,3 32,26 45,26" fill="url(#pbSailR)" />
      <Path
        d="M3 20L19 26L32 3L45 26L61 20L50 38H14Z M19 26H45 M32 3V26 M19 26L14 38 M45 26L50 38"
        fill="none"
        stroke="#3A2A0E"
        strokeOpacity={0.24}
        strokeWidth={0.9}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
