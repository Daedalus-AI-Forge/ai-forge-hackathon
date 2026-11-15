import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { Platform, Share } from "react-native";

/**
 * Public link for a boat. Always an https link anyone can open without the app:
 * the Convex /og/w/:hopId route serves the share preview and redirects to the
 * hosted no-app link page (/l/:hopId).
 */
export function hopUrl(hopId: string) {
  const site = process.env.EXPO_PUBLIC_CONVEX_SITE_URL;
  if (site) return `${site.replace(/\/$/, "")}/og/w/${hopId}`;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/l/${hopId}`;
  }
  const base = process.env.EXPO_PUBLIC_WEB_URL;
  return base ? `${base.replace(/\/$/, "")}/l/${hopId}` : Linking.createURL(`/w/${hopId}`);
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
