# World tab: the wish network as a globe, polaroid endings

Ask: the network map looked cramped and ugly, and was buried in Me. Make the whole
thing feel like "the whole world is connected", give it priority in the app, and let
every successful wish chain I'm on open to its final group photo, styled as a polaroid.

## Decisions
- **Own tab.** "World" sits second in the tab bar, a night scene like the Pool. Me
  keeps a link card; the old flat graph (`EgoGraph`, `MeNetwork`, `layoutCommunity`)
  is retired, and its rules (same-name people stay distinct, dangling edges can't
  invent anyone, empty graphs work) are now tested against the globe layout.
- **A planet of people, not a map.** Placement is by relationship distance on a
  sphere: you face the camera, 1 step on the near ring, farther steps round the
  curve, unconnected groups on the far side (visible faintly through the glass).
  Real geography was rejected because the live network is almost all Bay Area and
  would collapse into one dot. No continents are drawn, so nothing claims a location.
- **Same data and privacy as before.** The globe reads `graph.communityNetwork`
  unchanged. Private notes and Forget stay with your own contacts.
- **Chains that came true** (`chains.mine`): wishes I made, wishes where my pushed
  branch found the person, and wishes where I said "it's me" and was confirmed. A
  pending claim doesn't count, and neither does a branch that went nowhere. Finders
  who hid their name stay "Someone"; users hidden from the network get no map key.
- **Photo.** `wish.photoUrl`, else the finder's proof photo. The meeting-backend
  branch's approved `wish.meetingPhoto` should go first once merged (one helper,
  `chainPhotoUrl`). No new upload flow here; that branch owns upload and approval.
- **Real geography where it is true:** the chain page draws the route between the
  chain's known cities on a small globe (the flat map cropped Tokyo and SF off its
  edges). Unknown cities are skipped, not guessed.
