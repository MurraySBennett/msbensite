/* paddle-exp · input.js */
/* globals: all shared vars declared in setup.js */

      function keyDownHandler(e) {
        // Suppress Tab everywhere
        if (e.keyCode === 9) { e.preventDefault(); return; }

        // ── Phase-exclusive key routing ───────────────────────────────
        // Each block handles exactly the keys for that phase and returns.
        // Phases are mutually exclusive — no key bleeds between them.

        if (INST.active()) {
          // Instructions only: Space/Enter = forward.
          // No keyboard back shortcut — back button only.
          if ((e.keyCode === 32 || e.keyCode === 13) && INST.canContinue) {
            e.preventDefault();
            INST.next();
          }
          return;  // consume all other keys during instructions
        }

        if (bInTrial) {
          // Trial only: paddle movement + DRT response + practice start
          if (e.keyCode == right) { p1Right = true; }
          if (e.keyCode == left)  { p1Left  = true; }
          if (bInPractice && startCount == 0 && e.keyCode == 32) {
            e.preventDefault();
            moving = true;
            start = Date.now();
            startCount++;
          }
          if (e.keyCode == plyr1DRTrespKey) {
            e.preventDefault();
            drtResp1 = true;
          }
          return;
        }

        if (bInBlockInstructions) {
          if (e.keyCode == 32 && proceed) {
            e.preventDefault();
            blockReadyContinue();
          }
          return;
        }

        if (bInTrialBreak) {
          if (e.keyCode == 32 && proceed) {
            e.preventDefault();
            trialBreakContinue();
          }
          return;
        }
      }
      function keyUpHandler(e) {
        if (e.keyCode == right) {
          p1Right = false;
        } else if (e.keyCode == left) {
          p1Left = false;
        }
        // DRT Response
        if (e.keyCode == plyr1DRTrespKey) {
          drtResp1 = false;
        }
      }

      function lostFocus() {
        p1Right = false;
        p1Left = false;
        drtResp1 = false;
      }

      // Intro pages styling (highly important...)
