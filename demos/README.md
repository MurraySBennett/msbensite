# Demos

## paddle task — removed 2026-08-17

An offline build of the paddle client was attempted here and removed, because it
could not work.

The client is not authoritative for ball physics. It reads ball state from the
server every frame and extrapolates forward purely for smooth rendering
(`Ball.move()` writes to `this.x/this.y`, never back to `state.balls`). A shim
that supplies spawn parameters once therefore renders balls drifting from a
stale snapshot, with no hit detection.

Making it faithful means porting `_step_physics`, `_check_paddle_hit` and the
tick loop out of `paddle_exp/game.py` — roughly 250 lines of JS that would then
need re-verifying every time the real physics change.

**Decision:** link through to a configured session on the paddle-exp site
instead, which already has a full demo surface (`demo.html`, `sandbox.html`,
`sim.html`). One implementation, no divergence.

`movePractice()` in the client *is* self-contained, if a zero-dependency version
is ever wanted — but it is the simplified practice physics, single paddle only.
