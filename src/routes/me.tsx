import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { AppShell, Avatar } from "@/components/rt/bits";
import { badgesFor, useStore } from "@/lib/store";
import { COVERS } from "@/lib/covers";
import { TIER_LABEL, tierFor } from "@/lib/rules";
import { shareLink } from "@/lib/share";

export const Route = createFileRoute("/me")({
  head: () => ({ meta: [
    { title: "Profile — Wishwell" },
    { name: "description", content: "Your wish credits, stars, thread cards, badges and network." },
    { property: "og:title", content: "Profile — Wishwell" },
    { property: "og:description", content: "Your wish credits, stars, thread cards, badges and network." },
  ] }),
  component: Me,
});
const TIER_BG = { gold: "bg-gold", silver: "bg-silver", bronze: "bg-bronze", red: "bg-thread text-thread-foreground", broken: "bg-muted" } as const;

function Me() {
  const { me, wishes, network, redeem } = useStore();
  const joined = wishes.filter((w) => w.hops.some((h) => h.name === me.name));
  const done = joined.filter((w) => w.status === "completed");
  const badges = [...new Set(done.flatMap(badgesFor))];
  const sendWish = (name: string) => {
    const w = wishes.find((x) => x.status === "active" && x.creator === me.name);
    if (!w) { toast("Make a wish first"); return; }
    void shareLink(`/w/${w.hops.at(-1)!.id}`, `Hey ${name}, can you pass this along? ${w.text}`);
  };
  return (
    <AppShell>
      <div className="px-4 pt-12">
        <div className="flex items-center gap-3.5 px-1">
          <Avatar name={me.name} size={56} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[26px] font-bold leading-none">{me.name}</h1>
            <p className="mt-1 truncate text-[13px] text-muted-foreground">{me.city} · {me.tags.join(" · ")}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center rounded-[1.25rem] px-2 py-3 glass">
          {[[`🔥${me.streak}`, "Streak"], [me.credits, "Wishes"], [me.stars, "Stars"], [joined.length, "Helped"]].map(([v, l], i) => (
            <div key={l} className={`flex-1 text-center ${i ? "border-l border-border/70" : ""}`}>
              <div className="text-[20px] font-semibold leading-none">{v}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{l}</div>
            </div>
          ))}
          <button onClick={() => redeem() ? toast.success("Traded for 1 wish") : toast.error("You need 2 stars")} className="btn btn-ink h-9 px-3 text-xs">2⭐ → wish</button>
        </div>

        <div className="mt-3 rounded-[1.25rem] p-4 glass">
          <p className="eyebrow">How friends see you</p>
          <p className="mt-1.5 text-[15px] leading-snug">3 friends say you're <span className="font-semibold text-thread">reliable, fun</span>, and know everyone in music.</p>
        </div>

        <h2 className="mt-6 px-1 text-[17px] font-semibold">Wishes granted</h2>
        <div className="no-scrollbar -mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
          {done.map((w) => { const t = tierFor(w.hops.length - 1); return (
            <Link key={w.id} to="/threads/$id" params={{ id: w.id }} className="relative h-44 w-32 shrink-0 snap-start overflow-hidden rounded-[1.5rem] shadow-soft">
              <img src={w.photo ?? COVERS[w.type]} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
              <span className={`absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${TIER_BG[t]}`}>{TIER_LABEL[t]}</span>
              <div className="absolute inset-x-2 bottom-2 rounded-2xl p-2.5 glass-dark">
                <p className="line-clamp-2 text-[13px] font-medium leading-tight">{w.text}</p>
                <p className="mt-1 text-[11px] opacity-75">{w.hops.length - 1} ripples</p>
              </div>
            </Link>); })}
          <Link to="/wish" className="flex h-44 w-32 shrink-0 snap-start items-center justify-center rounded-[1.5rem] text-sm text-muted-foreground glass">+ New wish</Link>
        </div>

        {badges.length > 0 && (<>
          <h2 className="mt-5 px-1 text-[17px] font-semibold">Badges</h2>
          <div className="mt-3 flex flex-wrap gap-2">{badges.map((b) => <span key={b} className="rounded-full px-3 py-1.5 text-[13px] font-medium glass">{b}</span>)}</div>
        </>)}

        <h2 className="mt-5 px-1 text-[17px] font-semibold">My wish network</h2>
        <div className="mt-3 overflow-hidden rounded-[1.5rem] glass">
          {network.map((p, i) => (
            <div key={p.name} className={`flex items-center gap-3 px-4 py-2.5 ${i ? "border-t border-border/60" : ""}`}>
              <Avatar name={p.name} size={34} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium">{p.name}</p>
                <p className="truncate text-xs text-muted-foreground">{p.tags.join(" · ")}</p>
              </div>
              <button onClick={() => sendWish(p.name)} aria-label={`Send wish to ${p.name}`} className="btn h-9 w-9 btn-ink"><Send className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
