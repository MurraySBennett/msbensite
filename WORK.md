---
project: msbensite
---

# Work — msbensite

## Now

The job-search site release is live at https://murraysbennett.com from `main` (`a34a5bd`); GitHub build/check/deploy succeeded and core public routes were checked.
Seven static project pages, the CV download and the research index are live; 5 build checks and 11 browser checks passed in CI.
New direction: practical public tools from simulation-based inference and Bayesian decision models for everyday users. Handoff: `~/.agents/handoffs/HANDOFF-practical-research-tools.md`.
Fantasy NFL human–model lineup work follows `docs/superpowers/plans/2026-09-30-fantasy-lineup-pilot.md` on `feature/fantasy-decision-tool`. Tasks 1–8 local implementation and evidence decision are complete; public promotion failed its gate with zero admissible historical weeks and no reviewed real outcome snapshot. The route remains unlisted and noindex; next evidence needs prospective captures, final outcomes and the scenario comprehension check. Browser tests use installed Nix Chromium via `CHROMIUM_PATH`. Hay-window feasibility is later.
Canonical-bibliography confirmation of melanoma author order and IAT title remains open; the public site cites registered preprints.

## Streams

### build
- [ ] now — Explore a practical public tool for nonresearch users, grounding candidates in available methods and examples rather than claiming unpublished outcomes.
- [x] 2026-09-30 — Review and approve `docs/superpowers/specs/2026-09-30-fantasy-lineup-human-model-design.md` for a weekly real-roster recommendation and prospective unaided/model/final comparison.
- [ ] next — Continue the fantasy pilot's prospective evidence collection under `docs/superpowers/plans/2026-09-30-fantasy-lineup-pilot.md`: freeze genuine pregame captures and results, review real-data baseline/calibration and run the scenario comprehension check before any public promotion.
- [x] 2026-09-30 — Complete Task 8 rolling backtest harness, leakage and reviewed-archive checks, fixture metrics and evidence report; gate failed with zero admissible real weeks, so the route stays unlisted and no superiority claim is made.
- [x] 2026-09-30 — Complete Task 7 versioned final-outcome ingestion, frozen three-pick scoring, oracle regret, prospective exclusions, guarded personal-pilot summaries, correction handling and Results view; reviewed forecast and outcome data are still absent.
- [x] 2026-09-30 — Complete Task 6 unlisted accessible preview flow, checksum-verified snapshot loading with IndexedDB fallback, local records, conditional scenario display, Methods page and browser fixture checks.
- [x] 2026-09-30 — Complete Task 5 versioned browser-only configuration and weekly records, frozen choices, late-revision exclusions, private export disclosure and atomic import validation.
- [x] 2026-09-30 — Complete Task 4 browser scoring, legal optimizer, paired comparisons and conditional scenarios with conserved team opportunities, explicit uncalibrated probability suppression and focused Node tests.
- [x] 2026-09-30 — Complete Task 3 seeded generative forecast, pre-lock validation, versioned atomic snapshots, fixture operator update, model assumptions and tests.
- [x] 2026-09-30 — Complete Task 1 source gate and pre-game fixtures; retain capture hashes and cutoff, reject wrong assets, select only captured roster IDs, and label the latest available roster week.
- [x] 2026-09-30 — Complete Task 2 league-rule scoring, legal-lineup selection, deterministic full-roster optimizer and cutoff-safe rolling baseline.
- [ ] next — Design a NSW lucerne cut-today-vs-wait weather-window comparison; test issue-time Open-Meteo forecasts against SILO observed rain, and do not equate rain-free weather with safe baling. A grower with moisture and operation records is needed for a later personalized model. Check forecast API licence before public integration or monetization.
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
