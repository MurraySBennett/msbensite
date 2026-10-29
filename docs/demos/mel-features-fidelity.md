# mel-features demo — spec and fidelity diff

What `js/demos/mel-features.js` does, against the lab.js study that collected the
data.

**Paper:** Bennett, M. S., Houpt, J. W., Wenger, M. J., Townsend, J. T., & Mark,
J. (2026). Under review, *Behavior Research Methods*. Preprint
doi:10.31234/osf.io/kgeyt_v1. OSF: <https://osf.io/ctg9s>.

| Tag | Source |
|---|---|
| `[study]` | `melanoma-identification/pwc/btl_melanoma.study.json` (lab.js 20.2.4) |
| `[analysis]` | `melanoma-identification/pwc/scripts/00_read_data.py` |
| `[power]` | `melanoma-identification/pwc/guides/power-analysis.md` |
| `[images]` | `melanoma-identification` at `9a77166^`: `images/feature-rating-image-list.txt`, `images/ISIC-database/metadata.csv` |

**Verdict: the old demo ran a recognisable task and then threw the result away.**
It made pairwise comparisons on three of the six features and, at the end,
displayed "Thank you for participating." and nothing else — no scale, no
ranking, no BTL fit anywhere in the file. For a demo whose purpose is to show
what the task was *and what is done with it*, discarding the model is the whole
miss. It also crashed on load.

---

## The published task `[study]`

A two-alternative forced choice between two lesion photographs on **one visual
feature**, assigned between subjects.

### Six conditions, three features at both polarities

| Condition | Prompt, verbatim | Family | Reverse-scored `[analysis]` |
|---|---|---|---|
| `irregular` | "Which lesion has the more irregular border?" | border | no |
| `regular` | "Which lesion has the more regular border?" | border | **yes** |
| `colourful` | "Which lesion has more colour variation?" | colour | no |
| `uniform` | "Which lesion has the more uniform colour?" | colour | **yes** |
| `asymmetry` | "Which lesion has the more asymmetrical shape?" | shape | no |
| `symmetry` | "Which lesion has the more symmetrical shape?" | shape | **yes** |

Both polarities of each feature is a design feature, not redundancy:
`00_read_data.py` flips `symmetry`, `regular` and `uniform` with `1 - response`
so a higher BTL value always means a more severe-looking lesion. A demo offering
only one polarity per feature silently drops half the design.

Each prompt carries a gloss, e.g. *"Colour variance is the presence of more than
one distinct colour."*

### Structure and timing

| Item | Value |
|---|---|
| Stimuli | 10,000 ISIC images, pair drawn at random per trial |
| Practice | 6 trials on hand-picked high/low exemplar pairs for the assigned family |
| Main | **400 trials**, 8 blocks × 50, 10 s break between blocks |
| Lead-in | Image sources assigned at trial start, **revealed 1500 ms later**; fixation `+` throughout, re-asserted at full size 500 ms before reveal |
| Deadline | Screen timeout 11,500 ms, i.e. **10,000 ms after reveal** |
| Selection hold | 500 ms, chosen image border turns `#d6341a` (red) |
| Response | **Keyboard only**: `z` → left (0), `m` → right (1). Pre-reveal responses are swallowed; first response only |
| Feedback | No accuracy feedback — there is no correct answer. Only "Too Fast!" (RT < 300 ms) or "Too Slow!" (timeout), shown during the **next** trial's lead-in |
| Display | `.display` 256 × 192, 4 px black border, 50 px cue box between |

### Scale, not ratings

The output is a **Bradley–Terry–Luce** scale value per image. `[power]` sizes the
study around the comparison graph being connected: ~40,500 trials per feature,
~102 participants per condition, 306 total, for a 98 % chance of a fully
connected graph over 10,000 images. Realised: 325 participants, 125,360 retained
trials, every image appearing.

### Participants and integrity

Lay observers, not clinicians — no expertise screening exists in the study file,
and no demographics are collected. There are no catch trials; instead per-block
monitors flag `>20 %` fast-or-missed trials and `>75 %`/`<25 %` one-sided
responding, with two cautions routing to a different Prolific completion code.

Analysis exclusions `[analysis]`: timeouts, RT < 300 ms, practice rows, duplicate
block×trial, and result files under 10,000 bytes.

---

## Divergences in the old demo

### Fatal

| # | Aspect | Old demo | `[study]` |
|---|---|---|---|
| 1 | **The model** | **Absent.** No BTL fit, no scale, no ranking; the strings "BTL", "Bradley", "Terry", "Luce" do not occur in the file. The end screen is "Thank you for participating." The accumulated counters are never shown | The BTL scale is the entire output |
| 2 | **Nothing recorded** | Which image was chosen is never stored — responses collapse into left/right counters | `winner` and `loser` filenames per trial |
| 3 | **Three conditions, participant-chosen** | Asymmetry, border irregularity, colour variance, picked from a menu; nothing prevents running the same one three times | Six conditions, one assigned at random per participant |
| 4 | **No lead-in** | Images shown immediately at trial start | 1500 ms fixation lead-in before reveal |
| 5 | **Images stretched** | Fixed 256 × 192 with no `object-fit`, so photographs are distorted — fatal when the judgment *is* shape symmetry and border regularity | Same box, undistorted |

### Material

| # | Aspect | Old demo | `[study]` |
|---|---|---|---|
| 6 | Response device | Mouse click only; no keyboard handler | `z` / `m` keys |
| 7 | Selection colour | Green `rgb(0,184,70)` | Red `#d6341a` |
| 8 | Too fast / too slow | `fastResponseThreshold: 100` declared and never read; no notice shown | 300 ms threshold, notice on the next trial |
| 9 | Pre-reveal responses | No reveal, so not applicable | Swallowed |
| 10 | Trials | 18 (6 × 3) | 400 plus 6 practice |
| 11 | Image pool | 10 | 10,000 |
| 12 | Pairing | Fresh random pair per trial via a biased `sort(() => 0.5 - Math.random())`; no coverage of the 45 possible pairs | Random from 10,000, with a power analysis behind it |
| 13 | Practice | Absent | 6 trials on high/low exemplars |

### It crashed on load

`mel-features.js:285` looked up `exit-experiment-button`, an id that exists
nowhere in the repo, and `:474` called `addEventListener` on the resulting
`null`. That threw out of `setupEventListeners()` before it returned, so the
final `updateDisplay()` never ran. The demo still started, because the earlier
listeners were already bound and the overlay was visible via CSS — which is why
it went unnoticed.

---

## Image licensing

This is the constraint that gates publishing, and it is smaller than it looked.

The study used **10,000** images. Licences resolved from
`git show 9a77166^:images/ISIC-database/metadata.csv`:

| Licence | Count | Servable |
|---|---|---|
| CC-BY-NC | **7,107** | **No — excluded absolutely** |
| CC-0 | 1,466 | yes |
| CC-BY | 1,427 | yes, with attribution |

(The handoff's figures — 9,995 / 7,104 / 1,464 — were slightly off.)

Restricting the 2,893 servable images to dermoscopic ones with a recorded
diagnosis leaves 2,883. The demo ships **48**: 24 melanoma, 24 nevus, 2.33 MB,
chosen deterministically by hashing the ISIC id so the sample does not cluster by
contributor. All are CC-0 or CC-BY. Provenance per image is in
`assets/images/demos/mel-features/manifest.json`.

**Only two attributions are required**, not a generated page: Memorial Sloan
Kettering Cancer Center and "Anonymous", both CC-BY. They are credited in a
details block in the demo itself, alongside the CC-0 contributors, because the
ISIC archive asks for credit as good practice even where CC-0 imposes no
obligation.

`tests/mel-features-demo.cjs` enforces this as a hard gate: every file on disk
and every id referenced in code must be CC-0 or CC-BY per the manifest, and the
embedded licence codes must agree with it.

**The 10 images already in `assets/images/melanoma/` are all CC-0**, so nothing
non-servable was ever in the repo. They are also not published — `build_site.py`'s
`BASE_IMAGES` never included them.

---

## Resolution — rebuilt 2026-10-28

| Item | Status |
|---|---|
| BTL fit | **Fitted in-browser** from the visitor's own comparisons, by the standard MM iteration, with the images ranked by the fitted value |
| Conditions | All six, with the verbatim prompts and glosses; "Random (as in the study)" is the default |
| Reverse scoring | `regular`, `uniform`, `symmetry` flipped, as `00_read_data.py` does |
| Response | `z` / `m` keys (clicking also works, for touch), pre-reveal responses swallowed |
| Timing | 1500 ms lead-in, 500 ms cue step, 10 s deadline, 500 ms selection hold |
| Too fast / too slow | 300 ms threshold, notice in the next trial's lead-in, too-fast trials excluded from the fit |
| Display | 256 × 192, `object-fit: contain`, red `#d6341a` selection |
| Payoff | Ranked lesions, and how often melanoma outranked nevus in the visitor's own scale |
| Session shape | **Not reproduced.** 30–60 comparisons over a 12-image pool; the four differences are listed under the task |

Two deliberate demo-only departures, both stated on the page:

- **Pair selection prefers least-seen pairs** rather than drawing uniformly. Over
  12 images and a few dozen trials, uniform sampling leaves the comparison graph
  disconnected and the scale unidentifiable. The demo also *checks* connectivity
  and says so when it fails, rather than printing numbers that do not mean
  anything.
- **The fit adds half a win and half a loss to every pair actually seen.** Over a
  short session an undefeated image sends the unregularised estimate to infinity.
  The study needs no such crutch at 125,360 comparisons.

Evidence: `tests/mel-features-demo.cjs`, 22 tests, `npm run test:demos`. The BTL
fit is checked against synthetic data generated from known strengths under the
Luce choice rule: unregularised it recovers the true ordering exactly and the
true values to within 0.20 on the log scale; with the demo's 0.5 prior it keeps
the ordering and shrinks the range by about 9 %, which is the regularisation
behaving rather than drifting.

### Not yet done

- **Not published.** Same gate as the other two: `build_site.py`'s allowlist
  excludes `js/demos/`, and publishing also needs
  `assets/images/demos/mel-features/` added to the image copy step — 48 files,
  not a single name in `BASE_IMAGES`.
- `data/projects/melanoma-features/meta.json` `experiment_demo` /
  `interactive_demo` are still empty; fill them in the publishing change.
- `assets/images/melanoma/` (the old 10 CC-0 images) is now unreferenced and can
  be deleted whenever convenient; git holds it.
