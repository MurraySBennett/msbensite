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
      return new Proxy({}, {
        get(_t, prop) {
          if (prop === 'getImageData') {
            return (_x, _y, w, h) => ({data: new Uint8ClampedArray(w * h * 4).fill(128)});
          }
          if (prop === 'createImageData') {
            return (w, h) => ({data: new Uint8ClampedArray(w * h * 4)});
          }
          if (prop === 'measureText') {
            // Width must vary by string, otherwise the demo's missing-font
            // check cannot tell a real glyph from .notdef. Give the
            // unassigned codepoint a distinct width, as a real engine does.
            return (text) => {
              if (fontState.missing) return {width: 7};
              if (text === '\u{10FFFD}') return {width: 7};
              return {width: 10 + (text.codePointAt(0) % 5)};
            };
          }
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
  classicalMds, shuffled, startRun, respond, getRun: () => run, els: () => els};
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

  return {T: sandbox.__T, getById, sandbox, drain, timeouts};
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

test('calibration runs first with feedback, then the test phase without', () => {
  const {T, getById, drain} = load({seed: 3});
  getById('wf-set').value = 'arabic';
  getById('wf-trials').value = '45';
  T.startRun();

  const run = T.getRun();
  assert.equal(run.phase, 'calibration');
  assert.equal(run.signal, T.WF.signalStart);
  assert.equal(run.counts.length, 9);
  assert.ok(run.counts.every((row) => row.length === 9 && row.every((v) => v === 0)));

  // Answer every calibration trial correctly; the staircase should make the
  // glyph dimmer (two correct in a row lowers the signal level).
  const before = run.signal;
  for (let guard = 0; guard < 400; guard++) {
    if (run.phase !== 'calibration') break;
    const trial = run.trial;
    if (trial && trial.shownAt !== null && !trial.closed) T.respond(trial.stimulus);
    if (drain(1) === 0) break;
  }
  assert.ok(run.signal < before,
    `signal should have dropped from ${before}, got ${run.signal}`);
  assert.ok(run.calibrationLevels.length > 0);

  // Calibration confusions must NOT enter the matrix.
  const entered = run.counts.flat().reduce((a, b) => a + b, 0);
  assert.equal(entered, 0, 'only test trials count toward the confusion matrix');
});

test('an error pushes the staircase the other way', () => {
  const {T, getById, drain} = load({seed: 5});
  getById('wf-set').value = 'arabic';
  getById('wf-trials').value = '45';
  T.startRun();
  drain(5); // blank, fixation, blank, target, mask -> wheel is up

  const run = T.getRun();
  const before = run.signal;
  const wrong = (run.trial.stimulus + 1) % 9;
  T.respond(wrong);
  assert.ok(run.signal > before,
    `an error should raise the signal from ${before}, got ${run.signal}`);
  assert.equal(run.consecutiveCorrect, 0);
});

test('a response before the wheel appears is ignored', () => {
  const {T, getById, drain} = load({seed: 9});
  getById('wf-set').value = 'arabic';
  getById('wf-trials').value = '45';
  T.startRun();
  drain(2); // mid-sequence, before the wheel is shown
  const run = T.getRun();
  assert.equal(run.trial.shownAt, null);
  T.respond(0);
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
  const {T, getById} = load({seed: 13});
  getById('wf-set').value = 'klingon';
  getById('wf-trials').value = 'banana';
  T.startRun();
  const run = T.getRun();
  assert.ok(T.SETS[run.setKey], 'falls back to a real set');
  assert.equal(run.testTrials, 45);
});

test('a full run reaches a summary with a confusion matrix and a map', () => {
  const {T, getById, drain} = load({seed: 101});
  getById('wf-set').value = 'arabic';
  getById('wf-trials').value = '45';
  T.startRun();

  let answered = 0;
  for (let guard = 0; guard < 20000; guard++) {
    const run = T.getRun();
    if (!run) break;
    const trial = run.trial;
    if (trial && trial.shownAt !== null && !trial.closed) {
      // A plausible observer: usually right, sometimes confusing a neighbour.
      const slip = (guard % 4 === 0);
      T.respond(slip ? (trial.stimulus + 1) % 9 : trial.stimulus);
      answered += 1;
    }
    if (drain(1) === 0) {
      // The calibration handover waits on a Continue click.
      const button = getById('wf-continue');
      const handlers = button.listeners.click || [];
      if (handlers.length === 0) break;
      button.listeners.click = [];
      handlers.forEach((fn) => fn());
    }
  }

  assert.ok(answered >= 45 + T.WF.calibrationTrials - 2,
    `only ${answered} trials answered`);
  assert.equal(T.getRun(), null, 'the run should have ended');

  const html = T.els().overlay.innerHTML;
  assert.match(html, /YOUR CONFUSIONS/);
  assert.match(html, /wf-matrix/, 'the confusion matrix must be rendered');
  assert.match(html, /wf-map/, 'the MDS map must be rendered');
  assert.match(html, /Luce/);
  assert.match(html, /Calibrated grey level/);
  assert.match(html, /Strongest response bias/);
});

test('a thin session says so instead of presenting noise as a result', () => {
  const {T, getById, drain} = load({seed: 211});
  getById('wf-set').value = 'thai';
  getById('wf-trials').value = '45';
  T.startRun();

  // Let every test trial time out, so almost nothing is answered.
  for (let guard = 0; guard < 20000; guard++) {
    const run = T.getRun();
    if (!run) break;
    if (run.phase === 'calibration') {
      const trial = run.trial;
      if (trial && trial.shownAt !== null && !trial.closed) T.respond(trial.stimulus);
    }
    if (drain(1) === 0) {
      const button = getById('wf-continue');
      const handlers = button.listeners.click || [];
      if (handlers.length === 0) break;
      button.listeners.click = [];
      handlers.forEach((fn) => fn());
    }
  }

  const html = T.els().overlay.innerHTML;
  assert.match(html, /mostly noise/,
    'with no answered trials the demo must disclaim the map');
});

test('a set with no font available is refused rather than shown as tofu', () => {
  // The study used fixed images so glyph shapes were guaranteed. Rendering live
  // means a visitor without a Thai or CJK font would be identifying empty
  // boxes, which is meaningless rather than hard.
  const {T, getById} = load({seed: 55});

  fontState.missing = true;
  try {
    getById('wf-set').value = 'thai';
    getById('wf-trials').value = '45';
    T.startRun();

    assert.equal(T.getRun(), null, 'the run must not start');
    assert.match(T.els().overlay.innerHTML, /NO FONT FOR THIS SET/);
    assert.match(T.els().overlay.innerHTML, /Thai/);

    // Dots are drawn, not typeset, so they must still work even with no fonts.
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
