import { useMemo } from "react";
import type { Hop } from "@/lib/store";
import { Avatar } from "./bits";
import poolImg from "@/assets/well-pool.jpg";

// Seeded pseudo-random so SSR and client render the same coins.
function rng(seed: number) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

export function Well({ hops, tossing = false }: { hops: Hop[]; tossing?: boolean }) {
  const _coins = useMemo(() => {
    const r = rng(7);
    return Array.from({ length: 46 }, (_, i) => {
      const a = r() * Math.PI * 2, d = 30 + Math.sqrt(r()) * 118;
      return { i, x: 170 + Math.cos(a) * d, y: 170 + Math.sin(a) * d * 0.98, s: 7 + r() * 6, rot: r() * 180, tone: r() > 0.25 ? "gold" : "silver", delay: r() * 6 };
    });
  }, []);
  const holders = hops.slice(1);
  const ringR = [62, 98, 134];
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[340px]">
      <svg viewBox="0 0 340 340" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <radialGradient id="water" cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor="oklch(0.62 0.07 200)" />
            <stop offset="65%" stopColor="oklch(0.42 0.07 215)" />
            <stop offset="100%" stopColor="oklch(0.28 0.05 225)" />
          </radialGradient>
          <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.95 0.015 80)" />
            <stop offset="100%" stopColor="oklch(0.8 0.02 70)" />
          </linearGradient>
          <radialGradient id="gold" cx="35%" cy="30%"><stop offset="0%" stopColor="oklch(0.95 0.1 95)" /><stop offset="100%" stopColor="oklch(0.7 0.13 75)" /></radialGradient>
          <radialGradient id="silver" cx="35%" cy="30%"><stop offset="0%" stopColor="oklch(0.97 0 0)" /><stop offset="100%" stopColor="oklch(0.72 0.01 250)" /></radialGradient>
          <radialGradient id="redcoin" cx="35%" cy="30%"><stop offset="0%" stopColor="oklch(0.78 0.16 25)" /><stop offset="100%" stopColor="oklch(0.5 0.2 22)" /></radialGradient>
          <clipPath id="pool"><circle cx="170" cy="170" r="156" /></clipPath>
          {/* Water refraction: coins wobble as if seen through moving water */}
          <filter id="refract" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="2" seed="3" result="n">
              <animate attributeName="baseFrequency" dur="14s" values="0.012 0.02;0.016 0.026;0.012 0.02" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          {/* Caustic light network on the pool floor */}
          <filter id="caustics" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="turbulence" baseFrequency="0.035" numOctaves="2" seed="8" result="t">
              <animate attributeName="seed" dur="9s" values="8;9;10;11;12;13;14;15;8" repeatCount="indefinite" calcMode="discrete" />
            </feTurbulence>
            <feColorMatrix in="t" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 0.95  0 0 0 -9 3.2" />
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
          <radialGradient id="depth" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="oklch(0.15 0.04 230 / 0)" />
            <stop offset="100%" stopColor="oklch(0.15 0.04 230 / 0.75)" />
          </radialGradient>
          <linearGradient id="sheen" x1="0" y1="0" x2="0.7" y2="1">
            <stop offset="0%" stopColor="oklch(1 0 0 / 0.38)" />
            <stop offset="35%" stopColor="oklch(1 0 0 / 0.05)" />
            <stop offset="100%" stopColor="oklch(1 0 0 / 0)" />
          </linearGradient>
          <radialGradient id="contact" cx="50%" cy="50%"><stop offset="0%" stopColor="oklch(0.1 0.03 230 / 0.55)" /><stop offset="100%" stopColor="oklch(0.1 0.03 230 / 0)" /></radialGradient>
        </defs>
        <ellipse cx="170" cy="184" rx="166" ry="160" fill="oklch(0.35 0.04 220 / 0.2)" style={{ filter: "blur(12px)" }} />
        <clipPath id="outer"><circle cx="170" cy="170" r="168" /></clipPath>
        <image href={poolImg} x="0" y="0" width="340" height="340" clipPath="url(#outer)" preserveAspectRatio="xMidYMid slice" />
        <g clipPath="url(#pool)">
          <image href={poolImg} x="0" y="0" width="340" height="340" filter="url(#refract)" opacity="0.9" preserveAspectRatio="xMidYMid slice" />
          <rect x="18" y="18" width="304" height="304" filter="url(#caustics)" opacity="0.1" style={{ mixBlendMode: "screen" }} />
          <circle cx="170" cy="170" r="152" fill="url(#depth)" />
          {/* Surface ripples: soft light/shadow pairs, red only for the wish */}
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <circle cx="170" cy="171.5" r="20" fill="none" stroke="oklch(0.15 0.04 230 / 0.35)" className="ripple" style={{ animationDelay: `${i * 1.1}s` }} />
              <circle cx="170" cy="170" r="20" fill="none" stroke="oklch(1 0 0 / 0.55)" className="ripple" style={{ animationDelay: `${i * 1.1}s` }} />
            </g>
          ))}
          <circle cx="170" cy="170" r="20" fill="none" className="stroke-thread ripple" strokeWidth="1.5" style={{ animationDelay: "0.4s", animationDuration: "4.4s" }} />
          {ringR.map((r) => <circle key={r} cx="170" cy="170" r={r} fill="none" stroke="oklch(1 0 0 / 0.16)" strokeDasharray="2 7" />)}
          {/* Sky reflection sweeping across the surface */}
          <ellipse cx="110" cy="80" rx="150" ry="70" fill="url(#sheen)" transform="rotate(-25 110 80)" className="caustic" />
          {tossing && (
            <g>
              {[0, 1, 2].map((i) => <circle key={i} cx="170" cy="170" r="10" fill="none" stroke="oklch(1 0 0 / 0.9)" className="splash" style={{ animationDelay: `${0.62 + i * 0.12}s` }} />)}
            </g>
          )}
        </g>
        {/* Wish coin: soft shadow beneath, light reflected in the water */}
        <ellipse cx="173" cy="176" rx="20" ry="15" fill="oklch(0.1 0.03 230 / 0.35)" style={{ filter: "blur(3px)" }} />
        <g className={tossing ? "coin-toss" : "coin-bob"}>
          <circle cx="170" cy="170" r="20" fill="url(#redcoin)" />
          <circle cx="170" cy="170" r="14" fill="none" stroke="oklch(1 0 0 / 0.45)" />
          <text x="170" y="175" textAnchor="middle" fontSize="14" fill="white">✦</text>
        </g>
      </svg>
      {holders.map((h, i) => {
        const depth = Math.min(i, 2);
        const a = -Math.PI / 2 + i * 2.1 + depth * 0.6;
        const r = ringR[depth]! / 340 * 100;
        return (
          <div key={h.id} className="holder-in absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background"
            style={{ left: `${50 + Math.cos(a) * r}%`, top: `${50 + Math.sin(a) * r}%`, animationDelay: `${0.3 + i * 0.25}s` }}>
            <Avatar name={h.name} size={30} />
          </div>
        );
      })}
    </div>
  );
}
