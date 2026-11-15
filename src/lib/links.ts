import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { Platform, Share } from "react-native";

export function hopUrl(hopId: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/w/${hopId}`;
  }
  const base = process.env.EXPO_PUBLIC_WEB_URL;
  return base ? `${base.replace(/\/$/, "")}/w/${hopId}` : Linking.createURL(`/w/${hopId}`);
}

/** Public, read-only Wish Granted card (src/app/g/[wishId].tsx). */
export function cardUrl(wishId: string) {
  return hopUrl(wishId).replace(/\/w\/${wishId}$/, `/g/${wishId}`);
}

export async function copyLink(text: string) {
  await Clipboard.setStringAsync(text);
}

export async function shareLink(message: string, url: string) {
  const text = `${message}\n${url}`;
  if (Platform.OS === "web") {
    const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }) : null;
    if (nav?.share) {
      try {
        await nav.share({ text: message, url });
        return "shared";
      } catch {
        return "cancelled";
      }
    }
    await copyLink(text);
    return "copied";
  }
  await Share.share({ message: text, url });
  return "shared";
}

export function smsLink(message: string, url: string) {
  const body = encodeURIComponent(`${message}\n${url}`);
  const sep = Platform.OS === "ios" ? "&" : "?";
  void Linking.openURL(`sms:${sep}body=${body}`);
}
