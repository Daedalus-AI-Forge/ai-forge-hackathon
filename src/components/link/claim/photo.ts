// Proof photo picking + upload. Web uses a hidden <input type=file>; native has no picker
// installed (expo-image-picker is not a dependency), so the photo is skipped there.
import { Platform } from "react-native";

export const canPickPhoto = Platform.OS === "web" && typeof document !== "undefined";

/** Opens the browser file chooser; resolves null when the visitor cancels. */
export function pickPhotoWeb(): Promise<File | null> {
  return new Promise((resolve) => {
    if (!canPickPhoto) return resolve(null);
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    // Some browsers fire no event on cancel; the promise then simply stays pending, which is harmless.
    input.click();
  });
}

/** POSTs the file to a Convex upload URL and returns the storage id. */
export async function uploadPhoto(uploadUrl: string, file: Blob): Promise<string> {
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) throw new Error("Photo upload failed. Try again or skip the photo.");
  const { storageId } = (await res.json()) as { storageId: string };
  return storageId;
}
