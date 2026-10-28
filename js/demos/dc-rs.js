/*
 * Choice task vs rating scale — playable demo of the task from:
 *
 *   Gronau, Q. F., Bennett, M. S., Brown, S. D., Hawkins, G. E., & Eidels, A.
 *   (2023). Do choice tasks and rating scales elicit the same judgments?
 *   Journal of Choice Modelling, 49, 100437.
 *   https://doi.org/10.1016/j.jocm.2023.100437
 *
 * This is a SHORT version of the perceptual experiment, not the full study.
 * Stimuli, timing, the response modes and the no-feedback rule are the
 * published ones; the session shape is not. See the note rendered under the
 * task, and docs/demos/dc-rs-fidelity.md for every constant's source.
 *
 * The paper's terms are CT (choice task) and RS (rating scale). It is
 * deliberately NOT called a discrete choice experiment: the authors note their
 * CT "differed in a few important ways" from a DCE in order to have a known
 * objectively correct response.
 *
 * Deliberately linear: constants, then stimulus drawing, then the trial
 * sequence, then scoring, then the summary.
 */

// ---------------------------------------------------------------------------
// Constants, all from the lab.js study
// (dc_rs/perceptualChoice/experiment/darkestsquarescombinedrsdce-...study.json)
// ---------------------------------------------------------------------------

const CR = {
  canvasSize: 200, // px, both dimensions
  nSquares: 3,

  // Proportion of pixels filled black. This is the v2 set actually run;
  // readAll.m:29-30 records v1 (0.45 .. 0.55) as superseded. v2 halves every
  // step, so the hardest discrimination is 0.0125 rather than 0.025.
  proportions: [0.475, 0.4875, 0.5, 0.5125, 0.525],

  fixationMs: 200,
  blankBeforeMs: 0,
  deadlineMs: 7000, // stimulus timeout; lab.js records ended_on: 'timeout'
  blankAfterMs: 700,
  feedbackMs: 500, // post-response hold, non-practice
  practiceFeedbackMs: 2000,

  // Analysis exclusion from readAll.m: responses faster than this are dropped.
  minValidRtMs: 200,

  fixationColour: "#fcbb0a",
  fixationRadius: 20.475,
  feedbackColour: "lightblue",
  markerColour: "#ff69b4",

  practiceTrials: 4,
};

// Practice uses only the widest separation, as the study's "easy" practice loop
// does (proportion indices 1/3/5, i.e. the extremes and the midpoint).
const EASY_INDICES = [0, 2, 4];

const MODES = {
  ct: {
    label: "Choice task (CT)",
    // The study's trial screen carries no prompt; the task is set by the
    // instructions. Kept here because a demo visitor has not read them.
    instruction: "Click on the darkest square.",
  },
  rs: {
    label: "Rating scale (RS)",
    instruction:
      "An arrow marks one square. Rate how confident you are that it is the darkest.",
  },
};

// Verbatim from the study's rating scale. Note the asymmetry — it is a
// confidence scale, not a bipolar agree/disagree scale.
const RS_LEFT_LABEL = "Certainly NOT the darkest";
const RS_RIGHT_LABEL = "Extremely confident this is the darkest";

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

const demoHtml = `
<style>
  .cr-wrap {
    display: flex; flex-direction: column; gap: 0.9rem; align-items: center;
    width: 100%; max-width: 860px; margin: 0 auto;
    font-family: 'Inter', sans-serif;
  }
  .cr-controls {
    display: flex; flex-wrap: wrap; gap: 0.75rem 1.25rem;
    align-items: flex-end; justify-content: center; width: 100%;
  }
  .cr-field { display: flex; flex-direction: column; gap: 0.25rem; }
  .cr-field label {
    font-size: 0.7rem; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.7;
  }
  .cr-field select {
    font: inherit; font-size: 0.85rem; padding: 0.35rem 0.5rem;
    background: #141414; color: #f4f4f4; border: 1px solid #555; border-radius: 3px;
    min-width: 11rem;
  }
  .cr-check { flex-direction: row; align-items: center; gap: 0.4rem; }
  .cr-check label { text-transform: none; letter-spacing: 0; font-size: 0.8rem; opacity: 1; }
  .cr-start {
    font-family: 'Press Start 2P', cursive; font-size: 0.75rem;
    padding: 0.7rem 1.1rem; cursor: pointer;
    background: #FFD700; color: #1a1a1a; border: none; border-radius: 3px;
  }
  .cr-start:hover { background: #FFA500; }

  .cr-stage {
    position: relative; width: 100%; min-height: 430px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 1rem; padding: 1.25rem 1rem;
    background: #fffacd; border: 1px solid #4682B4; border-radius: 4px;
    color: #1a1a1a;
  }
  .cr-prompt { font-size: 0.95rem; min-height: 1.4rem; text-align: center; }
  .cr-counter {
    position: absolute; top: 0.6rem; right: 0.9rem;
    font-size: 0.72rem; letter-spacing: 0.04em; opacity: 0.65;
  }
  .cr-phase {
    position: absolute; top: 0.6rem; left: 0.9rem;
    font-size: 0.72rem; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.65;
  }

  .cr-row { display: flex; gap: 50px; justify-content: center; align-items: flex-start; }
  .cr-cell { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .cr-feedback {
    height: 22px; font-size: 0.8rem; font-weight: 600;
    color: #1a1a1a; visibility: hidden;
    background: ${CR.feedbackColour}; padding: 0 0.5rem; border-radius: 2px;
  }
  .cr-feedback.cr-shown { visibility: visible; }
  .cr-canvas {
    width: 200px; height: 200px; display: block;
    image-rendering: pixelated; image-rendering: -moz-crisp-edges;
    border: 1px solid #999;
  }
  .cr-clickable .cr-canvas { cursor: pointer; }
  .cr-marker {
    width: 0; height: 0; visibility: hidden;
    border-left: 14px solid transparent; border-right: 14px solid transparent;
    border-bottom: 18px solid ${CR.markerColour};
  }
  .cr-marker.cr-shown { visibility: visible; }

  .cr-scale { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; justify-content: center; }
  .cr-scale-label { font-size: 0.78rem; max-width: 9rem; text-align: center; opacity: 0.85; }
  .cr-points { display: flex; gap: 0.4rem; }
  .cr-point {
    width: 44px; height: 44px; font: inherit; font-size: 0.95rem; cursor: pointer;
    background: #fff; color: #1a1a1a; border: 1px solid #4682B4; border-radius: 3px;
  }
  .cr-point:hover { background: #eee; }
  .cr-point.cr-selected { background: #7b68ee; color: #fff; border-color: #7b68ee; }

  .cr-fixation { font-size: 0; }
  .cr-fixation-dot {
    width: ${CR.fixationRadius * 2}px; height: ${CR.fixationRadius * 2}px;
    border-radius: 50%; background: ${CR.fixationColour}; border: 1px solid #fff;
  }

  .cr-overlay {
    position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 0.7rem; padding: 1.5rem;
    background: rgba(255, 250, 205, 0.97); text-align: center;
  }
  .cr-overlay h3 {
    font-family: 'Press Start 2P', cursive; font-size: 0.9rem; line-height: 1.7;
    margin: 0 0 0.3rem; color: #4682B4;
  }
  .cr-overlay p { margin: 0; max-width: 36rem; font-size: 0.9rem; line-height: 1.5; }
  .cr-overlay table { font-size: 0.85rem; border-collapse: collapse; margin: 0.3rem 0; }
  .cr-overlay td { padding: 0.15rem 0.6rem; }
  .cr-overlay td:last-child { font-variant-numeric: tabular-nums; text-align: right; }
  .cr-hidden { display: none !important; }

  .cr-note { width: 100%; font-size: 0.82rem; line-height: 1.6; opacity: 0.85; }
  .cr-note h4 { font-size: 0.9rem; margin: 0 0 0.3rem; }
  .cr-note ul { margin: 0.2rem 0 0.8rem; padding-left: 1.2rem; }
  .cr-note li { margin-bottom: 0.2rem; }
</style>

<div class="cr-wrap">
  <div class="cr-controls">
    <div class="cr-field">
      <label for="cr-mode">Response mode</label>
      <select id="cr-mode">
        <option value="ct" selected>Choice task (CT)</option>
        <option value="rs">Rating scale (RS)</option>
      </select>
    </div>
    <div class="cr-field">
      <label for="cr-trials">Test trials</label>
      <select id="cr-trials">
        <option value="12" selected>12</option>
        <option value="24">24</option>
        <option value="40">40</option>
      </select>
    </div>
    <div class="cr-field cr-check">
      <input type="checkbox" id="cr-practice" checked />
      <label for="cr-practice">Practice first (with feedback)</label>
    </div>
    <button class="cr-start" id="cr-start">Start</button>
  </div>

  <div class="cr-stage">
    <span class="cr-phase" id="cr-phase"></span>
    <span class="cr-counter" id="cr-counter"></span>
    <div class="cr-prompt" id="cr-prompt"></div>
    <div class="cr-row" id="cr-row"></div>
    <div class="cr-scale cr-hidden" id="cr-scale">
      <span class="cr-scale-label">${RS_LEFT_LABEL}</span>
      <div class="cr-points" id="cr-points"></div>
      <span class="cr-scale-label">${RS_RIGHT_LABEL}</span>
    </div>

    <div class="cr-overlay" id="cr-overlay">
      <h3>DARKEST SQUARE</h3>
      <p>
        Three squares are filled with random black pixels. One has slightly more
        than the others, and your job is to say which.
      </p>
      <p>
        The study asked the same people to do this two ways — by
        <strong>choosing</strong> the darkest square, and by <strong>rating</strong>
        their confidence that a marked square was the darkest — to test whether
        the two methods read the same underlying judgment.
      </p>
      <p>Pick a mode above, then press <strong>Start</strong>.</p>
    </div>
  </div>

  <div class="cr-note">
    <h4>What was measured</h4>
    <p>
      Because one square really does have the most black pixels, there is a
      correct answer — unusual for preference tasks, and the reason this task was
      built. Modelling both response modes together, the study found that a
      <strong>single internal representation</strong> supports choices and
      ratings alike, and that the <strong>choice task measured that internal
      state more sensitively</strong> than the rating scale did.
    </p>
    <h4>How this differs from the study</h4>
    <ul>
      <li><strong>Length.</strong> A handful of trials in one mode. Participants did 120 trials in <em>each</em> mode, in 6 blocks of 20 with forced breaks, plus staged practice.</li>
      <li><strong>Order.</strong> You pick the mode. Each participant got both, in an order decided by a coin flip.</li>
      <li><strong>Nothing is recorded.</strong> Your results are shown to you at the end and then discarded. Nothing is stored or sent anywhere.</li>
      <li><strong>One domain.</strong> A hypothetical-vaccine version of the same comparison was also run; it is not reproduced here.</li>
    </ul>
    <p>
      The stimulus construction, the five fill proportions, the 7-second
      deadline, the 7-point confidence scale and its wording, and the rule that
      <em>no feedback is given outside practice</em> are the published ones.
    </p>
  </div>
</div>
`;

// ---------------------------------------------------------------------------
// Stimulus
// ---------------------------------------------------------------------------

/*
 * Fill a canvas with `prop` of its pixels black, uniformly at random without
 * replacement. The study did this with a rejection loop over random indices;
 * a partial Fisher-Yates draws the same distribution without the collision
 * cost, which matters at 40,000 pixels x 3 squares x a trial every few seconds.
 */
function fillCanvas(canvas, prop) {
  const size = CR.canvasSize;
  const total = size * size;
  const nFilled = parseInt(prop * total, 10);

  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);
  const data = image.data;
  data.fill(255); // white, fully opaque

  const indices = new Int32Array(total);
  for (let i = 0; i < total; i++) indices[i] = i;
  for (let i = 0; i < nFilled; i++) {
    const j = i + Math.floor(Math.random() * (total - i));
    const tmp = indices[i];
    indices[i] = indices[j];
    indices[j] = tmp;

    const px = indices[i] * 4;
    data[px] = 0;
    data[px + 1] = 0;
    data[px + 2] = 0;
  }
  ctx.putImageData(image, 0, 0);
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

/*
 * Pick three distinct proportion indices for one trial. Practice uses only the
 * widely-separated ones; test trials use any three distinct levels, which is
 * what makes the hardest pairs 0.0125 apart.
 */
function pickIndices(isPractice) {
  const pool = isPractice ? EASY_INDICES : [0, 1, 2, 3, 4];
  return shuffled(pool).slice(0, CR.nSquares);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let els = {};
let timers = [];
let run = null;

const DEFAULTS = { mode: "ct", trials: "12" };

function clearTimers() {
  for (const t of timers) clearTimeout(t);
  timers = [];
}

function later(fn, ms) {
  const t = setTimeout(fn, ms);
  timers.push(t);
  return t;
}

function readMode() {
  return MODES[els.mode.value] ? els.mode.value : DEFAULTS.mode;
}

function readTrials() {
  const n = Number(els.trials.value);
  return Number.isInteger(n) && n > 0 ? n : Number(DEFAULTS.trials);
}

// ---------------------------------------------------------------------------
// Trial sequence: fixation -> blank -> stimulus (deadline) -> blank -> next
// ---------------------------------------------------------------------------

function startRun() {
  clearTimers();
  const usePractice = els.practice.checked;
  run = {
    mode: readMode(),
    testTrials: readTrials(),
    practiceTrials: usePractice ? CR.practiceTrials : 0,
    phase: usePractice ? "practice" : "test",
    index: 0,
    records: [],
    trial: null,
  };
  els.overlay.classList.add("cr-hidden");
  els.start.textContent = "Restart";
  nextTrial();
}

function phaseTotal() {
  return run.phase === "practice" ? run.practiceTrials : run.testTrials;
}

function nextTrial() {
  if (run.index >= phaseTotal()) {
    if (run.phase === "practice") {
      run.phase = "test";
      run.index = 0;
      showPracticeOver();
      return;
    }
    showSummary();
    return;
  }

  const isPractice = run.phase === "practice";
  const indices = pickIndices(isPractice);
  const props = indices.map((i) => CR.proportions[i]);

  let darkest = 0;
  for (let i = 1; i < props.length; i++) if (props[i] > props[darkest]) darkest = i;

  run.trial = {
    phase: run.phase,
    mode: run.mode,
    trialNo: run.index + 1,
    indices,
    props,
    darkest,
    // RS marks one square at random, before the response.
    which: run.mode === "rs" ? Math.floor(Math.random() * CR.nSquares) : null,
    response: null,
    rt: null,
    endedOn: null,
    shownAt: null,
    closed: false,
  };

  els.phase.textContent = isPractice ? "Practice — feedback on" : "Test — no feedback";
  els.counter.textContent = `Trial ${run.index + 1} / ${phaseTotal()}`;
  showFixation();
}

function showFixation() {
  els.prompt.textContent = "";
  els.scale.classList.add("cr-hidden");
  els.row.innerHTML = '<div class="cr-fixation"><div class="cr-fixation-dot"></div></div>';
  later(() => {
    els.row.innerHTML = "";
    later(showStimulus, CR.blankBeforeMs);
  }, CR.fixationMs);
}

function showStimulus() {
  const trial = run.trial;
  els.row.innerHTML = "";

  for (let i = 0; i < CR.nSquares; i++) {
    const cell = document.createElement("div");
    cell.className = "cr-cell";

    const feedback = document.createElement("div");
    feedback.className = "cr-feedback";
    feedback.textContent = "Darkest";
    feedback.dataset.feedbackFor = String(i);

    const canvas = document.createElement("canvas");
    canvas.className = "cr-canvas";
    canvas.width = CR.canvasSize;
    canvas.height = CR.canvasSize;
    fillCanvas(canvas, trial.props[i]);

    const marker = document.createElement("div");
    marker.className = "cr-marker";
    marker.dataset.markerFor = String(i);

    cell.append(feedback, canvas, marker);
    els.row.append(cell);

    if (trial.mode === "ct") {
      cell.classList.add("cr-clickable");
      canvas.addEventListener("click", () => respond(i));
    }
  }

  if (trial.mode === "rs") {
    // The arrow appears BEFORE the response — the participant is told which
    // square to rate, not asked to pick one.
    markerFor(trial.which).classList.add("cr-shown");
    els.scale.classList.remove("cr-hidden");
    setScaleEnabled(true);
  }

  els.prompt.textContent = MODES[trial.mode].instruction;
  trial.shownAt = performance.now();
  later(onDeadline, CR.deadlineMs);
}

function onDeadline() {
  if (!run || !run.trial || run.trial.response !== null) return;
  run.trial.endedOn = "timeout";
  finishTrial();
}

function respond(value) {
  const trial = run && run.trial;
  // `closed` rather than `response !== null`: a trial that timed out still has
  // a null response, and its squares stay on screen through the feedback hold.
  // Without this a late click would overwrite an already-recorded trial and
  // push a second copy of it.
  if (!trial || trial.closed || trial.response !== null) return;

  clearTimers();
  trial.response = value;
  trial.rt = performance.now() - trial.shownAt;
  trial.endedOn = "response";

  if (trial.mode === "ct") {
    markerFor(value).classList.add("cr-shown");
  } else {
    setScaleEnabled(false);
    const button = els.points.querySelector(`[data-rating="${value}"]`);
    if (button) button.classList.add("cr-selected");
  }
  finishTrial();
}

function finishTrial() {
  const trial = run.trial;
  const isPractice = trial.phase === "practice";
  trial.closed = true;
  setScaleEnabled(false);

  // Feedback in practice only. The study's experiment instructions say
  // "There will be no feedback provided in this experiment" in both arms.
  if (isPractice) {
    const label = els.row.querySelector(`[data-feedback-for="${trial.darkest}"]`);
    if (label) label.classList.add("cr-shown");
  }

  run.records.push(trial);
  const hold = isPractice ? CR.practiceFeedbackMs : CR.feedbackMs;
  later(() => {
    els.row.innerHTML = "";
    els.scale.classList.add("cr-hidden");
    els.prompt.textContent = "";
    clearScaleSelection();
    run.index += 1;
    later(nextTrial, CR.blankAfterMs);
  }, hold);
}

function markerFor(index) {
  return els.row.querySelector(`[data-marker-for="${index}"]`);
}

function setScaleEnabled(enabled) {
  for (const button of els.points.children) button.disabled = !enabled;
}

function clearScaleSelection() {
  for (const button of els.points.children) button.classList.remove("cr-selected");
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function showPracticeOver() {
  clearTimers();
  els.overlay.innerHTML = `
    <h3>PRACTICE OVER</h3>
    <p>
      That is the end of practice. From here there is <strong>no feedback</strong> —
      you will not be told whether you were right, exactly as in the study.
    </p>
    <p>The squares also get closer together, so the judgment gets harder.</p>
    <p>Press <strong>Continue</strong> when you are ready.</p>
    <button class="cr-start" id="cr-continue">Continue</button>
  `;
  els.overlay.classList.remove("cr-hidden");
  document.getElementById("cr-continue").addEventListener("click", () => {
    els.overlay.classList.add("cr-hidden");
    nextTrial();
  });
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/*
 * Summarise the test trials only. Practice is excluded, and so are responses
 * faster than 200 ms, which is the study's own analysis exclusion (readAll.m).
 */
function summarise(records) {
  const test = records.filter((r) => r.phase === "test");
  const answered = test.filter(
    (r) => r.endedOn === "response" && r.rt >= CR.minValidRtMs,
  );
  const timeouts = test.filter((r) => r.endedOn === "timeout").length;
  return { test, answered, timeouts };
}

function showSummary() {
  clearTimers();
  const { test, answered, timeouts } = summarise(run.records);
  const rows = [];

  if (run.mode === "ct") {
    const correct = answered.filter((r) => r.response === r.darkest);
    const accuracy = answered.length ? correct.length / answered.length : null;
    rows.push(["Trials answered", `${answered.length} / ${test.length}`]);
    rows.push([
      "Correct",
      accuracy === null ? "–" : `${correct.length} (${Math.round(accuracy * 100)}%)`,
    ]);
    const rt = mean(correct.map((r) => r.rt));
    rows.push(["Mean time, correct trials", rt === null ? "–" : `${Math.round(rt)} ms`]);
  } else {
    // The paper's question in miniature: does the rating separate the trials
    // where the marked square really was darkest from the ones where it wasn't?
    const hit = answered.filter((r) => r.which === r.darkest);
    const miss = answered.filter((r) => r.which !== r.darkest);
    const hitMean = mean(hit.map((r) => r.response));
    const missMean = mean(miss.map((r) => r.response));
    rows.push(["Trials answered", `${answered.length} / ${test.length}`]);
    rows.push([
      "Mean rating — marked square <em>was</em> darkest",
      hitMean === null ? "–" : `${hitMean.toFixed(2)} (n = ${hit.length})`,
    ]);
    rows.push([
      "Mean rating — marked square was <em>not</em>",
      missMean === null ? "–" : `${missMean.toFixed(2)} (n = ${miss.length})`,
    ]);
    if (hitMean !== null && missMean !== null) {
      rows.push(["Separation", `${(hitMean - missMean).toFixed(2)} scale points`]);
    }
    const rt = mean(answered.map((r) => r.rt));
    rows.push(["Mean response time", rt === null ? "–" : `${Math.round(rt)} ms`]);
  }

  if (timeouts > 0) {
    rows.push(["Timed out (7 s)", String(timeouts)]);
  }

  const tail =
    run.mode === "ct"
      ? "<p>Run it again as a rating scale to feel the difference the response mode makes.</p>"
      : "<p>The gap between those two rows is what the rating scale knows about the stimulus. The study found the choice task carried that information more sharply.</p>";

  els.overlay.innerHTML = `
    <h3>DONE</h3>
    <p>${MODES[run.mode].label}, ${test.length} test trial${test.length === 1 ? "" : "s"}.</p>
    <table><tbody>
      ${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}
    </tbody></table>
    ${tail}
    <p>Change the mode above and press <strong>Restart</strong>.</p>
  `;
  els.overlay.classList.remove("cr-hidden");
  els.phase.textContent = "";
  els.counter.textContent = "";
  run = null;
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function buildScale() {
  els.points.innerHTML = "";
  for (let i = 1; i <= 7; i++) {
    const button = document.createElement("button");
    button.className = "cr-point";
    button.dataset.rating = String(i);
    button.textContent = String(i);
    button.addEventListener("click", () => respond(i));
    els.points.append(button);
  }
}

function boot() {
  const mount = document.getElementById("demo-area");
  if (!mount) {
    console.error("dc-rs: #demo-area not found");
    return;
  }
  mount.innerHTML = demoHtml;

  els = {
    mode: document.getElementById("cr-mode"),
    trials: document.getElementById("cr-trials"),
    practice: document.getElementById("cr-practice"),
    start: document.getElementById("cr-start"),
    stage: document.querySelector(".cr-stage"),
    phase: document.getElementById("cr-phase"),
    counter: document.getElementById("cr-counter"),
    prompt: document.getElementById("cr-prompt"),
    row: document.getElementById("cr-row"),
    scale: document.getElementById("cr-scale"),
    points: document.getElementById("cr-points"),
    overlay: document.getElementById("cr-overlay"),
  };

  // Defaults live here, not in the markup's `selected` attributes, so the two
  // cannot drift apart.
  els.mode.value = DEFAULTS.mode;
  els.trials.value = DEFAULTS.trials;

  buildScale();
  els.start.addEventListener("click", startRun);
}

boot();
