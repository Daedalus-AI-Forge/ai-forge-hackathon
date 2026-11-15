import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { CirclePlus, Sparkles, User, Waves } from "lucide-react";

export function useNow(ms = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
export function Countdown({ to, className = "", plain = false }: { to: number; className?: string; plain?: boolean }) {
  const now = useNow();
  if (now === null) return <span className={`font-mono ${className}`}>--:--:--</span>;
  const d = Math.max(0, to - now);
  const h = Math.floor(d / 3600_000), m = Math.floor((d % 3600_000) / 60_000), s = Math.floor((d % 60_000) / 1000);
  const p = (x: number) => String(x).padStart(2, "0");
  return <span className={`font-mono font-medium tabular-nums ${d < 3600_000 && !plain ? "text-thread" : ""} ${className}`}>{p(h)}:{p(m)}:{p(s)}</span>;
}
const TONES = ["oklch(0.9 0.03 60)", "oklch(0.88 0.02 150)", "oklch(0.88 0.025 240)", "oklch(0.9 0.03 20)", "oklch(0.86 0.015 80)"];
export function Avatar({ name, size = 32, ring = false }: { name: string; size?: number; ring?: boolean }) {
  const bg = TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium text-foreground ${ring ? "ring-2 ring-background" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.4, background: bg }}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
export function AppShell({ children, title, eyebrow, action }: { children: ReactNode; title?: string; eyebrow?: string; action?: ReactNode }) {
  const path = useLocation().pathname;
  const tab = (to: string, label: string, Icon: typeof User) => {
    const on = to === "/" ? path === "/" : path.startsWith(to);
    return (
      <Link to={to as "/"} aria-label={label} className={`flex h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-medium transition ${on ? "text-foreground" : "text-muted-foreground"}`}>
        <Icon className="h-[22px] w-[22px]" strokeWidth={on ? 2.2 : 1.6} />{label}
      </Link>
    );
  };
  return (
    <div className="ambient min-h-screen">
      <div className="mx-auto min-h-screen max-w-[430px] pb-32">
        {title && (
          <header className="flex items-end justify-between px-5 pt-12 pb-4">
            <div>
              {eyebrow && <p className="eyebrow">{eyebrow}</p>}
              <h1 className="font-display text-[34px] font-bold leading-tight">{title}</h1>
            </div>
            {action}
          </header>
        )}
        {children}
      </div>
      <nav className="fixed bottom-5 left-1/2 z-20 flex w-[calc(100%-2.5rem)] max-w-[390px] -translate-x-1/2 items-center gap-1 rounded-full p-1.5 glass">
        {tab("/", "Well", Waves)}
        {tab("/wish", "Toss a wish", CirclePlus)}
        {tab("/threads", "My wishes", Sparkles)}
        {tab("/me", "Me", User)}
      </nav>
    </div>
  );
}
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[1.5rem] glass p-5 ${className}`}>{children}</div>;
}
export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return <div><div className="font-display font-semibold text-3xl leading-none">{value}</div><div className="eyebrow mt-1.5">{label}</div></div>;
}
