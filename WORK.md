---
project: msbensite
---

# Work — msbensite

## Now

Executing `~/.claude/plans/i-don-t-mind-if-ancient-deer.md` (research tools wave 1) on
`feature/demos-prefix`, worktree `~/projects/.worktrees/msbensite-demos`. Phase 1 done: the
`demos/` bucket prefix is reserved, both deleting syncs exclude it, and
`DemosPrefixReservationTests` is the guard. Nothing pushed, nothing deployed. Next in this repo
is Phase 5 (the `tools.html` front door from `data/tools.json`), which waits on Phases 2–4
producing tiles.
The compact random-word Burdle game is implemented locally per `docs/superpowers/plans/2026-10-28-burdle-secret-game.md`; the latest keyboard layout rebuild is live at local port 8303. No deployment was made.
Snake's nine fruit powerups, persistent portal pairs, and 3×3 inventory are live on murraysbennett.com; the board is three rows shorter. GitHub checks and deployment passed, and the public Snake script and stylesheet contain the release. Next: review the live game.
The job-search site release is live at https://murraysbennett.com from `main` (`a34a5bd`); GitHub build/check/deploy succeeded and core public routes were checked. Snake food placement and queued direction input are corrected locally; the cloud clicker is removed. Reflex remains a recommendation for a future Arcade link; the Arcade app is not live.
Seven static project pages, the CV download and the research index are live; 5 build checks and 11 browser checks passed in CI.
New direction: practical public tools from research methods for everyday users. Handoff: `~/.agents/handoffs/HANDOFF-practical-research-tools.md`.
Next: identify the strongest small tool and its evidence/privacy boundary before building. Demos and social outreach remain deferred.
Canonical-bibliography confirmation of melanoma author order and IAT title remains open; the public site cites registered preprints.

## Streams

### infra
- [x] 2026-10-28 — Reserve the `demos/` S3 prefix for the interactive research tools: add `--exclude 'demos/*'` after the `--include` on both deleting `aws s3 sync` steps in `.github/workflows/deploy.yml`, so a CV update cannot wipe a published tool. Guarded by `tests/test_build_site.py::DemosPrefixReservationTests` (3 tests, RED against the old workflow, GREEN after). Python suite 8/8; `scripts/check_site.py` is unrunnable locally (no `node_modules`, and Playwright chromium is broken on this box) — CI owns it.
- [x] 2026-10-28 — Render `tools.html` from `data/tools.json`: three taxonomy sections, per-tile practitioner headline, what-you-get line, sector chips, and an evidence link the build *requires* (`render_tool_tile` raises on a missing evidence, sector or headline). `js/tools-filter.js` filters by sector as progressive enhancement — every tile is visible before it runs. `validate()` learned that `/demos/<slug>/` is deployed from another repo and checks the slug against `data/tools.json` instead of against `dist/`.
- [ ] now — **Directory-style URLs 403 on `murraysbennett.com`, which blocks this branch's `workshops` tile.** Distribution `EEM313Y5S27PB` serves the REST S3 origin `msbensitebucket.s3.us-east-2.amazonaws.com` under OAC `E3U6GNKR6FXJN4`, and `DefaultRootObject: index.html` applies only at the distribution root — so `/projects/`, `/demos/` and `/assets/` all return 403 carrying `404.html`, and `/demos/workshops/` will too once this branch lands. The `DEMOS_PREFIX` hatch in `validate()` (`scripts/build_site.py:299-317`) is what lets that link pass the build, so no test will catch it. Fix is a CloudFront Function on viewer-request appending `index.html`; no Functions or Lambda@Edge are attached today (`Quantity: 0` on both). Full verified diagnosis, rejected alternatives and verification commands in `~/.agents/handoffs/HANDOFF-cloudfront-directory-index.md`. The origin's *ID* still reads `...s3-website...`, a fossil of the website-endpoint config whose migration to REST + OAC dropped index resolution.
- [ ] next — **GRIN has no registered preprint** (`data/projects/grin/meta.json` has `publication: ""` and `publications: []`), so its tile's "evidence" link points at its project page rather than a paper. Every other tile cites one. Worth closing if the hub is to read as a programme.
- [ ] later — The "play the experiment we actually ran" section is deliberately empty and says so. It fills when a project ships its task alongside its paper.

### build
- [x] 2026-10-28 — Implement the compact random-word Burdle mini-game in `#game-area` from `docs/superpowers/plans/2026-10-28-burdle-secret-game.md`; randomize the answer per start, show a single active row with a letter-status keyboard, and use trans-flag blue/pink synthwave feedback colors. Build, syntax, generated-artifact, and read-only review checks pass; not deployed.
- [x] 2026-10-28 — Remove the cloud clicker and its publish/style references. Recommend Arcade's one-button Reflex game as the best short-loop candidate; don't embed it while the Arcade app is undeployed and framework-bound.
- [x] 2026-10-28 — Fix snake food spawning on occupied cells and buffer up to two ordered non-reversing turns across movement ticks.
- [x] 2026-10-28 — Add nine collectible Snake powerups, pixel fruit icons, portal placement, cooldowns, and a responsive 3×3 inventory beside the profile; shorten the board by three rows. See `docs/superpowers/plans/2026-10-28-snake-powerups.md` and `docs/superpowers/plans/2026-10-28-snake-hud-layout.md`.
- [ ] now — Explore a practical public tool for nonresearch users, grounding candidates in available methods and examples rather than claiming unpublished outcomes.
- [x] 2026-09-29 — Author accepted the site presentation; main deployment passed and public Home, GRIN, Research and CV routes were checked.
- [x] 2026-09-29 — Build artifact passed five Python checks and eleven browser checks; reviewed desktop/mobile Home, Research and project screenshots.
- [x] 2026-09-29 — Add static seven-project build, allowlisted publish artifact, predeploy CI checks, core navigation and accessibility polish.
- [x] 2026-09-27 — Launch scope chosen: core research, CV, teaching and tools; demos later.
- [x] 2026-09-27 — Core routes, seven evidence-based projects, teaching/tools/contact and canonical CV download aligned; excluded project URLs fail honestly. Desktop/mobile, keyboard, links and optional ORCID failure checked.
- [ ] next — Reconcile melanoma submitted author order and IAT manuscript/preprint title with canonical bibliography; public site currently cites registered preprints.
- [ ] later (L) Make the five demos faithful: current dc-rs, dutch-auction, mel-features, team-spirit-hh and wheel-of-fortune implementations have uncertain fidelity. Start with the real `team-spirit/bot/murrayserver/www/paddleGame.html` client and its socket boundary; single-player was a real condition.
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
