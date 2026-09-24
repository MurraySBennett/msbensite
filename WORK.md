---
project: msbensite
---

# Work — msbensite

## Now

Personal academic site (murraysbennett.com) on S3 + CloudFront with a GitHub
Actions deploy; the deploy was fixed on 2026-08-26 so it can no longer wipe
the bucket. The live build question is demo fidelity: the five existing demos
(dc-rs, dutch-auction, mel-features, team-spirit-hh, wheel-of-fortune) are
2025 re-implementations of uncertain fidelity, while the real clients still
exist — `team-spirit/bot/murrayserver/www/paddleGame.html` is 118KB of the
actual canvas game needing only a stubbed `WebSocket`. Single-player was a
real experimental condition, so nothing has to fake a partner.

**2026-09-24 — `~/.agents/handoffs/HANDOFF-academic-social-presence.md` was
consumed into this file and can be deleted.** It is a brainstorm with an open
decision at the centre of it, not built work: no hub decision has ever been
made, no Bluesky account exists, and there is no social markup anywhere in this
repo. It landed here because the first question — is murraysbennett.com the hub
the profiles point at — is a question about this site.

Nothing is blocked externally. Two decisions in `comms` gate everything else
there, the X and LinkedIn 2FA work under it is worth doing whatever those
decisions turn out to be, and `docs/agents/CURRENT_WORK.md` is still the
unfilled scaffold template and should go.

## Streams

### build
- [ ] next (L) make the demos faithful: stub the socket in the real clients so each demo *is* the task rather than an approximation of it, starting with the paddle game
- [ ] later leave `tools.html` thin — padding it with unfinished work would be worse than the gap. Wait until something is genuinely done

### writing
- [ ] next (M) review and rewrite the site text — project descriptions and the research/experience narrative — accurate and not overclaiming, and readable by visitors from any background rather than specialists only

### comms
- [ ] now (M) decide what a deliberate academic social presence is *for* before touching any platform — finding collaborators, circulating preprints, being findable by search committees and conference backchannel point at different platforms and very different posting habits, so "which platforms" is the wrong first question. Run `superpowers:brainstorming`; do not start from a posting schedule
- [ ] now (S) decide whether murraysbennett.com is the hub the profiles point at — she owns the domain (Amazon Registrar, expires 2027-08-06, auto-renew on) and a site she controls cannot be deprovisioned or bought, so this is probably the first question worth answering and it gates the platform choices above. ORCID `0000-0001-7309-4915` stays the authoritative identity record: profiles link to it, not the reverse
- [ ] now (S) put a unique generated password and Aegis TOTP on X and LinkedIn regardless of how those decisions land — neither has 2FA today, and a hijacked public academic profile is a reputational problem rather than just a security one
- [ ] next (S) fix the two broken profile records the 2026-09-22 vault audit found: the LinkedIn entry (`murray.bennett92@gmail.com`) has no URI stored at all so autofill has never fired and its state is unknown, and ResearchGate is on the dead `murray.bennett@uon.edu.au`. Everything else found is dormant — X is `MurraySBennett` and logged in (that is the professional handle and it stays, consistency beats a better name), Instagram and Facebook are personal and out of scope, Bluesky does not exist
- [ ] next (S) when accounts do get set up, register them to `me@murraysbennett.com` and never to an institutional address — Newcastle, UON and UTSA are already gone and `@osu.edu` closes around 2026-11-03. That address is live and forwards to gmail via Forward Email, but it is forward-only: *sending* from it needs a paid mailbox, so any plan that requires sending has a cost attached

### admin
- [ ] next (S) `docs/agents/CURRENT_WORK.md` is a pure unfilled template with 11 placeholders; delete it now that WORK.md carries the live state
