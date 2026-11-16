// A wish that came true, as an instant photo: the final photo on the chain develops in a paper
// frame with a strip of tape, the film camera's orange date stamp and a handwritten caption.
import { useState } from "react";
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from "react-native";

import { useReduceMotion } from "@/components/lv/pool/NightPool";
import { lvImages, polaroid } from "@/theme/tokens";

const useNativeDriver = Platform.OS !== "web";

// Seed data can point at a photo bundled with the app as `asset:<name>`; everything else is a URL.
const BUNDLED: Record<string, ImageSourcePropType> = { "asset:drum-meet": lvImages.drumMeet };

export function photoSource(url: string): ImageSourcePropType {
  return BUNDLED[url] ?? { uri: url };
}

/** The camera's date imprint: '26 11 15. */
export function dateStamp(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `'${pad(d.getFullYear() % 100)} ${pad(d.getMonth() + 1)} ${pad(d.getDate())}`;
}

/** A small, stable tilt per print so a stack of them looks hand-placed. */
export function tiltFor(key: string, max = 3.5) {
  const h = [...key].reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381);
  return ((h % 1000) / 1000 - 0.5) * 2 * max;
}

export function Polaroid({
  photoUrl,
  caption,
  sub,
  names,
  date,
  width,
  tilt = 0,
  tape = true,
  onPress,
  accessibilityLabel,
  testID,
  style,
}: {
  photoUrl: string | null;
  /** Handwritten line under the photo. */
  caption: string;
  /** Optional smaller second line (who was on the chain). */
  sub?: string;
  /** People on the chain; their initials stand in while there is no photo yet. */
  names: string[];
  date: number | null;
  width: number;
  tilt?: number;
  tape?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const [develop] = useState(() => new Animated.Value(1));
  const [failed, setFailed] = useState(false);
  const pad = Math.round(width * 0.06);
  const photo = width - pad * 2;
  const small = width < 200;
  const showPhoto = !!photoUrl && !failed;

  const body = (
    <View style={[styles.paper, { width, padding: pad, paddingBottom: pad * 0.6, transform: [{ rotate: `${tilt}deg` }] }, style]}>
      {tape ? <View style={[styles.tape, { width: width * 0.36, height: small ? 16 : 24, top: small ? -8 : -12, left: width * 0.32 }]} /> : null}
      <View style={[styles.photo, { width: photo, height: photo }]}>
        {showPhoto ? (
          <>
            <Image
              source={photoSource(photoUrl)}
              // Explicit size: on web a bundled image's own pixel size would otherwise win over absoluteFill.
              style={{ position: "absolute", top: 0, left: 0, width: photo, height: photo }}
              resizeMode="cover"
              onLoad={() => {
                if (reduce) develop.setValue(0);
                else Animated.timing(develop, { toValue: 0, duration: 1400, useNativeDriver }).start();
              }}
              onError={() => setFailed(true)}
              accessibilityIgnoresInvertColors
            />
            {/* Instant film develops from a murky green-brown into the picture. */}
            <Animated.View style={[StyleSheet.absoluteFill, styles.develop, { opacity: develop }]} />
            <View style={styles.vignette} />
            {date ? (
              <Text style={[styles.stamp, { fontSize: Math.max(9, width * 0.045), right: pad * 0.6, bottom: pad * 0.45 }]}>{dateStamp(date)}</Text>
            ) : null}
          </>
        ) : (
          <View style={styles.developing}>
            <View style={styles.faces}>
              {names.slice(0, 4).map((name, i) => (
                <View key={`${name}-${i}`} style={[styles.face, { width: photo * 0.2, height: photo * 0.2, borderRadius: photo * 0.1, marginLeft: i ? -photo * 0.05 : 0 }]}>
                  <Text style={[styles.faceText, { fontSize: photo * 0.08 }]}>{name.slice(0, 1).toUpperCase() || "?"}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.developingText, { fontSize: small ? 12 : 16 }]}>developing…</Text>
          </View>
        )}
      </View>
      <View style={[styles.caption, { minHeight: small ? 40 : 64, paddingTop: small ? 6 : 10 }]}>
        <Text style={[styles.hand, { fontSize: small ? 13 : 19, lineHeight: small ? 17 : 25 }]} numberOfLines={small ? 2 : 3}>
          {caption}
        </Text>
        {sub ? (
          <Text style={[styles.sub, { fontSize: small ? 10.5 : 13 }]} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return <View testID={testID} accessible accessibilityLabel={accessibilityLabel}>{body}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  paper: {
    backgroundColor: polaroid.paper,
    borderRadius: 3,
    boxShadow: "0px 2px 4px rgba(0,0,0,0.18), 0px 18px 36px rgba(0,0,0,0.32)",
  },
  tape: {
    position: "absolute",
    zIndex: 2,
    backgroundColor: polaroid.tape,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120,100,60,0.12)",
    transform: [{ rotate: "-4deg" }],
  },
  photo: { backgroundColor: polaroid.photoBg, overflow: "hidden" },
  develop: { backgroundColor: "#3E4133" },
  vignette: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    boxShadow: "inset 0px 0px 18px rgba(0,0,0,0.35)",
    pointerEvents: "none",
  },
  stamp: {
    position: "absolute",
    fontFamily: Platform.select({ ios: "Menlo", default: "ui-monospace, Menlo, monospace" }),
    fontWeight: "700",
    color: polaroid.stamp,
    textShadowColor: "rgba(255,120,40,0.65)",
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 0 },
  },
  developing: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundImage: "linear-gradient(155deg, #57584A 0%, #34342C 55%, #26251F 100%)",
  },
  faces: { flexDirection: "row", alignItems: "center" },
  face: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(248,242,226,0.16)",
    borderWidth: 1.5,
    borderColor: "rgba(248,242,226,0.38)",
  },
  faceText: { color: "rgba(248,242,226,0.82)", fontWeight: "600" },
  developingText: { fontFamily: polaroid.hand, color: "rgba(248,242,226,0.62)" },
  caption: { gap: 2, justifyContent: "center" },
  hand: { fontFamily: polaroid.hand, color: polaroid.ink },
  sub: { fontFamily: polaroid.hand, color: polaroid.inkMuted },
  pressed: { transform: [{ scale: 0.97 }] },
});
