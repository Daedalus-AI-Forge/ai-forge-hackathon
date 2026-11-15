import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { AppShell, Avatar, Card } from "@/components/rt/bits";
import { WISH_TYPES, useStore, type Wish, type WishType } from "@/lib/store";
import { polishWish } from "@/lib/ai";
import { shareLink } from "@/lib/share";

export const Route = createFileRoute("/wish")({
  head: () => ({ meta: [
    { title: "Make a wish — Wishwell" },
    { name: "description", content: "Describe the kind of person you want to meet and let friends relay it to them." },
    { property: "og:title", content: "Make a wish — Wishwell" },
    { property: "og:description", content: "Describe the kind of person you want to meet and let friends relay it to them." },
  ] }),
  component: MakeWish,
});

function MakeWish() {
  const { me, makeWish, network } = useStore();
  const [type, setType] = useState<WishType>("activity");
  const [text, setText] = useState("");
  const [story, setStory] = useState("");
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<Wish | null>(null);
  const t = WISH_TYPES.find((x) => x.id === type)!;
  const recs = network.slice(0, 3).map((p) => ({ p, why: `${p.tags[0]} · based in ${p.city} — likely knows the right circle` }));

  if (made) return (
    <AppShell eyebrow="Your wish is live" title="Now, who do you ask first?">
      <div className="space-y-3 px-4">
        <Card><span className="eyebrow">{t.label}</span><h2 className="mt-2 font-display font-semibold text-2xl leading-tight">{made.text}</h2><p className="mt-2 text-sm text-muted-foreground">{made.story}</p></Card>
        <p className="eyebrow px-2 pt-3"><Sparkles className="mr-1 inline h-3 w-3 text-thread" />Suggested by AI</p>
        {recs.map(({ p, why }) => (
          <Card key={p.name} className="flex items-center gap-3 p-4">
            <Avatar name={p.name} size={40} />
            <div className="min-w-0 flex-1"><p className="font-medium">{p.name}</p><p className="truncate text-xs text-muted-foreground">{why}</p></div>
            <button onClick={() => shareLink(`/w/${made.hops[0]!.id}`, `Hey ${p.name}, can you pass this along? ${made.text}`)} className="btn btn-ink h-9 px-4 text-sm">Send</button>
          </Card>
        ))}
        <button onClick={() => shareLink(`/w/${made.hops[0]!.id}`, `${me.name}'s wish: ${made.text} 🔴`)} className="btn btn-ghost h-12 w-full">Share link</button>
        <Link to="/threads/$id" params={{ id: made.id }} className="block pt-2 text-center text-sm text-muted-foreground underline underline-offset-4">Watch the thread</Link>
      </div>
    </AppShell>
  );

  return (
    <AppShell eyebrow={`${me.credits} wish ${me.credits === 1 ? "credit" : "credits"} · refunded if it works`} title="Who do you want to meet?">
      <div className="space-y-5 px-4">
        <div className="grid grid-cols-2 gap-2">
          {WISH_TYPES.map((x) => (
            <button key={x.id} onClick={() => setType(x.id)} className={`rounded-2xl border p-4 text-left transition ${type === x.id ? "border-foreground bg-primary text-primary-foreground" : "bg-card"}`}>
              <div className="text-xl">{x.emoji}</div><div className="mt-2 text-sm font-medium">{x.label}</div>
            </button>
          ))}
        </div>
        <Card className="space-y-3">
          <p className="text-xs text-muted-foreground">A type of person + what to do + why. Never a specific named person.</p>
          <input className="field" placeholder={t.example} value={text} onChange={(e) => setText(e.target.value)} />
          <button disabled={!text || busy} onClick={async () => { setBusy(true); setStory(await polishWish(type, text)); setBusy(false); }} className="btn btn-ghost h-11 w-full text-sm">
            <Sparkles className="h-4 w-4 text-thread" />{busy ? "Polishing…" : "Polish with AI"}
          </button>
          <textarea className="field min-h-24" placeholder="Why do you want to meet them?" value={story} onChange={(e) => setStory(e.target.value)} />
        </Card>
        <button disabled={!text || me.credits < 1} onClick={() => setMade(makeWish(type, text, story || text))} className="btn btn-thread h-14 w-full text-base">
          {me.credits < 1 ? "No wish credits — trade stars in Profile" : "Tie the thread"}
        </button>
      </div>
    </AppShell>
  );
}
