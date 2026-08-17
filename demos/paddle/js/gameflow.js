/* paddle-exp · gameflow.js */
/* globals: all shared vars declared in setup.js */

      function blockInst(blockTypes, count) {
        drawCanvas(fontColour);
        drawFrame();
        fwCtx.clearRect(0, 0, expCanvas.width, expCanvas.height);
        dispFireworks = false;
        bInBlockInstructions = true;
        p1CumulativeScore  = 0;
        p2CumulativeScore  = 0;
        teamCumulativeScore = 0;
        scoreHistory = [];   // clear history at start of each block
        scoreReset();

        // Block title
        let blockNum = count + 1;
        let titleEl = document.getElementById('ov-block-title');
        if (titleEl) titleEl.textContent = 'Block ' + blockNum + ' of ' + nBlocks;

        // Block type badge + instruction text
        const badge = document.getElementById('ov-block-badge');
        const instr = document.getElementById('ov-block-instruction');
        const blockLabels = {
          nonCol: 'Separate',
          col:    'Collaborative',
          com:    'Competitive'
        };
        const blockInstructions = {
          nonCol: 'During this block you will each have your <strong>own set of balls</strong> to hit — your paddle only scores from your assigned balls.',
          col:    'During this block you must <strong>work together</strong> as a team. Both of your hits count towards a shared team score.',
          com:    'During this block you must try to <strong>outscore your opponent</strong>. Each player is scored individually.'
        };
        if (badge) {
          badge.textContent = blockLabels[blockTypes] || blockTypes;
          badge.className = 'ov-block-badge ' + blockTypes;
        }
        if (instr) instr.innerHTML = blockInstructions[blockTypes] || '';

        // DRT reminder
        let drtRem = document.getElementById('ov-block-drt-reminder');
        if (drtRem) drtRem.style.display = show_drt ? 'block' : 'none';

        // Keys
        if (plyr1DRTrespKey) {
          let keyDefs = [{
            label: 'Move paddle',
            keys: plyr1DRTrespKey == RHdrtRespKey
              ? [{sym:'←',small:true},{sym:'→',small:true}]
              : [{sym:'Z'},{sym:'C'}]
          }];
          if (show_drt) keyDefs.push({
            label: 'Light',
            keys: plyr1DRTrespKey == RHdrtRespKey
              ? [{sym:'Z'}]
              : [{sym:'↑',small:true}]
          });
          OV.buildKeys('ov-block-keys', keyDefs);
        }

        OV.show('ov-block');
        // Ensure the INST nav (back/continue) is hidden on block pages
        const instNav = document.getElementById('ov-nav');
        if (instNav) instNav.classList.remove('visible');
        if (DEMO_MODE) setTimeout(demoPollReady, 500);

        dispCont = true;
        proceed = false;

        const _bb = document.getElementById('ov-block-continue-btn');
        const _bn = document.getElementById('ov-block-nav');
        if (_bb) { _bb.disabled = false; _bb.classList.remove('filling','filled'); }
        if (_bn) _bn.classList.remove('visible');

        if (!sim_RL_team & !sim_RLIO_team) {
          // count==0: first ever block (just finished instructions) — 3s fill
          // count>0: inter-block break — blockBreakTime fill
          const waitMs = (count == 0 ? 3 : blockBreakTime) * 1000;
          startFillTimer('ov-block-continue-btn', waitMs, () => {
            timedContinue();
            if (_bn) _bn.classList.add('visible');
          });
        } else {
          state.status = "reading";
        }
      }



            function intertrialWaiting() {
        drawCanvas(fontColour);
        drawFrame();
        OV.show('ov-waiting-intertrial');
      }

            // Set Functions
      function initialise() {
        wireDOMHandlers();   // wire DOM event handlers now that DOM is ready

        // ── Apply server config — server is the single source of truth ──
        // state.config is sent by the server on first connection.
        // Client-side defaults are overwritten unconditionally.
        // DEV_CONFIG values only take effect if explicitly set via the
        // dev launcher (non-null), allowing local testing without a server
        // config change. In production DEV_CONFIG is always empty.
        if (state.config) {
          const sc = state.config;
          // Timing: server is authoritative; DEV_CONFIG overrides only if > 0
          trialDuration         = (DEV_CONFIG.trialDuration         > 0) ? DEV_CONFIG.trialDuration         : sc.trialDuration;
          practiceTrialDuration = (DEV_CONFIG.practiceTrialDuration > 0) ? DEV_CONFIG.practiceTrialDuration : sc.practiceTrialDuration;
          blockBreakTime        = (DEV_CONFIG.blockBreakTime        > 0) ? DEV_CONFIG.blockBreakTime        : sc.blockBreakTime;
          trialBreakTime        = (DEV_CONFIG.trialBreakTime        > 0) ? DEV_CONFIG.trialBreakTime        : sc.trialBreakTime;
          nBlocks               = sc.nBlocks || 3;
          BALL_MODE_VALENCE     = sc.ballMode === 'valence';
          respWin               = sc.drtRespWin  ?? respWin;
          drtDur                = sc.drtDuration ?? drtDur;
          // Study credentials from server config - replaces hardcoded values
          if (sc.platform) {
            const p = sc.platform;
            if (p.contactName)   CONTACT_NAME  = p.contactName;
            if (p.contactEmail)  CONTACT_EMAIL = p.contactEmail;
            if (p.studyName)     STUDY_NAME    = p.studyName;
            if (p.prolificCode)  PROLIFIC_CODE = p.prolificCode;
            if (p.sonaExpId)     SONA_EXP_ID   = p.sonaExpId;
            if (p.sonaCreditToken) SONA_TOKEN  = p.sonaCreditToken;
            if (p.sonaBaseUrl)   SONA_BASE_URL = p.sonaBaseUrl;
          }
        }

        expCanvas = document.getElementById("canvas");
        expContext = expCanvas.getContext("2d");
        expContext.fillStyle = frameColour;
        expContext.fillRect(0, 0, expCanvas.width, expCanvas.height);
        frameLeft = drtWidth * 0.05;
        frameRight = drtWidth * 0.95;
        frameTop = 0;
        frameBottom = frameHeight;
        //DRT Panels
        drtLeft = 0;
        drtRight = frameRight;
        // Sprite positions
        p1Start = frameLeft + (frameWidth * 0.33 - pWidth / 2);
        p2Start = frameRight - (frameWidth * 0.33 + pWidth / 2);
        py = frameBottom - pHeight * 3;
        bx = [
          frameRight - (frameWidth / 2 - bRad * 4),
          frameRight - frameWidth / 2,
          frameRight - (frameWidth / 2 + bRad * 4),
        ];
        by = py - bRad;
        disableScroll();
        fwCanvas = document.getElementById("fireworks");
        fwCtx = fwCanvas.getContext("2d");
        waitingRoomStart = Date.now();

        if (botratheon) {
          // hand is set by the bot after it joins; guard against it still
          // being the default [] array if initialise() runs first.
          const botHand = state.players[1].hand;
          ambigubot = typeof botHand === "string" && botHand.split("-")[1] === "True";
        }

        if (
          state.status === "ending" ||
          state.players[0].status === "timedout" ||
          state.players[1].status === "timedout"
        ) {
          // if someone tries to rejoin later
          gameclosed();
          // } else if (skipIntro){
          //     ws.send(JSON.stringify({'hand':'Right', 'instructionProgress' : 6}))
          //     state.players[state.player_id].instructionProgress = 6;
          //     state.players[state.player_id].hand = 'Right';
          //     blockInst(state.block.block_type, state.blockNo);
        } else if (sim_RL_team | sim_RLIO_team) {
          ws.send(JSON.stringify({ hand: "Right", instructionProgress: 6 }));
          state.players[0].instructionProgress = 6;
          state.players[1].instructionProgress = 6;
          state.players[0].hand = "Right";
          state.players[1].hand = "Right";
          blockInst(state.block.block_type, state.blockNo);
        } else if (DEV_SKIP_INTRO || DEMO_MODE) {
          var _hand = (DEV_HAND === "Left") ? "Left" : "Right";
          left  = (_hand === "Left") ? LHleft  : RHleft;
          right = (_hand === "Left") ? LHright : RHright;
          plyr1DRTrespKey = (_hand === "Left") ? LHdrtRespKey : RHdrtRespKey;
          p1Hand = [plyr1DRTrespKey]; p1HandChosen = true;
          ws.send(JSON.stringify({ hand: _hand, instructionProgress: 6 }));
          state.players[state.player_id].instructionProgress = 6;
          state.players[state.player_id].hand = _hand;
          INST.step = 6; INST.practicesDone = new Set(['paddle','drt','combined']);
          blockInst(state.block.block_type, state.blockNo);
        } else if (state.status === "playing") {
          clearTimeout(timeout);
          nCurrentTrial = state.trialNo + 1;
          moving = true;
          start = state["players"][state.player_id]["trialStart"];
          startCount++;

          if (state["players"][state.player_id]["hand"] === "Right") {
            left = RHleft;
            right = RHright;
            plyr1DRTrespKey = RHdrtRespKey;
          } else {
            left = LHleft;
            right = LHright;
            plyr1DRTrespKey = LHdrtRespKey;
          }

          expTrial();
          proceed = false;
          bInBlockInstructions = false;
          bInPractice = false;
        } else if (state.status === "reading") {
          if (state.players[state.player_id].instructionProgress >= 3) {
            if (state["players"][state.player_id]["hand"] === "Right") {
              left = RHleft;
              right = RHright;
              plyr1DRTrespKey = RHdrtRespKey;
            } else {
              left = LHleft;
              right = LHright;
              plyr1DRTrespKey = LHdrtRespKey;
            }
          }
          if (state.players[state.player_id].instructionProgress == 0) {
            userEntry();
          } else if (state.players[state.player_id].instructionProgress == 1) {
            instructionsOnline();
          } else if (state.players[state.player_id].instructionProgress == 2) {
            instructions2();
            // selecting controls - check if they have or haven't already.
          } else if (state.players[state.player_id].instructionProgress == 3) {
            instructions3();
          } else if (state.players[state.player_id].instructionProgress == 4) {
            instructions4();
          } else if (state.players[state.player_id].instructionProgress == 5) {
            instructionsEnd();
          } else if (state.players[state.player_id].instructionProgress >= 6) {
            //.trialNo+1 > 1){
            if (state.trialNo > 0) {
              clearTimeout(timeout);
              bInTrialBreak = true;
              bInTrial = false;
              moving = false;
              dispCont = true;
              startCount = 0;
              nCurrentTrial = state.trialNo;
              endTrial(score1, score2, teamScore, 0, (state.block||{}).n_balls||1, state.block.block_type);
            } else {
              blockInst(state.block.block_type, state.blockNo);
            }
          }
        } else {
          userEntry();
        }
      }


      // Wire DOM event handlers — called from initialise() once DOM exists.
      function wireDOMHandlers() {
        var form_data = document.getElementById("data-retention");
        if (form_data) form_data.addEventListener("submit", function(e){ e.preventDefault(); });

        var data_consent = document.getElementById("submitData");
        if (data_consent) data_consent.onclick = function () {
          if (!document.getElementById("removeData").checked &&
              !document.getElementById("retainData").checked) {
            document.getElementById("empty_response_msg").textContent =
              "Please make a selection to continue.";
          } else {
            data_consent_provided = true;
            if (document.getElementById("removeData").checked) {
              ws.send(JSON.stringify({ instructionProgress: username1 }));
            }
            document.getElementById("datacheck").classList.remove("visible");
            ws.send(JSON.stringify({ status: "ready" }));
            intertrialWaiting();
          }
        };

        var prolificReturn = document.getElementById("exitButton");
        if (prolificReturn) {
          prolificReturn.onclick = function () {
            if (exp_completed) {
              window.location.href = "https://app.prolific.co/submissions/complete?cc=80A936B0";
            } else {
              window.location.href = "https://app.prolific.co/submissions/";
            }
          };
          prolificReturn.addEventListener("mouseover", function() {
            prolificReturn.style.backgroundColor = "#247c7f";
          });
          prolificReturn.addEventListener("mouseout", function() {
            prolificReturn.style.backgroundColor = "#5fb49c";
          });
        }
      }

      function removeAllVals(arr, value) {
        var i = 0;
        let eventN = 0; // number of items removed from list
        let ePos = getAllIndexes(arr, value);
        while (i < arr.length) {
          if (arr[i] === value) {
            arr.splice(i, 1);
            eventN += 1;
          } else {
            ++i;
          }
        }
        return [arr, eventN, ePos];
      }
      function getAllIndexes(arr, val) {
        var indexes = [],
          i;
        for (i = 0; i < arr.length; i++) if (arr[i] === val) indexes.push(i);
        return indexes;
      }
      function mean(numbers, missID) {
        // remove misses from array, return mean without misses, and number of misses
        let array = removeAllVals(numbers, missID);

        var total = 0,
          i;
        for (i = 0; i < array[0].length; i += 1) {
          total += array[0][i];
        }
        return [total / array[0].length, array[1], array[2]];
      }

      function disableScroll() {
        // Get the current page scroll position
        scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        (scrollLeft =
          window.pageXOffset || document.documentElement.scrollLeft),
          // if any scroll is attempted, set this to the previous value
          (window.onscroll = function () {
            window.scrollTo(scrollLeft, scrollTop);
          });
      }
      function timedContinue() {
        if (dispCont) {
          proceed = true;
          // Show the appropriate pixel button for the current phase
          if (bInBlockInstructions) {
            const btn = document.getElementById('ov-block-continue-btn');
            if (btn) btn.style.display = '';
          } else if (bInTrialBreak) {
            const btn = document.getElementById('ov-intertrial-continue-btn');
            if (btn) btn.style.display = '';
          } else {
            // Fallback for any other context
            const activePage = document.querySelector('.ov-page.active');
            if (activePage) {
              const cont = activePage.querySelector('.ov-continue');
              if (cont) cont.classList.add('visible');
            }
          }
        }
      }
      function drawCanvas(colour) {
        expContext.fillStyle = colour;
        expContext.fillRect(0, 0, expCanvas.width, expCanvas.height);
      }
      function clearCanvas() {
        expContext.clearRect(0, 0, expCanvas.width, expCanvas.height);
      }
      function drawFrame() {
        expContext.beginPath();
        expContext.rect(frameLeft, frameTop, frameWidth, frameHeight);
        expContext.fillStyle = frameColour;
        expContext.fill();
        expContext.stroke();
      }
      function clearFrame() {
        expContext.clearRect(frameLeft, frameTop, frameWidth, frameHeight);
      }
      function drawDRT(stimTimes, duration, start, trialBegin = false) {
        let tRem;
        let drtTimer = Date.now();
        if (trialBegin) {
          tRem = -(drtTimer - start) / 1000 + duration;
        } else {
          tRem = duration;
        }

        if (drtResp1 && show_drt) {
          if (stimTimes[0] - tRem > rtMin && counter1) {
            if (bInPractice) {
              hits1++;
            } else {
              ws.send(JSON.stringify({ rt: stimTimes[0] - tRem }));
              ws.send(JSON.stringify({ score: score1 + 1 }));
            }
            counter1 = false;
          } else {
            if (!bInPractice) {
              ws.send(JSON.stringify({ fa: tRem }));
            }
          }
          drtResp1 = false;
        }

        if (tRem > stimTimes[0]) {
          drtResp1 = false;
          drtPanels.draw(drtOff);
        }
        if (
          tRem < stimTimes[0] &&
          tRem > stimTimes[0] - drtDur &&
          drtResp1 == false &&
          counter1
        ) {
          drtPanels.draw(drtOn);
        }
        if (tRem < stimTimes[0] - respWin) {
          onsets.push(stimTimes[0]);
          stimTimes.shift();
          if (counter1) {
            // if still true at this point then no response was made to this stimulus
            ws.send(JSON.stringify({ rt: -1 }));
          } else {
            counter1 = true;
          }
        }

        expContext.fill();
        expContext.stroke();
      }

      function scoring() {
        if (bInPractice) {
          score1 = hits1;
        } else {
          playerId = state.player_id;
          otherId = playerId === "0" ? "1" : "0";
          score1 = state.players[playerId]["score"];
          score2 = state.players[otherId]["score"];
          // miss1 = state.players[playerId]['miss']
          // miss2 = state.players[otherId]['miss']
        }
        // if (hits1 == 0){score1=0} else {score1=(Math.round((hits1/(hits1+miss1))*1000)).toFixed(0)}
        // if (hits2 == 0){score2=0} else {score2=(Math.round((hits2/(hits2+miss2))*1000)).toFixed(0)}
        if (
          state.block.block_type == "col" ||
          state.block.block_type == "com"
        ) {
          if (score1 == 0 && score2 == 0) {
            teamScore = 0;
          } else {
            // teamScore = (Math.round(((hits1+hits2)/(hits1+hits2+miss1))*1000)).toFixed(0);
            teamScore = score1 + score2;
          }
        }
      }
      function scoreReset() {
        hits1 = 0;
        miss1 = 0;
        score1 = 0;
        hits2 = 0;
        miss2 = 0;
        score2 = 0;
        teamScore = 0;
        p1teamScore = 0;
        p2teamScore = 0;
        drtScore = 0;
      }
      function drawScore(blockType, currentBlock) {
        if (bInPractice) {
          playerId = state.player_id;
          if (playerId === "0") {
            expContext.textAlign = "left";
            expContext.font = "16px Arial";
            expContext.fillStyle = fontColour;
            expContext.fillText(
              "Your Score: " + score1,
              frameLeft + 10,
              frameTop + 20
            );
          } else {
            expContext.textAlign = "right";
            expContext.font = "16px Arial";
            expContext.fillStyle = fontColour;
            expContext.fillText(
              "Your Score: " + score1,
              frameRight - 10,
              frameTop + 20
            );
          }
        } else {
          if (blockType == "col") {
            expContext.textAlign = "left";
            expContext.font = "16px Arial";
            expContext.fillStyle = fontColour;
            expContext.fillText(
              "Team Score: " + teamScore,
              frameLeft + 10,
              frameTop + 20
            );

            expContext.textAlign = "right";
            expContext.fillText(
              "Team Score: " + teamScore,
              frameRight - 10,
              frameTop + 20
            );
          } else if (blockType == "com") {
            // Player 1 Score
            expContext.textAlign = "left";
            expContext.font = "16px Arial";
            expContext.fillStyle = fontColour;
            expContext.fillText(
              "Your Score: " + score1,
              frameLeft + 10,
              frameTop + 20
            );

            // Player 2 Score
            expContext.textAlign = "right";
            expContext.fillStyle = fontColour;
            expContext.fillText(
              "Player 2 Score: " + score2,
              frameRight - 10,
              frameTop + 20
            );
          } else {
            // Player 1 Score
            expContext.textAlign = "left";
            expContext.font = "16px Arial";
            expContext.fillStyle = fontColour;
            expContext.fillText(
              "Your Score: " + score1,
              frameLeft + 10,
              frameTop + 20
            );
          }
        }
      }

      function drawTimer(duration, start, trialBegin = false) {
        let timeRemaining;
        let startTime = Date.now();
        if (trialBegin) {
          timeRemaining = -(startTime - start) / 1000 + duration;
        } else {
          timeRemaining = duration;
        }
        if (timeRemaining <= 0) {
          timeRemaining = 0;
        }
        let dispTime = timeRemaining.toFixed(2);
        expContext.font = "16px Arial";
        expContext.fillStyle = fontColour;
        expContext.textAlign = "center";
        expContext.fillText(
          dispTime + "s",
          frameLeft + frameWidth / 2,
          frameTop + 20
        );

        if (bInPractice) {
          drawPracInst(timeRemaining);
        }
        return timeRemaining;
      }
      function uniqueAngles(nBalls, min, max) {
        let counter = 0;
        let angles = new Array();
        while (counter < nBalls * 2) {
          let newAngle = Math.floor(Math.random() * (max - min) + min);
          if (angles.includes(newAngle)) {
            continue;
          } else {
            angles.push(newAngle);
            counter++;
          }
        }
        return angles;
      }
      function deg2rad(degrees) {
        var pi = Math.PI;
        return degrees * (pi / 180);
      }
      function randRange(min, max) {
        return Math.random() * (max - min) + min;
      }
      function trialShuffle(trialTypes) {
        for (let i = trialTypes.length - 1; i > 0; i--) {
          let j = Math.floor(Math.random() * (i + 1)); // random index from 0 to i
          [trialTypes[i], trialTypes[j]] = [trialTypes[j], trialTypes[i]];
        }
        return trialTypes;
      }
      function drtStimTimes(min, max) {
        let drtTimes = [max - randRange(drtMin, drtMax)];
        while (drtTimes.slice(-1) > min) {
          drtTimes.push(drtTimes.slice(-1) - randRange(drtMin, drtMax));
        }
        drtTimes.pop();
        return drtTimes;
      }

      function drawPracticeTrial(drawStartTime) {
        OV.hide();
        bInTrial = true;
        bInTrialBreak = false;
        dispCont = false;

        // Use performance.now() if no timestamp provided (first frame)
        if (!drawStartTime) drawStartTime = performance.now();
        if (!lastTime) {
          lastTime = drawStartTime;
          elapsedSinceLastLoop = 0;
        } else {
          elapsedSinceLastLoop = drawStartTime - lastTime;
        }
        lastTime = drawStartTime;

        if (isNaN(elapsedSinceLastLoop) || elapsedSinceLastLoop < 0) elapsedSinceLastLoop = 0;
        elapsedSinceLastLoop = Math.min(elapsedSinceLastLoop, MAX_ELAPSED_MS);

        let frProp = (pSpeed * elapsedSinceLastLoop) / 60;
        let speedCorrected = pSpeed * frProp;
        let ballSpeedCorrected = bSpeed * frProp;
        if (!ballSpeedCorrected) ballSpeedCorrected = bSpeed;

        drawCanvas(fontColour);
        if (drtActive) {
          drawDRT(drtOnsets, practiceTrialDuration, start, moving);
        }
        drawFrame();
        allBalls.forEach(function (ball) {
          // ball is the name of each element in the object, same as [for balls in balllist: ball.draw()]
          ball.draw();
          ball.speed = ballSpeedCorrected;
          ball.movePractice(paddle1.x);
        });
        paddle1.draw();
        paddle1.move(p1Left, p1Right, speedCorrected);

        scoring();
        drawScore(state.block.block_type, state.blockNo + 1);
        trialTime = drawTimer(practiceTrialDuration, start, moving);

        rAF = requestAnimationFrame(drawPracticeTrial);
        if (trialTime <= 0) {
          endTrial();
        }
      }

      function drawTrial(drawStartTime) {
        bInTrial = true;
        bInTrialBreak = false;
        dispCont = false;
        if (!startingTime) startingTime = drawStartTime;
        if (!lastTime) {
          // First frame of this trial — don't carry stale timing forward
          lastTime = drawStartTime;
          elapsedSinceLastLoop = 0;
        } else {
          elapsedSinceLastLoop = drawStartTime - lastTime;
        }
        lastTime = drawStartTime;

        // Clamp: never let a single frame step more than MAX_ELAPSED_MS
        // This prevents the catch-up lurch after tab switches, overlay
        // transitions, or any other rendering pause.
        if (isNaN(elapsedSinceLastLoop) || elapsedSinceLastLoop < 0) {
          elapsedSinceLastLoop = 0;
        }
        elapsedSinceLastLoop = Math.min(elapsedSinceLastLoop, MAX_ELAPSED_MS);

        let frProp = (pSpeed * elapsedSinceLastLoop) / 60;
        let speedCorrected = pSpeed * frProp;
        let now = adjustedTime();
        // elapsed is how far ahead of the last server state we need to render.
        // Clamp this too — if we've been away for a long time, don't teleport.
        let elapsed = now - (state.timestamp ?? 0) * 1000;
        if (!isFinite(elapsed) || elapsed < 0) elapsed = 16; // 16ms ≈ one 60fps frame
        elapsed = Math.min(elapsed, MAX_ELAPSED_MS);

        drawCanvas(fontColour);
        if (show_drt) {
          drawDRT(drtOnsets, trialDuration, start, moving);
        }
        drawFrame();

        let playerId = state.player_id;
        let otherId = playerId === "0" ? "1" : "0";
        let theirPos = state.players[otherId].pos;

        if (sim_RL_team | sim_RLIO_team) {
          paddle1.x = state.players[playerId].pos;
          paddle2.x = state.players[otherId].pos;
        } else {
          // Demo mode: auto-steer our paddle toward the nearest ball
          if (DEMO_MODE && allBalls.length > 0) {
            const target = allBalls.reduce((b, c) => (!b || c.y > b.y) ? c : b, null);
            if (target) {
              const centre = paddle1.x + pWidth / 2;
              const dead   = pWidth * 0.15;
              p1Left  = target.x < centre - dead;
              p1Right = target.x > centre + dead;
            }
          }
          paddle1.move(p1Left, p1Right, speedCorrected);
          paddle2.move(p2Left, p2Right, speedCorrected);
          paddle2.x = state.players[otherId].pos;
          paddle1History.add(now, paddle1.x);
        }

        allBalls.forEach(function (ball) {
          ball.move(paddle1.x, paddle2.x, elapsed);  // fix: `this` is wrong in forEach
          ball.draw();
        });

        paddle2.draw();
        paddle1.draw();

        scoring();
        drawScore(state.block.block_type, state.blockNo + 1);
        trialTime = drawTimer(trialDuration, start, moving);

        // expContext.font = '12px serif';
        // expContext.fillStyle = 'FireBrick';
        // expContext.fillText(`${ messageDelay }, ${ roundTripTime }`, 20, 580);

        rAF = requestAnimationFrame(drawTrial);
      }
      function expTrial() {
        OV.hide();
        INST.step = -1;
        if (DEV_BLOCK_TYPE && DEV_BLOCK_TYPE !== '') {
          state.block.block_type = DEV_BLOCK_TYPE;
        }
        // Guard: if state.block isn't populated yet, abort gracefully
        if (!state.block || !state.block.block_type) {
          console.error('[expTrial] state.block not ready:', state.block);
          return;
        }
        // Guard: balls array must exist
        if (!state.balls || !Array.isArray(state.balls)) {
          console.error('[expTrial] state.balls not ready:', state.balls);
          return;
        }

        lastTime = null;
        startingTime = null;
        elapsedSinceLastLoop = 0;
        drtOnsets = state.drt.onset;
        drtPanels = new DRT();
        p1Balls = [];
        p2Balls = [];
        allBalls = [];
        justOncePlease = true; // For the calculation of cumulative scores
        currentBlock = state.block.block_type;

        playerId = state.player_id;
        otherId = playerId === "0" ? "1" : "0";

        // ── Ball colour assignment ──────────────────────────────────────
        // This function is the single source of truth for what colour each
        // ball is displayed as. It handles all four meaningful combinations
        // of coordination structure × valence mode.
        //
        // The HIT LOGIC (who can score from which ball) is determined
        // server-side by ball.id and block_type — this is display only.
        //
        // nonCol + standard:  P1 balls = red, P2 balls = blue
        //                     (baseline: players visually own their balls)
        // nonCol + valence:   balls coloured by value (green/red) within
        //                     each player's assigned half — still separate
        // col/com + standard: all balls purple (shared)
        // col/com + valence:  all balls green/red by value (all shared)
        function ballColour(ball, ownerColour) {
          // Activate valence colouring if dev mode says so OR if the server
          // sent a non-null value on the ball (from a valence YAML config).
          const hasValue = ball.value !== null && ball.value !== undefined;
          if (BALL_MODE_VALENCE || hasValue) {
            if (hasValue) {
              if (ball.value > 0) return BALL_POSITIVE_COLOUR;
              if (ball.value < 0) return BALL_NEGATIVE_COLOUR;
              return BALL_NEUTRAL_COLOUR;
            }
          }
          return ownerColour;
        }

        // ── nonCol (separate / workload-capacity baseline) ──────────────
        // IMPORTANT: this condition is the alone-performance baseline for
        // workload capacity analysis. Ball assignment (P1 hits id<9, P2
        // hits id≥9) is enforced server-side. Here we just colour them:
        // standard → red for P1, blue for P2 (visually distinct ownership)
        // valence  → green/red by value, still within each player's half
        if (state.block.block_type == "nonCol") {
          for (let i = 0; i < state.block.n_balls; i++) {
            // P1's balls: own colour in standard, value colour in valence
            let col = ballColour(state.balls[i], pColours[parseInt(playerId)]);
            p1Balls.push(new Ball(state.balls[i].x, col, state.balls[i].id, state.balls[i].angle, state.balls[i].value, state.balls[i].y));
            allBalls.push(new Ball(state.balls[i].x, col, state.balls[i].id, state.balls[i].angle, state.balls[i].value, state.balls[i].y));
          }
          for (let i = state.block.n_balls; i < state.block.n_balls * 2; i++) {
            // P2's balls: other player colour in standard, value colour in valence
            let col = ballColour(state.balls[i], pColours[parseInt(otherId)]);
            p2Balls.push(new Ball(state.balls[i].x, col, state.balls[i].id, state.balls[i].angle, state.balls[i].value, state.balls[i].y));
            allBalls.push(new Ball(state.balls[i].x, col, state.balls[i].id, state.balls[i].angle, state.balls[i].value, state.balls[i].y));
          }

        // ── col / com (group conditions) ────────────────────────────────
        // All balls are shared — any player can hit any ball.
        // standard → purple (sharedColour)
        // valence  → green (positive) or red (negative) by ball.value
        } else {
          let totalBalls = sim_RL_team ? state.block.n_balls * 2 : state.block.n_balls * 2;
          for (let i = 0; i < totalBalls; i++) {
            let col = ballColour(state.balls[i], sharedColour);
            allBalls.push(new Ball(state.balls[i].x, col, state.balls[i].id, state.balls[i].angle, state.balls[i].value, state.balls[i].y));
          }
        }

        paddle1 = new Paddle(state.players[playerId].pos, p1Colour);
        paddle2 = new Paddle(state.players[otherId].pos, p2Colour);

        let drawStartTime = null;
        let rAf;

        drawTrial();
      }

      async function writeMessages() {
        let sleep = function (time) {
          return new Promise((resolve) => setTimeout(resolve, time));
        };

        while (true) {
          if (state.status === "playing" && paddle1) {
            if (sim_RL_team | sim_RLIO_team) {
              ws.send(
                JSON.stringify({ serverTimeDelta, messageDelay, roundTripTime })
              );
            } else {
              ws.send(
                JSON.stringify({
                  pos: paddle1.x,
                  serverTimeDelta,
                  messageDelay,
                  roundTripTime,
                })
              );
            }
            await sleep(50);
          } else {
            await sleep(500);
          }

          let now = Date.now();
          if (now - pingSent > 5000) {
            ws.send("ping");
            pingSent = now;
          }
        }
      }

      async function readMessages() {
        try {
          for await (const message of messages) {
            if (message === "pong") {
              roundTripTime = Date.now() - pingSent;
              continue;
            }

            let received = JSON.parse(message);

            let serverTime = parseInt(1000 * received.timestamp);
            let clientTime = Date.now();
            let delta = serverTime - clientTime;

            if (serverTimeDelta === null) {
              serverTimeDelta = delta;
              messageDelay = 0;
            } else if (delta > serverTimeDelta) {
              serverTimeDelta = delta;
              messageDelay = 0;
            } else {
              messageDelay = clientTime + serverTimeDelta - serverTime;
            }
            if (state.status === "waiting" && received.status === "reading") {
              // Apply instruction text overrides from INST_TEXT
              Object.keys(INST_TEXT || {}).forEach(function(pageNum) {
                const ovr = INST_TEXT[pageNum];
                const page = document.getElementById('ov-inst' + pageNum);
                if (!page) return;
                if (ovr.title) { const el = page.querySelector('.ov-title'); if (el) el.innerHTML = ovr.title; }
                if (ovr.body)  { const el = page.querySelector('.ov-card .ov-body'); if (el) el.innerHTML = ovr.body; }
              });

              if (INST_SKIP_TO >= 7 || DEMO_MODE) {
                // Skip ALL instructions — jump to block instructions
                if (!p1HandChosen) { selectHand('Right'); }
                INST.step = 6; INST.practicesDone = new Set(['paddle','drt','combined']);
                blockInst(state.block.block_type, state.blockNo);
              } else if (INST_SKIP_TO === 6) {
                if (!p1HandChosen) { selectHand('Right'); }
                INST.practicesDone = new Set(['paddle','drt','combined']);
                instructionsEnd();
              } else if (INST_SKIP_TO === 3) {
                instructions2();  // starts at controls page
              } else {
                // Start at first page in configured sequence
                const firstPage = (INST_SEQUENCE && INST_SEQUENCE.length > 0) ? INST_SEQUENCE[0] : 1;
                if      (firstPage === 1) instructions1();
                else if (firstPage === 2) instructionsOnline();
                else if (firstPage === 3) instructions2();
                else if (firstPage === 4) instructions3();
                else if (firstPage === 5) instructions4();
                else if (firstPage === 6) instructionsEnd();
                else instructions1();
              }
              drawWaitingRoomScientist = false;
            }

            if (state.status === "reading" && received.status === "playing") {
              // transitioning from reading to playing (i.e. beginning trial)
              INST.step = -1;   // FIRST: deactivate before Object.assign triggers anything
              Object.assign(state, received);
              clearTimeout(timeout);
              nCurrentTrial = state.trialNo + 1;

              if (startCount == 0) {
                moving = true;
                start = Date.now();
                ws.send(JSON.stringify({ trialStart: start }));
                startCount++;
              }
              scoreReset();
              expTrial();
              proceed = false;
              bInBlockInstructions = false;
              bInPractice = false;
              bInTrial = true;
              onereminder = true;
            }

            if (
              state.status === "playing" &&
              (received.status === "reading" || received.status === "ending") &&
              bInTrial
            ) {
              // Capture scores BEFORE Object.assign — server resets them on transition
              const _pid  = state.player_id;
              const _oid  = _pid === "0" ? "1" : "0";
              const _p1s  = (state.players[_pid] || {}).score || 0;
              const _p2s  = (state.players[_oid] || {}).score || 0;
              const _hits = (state.players[_pid] || {}).hits  || 0;
              const _bt   = (state.block || {}).block_type || currentBlock;
              const _nbRaw = (state.block || {}).n_balls || 1;
              const _nb    = (_bt === 'nonCol') ? _nbRaw : _nbRaw * 2;
              const _teams = _p1s + _p2s;
              Object.assign(state, received);
              startCount = 0;
              moving = false;
              endTrial(_p1s, _p2s, _teams, _hits, _nb, _bt);
            }

            let playerId = state.player_id;
            let otherId = playerId === "0" ? "1" : "0";
            if (received.status === "playing") {
              paddle2History.add(
                parseInt(received.timestamp * 1000),
                received.players[otherId].pos
              );
            }

            if (
              state.players &&
              state.players[playerId]["instructionProgress"] >= 6 &&
              state.players[playerId]["status"] === "notReady" &&
              state.players[otherId]["status"] === "ready" &&
              !botratheon &&
              onereminder
            ) {
              expContext.fillText(
                "Player 2 is ready.",
                expCanvas.width / 2,
                expCanvas.height / 4 + 225
              );
              onereminder = false;
            }
            if (
              state.players &&
              state.players[otherId]["status"] === "timedout" &&
              state.players[playerId]["status"] != "timedout"
            ) {
              drawWaitingRoomScientist = false;
              participantTO();
            }
            Object.assign(state, received);
            notifyStateReady();
          }
        } catch (e) {
          poorConnection();
        }
      }

      function poorConnection() {
        if (rAF) {
          cancelAnimationFrame(rAF);
          if (nCurrentTrial >= state.maxTrials) {
            if (state.blockNo + 1 == nBlocks) {
              expEnd();
            }
          } else {
            clearFrame();
            bInTrialBreak = true;
            bInTrial = false;
            moving = false;
            drawCanvas(frameColour);
            expContext.fillStyle = fontColour;
            expContext.textAlign = "center";
            expContext.font = "16px Arial";
            expContext.fillText(
              "Oops!",
              expCanvas.width / 2,
              expCanvas.height / 4 - 100
            );
            expContext.fillText(
              "It looks like your connection has dropped out.",
              expCanvas.width / 2,
              expCanvas.height / 4 - 50
            );
            expContext.fillText(
              "Please try refreshing the page when you are ready.",
              expCanvas.width / 2,
              expCanvas.height / 4 - 25
            );
          }
        }
      }

      function participantTO() {
        // dispFireworks = true;
        drawCanvas(frameColour);
        entryPageStyling();
        expContext.fillStyle = fontColour;
        expContext.font = "30px Arial";
        expContext.textAlign = "center";
        expContext.fillText(
          "Player 2 disconnected",
          expCanvas.width / 2,
          expCanvas.height / 4 - 100
        );
        expContext.font = "16px Arial";
        expContext.fillText(
          "Thank you for your participation. The experiment has ended.",
          expCanvas.width / 2,
          expCanvas.height / 4 - 60
        );
        if (sona_participants) {
          expContext.fillText(
            "Participation credit for SONA ID " +
              state.players[state.player_id].platformID +
              " been granted.",
            expCanvas.width / 2,
            expCanvas.height / 4 - 40
          );
          expContext.fillText(
            "Please close the browser window to exit the study.",
            expCanvas.width / 2,
            expCanvas.height / 4 + 60
          );
          pointsLink();
        } else {
          expContext.fillText(
            "Please click the 'Return to Prolific' button at the top of the page",
            expCanvas.width / 2,
            expCanvas.height / 4 - 40
          );
          expContext.fillText(
            "and proceed to Return your submission.",
            expCanvas.width / 2,
            expCanvas.height / 4 - 20
          );
          expContext.fillText(
            "Once you return your submission we will process a partial payment proportionate to your progression.",
            expCanvas.width / 2,
            expCanvas.height / 4 + 80
          );
          var eForm = document.getElementById("exitForm");
          eForm.classList.add("visible");
          document.getElementById("exitButton").style.backgroundColor =
            "#5fb49c";
          document.getElementById("exitButton").style.color = "ivory";
        }
        expContext.fillText(
          "If you have any questions or concerns about the experiment please contact the researcher",
          expCanvas.width / 2,
          expCanvas.height / 4
        );
        expContext.fillText(
          "Murray Bennett at murray.bennett@uon.edu.au",
          expCanvas.width / 2,
          expCanvas.height / 4 + 20
        );
      }

      function practiceTrial() {
        bInPractice = true;
        INST.step = -1;   // deactivate so paddle keys work during practice
        // Reset per-trial timing
        lastTime = null;
        startingTime = null;
        elapsedSinceLastLoop = 0;
        // Auto-start: clock begins immediately
        moving = true;
        start = Date.now();
        startCount = 1;
        drtOnsets = drtStimTimes(respWin, practiceTrialDuration);
        drtPanels = new DRT();
        let nPracBalls = bInCombinedPractice ? 3 : 1;
        bAngles = uniqueAngles(nPracBalls, 60, 120);
        allBalls = [];
        if (!bInDRTPractice) {
          for (let i = 0; i < nPracBalls; i++) {
            allBalls.push(new Ball(bx[i % 3], sharedColour, i, bAngles[i]));
          }
        }
        playerId = state.player_id;
        otherId = playerId === "0" ? "1" : "0";
        paddle1 = new Paddle(state.players[playerId].pos, p1Colour);

        drawPracticeTrial();
      }
      function endTrial(p1s, p2s, teams, myHits, nBalls, blockType) {
        cancelAnimationFrame(rAF);
        clearFrame();
        bInTrialBreak = true;
        bInTrial = false;
        moving = false;
        dispCont = true;
        startCount = 0;
        p1Right = false;
        p1Left = false;
        drtResp1 = false;
        if (bInPractice) {
          if (bInPaddlePractice) {
            hits1 = 0;
            bInPaddlePractice = false;
            // After paddle practice: go to DRT only if DRT is on AND page 4
            // is included in the instruction sequence.
            const _drtInSeq = !INST_SEQUENCE || INST_SEQUENCE.includes(4);
            if (show_drt && _drtInSeq) {
              instructions3();   // DRT explanation page
            } else {
              // Skip DRT practice — jump to combined practice intro (if included)
              // or straight to ready
              const _combInSeq = !INST_SEQUENCE || INST_SEQUENCE.includes(5);
              if (_combInSeq) {
                instructions4();   // combined practice intro
              } else {
                instructionsEnd(); // skip straight to ready
              }
            }
          } else if (bInDRTPractice) {
            bInDRTPractice = false;
            hits1 = 0;
            const _combInSeq = !INST_SEQUENCE || INST_SEQUENCE.includes(5);
            if (_combInSeq) {
              instructions4();   // combined practice intro
            } else {
              instructionsEnd(); // skip combined practice
            }
          } else if (bInCombinedPractice) {
            bInCombinedPractice = false;
            hits1 = 0;
            instructionsEnd();
          }
        } else {
          // Fall back to live state values if not called with pre-captured values
          const _p1s   = (p1s    !== undefined) ? p1s    : score1;
          const _p2s   = (p2s    !== undefined) ? p2s    : score2;
          const _teams = (teams  !== undefined) ? teams  : teamScore;
          const _hits  = (myHits !== undefined) ? myHits : 0;
          const _nb    = (nBalls !== undefined) ? nBalls : ((state.block || {}).n_balls || 1);
          const _bt    = (blockType !== undefined) ? blockType : currentBlock;
          interTrial(_p1s, _p2s, _teams, _hits, _nb, _bt);
        }
      }

      // ── Fill timer: animates a button filling up over `durationMs`,
      // then calls `onComplete` and enables click. ─────────────────────────
      function startFillTimer(btnId, durationMs, onComplete) {
        const btn = document.getElementById(btnId);
        if (!btn) { onComplete(); return; }

        btn.style.display = '';
        btn.disabled = true;
        btn.classList.add('filling');
        // Use a CSS custom property + transition for the fill level
        btn.style.setProperty('--fill', '0%');
        // Force reflow so transition starts from 0
        void btn.offsetWidth;

        const startMs = performance.now();
        const step = () => {
          const elapsed = performance.now() - startMs;
          const pct = Math.min(elapsed / durationMs * 100, 100);
          btn.style.setProperty('--fill', pct.toFixed(1) + '%');
          if (pct < 100) {
            requestAnimationFrame(step);
          } else {
            // Fill complete — activate and call callback
            btn.disabled = false;
            btn.classList.remove('filling');
            btn.classList.add('filled');
            // Flash briefly then return to normal pulse
            setTimeout(() => btn.classList.remove('filled'), 600);
            onComplete();
          }
        };
        requestAnimationFrame(step);
      }

      function blockReadyContinue() {
        if (!proceed) return;
        ws.send(JSON.stringify({ status: 'ready' }));
        intertrialWaiting();
        proceed = false;
      }

      // Demo mode: auto-click ready at block screens so the game flows
      // without any keyboard/mouse input from the presenter.
      function demoPollReady() {
        if (!DEMO_MODE) return;
        if (proceed && bInBlockInstructions) {
          // Short pause so audience can read the block instruction
          setTimeout(function() {
            if (proceed && bInBlockInstructions) blockReadyContinue();
          }, 3000);
        }
      }

      function trialBreakContinue() {
        if (!proceed) return;
        scoreReset();
        proceed = false;
        bInTrialBreak = false;
        if (state.trialNo == state.maxTrials - 1 && state.blockNo == 2 && !data_consent_provided) {
          dataCheck();
        } else if (nCurrentTrial < state.maxTrials) {
          ws.send(JSON.stringify({ status: "ready" }));
          if (!show_drt) ws.send(JSON.stringify({ rt: -999 }));
          intertrialWaiting();
        } else {
          if (state.trialNo + 1 >= state.maxTrials) {
            expEnd();
          } else {
            blockInst(state.block.block_type, state.blockNo);
          }
        }
      }

      // ── Score sparkline ─────────────────────────────────────────────────
      // Draws a pixel-art style bar chart of per-trial scores in the
      // #score-history-canvas element on the inter-trial overlay.
      function drawScoreSparkline(blockType) {
        const canvas = document.getElementById('score-history-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        // Total trials in block (for pre-filling all slots)
        const totalTrials = state.maxTrials || 12;
        const isCol    = blockType === 'col' || blockType === 'shared';
        const isNonCol = blockType === 'nonCol';

        // Hit rate (0–1) is comparable across ball counts.
        // Use p1.hits / n_balls for nonCol, team.hits / (n_balls*2) for group.
        const rates = scoreHistory.map(d => Math.min(1, Math.max(0, d.hitRate || 0)));

        const barW  = Math.max(2, Math.floor((W - 4) / totalTrials) - 1);
        const pitch = Math.floor((W - 4) / totalTrials);  // slot width

        // Background grid at 25%, 50%, 75%, 100%
        ctx.strokeStyle = 'rgba(150,61,151,0.1)';
        ctx.lineWidth   = 1;
        for (let g = 1; g <= 4; g++) {
          const y = Math.round(H - 2 - (g / 4) * (H - 4));
          ctx.beginPath(); ctx.moveTo(2, y); ctx.lineTo(W - 2, y); ctx.stroke();
        }

        // Empty slots (upcoming trials — shown as faint outlines)
        for (let i = 0; i < totalTrials; i++) {
          const x = 2 + i * pitch;
          ctx.strokeStyle = 'rgba(150,61,151,0.12)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, 2.5, barW - 1, H - 5);
        }

        // Filled bars (completed trials)
        rates.forEach((rate, i) => {
          const x    = 2 + i * pitch;
          const bh   = Math.max(2, Math.round(rate * (H - 6)));
          const y    = H - bh - 2;
          const isLatest = i === rates.length - 1;

          // Colour by condition
          let colour, mutedColour;
          if (isCol)    { colour = '#963d97'; mutedColour = 'rgba(150,61,151,0.35)'; }
          else if (isNonCol) { colour = '#C0392B'; mutedColour = 'rgba(192,57,43,0.35)'; }
          else          { colour = '#2471A3'; mutedColour = 'rgba(36,113,163,0.35)'; }

          ctx.fillStyle = isLatest ? colour : mutedColour;
          ctx.fillRect(x, y, barW, bh);
          // Top highlight pixel
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(x, y, barW, 1);
        });

        // Hit-rate % label for latest trial
        if (rates.length > 0) {
          const last = rates[rates.length - 1];
          ctx.font      = 'bold 8px "Space Grotesk", monospace';
          ctx.fillStyle = 'rgba(150,61,151,0.8)';
          ctx.textAlign = 'right';
          ctx.fillText(Math.round(last * 100) + '%', W - 2, 10);
        }

        // "Trial N / total" label
        ctx.font      = '8px monospace';
        ctx.fillStyle = 'rgba(150,61,151,0.5)';
        ctx.textAlign = 'left';
        ctx.fillText(rates.length + ' / ' + totalTrials, 4, 10);
      }

      function interTrial(p1s, p2s, teams, myHits, nBalls, blockType) {
        drawCanvas(fontColour);
        drawFrame();
        drawTrialEnd();

        const competitiveQuotes   = ["Compete to win!", "You can beat them!", "Outscore them!", "You can do it!"];
        const collaborativeQuotes = ["Combine your efforts!", "Work together!", "Collaborate!", "You can do it!"];

        let header = document.getElementById('ov-trial-header');
        let quote  = document.getElementById('ov-trial-quote');
        let wmsg   = document.getElementById('ov-trial-waiting-msg');
        if (header) header.textContent = 'Trial ' + nCurrentTrial + ' of ' + state.maxTrials;
        if (quote) {
          if (blockType == 'com') {
            quote.textContent = nCurrentTrial == state.maxTrials ? 'Well Done!' : competitiveQuotes[state.trialNo % competitiveQuotes.length];
          } else if (blockType == 'col') {
            quote.textContent = nCurrentTrial == state.maxTrials ? 'Great Job!' : collaborativeQuotes[state.trialNo % collaborativeQuotes.length];
          } else {
            quote.textContent = '';
          }
        }

        p1teamScore = p1s;
        p2teamScore = p2s;
        if (justOncePlease) {
          p1CumulativeScore  += parseFloat(p1s) || 0;
          p2CumulativeScore  += parseFloat(p2s) || 0;
          teamCumulativeScore += parseFloat(teams) || 0;
          // Hit rate using pre-reset values passed in from endTrial()
          const hitRate = (nBalls > 0) ? Math.min(1, (myHits || 0) / nBalls) : 0;
          scoreHistory.push({
            p1:        parseFloat(p1s)   || 0,
            p2:        parseFloat(p2s)   || 0,
            team:      parseFloat(teams)  || 0,
            hitRate:   hitRate,
            trialNo:   nCurrentTrial,
            blockType: blockType,
          });
          justOncePlease = false;
        }

        const fmt = v => (typeof v === 'number' ? v.toFixed(v % 1 ? 1 : 0) : v);
        const pct = v => Math.round(v * 100) + '%';

        // Per-condition score display logic:
        //   col    → team score (framing: combined effort)
        //   com    → both players side-by-side (framing: race)
        //   shared → progress bar only, no scores (avoid inadvertent competition)
        //   nonCol → individual score only
        //   other  → individual score (safe fallback)
        let stats = [];
        if (blockType == 'col') {
          // Collaborative: emphasise the team, not the individual.
          // Show team score this trial + running total.
          // Also show your personal hit rate as a "contribution" sub-value.
          const myRate = scoreHistory.length > 0
            ? pct(scoreHistory[scoreHistory.length - 1].hitRate) : '—';
          stats = [
            { label: 'Team score',    value: fmt(teams),              colour: 'var(--accent)', sub: 'this trial' },
            { label: 'Team total',    value: fmt(teamCumulativeScore), colour: 'var(--accent)', sub: 'running'    },
            { label: 'Your hits',     value: myRate,                   colour: 'var(--p1)',     sub: 'this trial' },
          ];
        } else if (blockType == 'com') {
          // Competitive: both scores visible side-by-side.
          stats = [
            { label: 'You',        value: fmt(p1s),               colour: 'var(--p1)', sub: 'this trial' },
            { label: 'Player 2',   value: fmt(p2s),               colour: 'var(--p2)', sub: 'this trial' },
            { label: 'Your total', value: fmt(p1CumulativeScore),  colour: 'var(--p1)', sub: 'running'    },
          ];
        } else if (blockType == 'shared') {
          // Shared (no framing): show progress only — no scores.
          // The sparkline gives temporal context without creating competition.
          const myRate = scoreHistory.length > 0
            ? pct(scoreHistory[scoreHistory.length - 1].hitRate) : '—';
          stats = [
            { label: 'Your hits', value: myRate, colour: 'var(--p1)', sub: 'this trial' },
          ];
        } else {
          // nonCol or any unknown condition: individual score + running total.
          stats = [
            { label: 'Your score', value: fmt(p1s),              colour: 'var(--p1)', sub: 'this trial'  },
            { label: 'Your total', value: fmt(p1CumulativeScore), colour: 'var(--p1)', sub: 'running'     },
          ];
        }
        OV.buildStats('ov-stat-row', stats);
        drawScoreSparkline(blockType);

        // Fireworks only on the very last trial of the very last block
        const isLastTrial = nCurrentTrial == state.maxTrials;
        const isLastBlock  = (state.blockNo + 1) >= nBlocks;
        dispFireworks = isLastTrial && isLastBlock;
        if (dispFireworks) drawFireWorks();
        else if (fwCtx) fwCtx.clearRect(0, 0, expCanvas.width, expCanvas.height);

        dispCont = false;   // prevent premature proceed — set true only after fill
        proceed  = false;
        bInTrialBreak = true;
        const _ib  = document.getElementById('ov-intertrial-continue-btn');
        const _ibn = document.getElementById('ov-intertrial-nav');
        if (_ib)  { _ib.disabled = true; _ib.classList.remove('filling','filled'); }
        if (_ibn) _ibn.classList.remove('visible');
        OV.show('ov-intertrial');
        startFillTimer('ov-intertrial-continue-btn', trialBreakTime * 1000, () => {
          dispCont = true;
          timedContinue();
          if (_ibn) _ibn.classList.add('visible');
          if (DEMO_MODE) setTimeout(() => { if (proceed) trialBreakContinue(); }, 1500);
        });
      }
