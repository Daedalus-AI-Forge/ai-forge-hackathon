import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { AppShell, Avatar, Countdown } from "@/components/rt/bits";
import { Well } from "@/components/rt/Well";
import { NetworkGraph, buildNetwork } from "@/components/rt/NetworkGraph";
import { DAILY, footprints, useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Wishwell — toss a wish, friends pass it on" },
    { name: "description", content: "Toss a wish into the well. Friends pass it on, ripple by ripple, until it reaches the one person who can make it come true." },
    { property: "og:title", content: "Wishwell — toss a wish, friends pass it on" },
    { property: "og:description", content: "Toss a wish into the well. Friends pass it on until it reaches the right person." },
  ] }),
  component: TheWell,
});


function TheWell() {
  const { wishes, me, network } = useStore();
  const net = buildNetwork(me.name, network, wishes);
  const nav = useNavigate();
  const [tossing, setTossing] = useState(false);
  const mine = wishes.find((w) => w.creator === me.name && w.status === "active");
  const passing = wishes.filter((w) => w.status === "active" && w.creator !== me.name);
  const fp = footprints(wishes, me.name);
  const ripples = mine ? mine.hops.length - 1 : 0;

  const toss = () => { setTossing(true); setTimeout(() => nav({ to: "/wish" }), 850); };

  return (
    <AppShell>
      <header className="flex items-center justify-between px-5 pt-12">
        <div>
          <p className="eyebrow">🔥 {me.streak}-day streak · {me.credits} wish{me.credits === 1 ? "" : "es"} · {me.stars} ⭐</p>
          <h1 className="font-display text-[34px] font-bold leading-tight">Wishwell</h1>
        </div>
        <Link to="/me" aria-label="Profile"><Avatar name={me.name} size={36} /></Link>
      </header>

      <div className="relative px-5 pt-6">
        <Well key={tossing ? "t" : "i"} hops={mine?.hops ?? []} tossing={tossing} />
        {mine ? (
          <Link to="/threads/$id" params={{ id: mine.id }} className="absolute inset-x-8 -bottom-3 rounded-[1.25rem] px-4 py-3 text-center glass">
            <p className="truncate text-[15px] font-semibold">{mine.text}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Ripple {ripples} · <Countdown to={mine.expiresAt} plain /> left</p>
          </Link>
        ) : (
          <p className="absolute inset-x-10 -bottom-3 rounded-[1.25rem] px-4 py-3 text-center text-sm text-muted-foreground glass">The water is still. Make a wish.</p>
        )}
      </div>
      <div className="px-5 pt-9">
        <button onClick={toss} disabled={tossing} className="btn btn-thread h-14 w-full text-[17px] font-semibold">Toss a wish</button>
      </div>

      <div className="mx-5 mt-6 overflow-hidden rounded-[1.5rem] glass">
        <Link to="/daily" className="flex items-center gap-3 px-4 py-3.5">
          <span className="text-2xl">{DAILY.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Today's wish · <Countdown to={DAILY.endsAt} plain /></p>
            <p className="truncate text-[15px] font-semibold">Find {DAILY.text}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        {passing[0] && (
          <Link to="/w/$hopId" params={{ hopId: passing[0].hops.at(-1)!.id }} className="flex items-center gap-3 border-t border-border/60 px-4 py-3.5">
            <Avatar name={passing[0].creator} size={30} />
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Help one step{passing.length > 1 ? ` · ${passing.length} waiting` : ""}</p>
              <p className="truncate text-[15px] font-semibold">{passing[0].creator} wants to {passing[0].text}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        )}
      </div>

      <section className="mx-5 mt-3 rounded-[1.5rem] p-4 glass">
        <div className="flex items-baseline justify-between">
          <p className="eyebrow">Your network</p>
          <span className="font-mono text-xs text-muted-foreground">{net.direct + net.far} people{fp ? ` · ${Math.round(fp.km).toLocaleString("en-US")} km` : ""}</span>
        </div>
        <NetworkGraph me={me.name} network={network} wishes={wishes} size={340} />
        {fp && <p className="text-center text-xs text-muted-foreground">🚶 Your forward is in {fp.route.at(-1)} right now</p>}
      </section>
    </AppShell>
  );
}
