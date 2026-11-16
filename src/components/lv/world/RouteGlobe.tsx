// A wish chain's real route on a small globe: each known city in true position, the red thread
// arcing between them the short way round (a Tokyo -> San Francisco hop crosses the Pacific).
import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop, Text as SvgText } from "react-native-svg";

import { cityOf } from "@/components/lv/threads/threadData";
import { night } from "@/theme/tokens";

import { arcPoints, cameraFacing, fromLatLng, graticule, project, splitPath, type Vec3 } from "./globeLayout";

const FONT = Platform.OS === "web" ? "-apple-system, BlinkMacSystemFont, system-ui, sans-serif" : undefined;

export { fromLatLng };

/** Consecutive distinct known cities along the chain; people in unknown cities are skipped, not guessed. */
export function routeStops(cities: (string | null)[]) {
  const stops: { city: string; v: Vec3 }[] = [];
  for (const city of cities) {
    const c = cityOf(city);
    if (!c || !city) continue;
    if (stops.at(-1)?.city.toLowerCase() === city.trim().toLowerCase()) continue;
    stops.push({ city: city.trim(), v: fromLatLng(c.lat, c.lng) });
  }
  return stops;
}

export function RouteGlobe({ cities, height = 220 }: { cities: (string | null)[]; height?: number }) {
  const [width, setWidth] = useState(0);
  const stops = routeStops(cities);
  const radius = height * 0.44;
  const cx = width / 2;
  const cy = height / 2;

  // Face the middle of the route, then look from a little below it so the lifted thread bows upward.
  const mid = stops.reduce((m, s) => ({ x: m.x + s.v.x, y: m.y + s.v.y, z: m.z + s.v.z }), { x: 0, y: 0, z: 0 });
  const len = Math.hypot(mid.x, mid.y, mid.z) || 1;
  const facing = stops.length ? cameraFacing({ x: mid.x / len, y: mid.y / len, z: mid.z / len }) : { yaw: 0, pitch: 0 };
  const camera = { yaw: facing.yaw, pitch: facing.pitch - 0.5 };

  const legs = stops.slice(1).map((s, i) => splitPath(arcPoints(stops[i]!.v, s.v, 1.6).map((p) => project(p, camera, cx, cy, radius))));
  const dots = stops.map((s) => ({ ...s, p: project(s.v, camera, cx, cy, radius) }));
  const labels = new Set<string>();
  const unique = dots.filter((d) => (labels.has(d.city) ? false : (labels.add(d.city), true)));

  return (
    <View style={[styles.box, { height }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <RadialGradient id="routeOcean" cx="38%" cy="30%" r="75%">
              <Stop offset="0" stopColor="#2A6B78" />
              <Stop offset="0.45" stopColor="#123B45" />
              <Stop offset="1" stopColor="#061519" />
            </RadialGradient>
            <RadialGradient id="routeAtmo" cx="50%" cy="50%" r="50%">
              <Stop offset="0.8" stopColor={night.aqua} stopOpacity="0" />
              <Stop offset="0.85" stopColor={night.aqua} stopOpacity="0.25" />
              <Stop offset="1" stopColor={night.aqua} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={cx} cy={cy} r={radius / 0.8} fill="url(#routeAtmo)" />
          <Circle cx={cx} cy={cy} r={radius} fill="url(#routeOcean)" />
          <Path d={graticule(camera, cx, cy, radius)} stroke={night.aqua} strokeOpacity={0.12} strokeWidth={0.7} fill="none" />
          {legs.map((leg, i) => (
            <G key={i}>
              <Path d={leg.back} stroke={night.thread} strokeOpacity={0.3} strokeWidth={1.2} fill="none" strokeDasharray="2 4" />
              <Path d={leg.front} stroke={night.thread} strokeOpacity={0.2} strokeWidth={6} fill="none" strokeLinecap="round" />
              <Path d={leg.front} stroke={night.thread} strokeWidth={2.2} fill="none" strokeLinecap="round" />
            </G>
          ))}
          {unique.map((d, i) => (
            <G key={d.city} opacity={d.p.front ? 1 : 0.35}>
              <Circle cx={d.p.x} cy={d.p.y} r={i === 0 || i === unique.length - 1 ? 5 : 4} fill={night.goldBright} stroke={night.deep} strokeWidth={1.5} />
              <SvgText fontFamily={FONT} x={d.p.x} y={d.p.y + 19} textAnchor="middle" fontSize={11.5} fontWeight="600"
                stroke={night.deep} strokeWidth={3} strokeOpacity={0.7} fill={night.deep}>{d.city}</SvgText>
              <SvgText fontFamily={FONT} x={d.p.x} y={d.p.y + 19} textAnchor="middle" fontSize={11.5} fontWeight="600" fill={night.fg}>{d.city}</SvgText>
            </G>
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: "100%", overflow: "hidden" },
});
