# Snake HUD Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move score, timer and the fixed 3×3 fruit inventory into a panel beside the profile photo, and make the Snake board taller and narrower.

**Architecture:** Keep the existing canvas game and create the inventory panel when the game starts. A responsive grid arranges profile, inventory and board; the canvas uses the board's measured dimensions.

**Tech Stack:** Existing HTML, CSS, plain JavaScript Canvas 2D, static-site builder.

**Spec:** `docs/superpowers/specs/2026-10-28-snake-hud-layout-design.md`

## Global Constraints

- Preserve all nine fruit effects, their fixed 3×3 ordering, labels and charge counts.
- Keep the site's existing static-site stack and dependencies.
- On narrow screens, stack profile, inventory and board in that order.
- Do not change gameplay behavior beyond dimensions following the new board size.

## Review Focus

- Game end must remove the inventory panel and active layout class so the page returns to its original state.
- Board dimensions must include the full board canvas, not subtract space for the relocated inventory HUD.
- On narrow screens, the nine items must remain visible and their labels/count badges legible.

---

### Task 1: Create the inventory rail and responsive board layout

**Files:** Modify `js/activate-snake.js`, `css/style.css`, `WORK.md`; update the spec and this plan.

- [x] Create the inventory panel when the game starts and insert it between the profile image and `#game-area`.
- [x] Move score, timer, status and the nine fixed fruit slots into the panel; keep active descriptions and counts with their fruit.
- [x] Remove the horizontal lane and board overlay HUD; size the canvas to the taller board's measured width and height.
- [x] Add desktop three-column styling and a narrow-screen stacked layout; remove legacy negative-margin spacing only while Snake is active.
- [x] Ensure `endGame()` removes the panel and restores the original row styling.
- [x] Run `node --check js/activate-snake.js`, `git diff --check`, and `/home/msb/projects/msbensite/.venv/bin/python -m scripts.build_site`; port 8304 returns HTTP 200.
