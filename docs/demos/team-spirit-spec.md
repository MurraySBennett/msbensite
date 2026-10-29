# Team Spirit — authoritative task spec

Reference for the `team-spirit-hh` demo's fidelity. Every number here is sourced,
with the source named. Where sources disagree, both values are given and the
disagreement is marked — **do not silently pick one**.

**Paper:** Bennett, M. S., Hedley, L., Love, J., Houpt, J. W., Brown, S. D., &
Eidels, A. (2025). Human performance in competitive and collaborative
human–machine teams. *Topics in Cognitive Science*, 17(2), 324–348.
<https://doi.org/10.1111/tops.12683>. OSF: <https://osf.io/mtazf>.

## Sources

| Tag | What it is |
|---|---|
| `[paper]` | `team-spirit/studies/human-bot/writing/latex/game-details.tex` and `topics_revision.tex` — the published method section |
| `[orig]` | `team-spirit/bot/murrayserver/www/paddleGame.html` plus `game_qlearning.py` — the client and server that collected the data. **`game.py` in that directory is dead code**; `server.py:23` imports `Game` from `game_qlearning` |
| `[new]` | `paddle-exp/config/base.yaml`, `paddle_exp/game.py` and `paddle_exp/bots/` — the successor platform, which states its geometry is "unchanged from original" (`game.py:98`) |

> **`[orig]` as committed does not run the published experiment.** It is a debug
> snapshot: `skipIntro = true` skips all instructions and practice, `n_balls` is
> hardcoded to all-1 instead of the 1/3/6/9 sequence, the block-order table has
> one row with a case mismatch that silently disables two of the three
> conditions, and every break timer is zeroed. The full list is in
> [`team-spirit-fidelity.md`](team-spirit-fidelity.md#first-a-finding-about-the-ground-truth).
> Take **constants and verbatim text** from `[orig]`; take the **schedule** from
> `[paper]` and `[new]`.

## Design

Team type (human–human, human–machine) between dyads. Group condition and
workload within subjects. `[paper]` `topics_revision.tex:160`

| Factor | Levels |
|---|---|
| Group condition | separate (`nonCol`), collaborative (`col`), competitive (`com`) |
| Workload | 1, 3, 6, 9 balls **per player** `[new]` `base.yaml:17` |

Workload labels: low = 1, medium = 3, high = 6, very high = 9. The paper names
only low = 1 (`topics_revision.tex:191`), medium = 3 (`:238`) and very high = 9
(`:184`); high = 6 comes from `[new]`.

## Playing space

Frame 800 × 600 px, scaled to the participant's screen. Origin top-left.
`[paper]` `game-details.tex:3`

**`[orig]` and `[new]` agree with each other everywhere. `[paper]` does not —
use the code.** `[orig]` is `paddleGame.html:316-343` for the client and
`game_qlearning.py:110-136` for the server (the live module; `game.py` is dead
code — `server.py:23`).

| Quantity | `[paper]` | `[orig]` / `[new]` | Use |
|---|---|---|---|
| Frame | 800 × 600 | 800 × 600 | agrees |
| Playable x-range | 40–760 | `frameLeft` 40, `frameRight` 760 | agrees |
| DRT panels | two, 40 × 600, left and right edges | x ∈ [0,40] and [760,800] | agrees |
| Paddle size | 72 × 10 | `pWidth` 72, `pHeight` 8.64 | **8.64** — paper rounded |
| Paddle y | 580 | `paddleY` 574.08 | **574.08** |
| Ball radius | 14 | `ballR` 7.776 | **7.776** — paper is wrong, nearly 2× |
| Ball start y | 560 | `ballY` 566.304 | **566.304** |
| Ball start x | 368, 400, 432 | 368.896, 400, 431.104 | agrees |
| P1 / P2 start x | 280 / 560 | server 228 / 536; client 241.6 / 486.4 | **228 / 536** — the server drives play. Three different values exist; `[new]` also randomises the assignment |

Derivation (`[orig]` `paddleGame.html:316-343`, `[new]` `game.py:99-122`):
`frameWidth = 800*0.9`, `pWidth = frameWidth*0.10`, `pHeight = pWidth*0.12`,
`bRad = pHeight*0.90`, `pSpeed = round(pHeight/2) = 4`,
`bSpeed = ceil(pSpeed*0.8) = 4`, `paddleY = frameBottom - pHeight*3`.

### Colours `[paper]` `game-details.tex`

| Element | `[paper]` | `[orig]` | Use |
|---|---|---|---|
| Own paddle | `rgb(178, 34, 34)` | `FireBrick` = `rgb(178,34,34)` | agrees — always red to the player viewing it |
| Teammate paddle (human or machine) | `rgb(0, 92, 222)` | `RoyalBlue` = `rgb(65,105,225)` | **`RoyalBlue`** — paper is wrong |
| Balls, collaborative and competitive | `rgb(148, 0, 211)` | `#963d97` = `rgb(150,61,151)` | **`#963d97`** — paper is wrong |
| Balls, separate | split evenly into own-red and teammate-blue | ball ids `0..n-1` own colour, `n..2n-1` partner's | agrees |
| DRT stimulus | `rgb(93, 197, 84)` | `#1bff00` = `rgb(27,255,0)` | **`#1bff00`** — paper is wrong |
| Frame | — | `ivory` | `[orig]` `paddleGame.html:218-223` |

## Physics

- Paddles and balls move at a base 4 px per screen update, time-corrected
  against the interval since the last update. `[paper]`; `ball_speed: 4.0` `[new]` `base.yaml:14`
- Balls launch upward at a uniformly random angle in 45°–135°. `[paper]`
- Balls reflect at the top bound (y = 0) and at the DRT panels (x = 40, 760). `[paper]`
- A ball passing y = 600 is a **miss**: it keeps its trajectory and re-enters at
  y = 0, so ball count is constant for the whole trial. `[paper]`
- A paddle rebound is a **hit**. Deflection is relative to contact point: centre
  contact reflects without deviation, off-centre deflects that way, magnitude
  rising with distance from centre. `[paper]`

Classic deflection rule, in radians `[new]` `game.py:701-707`:

```
contact_prop = ((x + ballR/2) - (paddle_x + pWidth/2)) / (pWidth/2)   # -1 .. +1
new_angle    = -angle + contact_prop/2
if new_angle <= -155° or new_angle >= -35°:  new_angle = -angle       # fall back to pure reflection
```

Confirmed identical in `[orig]`, both sides: client `paddleGame.html:437-451`,
server `game_qlearning.py:481-487`. The 155°/35° test is **a fallback to pure
reflection, not a clamp on the angle** — getting this wrong changes the hit-rate
distribution.

`[new]` labels this "Classic mode: original behaviour. Preserved exactly. All
data collected before June 2026 used this" (`game.py:701-703`). Its alternative
`breakout` mode (strong contact-point steering, `game.py:690-699`) is **not** the
published physics and must not appear in the demo.

Speeds, `[orig]` `paddleGame.html:318`, `:343`: `pSpeed = 4` and `bSpeed = 4`,
both per nominal **20 ms** frame — the `/1000/0.02` divisor at `:418-419` and
`game_qlearning.py:426-427`. That is 200 px/s for each, not per-rAF-frame.

Two `[orig]` internal inconsistencies to resolve deliberately in any port:

- Miss plane: client `frameHeight - bRad` = 592.224 (`:413`) vs server
  `frameBottom - 0.5*ballR` = 596.112 (`game_qlearning.py:441`). **Server wins.**
- Bottom wrap: client sets `y = bounds.top` leaving `angle` unchanged (`:526`) vs
  server `y -= (bottom - top)` (`game_qlearning.py:446`). **Server wins**; the
  client's version is presentation-only and is overwritten on the next snapshot.

Hit detection fires only while the ball is moving downward and inside the paddle
zone, to stop double-counting on the rebound. `[new]` `game.py:671-679`

## Scoring

| Condition | Award |
|---|---|
| Separate | +1 to the hitting player |
| Competitive | +1 to the hitting player; both scores visible |
| Collaborative | +1 to a single team score |

In collaborative and competitive, a simultaneous hit by both players on one ball
awards half points and a hit event to each — i.e. `+1/+1` when one paddle is
overlapped, `+0.5/+0.5` when both are. `[paper]`; confirmed `[orig]`
`game_qlearning.py:488-489`, `:503-504`, `:521-530`. Where both paddles yield a
deflection angle, the ball takes their mean (`paddleGame.html:469-478`).

A correct DRT response adds **+1** to the player's score on top of hits
(`paddleGame.html:1870`).

Separate condition is enforced by mechanics, not instruction alone: a ball of the
opposing paddle's colour **passes through** the paddle without deflecting.
`[paper]` `topics_revision.tex:240`

Miss attribution in separate is per-ball-owner; in collaborative and competitive
a miss is attributed to both players. `[new]` `game.py:659-664`

On-screen during a trial: remaining time at (400, 20), cumulative scores at
(50, 20) and (710, 20). `[paper]` `game-details.tex:5`

Primary performance measure: **miss rate** = 1 − hits/(hits+misses). `[paper]` `topics_revision.tex:~233`

## DRT

Both panels flash green simultaneously. `[paper]` `game-details.tex`

| Parameter | `[paper]` | `[orig]` | `[new]` |
|---|---|---|---|
| ISI | uniform 3000–5000 ms | `drtMin` 3, `drtMax` 5 `paddleGame.html:240-241` | `base.yaml:28-29` |
| Display | 1000 ms, or until response | `drtDur = 1` `:243` | `base.yaml:30` |
| Response window | not stated | `respWin = 2.5` s from onset `:242` | `base.yaml:31` |
| Minimum valid RT | not stated | `rtMin = 0.1` s — faster counts as a false alarm `:336` | — |
| Miss code | not stated | `-1` `:270` | — |
| ON / OFF colour | `rgb(93,197,84)` | `#1bff00` / `black` `:238-239` | — |

All three sources agree on 3–5 s / 1 s / 2.5 s. **A correct response scores a
bonus point** ("Respond quickly and accurately to the light for score bonuses!",
`:1484`) — the client sends `{score: score1 + 1}` (`:1870`).

Response key: `Z` for right-handed participants, `↑` for left-handed — always the
**non-dominant** hand. `[orig]` `paddleGame.html:252-253`

## Controls

Keyboard. Handedness is asked first and sets the mapping. `[paper]` `topics_revision.tex:204`

| Handedness | Move left / right | DRT |
|---|---|---|
| Right | `←` / `→` | `Z` |
| Left | `Z` / **`C`** | `↑` |

`[paper]` says the left-handed move keys were `z`/`x`; `[orig]`
`paddleGame.html:326-327` says `Z` (90) and `C` (67). **Use `Z`/`C`.** Note the
collision this creates: keyCode 90 is both the right-hander's DRT key and the
left-hander's move-left key (`:252`, `:326`).

Handedness is chosen by keypress, not a form: `Z` selects right-handed, `↑`
selects left-handed (`:812-829`).

**The paddle moves only while a key is held.** `[paper]` — no momentum, no
click-to-move, no mouse.

Space bar advances instruction screens and signals readiness. `[paper]`

## Trial and block structure `[paper]` `topics_revision.tex:242`

- 3 blocks, one group condition each, counterbalanced across the 6 orders
  (`base.yaml:18-25`).
- 12 trials per block: each of the 4 workload levels three times, random order
  (`n_balls_sequence: [1,1,1,3,3,3,6,6,6,9,9,9]`, shuffled per block).
- 36 trials total. Each trial 45 s.
- Inter-trial break: minimum 5 s, showing the trial score, cumulative block
  score, a DRT reminder and the current group condition. In HH, the next trial
  starts once **both** players signal ready.
- Inter-block break: forced 20 s, presenting the next block's instructions.
- Total session ≈ 40 minutes.

### Practice `[paper]` `topics_revision.tex:236-238`

1. 25 s low-workload trial, **no DRT**.
2. DRT introduced and its key shown.
3. 25 s practice with **DRT only** — no gameplay.
4. One full-length medium-workload trial: 3 balls, 45 s.

All practice is completed **separately** (no partner). Practice data were not
recorded.

## Instruction wording — quote, do not paraphrase `[paper]` `topics_revision.tex:240`

What participants actually saw at the start of each block, `[orig]`
`paddleGame.html:1568-1592`:

> Please take a short 20 second break before beginning block {n} of 3
> Starting block {n} of 3
> Please use the below instructions to guide your playing strategy.

| Condition | Block instruction, verbatim |
|---|---|
| Separate (`nonCol`) | "During this block you will only be able to hit the red balls." |
| Collaborative (`col`) | "During this block you must work together!" / "Both of your hits count towards a team score." |
| Competitive (`com`) | "During this block you must try to outscore your opponent." |

Followed in every condition by:

> Try to hit as many balls as you can but don't forget
> to respond quickly and accurately to the flashing light.

`[paper]` paraphrases these as "work together to score as high as you can" and
"try to outscore your opponent". **The `[orig]` strings above are what was on
screen** — use them.

Overall aim as described to participants: maximise ball deflections.

The six instruction screens, the practice overlay, the inter-trial summary and
the per-condition encouragement quotes are all verbatim in `paddleGame.html`:
screens at `:1409-1520`, practice overlay `:1529-1547`, inter-trial
`:2399-2453`, encouragement `:2400-2417`. Quote from there rather than
rewriting.

HM teams were split on disclosure: an **ambiguous** group was told only that they
were playing "another player", a **machine-informed** group was told explicitly
that the partner was a machine algorithm. Disclosure had no effect and is excluded
from the paper's analysis. `[paper]` `topics_revision.tex:162,236`

## Machine agents

Three agents, counterbalanced, collapsed in analysis after null effects between
them. `[paper]` `topics_revision.tex:202`

**None of them were designed to be optimal.** They were tuned to reproduce the
human miss rates observed in the HH arm: ≈0.05 at low workload, ≈0.65 at very
high. `[paper]` `game-details.tex`, `topics_revision.tex:202`

> The ≈0.05 low-workload figure is **not reachable** from the documented
> algorithm: a 4 px / 20 ms paddle covers 240 px within the 1.2 s horizon, on a
> 720 px court. A faithful port measures 0.230 there and 0.628 at very high
> workload, and no bot-speed multiplier reconciles both ends. Measurements and
> the sweep are in
> [`team-spirit-fidelity.md`](team-spirit-fidelity.md#agent-calibration--one-endpoint-matches-one-does-not).
> The paper states the agents' design target, not their measured performance —
> the latter is in the OSF supplement, unconsulted.

### Ideal observer, simple (IOs) `[paper]` `game-details.tex`, `topics_revision.tex:401-403`

Per screen update:

1. Divide the playing area into **80 locations**.
2. Weight each location by the balls' predicted paddle-line intercept `x` and
   time-to-intercept `t`, accounting for deflections that will occur before
   intercept. Closer in space and sooner in time weighs higher.
3. Move the paddle 4 px toward the highest-weighted location.

Balls with `t` more than **1.2 s** in the future are ignored — this is the
constraint that makes it human-like rather than optimal.

Working code: **`paddle-exp/paddle_exp/bots/greedy.py:18-72`** (`GreedyBot`, 80
bins) with the 1200 ms forward trace in `bots/base.py:244-267`. ~90 lines, ports
directly to JS. **One deviation to fix rather than inherit:** `greedy.py:47-56`
weights bins by spatial proximity only and discards the temporal term
`intercept["p"]` that `base.py:265` returns, although `[paper]` specifies
"temporal and spatial proximity".

Not present in `[orig]` — `paddleGame.html` and `game_qlearning.py` contain only
the RL agent. The IO agents' original implementation is not in this repo.

### Ideal observer, considerate (IOc)

Identical to IOs, except that in the **collaborative** condition it zeroes every
location within **100 px** of the participant's paddle. `[paper]`

Working code: `paddle-exp/paddle_exp/bots/greedy.py:75-93` (`CollaborativeBot`),
which zeroes bins where `partner_left - 100 <= x <= partner_right + 100` and only
when `block_type == "col"`.

### Reinforcement learning (RL)

Q-learning, trained over **40,000 episodes** on relative agent–ball distance,
reward = hits. At 1 ball it takes the max-q action; at 3, 6 and 9 balls it takes
the action with the maximum **mean** q-value across the per-ball best actions.
`[paper]` `game-details.tex`

Code: `team-spirit/bot/murrayserver/game_qlearning.py:54-91` (the agent) and
`:551-610` (action selection). `[new]` ships a trained table at
`models/Q_experiment.pickle` and a `bot_speed_multiplier: 1.5` applied over base
paddle speed (`base.yaml:38-41`) — **the multiplier is `[new]`-only, is not in
the published design, and measurably moves agent performance away from the
published figures. Do not adopt it.**

Two `[orig]`-vs-`[paper]` divergences in the RL agent:

- **Multi-ball action selection.** `[paper]` says "maximum **mean** q-value from
  the q-values of the best action for each ball". `[orig]` `:551-610` takes the
  **mode** of the per-ball argmax actions (`np.unique(..., return_counts=True)`,
  then `argmax(counts)`); the mean-Q and sum-Q variants are present but
  commented out. The paper describes a variant that was not the one running.
- `epsilon = 0` (`:56`), so the agent is fully table-driven with no exploration
  noise. The commented alternative is `0.85`. State encoding is
  `[round(ball.x/13.5) - round((pos+36)/13.5), round(paddleY/10) - round((ball.y+ballR)/10)]`
  (`:62-71`), and only descending balls (`dir == 0`) are observed (`:419-436`).

The table itself is `q_models/Q-events-coords1648730186.21807.pickle` (`:51-53`).
A 40,000-episode Q-table is not worth shipping to a browser; prefer the IO agents
for the demo.

## Timing

Server-authoritative: game mechanics ran in Python 3.8, the client only rendered
and collected input. `[paper]` `topics_revision.tex:204`.

| State | Authority in `[orig]` |
|---|---|
| Ball position, angle, speed | Server. The client overwrites them from the snapshot every frame (`paddleGame.html:406-407`) and re-extrapolates from `state.timestamp`, so client ball physics are presentation-only |
| Hits, misses, score | Server (`game_qlearning.py:488-542`) — **except** the DRT bonus, which the client writes by sending `{score: score1+1}` (`:1870`) over an unvalidated merge (`game_qlearning.py:236`) |
| Own paddle x | Client |
| Partner paddle x | Server relay, with 5000 ms of linearly-interpolated paddle history for lag compensation (`paddleGame.html:124-162`, `:459-467`) |
| Status, block, trial, workload, DRT onsets | Server |

Transport is a raw `WebSocket` at `<host><dir>/coms` (`paddleGame.html:98-102`),
sending `{pos, serverTimeDelta, messageDelay, roundTripTime}` every **50 ms**
while playing (`:2186-2189`), and receiving one unenveloped full-state
`json.dumps` merged with `Object.assign` (`:2211`, `:2278`).

**For a single-process port**, collapse this to one authoritative loop: step the
ball at a dt-scaled 4 px per 20 ms (not a fixed per-frame increment, and clamp dt
so a tab-switch cannot teleport the ball), and drop the clock-sync, paddle
history and extrapolation machinery entirely — it exists only to hide network
latency.

Logging in `[orig]` is server-side only: one `json.dumps(state)` per line to
`$MURRAYSERVER_LOG_PATH/game-<ISO8601>-<n>.txt` (`game_qlearning.py:685-697`).
The client's `paddleCoords`, `ballCoords`, `scoreData`, `drtData` and
`outputSummary` arrays are declared and never written (`paddleGame.html:370-375`).

## What a faithful single-player demo must preserve

"Single-player was a real condition" is only half true and the distinction
matters for how the demo is framed:

- The **separate** (`nonCol`) condition is genuinely solo in substance — own
  targets, own score, no team responsibility. The paper uses exactly this
  condition to set its exclusion criteria "as a participant had only a single
  ball and no team responsibilities" (`topics_revision.tex:206`). A partner
  paddle is still on screen and still hitting its own balls.
- **Human–machine** teaming was a real, published arm. A local bot partner in
  the collaborative and competitive conditions is therefore faithful to the HM
  arm, not a substitute for the HH arm.

So a zero-server demo can honestly present: all three group conditions, all four
workload levels, the DRT, and a bot partner — labelled as the **human–machine**
arm. What it cannot present is human–human teaming, and it must not claim to.
