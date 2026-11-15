import { Avatar } from "@/components/rt/bits";
import type { Person, Wish } from "@/lib/store";

export type Node = { name: string; ring: 0 | 1 | 2; x: number; y: number; city?: string };

export function buildNetwork(me: string, network: Person[], wishes: Wish[]) {
  const direct = network.map((p) => p.name).filter((n) => n !== me);
  const far = [...new Set(wishes.flatMap((w) => w.hops.map((h) => h.name)))].filter((n) => n !== me && !direct.includes(n));
  const place = (names: string[], r: number, ring: 1 | 2, off: number): Node[] =>
    names.map((name, i) => { const a = off + (i / Math.max(1, names.length)) * Math.PI * 2; return { name, ring, x: 50 + Math.cos(a) * r, y: 50 + Math.sin(a) * r }; });
  const nodes: Node[] = [{ name: me, ring: 0, x: 50, y: 50 }, ...place(direct, 24, 1, -Math.PI / 2), ...place(far, 42, 2, -Math.PI / 3)];
  const at = (n: string) => nodes.find((x) => x.name === n);
  const edges = new Map<string, [Node, Node]>();
  direct.forEach((n) => edges.set(`${me}|${n}`, [nodes[0]!, at(n)!]));
  wishes.forEach((w) => w.hops.forEach((h, i) => {
    if (!i) return; const a = at(w.hops[i - 1]!.name), b = at(h.name);
    if (a && b && a !== b) edges.set([a.name, b.name].sort().join("|"), [a, b]);
  }));
  return { nodes, edges: [...edges.values()], direct: direct.length, far: far.length };
}

export function NetworkGraph({ me, network, wishes, size = 320, labels = true }: { me: string; network: Person[]; wishes: Wish[]; size?: number; labels?: boolean }) {
  const { nodes, edges } = buildNetwork(me, network, wishes);
  return (
    <div className="relative mx-auto aspect-square w-full" style={{ maxWidth: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <circle cx="50" cy="50" r="24" fill="none" className="stroke-foreground/10" strokeDasharray="1 1.5" strokeWidth="0.3" />
        <circle cx="50" cy="50" r="42" fill="none" className="stroke-foreground/10" strokeDasharray="1 1.5" strokeWidth="0.3" />
        {edges.map(([a, b]) => (
          <line key={a.name + b.name} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={a.ring === 0 ? 0.5 : 0.35}
            className={a.ring === 0 || b.ring === 0 ? "stroke-thread/70" : "stroke-foreground/25"} />
        ))}
      </svg>
      {nodes.map((n) => (
        <div key={n.name} className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${n.x}%`, top: `${n.y}%` }}>
          {labels ? <Avatar name={n.name} size={n.ring === 0 ? 44 : n.ring === 1 ? 30 : 22} ring /> : <span className={`block rounded-full ${n.ring === 0 ? "h-3.5 w-3.5 bg-thread" : n.ring === 1 ? "h-2.5 w-2.5 bg-foreground/70" : "h-2 w-2 bg-foreground/30"}`} />}
          {labels && <p className={`mt-0.5 whitespace-nowrap text-[10px] ${n.ring === 0 ? "font-semibold" : "text-muted-foreground"}`}>{n.ring === 0 ? "You" : n.name}</p>}
        </div>
      ))}
    </div>
  );
}
