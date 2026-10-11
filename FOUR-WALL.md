# Four-sided wall

- 84 tiles, 42 two-tile stacks. South/east/north/west: 11/10/11/10 stacks.
- Server-side cryptographic Fisher-Yates shuffle with rejection sampling.
- Two dice. Count sides from the dealer (dealer counts as one), then skip the dice sum in stacks on that side, continuing around a corner when needed. This is the app's explicit house convention.
- Starting at the dealer, take four tiles per player for three rounds, then one each and one extra for the dealer. There are 44 tiles left.
- Normal draws consume the front. Kong supplements consume the opposite end. No reserved dead wall.
- Initial deal order is private to its owner; the existing bench spectator can see all hands. Undrawn tiles remain hidden from every client.
- Existing rounds retain their stored wall. Start a new round to use the new layout.

Upload src, server, dist, package.json and build.mjs to the root of kawuxing-server. Render build/start commands are unchanged. Deploy between games.
