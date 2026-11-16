# wheel-of-fortune demo — spec and fidelity diff

What `js/demos/wheel-of-fortune.js` does, against the experiment that collected
the data.

## The paper — confirmed

The handoff said to confirm which paper this corresponds to before linking one.
**Confirmed:**

> Garrett, P. M., Bennett, M. S., Howard, Z. L., Yang, C.-T., Little, D. R., &
> Eidels, A. (2022). Wheel of Fortune: A Cross-cultural Examination of How
> Expertise Shapes the Mental Representations of Familiar and Unfamiliar
> Numerals. *Computational Brain & Behavior*, 5(1), 45–59.
> doi:10.1007/s42113-021-00122-1

The demo's name is not a metaphor — it is the paper's title. Published online
2021, in issue 5(1) 2022, so both dates are correct and the DOI should carry the
citation. `data/publications.json` already has this as `garrett2022wheel` and
`data/projects/wheel-of-fortune/meta.json` already links the DOI; both are right
and needed no change.

Evidence: three pre-publication drafts in `records/honours-wheel-of-fortune/WriteUp/`
share the author set and the funding note (ARC Discovery DP160102360 to Eidels &
Little; John and Daphne Keats endowment G1700468), and match the published
abstract, the four stimulus sets, the Luce-plus-MDS method and the "$2 vs $9
price tag" framing.

Two of those drafts are the English cohort ("Wheel of symbolic fortune"; "The
cost of errors") and one is the Chinese/Taiwanese cohort. The published title
shows they were merged. **There is no Experiment 2** despite the `Exp2Code/`
directory — that is Murray's honours *analysis* code for the same study, every
script hardcoding `Study 4.1 - Spin_n_Win_Chineese_and_English_Characters`.

Sources:

| Tag | Where |
|---|---|
| `[exp]` | `records/honours-wheel-of-fortune/ExperimentEnglish/` — the Python/Pygame program |
| `[fit]` | `records/honours-wheel-of-fortune/Exp2Code/Functions/` — `f_DE_optim_Luce.m`, `f_loglike_confusions.m`, `f_SimChoiceTownsend.m`, `f_predicted_sim_choice.m` |
| `[mds]` | `records/honours-wheel-of-fortune/Exp2Code/UnbiasedMDS_Numbers.m` |

**That corpus is not under version control.** It was read strictly read-only and
nothing in it was modified.

---

## The published task `[exp]`

A nine-alternative identification task: a numeral appears briefly, degraded by
noise, then a mask destroys it, and the participant says which one it was.

### Design

Four sessions per participant, one per numeral set, order from a Latin square.
~90 minutes each. Within a session: a 135-trial calibration block with
trial-by-trial feedback and a contrast staircase, then **13 blocks × 90 = 1,170
test trials** with no feedback. 1,305 rows per session.

| Set | Items |
|---|---|
| Arabic | 1–9, Calibri 80 pt |
| Chinese | 一 二 三 四 五 六 七 八 九, DFKai-SB 80 pt |
| Thai | ๑ ๒ ๓ ๔ ๕ ๖ ๗ ๘ ๙, Calibri unicode 80 pt |
| Dots | playing-card patterns on a 3×3 grid; 8 and 9 "slightly altered to fit" |

**Zero was excluded** — "avoided due to similarities across numeric-types" —
which is why every confusion matrix is 9×9.

### Trial sequence

| Step | Duration |
|---|---|
| Blank | 250 ms |
| Fixation cross | 500 ms |
| Blank | 250 ms |
| **Noisy target** | **500 ms** |
| **Mask** | **200 ms** |
| Response wheel | **8,000 ms** deadline |

Stimuli are 221 × 221 px TIFs. Noise is i.i.d. Gaussian per pixel, glyph at the
signal level on a 128 background, `mu = 0`, scaled by `255 × 0.5`.

> **Code–paper conflict, left unresolved deliberately.** The experiment code and
> the corpus `Readme.docx` both specify `sigma = 0.25`. The published paper
> reports **0.125**. The demo uses 0.25, because that is what ran, and records
> the disagreement here rather than silently picking one.

The mask is a 40 × 40 random matrix rendered large. The contrast staircase is
**2-up-1-down** on the glyph's grey level: start 153, step 1, two consecutive
correct makes it dimmer, one error makes it brighter, bounded 128–255. The anchor
is the mean of the last 30 calibration trials, and test contrasts are
`anchor-3 … anchor+1`.

Response is by **mouse**, and nothing is clicked. The wheel is a **two-ring
annulus**, divided into nine cells by radial lines, with a numeral inside each
cell — outer radius 520 px, inner 400 px, so the band is 120 px and the glyphs
are 100 px. **It is on screen for the whole session, not revealed per trial.**
The answer is logged the instant the cursor's distance from centre exceeds the
inner radius, and the crossing angle picks the cell. The nine numerals are
shuffled across cells per session. Timeouts log `RT = -8000`.

Verbatim instructions include: *"In the following task, you will be briefly
presented with one of nine symbols."* / *"A response is taken when the cursor
passes the center circle."* / *"This experiment is designed to be difficult,
sometimes you will not know the right answer. If in doubt, always respond with
your best guess."*

### The model `[fit]`

Luce's (1963) similarity choice model, fitted to the 9×9 matrix of raw confusion
counts from the test blocks:

```
P(respond j | show i) = b_j · eta_ij / sum_k b_k · eta_ik        eta symmetric, eta_ii = 1
```

**45 free parameters** — 9 biases plus 36 upper-triangle similarities; the paper
quotes 44 after the bias vector is normalised to sum to 1. `b` is response bias,
a tendency to pick *j* whatever was shown; `eta` is bias-free confusability, the
quantity of interest.

Fitting is a differential-evolution hill-climb over a row-wise multinomial
likelihood: 50 chains × 500 iterations, `F = 2.38/sqrt(2·nparams)`, greedy
acceptance (so maximum likelihood, not posterior sampling). **Chains are
initialised at Townsend's (1971) closed form**:

```
eta_ij = sqrt( p_ij · p_ji / (p_ii · p_jj) )
```

`[mds]` then runs non-metric MDS (`mdscale`, sstress, 100 replicates) on the
de-biased `eta`, beside a "biased" MDS of the raw confusions for comparison. The
paper adds INDSCAL, k-means clustering, and a template-matching ideal observer.

### Data state

`Exp2Code/Data/` is **empty**; the real dataset is 160 `.mat` files in
`SpinAndWinAnalysis/Mat/`, with fitted solutions in `MDSmat/` and 215 MB of
ideal-observer templates. **The glyph images are gone** — `NumberStimuli/` and
`GreyNumberStimuli/` (36 TIFs) are absent from the corpus entirely. That is a
blocker for byte-identical reproduction, but not for a demo, which can render
the characters directly.

---

## Divergences in the old demo

### Fatal

| # | Aspect | Old demo | `[exp]` |
|---|---|---|---|
| 1 | **The model** | **Absent.** No confusion matrix, no Luce model, no MDS. The completion screen is "Thanks for participating!" | The whole output is a bias-free similarity map |
| 2 | **Nothing recorded** | `logTrialData` is a bare `console.log`; no array accumulates across trials, so a confusion matrix could not be built even in principle | 9×9 counts per participant per set |
| 3 | **One set of four** | Arabic 1–9 only. No Chinese, Thai or dots anywhere in the file | Four sets — and the familiar/unfamiliar contrast *is* the paper's finding |
| 4 | **Noise out of contract** | `noiseLevels: [2.2]`, against the file's own documented 0.0–1.0 range (`:13`, and the `drawNoisyStimulus` JSDoc at `:352`). On a 0–255 scale that is a ±561 perturbation: a white block saturates half the time and goes black about a quarter. The glyph is destroyed, not degraded. The commented-out alternative on the same line is `[0.02 … 0.1]` | Gaussian sigma 0.25 scaled by 255 × 0.5 |
| 5 | **6 trials** | 6 trials, 1 block, uniform sampling with replacement so digits may repeat or never appear | 1,170 test trials per set |

Item 4 is the one a visitor would feel: the task was not hard, it was impossible.

### Material

| # | Aspect | Old demo | `[exp]` |
|---|---|---|---|
| 6 | Target duration | 1000 ms | 500 ms |
| 7 | Mask duration | 50 ms | 200 ms |
| 8 | Deadline | 6000 ms | 8000 ms |
| 9 | Calibration | Absent | 135 trials, 2-up-1-down staircase, anchor from the last 30 |
| 10 | Feedback | Green/red borders on **every** trial | Calibration only |
| 11 | Wheel order | Fixed 1–9 clockwise | Shuffled per session |
| 12 | Buttons visible during the stimulus | Yes — `:525` sets `display: block` at trial start, while CSS `:146` comments "Still hidden until response phase" | Wheel appears after the mask |

### Dead and contradictory code

- `:488-496` logs `state.correctStimulus` **before** it is assigned at `:547`, so
  it prints `null` on trial 1 and stale values after.
- `:498-505` block-advance branch is unreachable.
- `state.mousePath` is initialised, logged, and never populated — there is no
  `mousemove` listener. The original recorded the full path.
- `:711-719` `try`/`catch` wraps nothing that throws; the error branch and its
  message are unreachable leftovers from an image-loading version.
- `conf.stimulusCanvasWidth`/`Height` declared, never read.
- The global `keydown` listener is added once and never removed, surviving after
  the demo finishes.

---

## Resolution — rebuilt 2026-10-28

| Item | Status |
|---|---|
| Model | **Fitted in-browser**: confusion matrix → Luce similarity → classical MDS, with the map rendered from the visitor's own responses |
| Response bias | Estimated and reported — "strongest response bias, N× even" |
| Sets | All four, nine items each, zero excluded |
| Timing | 250 / 500 / 250 / **500** / **200** / **8000** ms |
| Noise | Gaussian, sigma 0.25, scaled 255 × 0.5, mid-grey background |
| Calibration | 15 trials, 2-up-1-down from 153, anchor from the last 6, then `anchor-3 … anchor+1` |
| Feedback | Calibration only, with an explicit "feedback stops now" screen |
| Wheel | Two-ring annulus, nine cells with the numerals inside, order shuffled per run, **always on screen** |
| Response | Cursor-crossing: moving out through a cell past the inner ring commits that numeral. Nothing is clicked |
| Between trials | The cursor returns to a marked home circle at centre, which arms the next trial — so every trial starts from the same place |
| Session shape | **Not reproduced.** One set, 45–90 test trials; the five differences are listed under the task |

Three deliberate demo-only departures, all stated on the page:

- **Townsend's closed-form estimator instead of the DE search.** It is what the
  study uses to *initialise* its 45-parameter fit, and a differential-evolution
  search over 45 parameters from a few dozen trials would fit noise.
- **Classical MDS rather than non-metric `mdscale`.** Nine points, and the
  simplification is named.
- **The mouse path is not recorded.** The original logged the full trajectory;
  only the crossing is kept here.

Plus two things the study did not need.

**A missing-font guard.** The study used fixed images, so glyph shapes were
guaranteed. Rendering live from fonts means a visitor without a Thai or CJK font
would be identifying `.notdef` boxes — hard for the wrong reason. The demo
refuses the set with an explanation rather than showing tofu. Dots are drawn on
canvas and so always work.

> The first version of this guard compared each glyph's **advance width**
> against an unassigned codepoint, and was wrong: measured in Firefox here,
> `.notdef` is 31 px wide while the Arabic digits run 19.5–29.6, and one of them
> collides — so the demo refused to run its own default set. It now compares
> **rendered pixels**, which cannot collide, because tofu renders identically
> for every missing character. Worth remembering as a general point: width-based
> font detection is a coincidence away from being wrong.

**The cursor is hidden during the presentation.** It rests dead centre, exactly
where the target appears, and an arrow sitting on a near-threshold noisy glyph
is a cue in its own right. It is hidden from the start of the trial sequence and
restored when the answer is wanted. The original had this problem too and, as
far as the corpus shows, did not solve it.

Smoothing: `+0.5` to every cell before taking the Townsend ratio, because a short
session leaves empty cells and the ratio is otherwise undefined. The demo also
warns when fewer than 36 test trials were answered that the map is mostly noise,
rather than presenting it as a result.

Evidence: `tests/wheel-of-fortune-demo.cjs`, 22 tests, `npm run test:demos`. The
estimator is checked by generating confusions *from the model* with known
`eta` and `bias` and recovering them to within 0.05; a separate test confirms the
recovered similarities are unchanged when response bias is made lopsided, while
the raw confusion rates move — which is the entire reason the study uses Luce's
model. MDS is checked against a known one-dimensional layout and a two-cluster
structure, and Jacobi against matrices with known eigenvalues.

### Not yet done

- **Not published.** Same gate as the other three: `build_site.py`'s allowlist
  excludes `js/demos/`.
- `data/projects/wheel-of-fortune/meta.json` `experiment_demo`, `interactive_demo`
  and `osf` are empty; fill them in the publishing change.
