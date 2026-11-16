/*
 * Lesion feature comparison — playable demo of the task from:
 *
 *   Bennett, M. S., Houpt, J. W., Wenger, M. J., Townsend, J. T., & Mark, J.
 *   (2026). Under review, Behavior Research Methods.
 *   Preprint: https://doi.org/10.31234/osf.io/kgeyt_v1   OSF: https://osf.io/ctg9s
 *
 * Participants make forced-choice comparisons between pairs of skin lesion
 * photographs on one visual feature, and a Bradley-Terry-Luce model turns those
 * comparisons into a scale value per image. This demo runs a short version and
 * fits the same model to your own responses at the end.
 *
 * THIS IS NOT A DIAGNOSTIC TOOL. The images are archival research photographs
 * with known biopsy outcomes; nothing here assesses anyone's skin.
 *
 * Image licensing: only CC-0 and CC-BY images from the study's 10,000-image set
 * are served. 7,107 of those are CC-BY-NC and are excluded absolutely.
 * Provenance per image: assets/images/demos/mel-features/manifest.json.
 *
 * Deliberately linear: constants, stimuli, the trial sequence, the BTL fit,
 * then the summary.
 */

// ---------------------------------------------------------------------------
// Constants, from pwc/btl_melanoma.study.json
// ---------------------------------------------------------------------------

const ML = {
  imageRoot: "/assets/images/demos/mel-features/",
  imageW: 256, // .display in the study's style.css
  imageH: 192,

  onsetStimulusMs: 1500, // images are assigned at trial start, revealed 1500ms later
  onsetCueMs: 500, // fixation re-asserted at full size 500ms before reveal
  deadlineMs: 10000, // after reveal; the study's screen timeout is 11500 total
  selectionMs: 500, // how long the chosen image stays highlighted
  fastResponseMs: 300, // below this the study shows "Too Fast!"

  selectedBorder: "#d6341a",

  // Session size. The study ran 400 trials over 8 blocks; a demo cannot, so the
  // pool is cut to keep the comparison graph connected enough to fit.
  poolSize: 12,
  trialsPerBlock: 10,
};

/*
 * The six between-subjects conditions. Each attribute appears at BOTH
 * polarities — that is a design feature, not a redundancy: the analysis
 * reverse-scores `regular`, `uniform` and `symmetry` so that a higher scale
 * value always means a more severe-looking lesion.
 */
const CONDITIONS = {
  irregular: {
    label: "More irregular border",
    prompt: "Which lesion has the more irregular border?",
    gloss: "An irregular border is uneven, or inconsistent.",
    family: "border",
    reversed: false,
  },
  regular: {
    label: "More regular border",
    prompt: "Which lesion has the more regular border?",
    gloss: "A regular border is even, or consistent.",
    family: "border",
    reversed: true,
  },
  colourful: {
    label: "More colour variation",
    prompt: "Which lesion has more colour variation?",
    gloss: "Colour variance is the presence of more than one distinct colour.",
    family: "colour",
    reversed: false,
  },
  uniform: {
    label: "More uniform colour",
    prompt: "Which lesion has the more uniform colour?",
    gloss: "Uniform colour is the presence of a consistent colour.",
    family: "colour",
    reversed: true,
  },
  asymmetry: {
    label: "More asymmetrical shape",
    prompt: "Which lesion has the more asymmetrical shape?",
    gloss:
      "An asymmetrical shape is when the shape of one half does not match the shape of the other half.",
    family: "shape",
    reversed: false,
  },
  symmetry: {
    label: "More symmetrical shape",
    prompt: "Which lesion has the more symmetrical shape?",
    gloss:
      "A symmetrical shape is when the shape of one half matches the shape of the other half.",
    family: "shape",
    reversed: true,
  },
};

/*
 * [ISIC id, malignant, licence] where licence 0 = CC-0, 1 = CC-BY.
 * 24 melanoma and 24 nevus, all dermoscopic, drawn from the study's own
 * 10,000-image list. Generated from manifest.json; keep the two in step.
 */
const LESIONS = [
  ["ISIC_0000274", 0, 0], ["ISIC_0000306", 1, 0], ["ISIC_0000516", 1, 0],
  ["ISIC_0000526", 1, 0], ["ISIC_0000558", 0, 0], ["ISIC_0001743", 0, 0],
  ["ISIC_0001832", 0, 0], ["ISIC_0002184", 0, 0], ["ISIC_0002295", 0, 0],
  ["ISIC_0003046", 0, 0], ["ISIC_0003910", 0, 0], ["ISIC_0004075", 0, 0],
  ["ISIC_0005377", 0, 0], ["ISIC_0007622", 0, 0], ["ISIC_0009488", 0, 0],
  ["ISIC_0009791", 0, 0], ["ISIC_0009931", 0, 0], ["ISIC_0009939", 0, 0],
  ["ISIC_0010251", 1, 0], ["ISIC_0010295", 1, 0], ["ISIC_0010364", 1, 0],
  ["ISIC_0010707", 1, 0], ["ISIC_0010724", 0, 0], ["ISIC_0010818", 0, 0],
  ["ISIC_0010874", 0, 0], ["ISIC_0010958", 0, 0], ["ISIC_0011127", 0, 0],
  ["ISIC_0011697", 1, 0], ["ISIC_0011703", 1, 0], ["ISIC_0011930", 1, 0],
  ["ISIC_0012260", 0, 0], ["ISIC_0013672", 1, 0], ["ISIC_0013778", 0, 0],
  ["ISIC_0014013", 1, 0], ["ISIC_0014766", 1, 0], ["ISIC_0014922", 1, 0],
  ["ISIC_0014925", 0, 0], ["ISIC_0023811", 1, 0], ["ISIC_0046331", 1, 1],
  ["ISIC_0046458", 1, 1], ["ISIC_0046597", 1, 1], ["ISIC_0046647", 1, 1],
  ["ISIC_0046693", 0, 1], ["ISIC_0047008", 1, 1], ["ISIC_1605945", 1, 1],
  ["ISIC_2108849", 1, 1], ["ISIC_2850215", 1, 1], ["ISIC_2916754", 1, 1],
];

const CREDITS = [
  ["Memorial Sloan Kettering Cancer Center", "CC-BY"],
  ["Anonymous", "CC-BY"],
  ["Anonymous", "CC-0"],
];

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

const demoHtml = `
<style>
  .ml-wrap {
    display: flex; flex-direction: column; gap: 0.9rem; align-items: center;
    width: 100%; max-width: 880px; margin: 0 auto; font-family: 'Inter', sans-serif;
  }
  .ml-controls {
    display: flex; flex-wrap: wrap; gap: 0.75rem 1.25rem;
    align-items: flex-end; justify-content: center; width: 100%;
  }
  .ml-field { display: flex; flex-direction: column; gap: 0.25rem; }
  .ml-field label {
    font-size: 0.7rem; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.7;
  }
  .ml-field select {
    font: inherit; font-size: 0.85rem; padding: 0.35rem 0.5rem;
    background: #141414; color: #f4f4f4; border: 1px solid #555;
    border-radius: 3px; min-width: 13rem;
  }
  .ml-start {
    font-family: 'Press Start 2P', cursive; font-size: 0.75rem;
    padding: 0.7rem 1.1rem; cursor: pointer;
    background: #FFD700; color: #1a1a1a; border: none; border-radius: 3px;
  }
  .ml-start:hover { background: #FFA500; }

  .ml-stage {
    position: relative; width: 100%; min-height: 420px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 0.9rem; padding: 1.25rem 1rem;
    background: #101014; border: 1px solid #333; border-radius: 4px; color: #f4f4f4;
  }
  .ml-counter {
    position: absolute; top: 0.6rem; right: 0.9rem;
    font-size: 0.72rem; letter-spacing: 0.04em; opacity: 0.6;
  }
  .ml-pair { display: flex; align-items: center; gap: 50px; }
  .ml-display {
    width: ${ML.imageW}px; height: ${ML.imageH}px;
    border: 4px solid #000; background: #000;
    /* contain, not fill: stretching distorts the very features being judged */
    object-fit: contain;
    visibility: hidden; cursor: pointer;
  }
  .ml-display.ml-shown { visibility: visible; }
  .ml-display.ml-chosen { border-color: ${ML.selectedBorder}; }
  .ml-cue {
    width: 50px; height: 50px; display: flex; align-items: center; justify-content: center;
    font-size: 40px; line-height: 1; flex: 0 0 auto;
  }
  .ml-cue.ml-small { font-size: 26px; }
  .ml-prompt { font-size: 1rem; text-align: center; min-height: 1.4rem; }
  .ml-keys { font-size: 0.85rem; opacity: 0.75; display: flex; gap: 3rem; }
  .ml-keys kbd {
    font-family: ui-monospace, monospace; background: #333; color: #fff;
    border: 1px solid #666; border-radius: 3px; padding: 0.1rem 0.4rem;
  }

  .ml-overlay {
    position: absolute; inset: 0; overflow-y: auto;
    display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
    gap: 0.7rem; padding: 1.5rem; text-align: center;
    background: rgba(16, 16, 20, 0.97);
  }
  .ml-overlay h3 {
    font-family: 'Press Start 2P', cursive; font-size: 0.9rem; line-height: 1.7;
    margin: 0 0 0.3rem; color: #FFD700;
  }
  .ml-overlay p { margin: 0; max-width: 38rem; font-size: 0.9rem; line-height: 1.5; }
  .ml-overlay .ml-gloss { opacity: 0.8; font-style: italic; }
  .ml-warn {
    font-size: 0.8rem; border: 1px solid #a33; border-radius: 3px;
    padding: 0.45rem 0.7rem; max-width: 38rem; background: rgba(170,51,51,0.12);
  }

  .ml-rank { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; max-width: 100%; }
  .ml-rank figure { margin: 0; width: 92px; }
  .ml-rank img {
    width: 92px; height: 69px; object-fit: contain; background: #000;
    border: 2px solid #444; display: block;
  }
  .ml-rank img.ml-mal { border-color: #e0633a; }
  .ml-rank figcaption { font-size: 0.62rem; opacity: 0.75; margin-top: 0.15rem; }
  .ml-legend { font-size: 0.75rem; opacity: 0.75; }

  .ml-stats { font-size: 0.85rem; border-collapse: collapse; }
  .ml-stats td { padding: 0.15rem 0.6rem; }
  .ml-stats td:last-child { text-align: right; font-variant-numeric: tabular-nums; }

  .ml-hidden { display: none !important; }

  .ml-note { width: 100%; font-size: 0.82rem; line-height: 1.6; opacity: 0.85; }
  .ml-note h4 { font-size: 0.9rem; margin: 0 0 0.3rem; }
  .ml-note ul { margin: 0.2rem 0 0.8rem; padding-left: 1.2rem; }
  .ml-note li { margin-bottom: 0.2rem; }
  .ml-note details { margin-top: 0.5rem; }
  .ml-note summary { cursor: pointer; font-weight: 600; }
</style>

<div class="ml-wrap">
  <div class="ml-controls">
    <div class="ml-field">
      <label for="ml-condition">Feature to judge</label>
      <select id="ml-condition">
        <option value="random" selected>Random (as in the study)</option>
        <option value="irregular">More irregular border</option>
        <option value="regular">More regular border</option>
        <option value="colourful">More colour variation</option>
        <option value="uniform">More uniform colour</option>
        <option value="asymmetry">More asymmetrical shape</option>
        <option value="symmetry">More symmetrical shape</option>
      </select>
    </div>
    <div class="ml-field">
      <label for="ml-trials">Comparisons</label>
      <select id="ml-trials">
        <option value="30" selected>30</option>
        <option value="45">45</option>
        <option value="60">60</option>
      </select>
    </div>
    <button class="ml-start" id="ml-start">Start</button>
  </div>

  <div class="ml-stage">
    <span class="ml-counter" id="ml-counter"></span>
    <div class="ml-prompt" id="ml-prompt"></div>
    <div class="ml-pair">
      <img class="ml-display" id="ml-left" alt="Left lesion photograph" />
      <div class="ml-cue" id="ml-cue"></div>
      <img class="ml-display" id="ml-right" alt="Right lesion photograph" />
    </div>
    <div class="ml-keys" id="ml-keys">
      <span>Left — <kbd>Z</kbd></span><span>Right — <kbd>M</kbd></span>
    </div>

    <div class="ml-overlay" id="ml-overlay">
      <h3>LESION COMPARISONS</h3>
      <p>
        You will see two skin lesion photographs side by side and pick the one
        that is <em>more</em> something — more irregular, more colourful, more
        asymmetrical. There is no right answer on any single pair.
      </p>
      <p>
        Do that enough times and the choices can be turned into a
        <strong>scale</strong>: a number per image saying how far along that
        feature it sits. That model is the point of the study, and this demo
        fits it to your own answers at the end.
      </p>
      <p class="ml-warn">
        These are archival research photographs with known biopsy results. This
        is a perception experiment, not a diagnostic tool, and nothing here can
        tell you anything about your own skin.
      </p>
      <p>Pick a feature above, then press <strong>Start</strong>.</p>
    </div>
  </div>

  <div class="ml-note">
    <h4>What was measured</h4>
    <p>
      Clinicians describe lesions with features like border irregularity, colour
      variation and asymmetry, but those words are not measurements. Pairwise
      comparison sidesteps the problem: people are poor at rating a lesion
      "7 out of 10 irregular" and good at saying which of two is more irregular.
      A <strong>Bradley&ndash;Terry&ndash;Luce</strong> model converts many such
      comparisons into one scale value per image, so a vague adjective becomes a
      number that can be checked against other data.
    </p>
    <h4>How this differs from the study</h4>
    <ul>
      <li><strong>Length.</strong> Tens of comparisons over 12 images. Participants did 400 trials across 8 blocks, and the full study pooled 125,360 trials from 325 people to scale all 10,000 images.</li>
      <li><strong>You pick the feature.</strong> Each participant was randomly assigned exactly one of the six, and never saw the others.</li>
      <li><strong>No practice block, and no data-integrity monitoring.</strong> The study ran 6 practice trials on hand-picked easy pairs, and flagged participants responding too fast or favouring one side.</li>
      <li><strong>Nothing is recorded.</strong> Your results are computed in your browser, shown to you, and discarded.</li>
    </ul>
    <p>
      The question wording, the glosses, the Z/M keys, the 1.5-second lead-in,
      the 10-second deadline and the too-fast threshold are the study's.
    </p>
    <details>
      <summary>Image credits and licensing</summary>
      <p style="margin-top:0.5rem">
        Photographs from the <a href="https://api.isic-archive.com" rel="noopener">ISIC Archive</a>,
        selected from the 10,000 images used by the study. Only CC-0 and CC-BY
        images are served here; the 7,107 CC-BY-NC images in that set are
        excluded. Per-image provenance is in
        <code>assets/images/demos/mel-features/manifest.json</code>.
      </p>
      <ul id="ml-credits"></ul>
    </details>
  </div>
</div>
`;

// ---------------------------------------------------------------------------
// Bradley-Terry-Luce
// ---------------------------------------------------------------------------

/*
 * Fit BTL strengths by the standard MM (minorise-maximise) iteration:
 *
 *   p_i  <-  w_i / sum_j ( n_ij / (p_i + p_j) )
 *
 * where w_i is i's wins and n_ij the number of comparisons between i and j.
 *
 * A short session leaves a sparse comparison graph, and any item that wins
 * everything or nothing sends the estimate to infinity. `prior` adds half a win
 * and half a loss against every opponent actually met, which keeps every
 * estimate finite. That is a regularisation the study does not need and does
 * not use — it has 125,360 trials — so the demo says so on screen.
 */
function fitBtl(nItems, comparisons, { prior = 0.5, iterations = 300 } = {}) {
  const wins = new Float64Array(nItems);
  const pairCount = [];
  for (let i = 0; i < nItems; i++) pairCount.push(new Float64Array(nItems));

  for (const { winner, loser } of comparisons) {
    wins[winner] += 1;
    pairCount[winner][loser] += 1;
    pairCount[loser][winner] += 1;
  }

  // Regularise: half a win each way on every pair that was actually compared.
  for (let i = 0; i < nItems; i++) {
    for (let j = 0; j < nItems; j++) {
      if (i !== j && pairCount[i][j] > 0) {
        wins[i] += prior;
        pairCount[i][j] += 2 * prior;
      }
    }
  }

  let p = new Float64Array(nItems).fill(1);
  for (let step = 0; step < iterations; step++) {
    const next = new Float64Array(nItems);
    for (let i = 0; i < nItems; i++) {
      let denom = 0;
      for (let j = 0; j < nItems; j++) {
        if (i === j || pairCount[i][j] === 0) continue;
        denom += pairCount[i][j] / (p[i] + p[j]);
      }
      next[i] = denom > 0 ? wins[i] / denom : p[i];
    }
    // Normalise to a geometric mean of 1 so the scale is identified.
    let logSum = 0;
    let counted = 0;
    for (let i = 0; i < nItems; i++) {
      if (next[i] > 0) {
        logSum += Math.log(next[i]);
        counted += 1;
      }
    }
    const scale = counted > 0 ? Math.exp(logSum / counted) : 1;
    for (let i = 0; i < nItems; i++) next[i] = next[i] / scale || 0;
    p = next;
  }

  // Report on the log scale, which is what the model is linear in.
  return Array.from(p, (v) => (v > 0 ? Math.log(v) : 0));
}

/*
 * Is every item reachable from every other through the comparisons actually
 * made? If not, the scale is only identified within each connected piece, and
 * comparing across pieces is meaningless.
 */
function graphIsConnected(nItems, comparisons) {
  if (nItems === 0) return true;
  const adjacency = Array.from({ length: nItems }, () => []);
  for (const { winner, loser } of comparisons) {
    adjacency[winner].push(loser);
    adjacency[loser].push(winner);
  }
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length > 0) {
    const node = stack.pop();
    for (const next of adjacency[node]) {
      if (!seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return seen.size === nItems;
}

/*
 * Rank-biserial style summary: of all melanoma/nevus pairs, how often did the
 * melanoma end up with the higher scale value? 0.5 is chance. This is the
 * study's own framing question -- do lay judgments of a single visual feature
 * track the biopsy -- not a diagnostic claim.
 */
function agreementWithBiopsy(scores, malignant) {
  let hits = 0;
  let ties = 0;
  let total = 0;
  for (let i = 0; i < scores.length; i++) {
    for (let j = 0; j < scores.length; j++) {
      if (!malignant[i] || malignant[j]) continue;
      total += 1;
      if (scores[i] > scores[j]) hits += 1;
      else if (scores[i] === scores[j]) ties += 1;
    }
  }
  return total === 0 ? null : (hits + 0.5 * ties) / total;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let els = {};
let timers = [];
let run = null;

const DEFAULTS = { condition: "random", trials: "30" };

function clearTimers() {
  for (const t of timers) clearTimeout(t);
  timers = [];
}

function later(fn, ms) {
  const t = setTimeout(fn, ms);
  timers.push(t);
  return t;
}

function shuffled(array) {
  const out = array.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function readCondition() {
  const raw = els.condition.value;
  if (raw === "random") {
    const keys = Object.keys(CONDITIONS);
    return keys[Math.floor(Math.random() * keys.length)];
  }
  return CONDITIONS[raw] ? raw : DEFAULTS.condition === "random" ? "irregular" : DEFAULTS.condition;
}

function readTrials() {
  const n = Number(els.trials.value);
  return Number.isInteger(n) && n > 0 ? n : Number(DEFAULTS.trials);
}

// ---------------------------------------------------------------------------
// Trials
// ---------------------------------------------------------------------------

function startRun() {
  clearTimers();
  const condition = readCondition();
  const pool = shuffled(LESIONS).slice(0, ML.poolSize);

  run = {
    condition,
    pool,
    totalTrials: readTrials(),
    index: 0,
    comparisons: [],
    records: [],
    trial: null,
    pendingFeedback: "", // "Too Fast!" / "Too Slow!", shown on the NEXT trial
  };

  els.overlay.classList.add("ml-hidden");
  els.start.textContent = "Restart";
  els.prompt.textContent = CONDITIONS[condition].prompt;
  nextTrial();
}

/*
 * Pick a pair. The study draws uniformly at random from 10,000 images; over 12
 * images and a few dozen trials that leaves holes, so pairs least-seen so far
 * are preferred. This is a demo-only change and it is what makes the scale
 * fittable in one short session.
 */
function pickPair() {
  const n = run.pool.length;
  const seen = run.pairSeen || (run.pairSeen = new Map());
  const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

  let best = null;
  let bestCount = Infinity;
  const candidates = shuffled(
    Array.from({ length: n }, (_, i) => i).flatMap((i) =>
      Array.from({ length: n }, (_, j) => j)
        .filter((j) => j > i)
        .map((j) => [i, j]),
    ),
  );
  for (const [i, j] of candidates) {
    const count = seen.get(key(i, j)) || 0;
    if (count < bestCount) {
      bestCount = count;
      best = [i, j];
      if (count === 0) break;
    }
  }
  seen.set(key(best[0], best[1]), bestCount + 1);
  return Math.random() < 0.5 ? best : [best[1], best[0]];
}

function nextTrial() {
  if (run.index >= run.totalTrials) {
    showSummary();
    return;
  }

  const [left, right] = pickPair();
  run.trial = {
    trialNo: run.index + 1,
    left,
    right,
    response: null,
    rt: null,
    endedOn: null,
    revealedAt: null,
    closed: false,
  };

  els.counter.textContent = `Trial ${run.index + 1} / ${run.totalTrials}`;
  els.left.classList.remove("ml-shown", "ml-chosen");
  els.right.classList.remove("ml-shown", "ml-chosen");

  // Sources are assigned now and revealed later, so the browser has time to
  // decode them — the study does exactly this with its 1500ms lead-in.
  els.left.src = ML.imageRoot + run.pool[left][0] + ".jpg";
  els.right.src = ML.imageRoot + run.pool[right][0] + ".jpg";

  // The too-fast / too-slow notice from the previous trial shows here, in the
  // lead-in, which is where the study puts it.
  els.cue.textContent = run.pendingFeedback || "+";
  els.cue.classList.toggle("ml-small", Boolean(run.pendingFeedback));
  run.pendingFeedback = "";

  later(() => {
    els.cue.textContent = "+";
    els.cue.classList.remove("ml-small");
  }, ML.onsetStimulusMs - ML.onsetCueMs);

  later(revealPair, ML.onsetStimulusMs);
}

function revealPair() {
  els.left.classList.add("ml-shown");
  els.right.classList.add("ml-shown");
  run.trial.revealedAt = performance.now();
  later(onDeadline, ML.deadlineMs);
}

function onDeadline() {
  if (!run || !run.trial || run.trial.closed) return;
  run.trial.endedOn = "timeout";
  run.pendingFeedback = "Too Slow!";
  finishTrial();
}

/* side: 0 = left, 1 = right — matching the study's z -> 0, m -> 1. */
function respond(side) {
  const trial = run && run.trial;
  if (!trial || trial.closed || trial.revealedAt === null) return;

  clearTimers();
  trial.response = side;
  trial.rt = performance.now() - trial.revealedAt;
  trial.endedOn = "response";

  const chosen = side === 0 ? els.left : els.right;
  chosen.classList.add("ml-chosen");

  if (trial.rt < ML.fastResponseMs) {
    run.pendingFeedback = "Too Fast!";
  } else {
    const winner = side === 0 ? trial.left : trial.right;
    const loser = side === 0 ? trial.right : trial.left;
    run.comparisons.push({ winner, loser });
  }
  finishTrial();
}

function finishTrial() {
  const trial = run.trial;
  trial.closed = true;
  run.records.push(trial);
  later(() => {
    run.index += 1;
    nextTrial();
  }, ML.selectionMs);
}

function onKeyDown(event) {
  if (!run) return;
  const key = event.key.toLowerCase();
  if (key === "z") {
    respond(0);
    event.preventDefault();
  } else if (key === "m") {
    respond(1);
    event.preventDefault();
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function showSummary() {
  clearTimers();
  const { condition, pool, comparisons, records } = run;
  const meta = CONDITIONS[condition];
  const nItems = pool.length;

  const scoresRaw = fitBtl(nItems, comparisons);
  // Reverse-score the "less severe" polarities so a higher value always means
  // a more severe-looking lesion, as the analysis script does.
  const scores = meta.reversed ? scoresRaw.map((v) => -v) : scoresRaw;

  const malignant = pool.map((p) => p[1] === 1);
  const connected = graphIsConnected(nItems, comparisons);
  const agreement = connected ? agreementWithBiopsy(scores, malignant) : null;

  const order = scores
    .map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value);

  const timeouts = records.filter((r) => r.endedOn === "timeout").length;
  const tooFast = records.filter(
    (r) => r.endedOn === "response" && r.rt < ML.fastResponseMs,
  ).length;
  const used = comparisons.length;
  const rts = records
    .filter((r) => r.endedOn === "response" && r.rt >= ML.fastResponseMs)
    .map((r) => r.rt);
  const meanRt = rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : null;

  const figures = order
    .map(({ value, index }, rank) => {
      const [id, mal] = pool[index];
      return `<figure>
        <img class="${mal ? "ml-mal" : ""}" src="${ML.imageRoot}${id}.jpg" alt="Lesion ranked ${rank + 1}" />
        <figcaption>${value >= 0 ? "+" : ""}${value.toFixed(2)}</figcaption>
      </figure>`;
    })
    .join("");

  const stats = [
    ["Comparisons used", `${used} of ${records.length}`],
    ["Mean response time", meanRt === null ? "–" : `${Math.round(meanRt)} ms`],
  ];
  if (tooFast > 0) stats.push([`Discarded as too fast (&lt;${ML.fastResponseMs} ms)`, String(tooFast)]);
  if (timeouts > 0) stats.push(["Timed out (10 s)", String(timeouts)]);
  if (agreement !== null) {
    stats.push([
      "Melanoma ranked above nevus",
      `${Math.round(agreement * 100)}% of pairs`,
    ]);
  }

  let verdict;
  if (!connected) {
    verdict = `<p class="ml-warn">
      Your comparisons did not link all 12 images into one network, so these
      values cannot be placed on a single scale. More comparisons would fix it —
      this is the same connectivity requirement the study's power analysis is
      built around.
    </p>`;
  } else if (agreement === null) {
    verdict = "";
  } else if (agreement >= 0.65) {
    verdict = `<p>Your ranking on <em>${meta.label.toLowerCase()}</em> alone put melanomas above nevi
      ${Math.round(agreement * 100)}% of the time — one visual feature, judged by eye, carrying real signal about the biopsy.</p>`;
  } else if (agreement >= 0.5) {
    verdict = `<p>Your ranking tracked the biopsy weakly (${Math.round(agreement * 100)}%, chance is 50%).
      That is an ordinary result: a single feature is not a diagnosis, which is why the study scales several.</p>`;
  } else {
    verdict = `<p>Your ranking ran against the biopsy here (${Math.round(agreement * 100)}%, chance is 50%).
      With this few comparisons that is well within noise.</p>`;
  }

  els.overlay.innerHTML = `
    <h3>YOUR SCALE</h3>
    <p>${meta.label} &mdash; ${records.length} comparisons over ${nItems} lesions.</p>
    <p class="ml-gloss">${meta.gloss}</p>
    <p>Most to least, by the fitted Bradley&ndash;Terry&ndash;Luce value:</p>
    <div class="ml-rank">${figures}</div>
    <p class="ml-legend">Orange border = melanoma on biopsy. Numbers are log scale values, centred on zero.</p>
    <table class="ml-stats"><tbody>
      ${stats.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}
    </tbody></table>
    ${verdict}
    <p class="ml-legend">
      Fitted with half a win and half a loss added to every pair you actually saw,
      which keeps the estimate finite over a short session. The study needs no
      such crutch: it pooled 125,360 comparisons.
    </p>
    <p>Change the feature above and press <strong>Restart</strong>.</p>
  `;
  els.overlay.classList.remove("ml-hidden");
  els.counter.textContent = "";
  els.prompt.textContent = "";
  els.left.classList.remove("ml-shown", "ml-chosen");
  els.right.classList.remove("ml-shown", "ml-chosen");
  els.cue.textContent = "";
  run = null;
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function boot() {
  const mount = document.getElementById("demo-area");
  if (!mount) {
    console.error("mel-features: #demo-area not found");
    return;
  }
  mount.innerHTML = demoHtml;

  els = {
    condition: document.getElementById("ml-condition"),
    trials: document.getElementById("ml-trials"),
    start: document.getElementById("ml-start"),
    counter: document.getElementById("ml-counter"),
    prompt: document.getElementById("ml-prompt"),
    left: document.getElementById("ml-left"),
    right: document.getElementById("ml-right"),
    cue: document.getElementById("ml-cue"),
    overlay: document.getElementById("ml-overlay"),
    credits: document.getElementById("ml-credits"),
  };

  els.condition.value = DEFAULTS.condition;
  els.trials.value = DEFAULTS.trials;

  els.credits.innerHTML = CREDITS.map(
    ([who, licence]) => `<li>${who} &mdash; ${licence}</li>`,
  ).join("");

  els.start.addEventListener("click", startRun);
  els.left.addEventListener("click", () => respond(0));
  els.right.addEventListener("click", () => respond(1));
  document.addEventListener("keydown", onKeyDown);
}

boot();
