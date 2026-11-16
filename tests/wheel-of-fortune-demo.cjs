/*
 * Fidelity and correctness tests for js/demos/wheel-of-fortune.js.
 *
 * The demo runs a numeral identification task and then fits Luce's similarity
 * choice model to the resulting confusion matrix, laying the result out by
 * classical MDS. A scaling model that silently returns nonsense is worse than
 * none, so the estimator is checked by generating confusions from the model
 * itself with known parameters and recovering them.
 *
 * Sources for the fidelity constants are in
 * docs/demos/wheel-of-fortune-fidelity.md.
 *
 * Run: node --test tests/wheel-of-fortune-demo.cjs
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = path.join(__dirname, '..', 'js', 'demos', 'wheel-of-fortune.js');

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/*
 * When true, every string measures the same width — which is what a real
 * canvas reports once the font has fallen back to .notdef for all of them.
 */
const fontState = {missing: false};

function makeNode(tag = 'div') {
  const node = {
    tagName: tag.toUpperCase(),
    children: [],
    dataset: {},
    style: {},
    width: 0,
    height: 0,
    _text: '',
    _html: '',
    classList: {
      _set: new Set(),
      add(...cs) { cs.forEach((c) => this._set.add(c)); },
      remove(...cs) { cs.forEach((c) => this._set.delete(c)); },
      toggle(c, on) { if (on) this._set.add(c); else this._set.delete(c); },
      contains(c) { return this._set.has(c); },
    },
    attributes: {},
    // className and the class attribute both feed classList, so that
    // querySelectorAll('.wf-glyph') finds nodes however they were labelled.
    get className() { return [...this.classList._set].join(' '); },
    set className(v) {
      this.classList._set = new Set(String(v).split(/\s+/).filter(Boolean));
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
      if (name === 'class') this.className = String(value);
    },
    getAttribute(name) { return this.attributes[name]; },
    listeners: {},
    addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); },
    remove() {
      if (node.parent) {
        const i = node.parent.children.indexOf(node);
        if (i >= 0) node.parent.children.splice(i, 1);
      }
    },
    append(...kids) {
      kids.forEach((k) => { k.parent = node; node.children.push(k); });
    },
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); node.children = []; },
    getContext() {
      /*
       * The demo detects a missing font by rendering a glyph and comparing its
       * pixels to a codepoint nothing defines — tofu looks identical for every
       * missing character. So the stub has to model ink, not metrics: remember
       * the last fillText and return a bitmap derived from it. With
       * fontState.missing set, every character returns the same bitmap, which
       * is exactly what a tofu fallback produces.
       */
      let lastText = '';
      return new Proxy({
        fillText(text) { lastText = String(text); },
        measureText: (text) => ({width: 10 + (String(text).codePointAt(0) % 5)}),
        createImageData: (w, h) => ({data: new Uint8ClampedArray(w * h * 4)}),
        getImageData: (_x, _y, w, h) => {
          const data = new Uint8ClampedArray(w * h * 4);
          const code = fontState.missing ? 0 : (lastText.codePointAt(0) || 0);
          // Write a short alpha pattern that depends on the codepoint, so two
          // different characters can never produce the same signature.
          for (let i = 0; i < 24; i += 1) {
            data[i * 4 + 3] = (code >> (i % 16)) & 1 ? 255 : 0;
          }
          data[24 * 4 + 3] = 255; // always some ink, so "blank" is not the signal
          return {data};
        },
      }, {
        get(target, prop) {
          if (prop in target) return target[prop];
          return () => {};
        },
        set() { return true; },
      });
    },
    querySelectorAll(sel) {
      const want = sel.replace(/^\./, '');
      const out = [];
      const walk = (n) => {
        for (const kid of n.children) {
          if (kid.classList.contains(want)) out.push(kid);
          walk(kid);
        }
      };
      walk(node);
      return out;
    },
    querySelector(sel) { return node.querySelectorAll(sel)[0] || null; },
  };
  return node;
}

function load({seed} = {}) {
  const byId = new Map();
  const getById = (id) => {
    if (!byId.has(id)) {
      const n = makeNode();
      n.id = id;
      byId.set(id, n);
    }
    return byId.get(id);
  };

  const timeouts = new Map();
  let nextTimer = 1;

  let mathForVm = Math;
  if (seed !== undefined) {
    mathForVm = Object.create(Math);
    mathForVm.random = mulberry32(seed);
  }

  const sandbox = {
    console, Math: mathForVm, Number, String, Boolean, Array, Object, JSON,
    Set, Map, Uint8ClampedArray, isNaN, parseInt, parseFloat, Infinity,
    performance: {now: () => sandbox.__clock},
    __clock: 0,
    document: {
      getElementById: getById,
      createElement: (tag) => makeNode(tag),
      createElementNS: (_ns, tag) => makeNode(tag),
      addEventListener() {},
    },
    window: {addEventListener() {}},
    setTimeout: (fn, ms) => {
      const id = nextTimer++;
      timeouts.set(id, {fn, ms});
      return id;
    },
    clearTimeout: (id) => { timeouts.delete(id); },
  };
  sandbox.globalThis = sandbox;

  const source = readFileSync(SRC, 'utf8') + `
;globalThis.__T = {WF, SETS, DOT_LAYOUTS, luceSimilarity, luceBias, jacobiEigen,
  classicalMds, shuffled, startRun, respond, pointerAt, sectorForAngle,
  SECTOR_START, SECTOR_STEP, getRun: () => run, els: () => els};
`;
  vm.createContext(sandbox);
  new vm.Script(source, {filename: 'wheel-of-fortune.js'}).runInContext(sandbox);

  const drain = (max = 20000) => {
    let steps = 0;
    while (timeouts.size > 0 && steps < max) {
      const [id, entry] = timeouts.entries().next().value;
      timeouts.delete(id);
      sandbox.__clock += entry.ms;
      entry.fn();
      steps += 1;
    }
    return steps;
  };

  const T = sandbox.__T;

  /* Move the cursor to the centre, which arms the next trial. */
  const goHome = () => T.pointerAt(0, 0);

  /*
   * Answer by crossing the inner ring through the cell holding `stimulusIndex`,
   * which is how the real task is answered. Returns false if that numeral is
   * not currently on the wheel.
   */
  const crossThrough = (stimulusIndex) => {
    const run = T.getRun();
    if (!run) return false;
    const position = run.wheelOrder.indexOf(stimulusIndex);
    if (position < 0) return false;
    const angle = T.SECTOR_START + position * T.SECTOR_STEP;
    const radius = (T.WF.wheelInner + T.WF.wheelOuter) / 2;
    T.pointerAt(Math.cos(angle) * radius, Math.sin(angle) * radius);
    return true;
  };

  return {T, getById, sandbox, drain, timeouts, goHome, crossThrough};
}

// ---------------------------------------------------------------------------
// Fidelity
// ---------------------------------------------------------------------------

test('timing matches the original experiment', () => {
  const {T} = load();
  assert.equal(T.WF.blankBeforeFixationMs, 250);
  assert.equal(T.WF.fixationMs, 500);
  assert.equal(T.WF.blankAfterFixationMs, 250);
  assert.equal(T.WF.targetMs, 500, 'the target is shown for 500ms, not 1000');
  assert.equal(T.WF.maskMs, 200, 'the mask is 200ms, not 50');
  assert.equal(T.WF.deadlineMs, 8000, 'the response window is 8s, not 6s');
  assert.equal(T.WF.canvas, 221, "the study's stimulus tifs are 221x221");
});

test('the noise level is inside the contract the old demo broke', () => {
  const {T} = load();
  // The old file shipped noiseLevels: [2.2] against a documented 0-1 range,
  // which saturated the image and destroyed the glyph.
  assert.ok(T.WF.noiseSigma > 0 && T.WF.noiseSigma <= 1,
    `sigma ${T.WF.noiseSigma} is outside 0-1`);
  assert.equal(T.WF.noiseSigma, 0.25, 'the code that ran used sigma = 0.25');
  assert.equal(T.WF.noiseScale, 255 * 0.5);
  assert.equal(T.WF.background, 128, 'mid grey background');
});

test('the staircase is 2-up-1-down over the published bounds', () => {
  const {T} = load();
  assert.equal(T.WF.signalStart, 153);
  assert.equal(T.WF.signalMin, 128);
  assert.equal(T.WF.signalMax, 255);
  assert.deepEqual([...T.WF.testOffsets], [-3, -2, -1, 0, 1],
    'the study tested anchor-3 .. anchor+1');
});

test('all four numeral sets are present, nine items each, zero excluded', () => {
  const {T} = load();
  const keys = Object.keys(T.SETS);
  assert.deepEqual(keys.sort(), ['arabic', 'chinese', 'dots', 'thai']);
  for (const key of keys) {
    const set = T.SETS[key];
    assert.equal(set.glyphs.length, 9, `${key} must have nine items`);
    assert.ok(!set.glyphs.includes('0'), `${key} must not include zero`);
  }
  assert.deepEqual([...T.SETS.arabic.glyphs], ['1','2','3','4','5','6','7','8','9']);
  assert.deepEqual([...T.SETS.chinese.glyphs],
    ['一','二','三','四','五','六','七','八','九']);
  assert.deepEqual([...T.SETS.thai.glyphs],
    ['๑','๒','๓','๔','๕','๖','๗','๘','๙']);
});

test('dot layouts hold the right number of dots', () => {
  const {T} = load();
  for (let n = 1; n <= 9; n++) {
    const cells = T.DOT_LAYOUTS[n];
    assert.ok(cells, `missing layout for ${n}`);
    assert.equal(cells.length, n, `layout ${n} has ${cells.length} dots`);
    const unique = new Set(cells.map(([c, r]) => `${c},${r}`));
    assert.equal(unique.size, n, `layout ${n} reuses a grid cell`);
    for (const [c, r] of cells) {
      assert.ok(c >= 0 && c <= 2 && r >= 0 && r <= 2, `layout ${n} leaves the 3x3 grid`);
    }
  }
});

// ---------------------------------------------------------------------------
// Luce's similarity choice model
// ---------------------------------------------------------------------------

/*
 * Generate confusions from the model itself:
 *   P(respond j | show i) proportional to b_j * eta_ij
 * so the estimator has a known truth to recover.
 */
function simulateConfusions(eta, bias, perStimulus, rng) {
  const n = eta.length;
  const counts = Array.from({length: n}, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    const weights = [];
    let total = 0;
    for (let j = 0; j < n; j++) {
      const w = bias[j] * eta[i][j];
      weights.push(w);
      total += w;
    }
    for (let trial = 0; trial < perStimulus; trial++) {
      let u = rng() * total;
      let picked = n - 1;
      for (let j = 0; j < n; j++) {
        u -= weights[j];
        if (u <= 0) { picked = j; break; }
      }
      counts[i][picked] += 1;
    }
  }
  return counts;
}

test('Luce similarity recovers known eta from model-generated confusions', () => {
  const {T} = load();
  const rng = mulberry32(20261028);
  const n = 6;

  // A known similarity structure: items near each other on a line are more
  // confusable, plus an uneven response bias to be stripped out.
  const eta = Array.from({length: n}, (_, i) =>
    Array.from({length: n}, (_, j) =>
      i === j ? 1 : Math.exp(-Math.abs(i - j) * 0.8)));
  const bias = [0.30, 0.20, 0.15, 0.15, 0.12, 0.08];

  const counts = simulateConfusions(eta, bias, 4000, rng);
  const fitted = T.luceSimilarity(counts);

  assert.equal(fitted.length, n);
  for (let i = 0; i < n; i++) {
    assert.equal(fitted[i][i], 1, 'the diagonal is fixed at 1');
    for (let j = 0; j < n; j++) {
      assert.ok(Number.isFinite(fitted[i][j]), `eta[${i}][${j}] is not finite`);
      assert.ok(Math.abs(fitted[i][j] - fitted[j][i]) < 1e-12, 'eta must be symmetric');
    }
  }

  let worst = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      worst = Math.max(worst, Math.abs(fitted[i][j] - eta[i][j]));
    }
  }
  assert.ok(worst < 0.05, `worst deviation from the true eta was ${worst.toFixed(4)}`);
});

test('the similarity estimate is unaffected by response bias', () => {
  // This is the whole point of using Luce's model: two people with the same
  // perceptual confusability but different answer habits must come out the
  // same. Raw confusion rates would not.
  const {T} = load();
  const n = 5;
  const eta = Array.from({length: n}, (_, i) =>
    Array.from({length: n}, (_, j) =>
      i === j ? 1 : Math.exp(-Math.abs(i - j) * 0.7)));

  const even = new Array(n).fill(1 / n);
  const lopsided = [0.50, 0.25, 0.12, 0.08, 0.05];

  const a = T.luceSimilarity(
    simulateConfusions(eta, even, 6000, mulberry32(5)));
  const b = T.luceSimilarity(
    simulateConfusions(eta, lopsided, 6000, mulberry32(6)));

  let worst = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) worst = Math.max(worst, Math.abs(a[i][j] - b[i][j]));
  }
  assert.ok(worst < 0.06,
    `bias changed the recovered similarities by up to ${worst.toFixed(4)}`);

  // And the raw confusion rates genuinely do differ, so the test above is not
  // passing trivially.
  const rawA = simulateConfusions(eta, even, 6000, mulberry32(5));
  const rawB = simulateConfusions(eta, lopsided, 6000, mulberry32(6));
  const rateA = rawA[0][1] / rawA[0].reduce((x, y) => x + y, 0);
  const rateB = rawB[0][1] / rawB[0].reduce((x, y) => x + y, 0);
  assert.ok(Math.abs(rateA - rateB) > 0.05,
    'the raw rates should differ, otherwise this proves nothing');
});

test('response bias is recovered and normalised', () => {
  const {T} = load();
  const n = 5;
  const eta = Array.from({length: n}, (_, i) =>
    Array.from({length: n}, (_, j) => (i === j ? 1 : 0.4)));
  const bias = [0.40, 0.25, 0.15, 0.12, 0.08];
  const counts = simulateConfusions(eta, bias, 5000, mulberry32(77));

  const fitted = T.luceBias(counts);
  const total = fitted.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `bias should sum to 1, got ${total}`);
  // The ordering of preference must be recovered.
  const order = fitted.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
  assert.deepEqual(order, [0, 1, 2, 3, 4]);
});

test('an empty confusion matrix does not produce NaN', () => {
  const {T} = load();
  const counts = Array.from({length: 9}, () => new Array(9).fill(0));
  const eta = T.luceSimilarity(counts);
  const bias = T.luceBias(counts);
  assert.ok(eta.every((row) => row.every(Number.isFinite)), 'eta must stay finite');
  assert.ok(bias.every(Number.isFinite), 'bias must stay finite');
  // With no data every item is equally confusable with every other.
  assert.ok(Math.abs(eta[0][1] - eta[3][4]) < 1e-12);
  const coords = T.classicalMds(eta);
  assert.ok(coords.every((p) => p.every(Number.isFinite)), 'MDS must stay finite');
});

test('eta stays within [0, 1]', () => {
  const {T} = load();
  const rng = mulberry32(31337);
  const counts = Array.from({length: 9}, () =>
    Array.from({length: 9}, () => Math.floor(rng() * 12)));
  const eta = T.luceSimilarity(counts);
  for (const row of eta) {
    for (const v of row) assert.ok(v >= 0 && v <= 1, `eta value ${v} out of range`);
  }
});

// ---------------------------------------------------------------------------
// MDS
// ---------------------------------------------------------------------------

test('Jacobi recovers known eigenvalues of a symmetric matrix', () => {
  const {T} = load();
  // Diagonal matrix: eigenvalues are the diagonal entries.
  const diag = [[3, 0, 0], [0, -1, 0], [0, 0, 7]];
  const {values} = T.jacobiEigen(diag);
  assert.deepEqual([...values].sort((a, b) => a - b), [-1, 3, 7]);

  // A known 2x2: [[2,1],[1,2]] has eigenvalues 1 and 3.
  const sym = [[2, 1], [1, 2]];
  const out = T.jacobiEigen(sym).values.slice().sort((a, b) => a - b);
  assert.ok(Math.abs(out[0] - 1) < 1e-9 && Math.abs(out[1] - 3) < 1e-9,
    `got ${out}`);
});

test('classical MDS recovers a known one-dimensional layout', () => {
  const {T} = load();
  // Build eta so that 1 - eta equals the distance between evenly spaced points.
  const positions = [0, 0.1, 0.2, 0.3, 0.4];
  const n = positions.length;
  const eta = Array.from({length: n}, (_, i) =>
    Array.from({length: n}, (_, j) => 1 - Math.abs(positions[i] - positions[j])));

  const coords = T.classicalMds(eta);
  assert.equal(coords.length, n);
  assert.ok(coords.every((p) => p.length === 2 && p.every(Number.isFinite)));

  // The first dimension should order the points as they really are (up to a
  // reflection, which MDS does not determine).
  const order = coords.map((p, i) => [p[0], i]).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
  const forward = [0, 1, 2, 3, 4];
  const backward = [4, 3, 2, 1, 0];
  assert.ok(
    JSON.stringify(order) === JSON.stringify(forward) ||
    JSON.stringify(order) === JSON.stringify(backward),
    `recovered order ${order}`);

  // The structure is one-dimensional, so the second axis should be negligible.
  const spread1 = Math.max(...coords.map((p) => p[0])) - Math.min(...coords.map((p) => p[0]));
  const spread2 = Math.max(...coords.map((p) => p[1])) - Math.min(...coords.map((p) => p[1]));
  assert.ok(spread2 < spread1 * 0.1,
    `second dimension spread ${spread2.toFixed(4)} vs first ${spread1.toFixed(4)}`);
});

test('MDS places confusable items close and distinct items far', () => {
  const {T} = load();
  // Two tight clusters: {0,1,2} and {3,4,5}.
  const n = 6;
  const eta = Array.from({length: n}, (_, i) =>
    Array.from({length: n}, (_, j) => {
      if (i === j) return 1;
      const sameCluster = (i < 3) === (j < 3);
      return sameCluster ? 0.85 : 0.15;
    }));
  const coords = T.classicalMds(eta);
  const dist = (a, b) => Math.hypot(coords[a][0] - coords[b][0], coords[a][1] - coords[b][1]);
  const within = (dist(0, 1) + dist(0, 2) + dist(3, 4) + dist(3, 5)) / 4;
  const between = (dist(0, 3) + dist(1, 4) + dist(2, 5)) / 3;
  assert.ok(between > within * 2,
    `between-cluster ${between.toFixed(3)} should dwarf within ${within.toFixed(3)}`);
});

// ---------------------------------------------------------------------------
// Flow
// ---------------------------------------------------------------------------


/*
 * Advance one trial: home the cursor, run the stimulus sequence, then answer by
 * crossing the ring through whichever numeral `chooser` names.
 */
function answerTrial(h, chooser) {
  h.goHome();
  h.drain(5); // blank, fixation, blank, target, mask -> the wheel is armed
  const run = h.T.getRun();
  // `closed` matters as much as `shownAt`: at a phase boundary the previous
  // trial is still sitting there, finished, waiting on a Continue click.
  if (!run || !run.trial || run.trial.shownAt === null || run.trial.closed) return null;
  const trial = run.trial;
  h.crossThrough(chooser(trial, run));

  // Read the feedback shading BEFORE draining: the hold timer clears it.
  const cells = h.T.els().rings.querySelectorAll('.wf-cell');
  trial.litCells = cells.filter(
    (c) => c.classList.contains('wf-correct') || c.classList.contains('wf-wrong'),
  ).length;

  h.drain(1); // feedback or ITI hold
  return trial;
}

test('the wheel geometry is a two-ring annulus at the study\'s proportions', () => {
  const {T} = load();
  assert.ok(T.WF.wheelInner < T.WF.wheelOuter, 'inner ring must sit inside outer');
  assert.ok(T.WF.wheelGlyphRadius > T.WF.wheelInner &&
            T.WF.wheelGlyphRadius < T.WF.wheelOuter,
    'numerals must sit inside the band, between the rings');
  // The study ran inner 400 / outer 520.
  const ratio = T.WF.wheelInner / T.WF.wheelOuter;
  assert.ok(Math.abs(ratio - 400 / 520) < 0.01,
    `inner/outer ratio ${ratio.toFixed(3)} should match the study's 0.769`);
  assert.ok(T.WF.homeRadius > 0 && T.WF.homeRadius < T.WF.wheelInner,
    'the home circle must sit well inside the inner ring');
});

test('angles map to the nine cells, wrapping correctly', () => {
  const {T} = load();
  for (let position = 0; position < 9; position++) {
    const centre = T.SECTOR_START + position * T.SECTOR_STEP;
    assert.equal(T.sectorForAngle(centre), position, `cell centre ${position}`);
    // Anywhere inside the cell, short of its boundary, maps to the same cell.
    assert.equal(T.sectorForAngle(centre + T.SECTOR_STEP * 0.45), position);
    assert.equal(T.sectorForAngle(centre - T.SECTOR_STEP * 0.45), position);
    // And a full turn lands back in the same place.
    assert.equal(T.sectorForAngle(centre + Math.PI * 2), position);
    assert.equal(T.sectorForAngle(centre - Math.PI * 2), position);
  }
});

test('crossing the inner ring answers with the cell the cursor passed through', () => {
  const {T, getById, goHome, drain} = load({seed: 3});
  getById('wf-set').value = 'arabic';
  getById('wf-trials').value = '45';
  T.startRun();
  goHome();
  drain(5);

  const run = T.getRun();
  const position = 4;
  const expected = run.wheelOrder[position];
  const angle = T.SECTOR_START + position * T.SECTOR_STEP;
  const radius = (T.WF.wheelInner + T.WF.wheelOuter) / 2;
  T.pointerAt(Math.cos(angle) * radius, Math.sin(angle) * radius);

  assert.equal(run.records.length, 1);
  assert.equal(run.records[0].response, expected,
    'the answer is the numeral in the cell crossed, not the cell index');
  assert.equal(run.records[0].endedOn, 'response');
});

test('moving inside the inner ring never answers', () => {
  const {T, getById, goHome, drain} = load({seed: 7});
  getById('wf-set').value = 'arabic';
  getById('wf-trials').value = '45';
  T.startRun();
  goHome();
  drain(5);

  const run = T.getRun();
  // Sweep right around, staying just inside the inner ring.
  for (let i = 0; i < 40; i++) {
    const angle = (i / 40) * Math.PI * 2;
    const radius = T.WF.wheelInner - 2;
    T.pointerAt(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  assert.equal(run.records.length, 0, 'no answer may be taken inside the ring');
  assert.equal(run.trial.response, null);
});

test('the next trial does not begin until the cursor returns to the centre', () => {
  const {T, getById, goHome, crossThrough, drain} = load({seed: 11});
  getById('wf-set').value = 'arabic';
  getById('wf-trials').value = '45';
  T.startRun();

  // Before homing, nothing runs at all.
  assert.ok(T.getRun().waitingForHome, 'the run starts parked at home');
  drain(20);
  assert.equal(T.getRun().records.length, 0);
  assert.equal(T.getRun().trial, null, 'no trial starts while waiting for home');

  goHome();
  drain(5);
  assert.ok(T.getRun().trial.shownAt !== null, 'homing starts the trial');

  crossThrough(T.getRun().trial.stimulus);
  drain(1);
  assert.ok(T.getRun().waitingForHome, 'after answering it parks again');

  // Hovering out at the ring does not restart anything.
  T.pointerAt(T.WF.wheelOuter, 0);
  assert.ok(T.getRun().waitingForHome);
  assert.equal(T.getRun().trial.closed, true);

  goHome();
  drain(5);
  assert.equal(T.getRun().trial.closed, false, 'homing starts the next trial');
});

test('calibration gives feedback, the test phase does not, and only test trials count', () => {
  const h = load({seed: 13});
  const {T, getById} = h;
  getById('wf-set').value = 'arabic';
  getById('wf-trials').value = '45';
  T.startRun();

  const run = T.getRun();
  const before = run.signal;

  let feedbackInCalibration = 0;
  let calibrationTrials = 0;
  while (T.getRun() && T.getRun().phase === 'calibration') {
    const trial = answerTrial(h, (t) => t.stimulus); // always correct
    if (!trial) break;
    calibrationTrials += 1;
    if (trial.litCells > 0) feedbackInCalibration += 1;
  }

  assert.ok(calibrationTrials > 0);
  assert.equal(feedbackInCalibration, calibrationTrials,
    'every calibration trial should mark the correct cell');
  assert.ok(run.signal < before,
    `two-correct-in-a-row should dim the glyph: ${before} -> ${run.signal}`);
  assert.equal(run.counts.flat().reduce((a, b) => a + b, 0), 0,
    'calibration confusions must not enter the matrix');
});

test('an error pushes the staircase the other way', () => {
  const h = load({seed: 17});
  const {T, getById} = h;
  getById('wf-set').value = 'arabic';
  getById('wf-trials').value = '45';
  T.startRun();

  const run = T.getRun();
  const before = run.signal;
  answerTrial(h, (t) => (t.stimulus + 1) % 9); // deliberately wrong
  assert.ok(run.signal > before,
    `an error should brighten the glyph: ${before} -> ${run.signal}`);
  assert.equal(run.consecutiveCorrect, 0);
});

test('a crossing before the wheel appears is ignored', () => {
  const {T, getById, goHome, crossThrough, drain} = load({seed: 19});
  getById('wf-set').value = 'arabic';
  getById('wf-trials').value = '45';
  T.startRun();
  goHome();
  drain(2); // mid-sequence; the wheel is not up yet

  const run = T.getRun();
  assert.equal(run.trial.shownAt, null);
  crossThrough(run.trial.stimulus);
  assert.equal(run.records.length, 0);
});

test('the wheel order is shuffled, as the study shuffled it per session', () => {
  const orders = new Set();
  for (let seed = 1; seed <= 20; seed++) {
    const {T, getById} = load({seed: seed * 977});
    getById('wf-set').value = 'arabic';
    getById('wf-trials').value = '45';
    T.startRun();
    const order = T.getRun().wheelOrder;
    assert.equal(order.length, 9);
    assert.equal(new Set(order).size, 9, 'every numeral appears exactly once');
    orders.add(order.join(','));
  }
  assert.ok(orders.size > 10, `only ${orders.size} distinct wheel orders in 20 runs`);
});

test('a stale control value cannot take the demo down', () => {
  const {T, getById} = load({seed: 23});
  getById('wf-set').value = 'klingon';
  getById('wf-trials').value = 'banana';
  T.startRun();
  const run = T.getRun();
  assert.ok(T.SETS[run.setKey], 'falls back to a real set');
  assert.equal(run.testTrials, 45);
});

test('a full run reaches a summary with a confusion matrix and a map', () => {
  const h = load({seed: 101});
  const {T, getById} = h;
  getById('wf-set').value = 'arabic';
  getById('wf-trials').value = '45';
  T.startRun();

  let answered = 0;
  for (let guard = 0; guard < 400; guard++) {
    if (!T.getRun()) break;
    const trial = answerTrial(h, (t) => (guard % 4 === 0 ? (t.stimulus + 1) % 9 : t.stimulus));
    if (trial) {
      answered += 1;
      continue;
    }
    // The calibration handover waits on a Continue click.
    const button = getById('wf-continue');
    const handlers = button.listeners.click || [];
    if (handlers.length === 0) break;
    button.listeners.click = [];
    handlers.forEach((fn) => fn());
  }

  assert.ok(answered >= 45 + T.WF.calibrationTrials - 2, `only ${answered} answered`);
  assert.equal(T.getRun(), null, 'the run should have ended');

  const html = T.els().overlay.innerHTML;
  assert.match(html, /YOUR CONFUSIONS/);
  assert.match(html, /wf-matrix/);
  assert.match(html, /wf-map/);
  assert.match(html, /Luce/);
  assert.match(html, /Calibrated grey level/);
});

test('a thin session says so instead of presenting noise as a result', () => {
  const h = load({seed: 211});
  const {T, getById, goHome, drain} = h;
  getById('wf-set').value = 'thai';
  getById('wf-trials').value = '45';
  T.startRun();

  // The phase flips to 'test' before the handover overlay appears, so check for
  // a pending Continue first rather than keying off the phase.
  const clickContinue = () => {
    const button = getById('wf-continue');
    const handlers = button.listeners.click || [];
    if (handlers.length === 0) return false;
    button.listeners.click = [];
    handlers.forEach((fn) => fn());
    return true;
  };

  for (let guard = 0; guard < 400; guard++) {
    const run = T.getRun();
    if (!run) break;
    if (clickContinue()) continue;

    if (run.phase === 'calibration') {
      if (!answerTrial(h, (t) => t.stimulus)) break;
      continue;
    }
    // Test phase: home, then let everything expire without answering. Draining
    // to empty runs the sequence, the 8s deadline and the hold, parking the run
    // back at home.
    goHome();
    drain();
  }

  assert.match(T.els().overlay.innerHTML, /mostly noise/,
    'with no answered trials the demo must disclaim the map');
});

test('a set with no font available is refused rather than shown as tofu', () => {
  const {T, getById} = load({seed: 55});

  fontState.missing = true;
  try {
    getById('wf-set').value = 'thai';
    getById('wf-trials').value = '45';
    T.startRun();

    assert.equal(T.getRun(), null, 'the run must not start');
    assert.match(T.els().overlay.innerHTML, /NO FONT FOR THIS SET/);
    assert.match(T.els().overlay.innerHTML, /Thai/);

    // Dots are drawn, not typeset, so they must still work with no fonts.
    getById('wf-set').value = 'dots';
    T.startRun();
    assert.ok(T.getRun(), 'the dots set does not depend on fonts');
    assert.equal(T.getRun().setKey, 'dots');
  } finally {
    fontState.missing = false;
  }
});

test('with fonts present every set starts normally', () => {
  for (const key of ['arabic', 'chinese', 'thai', 'dots']) {
    const {T, getById} = load({seed: 71});
    getById('wf-set').value = key;
    getById('wf-trials').value = '45';
    T.startRun();
    assert.ok(T.getRun(), `${key} should start when its font is available`);
    assert.equal(T.getRun().setKey, key);
  }
});

test('the cursor is hidden while the stimulus is on screen', () => {
  // The cursor rests dead centre, exactly where the target appears. An arrow
  // sitting on a near-threshold noisy glyph is a cue in its own right.
  const {T, getById, goHome, crossThrough, drain} = load({seed: 29});
  getById('wf-set').value = 'arabic';
  getById('wf-trials').value = '45';
  T.startRun();

  const wheel = T.els().wheel;
  const hidden = () => wheel.classList.contains('wf-nocursor');

  assert.equal(hidden(), false, 'visible while waiting at home');

  goHome();
  assert.equal(hidden(), true, 'hidden as soon as the trial sequence starts');

  // It stays hidden right through fixation, target and mask.
  for (let step = 0; step < 4; step++) {
    drain(1);
    assert.equal(hidden(), true, `still hidden at sequence step ${step + 1}`);
  }

  drain(1); // the mask ends and the wheel arms
  assert.ok(T.getRun().trial.shownAt !== null);
  assert.equal(hidden(), false, 'visible again once an answer is wanted');

  crossThrough(T.getRun().trial.stimulus);
  drain(1);
  assert.equal(hidden(), false, 'visible while returning to the centre');
});
