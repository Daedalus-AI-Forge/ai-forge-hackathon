import type { CommunityNetwork, CommunityNode } from "@/lib/graphApi.types";

export const GRAPH_WIDTH = 720;
export const GRAPH_HEIGHT = 800;
export const GRAPH_CENTER = { x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 };
export type PositionedNode = CommunityNode & { x: number; y: number; distance: number | null };

function hash(key: string) {
  return [...key].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7);
}

/** Undirected degrees of separation, using identities and recorded edges only. */
export function networkDistances(graph: CommunityNetwork) {
  const adjacency = new Map(graph.nodes.map(node => [node.key, new Set<string>()]));
  for (const edge of graph.links) {
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) continue;
    adjacency.get(edge.source)!.add(edge.target);
    adjacency.get(edge.target)!.add(edge.source);
  }
  const distances = new Map<string, number>();
  const parents = new Map<string, string>();
  if (!adjacency.has(graph.meKey)) return { adjacency, distances, parents };
  const queue = [graph.meKey];
  distances.set(graph.meKey, 0);
  for (let i = 0; i < queue.length; i++) {
    const key = queue[i]!;
    for (const next of [...adjacency.get(key)!].sort()) {
      if (distances.has(next)) continue;
      distances.set(next, distances.get(key)! + 1);
      parents.set(next, key);
      queue.push(next);
    }
  }
  return { adjacency, distances, parents };
}

export function connectionAppearance(distance: number | null) {
  if (distance === null) return { opacity: 0.22, width: 0.8, dashed: true };
  if (distance <= 1) return { opacity: 0.95, width: 1.8, dashed: false };
  if (distance === 2) return { opacity: 0.52, width: 1.3, dashed: false };
  return { opacity: Math.max(0.14, 0.3 / (distance - 2)), width: 0.9, dashed: false };
}

/** Deterministic clustered layout; the viewer is pinned and nearer hops sit closer. */
export function layoutCommunity(graph: CommunityNetwork) {
  const { adjacency, distances, parents } = networkDistances(graph);
  const sorted = [...graph.nodes].sort((a, b) => a.key.localeCompare(b.key));
  const direct = sorted.filter(node => distances.get(node.key) === 1);
  const angles = new Map(direct.map((node, i) => [node.key, -Math.PI / 2 + i * Math.PI * 2 / direct.length]));
  // Spread descendants around the first-degree connection that leads to them.
  for (const [key, depth] of [...distances].sort((a, b) => a[1] - b[1])) {
    if (depth < 2) continue;
    const parent = parents.get(key)!;
    angles.set(key, (angles.get(parent) ?? 0) + ((hash(key) % 100) / 100 - 0.5) * 1.2);
  }
  const anchors = new Map<string, { x: number; y: number }>();
  let cluster = 0;
  for (const node of sorted) {
    if (distances.has(node.key) || anchors.has(node.key)) continue;
    const angle = -2.45 + cluster++ * 2.39996;
    const anchor = { x: GRAPH_CENTER.x + Math.cos(angle) * 270, y: GRAPH_CENTER.y + Math.sin(angle) * 315 };
    const queue = [node.key];
    anchors.set(node.key, anchor);
    for (let i = 0; i < queue.length; i++) {
      for (const next of adjacency.get(queue[i]!) ?? []) {
        if (anchors.has(next)) continue;
        anchors.set(next, anchor);
        queue.push(next);
      }
    }
  }
  const placed: PositionedNode[] = sorted.map(node => {
    const distance = distances.get(node.key) ?? null;
    const angle = angles.get(node.key) ?? hash(node.key) * 0.01;
    const radius = distance === 0 ? 0 : distance === 1 ? 138 : Math.min(225 + ((distance ?? 2) - 2) * 48, 310);
    const anchor = anchors.get(node.key);
    return { ...node, distance,
      x: anchor ? anchor.x + Math.cos(angle) * 40 : GRAPH_CENTER.x + Math.cos(angle) * radius,
      y: anchor ? anchor.y + Math.sin(angle) * 40 : GRAPH_CENTER.y + Math.sin(angle) * radius,
    };
  });
  const byKey = new Map(placed.map(node => [node.key, node]));
  const closeGap = direct.length > 30 ? 38 : direct.length > 12 ? 64 : 94;
  // Small bounded relaxation keeps clusters organic without runtime animation/jitter.
  for (let step = 0; step < 70; step++) {
    const forces = new Map(placed.map(node => [node.key, { x: 0, y: 0 }]));
    const cells = new Map<string, number[]>();
    for (let i = 0; i < placed.length; i++) {
      const node = placed[i]!;
      const key = `${Math.floor(node.x / 94)},${Math.floor(node.y / 94)}`;
      const indices = cells.get(key) ?? [];
      indices.push(i);
      cells.set(key, indices);
    }
    for (let i = 0; i < placed.length; i++) {
      const a = placed[i]!;
      const cellX = Math.floor(a.x / 94); const cellY = Math.floor(a.y / 94);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        for (const j of cells.get(`${cellX + ox},${cellY + oy}`) ?? []) {
        if (j <= i) continue;
        const b = placed[j]!;
        const dx = a.x - b.x || 0.1; const dy = a.y - b.y || 0.1;
        const length = Math.hypot(dx, dy);
        const gap = (a.distance !== null && a.distance <= 1) || (b.distance !== null && b.distance <= 1) ? closeGap : 36;
        if (length >= gap) continue;
        const push = (gap - length) * 0.12;
        forces.get(a.key)!.x += dx / length * push; forces.get(a.key)!.y += dy / length * push;
        forces.get(b.key)!.x -= dx / length * push; forces.get(b.key)!.y -= dy / length * push;
        }
      }
    }
    for (const edge of graph.links) {
      const a = byKey.get(edge.source); const b = byKey.get(edge.target);
      if (!a || !b) continue;
      const dx = b.x - a.x; const dy = b.y - a.y;
      const length = Math.hypot(dx, dy) || 1;
      const ideal = a.distance === null ? 65 : 110;
      const pull = (length - ideal) * 0.012;
      forces.get(a.key)!.x += dx / length * pull; forces.get(a.key)!.y += dy / length * pull;
      forces.get(b.key)!.x -= dx / length * pull; forces.get(b.key)!.y -= dy / length * pull;
    }
    for (const node of placed) {
      if (node.key === graph.meKey) continue;
      const force = forces.get(node.key)!;
      const dx = node.x - GRAPH_CENTER.x; const dy = node.y - GRAPH_CENTER.y;
      const length = Math.hypot(dx, dy) || 1;
      const targetRadius = node.distance === 1 ? 138 : Math.min(225 + ((node.distance ?? 2) - 2) * 48, 310);
      const anchor = anchors.get(node.key);
      if (anchor) {
        force.x += (anchor.x - node.x) * 0.014;
        force.y += (anchor.y - node.y) * 0.014;
      } else {
        force.x += dx / length * (targetRadius - length) * 0.05;
        force.y += dy / length * (targetRadius - length) * 0.05;
      }
      node.x = Math.max(40, Math.min(GRAPH_WIDTH - 40, node.x + force.x));
      node.y = Math.max(55, Math.min(GRAPH_HEIGHT - 55, node.y + force.y));
    }
  }
  return { nodes: placed, byKey, parents, distances };
}

export function pathToViewer(selectedKey: string | null, parents: Map<string, string>) {
  const path = new Set<string>();
  let key = selectedKey;
  while (key && !path.has(key)) {
    path.add(key);
    key = parents.get(key) ?? null;
  }
  return path;
}
