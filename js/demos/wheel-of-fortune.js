/*
 * Wheel of Fortune — playable demo of the task from:
 *
 *   Garrett, P. M., Bennett, M. S., Howard, Z. L., Yang, C.-T., Little, D. R.,
 *   & Eidels, A. (2022). Wheel of Fortune: A Cross-cultural Examination of How
 *   Expertise Shapes the Mental Representations of Familiar and Unfamiliar
 *   Numerals. Computational Brain & Behavior, 5(1), 45-59.
 *   https://doi.org/10.1007/s42113-021-00122-1
 *
 * Participants identify a briefly-presented, noise-degraded numeral from one of
 * four sets. The confusions they make are turned into a map of how close those
 * numerals sit in the mind — via Luce's similarity choice model to strip out
 * response bias, then multidimensional scaling.
 *
 * This demo runs a short version and fits the same model to your own answers.
 * Session shape, trial counts and the 4-session within-subject design are not
 * reproduced; see docs/demos/wheel-of-fortune-fidelity.md.
 *
 * Deliberately linear: constants, stimulus drawing, the staircase, the trial
 * sequence, then the model, then the summary.
 */

// ---------------------------------------------------------------------------
// Constants, from the original Python/Pygame experiment
// (records/honours-wheel-of-fortune/ExperimentEnglish/)
// ---------------------------------------------------------------------------

const WF = {
  // Trial sequence timing, in ms.
  blankBeforeFixationMs: 250,
  fixationMs: 500,
  blankAfterFixationMs: 250,
  targetMs: 500,
  maskMs: 200,
  deadlineMs: 8000,
  feedbackMs: 600,
  itiMs: 400,

  canvas: 221, // the study's stimulus tifs are 221x221 px
  background: 128, // mid grey; the glyph is drawn at the signal level

  /*
   * Gaussian pixel noise, sigma scaled by 255 * 0.5.
   *
   * The code and Readme in the corpus both say sigma = 0.25; the published
   * paper reports 0.125. The code is what ran, so 0.25 it is — but the
   * disagreement is recorded in the fidelity doc rather than quietly resolved.
   */
  noiseSigma: 0.25,
  noiseScale: 255 * 0.5,

  // Contrast staircase on the glyph's grey level. 2-up-1-down: two consecutive
  // correct makes it harder, one error makes it easier.
  signalStart: 153,
  signalMin: 128, // equal to the background: invisible
  signalMax: 255, // pure white on mid grey: easy
  calibrationTrials: 15,
  calibrationStep: 3,
  anchorFromLast: 6,
  // Test contrasts, relative to the calibrated anchor. The study used
  // anchor-3 .. anchor+1.
  testOffsets: [-3, -2, -1, 0, 1],

  maskGrid: 40, // the study's masks are a 40x40 random matrix rendered large
  wheelOuter: 150,
  wheelInner: 58,
};

/*
 * Nine items per set. Zero was excluded from the study "due to similarities
 * across numeric-types", which is why every confusion matrix is 9x9.
 */
const SETS = {
  arabic: {
    label: "Arabic",
    familiar: "familiar to most readers",
    glyphs: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
    font: '"Calibri", "Carlito", "Inter", sans-serif',
    kind: "text",
  },
  chinese: {
    label: "Chinese",
    familiar: "familiar only if you read Chinese",
    glyphs: ["一", "二", "三", "四", "五", "六", "七", "八", "九"],
    font: '"DFKai-SB", "Kaiti TC", "AR PL UKai TW", "Noto Serif CJK TC", "Noto Sans CJK TC", serif',
    kind: "text",
  },
  thai: {
    label: "Thai",
    familiar: "unfamiliar to most readers",
    glyphs: ["๑", "๒", "๓", "๔", "๕", "๖", "๗", "๘", "๙"],
    font: '"Noto Sans Thai", "Tlwg Typo", "Garuda", "Calibri", sans-serif',
    kind: "text",
  },
  dots: {
    label: "Dots",
    familiar: "non-symbolic — quantity without a symbol",
    glyphs: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
    kind: "dots",
  },
};

/*
 * Playing-card dot layouts on a 3x3 grid, as the study used. 8 and 9 are
 * "slightly altered to fit" in the original; these follow the same idea.
 * Each entry lists [column, row] cells, 0-2.
 */
const DOT_LAYOUTS = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
  7: [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [2, 2]],
  8: [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
  9: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
};

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

const demoHtml = `
<style>
  .wf-wrap {
    display: flex; flex-direction: column; gap: 0.9rem; align-items: center;
    width: 100%; max-width: 880px; margin: 0 auto; font-family: 'Inter', sans-serif;
  }
  .wf-controls {
    display: flex; flex-wrap: wrap; gap: 0.75rem 1.25rem;
    align-items: flex-end; justify-content: center; width: 100%;
  }
  .wf-field { display: flex; flex-direction: column; gap: 0.25rem; }
  .wf-field label {
    font-size: 0.7rem; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.7;
  }
  .wf-field select {
    font: inherit; font-size: 0.85rem; padding: 0.35rem 0.5rem;
    background: #141414; color: #f4f4f4; border: 1px solid #555;
    border-radius: 3px; min-width: 12rem;
  }
  .wf-start {
    font-family: 'Press Start 2P', cursive; font-size: 0.75rem;
    padding: 0.7rem 1.1rem; cursor: pointer;
    background: #FFD700; color: #1a1a1a; border: none; border-radius: 3px;
  }
  .wf-start:hover { background: #FFA500; }

  .wf-stage {
    position: relative; width: 100%; min-height: 440px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 1.25rem 1rem; gap: 0.6rem;
    background: #808080; border: 1px solid #333; border-radius: 4px; color: #111;
  }
  .wf-status {
    position: absolute; top: 0.6rem; left: 0.9rem; right: 0.9rem;
    display: flex; justify-content: space-between;
    font-size: 0.72rem; letter-spacing: 0.04em; opacity: 0.8;
  }

  .wf-wheel { position: relative; width: 360px; height: 360px; }
  .wf-canvas {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 110px; height: 110px; image-rendering: pixelated;
  }
  .wf-sector {
    position: absolute; width: 54px; height: 54px; transform: translate(-50%, -50%);
    display: flex; align-items: center; justify-content: center;
    font-size: 30px; line-height: 1; cursor: pointer; user-select: none;
    background: #9a9a9a; color: #111; border: 2px solid #6e6e6e; border-radius: 6px;
    visibility: hidden; padding: 0;
  }
  .wf-sector.wf-shown { visibility: visible; }
  .wf-sector:hover { background: #b4b4b4; }
  .wf-sector.wf-correct { border-color: #1f9d3c; background: #bfe8c8; }
  .wf-sector.wf-wrong { border-color: #c0392b; background: #f0c2bc; }
  .wf-sector canvas { width: 40px; height: 40px; display: block; }

  .wf-prompt { font-size: 0.9rem; min-height: 1.3rem; text-align: center; }

  .wf-overlay {
    position: absolute; inset: 0; overflow-y: auto;
    display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
    gap: 0.7rem; padding: 1.4rem; text-align: center;
    background: rgba(24, 24, 28, 0.97); color: #f4f4f4;
  }
  .wf-overlay h3 {
    font-family: 'Press Start 2P', cursive; font-size: 0.9rem; line-height: 1.7;
    margin: 0 0 0.3rem; color: #FFD700;
  }
  .wf-overlay p { margin: 0; max-width: 38rem; font-size: 0.9rem; line-height: 1.5; }
  .wf-warn {
    font-size: 0.82rem; border: 1px solid #a37; border-radius: 3px;
    padding: 0.45rem 0.7rem; max-width: 38rem; background: rgba(170,51,119,0.12);
  }
  .wf-hidden { display: none !important; }

  .wf-matrix { border-collapse: collapse; font-size: 0.7rem; font-variant-numeric: tabular-nums; }
  .wf-matrix th { font-weight: 600; padding: 2px 4px; opacity: 0.8; }
  .wf-matrix td { width: 24px; height: 24px; text-align: center; border: 1px solid #333; }

  .wf-map { position: relative; width: 300px; height: 300px; border: 1px solid #444; }
  .wf-map span {
    position: absolute; transform: translate(-50%, -50%);
    font-size: 17px; line-height: 1;
  }
  .wf-map canvas { position: absolute; transform: translate(-50%, -50%); width: 26px; height: 26px; }

  .wf-stats { font-size: 0.85rem; border-collapse: collapse; }
  .wf-stats td { padding: 0.15rem 0.6rem; }
  .wf-stats td:last-child { text-align: right; font-variant-numeric: tabular-nums; }

  .wf-note { width: 100%; font-size: 0.82rem; line-height: 1.6; opacity: 0.85; }
  .wf-note h4 { font-size: 0.9rem; margin: 0 0 0.3rem; }
  .wf-note ul { margin: 0.2rem 0 0.8rem; padding-left: 1.2rem; }
  .wf-note li { margin-bottom: 0.2rem; }
</style>

<div class="wf-wrap">
  <div class="wf-controls">
    <div class="wf-field">
      <label for="wf-set">Numeral set</label>
      <select id="wf-set">
        <option value="arabic" selected>Arabic — 1 2 3</option>
        <option value="chinese">Chinese — 一 二 三</option>
        <option value="thai">Thai — ๑ ๒ ๓</option>
        <option value="dots">Dots — non-symbolic</option>
      </select>
    </div>
    <div class="wf-field">
      <label for="wf-trials">Test trials</label>
      <select id="wf-trials">
        <option value="45" selected>45</option>
        <option value="72">72</option>
        <option value="90">90</option>
      </select>
    </div>
    <button class="wf-start" id="wf-start">Start</button>
  </div>

  <div class="wf-stage">
    <div class="wf-status"><span id="wf-phase"></span><span id="wf-counter"></span></div>
    <div class="wf-wheel" id="wf-wheel">
      <canvas class="wf-canvas" id="wf-canvas" width="${WF.canvas}" height="${WF.canvas}"></canvas>
    </div>
    <div class="wf-prompt" id="wf-prompt"></div>

    <div class="wf-overlay" id="wf-overlay">
      <h3>WHEEL OF FORTUNE</h3>
      <p>
        A numeral flashes for half a second, buried in noise, then a mask wipes
        it out. You pick which one you saw from the ring of nine.
      </p>
      <p>
        You will get plenty wrong — that is the point. <strong>Which</strong>
        mistakes you make says how close two numerals sit in your head, and
        enough of them draw a map of that mental space.
      </p>
      <p>
        It starts with a short calibration that tunes the contrast to your eyes,
        with feedback. After that the feedback stops.
      </p>
      <p>Pick a set above, then press <strong>Start</strong>.</p>
    </div>
  </div>

  <div class="wf-note">
    <h4>What was measured</h4>
    <p>
      Confusing a $2 price tag for $9 costs more than confusing 2 for 3, and
      which numerals get confused depends on how well you know them. The study
      ran this task over four sets &mdash; Arabic, Chinese, Thai and
      non-symbolic dots &mdash; in English-speaking and Chinese-speaking
      cohorts. Raw confusions are contaminated by response bias, a habit of
      picking some answers more than others, so
      <strong>Luce's similarity choice model</strong> separates bias from
      genuine confusability; multidimensional scaling then turns what is left
      into a map. Arabic, Chinese and Thai numerals came out arranged by
      <em>visual</em> similarity; dots by both visual and <em>numerical</em>
      similarity.
    </p>
    <h4>How this differs from the study</h4>
    <ul>
      <li><strong>Length.</strong> One set, tens of trials. Participants did four 90-minute sessions, one per set: 135 calibration trials then 1,170 test trials, each.</li>
      <li><strong>Response.</strong> Click a sector. The original logged the answer the moment the cursor crossed the inner circle, recording the full mouse path.</li>
      <li><strong>Glyphs.</strong> Rendered live from fonts on your machine. The study used fixed 221&times;221 pixel images, so the exact shapes depend on what you have installed.</li>
      <li><strong>Model fit.</strong> Townsend's closed-form estimator, which is what the study used to <em>initialise</em> its fit before a differential-evolution search over 45 parameters &mdash; too much to ask of a few dozen trials.</li>
      <li><strong>Nothing is recorded.</strong> Everything is computed in your browser and discarded.</li>
    </ul>
    <p>
      The trial timing, the noise and mask construction, the 2-up-1-down
      contrast staircase and the nine-item sets are the study's.
    </p>
  </div>
</div>
`;

// ---------------------------------------------------------------------------
// Stimulus drawing
// ---------------------------------------------------------------------------

function drawGlyph(ctx, set, index, signalLevel) {
  const size = WF.canvas;
  ctx.save();
  ctx.fillStyle = `rgb(${WF.background},${WF.background},${WF.background})`;
  ctx.fillRect(0, 0, size, size);

  const level = Math.round(signalLevel);
  ctx.fillStyle = `rgb(${level},${level},${level})`;

  if (set.kind === "dots") {
    const cells = DOT_LAYOUTS[index + 1];
    const spacing = size * 0.26;
    const radius = size * 0.075;
    for (const [col, row] of cells) {
      ctx.beginPath();
      ctx.arc(
        size / 2 + (col - 1) * spacing,
        size / 2 + (row - 1) * spacing,
        radius,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  } else {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.round(size * 0.62)}px ${set.font}`;
    ctx.fillText(set.glyphs[index], size / 2, size / 2);
  }
  ctx.restore();
}

/*
 * Add i.i.d. Gaussian noise to every pixel. The study used sigma = 0.25 scaled
 * by 255 * 0.5, on a mid-grey background with the glyph at the signal level.
 */
function addNoise(ctx, random = Math.random) {
  const size = WF.canvas;
  const image = ctx.getImageData(0, 0, size, size);
  const data = image.data;
  const sd = WF.noiseSigma * WF.noiseScale;
  for (let i = 0; i < data.length; i += 4) {
    // Box-Muller, one draw per pixel.
    const u1 = Math.max(random(), 1e-12);
    const u2 = random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const value = Math.max(0, Math.min(255, data[i] + z * sd));
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
  ctx.putImageData(image, 0, 0);
}

/* The study's mask: a 40x40 random matrix blown up to the stimulus size. */
function drawMask(ctx, random = Math.random) {
  const size = WF.canvas;
  const cell = size / WF.maskGrid;
  for (let row = 0; row < WF.maskGrid; row++) {
    for (let col = 0; col < WF.maskGrid; col++) {
      const value = Math.round(50 + (random() - 0.5) * 2 * 30);
      const clamped = Math.max(0, Math.min(255, value * 2.2));
      ctx.fillStyle = `rgb(${clamped},${clamped},${clamped})`;
      ctx.fillRect(col * cell, row * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }
}

/*
 * Does this machine actually have a font covering the set's glyphs?
 *
 * The study used fixed bitmap images, so the shapes were guaranteed. Rendering
 * live from fonts means a visitor without a Thai or CJK font sees .notdef
 * boxes, and would be identifying tofu rather than numerals. Detect it by
 * comparing each glyph's advance width against a codepoint nothing defines: if
 * they match, the font is falling back.
 */
function glyphsRenderable(ctx, set) {
  if (set.kind !== "text") return true;
  ctx.save();
  ctx.font = `48px ${set.font}`;
  const missing = ctx.measureText("\u{10FFFD}").width;
  const ok = set.glyphs.every((glyph) => {
    const width = ctx.measureText(glyph).width;
    return width > 0 && Math.abs(width - missing) > 0.01;
  });
  ctx.restore();
  return ok;
}

function drawFixation(ctx) {
  const size = WF.canvas;
  ctx.fillStyle = `rgb(${WF.background},${WF.background},${WF.background})`;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#111";
  ctx.fillRect(size / 2 - 12, size / 2 - 2, 24, 4);
  ctx.fillRect(size / 2 - 2, size / 2 - 12, 4, 24);
}

function drawBlank(ctx) {
  ctx.fillStyle = `rgb(${WF.background},${WF.background},${WF.background})`;
  ctx.fillRect(0, 0, WF.canvas, WF.canvas);
}

// ---------------------------------------------------------------------------
// Luce's similarity choice model, and MDS
// ---------------------------------------------------------------------------

/*
 * Townsend's (1971) closed-form estimator for Luce's (1963) similarity choice
 * model. The model is
 *
 *   P(respond j | show i) = b_j * eta_ij / sum_k b_k * eta_ik
 *
 * with eta symmetric and eta_ii = 1. Townsend's estimate separates the
 * bias-free similarity from the response bias:
 *
 *   eta_ij = sqrt( p_ij * p_ji / (p_ii * p_jj) )
 *
 * This is exactly what f_DE_optim_Luce.m uses to initialise its chains before a
 * differential-evolution search over all 45 parameters. The search needs far
 * more data than a demo session provides, so the demo stops at the estimator
 * and says so.
 *
 * `smoothing` adds a constant to every cell first, because any empty cell makes
 * the ratio undefined and a short session leaves many.
 */
function luceSimilarity(counts, { smoothing = 0.5 } = {}) {
  const n = counts.length;
  const p = [];
  for (let i = 0; i < n; i++) {
    const row = counts[i].map((c) => c + smoothing);
    const total = row.reduce((a, b) => a + b, 0);
    p.push(row.map((c) => c / total));
  }

  const eta = Array.from({ length: n }, () => new Array(n).fill(1));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const value = Math.sqrt((p[i][j] * p[j][i]) / (p[i][i] * p[j][j]));
      const bounded = Math.max(0, Math.min(1, value));
      eta[i][j] = bounded;
      eta[j][i] = bounded;
    }
  }
  return eta;
}

/*
 * Response bias per alternative, from the same estimator: how much a person
 * leans on answer j irrespective of what was shown. Normalised to sum to 1, as
 * the paper does when it reports 44 free parameters rather than 45.
 */
function luceBias(counts, { smoothing = 0.5 } = {}) {
  const n = counts.length;
  const columnTotals = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) columnTotals[j] += counts[i][j] + smoothing;
  }
  const total = columnTotals.reduce((a, b) => a + b, 0);
  return columnTotals.map((c) => c / total);
}

/* Jacobi eigenvalue iteration for a small symmetric matrix. */
function jacobiEigen(matrix, { sweeps = 100 } = {}) {
  const n = matrix.length;
  const a = matrix.map((row) => row.slice());
  let v = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  );

  for (let sweep = 0; sweep < sweeps; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
    }
    if (off < 1e-12) break;

    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-15) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t =
          Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const values = a.map((row, i) => row[i]);
  return { values, vectors: v };
}

/*
 * Classical (Torgerson) multidimensional scaling into two dimensions.
 * Dissimilarity is 1 - eta, so identical items sit on top of each other.
 * The study used non-metric mdscale; classical is the honest simplification
 * for nine points and it is stated on the page.
 */
function classicalMds(eta) {
  const n = eta.length;
  const d2 = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      const d = 1 - eta[i][j];
      return d * d;
    }),
  );

  const rowMean = d2.map((row) => row.reduce((a, b) => a + b, 0) / n);
  const grand = rowMean.reduce((a, b) => a + b, 0) / n;
  const b = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => -0.5 * (d2[i][j] - rowMean[i] - rowMean[j] + grand)),
  );

  const { values, vectors } = jacobiEigen(b);
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((x, y) => y.value - x.value);

  const coords = [];
  for (let i = 0; i < n; i++) {
    const point = [];
    for (let k = 0; k < 2; k++) {
      const { value, index } = order[k];
      point.push(value > 0 ? vectors[i][index] * Math.sqrt(value) : 0);
    }
    coords.push(point);
  }
  return coords;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let els = {};
let timers = [];
let run = null;
const DEFAULTS = { set: "arabic", trials: "45" };

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

function readSet() {
  return SETS[els.set.value] ? els.set.value : DEFAULTS.set;
}

function readTrials() {
  const n = Number(els.trials.value);
  return Number.isInteger(n) && n > 0 ? n : Number(DEFAULTS.trials);
}

// ---------------------------------------------------------------------------
// Wheel
// ---------------------------------------------------------------------------

function buildWheel(setKey) {
  const set = SETS[setKey];
  for (const old of Array.from(els.wheel.querySelectorAll(".wf-sector"))) old.remove();

  // The study shuffled which numeral sat in which sector, per session.
  run.wheelOrder = shuffled(set.glyphs.map((_, i) => i));

  const step = (Math.PI * 2) / 9;
  run.wheelOrder.forEach((stimulusIndex, position) => {
    const angle = -Math.PI / 2 + position * step;
    const node = document.createElement("div");
    node.className = "wf-sector";
    node.dataset.stimulus = String(stimulusIndex);
    node.style.left = `${180 + Math.cos(angle) * WF.wheelOuter}px`;
    node.style.top = `${180 + Math.sin(angle) * WF.wheelOuter}px`;

    if (set.kind === "dots") {
      const mini = document.createElement("canvas");
      mini.width = WF.canvas;
      mini.height = WF.canvas;
      const ctx = mini.getContext("2d");
      drawGlyph(ctx, set, stimulusIndex, 20);
      node.append(mini);
    } else {
      node.textContent = set.glyphs[stimulusIndex];
      node.style.fontFamily = set.font;
    }
    node.addEventListener("click", () => respond(stimulusIndex));
    els.wheel.append(node);
  });
}

function showWheel(visible) {
  for (const node of els.wheel.querySelectorAll(".wf-sector")) {
    node.classList.toggle("wf-shown", visible);
    node.classList.remove("wf-correct", "wf-wrong");
  }
}

// ---------------------------------------------------------------------------
// Trials
// ---------------------------------------------------------------------------

function startRun() {
  clearTimers();
  const setKey = readSet();

  if (!glyphsRenderable(els.ctx, SETS[setKey])) {
    showMissingFont(SETS[setKey]);
    return;
  }

  run = {
    setKey,
    set: SETS[setKey],
    testTrials: readTrials(),
    phase: "calibration",
    index: 0,
    signal: WF.signalStart,
    consecutiveCorrect: 0,
    calibrationLevels: [],
    anchor: null,
    counts: Array.from({ length: 9 }, () => new Array(9).fill(0)),
    records: [],
    trial: null,
  };

  els.overlay.classList.add("wf-hidden");
  els.start.textContent = "Restart";
  buildWheel(setKey);
  nextTrial();
}

function phaseTotal() {
  return run.phase === "calibration" ? WF.calibrationTrials : run.testTrials;
}

function nextTrial() {
  if (run.index >= phaseTotal()) {
    if (run.phase === "calibration") {
      const tail = run.calibrationLevels.slice(-WF.anchorFromLast);
      run.anchor = tail.reduce((a, b) => a + b, 0) / tail.length;
      run.phase = "test";
      run.index = 0;
      showCalibrationOver();
      return;
    }
    showSummary();
    return;
  }

  const stimulus = Math.floor(Math.random() * 9);
  let signal;
  if (run.phase === "calibration") {
    signal = run.signal;
  } else {
    const offset = WF.testOffsets[Math.floor(Math.random() * WF.testOffsets.length)];
    signal = Math.max(WF.signalMin, Math.min(WF.signalMax, run.anchor + offset));
  }

  run.trial = {
    phase: run.phase,
    stimulus,
    signal,
    response: null,
    rt: null,
    endedOn: null,
    shownAt: null,
    closed: false,
  };

  els.phase.textContent =
    run.phase === "calibration" ? "Calibration — feedback on" : "Test — no feedback";
  els.counter.textContent = `${run.index + 1} / ${phaseTotal()}`;
  els.prompt.textContent = "";
  showWheel(false);
  runSequence();
}

function runSequence() {
  const ctx = els.ctx;
  drawBlank(ctx);
  later(() => {
    drawFixation(ctx);
    later(() => {
      drawBlank(ctx);
      later(() => {
        const trial = run.trial;
        drawGlyph(ctx, run.set, trial.stimulus, trial.signal);
        addNoise(ctx);
        later(() => {
          drawMask(ctx);
          later(() => {
            drawBlank(ctx);
            showWheel(true);
            els.prompt.textContent = "Which did you see?";
            trial.shownAt = performance.now();
            later(onDeadline, WF.deadlineMs);
          }, WF.maskMs);
        }, WF.targetMs);
      }, WF.blankAfterFixationMs);
    }, WF.fixationMs);
  }, WF.blankBeforeFixationMs);
}

function onDeadline() {
  if (!run || !run.trial || run.trial.closed) return;
  run.trial.endedOn = "timeout";
  finishTrial();
}

function respond(stimulusIndex) {
  const trial = run && run.trial;
  if (!trial || trial.closed || trial.shownAt === null) return;

  clearTimers();
  trial.response = stimulusIndex;
  trial.rt = performance.now() - trial.shownAt;
  trial.endedOn = "response";
  finishTrial();
}

function finishTrial() {
  const trial = run.trial;
  trial.closed = true;
  const correct = trial.response === trial.stimulus;

  if (trial.phase === "calibration") {
    // 2-up-1-down on the glyph's grey level: harder after two in a row,
    // easier after any error.
    if (trial.endedOn === "response" && correct) {
      run.consecutiveCorrect += 1;
      if (run.consecutiveCorrect >= 2) {
        run.signal = Math.max(WF.signalMin, run.signal - WF.calibrationStep);
        run.consecutiveCorrect = 0;
      }
    } else {
      run.consecutiveCorrect = 0;
      run.signal = Math.min(WF.signalMax, run.signal + WF.calibrationStep);
    }
    run.calibrationLevels.push(run.signal);

    // Feedback in calibration only, as the study does.
    for (const node of els.wheel.querySelectorAll(".wf-sector")) {
      const index = Number(node.dataset.stimulus);
      if (index === trial.stimulus) node.classList.add("wf-correct");
      else if (index === trial.response) node.classList.add("wf-wrong");
    }
    els.prompt.textContent =
      trial.endedOn === "timeout" ? "Too slow" : correct ? "Correct" : "Not that one";
  } else if (trial.endedOn === "response") {
    run.counts[trial.stimulus][trial.response] += 1;
  }

  run.records.push(trial);
  const hold = trial.phase === "calibration" ? WF.feedbackMs : WF.itiMs;
  later(() => {
    showWheel(false);
    els.prompt.textContent = "";
    run.index += 1;
    nextTrial();
  }, hold);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function showMissingFont(set) {
  els.overlay.innerHTML = `
    <h3>NO FONT FOR THIS SET</h3>
    <p>
      Your browser has no font covering the ${set.label} numerals, so they would
      render as empty boxes rather than glyphs. That would make the task
      meaningless rather than hard, so it is not offered here.
    </p>
    <p>
      The study sidestepped this by using fixed images; this demo renders live
      from your installed fonts. Try the <strong>Dots</strong> set, which is
      drawn rather than typeset, or <strong>Arabic</strong>.
    </p>
  `;
  els.overlay.classList.remove("wf-hidden");
}

function showCalibrationOver() {
  clearTimers();
  showWheel(false);
  drawBlank(els.ctx);
  els.overlay.innerHTML = `
    <h3>CALIBRATION DONE</h3>
    <p>
      The contrast is now tuned so you get a useful share of trials wrong — that
      is deliberate, and it is where the information is.
    </p>
    <p>From here there is <strong>no feedback</strong>, as in the study.</p>
    <p>Press <strong>Continue</strong> when ready.</p>
    <button class="wf-start" id="wf-continue">Continue</button>
  `;
  els.overlay.classList.remove("wf-hidden");
  document.getElementById("wf-continue").addEventListener("click", () => {
    els.overlay.classList.add("wf-hidden");
    nextTrial();
  });
}

function renderMatrix(counts, glyphs, kind) {
  const max = Math.max(1, ...counts.flat());
  const label = (i) => (kind === "dots" ? String(i + 1) : glyphs[i]);
  const header = `<tr><th></th>${counts
    .map((_, j) => `<th>${label(j)}</th>`)
    .join("")}</tr>`;
  const rows = counts
    .map((row, i) => {
      const cells = row
        .map((value, j) => {
          const weight = value / max;
          const bg =
            i === j
              ? `rgba(31,157,60,${0.12 + 0.75 * weight})`
              : `rgba(224,99,58,${0.1 + 0.8 * weight})`;
          return `<td style="background:${value ? bg : "transparent"}">${value || ""}</td>`;
        })
        .join("");
      return `<tr><th>${label(i)}</th>${cells}</tr>`;
    })
    .join("");
  return `<table class="wf-matrix"><tbody>${header}${rows}</tbody></table>`;
}

function renderMap(coords, set) {
  const xs = coords.map((c) => c[0]);
  const ys = coords.map((c) => c[1]);
  const spanX = Math.max(...xs) - Math.min(...xs) || 1;
  const spanY = Math.max(...ys) - Math.min(...ys) || 1;
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);

  const items = coords
    .map((point, i) => {
      const left = 30 + ((point[0] - minX) / spanX) * 240;
      const top = 30 + ((point[1] - minY) / spanY) * 240;
      if (set.kind === "dots") {
        return `<canvas class="wf-dotmap" data-index="${i}" style="left:${left}px;top:${top}px"></canvas>`;
      }
      return `<span style="left:${left}px;top:${top}px;font-family:${set.font}">${set.glyphs[i]}</span>`;
    })
    .join("");
  return `<div class="wf-map">${items}</div>`;
}

function showSummary() {
  clearTimers();
  showWheel(false);
  drawBlank(els.ctx);

  const { counts, records, set } = run;
  const test = records.filter((r) => r.phase === "test");
  const answered = test.filter((r) => r.endedOn === "response");
  const correct = answered.filter((r) => r.response === r.stimulus).length;
  const accuracy = answered.length ? correct / answered.length : null;
  const timeouts = test.length - answered.length;
  const rts = answered.map((r) => r.rt);
  const meanRt = rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : null;

  const eta = luceSimilarity(counts);
  const bias = luceBias(counts);
  const coords = classicalMds(eta);

  // How lopsided is the response bias? 1/9 each would be perfectly even.
  const evenness = 1 / 9;

  const stats = [
    ["Test trials answered", `${answered.length} of ${test.length}`],
    ["Correct", accuracy === null ? "–" : `${correct} (${Math.round(accuracy * 100)}%)`],
    ["Mean response time", meanRt === null ? "–" : `${Math.round(meanRt)} ms`],
    ["Calibrated grey level", run.anchor === null ? "–" : Math.round(run.anchor)],
  ];
  if (timeouts > 0) stats.push(["Timed out (8 s)", String(timeouts)]);
  stats.push([
    "Strongest response bias",
    `${(Math.max(...bias) / evenness).toFixed(2)}× even`,
  ]);

  const sparse = answered.length < 36;
  const caution = sparse
    ? `<p class="wf-warn">
         With ${answered.length} answered trials this map is mostly noise — nine
         numerals need far more confusions before the structure is real. The
         study collected 1,170 trials per person per set. Run it longer to see
         it settle.
       </p>`
    : `<p class="wf-warn">
         Even at ${answered.length} trials this is a thin sample: the study used
         1,170 per person per set, and pooled 11 people per cohort. Treat the
         shape as suggestive, not as a result.
       </p>`;

  els.overlay.innerHTML = `
    <h3>YOUR CONFUSIONS</h3>
    <p>${set.label} numerals, ${set.familiar}.</p>
    <p>Rows are what was shown, columns what you picked. The diagonal is correct.</p>
    ${renderMatrix(counts, set.glyphs, set.kind)}
    <p>
      With response bias removed by Luce's model, and the remaining similarities
      laid out in two dimensions &mdash; near means easily confused:
    </p>
    ${renderMap(coords, set)}
    <table class="wf-stats"><tbody>
      ${stats.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}
    </tbody></table>
    ${caution}
    <p>Try a set you cannot read &mdash; the map changes shape when the numerals stop being familiar.</p>
    <p>Change the set above and press <strong>Restart</strong>.</p>
  `;
  els.overlay.classList.remove("wf-hidden");

  // Dot maps need drawing after the markup lands.
  if (set.kind === "dots") {
    for (const node of els.overlay.querySelectorAll(".wf-dotmap")) {
      node.width = WF.canvas;
      node.height = WF.canvas;
      drawGlyph(node.getContext("2d"), set, Number(node.dataset.index), 20);
    }
  }

  els.phase.textContent = "";
  els.counter.textContent = "";
  run = null;
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function boot() {
  const mount = document.getElementById("demo-area");
  if (!mount) {
    console.error("wheel-of-fortune: #demo-area not found");
    return;
  }
  mount.innerHTML = demoHtml;

  els = {
    set: document.getElementById("wf-set"),
    trials: document.getElementById("wf-trials"),
    start: document.getElementById("wf-start"),
    wheel: document.getElementById("wf-wheel"),
    canvas: document.getElementById("wf-canvas"),
    phase: document.getElementById("wf-phase"),
    counter: document.getElementById("wf-counter"),
    prompt: document.getElementById("wf-prompt"),
    overlay: document.getElementById("wf-overlay"),
  };
  els.ctx = els.canvas.getContext("2d");

  els.set.value = DEFAULTS.set;
  els.trials.value = DEFAULTS.trials;

  drawBlank(els.ctx);
  els.start.addEventListener("click", startRun);
}

boot();
