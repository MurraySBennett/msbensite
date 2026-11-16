/*
 * Team Spirit — playable demo of the task from:
 *
 *   Bennett, M. S., Hedley, L., Love, J., Houpt, J. W., Brown, S. D., &
 *   Eidels, A. (2025). Human performance in competitive and collaborative
 *   human-machine teams. Topics in Cognitive Science, 17(2), 324-348.
 *   https://doi.org/10.1111/tops.12683
 *
 * This is a SHORT SINGLE-PLAYER version, not the full study. The mechanics,
 * geometry, physics and secondary task match the original; the session shape
 * does not. See the "How this differs" note rendered under the game, and
 * docs/demos/team-spirit-spec.md for every constant's source.
 *
 * Deliberately linear and boring: one file, no build step, no framework, no
 * dispatch tables. Constants first, then ball, then paddles, then the bot,
 * then the DRT, then render, then the loop.
 */

// ---------------------------------------------------------------------------
// Constants. Every value here comes from the original client
// (team-spirit/bot/murrayserver/paddleGame.html + game_qlearning.py), NOT from
// the paper, whose figures are rounded and in places wrong.
// ---------------------------------------------------------------------------

const TS = {
  // Geometry. paddleGame.html:316-343 derives all of this from drtWidth.
  drtWidth: 800, // full canvas width; outer 40px each side are DRT panels
  frameHeight: 600,
  frameLeft: 40,
  frameRight: 760,
  frameTop: 0,
  frameBottom: 600,

  pWidth: 72, // frameWidth * 0.10, frameWidth = 800 * 0.9 = 720
  pHeight: 8.64, // pWidth * 0.12
  paddleY: 574.08, // frameBottom - pHeight * 3
  bRad: 7.776, // pHeight * 0.90

  // Starting x. The server's values drive play (game_qlearning.py:128-129).
  p1Start: 228.0,
  p2Start: 536.0,

  // Ball spawn: three columns at the paddle line (game_qlearning.py:110-136).
  ballY: 566.304, // paddleY - bRad
  ballX: [368.896, 400, 431.104],

  // Speed. Both are 4px per nominal 20ms frame, i.e. 200px/s. The /0.02
  // divisor is baked into the original at paddleGame.html:418-419.
  pSpeed: 4,
  bSpeed: 4,
  tickMs: 20,

  // Paddle deflection fallback window (paddleGame.html:437-451). Outside this
  // range the hit reverts to a PURE REFLECTION. It is a fallback, not a clamp.
  deflectLowDeg: -35,
  deflectHighDeg: -155,

  // Miss plane, server value (game_qlearning.py:441).
  missPlane: 596.112,

  // Launch angle range, upward (game_qlearning.py:694-721).
  launchMinDeg: 45,
  launchMaxDeg: 135,

  // DRT (paddleGame.html:238-243, :270, :336).
  drtMinIsi: 3.0,
  drtMaxIsi: 5.0,
  drtDisplay: 1.0,
  drtRespWindow: 2.5,
  drtMinRt: 0.1,

  // Colours (paddleGame.html:218-239). The paper's hex values are wrong.
  colSelf: "FireBrick",
  colPartner: "RoyalBlue",
  colShared: "#963d97",
  colFrame: "ivory",
  colBackdrop: "black",
  drtOn: "#1bff00",
  drtOff: "black",

  // Demo-only: the published trial was 45s and there were 36 of them.
  trialSeconds: 30,

  // Bot: 80 location bins, 1200ms forward trace
  // (paddle-exp/paddle_exp/bots/greedy.py:33, bots/base.py:244-246).
  botBins: 80,
  botHorizonMs: 1200,
  botConsiderateRadius: 100,

  // Guard against a tab-switch teleporting every ball.
  maxFrameMs: 50,
};

const WORKLOADS = [
  { ballsPerPlayer: 1, label: "Low — 1 ball each" },
  { ballsPerPlayer: 3, label: "Medium — 3 balls each" },
  { ballsPerPlayer: 6, label: "High — 6 balls each" },
  { ballsPerPlayer: 9, label: "Very high — 9 balls each" },
];

// Block instruction text, verbatim from paddleGame.html:1579-1588.
const CONDITIONS = {
  nonCol: {
    label: "Separate",
    instruction: "During this block you will only be able to hit the red balls.",
  },
  col: {
    label: "Collaborative",
    instruction:
      "During this block you must work together! Both of your hits count towards a team score.",
  },
  com: {
    label: "Competitive",
    instruction: "During this block you must try to outscore your opponent.",
  },
};

const PARTNERS = {
  simple: {
    label: "Ideal observer (simple)",
    note: "Weights 80 screen locations by how near and how soon each ball will arrive, then moves toward the best one. Ignores anything more than 1.2s away — that limit is what keeps it human-like rather than optimal.",
  },
  considerate: {
    label: "Ideal observer (considerate)",
    note: "The same agent, except that while collaborating it writes off every location within 100px of your paddle, so it leaves you room instead of chasing the same ball.",
  },
};

const deg2rad = (d) => d * (Math.PI / 180);

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

const demoHtml = `
<style>
  .ts-wrap {
    display: flex; flex-direction: column; gap: 0.75rem;
    align-items: center; width: 100%; max-width: 860px; margin: 0 auto;
    font-family: 'Inter', sans-serif; color: inherit;
  }
  .ts-controls {
    display: flex; flex-wrap: wrap; gap: 0.75rem 1.25rem;
    align-items: flex-end; justify-content: center; width: 100%;
  }
  .ts-field { display: flex; flex-direction: column; gap: 0.25rem; }
  .ts-field label {
    font-size: 0.7rem; letter-spacing: 0.06em; text-transform: uppercase;
    opacity: 0.7;
  }
  .ts-field select {
    font: inherit; font-size: 0.85rem; padding: 0.35rem 0.5rem;
    background: #141414; color: #f4f4f4; border: 1px solid #555;
    border-radius: 3px; min-width: 11rem;
  }
  .ts-check { flex-direction: row; align-items: center; gap: 0.4rem; }
  .ts-check label { text-transform: none; letter-spacing: 0; font-size: 0.8rem; opacity: 1; }
  .ts-start {
    font-family: 'Press Start 2P', cursive; font-size: 0.8rem;
    padding: 0.7rem 1.1rem; cursor: pointer;
    background: #FFD700; color: #1a1a1a;
    border: none; border-radius: 3px;
  }
  .ts-start:hover { background: #FFA500; }
  .ts-stage {
    position: relative; width: 800px; max-width: 100%; aspect-ratio: 4 / 3;
    border: 4px solid #FFD700;
    box-shadow: 0 0 0 4px #FFA500, 0 0 0 8px rgb(255, 77, 0);
    background: #000; overflow: hidden;
  }
  .ts-stage canvas {
    position: absolute; inset: 0; width: 100%; height: 100%; display: block;
  }
  .ts-overlay {
    position: absolute; inset: 0; display: flex; flex-direction: column;
    gap: 0.6rem; align-items: center; justify-content: center;
    text-align: center; padding: 2rem;
    background: rgba(0, 0, 0, 0.82); color: #f4f4f4;
  }
  .ts-overlay h3 {
    font-family: 'Press Start 2P', cursive; font-size: 0.95rem;
    margin: 0 0 0.4rem; color: #FFD700; line-height: 1.6;
  }
  .ts-overlay p { margin: 0; max-width: 34rem; font-size: 0.9rem; line-height: 1.5; }
  .ts-overlay .ts-quote { color: #FFD700; font-style: italic; }
  .ts-keys { font-size: 0.85rem; line-height: 1.8; }
  .ts-keys kbd {
    font-family: ui-monospace, monospace; background: #333; color: #fff;
    border-radius: 3px; padding: 0.1rem 0.4rem; border: 1px solid #666;
  }
  .ts-readout {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
    gap: 0.5rem 1rem; width: 100%; font-size: 0.85rem;
  }
  .ts-readout div { display: flex; flex-direction: column; }
  .ts-readout span:first-child {
    font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.06em;
    opacity: 0.65;
  }
  .ts-readout span:last-child { font-variant-numeric: tabular-nums; font-size: 1.05rem; }
  .ts-note { width: 100%; font-size: 0.82rem; line-height: 1.6; opacity: 0.85; }
  .ts-note h4 { font-size: 0.9rem; margin: 0 0 0.3rem; }
  .ts-note ul { margin: 0.2rem 0 0.8rem; padding-left: 1.2rem; }
  .ts-note li { margin-bottom: 0.2rem; }
  .ts-hidden { display: none !important; }
</style>

<div class="ts-wrap">
  <div class="ts-controls">
    <div class="ts-field">
      <label for="ts-condition">Group condition</label>
      <select id="ts-condition">
        <option value="nonCol">Separate</option>
        <option value="col" selected>Collaborative</option>
        <option value="com">Competitive</option>
      </select>
    </div>
    <div class="ts-field">
      <label for="ts-workload">Workload</label>
      <select id="ts-workload">
        <option value="0">Low — 1 ball each</option>
        <option value="1" selected>Medium — 3 balls each</option>
        <option value="2">High — 6 balls each</option>
        <option value="3">Very high — 9 balls each</option>
      </select>
    </div>
    <div class="ts-field">
      <label for="ts-partner">Machine partner</label>
      <select id="ts-partner">
        <option value="simple" selected>Ideal observer (simple)</option>
        <option value="considerate">Ideal observer (considerate)</option>
      </select>
    </div>
    <div class="ts-field ts-check">
      <input type="checkbox" id="ts-drt" checked />
      <label for="ts-drt">Secondary task (the light)</label>
    </div>
    <button class="ts-start" id="ts-start">Start trial</button>
  </div>

  <div class="ts-stage">
    <canvas id="ts-canvas" width="800" height="600"></canvas>
    <div class="ts-overlay" id="ts-overlay">
      <h3>TEAM SPIRIT</h3>
      <p>
        Move your red paddle to deflect the falling balls. Your blue partner is a
        machine agent from the published study.
      </p>
      <p class="ts-quote" id="ts-instruction"></p>
      <p class="ts-keys">
        Move: <kbd>&larr;</kbd> <kbd>&rarr;</kbd> &nbsp;&middot;&nbsp;
        Light response: <kbd>Z</kbd>
      </p>
      <p>Pick a condition and workload above, then press <kbd>Start trial</kbd> or <kbd>Space</kbd>.</p>
    </div>
  </div>

  <div class="ts-readout">
    <div><span>Time</span><span id="ts-time">30.00s</span></div>
    <div><span id="ts-score-label">Team score</span><span id="ts-score">0</span></div>
    <div><span>Partner score</span><span id="ts-score2">0</span></div>
    <div><span>Hits</span><span id="ts-hits">0</span></div>
    <div><span>Misses</span><span id="ts-misses">0</span></div>
    <div><span>Miss rate</span><span id="ts-missrate">&ndash;</span></div>
    <div><span>Light accuracy</span><span id="ts-drt-acc">&ndash;</span></div>
    <div><span>Light RT</span><span id="ts-drt-rt">&ndash;</span></div>
  </div>

  <div class="ts-note">
    <h4>What was measured</h4>
    <p>
      <strong>Miss rate</strong> on the balls is the primary measure, and response
      time and accuracy to the light index how much spare attention you had. The
      study compared those against a benchmark for two people who neither help nor
      hinder each other &mdash; and found that teamwork cost efficiency in every
      condition, that collaborating beat competing between two humans, and that the
      advantage shrank with a machine partner.
    </p>
    <h4>How this differs from the study</h4>
    <ul>
      <li><strong>Length.</strong> One ${TS.trialSeconds}-second trial you choose. Participants ran 36 trials of 45 seconds across three blocks, about 40 minutes, with the workload order randomised and the conditions counterbalanced.</li>
      <li><strong>Partner.</strong> Always a machine agent here. The study also ran human&ndash;human pairs on two networked screens, which a browser demo cannot reproduce. Nothing here represents that arm.</li>
      <li><strong>No practice, no instruction screens, no data recorded.</strong> Participants got three practice trials and chose their handedness; nothing you do here is stored or sent anywhere.</li>
      <li><strong>One agent of three.</strong> The study also used a Q-learning agent trained over 40,000 episodes, which is too heavy to ship to a browser.</li>
    </ul>
    <p>
      Geometry, ball and paddle speeds, the deflection rule, the scoring rules and
      the light's timing are the published values.
    </p>
  </div>
</div>
`;

// ---------------------------------------------------------------------------
// Ball
// ---------------------------------------------------------------------------

class Ball {
  constructor(id, x, angle, owner) {
    this.id = id;
    this.x = x;
    this.y = TS.ballY;
    this.angle = angle; // radians; sin(angle) > 0 means descending
    this.speed = TS.bSpeed;
    this.owner = owner; // "p1" | "p2" | null (null = shared)
    this.hitLatch = false;
  }

  get descending() {
    return Math.sin(this.angle) > 0;
  }

  /*
   * Advance by `elapsed` ms. Returns the hit/miss events that happened so the
   * caller does the scoring — this keeps the physics free of condition logic.
   */
  step(elapsed, paddle1, paddle2, condition) {
    const prevY = this.y;
    const scale = elapsed / TS.tickMs;
    this.x += this.speed * Math.cos(this.angle) * scale;
    this.y += this.speed * Math.sin(this.angle) * scale;

    // Side walls are the inner edges of the DRT panels.
    if (this.x + TS.bRad > TS.frameRight) {
      this.x = TS.frameRight - TS.bRad - (this.x + TS.bRad - TS.frameRight);
      this.angle = Math.PI - this.angle;
    } else if (this.x - TS.bRad < TS.frameLeft) {
      this.x = TS.frameLeft + TS.bRad + (TS.frameLeft - (this.x - TS.bRad));
      this.angle = Math.PI - this.angle;
    }

    // Top wall.
    if (this.y - TS.bRad < TS.frameTop) {
      this.y = TS.frameTop + TS.bRad;
      this.angle = -this.angle;
    }

    const events = { hitBy: null, missed: false };

    // Paddle line. Only a descending ball that crosses it this frame can hit.
    const crossed =
      this.descending &&
      prevY + TS.bRad <= TS.paddleY &&
      this.y + TS.bRad > TS.paddleY;

    if (crossed && !this.hitLatch) {
      const over1 = this.overlaps(paddle1.x) && this.collidableBy("p1", condition);
      const over2 = this.overlaps(paddle2.x) && this.collidableBy("p2", condition);

      if (over1 || over2) {
        // Both paddles in contact: the ball takes the mean of the two outgoing
        // angles (paddleGame.html:469-478) and both players get a half hit.
        const angles = [];
        if (over1) angles.push(this.deflect(paddle1.x));
        if (over2) angles.push(this.deflect(paddle2.x));
        this.angle = angles.reduce((a, b) => a + b, 0) / angles.length;
        this.y = TS.paddleY - TS.bRad;
        this.hitLatch = true;
        events.hitBy = over1 && over2 ? "both" : over1 ? "p1" : "p2";
      }
    }

    // Miss: the ball keeps its trajectory and re-enters at the top, so the
    // number of balls in play is constant for the whole trial
    // (game_qlearning.py:441-447). This is what makes a miss rate meaningful.
    if (this.y + TS.bRad > TS.missPlane) {
      this.y -= TS.missPlane - (TS.frameTop + TS.bRad);
      events.missed = true;
      this.hitLatch = false;
    }

    if (this.y < TS.paddleY - TS.bRad && !this.descending) this.hitLatch = false;

    return events;
  }

  overlaps(paddleX) {
    return this.x > paddleX - TS.bRad && this.x < paddleX + TS.pWidth + TS.bRad;
  }

  /*
   * In the separate condition a ball passes straight through the other
   * player's paddle. The original enforced this in mechanics, not just in the
   * instructions (topics_revision.tex:240).
   */
  collidableBy(who, condition) {
    if (condition !== "nonCol") return true;
    return this.owner === who;
  }

  /*
   * The published deflection rule (paddleGame.html:437-451,
   * game_qlearning.py:481-487). The `bRad / 2` term is in the original and is
   * kept deliberately, asymmetric though it is.
   */
  deflect(paddleX) {
    const impact = this.x + TS.bRad / 2 - (paddleX + TS.pWidth / 2);
    const contact = impact / (TS.pWidth / 2);
    const candidate = -this.angle + contact / 2;
    const tooFlat =
      candidate <= deg2rad(TS.deflectHighDeg) || candidate >= deg2rad(TS.deflectLowDeg);
    return tooFlat ? -this.angle : candidate;
  }

  colour(condition) {
    if (condition !== "nonCol") return TS.colShared;
    return this.owner === "p1" ? TS.colSelf : TS.colPartner;
  }
}

function spawnBalls(ballsPerPlayer) {
  // Ball ids 0..n-1 belong to player 1, n..2n-1 to player 2
  // (paddleGame.html:2154-2162).
  const total = ballsPerPlayer * 2;
  const balls = [];
  for (let i = 0; i < total; i++) {
    const spread = TS.launchMaxDeg - TS.launchMinDeg;
    const deg = TS.launchMinDeg + Math.random() * spread;
    balls.push(
      new Ball(
        i,
        TS.ballX[i % TS.ballX.length],
        -deg2rad(deg), // negative = upward
        i < ballsPerPlayer ? "p1" : "p2",
      ),
    );
  }
  return balls;
}

// ---------------------------------------------------------------------------
// Paddles
// ---------------------------------------------------------------------------

class Paddle {
  constructor(x) {
    this.x = x;
  }

  moveBy(dx) {
    this.x += dx;
    if (this.x < TS.frameLeft) this.x = TS.frameLeft;
    const maxX = TS.frameRight - TS.pWidth;
    if (this.x > maxX) this.x = maxX;
  }

  moveToward(targetX, elapsed) {
    const step = TS.pSpeed * (elapsed / TS.tickMs);
    const delta = targetX - this.x;
    if (Math.abs(delta) <= step) this.x = targetX;
    else this.moveBy(Math.sign(delta) * step);
    this.moveBy(0); // re-clamp
  }
}

// ---------------------------------------------------------------------------
// The machine partner
//
// Port of the published ideal-observer agents. The original divides the screen
// into 80 locations, weights each by how near and how soon a ball will arrive
// at the paddle line, and steps 4px toward the best one. Anything further than
// 1.2s ahead is ignored, which is the constraint that stops it being optimal.
//
// paddle-exp/paddle_exp/bots/greedy.py weights by distance only and throws
// away the time term it computes; the paper specifies "temporal and spatial
// proximity", so the time term is used here.
// ---------------------------------------------------------------------------

/*
 * Trace a ball forward and return where and how soon it next reaches the
 * paddle line, or null if that is beyond the horizon. Stepped rather than
 * solved: slower, but you can read it and check it against the game.
 */
function traceIntercept(ball) {
  const stepMs = 10;
  let { x, y, angle } = ball;

  for (let t = 0; t < TS.botHorizonMs; t += stepMs) {
    const prevY = y;
    const scale = stepMs / TS.tickMs;
    x += ball.speed * Math.cos(angle) * scale;
    y += ball.speed * Math.sin(angle) * scale;

    if (x + TS.bRad > TS.frameRight || x - TS.bRad < TS.frameLeft) {
      angle = Math.PI - angle;
      x = Math.min(Math.max(x, TS.frameLeft + TS.bRad), TS.frameRight - TS.bRad);
    }
    if (y - TS.bRad < TS.frameTop) {
      y = TS.frameTop + TS.bRad;
      angle = -angle;
    }

    // Same crossing test the ball itself uses, so the agent's prediction and
    // the game's collision cannot disagree. Tracing continues through top
    // bounces and through a miss-wrap, so a ball currently travelling upward
    // is still predicted — the published agent watched intercept points, not
    // only the balls already coming down.
    const crossing =
      Math.sin(angle) > 0 && prevY + TS.bRad <= TS.paddleY && y + TS.bRad > TS.paddleY;
    if (crossing) {
      // soonest = 1, at-the-horizon = 0
      return { x, proximity: 1 - t / TS.botHorizonMs };
    }

    if (y + TS.bRad > TS.missPlane) {
      y -= TS.missPlane - (TS.frameTop + TS.bRad);
    }
  }
  return null;
}

function botTargetX(balls, condition, partnerKind, humanPaddleX) {
  const width = TS.frameRight - TS.frameLeft;
  const centre = (TS.frameLeft + TS.frameRight) / 2;

  const bins = [];
  for (let i = 0; i < TS.botBins; i++) {
    const x = TS.frameLeft + ((i + 0.5) / TS.botBins) * width;
    // A slight centre bias, so an empty screen parks the paddle mid-court.
    bins.push({ x, weight: 1 - Math.abs(x - centre) / (width / 2) });
  }

  // In the separate condition the agent only watches its own balls
  // (greedy.py:63-66). It does NOT filter by direction — that is the
  // Q-learning agent's rule (game_qlearning.py:419-436), and applying it here
  // makes the agent start moving a beat late and miss far more single balls
  // than the published one did.
  const observed = balls.filter(
    (b) => !(condition === "nonCol" && b.owner !== "p2"),
  );

  for (const ball of observed) {
    const hit = traceIntercept(ball);
    if (!hit) continue;
    for (const bin of bins) {
      const spatial = 1 - Math.abs(hit.x - bin.x) / width;
      bin.weight += spatial * hit.proximity * 100;
    }
  }

  // The considerate agent leaves the human room while collaborating.
  if (partnerKind === "considerate" && condition === "col") {
    const left = humanPaddleX - TS.botConsiderateRadius;
    const right = humanPaddleX + TS.pWidth + TS.botConsiderateRadius;
    for (const bin of bins) {
      if (bin.x >= left && bin.x <= right) bin.weight = 0;
    }
  }

  let best = bins[0];
  for (const bin of bins) if (bin.weight > best.weight) best = bin;
  return best.x - TS.pWidth / 2;
}

// ---------------------------------------------------------------------------
// The detection response task
//
// Both side panels flash green at a uniformly random 3-5s interval, for 1s or
// until you respond. A response counts if it lands within 2.5s of onset and no
// faster than 100ms. A correct response is worth a bonus point, as in the
// original (paddleGame.html:1870).
// ---------------------------------------------------------------------------

class Drt {
  constructor(enabled) {
    this.enabled = enabled;
    this.onsetAt = this.nextIsi();
    this.responded = false;
    this.lit = false;
    this.hits = 0;
    this.misses = 0;
    this.falseAlarms = 0;
    this.rts = [];
  }

  nextIsi() {
    return TS.drtMinIsi + Math.random() * (TS.drtMaxIsi - TS.drtMinIsi);
  }

  /* `elapsed` is seconds since the trial began. */
  update(elapsed) {
    if (!this.enabled) return;
    const since = elapsed - this.onsetAt;
    if (since < 0) {
      this.lit = false;
      return;
    }
    this.lit = !this.responded && since < TS.drtDisplay;
    if (since >= TS.drtRespWindow) {
      if (!this.responded) this.misses += 1;
      // The interval is measured onset-to-onset, as in the original's
      // precomputed schedule (game_qlearning.py:724-732) — NOT from the moment
      // the response window closed, which would stretch the real interval to
      // 5.5-7.5s and present a third fewer lights.
      this.onsetAt += this.nextIsi();
      this.responded = false;
      this.lit = false;
    }
  }

  /* Returns true if this response earned the bonus point. */
  respond(elapsed) {
    if (!this.enabled) return false;
    const since = elapsed - this.onsetAt;
    if (this.responded || since < TS.drtMinRt || since > TS.drtRespWindow) {
      this.falseAlarms += 1;
      return false;
    }
    this.responded = true;
    this.lit = false;
    this.hits += 1;
    this.rts.push(since);
    return true;
  }

  get accuracy() {
    const n = this.hits + this.misses;
    return n === 0 ? null : this.hits / n;
  }

  get meanRt() {
    if (this.rts.length === 0) return null;
    return this.rts.reduce((a, b) => a + b, 0) / this.rts.length;
  }
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let els = {};
let ctx = null;
let frameId = null;

let run = null; // null when idle; a trial object while playing

function newRun(condition, workloadIndex, partnerKind, drtEnabled) {
  return {
    condition,
    partnerKind,
    ballsPerPlayer: WORKLOADS[workloadIndex].ballsPerPlayer,
    balls: spawnBalls(WORKLOADS[workloadIndex].ballsPerPlayer),
    paddle1: new Paddle(TS.p1Start),
    paddle2: new Paddle(TS.p2Start),
    drt: new Drt(drtEnabled),
    startedAt: null,
    lastFrameAt: null,
    elapsed: 0,
    score1: 0,
    score2: 0,
    hits1: 0,
    misses1: 0,
    leftHeld: false,
    rightHeld: false,
  };
}

// ---------------------------------------------------------------------------
// Scoring
//
// Separate and competitive: +1 to whoever hit it. Collaborative: +1 to the
// hitter and the team total is the sum. A ball touching both paddles at once
// pays half a hit and half a point to each (game_qlearning.py:488-530).
// ---------------------------------------------------------------------------

function applyHit(state, hitBy) {
  if (hitBy === "both") {
    state.score1 += 0.5;
    state.score2 += 0.5;
    state.hits1 += 0.5;
  } else if (hitBy === "p1") {
    state.score1 += 1;
    state.hits1 += 1;
  } else {
    state.score2 += 1;
  }
}

/*
 * Miss attribution: in the separate condition a miss belongs to the ball's
 * owner; otherwise it is charged to both players (game_qlearning.py:448-466).
 */
function applyMiss(state, ball) {
  if (state.condition === "nonCol") {
    if (ball.owner === "p1") state.misses1 += 1;
  } else {
    state.misses1 += 1;
  }
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function draw(state) {
  // Backdrop, then the DRT panels, then the ivory frame painted over the
  // middle — which is what leaves the two 40px strips visible.
  ctx.fillStyle = TS.colBackdrop;
  ctx.fillRect(0, 0, TS.drtWidth, TS.frameHeight);

  const lit = state && state.drt.lit;
  ctx.fillStyle = lit ? TS.drtOn : TS.drtOff;
  ctx.fillRect(0, 0, TS.frameLeft, TS.frameHeight);
  ctx.fillRect(TS.frameRight, 0, TS.drtWidth - TS.frameRight, TS.frameHeight);

  ctx.fillStyle = TS.colFrame;
  ctx.fillRect(TS.frameLeft, TS.frameTop, TS.frameRight - TS.frameLeft, TS.frameHeight);

  if (!state) return;

  for (const ball of state.balls) {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, TS.bRad, 0, Math.PI * 2);
    ctx.fillStyle = ball.colour(state.condition);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.stroke();
  }

  ctx.fillStyle = TS.colSelf;
  ctx.fillRect(state.paddle1.x, TS.paddleY, TS.pWidth, TS.pHeight);
  ctx.fillStyle = TS.colPartner;
  ctx.fillRect(state.paddle2.x, TS.paddleY, TS.pWidth, TS.pHeight);

  // The original drew the clock and scores inside the playfield.
  ctx.font = "16px Arial";
  ctx.fillStyle = "black";
  ctx.textAlign = "center";
  const remaining = Math.max(0, TS.trialSeconds - state.elapsed);
  ctx.fillText(`${remaining.toFixed(2)}s`, (TS.frameLeft + TS.frameRight) / 2, TS.frameTop + 20);

  ctx.textAlign = "left";
  if (state.condition === "col") {
    ctx.fillText(`Team Score: ${fmt(state.score1 + state.score2)}`, TS.frameLeft + 10, TS.frameTop + 20);
  } else {
    ctx.fillText(`Your Score: ${fmt(state.score1)}`, TS.frameLeft + 10, TS.frameTop + 20);
    ctx.textAlign = "right";
    ctx.fillText(`Player 2 Score: ${fmt(state.score2)}`, TS.frameRight - 10, TS.frameTop + 20);
  }
}

const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function updateReadout(state) {
  if (!state) return;
  els.time.textContent = `${Math.max(0, TS.trialSeconds - state.elapsed).toFixed(2)}s`;

  if (state.condition === "col") {
    els.scoreLabel.textContent = "Team score";
    els.score.textContent = fmt(state.score1 + state.score2);
  } else {
    els.scoreLabel.textContent = "Your score";
    els.score.textContent = fmt(state.score1);
  }
  els.score2.textContent = fmt(state.score2);

  els.hits.textContent = fmt(state.hits1);
  els.misses.textContent = fmt(state.misses1);

  const attempts = state.hits1 + state.misses1;
  els.missrate.textContent =
    attempts === 0 ? "–" : (state.misses1 / attempts).toFixed(2);

  const acc = state.drt.accuracy;
  els.drtAcc.textContent = acc === null ? "–" : `${Math.round(acc * 100)}%`;
  const rt = state.drt.meanRt;
  els.drtRt.textContent = rt === null ? "–" : `${Math.round(rt * 1000)}ms`;
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

function tick(now) {
  if (!run) return;

  if (run.startedAt === null) {
    run.startedAt = now;
    run.lastFrameAt = now;
  }

  // Clamped so a tab-switch cannot teleport every ball through the paddles.
  const elapsedMs = Math.min(now - run.lastFrameAt, TS.maxFrameMs);
  run.lastFrameAt = now;
  run.elapsed = (now - run.startedAt) / 1000;

  if (run.leftHeld) run.paddle1.moveBy(-TS.pSpeed * (elapsedMs / TS.tickMs));
  if (run.rightHeld) run.paddle1.moveBy(TS.pSpeed * (elapsedMs / TS.tickMs));

  const target = botTargetX(run.balls, run.condition, run.partnerKind, run.paddle1.x);
  run.paddle2.moveToward(target, elapsedMs);

  for (const ball of run.balls) {
    const events = ball.step(elapsedMs, run.paddle1, run.paddle2, run.condition);
    if (events.hitBy) applyHit(run, events.hitBy);
    if (events.missed) applyMiss(run, ball);
  }

  run.drt.update(run.elapsed);

  draw(run);
  updateReadout(run);

  if (run.elapsed >= TS.trialSeconds) {
    endTrial();
    return;
  }
  frameId = requestAnimationFrame(tick);
}

function startTrial() {
  run = newRun(readCondition(), readWorkloadIndex(), readPartner(), els.drt.checked);

  els.overlay.classList.add("ts-hidden");
  els.start.textContent = "Restart trial";
  cancelAnimationFrame(frameId);
  frameId = requestAnimationFrame(tick);
}

function endTrial() {
  cancelAnimationFrame(frameId);
  const state = run;
  run = null;

  const attempts = state.hits1 + state.misses1;
  const missRate = attempts === 0 ? null : state.misses1 / attempts;
  const acc = state.drt.accuracy;
  const rt = state.drt.meanRt;

  const lines = [
    `<h3>TRIAL OVER</h3>`,
    `<p>${CONDITIONS[state.condition].label}, ${state.ballsPerPlayer} ball${
      state.ballsPerPlayer === 1 ? "" : "s"
    } each.</p>`,
    `<p>You deflected <strong>${fmt(state.hits1)}</strong> and missed <strong>${fmt(
      state.misses1,
    )}</strong>${
      missRate === null ? "" : ` &mdash; a miss rate of <strong>${missRate.toFixed(2)}</strong>`
    }.</p>`,
  ];

  if (state.drt.enabled) {
    lines.push(
      `<p>You caught <strong>${state.drt.hits}</strong> of ${
        state.drt.hits + state.drt.misses
      } lights${acc === null ? "" : ` (${Math.round(acc * 100)}%)`}${
        rt === null ? "" : `, averaging <strong>${Math.round(rt * 1000)}ms</strong>`
      }.</p>`,
    );
    if (state.drt.falseAlarms > 0) {
      lines.push(
        `<p>${state.drt.falseAlarms} response${
          state.drt.falseAlarms === 1 ? "" : "s"
        } landed outside a light's window.</p>`,
      );
    }
  }

  lines.push(
    `<p>Try another workload or condition, then press <kbd>Start trial</kbd> or <kbd>Space</kbd>.</p>`,
  );

  els.overlay.innerHTML = lines.join("\n");
  els.overlay.classList.remove("ts-hidden");
  draw(null);
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function onKeyDown(event) {
  if (event.code === "Space") {
    // Space advanced every screen in the original, so it starts a trial here.
    if (!run) {
      event.preventDefault();
      startTrial();
    }
    return;
  }
  if (!run) return;

  if (event.code === "ArrowLeft") {
    run.leftHeld = true;
    event.preventDefault();
  } else if (event.code === "ArrowRight") {
    run.rightHeld = true;
    event.preventDefault();
  } else if (event.code === "KeyZ") {
    if (run.drt.respond(run.elapsed)) run.score1 += 1;
    event.preventDefault();
  }
}

function onKeyUp(event) {
  if (!run) return;
  if (event.code === "ArrowLeft") run.leftHeld = false;
  if (event.code === "ArrowRight") run.rightHeld = false;
}

function onBlur() {
  if (!run) return;
  run.leftHeld = false;
  run.rightHeld = false;
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

// Defaults live here rather than in the markup's `selected` attributes, so the
// two cannot drift apart. A stale value can no longer take the demo down.
const DEFAULTS = { condition: "col", workload: "1", partner: "simple" };

function readCondition() {
  return CONDITIONS[els.condition.value] ? els.condition.value : DEFAULTS.condition;
}

function readWorkloadIndex() {
  const i = Number(els.workload.value);
  return Number.isInteger(i) && WORKLOADS[i] ? i : Number(DEFAULTS.workload);
}

function readPartner() {
  return PARTNERS[els.partner.value] ? els.partner.value : DEFAULTS.partner;
}

function showIdleInstruction() {
  els.instruction.textContent = `“${CONDITIONS[readCondition()].instruction}”`;
}

function boot() {
  const mount = document.getElementById("demo-area");
  if (!mount) {
    console.error("team-spirit-hh: #demo-area not found");
    return;
  }
  mount.innerHTML = demoHtml;

  els = {
    canvas: document.getElementById("ts-canvas"),
    overlay: document.getElementById("ts-overlay"),
    instruction: document.getElementById("ts-instruction"),
    condition: document.getElementById("ts-condition"),
    workload: document.getElementById("ts-workload"),
    partner: document.getElementById("ts-partner"),
    drt: document.getElementById("ts-drt"),
    start: document.getElementById("ts-start"),
    time: document.getElementById("ts-time"),
    scoreLabel: document.getElementById("ts-score-label"),
    score: document.getElementById("ts-score"),
    score2: document.getElementById("ts-score2"),
    hits: document.getElementById("ts-hits"),
    misses: document.getElementById("ts-misses"),
    missrate: document.getElementById("ts-missrate"),
    drtAcc: document.getElementById("ts-drt-acc"),
    drtRt: document.getElementById("ts-drt-rt"),
  };

  ctx = els.canvas.getContext("2d");

  els.condition.value = DEFAULTS.condition;
  els.workload.value = DEFAULTS.workload;
  els.partner.value = DEFAULTS.partner;

  els.start.addEventListener("click", startTrial);
  els.condition.addEventListener("change", showIdleInstruction);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  showIdleInstruction();
  els.time.textContent = `${TS.trialSeconds.toFixed(2)}s`;
  draw(null);
}

boot();
