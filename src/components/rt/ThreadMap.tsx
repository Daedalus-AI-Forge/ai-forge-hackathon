import map from "@/assets/world-map.jpg";
import { CITIES, type Hop } from "@/lib/store";

const proj = (c: { lat: number; lng: number }) => ({ x: ((c.lng + 180) / 360) * 1000, y: ((90 - c.lat) / 180) * 500 });

export function ThreadMap({ hops, compact = false, highlight }: { hops: Hop[]; compact?: boolean; highlight?: number }) {
  const pts = hops.map((h, i) => {
    const p = proj(CITIES[h.city] ?? { lat: 37.77, lng: -122.42 });
    return { ...p, x: p.x + (i % 2 ? 6 : 0) * (hops.filter((x) => x.city === h.city).length > 1 ? 1 : 0), h };
  });
  let d = "";
  pts.forEach((p, i) => {
    if (i === 0) { d = `M${p.x},${p.y}`; return; }
    const a = pts[i - 1]!;
    const mx = (a.x + p.x) / 2, my = Math.min(a.y, p.y) - Math.max(30, Math.abs(p.x - a.x) * 0.18);
    d += ` Q${mx},${my} ${p.x},${p.y}`;
  });
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-muted ${compact ? "h-28" : ""}`}>
      <svg viewBox="0 40 1000 360" className="block h-full w-full" preserveAspectRatio="xMidYMid slice">
        <image href={map} x="0" y="0" width="1000" height="500" />
        <path key={d} d={d} fill="none" className="stroke-thread thread-draw" strokeWidth={compact ? 4 : 2.5} strokeLinecap="round" pathLength={1} />
        {pts.map((p, i) => (
          <g key={p.h.id}>
            <circle cx={p.x} cy={p.y} r={i === highlight ? 13 : compact ? 8 : 6} className={i === highlight ? "fill-thread stroke-card" : "fill-card stroke-thread"} strokeWidth={3} />
            {!compact && <text x={p.x} y={p.y - 14} textAnchor="middle" className="fill-foreground" fontSize="15" fontFamily="Geist Mono" fontWeight="500">{i === 0 ? "●" : i}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}
