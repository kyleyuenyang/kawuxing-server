# Online rooms

Run Node.js 22 or newer. From this folder:

```sh
npm install
npm run build
node server/index.js
```

Open http://localhost:8789/ to create or join a room. On phones on the
same Wi-Fi, use http://YOUR_COMPUTER_LAN_IP:8789/ instead.
Use distinct browser profiles/devices for distinct players.
Room credentials are saved in each browser for reconnection.

For Internet access deploy this entire project on a Node hosting service:
build command `npm install && npm run build`; start command
`node server/index.js`. Use the host's HTTPS URL, not localhost.
Configure a persistent disk and DATA_DIR for rooms.json. Run ONE process
and ONE replica. JSON storage does not support multiple replicas.
Rooms expire after 24 hours without actions. Back up the data directory.
Do not publish data/ or rooms.json: these contain private hands and tokens.

GitHub Pages cannot run this server. Its online.html can connect by entering
your HTTPS server URL. ALLOWED_ORIGINS defaults to
https://kyleyuenyang.github.io; set it to the exact frontend origins as needed.
The server can also serve the whole website itself (preferred).

This is a friends-only test build, not a hardened public service. There is
no account system, anti-abuse rate limiting, spectator seat, or automatic
timeout for disconnected unrevealed players. Do not expose it at scale.
No gambling/payment features. Gameplay uses entertainment points only.
