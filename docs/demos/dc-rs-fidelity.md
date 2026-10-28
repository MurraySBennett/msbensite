# dc-rs demo — spec and fidelity diff

What `js/demos/dc-rs.js` does, against the lab.js studies that collected the data.

**Paper:** Gronau, Q. F., Bennett, M. S., Brown, S. D., Hawkins, G. E., & Eidels,
A. (2023). Do choice tasks and rating scales elicit the same judgments?
*Journal of Choice Modelling*, 49, 100437. doi:10.1016/j.jocm.2023.100437.
OSF: <https://osf.io/5zpax>.

Unlike `team-spirit`, the ground truth here is uncontested: the lab.js study
files **are** the experiment, so there is no paper-versus-code reconciliation to
do and no separate spec file. Sources:

| Tag | File |
|---|---|
| `[perc]` | `dc_rs/perceptualChoice/experiment/darkestsquarescombinedrsdce-2020-09-26--18_20.study.json` (lab.js v20.1.1) |
| `[health]` | `dc_rs/healthChoices/experiment/dcvsrs-health-choices-2021-08-12--13_16.study.json` (lab.js v20.2.3) |
| `[analysis]` | `dc_rs/perceptualChoice/readAll.m` |

**Verdict: the demo is recognisably the right task, and gets four things wrong
that change what it measures.** It is in much better shape than the old
`team-spirit-hh` was — the stimulus construction, the three-square layout, the
click-the-darkest response and the 7-point scale are all genuinely the study's.
But it gives trial-by-trial correct/incorrect feedback the experiment
deliberately withheld, removes the response deadline, records nothing, and uses
a superseded stimulus set that makes the discrimination twice as easy.

---

## Terminology — the demo uses the wrong names

The paper's terms are **CT** (choice task) and **RS** (rating scale). The last
commit in `dc_rs` (2023-05-04) was specifically a rename of DC → CT in the
manuscript figures, and `dc_rs/WORK.md` records it as "aligning the figures
with" the paper's terminology.

The demo is titled "Discrete Choice vs Rating Scale Decisions" in
`js/experiment-demo-loader.js:28-31` and "Discrete Choice vs Rating Scales" in
`experiments.html:68-74`, and its on-screen heading is "Discrete Choice Task
Demo" (`dc-rs.js:198`). The abstract is explicit about why this matters: "Our CT
featured many characteristics that define a DCE, however, in order to have a
known objectively correct response, it also differed in a few important ways."
Calling it a discrete choice experiment claims the thing the authors went out of
their way to qualify.

---

## The published task `[perc]`

The perceptual experiment is the paper's main study — the abstract describes "a
perceptual discrimination experiment where response options varied on a single
attribute … with a known objectively correct response."

### Stimuli

Three 200 × 200 px canvases, drawn live. Each is filled white, then
`parseInt(prop * 40000)` single-pixel black `fillRect`s are placed at uniformly
random, non-repeating positions. Apparent darkness is therefore pixel density —
there are no grey levels anywhere in the study.

| Proportion | `[perc]` as run (v2) | Superseded (v1) |
|---|---|---|
| 1 | **0.475** | 0.45 |
| 2 | **0.4875** | 0.475 |
| 3 | **0.50** | 0.50 |
| 4 | **0.5125** | 0.525 |
| 5 | **0.525** | 0.55 |

`[analysis]` `readAll.m:29-30` records the v1 → v2 change. **v2 halves every
step**: the full range is 0.475–0.525 rather than 0.45–0.55.

### Trial structure

| Screen | Duration |
|---|---|
| Fixation — yellow `#fcbb0a` circle, r = 20.475, white 1 px stroke | 200 ms |
| Blank | 0 ms |
| **Stimulus** | **7000 ms deadline**, or until response |
| Blank | 700 ms |
| Post-response feedback hold | 500 ms (non-practice), 2000–3000 ms (practice) |

20 trials before a break; the break is a forced 20 s followed by a keypress
screen. 6 blocks × 20 = **120 experimental trials** in each of CT and RS.

### Practice, and the feedback rule

Each arm runs: 8 **easy** practice trials with feedback (proportions 1/3/5 only)
→ 8 **hard** practice trials without feedback → 120 experimental trials.

**Feedback appears in practice only.** The experiment instructions say so
verbatim, in both arms: *"There will be no feedback provided in this
experiment."* In CT the feedback is a light-blue "Darkest" label over the correct
square; in RS it is governed by `window.feedback`, which loop 56 sets true, loop
65 sets false, and the experimental loop 75 never touches — so it stays false.

### The two response modes

**CT** — click one of the three canvases. No keyboard. A pink arrow marker
appears under the chosen square. The trial screen carries no prompt text at all;
the task is established by the instruction screen: *"Your task will be to click
on the darkest square"*.

**RS** — the arrow marker appears under one square **before** the response, and
the participant rates confidence that *that* square is the darkest, on 7
discrete clickable divs with no default position. Endpoint labels, verbatim:

> `Certainly NOT the darkest` --- 1 | 2 | 3 | 4 | 5 | 6 | 7 --- `Extremely confident this is the darkest`

Framing, from `RS Instructions2`: *"Decide how confident you are that the
indicated square is the darkest, by placing a rating on the scale below the
images … The higher the rating on the scale, the more confident you are that the
square with the arrow underneath, is the darkest square."*

### Order

`window.dceLast = Boolean(Math.round(Math.random()))` at the global intro — a
fair coin per participant, so CT→RS or RS→CT. RS always sits in the middle of
the component tree; the two CT arms self-`end()` on the flag.

### Recorded per trial

`A`, `B`, `C` (proportion indices), `blockNo`, `trialNo`, `practice`, `response`,
`duration`, `ended_on`, plus `correctResponse` and `correct` in CT and `which`
and `darkest` in RS. `[analysis]` excludes RT < 200 ms and `ended_on ==
'timeout'`.

---

## Divergences

### Fatal — these change what the demo measures

| # | Aspect | Demo | `[perc]` |
|---|---|---|---|
| 1 | **Feedback** | **Every trial**, in both blocks: green 8 px border for correct, red on the chosen square plus green on the correct one for incorrect (`dc-rs.js:52-59`, `:513-523`, `:535-557`) | **Practice only.** The experiment instructions state "There will be no feedback provided in this experiment" |
| 2 | **Response deadline** | None. Self-paced, unlimited (`:426-498`) | **7000 ms**, after which `ended_on: 'timeout'` and the trial is excluded in analysis |
| 3 | **Response time** | Not recorded (`:501-566` discards everything) | `duration` recorded per trial and central to the analysis |
| 4 | **Stimulus difficulty** | 0.45, 0.475, 0.50, 0.525, 0.55 (`:266-273`) — the **superseded v1 set** | 0.475, 0.4875, 0.50, 0.5125, 0.525. The demo's smallest discrimination is 0.025, the study's is 0.0125 — **twice as easy** |

Item 1 is the serious one. Giving correct/incorrect feedback on every trial turns
a perceptual judgment task into a learning task, and the paper's claim rests on
comparing a stable internal representation across two response modes. The demo
also applies a *correctness* rule to the rating scale (`:535-557`: green if the
indicated square is darkest and the rating is ≥ 6, or not darkest and ≤ 2),
which the study never does — RS records no `correct` field at all.

### Material

| # | Aspect | Demo | `[perc]` |
|---|---|---|---|
| 5 | Rating endpoints | "Definitely NOT the darkest" / "Definitely the darkest" (`:234`, `:242`) | "Certainly NOT the darkest" / "Extremely confident this is the darkest" — asymmetric and confidence-framed. The demo's symmetric wording is the **health** study's pattern ("Definitely NOT the best" / "Definitely the best"), transplanted onto squares |
| 6 | Rating prompt | "Is the indicated square the darkest?" (`:479`) — a yes/no question answered on a 7-point scale | "Decide how confident you are that the indicated square is the darkest" |
| 7 | Indicator | Purple `box-shadow` under the square (`:60-63`) | A pink arrow marker image, 100 × 139 px |
| 8 | Trial count | 12 total: 2 blocks × 6 (`:261`, `:284-307`) | 120 per arm, plus 16 practice |
| 9 | Order | Fixed: all choice trials, then all rating trials (`:285-304`) | Coin-flipped per participant |
| 10 | Practice | Absent. `practiceFeedbackDuration: 1500` is declared at `:263` and never read | Two staged practice phases per arm, easy-with-feedback then hard-without |
| 11 | Fixation and ITI | Absent; next trial starts straight after a 1000 ms feedback hold (`:561-565`) | 200 ms fixation, 700 ms post-response blank |
| 12 | Breaks | Absent | Forced 20 s every 20 trials |
| 13 | Instructions | One screen, describing the choice task only (`:199-200`). **No rating-block instructions exist** | Separate multi-screen instructions per arm, with worked example images |

### The health arm is absent entirely

`js/demos/dc-rs.js` has no scenario, attribute or health string anywhere. `[health]`
is a hypothetical-vaccine DCE: 3 attributes × 2 levels — efficacy 70 % or 80 %,
side-effect rate 1/1,000 or 1/10,000, 1 or 2 doses — fully crossed into 64 pairs,
4 blocks × 16 trials, 10 s deadline, order coin-flipped, and a 7-point confidence
scale asking *"How confident are you that Vaccine ${Target} is the best option?"*
between "Definitely NOT the best" and "Definitely the best".

**It does not belong, and the handoff's premise was wrong.** The handoff said
"the two-domain structure is the paper's point and must survive". Three
independent lines say otherwise:

1. The published abstract describes only "a perceptual discrimination
   experiment", singular. The methodological point it turns on — a *known
   objectively correct response* — is a property the vaccine task does not have.
2. The site's own project copy, `data/projects/discrete-choice-rating/content.md`,
   says: *"This is evidence from a **single-attribute** perceptual task. Whether
   the same conclusions hold for choices involving **several attributes**, such
   as consumer preferences, remains a separate question."* The health task is
   three-attribute. That sentence excludes it explicitly.
3. The same copy reports "80 participants completed both formats using the same
   visual stimuli" and a model comparison favouring the shared model "for 57
   participants" — a single perceptual sample, with no second domain.

The one point the other way is that the paper's OSF repository carries
`data/2021`: ten JATOS result files dated 13–20 August 2021, right after the
health study file's 2021-08-12 timestamp, alongside `data/2019a` and `data/2019b`
which split into `DCE`/`RSE` and are the perceptual waves. So the health data are
*hosted* with the paper without being *reported* in it — unpublished or
belonging to other work.

**The demo carries the perceptual task only.** If the health arm turns out to be
in the paper after all, it is a separate demo rather than a second mode in this
one: different stimuli, different deadline (10 s), different scale wording.

### Vestigial and broken in the current demo

Not fidelity issues, but they go away in a rebuild:

- `:71` — a missing semicolon after `background-color: transparent` swallows the
  following `display: flex`, so the overlays are never flex-centred.
- `:120-131` — `#rating-scale-container` is placed at `grid-row: 4` on a grid
  that defines three rows (`:11`).
- `:274-283` — proportion sets 6 and 7 are defined but unreachable; the configs
  referencing them are commented out.
- `:525-528`, `:467-468` — values computed and never used; `correctResponse` is
  computed on rating trials where it has no meaning.
- `:599` — the block-complete heading and the in-trial counter use different
  indexing and agree only by coincidence.
- `:53`/`:57` — comments say "5px" where the rule is 8 px.
- Everything is global; re-running the script throws on `const` redeclaration.

---

## Resolution — rebuilt 2026-10-28

Rebuilt in the same register as `team-spirit-hh`: short, no upkeep, honestly
labelled, but not wrong about what the task was.

| Item | Status |
|---|---|
| Feedback | **Practice only.** A "Practice over" screen states that feedback stops, so the rule is legible rather than arbitrary. Practice is optional |
| Deadline | 7000 ms, with the timeout recorded and reported as a timeout |
| Proportions | The v2 set, 0.475–0.525, every step 0.0125 |
| Rating scale | 7 points, no default, "Certainly NOT the darkest" / "Extremely confident this is the darkest" |
| Rating framing | Confidence that the marked square is darkest — the arrow appears **before** the response |
| Fixation / ITI | 200 ms yellow fixation, 700 ms post-response blank |
| Practice difficulty | Easy levels only (indices 0/2/4), as the study's easy practice loop |
| Results | Accuracy and mean RT for CT; for RS, mean rating split by whether the marked square really was darkest, and the separation between them |
| Terminology | CT and RS throughout, in the demo, the loader title and the `experiments.html` tile |
| Session shape | **Not reproduced.** You pick one mode and 12–40 trials; the four differences are listed under the task |

The RS summary is the paper's question in miniature: the gap between "marked
square was darkest" and "marked square was not" is what the rating scale knows
about the stimulus, and the study found CT carried that information more
sharply.

Evidence: `tests/dc-rs-demo.cjs`, 18 tests, `npm run test:demos`.

**One real bug found by the tests, now fixed:** the squares stay on screen
through the post-response feedback hold, so a click arriving after the 7 s
deadline was still accepted — it overwrote the already-recorded timeout trial
and pushed a duplicate record. Trials now close when they end.

### Not yet done

- **Not published.** Same gate as `team-spirit-hh`: `scripts/build_site.py`'s
  allowlist excludes `js/demos/`, and the reserved `demos/` prefix from Phase 1
  of `~/.claude/plans/i-don-t-mind-if-ancient-deer.md` has to land first.
- `data/projects/discrete-choice-rating/meta.json` `links.experiment_demo` and
  `links.interactive_demo` are still empty, and `links.osf` is empty too though
  <https://osf.io/5zpax> exists. Fill all three in the publishing change.

---

## What a faithful gist demo should do

Same register as the rebuilt `team-spirit-hh`: short, no upkeep, honestly
labelled, but not wrong about what the task was.

Cheap and worth keeping:

- **Drop the feedback** outside a clearly-marked practice phase. This is the
  whole point and costs nothing.
- **Restore the 7000 ms deadline**, and show the timeout as a timeout.
- **Use the v2 proportions** (0.475–0.525). The task should feel hard, because it
  was.
- **Fix the rating wording** to "Certainly NOT the darkest" / "Extremely
  confident this is the darkest", and frame it as confidence rather than a
  yes/no question.
- **Record and show RT and accuracy** in-session, so the visitor can see the
  thing the paper compares: how sensitive each response mode is.
- A short practice phase with feedback, then a handful of real trials without —
  that is the study's own structure and makes the no-feedback rule legible
  rather than arbitrary.

Reasonably dropped for a gist demo, and stated on the page:

- 120 trials per arm, the 6×20 block structure, the forced 20 s breaks.
- Per-participant order counterbalancing (keep a toggle instead).
- Data storage of any kind.
- The health arm, pending the question above.
