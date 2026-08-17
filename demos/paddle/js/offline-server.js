// ---------------------------------------------------------------------------
// offline-server.js — run the paddle-exp client with no server behind it.
// ---------------------------------------------------------------------------
// Nothing about the task is reimplemented here. classes.js, gameflow.js,
// rendering.js and input.js are the real experiment code, unmodified: the
// physics, collision handling, DRT timing, scoring and rendering are exactly
// what participants get.
//
// The server in paddle-exp is authoritative for pairing players, scheduling
// blocks and logging data — but NOT for the game itself. It sends ball spawn
// parameters ({x, y, id, angle, value}) and the client integrates from there.
// That split is what makes a faithful static demo possible: replace the
// transport, keep the task.
//
// Scope, deliberately: ONE short solo trial. The bots live in Python
// (paddle_exp/bots/), so a human-vs-bot demo needs either a server or a JS
// port of GreedyBot — see the note at the bottom.
//
// Condition parameters are read from the URL exactly as the real client reads
// them, so the demo and the experiment are configured the same way:
//   block_type=col|nonCol   n_balls=N   trial_duration=SEC   d=0|1
// ---------------------------------------------------------------------------

(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);

  // Defaults follow config/base.yaml and CONDITION_MATRIX.md rather than
  // being invented here: n_balls comes from n_balls_sequence [1,3,6,9], and
  // valence values from condition_valence_bombs.yaml.
  const CONFIG = {
    // Solo play is the 'separate' condition — the workload-capacity baseline
    // that establishes alone performance. 'col' and 'com' both require a
    // second player, so they are not offered.
    blockType: 'nonCol',
    nBalls: parseInt(params.get('n_balls') || '3', 10),
    trialSec: parseFloat(params.get('trial_duration') || '30'),
    valence: params.get('valence') === 'valence',
  };

  // From condition_valence_bombs.yaml.
  const VALENCE = { positive: 1, negative: -5, negativeFraction: 0.5 };

  const NativeWebSocket = window.WebSocket;

  // Ball angles in degrees, across the downward arc. The 60-120 range matches
  // the original generator rather than inventing a distribution.
  function spawnBalls(n) {
    const balls = [];
    const lo = 60, hi = 120;
    for (let i = 0; i < n; i++) {
      // Even spread with jitter, so repeat plays differ but difficulty holds.
      const frac = n === 1 ? 0.5 : i / (n - 1);
      const angle = lo + frac * (hi - lo) + (Math.random() - 0.5) * 8;

      // value stays null in standard mode. The client activates valence
      // colouring when it sees a non-null value, so null is what keeps the
      // standard condition standard.
      let value = null;
      if (CONFIG.valence) {
        value = Math.random() < VALENCE.negativeFraction
          ? VALENCE.negative
          : VALENCE.positive;
      }

      balls.push({
        id: i,
        x: 0.12 + (n === 1 ? 0.38 : (i / Math.max(1, n - 1)) * 0.76),
        y: undefined,          // client falls back to its own spawn height
        angle: angle,
        value: value,
      });
    }
    return balls;
  }

  class OfflineServer {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.recorded = [];
      this._trialTimer = null;

      this._state = {
        timestamp: Date.now() / 1000,
        status: 'waiting',
        player_id: '0',
        players: {
          '0': { pos: 0.5, status: 'notReady', score: 0 },
          '1': { pos: 0.5, status: 'notReady', score: 0 },
        },
        block: { block_type: CONFIG.blockType, n_balls: CONFIG.nBalls },
        blockNo: 0,
        trialNo: 0,
        maxTrials: 1,
        nBlocks: 1,
        balls: [],
        trialTime: [],
      };

      setTimeout(() => {
        this.readyState = 1;
        if (this.onopen) this.onopen({ target: this });
        // First state: unblocks the client's `await stateReady`.
        this._emit({ status: 'waiting' });
        // Then move it to reading so the instruction flow starts.
        setTimeout(() => this._emit({ status: 'reading' }), 60);
      }, 0);
    }

    _emit(patch) {
      Object.assign(this._state, patch, { timestamp: Date.now() / 1000 });
      if (this.onmessage) {
        this.onmessage({ data: JSON.stringify(this._state) });
      }
    }

    // Everything the client sends is trial data destined for the server's
    // logger. Kept in memory so the demo can show what would have been
    // recorded, then discarded. Nothing leaves the browser.
    send(payload) {
      if (payload === 'ping') {
        setTimeout(() => this.onmessage && this.onmessage({ data: 'pong' }), 0);
        return;
      }

      let msg;
      try { msg = JSON.parse(payload); } catch (e) { return; }
      this.recorded.push(msg);
      window.__demoRecorded = this.recorded;

      // The client announces readiness once the participant has clicked
      // through the instructions. That is our cue to start the trial.
      if (msg.status === 'ready' && this._state.status !== 'playing') {
        this._startTrial();
      }
    }

    _startTrial() {
      this._state.players['0'].status = 'ready';
      this._state.players['1'].status = 'ready';

      this._emit({
        status: 'playing',
        trialNo: 0,
        balls: spawnBalls(CONFIG.nBalls),
        trialTime: [Date.now() / 1000, Date.now() / 1000 + CONFIG.trialSec],
      });

      clearTimeout(this._trialTimer);
      this._trialTimer = setTimeout(
        () => this._emit({ status: 'ending' }),
        CONFIG.trialSec * 1000
      );
    }

    close() {
      clearTimeout(this._trialTimer);
      this.readyState = 3;
      if (this.onclose) this.onclose({ target: this });
    }
  }

  // Intercept only the game's own socket; leave anything else alone.
  window.WebSocket = function (url, protocols) {
    if (typeof url === 'string' && /\/coms\b/.test(url)) {
      return new OfflineServer(url);
    }
    return new NativeWebSocket(url, protocols);
  };
  window.WebSocket.prototype = OfflineServer.prototype;

  // ---------------------------------------------------------------------------
  // To add a bot opponent later
  // ---------------------------------------------------------------------------
  // GreedyBot (paddle_exp/bots/greedy.py) is ~60 lines: 80 weighted bins across
  // the court, a slight centre bias, +proximity for each ball's predicted
  // intercept, then take the argmax. CollaborativeBot subclasses it and zeroes
  // bins within 100px of the partner during 'col' blocks.
  //
  // The intercept prediction (bots/base.py) traces a ball forward 1200ms
  // through wall bounces. Rather than porting that, drive it with the client's
  // own Ball.move() — same physics the player sees, so the bot cannot be
  // accidentally modelling a different game.
  //
  // With that, _emit() would update players['1'].pos each frame and the demo
  // covers human-vs-bot as well as solo.
})();
