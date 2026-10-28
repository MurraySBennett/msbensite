# Burdle secret game design

## Intent

Replace the removed cloud clicker with a small word-guessing game in the homepage's existing `#game-area`. This is a purpose-built adaptation using Burdle's game rules and word data, not a port of its full application.

## Requirements

- Start from the existing “Postdoctoral Scholar” trigger in the homepage profile area.
- Choose a random family-safe answer from Burdle's answer list every time a new game starts. Daily rotation, custom puzzles, share links, and saved game progress are out of scope.
- Keep Burdle's six-guess loop, duplicate-aware Wordle scoring, valid-guess dictionary, and optional duplicate-letter hint.
- In the compact game area, show active and unused guess entries on the left and submitted guesses on the right. Put the “Double-letter display” toggle to the left of the guess columns.
- Save only the display-toggle preference locally. Dismissing the game frees the shared area and allows other site games to start.
- Support desktop keyboard entry and mobile text entry without showing the site's arrow D-pad for this word game.
- Preserve existing site games, theme styling, and the current build allowlist model. Do not deploy or publish.

## Implementation decisions

- Add a site-owned Burdle game script and include Burdle's existing word dictionary in the site's static build allowlist.
- Keep the game inside `#game-area`; do not use an iframe or navigate away.
- Use an accessible trigger and game controls. Provide a close action and an immediate replay action that selects a new answer.
- Keep game state in memory; only the hint toggle persists.

## Approaches

- Full Burdle page in an iframe: retains the standalone UI but does not fit the 200px game area and depends on a deployment URL.
- Compact site-native adaptation: reuses Burdle's word data and scoring idea while fitting the existing easter-egg area. **Chosen** because it meets the requested location and interaction.
- Link to the standalone Burdle app: smallest change, but the game would leave the homepage and the intended secret-area experience would be lost.

## Acceptance

- The homepage trigger starts a fresh random game in `#game-area`; replay also chooses a fresh answer.
- Guesses are limited to valid five-letter words and receive duplicate-aware correct/present/absent scoring, with the optional duplicate-letter border hint.
- Previous guesses appear in the right column; the current and unused entries appear in the left column; the display toggle sits to the left.
- Closing the game removes its listeners and markup, resets the shared game state, and leaves other easter eggs usable.
- The site build completes and the generated artifact contains the game and dictionary without the removed cloud-clicker references.
- No changes are published or deployed.
