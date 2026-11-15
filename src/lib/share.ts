import { toast } from "sonner";
export async function shareLink(path: string, text: string) {
  const url = `${window.location.origin}${path}`;
  try {
    if (navigator.share) { await navigator.share({ title: "Wishwell", text, url }); return; }
  } catch { /* cancelled */ }
  await navigator.clipboard?.writeText(`${text} ${url}`).catch(() => {});
  toast.success("Link copied — send it to a friend.");
}
