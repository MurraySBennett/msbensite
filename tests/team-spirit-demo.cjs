/*
 * Fidelity tests for js/demos/team-spirit-hh.js.
 *
 * The demo is an abridged, single-player version of the task in Bennett et al.
 * (2025), Topics in Cognitive Science 17(2) 324-348. Its geometry, physics,
 * scoring and secondary-task timing are meant to be the published values, so
 * those are what these tests pin. The published sources for each number are in
 * docs/demos/team-spirit-spec.md; the divergences this rebuild closed are in
 * docs/demos/team-spirit-fidelity.md.
 *
 * The demo is a classic browser script with no exports, so it is loaded into a
 * VM with DOM stubs and its top-level bindings re-exposed by one appended line.
 * The source file is never modified.
 *
 * Run: node --test tests/team-spirit-demo.cjs
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = path.join(__dirname, '..', 'js', 'demos', 'team-spirit-hh.js');

// ---------------------------------------------------------------------------
// Load the demo under DOM stubs
// ---------------------------------------------------------------------------

/*
 * mulberry32. Used to replace Math.random inside the VM so that the agent
 * calibration below is exactly reproducible — launch angles are the only
 * stochastic input, and leaving them free made that test fail about one run in
 * five on unchanged code.
 */
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

function load({seed} = {}) {
  const stubCtx = new Proxy({}, {get: () => () => {}, set: () => true});
  const elements = new Map();
  const makeEl = (id) => ({
    id, value: '', checked: true, textContent: '', innerHTML: '', style: {},
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      contains(c) { return this._set.has(c); },
    },
    addEventListener() {},
    getContext: () => stubCtx,
  });
  const byId = (id) => {
    if (!elements.has(id)) elements.set(id, makeEl(id));
    return elements.get(id);
  };

  const docListeners = {};
  const winListeners = {};
  const raf = {queue: []};

  // Object.create so the shadowed random does not leak onto the host Math.
  let mathForVm = Math;
  if (seed !== undefined) {
    mathForVm = Object.create(Math);
    mathForVm.random = mulberry32(seed);
  }

  const sandbox = {
    console, Math: mathForVm, Number, String, Boolean, Array, Object, JSON,
    document: {
      getElementById: byId,
      addEventListener: (ev, fn) => { docListeners[ev] = fn; },
    },
    window: {addEventListener: (ev, fn) => { winListeners[ev] = fn; }},
    requestAnimationFrame: (fn) => raf.queue.push(fn),
    cancelAnimationFrame: () => { raf.queue = []; },
  };
  sandbox.globalThis = sandbox;

  const source = readFileSync(SRC, 'utf8') + `
;globalThis.__T = {TS, Ball, Paddle, Drt, traceIntercept, botTargetX, applyHit,
  applyMiss, spawnBalls, newRun, startTrial, CONDITIONS, WORKLOADS,
  getRun: () => run, setRun: (v) => { run = v; }};
`;
  vm.createContext(sandbox);
  new vm.Script(source, {filename: 'team-spirit-hh.js'}).runInContext(sandbox);
  return {T: sandbox.__T, byId, docListeners, winListeners, raf};
}

const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const deg = (d) => (d * Math.PI) / 180;

// ---------------------------------------------------------------------------

test('geometry and timing constants are the published values, not the paper\'s', () => {
  const {T} = load();
  const TS = T.TS;
  // The paper's figures are rounded and its ball radius is wrong by ~2x; these
  // come from paddleGame.html:316-343 and game_qlearning.py:110-136.
  assert.equal(TS.drtWidth, 800);
  assert.equal(TS.frameHeight, 600);
  assert.equal(TS.frameLeft, 40);
  assert.equal(TS.frameRight, 760);
  assert.equal(TS.pWidth, 72);
  assert.ok(near(TS.pHeight, 8.64));
  assert.ok(near(TS.paddleY, 574.08));
  assert.ok(near(TS.bRad, 7.776));
  assert.ok(near(TS.ballY, 566.304));
  // Spread into a host array: values built inside the VM have a different
  // Array prototype, which strict deepEqual rejects.
  assert.deepEqual([...TS.ballX], [368.896, 400, 431.104]);
  assert.equal(TS.p1Start, 228);
  assert.equal(TS.p2Start, 536);
  assert.ok(near(TS.missPlane, 596.112));

  // 4px per nominal 20ms frame for both ball and paddle, i.e. 200px/s.
  assert.equal(TS.pSpeed, 4);
  assert.equal(TS.bSpeed, 4);
  assert.equal(TS.tickMs, 20);

  // DRT: uniform 3-5s onset-to-onset, 1s display, 2.5s window, 100ms RT floor.
  assert.equal(TS.drtMinIsi, 3);
  assert.equal(TS.drtMaxIsi, 5);
  assert.equal(TS.drtDisplay, 1);
  assert.equal(TS.drtRespWindow, 2.5);
  assert.equal(TS.drtMinRt, 0.1);

  // The published 1.2s agent horizon and 80 location bins.
  assert.equal(TS.botHorizonMs, 1200);
  assert.equal(TS.botBins, 80);
  assert.equal(TS.botConsiderateRadius, 100);

  assert.deepEqual([...T.WORKLOADS].map((w) => w.ballsPerPlayer), [1, 3, 6, 9]);
});

test('balls spawn at the paddle line, launching upward between 45 and 135 degrees', () => {
  const {T} = load();
  const TS = T.TS;
  const balls = T.spawnBalls(3);
  assert.equal(balls.length, 6, 'n per player means 2n on screen');
  assert.ok(balls.slice(0, 3).every((b) => b.owner === 'p1'));
  assert.ok(balls.slice(3).every((b) => b.owner === 'p2'));
  assert.ok(balls.every((b) => near(b.y, TS.ballY)));
  assert.ok(balls.every((b) => Math.sin(b.angle) < 0), 'all launch upward');
  for (const b of balls) {
    const d = (-b.angle * 180) / Math.PI;
    assert.ok(d >= 45 && d <= 135, `launch angle ${d.toFixed(1)}deg out of range`);
  }
  assert.ok(balls.every((b) => TS.ballX.some((x) => near(b.x, x))));
});

test('a missed ball wraps to the top and is counted, not deleted', () => {
  // This is the divergence that made the old demo unable to produce the
  // paper's primary measure at all.
  const {T} = load();
  const TS = T.TS;
  const state = T.newRun('col', 0, 'simple', false);
  const ball = state.balls[0];
  ball.x = 400;
  ball.y = TS.paddleY + 15;
  ball.angle = Math.PI / 2; // straight down
  state.paddle1.x = 100;
  state.paddle2.x = 600;

  let missed = false;
  for (let i = 0; i < 40 && !missed; i++) {
    const ev = ball.step(20, state.paddle1, state.paddle2, 'col');
    if (ev.missed) { missed = true; T.applyMiss(state, ball); }
  }
  assert.ok(missed, 'a ball past the paddle must report a miss');
  assert.ok(ball.y < TS.frameTop + 30, `re-entered at y=${ball.y.toFixed(2)}`);
  assert.ok(Math.sin(ball.angle) > 0, 'keeps its downward trajectory');
  assert.equal(state.balls.length, 2, 'ball count is constant within a trial');
  assert.equal(state.misses1, 1);
});

test('a miss is charged to the ball owner when separate, to both otherwise', () => {
  const {T} = load();
  const sep = T.newRun('nonCol', 0, 'simple', false);
  T.applyMiss(sep, sep.balls.find((b) => b.owner === 'p1'));
  T.applyMiss(sep, sep.balls.find((b) => b.owner === 'p2'));
  assert.equal(sep.misses1, 1, 'only my own ball counts against me');

  const team = T.newRun('col', 0, 'simple', false);
  T.applyMiss(team, team.balls.find((b) => b.owner === 'p2'));
  assert.equal(team.misses1, 1, 'a team miss is charged to both players');
});

test('centre contact reflects without deviation; edge contact steers outward', () => {
  const {T} = load();
  const TS = T.TS;
  const state = T.newRun('col', 0, 'simple', false);
  state.paddle2.x = 700;
  state.paddle1.x = 400 - TS.pWidth / 2;

  // impact = x + bRad/2 - (paddleX + pWidth/2); the asymmetric bRad/2 term is
  // in the original (paddleGame.html:443) and is kept deliberately.
  const ball = state.balls[0];
  ball.x = 400 - TS.bRad / 2;
  ball.y = TS.paddleY - TS.bRad - 1;
  ball.angle = Math.PI / 2;
  ball.hitLatch = false;
  const ev = ball.step(20, state.paddle1, state.paddle2, 'col');
  assert.equal(ev.hitBy, 'p1');
  assert.ok(near(ball.angle, -Math.PI / 2, 1e-9),
    `centre contact deviated to ${((ball.angle * 180) / Math.PI).toFixed(3)}deg`);

  const edge = state.balls[1];
  edge.x = state.paddle1.x + TS.pWidth;
  edge.y = TS.paddleY - TS.bRad - 1;
  edge.angle = Math.PI / 2;
  edge.hitLatch = false;
  edge.step(20, state.paddle1, state.paddle2, 'col');
  assert.ok(Math.cos(edge.angle) > 0 && Math.sin(edge.angle) < 0,
    'right-edge contact must send the ball up and to the right');
  // The hit window extends bRad past each paddle edge, so the contact
  // proportion can exceed 1. That is the original's behaviour, not a defect.
  const ceiling = (TS.pWidth / 2 + TS.bRad + TS.bRad / 2) / (TS.pWidth / 2) / 2;
  assert.ok(Math.abs(edge.angle + Math.PI / 2) <= ceiling + 1e-9);
});

test('the 155/35 rule is a fallback to pure reflection, not an angle clamp', () => {
  const {T} = load();
  const TS = T.TS;
  const state = T.newRun('col', 0, 'simple', false);
  state.paddle1.x = 400 - TS.pWidth / 2;
  const ball = state.balls[0];
  ball.x = state.paddle1.x + TS.pWidth; // large positive offset
  ball.angle = deg(30); // shallow, so offset would make it near-horizontal
  assert.ok(near(ball.deflect(state.paddle1.x), -ball.angle, 1e-12),
    'should revert to -angle rather than clamp to the boundary');
});

test('separate condition: the partner\'s ball passes through my paddle', () => {
  const {T} = load();
  const TS = T.TS;
  const place = (state, ball) => {
    state.paddle1.x = 400 - TS.pWidth / 2;
    state.paddle2.x = 100;
    ball.x = 400;
    ball.y = TS.paddleY - TS.bRad - 1;
    ball.angle = Math.PI / 2;
    ball.hitLatch = false;
  };

  const sep = T.newRun('nonCol', 0, 'simple', false);
  const theirs = sep.balls.find((b) => b.owner === 'p2');
  place(sep, theirs);
  const ev = theirs.step(20, sep.paddle1, sep.paddle2, 'nonCol');
  assert.equal(ev.hitBy, null, 'wrong-coloured ball must not deflect');
  assert.ok(Math.sin(theirs.angle) > 0, 'and must keep descending');

  // The identical geometry in a team condition must hit, proving the
  // pass-through is condition logic and not a collision bug.
  const team = T.newRun('col', 0, 'simple', false);
  place(team, team.balls[0]);
  assert.equal(team.balls[0].step(20, team.paddle1, team.paddle2, 'col').hitBy, 'p1');
});

test('a ball touching both paddles pays half a point to each', () => {
  const {T} = load();
  const TS = T.TS;
  const state = T.newRun('col', 0, 'simple', false);
  const ball = state.balls[0];
  state.paddle1.x = 400 - TS.pWidth / 2;
  state.paddle2.x = 400 - TS.pWidth / 2;
  ball.x = 400;
  ball.y = TS.paddleY - TS.bRad - 1;
  ball.angle = Math.PI / 2;
  ball.hitLatch = false;
  const ev = ball.step(20, state.paddle1, state.paddle2, 'col');
  assert.equal(ev.hitBy, 'both');
  T.applyHit(state, 'both');
  assert.equal(state.score1, 0.5);
  assert.equal(state.score2, 0.5);
});

test('scoring awards the hitter in separate and competitive conditions', () => {
  const {T} = load();
  const sep = T.newRun('nonCol', 0, 'simple', false);
  T.applyHit(sep, 'p1');
  assert.deepEqual([sep.score1, sep.score2], [1, 0]);

  const com = T.newRun('com', 0, 'simple', false);
  T.applyHit(com, 'p2');
  assert.deepEqual([com.score1, com.score2], [0, 1]);
});

test('paddles cannot enter the DRT panels', () => {
  const {T} = load();
  const TS = T.TS;
  const p = new T.Paddle(TS.p1Start);
  p.moveBy(-10000);
  assert.equal(p.x, TS.frameLeft);
  p.moveBy(10000);
  assert.equal(p.x, TS.frameRight - TS.pWidth);
});

test('the agent predicts intercepts and honours the published 1.2s horizon', () => {
  const {T} = load();
  const TS = T.TS;
  const drop = (y, x = 400) => {
    const b = new T.Ball(0, x, Math.PI / 2, null);
    b.y = y;
    return T.traceIntercept(b);
  };

  const soon = drop(480);
  assert.ok(soon, 'a ball 86px above the paddle line must be predicted');
  assert.ok(Math.abs(soon.x - 400) < 1, 'a vertical drop intercepts below itself');
  assert.ok(soon.proximity > 0 && soon.proximity <= 1);
  assert.ok(drop(540).proximity > drop(400).proximity,
    'a nearer ball must read as more imminent');

  // At 200px/s the horizon covers ~240px. Anything further is invisible, and
  // that limit is exactly what stops the agent being an optimal performer.
  assert.equal(drop(100), null, 'a ball 466px away is beyond the horizon');

  const state = T.newRun('col', 2, 'simple', false);
  state.balls.forEach((b) => { b.y = 100; b.angle = Math.PI / 2; b.x = 200; });
  const parked = T.botTargetX(state.balls, 'col', 'simple', 600);
  const centre = (TS.frameLeft + TS.frameRight) / 2;
  assert.ok(Math.abs(parked + TS.pWidth / 2 - centre) < 10,
    'with nothing in horizon the agent parks mid-court');
});

test('the agent moves toward the ball it can reach', () => {
  const {T} = load();
  const TS = T.TS;
  const state = T.newRun('col', 2, 'simple', false);
  state.balls.forEach((b) => { b.y = 50; b.angle = -Math.PI / 2; b.x = 400; });
  state.balls[0].x = 200;
  state.balls[0].y = 480;
  state.balls[0].angle = Math.PI / 2;
  const target = T.botTargetX(state.balls, 'col', 'simple', 600);
  assert.ok(Math.abs(target + TS.pWidth / 2 - 200) < 40,
    `agent aimed at ${(target + TS.pWidth / 2).toFixed(1)}, ball is at 200`);
});

test('separate condition: the agent ignores the human\'s balls', () => {
  const {T} = load();
  const TS = T.TS;
  const state = T.newRun('nonCol', 1, 'simple', false);
  state.balls.forEach((b) => {
    b.x = 150;
    b.y = b.owner === 'p1' ? 480 : 50;
    b.angle = b.owner === 'p1' ? Math.PI / 2 : -Math.PI / 2;
  });
  const target = T.botTargetX(state.balls, 'nonCol', 'simple', 600);
  const centre = (TS.frameLeft + TS.frameRight) / 2;
  assert.ok(Math.abs(target + TS.pWidth / 2 - centre) < 10,
    'must not chase a ball it is not allowed to hit');
});

test('the considerate agent clears 100px around the human, only when collaborating', () => {
  const {T} = load();
  const TS = T.TS;
  const state = T.newRun('col', 0, 'simple', false);
  state.balls.forEach((b) => { b.y = 50; b.angle = -Math.PI / 2; b.x = 400; });
  state.balls[0].x = 300;
  state.balls[0].y = 480;
  state.balls[0].angle = Math.PI / 2;

  const human = 300 - TS.pWidth / 2;
  const centreOf = (target) => target + TS.pWidth / 2;

  assert.ok(Math.abs(centreOf(T.botTargetX(state.balls, 'col', 'simple', human)) - 300) < 40,
    'the simple agent contests the same ball');

  const considerate = centreOf(T.botTargetX(state.balls, 'col', 'considerate', human));
  assert.ok(considerate < human - TS.botConsiderateRadius ||
            considerate > human + TS.pWidth + TS.botConsiderateRadius,
    `considerate agent sat at ${considerate.toFixed(1)}, human paddle at ${human.toFixed(1)}`);

  assert.ok(Math.abs(centreOf(T.botTargetX(state.balls, 'com', 'considerate', human)) - 300) < 40,
    'the exclusion must not apply while competing');
});

test('DRT timing, scoring and false alarms follow the published parameters', () => {
  const {T} = load();

  const drt = new T.Drt(true);
  drt.onsetAt = 5.0;
  drt.update(4.9);
  assert.equal(drt.lit, false, 'dark before onset');
  drt.update(5.2);
  assert.equal(drt.lit, true, 'lit during the 1s display');
  drt.update(6.2);
  assert.equal(drt.lit, false, 'dark after 1s');

  // Responses are accepted for 2.5s from onset, i.e. past the display.
  assert.equal(drt.respond(6.4), true);
  assert.equal(drt.hits, 1);
  assert.ok(near(drt.rts[0], 1.4, 1e-9));
  drt.update(7.6);
  assert.equal(drt.misses, 0);
  // The interval is onset-to-onset, not measured from the window closing.
  assert.ok(drt.onsetAt >= 8 && drt.onsetAt <= 10,
    `next onset at ${drt.onsetAt.toFixed(2)}, expected 8-10`);

  const unanswered = new T.Drt(true);
  unanswered.onsetAt = 1.0;
  unanswered.update(1.2);
  unanswered.update(3.6);
  assert.equal(unanswered.misses, 1);

  const stray = new T.Drt(true);
  stray.onsetAt = 10.0;
  assert.equal(stray.respond(2.0), false);
  assert.equal(stray.falseAlarms, 1);
  assert.equal(stray.hits, 0);

  const tooFast = new T.Drt(true);
  tooFast.onsetAt = 1.0;
  assert.equal(tooFast.respond(1.05), false, 'under the 100ms floor');
  assert.equal(tooFast.falseAlarms, 1);

  const doubleTap = new T.Drt(true);
  doubleTap.onsetAt = 1;
  doubleTap.respond(1.5);
  doubleTap.respond(1.6);
  assert.equal(doubleTap.hits, 1);
  assert.equal(doubleTap.falseAlarms, 1);

  const off = new T.Drt(false);
  off.update(100);
  assert.deepEqual([off.hits, off.misses, off.lit], [0, 0, false]);

  const summary = new T.Drt(true);
  summary.hits = 3;
  summary.misses = 1;
  summary.rts = [0.4, 0.6];
  assert.ok(near(summary.accuracy, 0.75));
  assert.ok(near(summary.meanRt, 0.5));
});

test('a full trial runs to completion and reports a miss rate', () => {
  const {T, byId, raf} = load();
  const TS = T.TS;
  byId('ts-condition').value = 'col';
  byId('ts-workload').value = '2'; // high: 6 per player
  byId('ts-partner').value = 'considerate';
  byId('ts-drt').checked = true;

  raf.queue = [];
  T.startTrial();
  const state = T.getRun();
  assert.equal(state.balls.length, 12);
  assert.ok(byId('ts-overlay').classList.contains('ts-hidden'));

  let now = 1000;
  let frames = 0;
  while (raf.queue.length > 0 && frames < 4000) {
    const fn = raf.queue.shift();
    now += 16.7;
    frames += 1;
    fn(now);
  }
  assert.equal(raf.queue.length, 0, 'the loop must stop on its own');
  assert.ok(Math.abs((frames * 16.7) / 1000 - TS.trialSeconds) < 1,
    `ran ${((frames * 16.7) / 1000).toFixed(2)}s, expected ${TS.trialSeconds}s`);
  assert.equal(T.getRun(), null);

  const overlay = byId('ts-overlay');
  assert.ok(!overlay.classList.contains('ts-hidden'));
  assert.match(overlay.innerHTML, /TRIAL OVER/);
  assert.match(overlay.innerHTML, /miss rate/);
  assert.match(overlay.innerHTML, /lights/);

  assert.ok(state.hits1 > 0, 'the player paddle should be hittable');
  assert.ok(state.misses1 > 0, 'high workload should produce misses');
  assert.ok(state.score2 > 0, 'the agent should score');
  assert.equal(state.balls.length, 12, 'ball count constant across the trial');
  assert.ok(state.balls.every((b) =>
    b.x >= TS.frameLeft - 1 && b.x <= TS.frameRight + 1 &&
    b.y >= -1 && b.y <= TS.missPlane + 1), 'no ball escaped the playfield');
  assert.ok(state.paddle2.x >= TS.frameLeft &&
            state.paddle2.x <= TS.frameRight - TS.pWidth);

  const lights = state.drt.hits + state.drt.misses;
  const period = TS.trialSeconds / lights;
  assert.ok(period > 2.5 && period < 6,
    `${period.toFixed(2)}s between lights, expected roughly 3-5`);
});

test('keyboard input matches the published right-handed mapping', () => {
  const {T, docListeners, winListeners, raf} = load();
  raf.queue = [];
  T.startTrial();
  const state = T.getRun();

  docListeners.keydown({code: 'ArrowLeft', preventDefault() {}});
  assert.equal(state.leftHeld, true);
  docListeners.keyup({code: 'ArrowLeft'});
  assert.equal(state.leftHeld, false);

  docListeners.keydown({code: 'ArrowRight', preventDefault() {}});
  winListeners.blur();
  assert.equal(state.rightHeld, false, 'losing focus must release held keys');

  // Z is the DRT key and a correct response is worth a bonus point.
  state.drt.onsetAt = state.elapsed - 0.5;
  state.drt.responded = false;
  const before = state.score1;
  docListeners.keydown({code: 'KeyZ', preventDefault() {}});
  assert.equal(state.score1, before + 1);

  let prevented = false;
  docListeners.keydown({code: 'ArrowLeft', preventDefault() { prevented = true; }});
  assert.ok(prevented, 'arrows must not scroll the host page');

  T.setRun(null);
  raf.queue = [];
  let spacePrevented = false;
  docListeners.keydown({code: 'Space', preventDefault() { spacePrevented = true; }});
  assert.ok(spacePrevented);
  assert.ok(T.getRun(), 'space starts a trial when idle');
});

test('a stale control value cannot take the demo down', () => {
  const {T, byId} = load();
  byId('ts-condition').value = 'not-a-condition';
  byId('ts-workload').value = '99';
  byId('ts-partner').value = 'nope';
  T.startTrial();
  const state = T.getRun();
  assert.ok(T.CONDITIONS[state.condition], 'falls back to a real condition');
  assert.equal(state.ballsPerPlayer, 3, 'falls back to the default workload');
  assert.equal(state.partnerKind, 'simple');
});

test('a clamped frame cannot teleport a ball through a paddle', () => {
  const {T} = load();
  const TS = T.TS;
  const travel = TS.bSpeed * (TS.maxFrameMs / TS.tickMs);
  assert.ok(near(travel, 10), `clamped step is ${travel.toFixed(2)}px`);
  assert.ok(travel < TS.missPlane - TS.paddleY,
    'a clamped step must be smaller than the paddle-to-miss-plane gap');
});

test('the agent degrades with workload, matching the published high end', () => {
  /*
   * The paper's agents were tuned to the human miss rates seen in the
   * human-human arm: "approximately 0.05 in the low workload condition, all the
   * way to a miss rate of 0.65 in the very high workload" (game-details.tex).
   *
   * Measured over n=3024 events, this port gives 0.628 at very high workload —
   * a match. At low workload it gives 0.230, not 0.05, and that gap is
   * structural rather than a defect: with the published 1.2s intercept horizon
   * and a 4px/20ms paddle, the agent can only cover 240px of a 720px court, so
   * intercepts near the walls are unreachable. A speed multiplier closes the
   * low end only by pulling the high end away from 0.65. See
   * docs/demos/team-spirit-fidelity.md.
   *
   * Bounds below are set from that measurement, not from the paper, and exist
   * to catch a regression in the agent — not to re-derive the calibration.
   */
  const {T} = load({seed: 20251028});
  const TS = T.TS;

  const trial = (workloadIndex, seconds) => {
    const state = T.newRun('nonCol', workloadIndex, 'simple', false);
    state.paddle1.x = TS.frameLeft; // human parked out of the way
    let hits = 0;
    let misses = 0;
    const steps = Math.round((seconds * 1000) / TS.tickMs);
    for (let i = 0; i < steps; i++) {
      state.paddle2.moveToward(
        T.botTargetX(state.balls, 'nonCol', 'simple', state.paddle1.x), TS.tickMs);
      for (const ball of state.balls) {
        const ev = ball.step(TS.tickMs, state.paddle1, state.paddle2, 'nonCol');
        if (ball.owner !== 'p2') continue;
        if (ev.hitBy === 'p2' || ev.hitBy === 'both') hits += 1;
        if (ev.missed) misses += 1;
      }
    }
    return {hits, misses};
  };

  /*
   * Pool across trials before taking a rate. One ball produces only ~4
   * paddle-line crossings in 45s, so a single low-workload trial cannot
   * measure a rate at all — an earlier version of this test read 0.667 and
   * 0.333 on consecutive runs of unchanged code.
   */
  const pooled = (workloadIndex, seconds, reps) => {
    let hits = 0;
    let misses = 0;
    for (let i = 0; i < reps; i++) {
      const r = trial(workloadIndex, seconds);
      hits += r.hits;
      misses += r.misses;
    }
    return {attempts: hits + misses, rate: misses / (hits + misses)};
  };

  const low = pooled(0, 45, 6);
  const veryHigh = pooled(3, 45, 1);

  assert.ok(low.attempts >= 20,
    `only ${low.attempts} low-workload events; too few to rate`);
  assert.ok(veryHigh.attempts >= 60,
    `only ${veryHigh.attempts} very-high-workload events; too few to rate`);

  // Measured 0.230 across seeds; this seed sits inside the observed 0.12-0.30.
  assert.ok(low.rate >= 0.05 && low.rate <= 0.35,
    `low workload miss rate ${low.rate.toFixed(3)} over ${low.attempts} events, expected 0.05-0.35`);
  // Measured 0.628 across seeds, against the paper's ~0.65.
  assert.ok(veryHigh.rate >= 0.50 && veryHigh.rate <= 0.75,
    `very high workload miss rate ${veryHigh.rate.toFixed(3)}, expected 0.50-0.75`);
  assert.ok(veryHigh.rate > low.rate + 0.2,
    'performance must degrade substantially as workload rises');
});
