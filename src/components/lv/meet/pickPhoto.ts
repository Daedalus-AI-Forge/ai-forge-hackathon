// Pick one image for the meet-up photo. Web uses a hidden file input. Native needs
// expo-image-picker, which is not in this build yet (adding it needs a new dev build).
import { Platform } from "react-native";

export const CAN_PICK_PHOTO = Platform.OS === "web" && typeof document !== "undefined";
export const NATIVE_PICK_NOTE = "Photo upload in the app comes with the next build. Open the link on the web to add it.";

/** Resolves with the chosen file, or null if the picker was closed without one. */
export function pickPhoto(): Promise<Blob | null> {
  if (!CAN_PICK_PHOTO) return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,image/heic,image/heif";
    input.style.display = "none";
    input.onchange = () => {
      resolve(input.files?.[0] ?? null);
      input.remove();
    };
    // Browsers that support it tell us when the dialog closes without a file.
    input.addEventListener("cancel", () => {
      resolve(null);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  });
}
