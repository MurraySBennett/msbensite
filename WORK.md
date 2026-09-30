---
project: msbensite
---

# Work — msbensite

## Now

The job-search site release is live at https://murraysbennett.com from `main` (`a34a5bd`); GitHub build/check/deploy succeeded and core public routes were checked.
Seven static project pages, the CV download and the research index are live; 5 build checks and 11 browser checks passed in CI.
New direction: practical public tools from simulation-based inference and Bayesian decision models for everyday users. Handoff: `~/.agents/handoffs/HANDOFF-practical-research-tools.md`.
Fantasy NFL human–model lineup design was confirmed and its reviewable spec is at `docs/superpowers/specs/2026-09-30-fantasy-lineup-human-model-design.md`. It now centers a falsifiable complementarity question, an interpretable generative player model, pre/post advice probability judgments, and explicit failure criteria; all-player projections, injury/game-state feature tests and Boris Chen rights boundaries remain scoped. Next: author reviews this research framing, then write an implementation plan before code. Hay-window feasibility is documented below for later. Demos and social outreach remain deferred.
Canonical-bibliography confirmation of melanoma author order and IAT title remains open; the public site cites registered preprints.

## Streams

### build
- [ ] now — Explore a practical public tool for nonresearch users, grounding candidates in available methods and examples rather than claiming unpublished outcomes.
- [ ] now — Review `docs/superpowers/specs/2026-09-30-fantasy-lineup-human-model-design.md`, the confirmed design for a weekly real-roster recommendation and prospective unaided/model/final comparison; then write the implementation plan.
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
