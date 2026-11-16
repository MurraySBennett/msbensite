# Team Spirit demo — fidelity diff

What `js/demos/team-spirit-hh.js` does, against what the published task did.
Spec and sources: [`team-spirit-spec.md`](team-spirit-spec.md).

**Verdict: the demo is not a reimplementation of the published task.** It is a
two-player local Pong variant that borrows the condition names and two of the
three instruction strings. It cannot produce the paper's dependent measures, and
publishing it as "the task we ran" would misrepresent the study. The 866 lines
landed in a single commit (`d0f0522`, 2025-08-06) with no reference to the real
client.

---

## First, a finding about the ground truth

The handoff's plan was to diff the demo against
`team-spirit/bot/murrayserver/www/paddleGame.html`. **That client, as committed,
is a debug snapshot and does not run the published experiment.** Diffing against
it would be matching a broken configuration.

| What's disabled | Where | Effect |
|---|---|---|
| `skipIntro = true` | `paddleGame.html:208` | All six instruction screens and all three practice trials are bypassed |
| `n_balls = [1]*12` | `game_qlearning.py:148` | Every trial is 1 ball per player. The published `[1,1,1,3,3,3,6,6,6,9,9,9]` is commented out on the next line |
| `block_orders = [["nonCol","Col","Com"]]` | `game_qlearning.py:138-143` | One order, so no counterbalancing — **and `"Col"`/`"Com"` are capitalised** while the client compares lowercase `"col"`/`"com"` (`:1582`, `:1586`, `:1916`, `:1952`, `:1960`), so blocks 2 and 3 fall through to the solo default: no block instructions, no team/competitive scoreboard, no encouragement text |
| `blockBreakTime = 0`, `trialBreakTime = 0`, `instructionsPause = 0` | `paddleGame.html:221-223` | Comments record the real values: 20 s, 5 s, 5 s |
| `dataCheck()` call site commented out | `paddleGame.html:923-925` | Final data-consent form never shown |
| Only the RL agent is present; `epsilon = 0` | `game_qlearning.py:51-56` | One fixed Q-table, no exploration. The paper's two ideal-observer agents are not in this file at all |

`game.py` in that directory is dead code — `server.py:23` imports `Game` from
`game_qlearning`, and the `game_DQN` import on the next line is commented out.

**So the authoritative spec is the published method section plus `paddle-exp`'s
config, with `paddleGame.html` contributing the exact physics constants and the
verbatim participant-facing text.** That is how `team-spirit-spec.md` is now
sourced.

### The paper's geometry figures are approximate

`paddleGame.html:316-343` and `game_qlearning.py:110-136` agree with each other
and with `paddle-exp`. `game-details.tex` does not:

| Quantity | Paper | Code (all three) | Verdict |
|---|---|---|---|
| Paddle | 72 × 10 | 72 × 8.64 | paper rounded |
| Paddle y | 580 | 574.08 | paper rounded |
| Ball radius | **14** | **7.776** | paper is wrong — nearly 2× |
| Ball start y | 560 | 566.3 | paper rounded |
| Ball start x | 368, 400, 432 | 368.896, 400, 431.104 | agrees |
| P1 / P2 start x | 280 / 560 | server 228 / 536; client 241.6 / 486.4 | **three different values**; the server's win, it drives play |
| Shared ball colour | `rgb(148,0,211)` | `#963d97` = `rgb(150,61,151)` | paper is wrong |
| Left-handed move keys | `z` / `x` | `Z` / `C` (`:326-327`) | paper is wrong |

Use the code. Where the demo is rebuilt, cite the code values and note the
paper's figures are nominal.

---

## Fatal divergences — the demo measures something else

### 1. There are no misses

`team-spirit-hh.js:450-457`. A ball crossing the bottom is deleted:

```js
// No penalty for missing balls as per request
// Mark ball for removal
return false;
```

The published primary dependent measure is **miss rate**, 1 − hits/(hits+misses)
(`topics_revision.tex` Primary Task Performance). In the original, a ball that
passes the bottom keeps its trajectory and re-enters at the top
(`paddleGame.html:521-530`, `game_qlearning.py:446-447`), so ball count is
constant for the full 45 s and misses accumulate. The demo instead respawns a
fresh ball at screen centre, so **the quantity the paper reports cannot be
computed from the demo at all.** This is the single biggest problem.

### 2. There is no DRT

Absent entirely from the demo — no stimulus, no response key, no RT. The
detection response task is half the paper: three of its six hypotheses and the
whole cognitive-load analysis rest on it. In the original it is the two 40 px
side panels flashing `#1bff00`, uniform 3–5 s ISI, 1 s display, 2.5 s response
window, 0.1 s minimum valid RT, keyed to the non-dominant hand
(`paddleGame.html:238-243`, `:336`, `:1854-1897`).

The demo's playfield runs the full 0–800 px width, so there is not even space
reserved where the panels belong (original playable x is 40–760).

### 3. There is no partner model

The demo is two humans on one keyboard — "You and a friend (or two hands!)"
(`:175`), both paddles driven only by local keys (`:823-835`, `:840-853`). No
bot exists anywhere in the file.

Neither published arm looks like this. **Human–human** was two separate clients
over a websocket with lag-compensated paddle history
(`paddleGame.html:124-162`, `:459-467`). **Human–machine** was a server-side
agent. Two people sharing one keyboard is a third thing that was never run.

### 4. Workload is wrong, and is the paper's main effect

| | Demo | Published |
|---|---|---|
| Levels | 2 | 4 |
| Balls | 2 and 6 total (`:239-270`) | 1, 3, 6, 9 **per player** → 2, 6, 12, 18 on screen |

Workload is the factor every primary analysis crosses. The demo's two levels map
onto the published low (1/player) and high (3/player) only if you read its
`nBalls` as per-player, which the code does not — it spawns `nBalls` balls total
(`:619-629`). The trailing comments at `:239-270` claim per-player totals of 6
and 12, matching neither reading.

### 5. Trial structure is wrong by a factor of 20

| | Demo | Published |
|---|---|---|
| Structure | 6 "blocks" × 15 s | 3 blocks × 12 trials × 45 s |
| Total gameplay | 90 s | 27 min (36 trials) |
| Inter-trial | self-paced "Continue" button | minimum 5 s, showing trial score, cumulative score, DRT reminder, condition reminder |
| Inter-block | none distinct | forced 20 s with next-block instructions |
| Order | fixed separate → collaborative → competitive (`:239-270`) | counterbalanced across 6 orders |
| Workload order within block | fixed | randomised per block |

A block in the demo is a continuous 15 s stream, not a trial. `conf.trialDuration = 15`
with the comment "Total game duration in seconds (6 blocks * 10s/block)" —
which describes neither 15 s nor 6 × 10 (`:220`).

---

## Material divergences — mechanics that visibly differ

| # | Aspect | Demo | Original |
|---|---|---|---|
| 6 | Ball spawn | x = 400, y = 9 (top centre), random angle 36°–144° then randomly negated (`:347-348`, `:658-659`) | Spawn at the **paddle line**, y = 566.3, on three columns 368.9 / 400 / 431.1, launched upward 45°–135° (`game_qlearning.py:689-721`) |
| 7 | Paddle deflection | `angle += impactOffset * π/4` — up to ±45°, and because the hit window extends `bRad` past each paddle edge, `impactOffset` reaches ±1.225, so up to ±55° (`:414-416`) | `offset = impact/(pWidth/2)/2` → ±0.5 rad (±28.6°), added to the reflection; **if the result falls outside (−155°, −35°) it reverts to pure reflection** (`paddleGame.html:437-451`) |
| 8 | Angle guard | Clamps `|angle|` up to a 40° floor — comment says "20 degrees" (`:419-422`) | No floor; the 155°/35° test is a fallback to plain reflection, a different mechanism with a different effect |
| 9 | Ball speed | 0.25 px/ms = **250 px/s** (`:225`) | `bSpeed = 4` per nominal 20 ms = **200 px/s** (`paddleGame.html:343`, `:418-419`) |
| 10 | Paddle speed | 0.5 px/ms = **500 px/s** (`:223`, `:481`) | `pSpeed = 4` per 20 ms = **200 px/s** (`paddleGame.html:318`). The demo's paddle is 2.5× too fast — this alone changes achievable hit rate at every workload level |
| 11 | Paddle geometry | 80 × 12 at y = 550 (`:279-280`, `:233`) | 72 × 8.64 at y = 574.08 |
| 12 | Ball radius | 9 (`:281`) | 7.776 |
| 13 | Playable width | 0–800 (`:229-232`) | 40–760; the outer 40 px strips are the DRT panels |
| 14 | Collaborative scoring | **Every** hit awards 0.5 to each player and 1 to the team (`:432-435`) | +1 to the hitter; half points to each only when the ball overlaps **both** paddles simultaneously (`game_qlearning.py:521-530`) |
| 15 | Separate-condition allocation | Assigned at spawn by counting on-screen p1 balls: `p1BallsOnScreen < nBalls/2 ? "p1" : "p2"` (`:665-670`) | Fixed by ball id: `0..n-1` are p1's, `n..2n-1` are p2's (`paddleGame.html:2154-2162`) |
| 16 | Separate-condition pass-through | `return true` on wrong-paddle contact (`:402-407`) **skips the rest of `move()` for that frame** — including the bottom-wall check and the hit-latch reset. And since paddle 1 is tested first in an `else if` (`:385-397`), a p2-owned ball overlapping both paddles can never be hit by p2 | Collidability is filtered per ball without short-circuiting physics (`paddleGame.html:538-547`) |
| 17 | Controls | `A`/`D` and `←`/`→`, no handedness question, no `preventDefault` so arrows scroll the page (`disableScroll()` is commented out at both definition and call site, `:327-336`, `:554`) | Handedness asked first: right-handed `←`/`→` + `Z` for DRT; left-handed `Z`/`C` + `↑` for DRT (`paddleGame.html:326-329`, `:812-829`). Scroll pinned (`:1815-1823`) |
| 18 | Timestep | Variable rAF dt, **unclamped**, and `lastFrameTime` is not reset in `continueToNextBlock` (`:719-733`) — so the first frame after the inter-block overlay carries the entire overlay duration as `elapsed` and every ball teleports | Ball position re-extrapolated fresh from the last server snapshot each frame, so error does not accumulate (`paddleGame.html:2106-2107`) |
| 19 | Authority | None — all client-side, nothing validated | Server-authoritative ball physics, hits, misses and score (`game_qlearning.py:401-549`) |

---

## Missing scaffolding

| Aspect | Demo | Published |
|---|---|---|
| Practice | absent | Three trials, all solo: 25 s paddle-only (DRT off), 25 s DRT-only (no balls), 45 s combined with 3 balls (`topics_revision.tex:236-238`) |
| Instructions | 5 lines of demo chrome | Six screens, verbatim text in the spec |
| Data logging | **absent** — no `localStorage`, no `fetch`, no export, no per-hit record (`:286-309` is the only state and it dies on reload) | Server JSON-lines, one full state dump per tick (`game_qlearning.py:685-697`) |
| Counterbalancing | absent | Block order across 6 permutations; workload shuffled per block; machine-agent type and disclosure counterbalanced between subjects |
| Condition reminders | `#block-info` is shown but its `textContent` assignment is commented out, so it renders empty (`:727-730`) | Condition and DRT reminder shown at every inter-trial break |

### Instruction text that does survive

Two of three are verbatim matches to the paper, which is why the demo reads as
faithful on a quick look:

| Condition | Demo (`:253`, `:263`, `:243`) | Paper |
|---|---|---|
| Collaborative | "Work together to score as high as you can!" | "work together to score as high as you can" ✓ |
| Competitive | "Try to outscore your opponent!" | "try to outscore your opponent" ✓ |
| Separate | "Only hit balls that match the colour of your paddle!" | paraphrase of the real framing, and the original's wording is "During this block you will only be able to hit the red balls" (`paddleGame.html:1579`) |

---

## Also: the demo is not reachable from its project page

`data/projects/team-spirit-hh/meta.json:18-19` has `"experiment_demo": ""` and
`"interactive_demo": ""`, both empty, so the project page does not link it. It is
listed in `experiments.html:36-42` and registered in
`js/experiment-demo-loader.js:36-39`, but neither file is in `build_site.py`'s
allowlist, so none of it ships today.

---

## Resolution — rebuilt 2026-10-28

Rebuilt rather than repaired: items 1–5 each required changing the core loop,
and the old file had no trial scheduler and no partner to hang a fix on.

The brief was a **gist demo**, not a reproduction — short, no upkeep, honestly
labelled. Three of the five fatal items were kept anyway because they cost
almost nothing and are what make the task recognisable: without misses there is
no failure mode to measure, without the DRT it is Pong rather than a dual-task
workload study, and two people on one keyboard is not a simplification of either
published arm.

What the rebuild now does, all in one file, no build step, nothing stored:

| Item | Status |
|---|---|
| Misses | Ball re-enters at the top with its trajectory, miss rate reported live |
| DRT | Side panels, 3–5 s onset-to-onset, 1 s display, 2.5 s window, 100 ms RT floor, `Z` key, bonus point |
| Partner | Both ideal-observer agents, ported from `paddle-exp/paddle_exp/bots/greedy.py` |
| Workload | 1 / 3 / 6 / 9 per player, selectable |
| Conditions | All three, with the published mechanics — including wrong-colour pass-through and half-points on a simultaneous hit |
| Geometry, speeds, deflection | The code's values, not the paper's |
| Instructions | The original block-instruction strings, verbatim |
| Session shape | **Deliberately not reproduced.** One 30 s trial you choose, labelled as abridged on the page, with the four differences from the study listed under the game |

The port fixes the deviation noted earlier — `greedy.py:47-56` discards the
temporal term `intercept["p"]` that `base.py:265` computes, although the paper
specifies "temporal and spatial proximity"; the port uses both.

Evidence: `tests/team-spirit-demo.cjs`, 20 tests, `npm run test:demos`. The
agent calibration there is seeded, because unseeded it failed about one run in
five on unchanged code.

### Agent calibration — one endpoint matches, one does not

The paper tuned its agents to the human miss rates from the human–human arm:
"approximately 0.05 in the low workload condition, all the way to a miss rate of
0.65 in the very high workload" (`game-details.tex`). Measured over 12 seeds:

| Workload | This port | Published target | n |
|---|---|---|---|
| Low (1 ball) | **0.230** (range 0.12–0.30) | ~0.05 | 883 |
| Very high (9 balls) | **0.628** (range 0.57–0.66) | ~0.65 | 3,024 |

The high end matches. The low end does not, and the gap looks structural rather
than a porting defect: at 4 px per 20 ms the paddle covers 240 px in the
published 1.2 s intercept horizon, against a 720 px court, so intercepts near
the walls are unreachable from a centre park no matter how good the policy is.

`paddle-exp/config/base.yaml:41` carries `bot_speed_multiplier: 1.5`, which is
not in the published design and is the obvious knob. It does not reconcile the
two endpoints — raising bot speed drives the low end to 0.000 while pulling the
high end *away* from 0.65:

| Bot speed | Low | Very high |
|---|---|---|
| 1.00× (published) | 0.230 | 0.628 |
| 1.25× | 0.083 | 0.560 |
| 1.50× (`[new]`) | 0.000 | 0.532 |
| 2.00× | 0.000 | 0.507 |

So the published parameters are kept and the divergence is recorded rather than
tuned away. **Open question if it ever matters:** the paper states the agents'
design target, not their measured performance; the measured agent miss rates are
in the OSF supplement (osf.io/mtazf), which was not consulted. For a demo a
partner missing 23% of single balls is a plausible teammate, so this is not
blocking.

### Not yet done

- **Not published.** `scripts/build_site.py`'s allowlist still excludes
  `js/demos/`, `experiments.html` and `experiment-demo-viewer.html`. Publishing
  is gated on Phase 1 of
  `~/.claude/plans/i-don-t-mind-if-ancient-deer.md` landing the reserved
  `demos/` prefix and the `--exclude 'demos/*'` guard on the two `aws s3 sync
  … --delete` steps.
- `data/projects/team-spirit-hh/meta.json:18-19` still has empty
  `experiment_demo` / `interactive_demo`. Fill them in the same change that
  publishes, not before — otherwise the project page gains a dead link.
- The in-trial rendering was not captured headlessly. Playwright's bundled
  Firefox is not NixOS-patched (`libgtk-3.so.0` missing from its RPATH) and
  system Firefox cannot be driven by Playwright, so the screenshot covers the
  idle state and layout only. Trial behaviour is covered by the test suite
  instead; a human glance at a local server is still worth one minute.
