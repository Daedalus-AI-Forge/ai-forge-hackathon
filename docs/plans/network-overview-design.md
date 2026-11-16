# Network overview refinement

The user clarified that the map must show the wider network of users, with the
viewer's own connected paths solid and darker at fewer hops from the viewer.
Keep the existing shared palette and any in-progress theme changes.

Use real registered-user identities and actual parent/child wish hops for the
community topology, plus the viewer's own saved contacts. Never join users by
matching names. Respect showInLogs and itsMePublic; other users' private tags,
reasons and contact data are not part of the overview payload.

Render one spatial map, not pages of an ego ring. Center the viewer, give nearby
connections prominence, keep remote/disconnected communities faint and dashed.
Allow zoom, pan and recenter. Selection highlights a shortest path and retains
private detail actions for the viewer's own contacts. A legend explains distance.
Bound reads and clearly disclose a partial network when a bound is reached.

Alternatives considered: decorative background nodes would invent relationships;
a personal-only ring cannot satisfy the clarified scope. Use real topology and
one deterministic, distance-aware layout. This is the implementation choice for
the user's explicit correction, not a new visual design approval request.
