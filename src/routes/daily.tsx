import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Camera, Share, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Countdown } from "@/components/rt/bits";
import { DAILY, useStore } from "@/lib/store";
import { shareLink } from "@/lib/share";

export const Route = createFileRoute("/daily")({
  head: () => ({ meta: [
    { title: "Today's challenge — Wishwell" },
    { name: "description", content: "One challenge a day for everyone. Find the person in as few ripples as you can." },
    { property: "og:title", content: "Today's challenge — Wishwell" },
    { property: "og:description", content: "One challenge a day. Fewer ripples wins." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Daily,
});

const BOARD = [
  { name: "Priya", hops: 2, path: "Ben → Priya" },
  { name: "Marcus", hops: 3, path: "Ana → Jo → Marcus" },
  { name: "Sofia", hops: 3, path: "Wei → Kai → Sofia" },
];
const PROMPTS = ["Who in your life has lived abroad the most?", "Who's the friend that cries at every movie?", "Who travels for work every month?"];

function Daily() {
  const { me } = useStore();
  const [step, setStep] = useState<"idle" | "me" | "pass" | "done">("idle");
  const [who, setWho] = useState("");
  return (
    <div className="ambient min-h-screen">
      <div className="mx-auto max-w-[430px] px-4 pb-16 pt-6">
        <div className="flex items-center justify-between px-1">
          <Link to="/" aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full glass"><ArrowLeft className="h-5 w-5" /></Link>
          <span className="rounded-full px-3 py-1.5 text-xs font-medium glass">Ends in <Countdown to={DAILY.endsAt} plain /></span>
        </div>

        <section className="relative mt-5 overflow-hidden rounded-[2rem] bg-foreground p-6 text-background shadow-soft">
          <div className="daily-orb pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-60">Today's challenge · No. 214</p>
          <div className="mt-5 text-5xl">{DAILY.emoji}</div>
          <h1 className="mt-3 text-[32px] font-bold leading-[1.05] tracking-tight">Find {DAILY.text}.</h1>
          <div className="mt-6 grid grid-cols-3 gap-2 text-center">
            {[[DAILY.players.toLocaleString("en-US"), "playing"], [String(DAILY.bestHops), "best ripples"], [`🔥${me.streak}`, "your streak"]].map(([v, l]) => (
              <div key={l} className="rounded-2xl bg-background/10 py-3"><div className="text-lg font-semibold">{v}</div><div className="text-[11px] opacity-60">{l}</div></div>
            ))}
          </div>
        </section>

        {step === "done" ? (
          <div className="mt-5 rounded-[1.75rem] p-6 text-center glass">
            <p className="text-4xl">🌊</p>
            <p className="mt-2 text-xl font-semibold">You're in today's ripple</p>
            <p className="mt-1 text-sm text-muted-foreground">Results unlock at midnight. Your streak is now 🔥{me.streak + 1}.</p>
            <button onClick={() => shareLink("/daily", `Today's Wishwell: find ${DAILY.text}. Can you beat ${DAILY.bestHops} ripples?`)} className="btn btn-ink mt-5 h-12 w-full"><Share className="h-4 w-4" />Share the challenge</button>
          </div>
        ) : step === "me" ? (
          <div className="mt-5 rounded-[1.75rem] p-5 glass">
            <p className="text-lg font-semibold">Prove it 📸</p>
            <p className="mt-1 text-sm text-muted-foreground">Snap a photo that tells the story. It stays hidden until results unlock.</p>
            <label className="mt-4 flex h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background/60 text-sm text-muted-foreground">
              <Camera className="h-6 w-6" />Add proof photo
              <input type="file" accept="image/*" className="hidden" onChange={() => setStep("done")} />
            </label>
          </div>
        ) : step === "pass" ? (
          <div className="mt-5 rounded-[1.75rem] p-5 glass">
            <p className="text-lg font-semibold">Who'd know someone?</p>
            <div className="mt-3 space-y-2">
              {PROMPTS.map((p) => <p key={p} className="flex gap-2 rounded-xl bg-muted p-3 text-sm"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-thread" />{p}</p>)}
            </div>
            <input className="field mt-3" placeholder="Their name" value={who} onChange={(e) => setWho(e.target.value)} />
            <button disabled={!who} onClick={async () => { await shareLink("/daily", `${who}, today's Wishwell: find ${DAILY.text}. Is it you — or who would know?`); toast.success(`Passed to ${who}`); setStep("done"); }} className="btn btn-thread mt-3 h-14 w-full">Pass it to {who || "a friend"}</button>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <button onClick={() => setStep("me")} className="btn btn-thread h-16 w-full text-lg">It's me</button>
            <button onClick={() => setStep("pass")} className="btn btn-ink h-16 w-full text-lg">I know someone</button>
          </div>
        )}

        <h2 className="mt-8 px-1 text-[17px] font-semibold">Fastest finds today</h2>
        <div className="mt-3 overflow-hidden rounded-[1.5rem] glass">
          {BOARD.map((b, i) => (
            <div key={b.name} className={`flex items-center gap-3 px-4 py-3 ${i ? "border-t border-border/60" : ""}`}>
              <span className="w-5 font-mono text-sm text-muted-foreground">{i + 1}</span>
              <Avatar name={b.name} size={32} />
              <div className="flex-1"><p className="text-sm font-semibold">{b.name}</p><p className="text-xs text-muted-foreground">{b.path}</p></div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{b.hops} ripples</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
