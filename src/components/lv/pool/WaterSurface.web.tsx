import { Asset } from "expo-asset";
import { useEffect, useRef } from "react";

import type { TexSource } from "@/lib/well/water-renderer";

import type { WaterSurfaceProps } from "./WaterSurface";

export type { WaterContext, WaterSurfaceProps } from "./WaterSurface";

/** Web always has a canvas; whether WebGL2 works is found out when the context is created. */
export const waterSurfaceSupported = typeof document !== "undefined";

/** Resolve a bundled image to a decoded DOM image for gl.texImage2D. */
export function loadTexture(mod: number): Promise<TexSource> {
  const uri = Asset.fromModule(mod).uri;
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${uri}`));
    img.src = uri;
  });
}

const MAX_DPR = 1.75;

/** Web GL surface: a DOM <canvas> with a WebGL2 context, rendered through react-native-web. */
export function WaterSurface({ width, height, onContext, onError }: WaterSurfaceProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cb = useRef({ onContext, onError });
  useEffect(() => {
    cb.current = { onContext, onError };
  });
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, premultipliedAlpha: false });
    if (!gl) {
      cb.current.onError(new Error("WebGL2 unavailable"));
      return;
    }
    cb.current.onContext({ gl, pixelWidth: canvas.width, pixelHeight: canvas.height, present: () => {} });
  }, [width, height]);
  return <canvas ref={ref} style={{ width, height, display: "block" }} aria-hidden />;
}
