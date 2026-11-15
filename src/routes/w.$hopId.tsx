import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Camera, Sparkles, Users } from "lucide-react";
import { Avatar, Card, Countdown } from "@/components/rt/bits";
import { ThreadMap } from "@/components/rt/ThreadMap";
import { CITIES, WISH_TYPES, useStore, type Hop, type Wish, type WishType } from "@/lib/store";
import { VOUCH_HOW, VOUCH_LONG, VOUCH_WORD, clueCard, draftForward, draftVouch3, polishWish, prophecy } from "@/lib/ai";
import { forwardsNeeded } from "@/lib/rules";
import { shareLink } from "@/lib/share";

type Mode = "me" | "forward" | "group";
type Step = "land" | "wish" | "pass" | "me" | "prophecy" | "sent";
type Rcpt = { name: string; tags: string; msg: string; sent: boolean };
export const Route = createFileRoute("/w/$hopId")({
  validateSearch: (s: Record<string, unknown>): { a?: Mode | undefined } =>
    ({ a: s["a"] === "me" || s["a"] === "forward" || s["a"] === "group" ? s["a"] : undefined }),
  head: () => ({ meta: [
    { title: "You get a free wish — Wishwell" },
    { name: "description", content: "Louise's wish is passing through you · ripple 2 · 31 hours left. Make your own wish — it's free." },
    { property: "og:title", content: "You get a free wish 🪙" },
    { property: "og:description", content: "Louise's wish is passing through you · ripple 2 · 31 hours left" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Relay,
});

const Chip = ({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) => (
  <button type="button" onClick={onClick} className={`rounded-full px-3 py-1.5 text-xs ${on ? "bg-foreground text-background" : "bg-background"}`}>{children}</button>
);

function Relay() {
  const { hopId } = Route.useParams();
  const { a } = Route.useSearch();
  const { findHop, relay, makeWish } = useStore();
  const found = findHop(hopId);
  const [step, setStep] = useState<Step>(a === "me" ? "me" : a ? "pass" : "land");
  const [skipped, setSkipped] = useState(!!a && a !== "me");
  const [name, setName] = useState("");
  const [city, setCity] = useState("San Francisco");
  const [type, setType] = useState<WishType>("same");
  const [wishText, setWishText] = useState("");
  const [orig, setOrig] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState<{ how?: string; long?: string; word?: string }>({});
  const [vouch, setVouch] = useState("");
  const [rc, setRc] = useState<Rcpt[]>([0, 1, 2].map(() => ({ name: "", tags: "", msg: "", sent: false })));
  const [group, setGroup] = useState(false);
  const [proof, setProof] = useState({ intro: "", story: "", photo: "", channel: "Phone", contact: "" });
  const [contact, setContact] = useState({ channel: "Phone", value: "", saved: false });
  const [done, setDone] = useState<{ hop: Hop; mine: Wish | null; line: string; n: number } | null>(null);
  if (!found) return <div className="p-10 text-center">This wish can't be found. <Link to="/" className="text-thread underline">Go home</Link></div>;
  const { wish, hop } = found;
  const closed = wish.status !== "active";
  const hopsSoFar = wish.hops.length - 1;
  const card = clueCard(wish.text);
  const sentCount = rc.filter((r) => r.sent).length + (group ? 1 : 0);
  const need = forwardsNeeded(skipped);
  const setR = (i: number, p: Partial<Rcpt>) => setRc((x) => x.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const pickV = (k: "how" | "long" | "word", val: string) => { const nv = { ...v, [k]: v[k] === val ? undefined : val }; setV(nv); setVouch(draftVouch3(hop.name, nv.how, nv.long, nv.word)); };

  const finish = async () => {
    setBusy(true);
    const to = rc.filter((r) => r.sent).map((r) => r.name);
    const mine = !skipped && !closed && wishText ? makeWish(type, wishText, "", { free: true, by: { name, city } }) : null;
    const nh = closed ? hop : relay(wish.id, { name, city, action: group && !to.length ? "group" : "forward", message: group ? "Shared it to a group chat" : `Passed it to ${to.join(", ")}`, vouch, to: to[0], fanout: to });
    const line = await prophecy((wishText || wish.text) + to.join());
    setBusy(false);
    setDone({ hop: nh, mine, line, n: wish.hops.length });
    setStep("prophecy");
  };

  const Header = ({ back, title, sub }: { back: Step; title: string; sub?: string }) => (
    <div className="pt-2">
      <button onClick={() => setStep(back)} className="text-muted-foreground" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
      <h1 className="mt-4 text-[30px] font-bold leading-[1.05] tracking-tight">{title}</h1>
      {sub && <p className="mt-2 text-[15px] text-muted-foreground">{sub}</p>}
    </div>
  );
  const Who = (
    <div className="flex gap-2"><input className="field" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
      <select className="field w-40" value={city} onChange={(e) => setCity(e.target.value)}>{Object.keys(CITIES).map((c) => <option key={c}>{c}</option>)}</select></div>
  );

  return (
    <div className="ambient min-h-screen"><div className="mx-auto max-w-[430px] px-5 pb-14 pt-6">
      {/* L1 landing */}
      {step === "land" && (<>
        <span className="rounded-full px-3 py-1.5 text-xs font-medium glass">🪙 Wishwell</span>
        <h1 className="mt-7 text-[44px] font-bold leading-[0.96] tracking-tight">You get a<br />free wish.</h1>
        <p className="mt-2 text-[17px] text-muted-foreground">It's free.</p>
        <button onClick={() => { setSkipped(false); setStep("wish"); }} className="btn btn-thread mt-6 h-14 w-full text-[17px]">Make my wish</button>

        <section className="mt-8 rounded-[1.75rem] p-4 glass">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Passing through you</p>
            <span className="relative flex items-center gap-2 font-mono text-xs"><span className="ripple-dot" /><Countdown to={wish.expiresAt} plain /></span>
          </div>
          <h2 className="mt-2 text-[22px] font-bold leading-tight">{wish.creator} wants to {wish.text}</h2>
          <p className="mt-1.5 text-[14px] text-muted-foreground">{wish.story}</p>
          <p className="mt-2 text-xs font-medium">Ripple {hopsSoFar + 1} · from {hop.name}</p>
          <div className="mt-3 rounded-[1.25rem] bg-background/50 p-1.5"><ThreadMap hops={wish.hops} compact /></div>
          <ol className="mt-4 space-y-3">
            {wish.hops.map((h, i) => (
              <li key={h.id} className="flex gap-3">
                <Avatar name={h.name} size={28} />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{h.name}</span> · {h.city} · {i === 0 ? "Wisher" : `Ripple ${i}`}</p>
                  {h.vouch ? <p className="text-[13.5px] leading-snug">“{h.vouch}”</p> : <p className="text-[13.5px] leading-snug">{h.message}</p>}
                </div>
              </li>
            ))}
          </ol>
          {closed ? (
            <p className="mt-4 rounded-xl bg-muted p-3 text-sm">{wish.status === "broken" ? "This wish faded before it found its person." : `This wish found its person. 🎉`} Your free wish still stands.</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setStep("me")} className="btn btn-ink h-12">It's me!</button>
              <button onClick={() => { setSkipped(true); setStep("pass"); }} className="btn btn-ghost h-12">Just help</button>
            </div>
          )}
        </section>
      </>)}

      {/* L2 write wish */}
      {step === "wish" && (<>
        <Header back="land" title="Who do you want to meet?" sub="A kind of person + what you'd do + why." />
        <Card className="mt-6 space-y-3">
          {Who}
          <div className="flex flex-wrap gap-1.5">
            {WISH_TYPES.map((t) => <Chip key={t.id} on={type === t.id} onClick={() => { setType(t.id); setWishText(t.example); setOrig(null); }}>{t.emoji} {t.label}</Chip>)}
          </div>
          <textarea className="field min-h-24 text-[17px]" placeholder="Meet someone who's hiring, to learn how they pick people" value={wishText} onChange={(e) => setWishText(e.target.value)} />
          <div className="flex gap-2">
            <button disabled={!wishText || busy} onClick={async () => { setBusy(true); setOrig(wishText); setWishText((await polishWish(type, wishText)).split(". ")[0]!.replace(/\.$/, "")); setBusy(false); }} className="btn btn-ghost h-11 flex-1 text-sm">
              <Sparkles className="h-4 w-4 text-thread" />{busy ? "Polishing…" : "AI polish"}
            </button>
            {orig !== null && <button onClick={() => { setWishText(orig); setOrig(null); }} className="btn btn-ghost h-11 px-4 text-sm">Undo</button>}
          </div>
        </Card>
        <button disabled={!wishText.trim() || !name} onClick={() => setStep("pass")} className="btn btn-thread mt-6 h-14 w-full text-[17px]">Next: pass it on</button>
        <p className="mt-2 text-center text-xs text-muted-foreground">Your wish goes live once you pass {wish.creator}'s on to 3 friends.</p>
      </>)}

      {/* L3 forward to 3 */}
      {step === "pass" && (<>
        <Header back={skipped ? "land" : "wish"} title="Pass it on" />
        <div className="mt-3 flex items-center gap-2">
          {[0, 1, 2].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < sentCount ? "bg-thread" : "bg-foreground/10"}`} />)}
          <span className="font-mono text-xs">{Math.min(sentCount, 3)} / 3</span>
        </div>

        <div className="mt-5 rounded-[1.5rem] bg-foreground p-4 text-background">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-60">Clue 1 of 3</p>
          <p className="mt-1 text-[18px] font-bold leading-snug">{card.clue}</p>
          <ul className="mt-3 space-y-1.5 text-[13px] opacity-80">{card.joggers.map((q) => <li key={q}>· {q}</li>)}</ul>
        </div>

        <Card className="mt-4 space-y-3">
          {skipped && Who}
          <p className="text-sm font-medium">Vouch for {hop.name}, who sent you this</p>
          {([["how", "How you met", VOUCH_HOW], ["long", "How long", VOUCH_LONG], ["word", "One word", VOUCH_WORD]] as const).map(([k, l, opts]) => (
            <div key={k}><p className="mb-1 text-[11px] text-muted-foreground">{l}</p><div className="flex flex-wrap gap-1.5">{opts.map((o) => <Chip key={o} on={v[k] === o} onClick={() => pickV(k, o)}>{o}</Chip>)}</div></div>
          ))}
          {vouch && <textarea className="field min-h-14 text-sm" value={vouch} onChange={(e) => setVouch(e.target.value)} />}
        </Card>

        <div className="mt-4 space-y-2.5">
          {rc.map((r, i) => (
            <div key={i} className={`rounded-[1.25rem] p-3 glass ${r.sent ? "opacity-70" : ""}`}>
              <div className="flex gap-2">
                <input className="field h-11" placeholder={`Friend ${i + 1}`} value={r.name} disabled={r.sent} onChange={(e) => setR(i, { name: e.target.value, msg: draftForward(e.target.value, wish.creator, wish.text, r.tags.split(",").map((t) => t.trim()).filter(Boolean)) })} />
                <input className="field h-11" placeholder="2–3 tags" value={r.tags} disabled={r.sent} onChange={(e) => setR(i, { tags: e.target.value, msg: draftForward(r.name, wish.creator, wish.text, e.target.value.split(",").map((t) => t.trim()).filter(Boolean)) })} />
              </div>
              {r.name && !r.sent && <>
                <textarea className="field mt-2 min-h-16 text-sm" value={r.msg} onChange={(e) => setR(i, { msg: e.target.value })} />
                <button disabled={!vouch || !name} onClick={() => { shareLink(`/w/${hop.id}`, r.msg); setR(i, { sent: true }); }} className="btn btn-thread mt-2 h-10 w-full text-sm">Send to {r.name}</button>
              </>}
              {r.sent && <p className="mt-2 text-xs font-medium text-thread">✓ Sent to {r.name}</p>}
            </div>
          ))}
          <button disabled={!vouch || !name || group} onClick={() => { shareLink(`/w/${hop.id}`, draftForward("everyone", wish.creator, wish.text, [])); setGroup(true); }} className="btn btn-ghost h-11 w-full text-sm">
            <Users className="h-4 w-4" />{group ? "Shared to a group chat ✓" : "Share to a group chat"}
          </button>
        </div>
        {!vouch || !name ? <p className="mt-3 text-center text-xs text-muted-foreground">{!name ? "Add your name" : "Vouch for " + hop.name} to start sending.</p> : null}
        <button disabled={busy || sentCount < need} onClick={finish} className="btn btn-ink mt-5 h-14 w-full text-[17px]">
          {busy ? "Reading the water…" : sentCount < need ? `Send to ${need - sentCount} more` : "Done"}
        </button>
      </>)}

      {/* L4 prophecy */}
      {step === "prophecy" && done && (<div className="pt-6">
        <span className="eyebrow">The prophecy</span>
        <div className="relative mt-3 overflow-hidden rounded-[1.75rem] bg-foreground p-6 text-background shadow-soft">
          <div className="daily-orb pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full" />
          <p className="relative text-[24px] font-bold leading-[1.15] tracking-tight">🔮 {done.line}</p>
        </div>
        <p className="mt-4 text-[15px]">You're ripple <span className="font-semibold text-thread">#{done.n}</span> on {wish.creator}'s wish.</p>
        {done.mine && <p className="mt-1 text-[15px]">Your wish is live: <span className="font-semibold">“{done.mine.text}”</span></p>}
        <Card className="mt-6">
          <p className="text-sm font-medium">Where should we send your receipt?</p>
          {contact.saved ? <p className="mt-2 text-sm text-thread">✓ We'll message you when it arrives.</p> : (
            <div className="mt-3 flex gap-2">
              <select className="field w-32" value={contact.channel} onChange={(e) => setContact({ ...contact, channel: e.target.value })}><option>Phone</option><option>WeChat</option><option>Instagram</option></select>
              <input className="field" placeholder="Contact" value={contact.value} onChange={(e) => setContact({ ...contact, value: e.target.value })} />
              <button disabled={!contact.value} onClick={() => setContact({ ...contact, saved: true })} className="btn btn-ink h-12 px-4 text-sm">Save</button>
            </div>
          )}
        </Card>
        <Link to="/" className="mt-8 block text-center text-sm text-muted-foreground underline underline-offset-4">Get the app to watch your footprints live</Link>
      </div>)}

      {/* L5 It's me */}
      {step === "me" && (<>
        <Header back="land" title={`Are you who ${wish.creator} is looking for?`} sub={`${wish.creator} wants to ${wish.text}.`} />
        <Card className="mt-6 space-y-3">
          {Who}
          <input className="field" placeholder="One line about you" value={proof.intro} onChange={(e) => setProof({ ...proof, intro: e.target.value })} />
          <p className="pt-1 text-sm font-medium">Proof: a photo or a one-line story</p>
          <label className="flex h-20 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-foreground/25 text-sm text-muted-foreground">
            <Camera className="h-4 w-4" />{proof.photo ? "Photo added ✓" : "Add a photo"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setProof({ ...proof, photo: e.target.files?.[0]?.name ?? "" })} />
          </label>
          <input className="field" placeholder="…or tell it in one line" value={proof.story} onChange={(e) => setProof({ ...proof, story: e.target.value })} />
          <div className="flex gap-2">
            <select className="field w-32" value={proof.channel} onChange={(e) => setProof({ ...proof, channel: e.target.value })}><option>Phone</option><option>WeChat</option><option>Instagram</option></select>
            <input className="field" placeholder="Contact" value={proof.contact} onChange={(e) => setProof({ ...proof, contact: e.target.value })} />
          </div>
          <button disabled={!name || !proof.contact || (!proof.photo && !proof.story)} onClick={() => { relay(wish.id, { name, city, action: "its_me", message: proof.intro || proof.story || "It's me!", contact: `${proof.channel}: ${proof.contact}` }); setStep("sent"); }} className="btn btn-thread h-14 w-full">Send to {wish.creator}</button>
        </Card>
      </>)}

      {step === "sent" && (<div className="pt-10">
        <h1 className="text-[34px] font-bold leading-tight">Waiting for {wish.creator} to confirm.</h1>
        <p className="mt-2 text-muted-foreground">Once you two meet, everyone on the chain sees how it ended.</p>
        <div className="mt-8 rounded-[1.5rem] p-5 text-center glass">
          <p className="text-[17px] font-semibold">🪙 Your free wish</p>
          <p className="mt-1 text-sm text-muted-foreground">Who do you want to meet?</p>
          <button onClick={() => { setSkipped(false); setStep("wish"); }} className="btn btn-thread mt-4 h-12 w-full">Make my wish</button>
        </div>
      </div>)}
    </div></div>
  );
}
