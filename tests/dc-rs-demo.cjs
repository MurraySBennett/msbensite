/*
 * Fidelity tests for js/demos/dc-rs.js.
 *
 * The demo is a short version of the perceptual experiment in Gronau, Bennett,
 * Brown, Hawkins & Eidels (2023), Journal of Choice Modelling 49:100437. Its
 * stimuli, timing, response modes and no-feedback rule are meant to be the
 * published ones; docs/demos/dc-rs-fidelity.md carries the sources and the
 * divergences this rebuild closed.
 *
 * Loaded into a VM with DOM stubs; its top-level bindings are re-exposed by one
 * appended line. The source file is never modified.
 *
 * Run: node --test tests/dc-rs-demo.cjs
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = path.join(__dirname, '..', 'js', 'demos', 'dc-rs.js');

// ---------------------------------------------------------------------------
// A DOM stub with enough structure for querySelector by data-attribute,
// classList, and append/innerHTML, since the demo builds its trials in the DOM.
// ---------------------------------------------------------------------------

function makeNode(tag = 'div') {
  const node = {
    tagName: tag.toUpperCase(),
    children: [],
    dataset: {},
    style: {},
    attributes: {},
    _text: '',
    _html: '',
    disabled: false,
    value: '',
    checked: true,
    width: 0,
    height: 0,
    classList: {
      _set: new Set(),
      add(...cs) { cs.forEach((c) => this._set.add(c)); },
      remove(...cs) { cs.forEach((c) => this._set.delete(c)); },
      contains(c) { return this._set.has(c); },
    },
    listeners: {},
    addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); },
    append(...kids) { kids.forEach((k) => { k.parent = node; node.children.push(k); }); },
    get className() { return [...this.classList._set].join(' '); },
    set className(v) {
      this.classList._set = new Set(String(v).split(/\s+/).filter(Boolean));
    },
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); this.children = []; },
    getContext() {
      return {
        createImageData: (w, h) => ({data: new Uint8ClampedArray(w * h * 4)}),
        putImageData() {},
      };
    },
    // Depth-first search over appended children for [data-x="y"].
    querySelector(sel) {
      const m = /^\[data-([a-z-]+)="([^"]*)"\]$/.exec(sel);
      if (!m) return null;
      const key = m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const walk = (n) => {
        for (const kid of n.children) {
          if (kid.dataset[key] === m[2]) return kid;
          const found = walk(kid);
          if (found) return found;
        }
        return null;
      };
      return walk(this);
    },
  };
  return node;
}

function load() {
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

  const sandbox = {
    console, Math, Number, String, Boolean, Array, Object, JSON,
    Int32Array, Uint8ClampedArray,
    parseInt, parseFloat, isNaN,
    performance: {now: () => sandbox.__clock},
    __clock: 0,
    document: {
      getElementById: getById,
      querySelector: (sel) => getById(sel.replace(/^\./, 'class:')),
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
;globalThis.__T = {CR, MODES, RS_LEFT_LABEL, RS_RIGHT_LABEL, EASY_INDICES,
  fillCanvas, shuffled, pickIndices, summarise, startRun, respond,
  getRun: () => run, els: () => els};
`;
  vm.createContext(sandbox);
  new vm.Script(source, {filename: 'dc-rs.js'}).runInContext(sandbox);

  // Drain queued timers in insertion order, advancing a synthetic clock.
  const drain = (maxSteps = 5000) => {
    let steps = 0;
    while (timeouts.size > 0 && steps < maxSteps) {
      const [id, entry] = timeouts.entries().next().value;
      timeouts.delete(id);
      sandbox.__clock += entry.ms;
      entry.fn();
      steps += 1;
    }
    return steps;
  };

  return {T: sandbox.__T, getById, sandbox, timeouts, drain};
}

const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

// ---------------------------------------------------------------------------

test('stimulus proportions are the v2 set that was actually run', () => {
  const {T} = load();
  // readAll.m:29-30 records v1 (0.45 .. 0.55) as superseded. The old demo
  // shipped v1, making every discrimination twice as easy as the study's.
  assert.deepEqual([...T.CR.proportions], [0.475, 0.4875, 0.5, 0.5125, 0.525]);
  const steps = [];
  for (let i = 1; i < T.CR.proportions.length; i++) {
    steps.push(T.CR.proportions[i] - T.CR.proportions[i - 1]);
  }
  assert.ok(steps.every((s) => near(s, 0.0125, 1e-9)),
    `uneven steps: ${steps.join(', ')}`);
});

test('timing constants match the lab.js study', () => {
  const {T} = load();
  assert.equal(T.CR.fixationMs, 200);
  assert.equal(T.CR.blankBeforeMs, 0);
  assert.equal(T.CR.deadlineMs, 7000, 'the 7s response deadline is load-bearing');
  assert.equal(T.CR.blankAfterMs, 700);
  assert.equal(T.CR.feedbackMs, 500);
  assert.equal(T.CR.practiceFeedbackMs, 2000);
  assert.equal(T.CR.minValidRtMs, 200, "readAll.m's RT exclusion");
  assert.equal(T.CR.canvasSize, 200);
  assert.equal(T.CR.nSquares, 3);
});

test('the rating scale wording is the study\'s, not the health study\'s', () => {
  const {T} = load();
  // The old demo used "Definitely NOT the darkest" / "Definitely the darkest",
  // which is the health study's symmetric pattern. The perceptual study's scale
  // is a confidence scale and is asymmetric.
  assert.equal(T.RS_LEFT_LABEL, 'Certainly NOT the darkest');
  assert.equal(T.RS_RIGHT_LABEL, 'Extremely confident this is the darkest');
});

test('the demo does not call itself a discrete choice experiment', () => {
  const source = readFileSync(SRC, 'utf8');
  // The paper's terms are CT and RS; the authors explicitly qualify that their
  // CT "differed in a few important ways" from a DCE.
  const participantFacing = source
    .split('\n')
    .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
    .join('\n');
  assert.ok(!/[Dd]iscrete [Cc]hoice/.test(participantFacing),
    'participant-facing text must not say "discrete choice"');
  assert.ok(/Choice task \(CT\)/.test(source));
  assert.ok(/Rating scale \(RS\)/.test(source));
});

test('practice uses the widely separated levels, test trials use all five', () => {
  const {T} = load();
  assert.deepEqual([...T.EASY_INDICES], [0, 2, 4]);

  for (let i = 0; i < 50; i++) {
    const practice = T.pickIndices(true);
    assert.equal(practice.length, 3);
    assert.equal(new Set(practice).size, 3, 'three distinct levels');
    assert.ok(practice.every((ix) => T.EASY_INDICES.includes(ix)),
      `practice drew ${practice}`);
  }

  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    const trial = T.pickIndices(false);
    assert.equal(new Set(trial).size, 3, 'no repeated level within a trial');
    trial.forEach((ix) => seen.add(ix));
  }
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3, 4],
    'test trials must reach every level, including the adjacent hard pairs');
});

test('a trial can present an adjacent pair, i.e. the hardest discrimination', () => {
  const {T} = load();
  let sawAdjacent = false;
  for (let i = 0; i < 500 && !sawAdjacent; i++) {
    const trial = T.pickIndices(false).slice().sort();
    for (let j = 1; j < trial.length; j++) {
      if (trial[j] - trial[j - 1] === 1) sawAdjacent = true;
    }
  }
  assert.ok(sawAdjacent, 'the 0.0125 discrimination must be reachable');
});

test('fillCanvas blackens exactly the requested proportion, without repeats', () => {
  const {T} = load();
  const size = T.CR.canvasSize;
  const total = size * size;

  for (const prop of [...T.CR.proportions]) {
    const canvas = {
      width: size, height: size,
      getContext: () => ({
        createImageData: (w, h) => ({data: new Uint8ClampedArray(w * h * 4).fill(0)}),
        putImageData(image) { canvas._out = image; },
      }),
    };
    T.fillCanvas(canvas, prop);
    const data = canvas._out.data;
    let black = 0;
    let white = 0;
    for (let px = 0; px < total; px++) {
      const i = px * 4;
      assert.equal(data[i + 3], 255, 'every pixel must be opaque');
      if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0) black += 1;
      else if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) white += 1;
    }
    assert.equal(black, parseInt(prop * total, 10),
      `proportion ${prop} should blacken ${parseInt(prop * total, 10)} pixels`);
    assert.equal(black + white, total, 'pixels must be pure black or pure white');
  }
});

test('darker proportions really do produce more black pixels', () => {
  const {T} = load();
  const count = (prop) => {
    const size = T.CR.canvasSize;
    const canvas = {
      getContext: () => ({
        createImageData: (w, h) => ({data: new Uint8ClampedArray(w * h * 4)}),
        putImageData(image) { canvas._out = image; },
      }),
    };
    T.fillCanvas(canvas, prop);
    let black = 0;
    const d = canvas._out.data;
    for (let px = 0; px < size * size; px++) if (d[px * 4] === 0) black += 1;
    return black;
  };
  const props = [...T.CR.proportions];
  const counts = props.map(count);
  for (let i = 1; i < counts.length; i++) {
    assert.ok(counts[i] > counts[i - 1],
      `proportion ${props[i]} gave ${counts[i]}, not more than ${counts[i - 1]}`);
  }
});

test('a choice run gives feedback in practice and withholds it in the test phase', () => {
  // The study's experiment instructions say, in both arms, "There will be no
  // feedback provided in this experiment". The old demo showed correct/incorrect
  // on every trial, which turns a judgment task into a learning task.
  const {T, getById, sandbox, drain} = load();
  getById('cr-mode').value = 'ct';
  getById('cr-trials').value = '12';
  getById('cr-practice').checked = true;

  T.startRun();
  const feedbackByPhase = {practice: 0, test: 0};
  const trialsByPhase = {practice: 0, test: 0};

  // Step the sequence, answering each trial as soon as a stimulus is up. The
  // practice -> test handover waits on a Continue click, so fire that too.
  const clickContinue = () => {
    const button = getById('cr-continue');
    const handlers = button.listeners.click || [];
    if (handlers.length === 0) return false;
    button.listeners.click = [];
    handlers.forEach((fn) => fn());
    return true;
  };

  for (let guard = 0; guard < 4000; guard++) {
    const run = T.getRun();
    if (!run) break;
    const trial = run.trial;
    if (trial && trial.shownAt !== null && !trial.closed) {
      trialsByPhase[trial.phase] += 1;
      sandbox.__clock += 400; // a plausible RT, above the 200ms floor
      T.respond(trial.darkest); // always correct
      const row = T.els().row;
      const label = row.querySelector(`[data-feedback-for="${trial.darkest}"]`);
      if (label && label.classList.contains('cr-shown')) {
        feedbackByPhase[trial.phase] += 1;
      }
    }
    if (drain(1) === 0 && !clickContinue()) break;
  }

  assert.ok(trialsByPhase.practice > 0, 'practice trials should have run');
  assert.ok(trialsByPhase.test > 0, 'test trials should have run');
  assert.equal(feedbackByPhase.practice, trialsByPhase.practice,
    'every practice trial should show the "Darkest" label');
  assert.equal(feedbackByPhase.test, 0,
    'no test trial may show feedback');
});

test('an unanswered trial times out at the deadline and is recorded as such', () => {
  const {T, getById, drain} = load();
  getById('cr-mode').value = 'ct';
  getById('cr-trials').value = '12';
  getById('cr-practice').checked = false;

  T.startRun();
  drain(2); // fixation -> blank -> stimulus is now up
  const run = T.getRun();
  assert.ok(run.trial.shownAt !== null, 'a stimulus should be showing');
  assert.equal(run.trial.response, null);

  drain(1); // fire the deadline
  assert.equal(run.records[0].endedOn, 'timeout');
  assert.equal(run.records[0].response, null);
  assert.equal(run.records[0].rt, null);
});

test('a click after the deadline cannot overwrite or duplicate the record', () => {
  // The squares stay on screen through the feedback hold, so a late click is
  // reachable in the browser. Before this was fixed it mutated the recorded
  // trial and pushed a second copy of it.
  const {T, getById, sandbox, drain} = load();
  getById('cr-mode').value = 'ct';
  getById('cr-trials').value = '12';
  getById('cr-practice').checked = false;

  T.startRun();
  drain(2);
  const run = T.getRun();
  const darkest = run.trial.darkest;
  drain(1); // deadline fires

  assert.equal(run.records.length, 1);
  sandbox.__clock += 50;
  T.respond(darkest); // a late click

  assert.equal(run.records.length, 1, 'no duplicate record');
  assert.equal(run.records[0].endedOn, 'timeout', 'still a timeout');
  assert.equal(run.records[0].response, null, 'response must stay null');
});

test('the rating scale marks a square before the response, and records its rating', () => {
  const {T, getById, sandbox, drain} = load();
  getById('cr-mode').value = 'rs';
  getById('cr-trials').value = '12';
  getById('cr-practice').checked = false;

  T.startRun();
  // Exactly two timers to reach the stimulus: fixation, then the pre-stimulus
  // blank. A third would fire the 7s deadline.
  drain(2);
  const run = T.getRun();
  const trial = run.trial;
  assert.ok(trial.shownAt !== null, 'the stimulus should be up');

  assert.ok(trial.which !== null && trial.which >= 0 && trial.which < 3,
    'RS must mark exactly one square');
  const marker = T.els().row.querySelector(`[data-marker-for="${trial.which}"]`);
  assert.ok(marker && marker.classList.contains('cr-shown'),
    'the marker must be visible before the response, not after');

  // The marker is shown independently of which square is actually darkest.
  assert.ok(T.CR.nSquares === 3);

  sandbox.__clock += 500;
  T.respond(6);
  assert.equal(run.records[0].response, 6);
  assert.ok(near(run.records[0].rt, 500, 1e-6));
  assert.equal(run.records[0].endedOn, 'response');
});

test('the scale offers 7 points with no default selection', () => {
  const {T} = load();
  const points = T.els().points;
  assert.equal(points.children.length, 7);
  assert.deepEqual(points.children.map((b) => b.dataset.rating),
    ['1', '2', '3', '4', '5', '6', '7']);
  assert.ok(points.children.every((b) => !b.classList.contains('cr-selected')),
    'no point may be preselected');
});

test('the summary excludes practice, timeouts and sub-200ms responses', () => {
  const {T} = load();
  const records = [
    {phase: 'practice', endedOn: 'response', rt: 500},
    {phase: 'test', endedOn: 'response', rt: 500},
    {phase: 'test', endedOn: 'response', rt: 600},
    {phase: 'test', endedOn: 'timeout', rt: null},
    {phase: 'test', endedOn: 'response', rt: 150}, // under the 200ms floor
  ];
  const {test: testTrials, answered, timeouts} = T.summarise(records);
  assert.equal(testTrials.length, 4, 'practice must not count');
  assert.equal(answered.length, 2, 'timeout and fast response must be excluded');
  assert.equal(timeouts, 1);
});

test('a stale control value cannot take the demo down', () => {
  const {T, getById} = load();
  getById('cr-mode').value = 'not-a-mode';
  getById('cr-trials').value = 'banana';
  getById('cr-practice').checked = false;
  T.startRun();
  const run = T.getRun();
  assert.ok(T.MODES[run.mode], 'falls back to a real mode');
  assert.equal(run.testTrials, 12, 'falls back to the default trial count');
});

test('practice can be turned off, and then no trial shows feedback', () => {
  const {T, getById, sandbox, drain} = load();
  getById('cr-mode').value = 'ct';
  getById('cr-trials').value = '12';
  getById('cr-practice').checked = false;

  T.startRun();
  assert.equal(T.getRun().phase, 'test');
  assert.equal(T.getRun().practiceTrials, 0);

  let shown = 0;
  let answered = 0;
  for (let guard = 0; guard < 2000; guard++) {
    const run = T.getRun();
    if (!run) break;
    const trial = run.trial;
    if (trial && trial.shownAt !== null && trial.response === null) {
      answered += 1;
      sandbox.__clock += 400;
      T.respond(trial.darkest);
      const label = T.els().row.querySelector(`[data-feedback-for="${trial.darkest}"]`);
      if (label && label.classList.contains('cr-shown')) shown += 1;
    }
    if (drain(1) === 0) break;
  }
  assert.ok(answered > 0);
  assert.equal(shown, 0);
});

test('a full choice run reaches a summary reporting accuracy and time', () => {
  const {T, getById, sandbox, drain} = load();
  getById('cr-mode').value = 'ct';
  getById('cr-trials').value = '12';
  getById('cr-practice').checked = false;

  T.startRun();
  let answered = 0;
  for (let guard = 0; guard < 3000; guard++) {
    const run = T.getRun();
    if (!run) break;
    const trial = run.trial;
    if (trial && trial.shownAt !== null && trial.response === null) {
      sandbox.__clock += 450;
      T.respond(trial.darkest);
      answered += 1;
    }
    if (drain(1) === 0) break;
  }

  assert.equal(answered, 12, 'all 12 test trials should have run');
  assert.equal(T.getRun(), null, 'the run should have ended');
  const overlay = T.els().overlay;
  assert.ok(!overlay.classList.contains('cr-hidden'));
  assert.match(overlay.innerHTML, /DONE/);
  assert.match(overlay.innerHTML, /Correct/);
  assert.match(overlay.innerHTML, /100%/, 'always picking the darkest is 100% correct');
  assert.match(overlay.innerHTML, /450 ms/);
});

test('a full rating run reports the separation between marked-correct and not', () => {
  const {T, getById, sandbox, drain} = load();
  getById('cr-mode').value = 'rs';
  getById('cr-trials').value = '24';
  getById('cr-practice').checked = false;

  T.startRun();
  for (let guard = 0; guard < 6000; guard++) {
    const run = T.getRun();
    if (!run) break;
    const trial = run.trial;
    if (trial && trial.shownAt !== null && trial.response === null) {
      sandbox.__clock += 500;
      // A perfect rater: 7 when the marked square is darkest, 1 when not.
      T.respond(trial.which === trial.darkest ? 7 : 1);
    }
    if (drain(1) === 0) break;
  }

  assert.equal(T.getRun(), null);
  const html = T.els().overlay.innerHTML;
  assert.match(html, /Separation/);
  assert.match(html, /6\.00 scale points/,
    'a perfect rater separates the two cases by the full 7-1 range');
});
