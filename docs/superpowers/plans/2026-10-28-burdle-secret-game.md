# Burdle secret game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact, random-word Burdle mini-game to the homepage's existing secret game area.

**Architecture:** Adapt Burdle's answer list, dictionary, and scoring in a site-owned script. Render a compact two-column board in `#game-area`, and coordinate its lifecycle with the site's shared easter-egg state and mobile D-pad.

**Tech Stack:** Static HTML/CSS/JavaScript, Python site builder, existing Burdle dictionary.

**Spec:** `docs/superpowers/specs/2026-10-28-burdle-secret-game.md`

## Global Constraints

- Each new game start chooses a random family-safe answer; there is no daily or custom-puzzle mode.
- Keep six guesses, valid-word checking, duplicate-aware scoring, and the optional duplicate-letter hint.
- Persist only the hint preference; game progress is in memory.
- The game remains in the 200px `#game-area` and does not deploy or publish.
- Do not run or add a test suite; use build, syntax, and generated-artifact checks only.

## Review Focus

- Invalid and incomplete guesses must not consume a turn; inspect the validation and input branches.
- Repeated letters must be scored once per answer occurrence, matching Burdle's two-pass scoring; inspect the scoring function against known duplicate patterns.
- A new game or replay must choose a fresh random answer; inspect the selection path.
- Closing the game must remove its key and click listeners and release shared state; inspect every exit path.
- The compact columns and controls must remain within the game area and keyboard entry must work without the D-pad; inspect desktop and narrow-width CSS and input handling.

---

### Task 1: Build the compact Burdle easter egg

**Files:**
- Create: `js/activate-burdle.js`
- Create: `js/burdle-dictionary.js` (site copy of Burdle's `dict.js`)
- Modify: `index.html`
- Modify: `css/style.css`
- Modify: `js/dpad.js`
- Modify: `scripts/build_site.py`
- Modify: `WORK.md`

**Interfaces:**
- Consumes: `window.gameActive`, `window.stopCurrentGame`, `#game-area`, and Burdle's `window.WORDY_DICT`.
- Produces: an accessible `#burdle-trigger`; a game panel in `#game-area`; and `window.gameUsesDpad = false` while text entry is active so the existing D-pad remains available to other games.

- [ ] Add the dictionary and game script to the build allowlist and homepage, and make the profile title an accessible game trigger.
- [ ] Implement random answer selection, Burdle scoring and guess validation, the two-column compact board, the persisted hint toggle, keyboard/mobile text input, replay, close, and shared-game cleanup.
- [ ] Add responsive game-area styling and let `dpad.js` suppress the D-pad only when a game opts out; preserve the default for existing games.
- [ ] Build the site with `.venv/bin/python -m scripts.build_site`; run `node --check` on the new JavaScript; inspect generated HTML/assets and confirm removed clicker references are absent.
- [ ] Update `WORK.md` with the completed outcome and remaining next step.
