---
project: msbensite
---

# Work — msbensite

## Now

Personal academic site (murraysbennett.com) on S3 + CloudFront with a GitHub
Actions deploy; the deploy was fixed on 2026-08-26 so it can no longer wipe
the bucket. The live question is demo fidelity: the five existing demos
(dc-rs, dutch-auction, mel-features, team-spirit-hh, wheel-of-fortune) are
2025 re-implementations of uncertain fidelity, while the real clients still
exist — `team-spirit/bot/murrayserver/www/paddleGame.html` is 118KB of the
actual canvas game needing only a stubbed `WebSocket`. Single-player was a
real experimental condition, so nothing has to fake a partner. Note
`docs/agents/CURRENT_WORK.md` is still the unfilled scaffold template.

## Streams

### build
- [ ] next (L) make the demos faithful: stub the socket in the real clients so each demo *is* the task rather than an approximation of it, starting with the paddle game
- [ ] later leave `tools.html` thin — padding it with unfinished work would be worse than the gap. Wait until something is genuinely done

### writing
- [ ] next (M) review and rewrite the site text — project descriptions and the research/experience narrative — accurate and not overclaiming, and readable by visitors from any background rather than specialists only

### admin
- [ ] next (S) `docs/agents/CURRENT_WORK.md` is a pure unfilled template with 11 placeholders; delete it now that WORK.md carries the live state
