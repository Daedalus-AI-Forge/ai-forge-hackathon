// Proof photo picking + upload. Web uses a hidden <input type=file>, native uses expo-image-picker
// (see src/lib/pickImage.ts).
import { canPickImage, pickImage, type PickedImage } from "@/lib/pickImage";

export const canPickPhoto = canPickImage;

/** Opens the photo picker; resolves null when the visitor cancels. */
export function pickPhoto(): Promise<PickedImage | null> {
  return pickImage("image/*");
}

/** POSTs the image to a Convex upload URL and returns the storage id. */
export async function uploadPhoto(uploadUrl: string, file: Blob, contentType?: string): Promise<string> {
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": contentType || file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) throw new Error("Photo upload failed. Try again or skip the photo.");
  const { storageId } = (await res.json()) as { storageId: string };
  return storageId;
}
