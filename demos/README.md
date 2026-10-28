# Demos

## This directory is not the `demos/` bucket prefix

Nothing here is published. `scripts/build_site.py` never reads this directory,
and `tests/test_build_site.py::DemosPrefixReservationTests` asserts that the
build never emits `dist/demos/`.

The interactive research tools at `murraysbennett.com/demos/<slug>/` are
deployed from **their own repositories**, by per-tool workflows cloned from
`projects/grin/.github/workflows/deploy.yaml`, into a reserved `demos/` prefix
on this bucket. Both of this site's `aws s3 sync --delete` steps carry
`--exclude 'demos/*'` so that a CV update cannot wipe them; the test above is
what keeps that true.

To add a tool: clone grin's workflow into the tool's repo, scope its sync and
its CloudFront invalidation to `demos/<slug>/`, keep the pre-upload sha256
provenance gate and the three-tier cache headers, and add a tile to
`data/tools.json`. No change is needed here or in the deploy workflow.

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
