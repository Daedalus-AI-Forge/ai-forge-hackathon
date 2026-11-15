/** Pure helpers for the toss screen's 1–3 recipients (kept RN-free so vitest can run them). */

type Slot = { name: string; reason: string };

/**
 * Prefill coach suggestions into recipient slots: blank slots first, then new slots up to `max`.
 * Never overwrites a typed name and skips names already present (case-insensitive).
 * Returns the same array when nothing changes.
 */
export function prefillPeople<P extends Slot>(people: P[], picks: { name: string; why: string }[], max: number, empty: () => P): P[] {
  const next = [...people];
  const has = (n: string) => next.some((p) => p.name.trim().toLowerCase() === n.trim().toLowerCase());
  let changed = false;
  for (const pick of picks) {
    if (!pick.name.trim() || has(pick.name)) continue;
    const blank = next.findIndex((p) => !p.name.trim());
    if (blank >= 0) next[blank] = { ...next[blank], name: pick.name, reason: next[blank].reason || pick.why };
    else if (next.length < max) next.push({ ...empty(), name: pick.name, reason: pick.why });
    else continue;
    changed = true;
  }
  return changed ? next : people;
}

/** Label of the "Text all" button after `opened` people have had Messages opened; null when done. */
export function textAllLabel(names: string[], opened: number): string | null {
  if (opened >= names.length) return null;
  if (opened > 0) return `Next: text ${names[opened]}`;
  return names.length === 1 ? `Text ${names[0]}` : `Text all ${names.length}`;
}
