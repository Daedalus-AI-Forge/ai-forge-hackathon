import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/rt/bits";
import { ThreadMap } from "@/components/rt/ThreadMap";
import { useStore } from "@/lib/store";
import { TIER_LABEL, tierFor } from "@/lib/rules";

export const Route = createFileRoute("/threads/")({
  head: () => ({ meta: [
    { title: "My wishes — Wishwell" },
    { name: "description", content: "Wishes you made and wishes you helped." },
    { property: "og:title", content: "My wishes — Wishwell" },
    { property: "og:description", content: "Wishes you made and wishes you helped." },
  ] }),
  component: Threads,
});
const STATUS = { active: "Live", pending: "Confirming", connected: "Waiting to meet", completed: "Completed", broken: "Faded" };

function Threads() {
  const { wishes, me } = useStore();
  const mine = wishes.filter((w) => w.hops.some((h) => h.name === me.name));
  return (
    <AppShell eyebrow="Started & joined" title="My wishes">
      <div className="space-y-4 px-4">
        {mine.map((w) => {
          const myIdx = w.hops.findIndex((h) => h.name === me.name);
          const total = w.hops.length - 1;
          return (
            <Link key={w.id} to="/threads/$id" params={{ id: w.id }} className="block rounded-[1.75rem] p-2 glass">
              <ThreadMap hops={w.hops} compact highlight={myIdx} />
              <div className="px-3 pb-2 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-thread px-2.5 py-1 text-[11px] font-semibold text-thread-foreground">
                    {myIdx === 0 ? "Your wish" : `You were ripple ${myIdx} of ${total}`}
                  </span>
                  <span className="text-xs text-muted-foreground">{STATUS[w.status]}{w.status === "completed" ? ` · ${TIER_LABEL[tierFor(total)]}` : ""}</span>
                </div>
                <h3 className="mt-2 text-[18px] font-semibold leading-snug">{w.text}</h3>
                <div className="mt-3 flex items-center gap-1">
                  {w.hops.map((h, i) => (
                    <div key={h.id} className="flex items-center gap-1">
                      {i > 0 && <span className="h-px w-3 bg-thread" />}
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ${i === myIdx ? "bg-primary font-semibold text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {i === myIdx ? "You" : h.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
