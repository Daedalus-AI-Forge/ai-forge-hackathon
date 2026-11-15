import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Lock } from "lucide-react";
import { AppShell, Avatar, Card, Countdown, Stat, useNow } from "@/components/rt/bits";
import { ThreadMap } from "@/components/rt/ThreadMap";
import { badgesFor, totalKm, useStore } from "@/lib/store";
import { TIER_LABEL, tierFor } from "@/lib/rules";
import { shareLink } from "@/lib/share";

export const Route = createFileRoute("/threads/$id")({
  head: () => ({ meta: [
    { title: "Thread — Wishwell" },
    { name: "description", content: "Watch a red thread travel the world, one hop at a time." },
    { property: "og:title", content: "Thread — Wishwell" },
    { property: "og:description", content: "Watch a red thread travel the world, one hop at a time." },
  ] }),
  component: Detail,
});

const TIER_BG = { gold: "bg-gold", silver: "bg-silver", bronze: "bg-bronze", red: "bg-accent", broken: "bg-muted" } as const;

function Detail() {
  const { id } = Route.useParams();
  const { wishes, me, confirm, uploadPhoto, rescue } = useStore();
  const now = useNow();
  const w = wishes.find((x) => x.id === id);
  if (!w) return <AppShell title="Thread not found"><Link to="/threads" className="px-6 text-thread">Back</Link></AppShell>;
  const hops = w.hops.length - 1;
  const tier = tierFor(hops);
  const last = w.hops.at(-1)!;
  const isWisher = w.creator === me.name;
  const left = now ? w.expiresAt - now : Infinity;
  const canRescue = (w.status === "active" && left < 3600_000) || w.status === "broken";

  return (
    <AppShell>
      <div className="space-y-5 px-4 pt-6">
        <Link to="/threads" className="inline-flex items-center gap-1 px-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />My wishes</Link>
        <h1 className="px-2 font-display font-semibold text-[2.3rem] leading-[1.05]">{w.creator} wants to <span className="text-thread">{w.text}</span></h1>
        <Card className="p-3">
          <ThreadMap hops={w.hops} highlight={w.hops.findIndex((h) => h.name === me.name)} />
          <div className="grid grid-cols-3 gap-2 px-2 pt-4 pb-1">
            <Stat value={hops} label="Ripples" />
            <Stat value={Math.round(totalKm(w)).toLocaleString()} label="Km" />
            <Stat value={w.status === "active" ? <Countdown to={w.expiresAt} className="text-xl" /> : "—"} label="Left" />
          </div>
        </Card>

        {canRescue && (
          <Card className="border-thread">
            <p className="font-display font-semibold text-2xl">{w.status === "broken" ? "This thread broke." : "This thread is about to break."}</p>
            <p className="mt-1 text-sm text-muted-foreground">Spend 1 star to add 24 hours. You have {me.stars} ⭐</p>
            <button onClick={() => rescue(w.id) ? toast.success("You rescued this thread ⭐") : toast.error("Not enough stars")} className="btn btn-thread mt-4 h-12 w-full">Rescue for 1 ⭐</button>
          </Card>
        )}
        {w.rescues.map((r, i) => <p key={i} className="text-center text-sm text-thread">⭐ {r} rescued this thread</p>)}

        {w.status === "pending" && (
          <Card className="border-thread">
            <span className="eyebrow">{last.name} · {last.city}</span>
            <p className="mt-2 font-display font-semibold text-2xl leading-tight">“{last.message}”</p>
            {isWisher ? (
              <div className="mt-4 flex gap-2">
                <button onClick={() => { confirm(w.id, true); toast.success("Connected! Meet within 7 days."); }} className="btn btn-thread h-12 flex-1">Yes, it's you</button>
                <button onClick={() => { confirm(w.id, false); toast("The thread keeps going."); }} className="btn btn-ghost h-12 flex-1">Not quite</button>
              </div>
            ) : <p className="mt-2 text-sm text-muted-foreground">Waiting for {w.creator} to confirm…</p>}
          </Card>
        )}

        {w.status === "connected" && (
          <Card className="text-center">
            <Lock className="mx-auto h-6 w-6 text-thread" strokeWidth={1.5} />
            <p className="mt-3 font-display font-semibold text-2xl">Waiting for them to meet…</p>
            <p className="mt-1 text-sm text-muted-foreground">The ending stays locked for everyone until a photo is shared. {w.meetDeadline && <><Countdown to={w.meetDeadline} /> left</>}</p>
            <label className="btn btn-thread mt-5 h-12 w-full cursor-pointer">
              Upload a photo together
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0]; if (!file) return;
                uploadPhoto(w.id, URL.createObjectURL(file), window.confirm("Did you meet in person? (+1 ⭐ each)"));
                toast.success("Challenge complete 🎉");
              }} />
            </label>
            <p className="mt-2 text-xs text-muted-foreground">In-person selfie or video-call screenshot</p>
          </Card>
        )}

        {w.status === "completed" && w.photo && (
          <div className="mx-auto w-[90%] rotate-[-1.5deg] bg-card p-3 pb-6 shadow-soft">
            <img src={w.photo} alt="The two of them meeting" className="aspect-square w-full object-cover" />
            <div className="mt-4 flex items-center justify-between">
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${TIER_BG[tier]}`}>{TIER_LABEL[tier]} · {hops} ripples</span>
              {w.offline && <span className="eyebrow">Met in person</span>}
            </div>
            <div className="mt-3"><ThreadMap hops={w.hops} compact /></div>
            <p className="mt-4 font-display font-semibold text-xl leading-snug">{w.endStory}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">{badgesFor(w).map((b) => <span key={b} className="rounded-full border px-2.5 py-0.5 text-xs">{b}</span>)}</div>
            <button onClick={() => shareLink(`/threads/${w.id}`, `Wish granted: ${w.text}, done in ${hops} ripples.`)} className="btn btn-ink mt-4 h-11 w-full text-sm">Share card</button>
          </div>
        )}

        <p className="eyebrow px-2 pt-2">The chain</p>
        <ol className="relative ml-4 space-y-5 border-l border-thread pl-6">
          {w.hops.map((h, i) => (
            <li key={h.id} className="relative">
              <span className="absolute -left-[38px] top-0"><Avatar name={h.name} size={26} ring /></span>
              <p className="text-xs text-muted-foreground">{h.name === me.name && <span className="mr-1.5 rounded-full bg-thread px-2 py-0.5 text-[10px] font-semibold text-thread-foreground">You</span>}<span className="font-medium text-foreground">{h.name}</span> · {h.city} · {i === 0 ? "Wish" : h.action === "its_me" ? "It's me" : h.action === "group" ? `Ripple ${i} · via group chat` : `Ripple ${i}`}</p>
              <p className="mt-0.5 text-[15px]">{h.message}</p>
            </li>
          ))}
        </ol>
        {w.status === "active" && (
          <div className="flex gap-2 pt-2">
            <button onClick={() => shareLink(`/w/${last.id}`, `${w.creator}'s wish: ${w.text} 🔴`)} className="btn btn-ink h-12 flex-1">Share</button>
            <Link to="/w/$hopId" params={{ hopId: last.id }} search={{ a: undefined }} className="btn btn-ghost h-12 flex-1">Preview relay page</Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
