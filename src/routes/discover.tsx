import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, Avatar } from "@/components/rt/bits";
import { WishCard } from "@/components/rt/WishCard";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/discover")({
  head: () => ({ meta: [
    { title: "Discover — Wishwell" },
    { name: "description", content: "Live challenges moving through your friends. Help a wish find the right person." },
    { property: "og:title", content: "Discover — Wishwell" },
    { property: "og:description", content: "Live challenges moving through your friends. Help a wish find the right person." },
  ] }),
  component: Index,
});

function Index() {
  const { wishes, me } = useStore();
  const active = wishes.filter((w) => w.status === "active");
  return (
    <AppShell eyebrow="Friends' wishes" title="Discover" action={<Link to="/me" aria-label="Profile"><Avatar name={me.name} size={36} /></Link>}>
      <div className="space-y-5 px-4">
        {active.map((w) => <WishCard key={w.id} w={w} />)}
        {active.length === 0 && <p className="py-10 text-center text-muted-foreground">No live challenges.</p>}
      </div>
    </AppShell>
  );
}
