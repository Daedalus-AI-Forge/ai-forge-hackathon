import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { LargeTitle, Screen } from "@/components/ios";
import { WorldBackdrop } from "@/components/lv/world/WorldBackdrop";
import { WorldNetwork } from "@/components/lv/world/WorldNetwork";
import { useMe } from "@/lib/device";
import { night } from "@/theme/tokens";

/** World: the whole wish network as one little planet, and the wishes that came true along it. */
export default function World() {
  const { deviceId } = useMe();
  // While a finger turns the globe, the page holds still.
  const [turning, setTurning] = useState(false);

  return (
    <Screen tab testID="world-screen" backdrop={<WorldBackdrop />} tone="night" scrollEnabled={!turning}>
      <LargeTitle eyebrowColor={night.mutedFg} eyebrow="The wish network" title={<Text style={styles.brand}>All connected</Text>} />
      {deviceId ? <WorldNetwork deviceId={deviceId} onGlobeTouch={setTurning} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: "400",
    color: night.fg,
    fontFamily: night.serif,
    textShadowColor: "rgba(233,199,102,0.5)",
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
});
