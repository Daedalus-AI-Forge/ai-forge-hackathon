import { Link } from "@tanstack/react-router";
import { Share } from "lucide-react";
import { Avatar, Countdown } from "./bits";
import { WISH_TYPES, type Wish } from "@/lib/store";
import { COVERS } from "@/lib/covers";
import { shareLink } from "@/lib/share";

export function WishCard({ w }: { w: Wish }) {
  const t = WISH_TYPES.find((x) => x.id === w.type)!;
  const last = w.hops.at(-1)!;
  return (
    <article className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-soft">
      <img src={COVERS[w.type]} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" width={864} height={1152} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60" />
      <div className="absolute inset-x-4 top-4 flex items-center justify-between">
        <span className="rounded-full px-3 py-1.5 text-xs font-medium glass-dark">{t.emoji} {t.label}</span>
        <span className="rounded-full px-3 py-1.5 glass-dark"><Countdown to={w.expiresAt} className="text-xs" plain /></span>
      </div>
      <div className="absolute inset-x-3 bottom-3 rounded-[1.5rem] p-4 glass-dark">
        <Link to="/threads/$id" params={{ id: w.id }} className="block">
          <div className="flex items-center gap-2 text-xs opacity-80">
            <div className="flex -space-x-1.5">{w.hops.map((h) => <Avatar key={h.id} name={h.name} size={20} />)}</div>
            {w.creator} · {w.hops.length - 1} ripples
          </div>
          <h3 className="mt-2 font-display text-[22px] font-semibold leading-tight">{w.text}</h3>
        </Link>
        <div className="mt-4 flex gap-2 text-sm">
          <Link to="/w/$hopId" params={{ hopId: last.id }} search={{ a: "me" }} className="btn h-11 flex-1 glass-light">It's me</Link>
          <Link to="/w/$hopId" params={{ hopId: last.id }} search={{ a: "forward" }} className="btn btn-thread h-11 flex-1">I know someone</Link>
          <button aria-label="Share to group chat" onClick={() => shareLink(`/w/${last.id}`, `${w.creator}'s wish: ${w.text} 🔴`)} className="btn h-11 w-11 glass-dark"><Share className="h-4 w-4" /></button>
        </div>
      </div>
    </article>
  );
}
