# Snake Powerups — Design

## Intent

Make the personal site's Snake game more varied through occasional collectible fruit with short, readable effects. Preserve the existing canvas game and its queued-turn behavior.

## Scope

Generate the first pickup immediately when the score reaches 5. Later pickups appear after a random 10–30 second delay; each pickup expires after 5 seconds or collection, then starts the next delay. Add nine pickups: speed (40 moves), one enlarged target apple, one tail-collision pass, one wall wrap, immediate tail trim by 3 segments, double points for 3 apples, a target that moves one cell toward the snake every 5 moves for up to 40 moves, 3 bonus apples for 15 seconds, and a two-endpoint portal.

Portal pickup pauses movement for 8 seconds. Arrow keys move a marker; A places the first endpoint and B the second. If placement times out, cancel placement and resume. A completed pair lasts until game end; another lemon starts placement for a replacement pair. The placement countdown appears in the inventory HUD; placed portals have no expiry timer.

Distinct pixel fruit icons are drawn in the canvas and in a fixed-order inventory beside the profile photo. Score, countdown and short status messages sit above the inventory. Different effects coexist; collecting a timed effect again refreshes its timer. One-use collision effects can hold at most two charges. The snake uses `#5BCEFA`; the regular apple uses `#F5A9B8`.

## Constraints and exclusions

Keep the existing game loop and static-site stack. Do not add external image or runtime dependencies. Do not add hazards or a slow-down pickup. Keep color values as unlabeled hex values in code and source material.

## Implementation approach

Extend the current loop with small helpers for scheduling, effects, portal placement, and pixel-art drawing. Keep movement, collision handling, and effect countdowns synchronized in that loop. Use the existing A/B mobile controls for endpoint confirmation.

## Acceptance

Browser checks cover the immediate 5-point pickup, no unlock prompt, top-right HUD placement, randomized wait bounds, pickup expiry/restart, each effect, overlapping effects, occupied-cell-safe spawning, portal placement controls/timeouts/countdowns, and desktop/mobile rendering. The static build must still publish the Snake script and stylesheet.
