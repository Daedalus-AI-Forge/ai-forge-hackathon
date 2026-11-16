# Network Overview Implementation Plan

**Goal:** Show the community graph with the viewer's paths solid and progressively lighter by relationship distance.
**Spec:** docs/plans/network-overview-design.md
**Architecture:** A read-only Convex graph query returns a privacy-safe projection. A pure TypeScript layout computes shortest distances and stable positions. React Native renders the graph and existing private details.
**Tech Stack:** Convex, TypeScript, React Native/Expo.

## Constraints
- Preserve unrelated in-progress edits and shared design tokens.
- Do not infer identities or relationships from matching names.
- Read bounds must report truncation. No writes to application data for preview.
- Do not expose other owners' private evidence or opted-out users.
- No commit, push or production deployment as part of this refinement.

## Tasks
- [x] Backend: add graph.communityNetwork with args/returns validators and privacy/identity/bounds tests. Contract: null or {meKey,nodes:[{key,name,personKeys:string[],edgeIds:Id<edges>[],kind:'user'|'contact'}],links:[{key,source,target}],truncated:boolean}.
- [x] UI: replace paginated ego ring with the full spatial graph, hop-based solid/dashed treatment, selection path, pan/zoom/recenter and truthful loading/empty/partial copy. Keep own-contact details and forget actions.
- [x] Verify: backend tests, graph-distance tests, typecheck, targeted lint, Expo doctor and mobile browser fixture interactions. Update build log with actual checks and deployment status.

## Review focus
Disconnected components; names shared by different users; opted-out endpoints;
missing/deleted hops; empty and single-user graphs; selection after data changes;
narrow viewports; bounds disclosure; existing caller identity precedence.
