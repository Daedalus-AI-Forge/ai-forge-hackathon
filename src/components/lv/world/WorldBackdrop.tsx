import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { night } from "@/theme/tokens";

// Deterministic starfield (percent positions), denser and brighter toward the top like a real sky.
const STARS = Array.from({ length: 70 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12345.6789;
  const x = (a - Math.floor(a)) * 100;
  const y = (b - Math.floor(b)) ** 1.6 * 100;
  return { x, y, r: i % 9 === 0 ? 1.4 : i % 3 === 0 ? 1 : 0.65, o: 0.25 + ((i * 7) % 10) / 16 };
});

/** Night sky behind the World tab: deep teal-black, a soft glow where the globe hangs, and stars. */
export function WorldBackdrop() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="sky" cx="50%" cy="30%" r="65%">
            <Stop offset="0" stopColor="#174450" stopOpacity="0.9" />
            <Stop offset="0.5" stopColor={night.bg} stopOpacity="0.6" />
            <Stop offset="1" stopColor={night.deep} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#sky)" />
        {STARS.map((s, i) => (
          <Circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill={i % 11 === 0 ? night.goldBright : night.fg} fillOpacity={s.o} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: night.deep, pointerEvents: "none" },
});
