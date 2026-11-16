/*
 * Fidelity and correctness tests for js/demos/mel-features.js.
 *
 * Two jobs here. The first is the usual fidelity pinning against
 * pwc/btl_melanoma.study.json (see docs/demos/mel-features-fidelity.md). The
 * second is heavier: the demo fits a Bradley-Terry-Luce model to the visitor's
 * own comparisons, and a scaling model that silently returns nonsense is worse
 * than no model at all. So the fit is checked against synthetic data with known
 * strengths.
 *
 * There is also a licence test. Only CC-0 and CC-BY images from the study's set
 * may ever be served; 7,107 of the 10,000 are CC-BY-NC. That test is a hard
 * safety gate, not a style check.
 *
 * Run: node --test tests/mel-features-demo.cjs
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync, existsSync, readdirSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'js', 'demos', 'mel-features.js');
const IMAGE_DIR = path.join(ROOT, 'assets', 'images', 'demos', 'mel-features');
const MANIFEST = path.join(IMAGE_DIR, 'manifest.json');

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

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

function makeNode(tag = 'div') {
  return {
    tagName: tag.toUpperCase(),
    children: [],
    dataset: {},
    style: {},
    src: '',
    value: '',
    checked: false,
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
    append(...kids) { kids.forEach((k) => this.children.push(k)); },
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); },
  };
}

function load({seed} = {}) {
  const byId = new Map();
  const getById = (id) => {
    if (!byId.has(id)) {
      const n = makeNode(id.includes('left') || id.includes('right') ? 'img' : 'div');
      n.id = id;
      byId.set(id, n);
    }
    return byId.get(id);
  };

  const timeouts = new Map();
  let nextTimer = 1;
  const docListeners = {};

  let mathForVm = Math;
  if (seed !== undefined) {
    mathForVm = Object.create(Math);
    mathForVm.random = mulberry32(seed);
  }

  const sandbox = {
    console, Math: mathForVm, Number, String, Boolean, Array, Object, JSON,
    Float64Array, Set, Map, Infinity, isNaN,
    performance: {now: () => sandbox.__clock},
    __clock: 0,
    document: {
      getElementById: getById,
      addEventListener: (ev, fn) => { (docListeners[ev] ||= []).push(fn); },
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
;globalThis.__T = {ML, CONDITIONS, LESIONS, CREDITS, fitBtl, graphIsConnected,
  agreementWithBiopsy, shuffled, startRun, respond, pickPair,
  getRun: () => run, els: () => els};
`;
  vm.createContext(sandbox);
  new vm.Script(source, {filename: 'mel-features.js'}).runInContext(sandbox);

  const drain = (max = 5000) => {
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

  return {T: sandbox.__T, getById, sandbox, drain, docListeners, timeouts};
}

// ---------------------------------------------------------------------------
// Licence safety — the hard gate
// ---------------------------------------------------------------------------

test('every served image is CC-0 or CC-BY, and no CC-BY-NC is present', () => {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const byId = new Map(manifest.images.map((r) => [r.isic_id, r]));

  const onDisk = readdirSync(IMAGE_DIR).filter((f) => f.endsWith('.jpg'));
  assert.ok(onDisk.length > 0, 'images must be present');

  for (const file of onDisk) {
    const id = file.replace(/\.jpg$/, '');
    const record = byId.get(id);
    assert.ok(record, `${file} is on disk but missing from manifest.json`);
    assert.ok(['CC-0', 'CC-BY'].includes(record.licence),
      `${file} is ${record.licence} — only CC-0 and CC-BY may be served`);
  }

  for (const record of manifest.images) {
    assert.ok(['CC-0', 'CC-BY'].includes(record.licence),
      `manifest lists ${record.isic_id} as ${record.licence}`);
  }
  assert.equal(manifest.counts.served, manifest.images.length);
});

test('the demo only references images that exist and are licence-clean', () => {
  const {T} = load();
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const licenceById = new Map(manifest.images.map((r) => [r.isic_id, r.licence]));

  assert.ok(T.LESIONS.length >= 12, 'need at least a pool-size worth of images');
  for (const [id, , licenceCode] of T.LESIONS) {
    assert.ok(existsSync(path.join(IMAGE_DIR, `${id}.jpg`)),
      `${id}.jpg referenced by the demo but not on disk`);
    const licence = licenceById.get(id);
    assert.ok(['CC-0', 'CC-BY'].includes(licence), `${id} is ${licence}`);
    // The embedded code must agree with the manifest: 0 = CC-0, 1 = CC-BY.
    assert.equal(licenceCode, licence === 'CC-0' ? 0 : 1,
      `${id} licence code ${licenceCode} disagrees with manifest ${licence}`);
  }
});

test('the embedded malignancy labels agree with the manifest', () => {
  const {T} = load();
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const malById = new Map(manifest.images.map((r) => [r.isic_id, r.malignant]));
  for (const [id, mal] of T.LESIONS) {
    assert.equal(Boolean(mal), malById.get(id), `${id} malignancy flag disagrees`);
  }
  const nMal = T.LESIONS.filter(([, m]) => m === 1).length;
  assert.ok(nMal > 0 && nMal < T.LESIONS.length, 'the pool must contain both classes');
});

// ---------------------------------------------------------------------------
// Bradley-Terry-Luce
// ---------------------------------------------------------------------------

test('BTL recovers a known ordering from synthetic comparisons', () => {
  const {T} = load();
  const rng = mulberry32(99991);
  const n = 10;
  // True strengths on the log scale, evenly spaced and well separated.
  const truth = Array.from({length: n}, (_, i) => (i - (n - 1) / 2) * 0.6);

  const comparisons = [];
  for (let rep = 0; rep < 60; rep++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        // Luce choice rule: P(i beats j) = e^a / (e^a + e^b)
        const p = Math.exp(truth[i]) / (Math.exp(truth[i]) + Math.exp(truth[j]));
        if (rng() < p) comparisons.push({winner: i, loser: j});
        else comparisons.push({winner: j, loser: i});
      }
    }
  }

  // Unregularised, the estimator should land on the truth. This is the test of
  // the algorithm itself.
  const exact = T.fitBtl(n, comparisons, {prior: 0});
  assert.equal(exact.length, n);
  assert.ok(exact.every(Number.isFinite), 'all estimates must be finite');

  const order = exact.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
  assert.deepEqual(order, Array.from({length: n}, (_, i) => i),
    `recovered order ${order} does not match the true order`);

  const maxErr = Math.max(...exact.map((v, i) => Math.abs(v - truth[i])));
  assert.ok(maxErr < 0.25, `max deviation from truth was ${maxErr.toFixed(3)}`);

  // With the demo's 0.5 prior the estimates shrink toward zero. That is the
  // regularisation working, not drift: the ordering must survive and the fitted
  // range must be a little narrower than the truth, never wider.
  const shrunk = T.fitBtl(n, comparisons);
  const shrunkOrder = shrunk.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
  assert.deepEqual(shrunkOrder, order, 'the prior must not reorder anything');

  const trueRange = truth[n - 1] - truth[0];
  const slope = (shrunk[n - 1] - shrunk[0]) / trueRange;
  assert.ok(slope > 0.85 && slope < 1.0,
    `regularised slope ${slope.toFixed(3)} should shrink slightly, not collapse or expand`);
});

test('BTL keeps an undefeated item finite instead of diverging', () => {
  const {T} = load();
  // Item 0 beats everyone, item 3 loses to everyone. Unregularised BTL sends
  // these to +/- infinity and the ranking display would break.
  const comparisons = [];
  for (let j = 1; j < 4; j++) {
    for (let rep = 0; rep < 5; rep++) comparisons.push({winner: 0, loser: j});
  }
  for (let i = 1; i < 3; i++) {
    for (let rep = 0; rep < 5; rep++) comparisons.push({winner: i, loser: 3});
  }
  comparisons.push({winner: 1, loser: 2}, {winner: 2, loser: 1});

  const fitted = T.fitBtl(4, comparisons);
  assert.ok(fitted.every(Number.isFinite), `non-finite estimate: ${fitted}`);
  assert.ok(fitted[0] === Math.max(...fitted), 'the undefeated item should rank top');
  assert.ok(fitted[3] === Math.min(...fitted), 'the winless item should rank bottom');
});

test('BTL returns a flat scale when there is no information', () => {
  const {T} = load();
  const fitted = T.fitBtl(5, []);
  assert.ok(fitted.every(Number.isFinite));
  const spread = Math.max(...fitted) - Math.min(...fitted);
  assert.ok(spread < 1e-9, `no comparisons should give a flat scale, got spread ${spread}`);
});

test('BTL is invariant to the order comparisons arrive in', () => {
  const {T} = load();
  const rng = mulberry32(4242);
  const comparisons = [];
  for (let k = 0; k < 200; k++) {
    const i = Math.floor(rng() * 6);
    let j = Math.floor(rng() * 6);
    if (i === j) j = (j + 1) % 6;
    if (rng() < (i > j ? 0.75 : 0.25)) comparisons.push({winner: i, loser: j});
    else comparisons.push({winner: j, loser: i});
  }
  const a = T.fitBtl(6, comparisons);
  const b = T.fitBtl(6, comparisons.slice().reverse());
  for (let i = 0; i < 6; i++) {
    assert.ok(Math.abs(a[i] - b[i]) < 1e-9, `item ${i}: ${a[i]} vs ${b[i]}`);
  }
});

test('connectivity detection is correct', () => {
  const {T} = load();
  assert.ok(T.graphIsConnected(3, [
    {winner: 0, loser: 1}, {winner: 1, loser: 2},
  ]), 'a path should be connected');

  assert.ok(!T.graphIsConnected(4, [
    {winner: 0, loser: 1}, {winner: 2, loser: 3},
  ]), 'two disjoint pairs are not connected');

  assert.ok(!T.graphIsConnected(3, [{winner: 0, loser: 1}]),
    'an isolated item breaks connectivity');

  assert.ok(T.graphIsConnected(1, []), 'a single item is trivially connected');
});

test('biopsy agreement is 1 when the ranking is perfect and 0 when inverted', () => {
  const {T} = load();
  //                      scores               malignant
  assert.equal(T.agreementWithBiopsy([2, 1, 0], [true, false, false]), 1);
  assert.equal(T.agreementWithBiopsy([0, 1, 2], [true, false, false]), 0);
  assert.equal(T.agreementWithBiopsy([1, 1], [true, false]), 0.5, 'a tie is half credit');
  assert.equal(T.agreementWithBiopsy([1, 2], [false, false]), null,
    'no melanoma/nevus pairs means no answer');
});

// ---------------------------------------------------------------------------
// Fidelity to the study
// ---------------------------------------------------------------------------

test('all six conditions exist, at both polarities of three features', () => {
  const {T} = load();
  const keys = Object.keys(T.CONDITIONS);
  assert.equal(keys.length, 6, `expected 6 conditions, got ${keys.join(', ')}`);
  for (const k of ['irregular', 'regular', 'colourful', 'uniform', 'asymmetry', 'symmetry']) {
    assert.ok(T.CONDITIONS[k], `missing condition ${k}`);
  }
  // The reverse-scored ones are exactly those the analysis flips.
  const reversed = keys.filter((k) => T.CONDITIONS[k].reversed).sort();
  assert.deepEqual(reversed, ['regular', 'symmetry', 'uniform']);

  const families = {};
  for (const k of keys) (families[T.CONDITIONS[k].family] ||= []).push(k);
  for (const [family, members] of Object.entries(families)) {
    assert.equal(members.length, 2, `${family} should have both polarities`);
  }
});

test('the question wording is the study\'s, verbatim', () => {
  const {T} = load();
  assert.equal(T.CONDITIONS.irregular.prompt,
    'Which lesion has the more irregular border?');
  assert.equal(T.CONDITIONS.regular.prompt,
    'Which lesion has the more regular border?');
  assert.equal(T.CONDITIONS.colourful.prompt,
    'Which lesion has more colour variation?');
  assert.equal(T.CONDITIONS.uniform.prompt,
    'Which lesion has the more uniform colour?');
  assert.equal(T.CONDITIONS.symmetry.prompt,
    'Which lesion has the more symmetrical shape?');
  assert.equal(T.CONDITIONS.asymmetry.prompt,
    'Which lesion has the more asymmetrical shape?');
  assert.match(T.CONDITIONS.colourful.gloss,
    /Colour variance is the presence of more than one distinct colour\./);
});

test('timing constants match the lab.js study', () => {
  const {T} = load();
  assert.equal(T.ML.onsetStimulusMs, 1500, 'images reveal 1500ms after trial start');
  assert.equal(T.ML.onsetCueMs, 500);
  assert.equal(T.ML.deadlineMs, 10000, '10s after reveal; the study screen times out at 11500');
  assert.equal(T.ML.selectionMs, 500);
  assert.equal(T.ML.fastResponseMs, 300);
  assert.equal(T.ML.imageW, 256);
  assert.equal(T.ML.imageH, 192);
  assert.equal(T.ML.selectedBorder, '#d6341a', 'the study highlights in red, not green');
});

test('images are contained, not stretched', () => {
  // The old demo set a fixed 256x192 with no object-fit, so photographs were
  // distorted -- fatal when the judgment is about shape symmetry and border.
  const source = readFileSync(SRC, 'utf8');
  assert.match(source, /object-fit:\s*contain/);
  assert.ok(!/object-fit:\s*fill/.test(source));
});

test('Z and M respond left and right', () => {
  const {T, getById, docListeners, drain, sandbox} = load({seed: 7});
  getById('ml-condition').value = 'irregular';
  getById('ml-trials').value = '30';
  T.startRun();
  drain(2); // lead-in then reveal

  const keydown = docListeners.keydown[0];
  const run = T.getRun();
  const trial = run.trial;
  sandbox.__clock += 800; // a real response time, above the 300ms floor
  let prevented = false;
  keydown({key: 'z', preventDefault() { prevented = true; }});
  assert.ok(prevented, 'the key must not scroll the host page');
  assert.equal(run.records[0].response, 0, 'z selects the left image');
  assert.equal(run.records[0].endedOn, 'response');
  // Compare fields, not objects: values built inside the VM have a different
  // Object prototype, which strict deepEqual rejects.
  assert.equal(run.comparisons[0].winner, trial.left);
  assert.equal(run.comparisons[0].loser, trial.right);
});

test('a response faster than 300ms is discarded and flagged on the next trial', () => {
  const {T, getById, sandbox, drain} = load({seed: 11});
  getById('ml-condition').value = 'irregular';
  getById('ml-trials').value = '30';
  T.startRun();
  drain(2);

  sandbox.__clock += 150; // under the 300ms floor
  T.respond(0);
  const run = T.getRun();
  assert.equal(run.records[0].endedOn, 'response');
  assert.equal(run.comparisons.length, 0,
    'a too-fast response must not enter the comparison set');
  assert.equal(run.pendingFeedback, 'Too Fast!');

  drain(1); // selection hold -> next trial
  assert.equal(T.els().cue.textContent, 'Too Fast!',
    'the notice shows in the next trial lead-in, as the study does');
});

test('an unanswered trial times out at 10s and is flagged Too Slow', () => {
  const {T, getById, drain} = load({seed: 13});
  getById('ml-condition').value = 'colourful';
  getById('ml-trials').value = '30';
  T.startRun();
  drain(2); // reveal
  const run = T.getRun();
  assert.ok(run.trial.revealedAt !== null);

  drain(1); // deadline
  assert.equal(run.records[0].endedOn, 'timeout');
  assert.equal(run.comparisons.length, 0);
  assert.equal(run.pendingFeedback, 'Too Slow!');
});

test('a response before the images are revealed is ignored', () => {
  const {T, getById, drain} = load({seed: 17});
  getById('ml-condition').value = 'irregular';
  getById('ml-trials').value = '30';
  T.startRun();
  drain(1); // lead-in only; not yet revealed
  const run = T.getRun();
  assert.equal(run.trial.revealedAt, null);
  T.respond(0);
  assert.equal(run.records.length, 0, 'the study swallows pre-reveal responses');
});

test('pair selection covers the pool rather than repeating a few pairs', () => {
  const {T, getById} = load({seed: 23});
  getById('ml-condition').value = 'irregular';
  getById('ml-trials').value = '30';
  T.startRun();
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    const [a, b] = T.pickPair();
    seen.add(a < b ? `${a}-${b}` : `${b}-${a}`);
  }
  // 12 images give 66 possible pairs; least-seen-first should produce 30
  // distinct ones from 30 draws.
  assert.equal(seen.size, 30, `only ${seen.size} distinct pairs in 30 draws`);
});

test('a full run produces a connected graph and a fitted ranking', () => {
  const {T, getById, sandbox, drain} = load({seed: 31});
  getById('ml-condition').value = 'irregular';
  getById('ml-trials').value = '45';
  T.startRun();

  let answered = 0;
  for (let guard = 0; guard < 4000; guard++) {
    const run = T.getRun();
    if (!run) break;
    const trial = run.trial;
    if (trial && trial.revealedAt !== null && !trial.closed) {
      sandbox.__clock += 900;
      // Answer by the embedded malignancy flag, so the ranking should end up
      // tracking the biopsy almost perfectly.
      const leftMal = run.pool[trial.left][1];
      const rightMal = run.pool[trial.right][1];
      T.respond(leftMal >= rightMal ? 0 : 1);
      answered += 1;
    }
    if (drain(1) === 0) break;
  }

  assert.equal(answered, 45);
  assert.equal(T.getRun(), null, 'the run should have ended');

  const html = T.els().overlay.innerHTML;
  assert.match(html, /YOUR SCALE/);
  assert.match(html, /Bradley/);
  assert.match(html, /Comparisons used/);
  assert.ok(!/did not link all/.test(html),
    '45 least-seen-first comparisons over 12 images should connect the graph');
  assert.match(html, /Melanoma ranked above nevus/);
  // A consistent responder should land high; allow room for ties among images
  // of the same class, which carry no information either way.
  const pct = Number(/Melanoma ranked above nevus[\s\S]*?(\d+)%/.exec(html)[1]);
  assert.ok(pct >= 90, `consistent responding gave only ${pct}%`);
});

test('a stale control value cannot take the demo down', () => {
  const {T, getById} = load({seed: 37});
  getById('ml-condition').value = 'not-a-condition';
  getById('ml-trials').value = 'banana';
  T.startRun();
  const run = T.getRun();
  assert.ok(T.CONDITIONS[run.condition], 'falls back to a real condition');
  assert.equal(run.totalTrials, 30, 'falls back to the default trial count');
  assert.equal(run.pool.length, T.ML.poolSize);
});

test('the random condition setting draws from all six', () => {
  const seen = new Set();
  for (let seed = 0; seed < 60; seed++) {
    const {T, getById} = load({seed: seed * 1013});
    getById('ml-condition').value = 'random';
    getById('ml-trials').value = '30';
    T.startRun();
    seen.add(T.getRun().condition);
  }
  assert.equal(seen.size, 6, `only drew ${[...seen].join(', ')}`);
});

test('reverse-scored conditions flip the ranking', () => {
  const {T} = load();
  // Same comparisons, opposite polarity of the same feature, should produce
  // opposite orderings once the analysis flip is applied.
  const comparisons = [
    {winner: 0, loser: 1}, {winner: 0, loser: 1}, {winner: 0, loser: 2},
    {winner: 1, loser: 2}, {winner: 0, loser: 2}, {winner: 1, loser: 2},
  ];
  const raw = T.fitBtl(3, comparisons);
  const forward = raw;
  const reversed = raw.map((v) => -v);
  const topForward = forward.indexOf(Math.max(...forward));
  const topReversed = reversed.indexOf(Math.max(...reversed));
  assert.notEqual(topForward, topReversed);
  assert.equal(topForward, 0);
  assert.equal(topReversed, 2);
});
