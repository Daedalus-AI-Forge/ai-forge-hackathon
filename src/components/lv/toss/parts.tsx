// Toss-flow aliases over the shared kit, so this flow looks exactly like the rest of the app.
import type { ReactNode } from "react";
import { Text, View, type TextInputProps, type ViewStyle } from "react-native";

import { GlassCard } from "@/components/ios";
import { DButton, DField, Eyebrow as KitEyebrow } from "@/components/lv/passon/kit";
import { lv } from "@/theme/tokens";


export function LvAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const bg = lv.tones[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % lv.tones.length];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: "rgba(255,255,255,0.9)",
      }}
    >
      <Text style={{ fontSize: size * 0.4, fontWeight: "600", color: lv.fg }}>{(name.trim()[0] ?? "?").toUpperCase()}</Text>
    </View>
  );
}

export function LvCard({ children, style, testID }: { children: ReactNode; style?: ViewStyle; testID?: string }) {
  return (
    <GlassCard testID={testID} style={style}>
      {children}
    </GlassCard>
  );
}

export function Eyebrow({ children, color = lv.mutedFg }: { children: ReactNode; color?: string }) {
  return <KitEyebrow style={{ color }}>{children}</KitEyebrow>;
}

export function LvField(props: TextInputProps) {
  return <DField {...props} />;
}

type Variant = "thread" | "ink" | "ghost";
export function LvButton({
  title,
  onPress,
  variant = "ink",
  disabled,
  busy,
  testID,
  compact,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
  compact?: boolean;
}) {
  return (
    <DButton
      title={title}
      onPress={onPress}
      variant={variant}
      disabled={disabled}
      busy={busy}
      testID={testID}
      size={compact ? "sm" : "lg"}
    />
  );
}
