# Snake Powerups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add nine timed fruit powerups to the existing Snake game.

**Architecture:** Extend the existing canvas movement loop with one pickup scheduler and independent effect state. Use the current keyboard and virtual-gamepad events for direction and portal endpoint placement.

**Tech Stack:** Plain JavaScript, Canvas 2D, existing static-site build and Playwright browser checks.

**Spec:** `docs/superpowers/specs/2026-10-28-snake-powerups-design.md`

## Global Constraints

- No external runtime or image dependencies.
- Keep the game running on the current loop; do not add hazards or a slow-down effect.
- Use `#5BCEFA` for the snake and `#F5A9B8` for the regular target, without descriptive labels in code or source material.

## Review Focus

- A pickup or its effect must never spawn/teleport into an occupied cell; cover occupied-cell placement in the browser suite.
- Portal setup pauses movement but its 8-second timer continues; cover success and timeout.
- Overlapping effects and repeated one-use pickups must preserve their individual timers/charges; cover both cases.
- Game over and Escape must clear pickup timers/listeners; cover game exit during placement.
- A full or nearly full board must not create invalid food or portal positions; cover placement fallback.

---

### Task 1: Browser harness and scheduler

**Files:** Modify `scripts/check_site.py`; create `tests/snake-game.cjs`; modify `js/activate-snake.js`.

- [x] Add the browser test file to `scripts/check_site.py` and write failing checks for game start, immediate score-5 pickup, randomized 10–30 second waits, 5-second expiry, and cooldown restart.
- [x] Run the browser suite and confirm failures report missing powerup behavior.
- [x] Add one pickup at a time, empty-cell placement, bounded timers, and visible pickup/active-effect status.
- [x] Run the focused browser suite and confirm the scheduler checks pass.

### Task 2: Fruit effects and rendering

**Files:** Modify `js/activate-snake.js`, `css/style.css`; update `tests/snake-game.cjs`.

- [x] Add failing browser cases for all nine distinct fruit effects, effect overlap, repeat refresh/charge limits, and the requested color values.
- [x] Implement pixel-fruit drawing and all effects: 40-move speed boost; one enlarged apple; one tail pass; one wall wrap; trim 3 tail segments; double points for 3 apples; 5-move/40-move mango movement; 3 bonus apples for 15 seconds; two-charge cap for one-use effects.
- [x] Run the focused browser suite and confirm effect and rendering cases pass.

### Task 3: Portal placement and cleanup

**Files:** Modify `js/activate-snake.js`, `css/style.css`; update `tests/snake-game.cjs`.

- [x] Add failing browser cases for arrow-key cursor movement, A/B endpoint placement, 8-second timeout, 30-second active lifetime, countdown display, and exit during setup.
- [x] Implement the paused placement state, endpoint validation, paired teleport movement, top-corner countdown, and cleanup on timeout/game over.
- [x] Run the focused suite, then rebuild the site and run the full existing browser/build checks.
- [x] Review the diff for source-only color values and confirm all behavior remains within this spec.
