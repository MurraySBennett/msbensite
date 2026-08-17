/* paddle-exp · setup.js */
/* Contains: shared globals, OV overlay manager, INST instruction manager */



      function ready(fn) {
        if (document.readyState != "loading") {
          fn();
        } else {
          document.addEventListener("DOMContentLoaded", fn);
        }
      }

      class ConnectionLost extends Error {}
      class UnableToConnect extends ConnectionLost {}

      class ProgressStream {
        constructor(fun) {
          this._progress = undefined;

          this._results_prom = new Promise((resolve, reject) => {
            this._resolve_result = resolve;
            this._reject_result = reject;
          });

          this._progress_prom = new Promise((resolve, reject) => {
            this._resolve_progress = resolve;
            this._reject_progress = reject;
          });

          let self = this;
          this.setProgress = function (progress) {
            self._progress = progress;
            self._resolve_progress();
          };

          let thing = fun(this.setProgress).then(
            (result) => {
              this._reject_progress();
              this._resolve_result(result);
            },
            (error) => {
              this._reject_progress(error);
              this._reject_result(error);
            }
          );
        }

        then(onSuccess, onError) {
          return this._results_prom.then(onSuccess, onError);
        }

        [Symbol.asyncIterator]() {
          var self = this;
          return {
            async next() {
              try {
                await self._progress_prom;
                self._progress_prom = new Promise((resolve, reject) => {
                  self._resolve_progress = resolve;
                  self._reject_progress = reject;
                });
                return { done: false, value: self._progress };
              } catch (e) {
                if (e) throw e;
                else return { done: true };
              }
            },
          };
        }
      }

      let ws;
      let messages;
      let player;
      let serverTimeDelta = null;  // null until first server message; see adjustedTime()
      let pingSent = Date.now();
      let roundTripTime = 0;
      let messageDelay = 0;
      let state = {};
      let notifyStateReady;
      let stateReady = new Promise((resolve) => {
        notifyStateReady = resolve;
      });

      function adjustedTime() {
        // Before first server sync, delta is null — treat as 0 so physics
        // runs immediately rather than returning NaN and freezing everything.
        return Date.now() + (serverTimeDelta ?? 0);
      }

      // ═══════════════════════════════════════════════════════════════════
      // LETTERBOX SCALER
      // Keeps #stage at 800×600 and scales it uniformly to fill the window.
      // Physics coordinates never change — only the CSS transform does.
      // ═══════════════════════════════════════════════════════════════════
      const STAGE_W = 800, STAGE_H = 600;
      const MIN_W   = 820, MIN_H   = 620;

      function scaleStage() {
        const stage = document.getElementById('stage');
        const warn  = document.getElementById('size-warning');
        if (!stage || !warn) return;  // DOM not ready yet — bail silently
        const ww = window.innerWidth, wh = window.innerHeight;

        if (ww < MIN_W || wh < MIN_H) {
          warn.classList.add('visible');
          stage.style.visibility = 'hidden';
          return;
        }
        warn.classList.remove('visible');
        stage.style.visibility = 'visible';

        const scale = Math.min(ww / STAGE_W, wh / STAGE_H);
        // Centre the scaled stage within the window.
        // translate moves the top-left corner, then scale grows from that origin.
        const tx = Math.round((ww - STAGE_W * scale) / 2);
        const ty = Math.round((wh - STAGE_H * scale) / 2);
        stage.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      }

      // scaleStage() and the resize listener are registered inside ready()
      // below, after the DOM is fully parsed. Calling them here would fail
      // because #stage and #size-warning don't exist yet at script parse time.

      // ═══════════════════════════════════════════════════════════════════
      // OVERLAY MANAGER
      // Shows/hides HTML overlay pages instead of drawing text on canvas.
      // The canvas underneath is always running; the overlay sits on top.
      // ═══════════════════════════════════════════════════════════════════
      const OV = {
        overlay: null,

        init() {
          this.overlay = document.getElementById('overlay');
        },

        // Show a specific overlay page, hide all others
        show(pageId) {
          if (!this.overlay) this.init();
          this.overlay.classList.add('visible');
          this.overlay.querySelectorAll('.ov-page').forEach(p => p.classList.remove('active'));
          const page = document.getElementById(pageId);
          if (page) page.classList.add('active');
        },

        // Hide the overlay entirely (during trials)
        hide() {
          if (!this.overlay) this.init();
          this.overlay.classList.remove('visible');
          this.overlay.querySelectorAll('.ov-page').forEach(p => p.classList.remove('active'));
        },

        // Show the continue prompt and unlock spacebar progression
        showContinue(continueId) {
          const el = document.getElementById(continueId);
          if (el) el.classList.add('visible');
          proceed = true;   // FIX: was never set — spacebar check always failed
        },

        // Build dot-style page counter
        buildCounter(containerId, current, total) {
          const el = document.getElementById(containerId);
          if (!el) return;
          el.innerHTML = '';
          for (let i = 1; i <= total; i++) {
            const dot = document.createElement('div');
            dot.className = 'ov-dot' + (i < current ? ' done' : i === current ? ' current' : '');
            el.appendChild(dot);
          }
        },

        // Build a key display inside a container
        buildKeys(containerId, keys) {
          // keys: [{label, keys: [{sym, wide}]}]
          const el = document.getElementById(containerId);
          if (!el) return;
          el.innerHTML = '';
          keys.forEach(group => {
            const g = document.createElement('div');
            g.className = 'ov-key-group';
            const lbl = document.createElement('div');
            lbl.className = 'ov-key-label';
            lbl.textContent = group.label;
            g.appendChild(lbl);
            const pair = document.createElement('div');
            pair.className = 'ov-key-pair';
            group.keys.forEach(k => {
              const key = document.createElement('div');
              key.className = 'ov-key';
              if (k.small) key.style.fontSize = '.65rem';
              key.textContent = k.sym;
              pair.appendChild(key);
            });
            g.appendChild(pair);
            el.appendChild(g);
          });
        },

        // Build the retro arcade score panel for inter-trial display
        // stats: [{label, value, colour, sub (optional subtitle)}]
        buildStats(containerId, stats) {
          const el = document.getElementById(containerId);
          if (!el) return;
          el.innerHTML = '';
          el.className = 'ov-score-panel';
          stats.forEach(s => {
            const cell = document.createElement('div');
            cell.className = 'ov-score-cell';
            const lbl = document.createElement('div');
            lbl.className = 'ov-score-label';
            lbl.textContent = s.label;
            const val = document.createElement('div');
            val.className = 'ov-score-value';
            val.textContent = s.value;
            if (s.colour) val.style.color = s.colour;
            cell.appendChild(lbl);
            cell.appendChild(val);
            if (s.sub) {
              const sub = document.createElement('div');
              sub.className = 'ov-score-sub';
              sub.textContent = s.sub;
              cell.appendChild(sub);
            }
            el.appendChild(cell);
          });
        }
      };

      OV.init();

      // ═══════════════════════════════════════════════════════════════════
      // INSTRUCTION MANAGER (INST)
      //
      // Replaces the chain of bInInstructions1/2/3/4/End boolean flags
      // with a single integer step counter. Forward = next(), back = back().
      //
      // Steps:
      //   0  waiting room (no nav)
      //   1  welcome (instructions1)
      //   2  partner info (instructionsOnline)
      //   3  controls / hand selection (instructions2)
      //   4  DRT explanation (instructions3) — skipped if !show_drt
      //   5  full practice intro (instructions4)
      //   6  practice complete (instructionsEnd)
      //
      // Back is always allowed on text pages.
      // Hand selection (step 3) resets if you go back to it.
      // Steps that launch practice trials do NOT re-launch on back.
      // ═══════════════════════════════════════════════════════════════════
      const INST = {
        step: -1,          // -1 = not started
        minStep: (typeof INST_SEQUENCE !== 'undefined' && INST_SEQUENCE.length > 0) ? INST_SEQUENCE[0] : 1,
        maxStep: (typeof INST_SEQUENCE !== 'undefined' && INST_SEQUENCE.length > 0) ? INST_SEQUENCE[INST_SEQUENCE.length-1] : 6,
        canContinue: false,
        practicesDone: new Set(),  // tracks which practice steps have run

        // Step → {page id, server progress, canGoBack, minWait (ms)}
        steps: {
          1: { page: 'ov-inst1',  progress: 1, canGoBack: false, wait: 5000 },
          2: { page: 'ov-inst2',  progress: 2, canGoBack: true,  wait: 5000 },
          3: { page: 'ov-inst3',  progress: 3, canGoBack: true,  wait: 3000 },
          4: { page: 'ov-inst4',  progress: 4, canGoBack: true,  wait: 5000 },
          5: { page: 'ov-inst5',  progress: 5, canGoBack: true,  wait: 3000 },
          6: { page: 'ov-inst6',  progress: 6, canGoBack: true,  wait: 3000 },
        },

        show(step) {
          this.step = step;
          this.canContinue = false;
          proceed = false;
          clearTimeout(timeout);

          const cfg = this.steps[step];
          if (!cfg) return;

          // Send server progress
          ws.send(JSON.stringify({ instructionProgress: step }));

          // Show the page
          OV.show(cfg.page);

          // Update nav bar visibility and back button
          const nav  = document.getElementById('ov-nav');
          const back = document.getElementById('ov-back-btn');
          if (nav) {
            nav.classList.remove('visible');   // hidden until wait expires
          }
          if (back) {
            back.style.display = (cfg.canGoBack && step > this.minStep) ? '' : 'none';
          }

          // Update page counter dots — reflect actual sequence length
          const _seq   = (typeof INST_SEQUENCE !== 'undefined' && INST_SEQUENCE.length > 0)
                         ? INST_SEQUENCE : (show_drt ? [1,2,3,4,5,6] : [1,2,3,5,6]);
          const total  = _seq.length;
          const displayStep = _seq.indexOf(step) + 1;  // 1-based position in sequence
          OV.buildCounter('ov-counter-' + step, displayStep > 0 ? displayStep : 1, total);

          // Show nav immediately — no forced wait timer.
          // Content is visible; participants can proceed at their own pace.
          this.canContinue = true;
          proceed = true;
          if (nav) nav.classList.add('visible');
        },

        next() {
          if (!this.canContinue) return;

          // Step 3 = hand selection — can't continue until hand is chosen
          if (this.step === 3 && p1Hand.length === 0) {
            // Flash the hand prompt
            const cd = document.getElementById('ov-controls-display');
            if (cd) {
              cd.style.display = 'block';
              cd.querySelector && (cd.innerHTML = '<p class="ov-body" style="color:var(--negative)">Please choose your dominant hand first — press <strong>Z</strong> (right-handed) or <strong>↑</strong> (left-handed).</p>');
            }
            return;
          }

          const nextStep = this._computeNextStep(this.step);
          if (nextStep > this.maxStep) {
            // Done with instructions — go to block instructions
            bInInstructionsEnd = false;
            blockInst(state.block.block_type, state.blockNo);
            teamCumulativeScore = 0; p1CumulativeScore = 0; p2CumulativeScore = 0;
            return;
          }

          // Steps 3/4/5 may launch practice trials
          if (this.step === 3 && !this.practicesDone.has('paddle')) {
            this.practicesDone.add('paddle');
            bInPaddlePractice = true;
            bInInstructions2 = false;
            drtActive = false;
            OV.hide();
            practiceTrial();
            return;
          }
          if (this.step === 4 && !this.practicesDone.has('drt') && show_drt) {
            this.practicesDone.add('drt');
            bInInstructions3 = false;
            drtActive = true;
            bInDRTPractice = true;
            OV.hide();
            practiceTrial();
            return;
          }
          if (this.step === 5 && !this.practicesDone.has('combined')) {
            this.practicesDone.add('combined');
            bInInstructions4 = false;
            drtActive = show_drt;
            bInCombinedPractice = true;
            practiceTrialDuration = trialDuration;
            OV.hide();
            practiceTrial();
            return;
          }

          this.show(nextStep);
        },

        back() {
          const cfg = this.steps[this.step];
          if (!cfg || !cfg.canGoBack) return;
          const prevStep = this._computePrevStep(this.step);
          if (prevStep < this.minStep) return;

          // If going back to hand selection, reset hand choice
          if (prevStep === 3) {
            p1Hand = [];
            p1HandChosen = false;
            drawnKeys = false;
            const cd = document.getElementById('ov-controls-display');
            if (cd) cd.style.display = 'none';
          }
          this.show(prevStep);
        },

        _computeNextStep(step) {
          // Follow INST_SEQUENCE if configured
          if (typeof INST_SEQUENCE !== 'undefined' && INST_SEQUENCE.length > 1) {
            const idx = INST_SEQUENCE.indexOf(step);
            if (idx >= 0 && idx < INST_SEQUENCE.length - 1) return INST_SEQUENCE[idx + 1];
            return this.maxStep + 1;  // past end → triggers expTrial via show()
          }
          if (step === 3 && !show_drt) return 5;
          return step + 1;
        },

        _computePrevStep(step) {
          if (typeof INST_SEQUENCE !== 'undefined' && INST_SEQUENCE.length > 1) {
            const idx = INST_SEQUENCE.indexOf(step);
            if (idx > 0) return INST_SEQUENCE[idx - 1];
            return INST_SEQUENCE[0];
          }
          if (step === 5 && !show_drt) return 3;
          return step - 1;
        },

        // Called by the old bInInstructions* code paths and by
        // DEV_SKIP_INTRO — both eventually want to arrive at a step.
        goTo(step) { this.show(step); },

        // True if we are on any instruction page
        active() { return this.step >= 1 && this.step <= this.maxStep; },
      };

      ready(async () => {
        // DOM is ready — safe to register scaler and resize listener now
        scaleStage();
        window.addEventListener('resize', scaleStage);

        // Register keyboard and focus handlers.
        // These are defined in input.js which loads before setup.js runs.
        document.addEventListener('keydown', keyDownHandler, false);
        document.addEventListener('keyup',   keyUpHandler,   false);
        document.addEventListener('blur',    lostFocus);

        let protocol = window.location.protocol === "http:" ? "ws:" : "wss:";
        let path = window.location.pathname.substring(
          0,
          window.location.pathname.lastIndexOf("/") + 1
        );
        let url = `${protocol}//${window.location.host}${path}coms`;

        ws = new WebSocket(url);

        await new Promise(function (resolve, reject) {
          ws.onopen = () => resolve();
          ws.onerror = () => reject(new UnableToConnect());
        });

        messages = new ProgressStream((setProgress) => {
          ws.onmessage = (message) => setProgress(message.data);
          return new Promise((resolve, reject) => {
            ws.onclose = () => reject(new ConnectionLost());
          });
        });

        readMessages().catch(e => {
          // ConnectionLost fires normally at game end when the server
          // closes the socket. poorConnection() inside readMessages
          // handles the UI — this catch just prevents a console error.
          if (!(e instanceof ConnectionLost)) console.error(e);
        });
        writeMessages();
        await stateReady;

        initialise();
      });

      class PaddleHistory {
        constructor() {
          this.retain = 5000;
          this.history = [];
        }

        add(time, pos) {
          while (
            this.history.length > 1 &&
            time - this.history[this.history.length - 1].time > this.retain
          ) {
            this.history.pop();
          }
          this.history.unshift({ time, pos });
        }

        get(time, currentPos) {
          if (this.history.length === 0) return currentPos;

          if (time > this.history[0].time) return this.history[0].pos;

          // should use a binary search of course, but whatevs
          for (let i = 1; i < this.history.length; i++) {
            if (time > this.history[i].time) {
              let intervalStart = this.history[i - 1].time;
              let intervalEnd = this.history[i].time;
              let posStart = this.history[i - 1].pos;
              let posEnd = this.history[i].pos;
              let weight =
                (time - intervalStart) / (intervalEnd - intervalStart);
              let pos = (posEnd - posStart) * weight + posStart;

              return pos;
            }
          }

          return this.history[this.history.length - 1].pos;
        }
      }

      let paddle1History = new PaddleHistory();
      let paddle2History = new PaddleHistory();

      // ── Additional globals not caught by earlier audit ───────────────
      var celebrAF;           // rAF handle for celebration animation
      var drawStartTime;      // timestamp for drawTrial first frame
      var expTimeout;         // setTimeout handle for experiment timing
      var xPos, yPos;         // general position vars used in animations
      var tRem, timeRemaining;// timer display vars
      var waitType;           // waiting room display type
      var otherId;            // the other player's id ("0" or "1")
      var playerId;           // this player's id
      var angle;              // general angle var used in rendering

      let platform_source = new URLSearchParams(
        document.location.search.substring(1)
      );
      var sona_participants     = platform_source.get("platform") === "sona";
      var prolific_participants = platform_source.get("platform") === "prolific";
      var lab_participants      = !sona_participants && !prolific_participants;

      // Study contact details - overridden from state.config.platform in initialise()
      // Default values used until server config arrives.
      var CONTACT_NAME  = "the research team";
      var CONTACT_EMAIL = "";
      var STUDY_NAME    = "paddle-exp";
      var PROLIFIC_CODE = "";
      var SONA_EXP_ID   = "";
      var SONA_TOKEN    = "";
      var SONA_BASE_URL = "https://newcastle.sona-systems.com";
      var show_drt =
        platform_source.get("d") ==
        null; /*(d)isco or not - if we don't include it in params it should default to 'on'*/
      var botratheon = platform_source.get("b") != null;
      // demo=1 → auto-control player 1's paddle client-side so the game
      // can be watched without keyboard input. Used by /demo launcher.
      var DEMO_MODE = platform_source.get("demo") === "1";
      var ambigubot = false;

      var sim_RL_team = platform_source.get("sim_RL_team") == "1";
      var sim_RLIO_team = platform_source.get("sim_RLIO_team") == "1";

      username1 = platform_source.get("user_id");
      var exp_completed = false;

      // ----------------------------------------------------------------
      // DEV_CONFIG — injected by the dev landing page via sessionStorage.
      // In production this object is always empty and has no effect.
      // Keys here override the hardcoded defaults below.
      // ----------------------------------------------------------------
      var DEV_CONFIG = {};
      try {
        var _stored = sessionStorage.getItem("paddle_dev_config");
        if (_stored) {
          DEV_CONFIG = JSON.parse(_stored);
          // Always clear timing values from DEV_CONFIG here.
          // The server is the authority for all timing — state.config in
          // initialise() is what sets trialDuration/trialBreakTime etc.
          // DEV_CONFIG timing values only cause confusion when stale.
          // Non-timing values (skipIntro, hand, blockType, ballMode) are kept.
          delete DEV_CONFIG.trialDuration;
          delete DEV_CONFIG.practiceTrialDuration;
          delete DEV_CONFIG.blockBreakTime;
          delete DEV_CONFIG.trialBreakTime;
          delete DEV_CONFIG._fresh;
          // Write back so refreshes don't re-read the old timing values
          sessionStorage.setItem('paddle_dev_config', JSON.stringify(DEV_CONFIG));
        }
      } catch(e) {}

      function devGet(key, fallback) {
        return (DEV_CONFIG[key] !== undefined) ? DEV_CONFIG[key] : fallback;
      }

      // ── Instruction sequence configuration ───────────────────────────
      // INST_SEQUENCE: which pages to show and in what order.
      //   Default = [1,2,3,4,5,6] (all pages)
      //   e.g. [1,3,6] = welcome + controls + ready (skip partner/DRT/practice)
      // INST_TEXT: per-page text overrides, keyed by page number.
      //   e.g. {1: {title:"Intro", body:"<p>Custom text</p>"}}
      // INST_SKIP_TO: if set, jumps straight to this step on load.
      //   1 = full instructions, 3 = skip to controls, 6 = skip to ready, 7 = skip all
      var INST_SEQUENCE = [1, 2, 3, 4, 5, 6];   // default: show all pages
      var INST_TEXT     = {};                      // default: no overrides
      var INST_SKIP_TO  = 1;                       // default: start from beginning

      try {
        var _instCfg = sessionStorage.getItem("paddle_inst_config");
        if (_instCfg) {
          var _ic = JSON.parse(_instCfg);
          if (_ic.sequence) INST_SEQUENCE = _ic.sequence;
          if (_ic.text)     INST_TEXT     = _ic.text;
          if (_ic.skipTo !== undefined) INST_SKIP_TO = _ic.skipTo;
        }
      } catch(e) {}

      // Dev mode: skip all instruction/practice screens and jump straight
      // to the first trial. Set by the dev landing page.
      var DEV_SKIP_INTRO  = devGet("skipIntro", false);
      var DEV_BLOCK_TYPE  = devGet("blockType", null);   // force a block type
      var DEV_N_BALLS     = devGet("nBalls", null);      // force ball count
      var DEV_HAND        = devGet("hand", "Right");     // default hand for skip
      var DEV_BALL_MODE   = devGet("ballMode", "standard"); // standard | valence
      // Ball physics mode. 'classic' = original behaviour (existing data).
      // 'breakout' = stronger contact-point steering, Arkanoid-style.
      // Never change 'classic' — existing data was collected under it.
      var PHYSICS_MODE = devGet("ballPhysics",
        platform_source.get("physics") || "classic"
      );
      // ----------------------------------------------------------------

      drtChecks = [];
      // Define variables — all values read through devGet() so the
      // dev landing page can override any of them without touching this file.
      if (sim_RL_team | sim_RLIO_team) {
        var nBlocks = 2;
      } else {
        var nBlocks = devGet("nBlocks", 3);
      }

      // workload
      var workloadLevels = [1, 3, 6, 9];
      var trialDuration        = devGet("trialDuration", 45);
      var practiceTrialDuration= devGet("practiceTrialDuration", 25);
      var dirInst              = 10;
      var blockBreakTime       = devGet("blockBreakTime", 20);
      var trialBreakTime       = devGet("trialBreakTime", 5);
      var instructionsPause    = devGet("instructionsPause", 5);

      // Ball valence system.
      // In standard mode, all balls are the shared/player colour and worth +1.
      // In valence mode, ball colours and values come from state.balls[i].value
      // set by the server (game.py). The client reads them for display only.
      var BALL_MODE_VALENCE    = (DEV_BALL_MODE === "valence");
      // Valence ball colours.
      // Positive (high value) = blue  — matches p2Colour (RoyalBlue)
      // Negative (low value)  = red   — matches p1Colour (FireBrick)
      // Neutral               = purple — shared/unvalenced balls
      // Using player colours for valence keeps the visual language consistent:
      // the colour already means something to participants (your paddle = your colour).
      var BALL_POSITIVE_COLOUR = devGet("ballPositiveColour", "RoyalBlue");
      var BALL_NEGATIVE_COLOUR = devGet("ballNegativeColour", "FireBrick");
      var BALL_NEUTRAL_COLOUR  = devGet("ballNeutralColour",  "#963d97");

      // Colours
      var sharedColour = BALL_NEUTRAL_COLOUR;
      var p1Colour = devGet("p1Colour", "FireBrick");
      var p2Colour = devGet("p2Colour", "RoyalBlue");
      var pColours = [p1Colour, p2Colour];
      var frameColour = devGet("frameColour", "ivory");
      var fontColour  = devGet("fontColour",  "black");

      // GameFrame
      var drtWidth = 800;
      var frameWidth = drtWidth * 0.9;
      var frameHeight = 600;
      var frameLeft;
      var frameRight;
      var frameTop;
      var frameBottom;

      // DRT

      var drtLeft;
      var drtRight;
      var drtOn = "#1bff00";
      var drtOff = "black";
      var drtMin = 3;
      var drtMax = 5;
      var respWin = 2.5;
      var drtDur = 1;
      let drtResp1 = false;
      let drtOnsets;
      var onsets = []; // used to save the onset times for each trial
      var drtScore = 0;
      var drtActive = false;
      var drawnKeys = false;

      var LHdrtRespKey = "38";
      var RHdrtRespKey = "90";

      var plyr1DRTrespKey;
      var plyr2DRTrespKey;

      var hand1;
      var hand2;

      // Timing
      var startDate;
      var startTime;
      var currentTime;
      var endDate;
      var endTime;
      var rt1 = [];
      var rt2 = [];
      var fa1 = [];
      var fa2 = [];
      var missCode = -1;
      var waitingRoomStart;
      var totalWait = 20; //60 * 10 // seconds * minutes
      var timeWaited;
      var drawWaitingRoomScientist;

      var startingTime;
      var lastTime;
      var elapsedSinceLastLoop;
      // Maximum elapsed time allowed in a single render frame.
      // Prevents balls lurching forward after pauses, tab switches,
      // or the overlay hiding. 100ms = ~6 frames at 60fps — generous
      // enough for minor hitches, tight enough to prevent catch-up.
      var MAX_ELAPSED_MS = 100;
      var calc = pSpeed / 1000;

      // Experiment control
      var nCurrentBlock;
      var currentBlock;
      var nCurrentTrial;
      var bInTrial = false;
      // bInInstructions1-4/End/Online: removed — the INST manager (OV/INST)
      // tracks instruction state. Kept as no-op assignments for backward compat
      // in case any residual code still sets them.
      var bInInstructions1 = false, bInInstructionsOnline = false,
          bInInstructions2 = false, bInInstructions3 = false,
          bInInstructions4 = false, bInInstructionsEnd   = false;
      // These are set but never checked — safe to remove after confirming
      // nothing in rendering.js reads them to gate drawing.
      var bInEndOfBlock = false;
      var bInBlockInstructions = false;
      var bInPractice = false;
      var proceed = false;
      var bInTrialBreak = false;
      var justOncePlease = true;
      var dispCont = true;
      var dispFireworks = false;
      var bInPaddlePractice = false;
      var bInDRTPractice = false;
      var bInCombinedPractice = false;

      var username1;
      var data_consent_provided = false;
      // Trial Start
      let startCount = 0;
      let start;
      var interval;
      var timeout;

      // Paddles
      var paddle1;
      var paddle2;
      var nPaddles = 2;
      var pWidth = frameWidth * 0.1;
      var pHeight = pWidth * 0.12;
      if (sim_RLIO_team) {
        var pSpeed = Math.round((pHeight / 2) * 1.5);
      } else {
        var pSpeed = Math.round(pHeight / 2);
      }
      let p1Right = false;
      let p1Left = false;
      let p2Right = false;
      let p2Left = false;
      let p1Start;
      let p2Start;
      var py;
      var LHleft = "90"; //Z
      var LHright = "67"; //C
      var RHleft = "37"; //left arrow
      var RHright = "39"; // right arrow
      var left  = "37";  // default: right-handed (left arrow)
      var right = "39";  // default: right-handed (right arrow)

      // if (skipIntro){
      //     left = RHleft;
      //     right = RHright;
      //     plyr1DRTrespKey = RHdrtRespKey;
      // }

      var p1Hand = [];
      var p1HandChosen = false;
      var p2HandChosen = false;
      var rtMin = 0.1; // tenth of a second - used to clean RT times as they're made
      var counter1 = true; // these are response counters so we don't have 100 RTs saved as hits for each DRT stimulus event.
      var counter2 = true;
      var onereminder = true;

      // Balls
      var bRad = pHeight * 0.9;
      var bSpeed = Math.ceil(pSpeed * 0.8);
      let moving = false;
      let lowLim = 35;
      let upperLim = 155;
      let p1Balls = [];
      let p2Balls = [];
      let allBalls = [];
      var bx;
      var by;
      var bAngles;

      // Scoring
      var hits1 = 0;
      var miss1 = 0;
      let score1 = 0;
      var hits2 = 0;
      var miss2 = 0;
      let score2 = 0;
      var teamScore = 0;
      var p1CumulativeScore = 0;
      var p2CumulativeScore = 0;
      var teamCumulativeScore = 0;
      // Trial-by-trial score history for sparkline graph
      var scoreHistory = [];
      var p1teamScore = 0;
      var p2teamScore = 0;

      // save Data
      var paddleCoords = [];
      var ballCoords = [];
      var scoreData = [];
      var drtData = [];

      var outputSummary;

      // Canvas and rendering globals
      var expCanvas;
      var expContext;
      var fwCanvas;
      var fwCtx;
      var rAF;            // requestAnimationFrame handle for main trial loop
      var trialTime;      // time remaining in current trial

      // Animation globals
      var waiter;
      var waiterColours;
      var waiterBackground;
      var waiterBGColours;

      // State globals set per-trial
      var drtPanels;
      var bInWaiting = false;
      var scrollTop;

      // Sprite Classes


