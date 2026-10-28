---
project: msbensite
---

# Work — msbensite

## Now

Snake's jalapeño, doubled timed effects, block perimeter walls, and small-screen photo layout are deployed at murraysbennett.com from `51d4fc7`; CI and public JS/CSS checks passed.
The compact random-word Burdle game remains local per `docs/superpowers/plans/2026-10-28-burdle-secret-game.md`; the latest keyboard layout rebuild is live at local port 8303. No deployment was made.
The job-search site and seven static project pages, CV download, and research index remain live; Snake food placement and queued direction input are in the deployed release.
Next: identify the strongest practical public tool from research methods and its evidence/privacy boundary. Handoff: `~/.agents/handoffs/HANDOFF-practical-research-tools.md`; demos and social outreach remain deferred.
Canonical-bibliography confirmation of melanoma author order and IAT title remains open; the public site cites registered preprints.

## Streams

### build
- [x] 2026-10-28 — Implement the compact random-word Burdle mini-game in `#game-area` from `docs/superpowers/plans/2026-10-28-burdle-secret-game.md`; randomize the answer per start, show a single active row with a letter-status keyboard, and use trans-flag blue/pink synthwave feedback colors. Build, syntax, generated-artifact, and read-only review checks pass; not deployed.
- [x] 2026-10-28 — Remove the cloud clicker and its publish/style references. Recommend Arcade's one-button Reflex game as the best short-loop candidate; don't embed it while the Arcade app is undeployed and framework-bound.
- [x] 2026-10-28 — Fix snake food spawning on occupied cells and buffer up to two ordered non-reversing turns across movement ticks.
- [x] 2026-10-28 — Add nine collectible Snake powerups, pixel fruit icons, portal placement, cooldowns, and a responsive 3×3 inventory beside the profile; shorten the board by three rows. See `docs/superpowers/plans/2026-10-28-snake-powerups.md` and `docs/superpowers/plans/2026-10-28-snake-hud-layout.md`.
- [x] 2026-10-28 — Rename the speed pickup to a jalapeño, double timed effect durations, and add a solid perimeter wall grid with outer-wall wrapping for lime and extensible wall-cell collision.
- [x] 2026-10-28 — Hide the profile photo during active games on small screens and reclaim the space, preserving the photo-driven Konami game.
- [ ] now — Explore a practical public tool for nonresearch users, grounding candidates in available methods and examples rather than claiming unpublished outcomes.
- [x] 2026-09-29 — Author accepted the site presentation; main deployment passed and public Home, GRIN, Research and CV routes were checked.
- [x] 2026-09-29 — Build artifact passed five Python checks and eleven browser checks; reviewed desktop/mobile Home, Research and project screenshots.
- [x] 2026-09-29 — Add static seven-project build, allowlisted publish artifact, predeploy CI checks, core navigation and accessibility polish.
- [x] 2026-09-27 — Launch scope chosen: core research, CV, teaching and tools; demos later.
- [x] 2026-09-27 — Core routes, seven evidence-based projects, teaching/tools/contact and canonical CV download aligned; excluded project URLs fail honestly. Desktop/mobile, keyboard, links and optional ORCID failure checked.
- [ ] next — Reconcile melanoma submitted author order and IAT manuscript/preprint title with canonical bibliography; public site currently cites registered preprints.
- [ ] now (L) Make the five demos faithful: dc-rs, dutch-auction, mel-features and wheel-of-fortune implementations still have uncertain fidelity. Handoff: `~/.agents/handoffs/HANDOFF-experiment-demos.md`. Publish none of them before its diff is done.
- [x] 2026-10-28 — `team-spirit-hh` fidelity diff done. Verdict: not a reimplementation of the published task — no miss events (so miss rate, the paper's primary DV, is uncomputable), no DRT, no partner model (two humans on one keyboard, which is neither published arm), 2 workload levels instead of 4, 6×15 s instead of 3 blocks × 12 × 45 s. Spec and diff in `docs/demos/`. Separate finding: `paddleGame.html` as committed is a debug snapshot (`skipIntro`, all-1 ball counts, a case mismatch disabling two conditions) and is not a valid diff target on its own.
- [x] 2026-10-28 — Rebuilt `team-spirit-hh` as a gist demo against `docs/demos/team-spirit-spec.md`: published geometry/speeds/deflection, misses that wrap and count, the DRT, all three conditions with real mechanics, 1/3/6/9 workload, and both ideal-observer agents ported from `paddle-exp` (restoring the temporal-proximity term it drops). One 30 s trial you choose, labelled abridged on the page; session shape, practice, counterbalancing and logging deliberately not reproduced. Retitled to "teaming with a machine partner" in the loader and `experiments.html` — the old "Human Teams" title claimed the one arm a browser cannot reproduce. 20 tests in `tests/team-spirit-demo.cjs` (`npm run test:demos`), wired into `npm test`; layout verified by screenshot.
- [ ] next (S) Publish `team-spirit-hh`: add `js/demos/`, `experiments.html` and `experiment-demo-viewer.html` to `scripts/build_site.py`'s allowlist and fill `data/projects/team-spirit-hh/meta.json` `experiment_demo`/`interactive_demo` in the same change. Gated on Phase 1 of `~/.claude/plans/i-don-t-mind-if-ancient-deer.md` (reserved `demos/` prefix plus `--exclude 'demos/*'` on the two `aws s3 sync … --delete` steps) — without it a CV update wipes the prefix.
- [ ] later (S) Optional: the ported agent matches the published very-high-workload miss rate (0.628 vs ~0.65) but not the low (0.230 vs ~0.05); the documented 1.2 s horizon makes 0.05 unreachable and no speed multiplier fixes both ends. The agents' *measured* rates are in the OSF supplement (osf.io/mtazf), unconsulted. Not blocking — a partner missing 23% of single balls is a plausible teammate.
- [x] 2026-09-27 — Tools and GRIN copy describe implemented count-only inference; RT extension explicitly remains in development.

### writing
- [x] 2026-09-27 — Research/experience/project copy revised against scoped evidence; clinical benefit and completed human-intervention claims removed.
- [x] 2026-09-29 — Author accepted the site presentation for publication; preserve later style refinements as separate work.

### comms
- [ ] now (M) decide what a deliberate academic social presence is *for* before touching any platform — finding collaborators, circulating preprints, being findable by search committees and conference backchannel point at different platforms and very different posting habits, so "which platforms" is the wrong first question. Run `superpowers:brainstorming`; do not start from a posting schedule
- [ ] now (S) decide whether murraysbennett.com is the hub the profiles point at — she owns the domain (Amazon Registrar, expires 2027-08-06, auto-renew on) and a site she controls cannot be deprovisioned or bought, so this is probably the first question worth answering and it gates the platform choices above. ORCID `0000-0001-7309-4915` stays the authoritative identity record: profiles link to it, not the reverse
- [ ] now (S) put a unique generated password and Aegis TOTP on X and LinkedIn regardless of how those decisions land — neither has 2FA today, and a hijacked public academic profile is a reputational problem rather than just a security one
- [ ] next (S) fix the two broken profile records the 2026-09-22 vault audit found: the LinkedIn entry (`murray.bennett92@gmail.com`) has no URI stored at all so autofill has never fired and its state is unknown, and ResearchGate is on the dead `murray.bennett@uon.edu.au`. Everything else found is dormant — X is `MurraySBennett` and logged in (that is the professional handle and it stays, consistency beats a better name), Instagram and Facebook are personal and out of scope, Bluesky does not exist
- [ ] next (S) when accounts do get set up, register them to `me@murraysbennett.com` and never to an institutional address — Newcastle, UON and UTSA are already gone and `@osu.edu` closes around 2026-11-03. That address is live and forwards to gmail via Forward Email, but it is forward-only: *sending* from it needs a paid mailbox, so any plan that requires sending has a cost attached

### admin
- [ ] next (S) `docs/agents/CURRENT_WORK.md` is a pure unfilled template with 11 placeholders; delete it now that WORK.md carries the live state
