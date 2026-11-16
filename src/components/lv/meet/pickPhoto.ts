// Pick the meet-up photo: web file input or the native photo library (src/lib/pickImage.ts).
import { canPickImage, pickImage, type PickedImage } from "@/lib/pickImage";

export const CAN_PICK_PHOTO = canPickImage;

/** Resolves with the chosen image, or null if the picker was closed without one. */
export function pickPhoto(): Promise<PickedImage | null> {
  return pickImage("image/jpeg,image/png,image/webp,image/heic,image/heif");
}
