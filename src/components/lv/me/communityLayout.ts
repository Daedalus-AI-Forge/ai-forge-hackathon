import type { CommunityNetwork } from "@/lib/graphApi.types";

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

export function pathToViewer(selectedKey: string | null, parents: Map<string, string>) {
  const path = new Set<string>();
  let key = selectedKey;
  while (key && !path.has(key)) {
    path.add(key);
    key = parents.get(key) ?? null;
  }
  return path;
}
