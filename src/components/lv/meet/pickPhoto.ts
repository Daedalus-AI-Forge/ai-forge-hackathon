import { Platform } from "react-native";

import { canPickImage, pickImage, pickNativeImage } from "@/lib/pickImage";

export const CAN_PICK_PHOTO = canPickImage;

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_NATIVE_EDGE = 2400;
const WEB_TYPES = "image/jpeg,image/png,image/webp";

export type MeetingPhoto = { blob: Blob; type: string; uri: string };

function checkSize(blob: Blob) {
  if (blob.size === 0) throw new Error("This photo is empty. Choose another one.");
  if (blob.size > MAX_BYTES) throw new Error("Choose a photo under 10 MB.");
}

async function pickWebPhoto(): Promise<MeetingPhoto | null> {
  const picked = await pickImage(WEB_TYPES);
  if (!picked) return null;
  const type = picked.blob.type;
  if (!WEB_TYPES.split(",").includes(type)) {
    throw new Error("Choose a JPEG, PNG, or WebP photo.");
  }
  checkSize(picked.blob);

  // A browser can decode a file whose contents disagree with the filename and MIME type.
  const bytes = new Uint8Array(await picked.blob.slice(0, 12).arrayBuffer());
  const matches = (start: number, signature: number[]) => signature.every((byte, i) => bytes[start + i] === byte);
  const consistent = type === "image/jpeg" ? matches(0, [0xff, 0xd8, 0xff])
    : type === "image/png" ? matches(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    : matches(0, [0x52, 0x49, 0x46, 0x46]) && matches(8, [0x57, 0x45, 0x42, 0x50]);
  if (!consistent) throw new Error("This file doesn't match its image type. Choose another photo.");

  const uri = URL.createObjectURL(picked.blob);
  try {
    const image = new Image();
    image.src = uri;
    await image.decode();
    return { blob: picked.blob, type, uri };
  } catch {
    URL.revokeObjectURL(uri);
    throw new Error("This photo couldn't be opened. Choose another one.");
  }
}

async function pickNativePhoto(): Promise<MeetingPhoto | null> {
  const asset = await pickNativeImage(1);
  if (!asset) return null;

  // Encode a JPEG even if the camera roll supplied HEIC, GIF or another native format.
  const { ImageManipulator, SaveFormat } = await import("expo-image-manipulator");
  const context = ImageManipulator.manipulate(asset.uri);
  try {
    if (Math.max(asset.width, asset.height) > MAX_NATIVE_EDGE) {
      context.resize(asset.width >= asset.height
        ? { width: MAX_NATIVE_EDGE, height: null }
        : { width: null, height: MAX_NATIVE_EDGE });
    }
    const image = await context.renderAsync();
    try {
      const { uri } = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.84 });
      const blob = await (await fetch(uri)).blob();
      checkSize(blob);
      return { blob, type: "image/jpeg", uri };
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}

/** Resolves null when the visitor dismisses the photo library. */
export function pickPhoto(): Promise<MeetingPhoto | null> {
  return Platform.OS === "web" ? pickWebPhoto() : pickNativePhoto();
}

export function releasePhoto(photo: MeetingPhoto) {
  if (Platform.OS === "web") URL.revokeObjectURL(photo.uri);
}
