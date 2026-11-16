import { Asset } from "expo-asset";
import { requireOptionalNativeModule } from "expo";
import type { ComponentType } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import type { TexSource } from "@/lib/well/water-renderer";

/** What a surface hands the water loop once its GL context exists. */
export interface WaterContext {
  gl: WebGL2RenderingContext;
  /** Drawing-buffer size in device pixels. */
  pixelWidth: number;
  pixelHeight: number;
  /** Push the finished frame to screen (expo-gl: endFrameEXP). */
  present: () => void;
}

export interface WaterSurfaceProps {
  width: number;
  height: number;
  style?: StyleProp<ViewStyle>;
  onContext: (ctx: WaterContext) => void;
  /** The surface could not produce a GL context (e.g. no WebGL2). */
  onError: (err: unknown) => void;
}

type GLViewType = ComponentType<{
  style?: StyleProp<ViewStyle>;
  onContextCreate: (gl: WebGL2RenderingContext & { endFrameEXP(): void }) => void;
}>;

// expo-gl calls requireNativeModule("ExpoGL") at import time, so importing it into a binary built
// before expo-gl was added would throw. Probe for the native module first and only then load it.
let GLView: GLViewType | null = null;
try {
  if (requireOptionalNativeModule("ExpoGL")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    GLView = (require("expo-gl") as { GLView: GLViewType }).GLView;
  }
} catch {
  GLView = null;
}

/** True when this binary can create a GL surface at all. */
export const waterSurfaceSupported = GLView !== null;

/** Resolve a bundled image to something gl.texImage2D accepts on expo-gl (an object with localUri). */
export async function loadTexture(mod: number): Promise<TexSource> {
  const asset = Asset.fromModule(mod);
  await asset.downloadAsync();
  return { localUri: asset.localUri ?? asset.uri };
}

/** Native GL surface: an expo-gl GLView (GLES 3.0 / WebGL2 API surface). */
export function WaterSurface({ width, height, style, onContext }: WaterSurfaceProps) {
  if (!GLView) return null;
  const View = GLView;
  return (
    <View
      style={[{ width, height }, style]}
      onContextCreate={(gl) =>
        onContext({ gl, pixelWidth: gl.drawingBufferWidth, pixelHeight: gl.drawingBufferHeight, present: () => gl.endFrameEXP() })
      }
    />
  );
}
