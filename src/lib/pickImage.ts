// One image from the photo library, as a Blob ready to POST to a Convex upload URL.
// Web: a hidden <input type=file>. Native: expo-image-picker (needs a dev build that includes it).
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

export type PickedImage = { blob: Blob; type: string; name: string };

export const canPickImage = Platform.OS !== "web" || typeof document !== "undefined";

function pickWeb(accept: string): Promise<PickedImage | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    const done = (file: File | null) => {
      resolve(file ? { blob: file, type: file.type || "image/jpeg", name: file.name } : null);
      input.remove();
    };
    input.onchange = () => done(input.files?.[0] ?? null);
    // Browsers that support it say when the dialog closes without a file.
    input.addEventListener("cancel", () => done(null));
    document.body.appendChild(input);
    input.click();
  });
}

export async function pickNativeImage(quality: number) {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality });
  return picked.canceled ? null : picked.assets[0];
}

async function pickNative(): Promise<PickedImage | null> {
  const asset = await pickNativeImage(0.7);
  if (!asset) return null;
  const blob = await (await fetch(asset.uri)).blob();
  // quality < 1 re-encodes to JPEG on iOS; fall back to that when the blob has no type.
  const type = blob.type || asset.mimeType || "image/jpeg";
  return { blob, type, name: asset.fileName ?? "photo.jpg" };
}

/** Resolves null when the person closes the picker without choosing. */
export function pickImage(accept = "image/*"): Promise<PickedImage | null> {
  if (!canPickImage) return Promise.resolve(null);
  return Platform.OS === "web" ? pickWeb(accept) : pickNative();
}
