/* paddle-exp · classes.js */
/* globals: all shared vars declared in setup.js */

      class Ball {
        constructor(x, colour, ballId, angle, value, y) {
          this.x = x;
          this.y = (y !== undefined) ? y : by;  // use server Y if provided, else fallback
          this.size = bRad;
          this.colour = colour;
          this.value = value ?? null;  // point value for valence mode
          this.speed = bSpeed;
          this.angle = -deg2rad(angle);
          this.identity = ballId;
          this.xCoords = [];
          this.yCoords = [];
          this.hit = false;
          this.miss = false;
        }
        move(paddlePos1, paddlePos2, elapsed) {
          let identity = this.identity;
          let ballId = this.identity;

          if (state.block.block_type === "nonCol" || sim_RL_team) {
            // Convert ball ID to array index.
            // Server assigns IDs: P0 gets 0..(n-1), P1 gets maxN..(maxN+n-1)
            // where maxN = max(n_balls_sequence). Client state.balls is indexed
            // 0..2n-1 sequentially, so P1 balls need offsetting back.
            const _maxN = state.config ? Math.max(...(state.config.nBallsSequence || [9])) : 9;
            const _n    = state.block.n_balls;
            if (identity >= _maxN) {
              identity = identity - _maxN + _n;
            }
          }
          if (state.balls) {
            let s = state.balls[identity];
            this.speed = s.speed;
            this.angle = s.angle;

            let bounds = {
              left: frameLeft + bRad,
              top: bRad,
              right: frameRight - bRad,
              bottom: frameHeight - bRad,
              paddle: py - bRad,
            };

            function move(x, y, speed, angle, elapsed) {
              let xe = x + (speed * Math.cos(angle) * elapsed) / 1000 / 0.02;
              let ye = y + (speed * Math.sin(angle) * elapsed) / 1000 / 0.02;
              return { x: xe, y: ye };
            }

            function determinePaddleLineCrossing(x, y, speed, angle, elapsed) {
              let end = move(x, y, speed, angle, elapsed);
              if (y > bounds.paddle || end.y < bounds.paddle)
                return;
              let prop = (bounds.paddle - y) / (end.y - y);
              let xAtCrossing = (end.x - x) * prop + x;
              elapsed = elapsed * prop;
              return { x: xAtCrossing, elapsed };
            }

            function determineResultantAngle(crossing, angle, paddleX) {
              if (paddleX === undefined) return;
              if (crossing.x < paddleX - bRad || crossing.x > paddleX + pWidth + bRad)
                return;

              // Contact-point offset: -1 (left edge) to +1 (right edge)
              let impact = crossing.x + bRad / 2 - (paddleX + pWidth / 2);
              let contactProp = impact / (pWidth / 2);  // -1 to +1

              let newAngle;
              if (PHYSICS_MODE === 'breakout') {
                // Breakout mode: contact point strongly steers the outgoing angle.
                // Max deflection ±60° from straight up (i.e. 120°–60° from horizontal).
                // Incoming angle still contributes but contact point dominates.
                let steerAngle = contactProp * deg2rad(55);  // ±55° steering
                newAngle = -Math.PI / 2 + steerAngle;        // base: straight up
                // Blend with reflected incoming angle (30% incoming, 70% contact)
                let reflectedAngle = -angle;
                newAngle = 0.7 * newAngle + 0.3 * reflectedAngle;
                // Clamp to never go sideways or downward
                if (newAngle < -deg2rad(160)) newAngle = -deg2rad(160);
                if (newAngle > -deg2rad(20))  newAngle = -deg2rad(20);
              } else {
                // Classic mode: original behaviour, unchanged.
                let offset = contactProp / 2;
                newAngle = -angle + offset;
                if (newAngle <= -deg2rad(155) || newAngle >= -deg2rad(35))
                  return -angle;
              }
              return newAngle;
            }

            function determinePaddleCollision(
              x,
              y,
              speed,
              angle,
              elapsed,
              p1,
              p2
            ) {
              let crossing = determinePaddleLineCrossing(
                x,
                y,
                speed,
                angle,
                elapsed
              );
              if (!crossing) return undefined;

              let remaining = elapsed - crossing.elapsed;
              let then = adjustedTime() - remaining;
              let paddle1x;
              let paddle2x;

              if (p1) paddle1x = paddle1History.get(then);
              if (p2) paddle2x = paddle2History.get(then);

              let angle1 = determineResultantAngle(crossing, angle, paddle1x);
              let angle2 = determineResultantAngle(crossing, angle, paddle2x);

              let rAngle;
              if (angle1 !== undefined && angle2 !== undefined) rAngle = (angle1 + angle2) / 2;
              else if (angle1 !== undefined) rAngle = angle1;
              else if (angle2 !== undefined) rAngle = angle2;
              else return undefined;

              return {
                x: crossing.x,
                y: bounds.paddle,
                angle: rAngle,
                elapsed: crossing.elapsed,
              };
            }

            function determineLeftCollision(x, y, speed, angle, elapsed) {
              let end = move(x, y, speed, angle, elapsed);
              if (end.x < bounds.left) {
                let prop = (x - bounds.left) / (x - end.x);
                x = bounds.left;
                y = (end.y - y) * prop + y;
                elapsed = elapsed * prop;
                angle = deg2rad(180) - angle;
                return { x, y, speed, angle, elapsed };
              }
            }

            function determineRightCollision(x, y, speed, angle, elapsed) {
              let end = move(x, y, speed, angle, elapsed);
              if (end.x > bounds.right) {
                let prop = (bounds.right - x) / (end.x - x);
                x = bounds.right;
                y = (end.y - y) * prop + y;
                elapsed = elapsed * prop;
                angle = deg2rad(180) - angle;
                return { x, y, speed, angle, elapsed };
              }
            }

            function determineTopCollision(x, y, speed, angle, elapsed) {
              let end = move(x, y, speed, angle, elapsed);
              if (end.y < bounds.top) {
                let prop = (y - bounds.top) / (y - end.y);
                y = bounds.top;
                x = (end.x - x) * prop + x;
                elapsed = elapsed * prop;
                angle = -angle;
                return { x, y, speed, angle, elapsed };
              }
            }

            function determineBottomCollision(x, y, speed, angle, elapsed) {
              let end = move(x, y, speed, angle, elapsed);
              if (end.y > bounds.bottom) {
                let prop = (bounds.bottom - y) / (end.y - y);
                x = (end.x - x) * prop + x;
                y = bounds.top;
                elapsed = elapsed * prop;
                return { x, y, speed, angle, elapsed };
              }
            }

            let playerId = state.player_id;

            let p1 = false;
            let p2 = false;

            if (state.block.block_type == "nonCol" || sim_RL_team) {
              if (
                (ballId < 9 && playerId == 0) ||
                (ballId >= 9 && playerId == 1)
              )
                p1 = true;
              else p2 = true;
            } else {
              p1 = true;
              p2 = true;
            }

            let x = s.x;
            let y = s.y;
            let speed = s.speed;
            let angle = s.angle;

            while (true) {
              let collisions = [
                determineLeftCollision(x, y, speed, angle, elapsed),
                determineRightCollision(x, y, speed, angle, elapsed),
                determineTopCollision(x, y, speed, angle, elapsed),
                determineBottomCollision(x, y, speed, angle, elapsed),
                determinePaddleCollision(x, y, speed, angle, elapsed, p1, p2),
              ];

              let earliest = collisions.find((x, index, array) => {
                if (x === undefined) return false;
                for (let i = index + 1; i < array.length; i++) {
                  if (array[i] && x.elapsed > array[i].elapsed) return false;
                }
                return true;
              });

              if (earliest) {
                x = earliest.x;
                y = earliest.y;
                angle = earliest.angle;
                elapsed = elapsed - earliest.elapsed;
              } else {
                break;
              }
            }

            let pos = move(x, y, speed, angle, elapsed);
            this.x = pos.x;
            this.y = pos.y;
          }
        }

        movePractice(paddlePos1) {
          let dx = this.x + this.speed * Math.cos(this.angle);
          let dy = this.y + this.speed * Math.sin(this.angle);
          let angle = this.angle;

          if (dx >= frameRight - bRad) {
            dx = frameRight - bRad - (frameRight - bRad - dx);
            angle = Math.PI - angle;
          }
          if (dx <= frameLeft + bRad) {
            dx = frameLeft + bRad + (frameLeft + bRad - dx);
            angle = Math.PI - angle;
          }
          if (dy < frameTop + bRad) {
            dy = frameTop + bRad + (frameTop + bRad - dy);
            angle = -angle;
          }
          if (dy > frameBottom) {
            dy -= frameBottom - frameTop - bRad;

            let oneTimeMiss1 = true;
            if (!this.miss && oneTimeMiss1) {
              miss1++;
              this.miss = true;
            }
          }

          if (dy > py - bRad && dy < py) {
            if (dx > paddlePos1 - bRad && dx < paddlePos1 + pWidth + bRad) {
              let impact = dx + bRad - (paddlePos1 + 0.5 * pWidth);
              let offset = impact / (pWidth * 0.5) / 2;
              if (PHYSICS_MODE === 'breakout') {
                let steerAngle = (impact / (pWidth * 0.5)) * deg2rad(55);
                let newA = -Math.PI / 2 + steerAngle;
                newA = 0.7 * newA + 0.3 * (-angle);
                if (newA < -deg2rad(160)) newA = -deg2rad(160);
                if (newA > -deg2rad(20))  newA = -deg2rad(20);
                angle = newA;
              } else if (-angle + offset <= -deg2rad(upperLim)) {
                angle = -angle;
              } else if (-angle + offset >= -deg2rad(lowLim)) {
                angle = -angle;
              } else {
                angle = -angle + offset;
              }
              dy = py - (py - dy) - bRad;
              let oneTimeHit1 = true;
              if (!this.hit && oneTimeHit1) {
                hits1++;
                this.hit = true;
              }
            }
          }

          if (dy < frameBottom * 0.33 && dy < frameBottom * 0.67) {
            this.hit = false;
            this.miss = false;
          }

          this.x = dx;
          this.y = dy;
          this.angle = angle;
        }
        draw() {
          expContext.beginPath();
          expContext.arc(this.x, this.y, this.size, 0, Math.PI * 2);
          expContext.fillStyle = this.colour;
          expContext.fill();
          expContext.stroke();
        }
      }
      class Paddle {
        constructor(x, colour) {
          this.x = x;
          this.colour = colour;
          this.coords = [];
        }
        move(mvLeft = false, mvRight = false, speed) {
          let playerId = state.player_id;
          let otherId = playerId === "0" ? "1" : "0";
          let theirPos = state.players[otherId].pos;

          if (mvLeft) {
            this.x -= speed;
            if (this.x <= frameLeft) {
              this.x = frameLeft;
            }
          }
          if (mvRight) {
            this.x += speed;
            if (this.x + pWidth >= frameRight) {
              this.x = frameRight - pWidth;
            }
          }
        }

        draw() {
          expContext.beginPath();
          expContext.rect(this.x, py, pWidth, pHeight);
          expContext.fillStyle = this.colour;
          expContext.fill();
          expContext.stroke();
        }
      }
      class DRT {
        constructor() {}
        draw(drtColour) {
          expContext.beginPath();
          expContext.rect(drtLeft, frameTop, drtWidth, frameHeight);
          expContext.fillStyle = drtColour;
          expContext.fill();
          expContext.stroke();
        }
      }

      function roundedRect(ctx, x, y, width, height, radius, fill, stroke) {
        ctx.strokeStyle = "black";
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + width, y, x + width, y + radius, radius);
        ctx.arcTo(
          x + width,
          y + height,
          x + width - radius,
          y + height,
          radius
        );
        ctx.arcTo(x, y + height, x, y + height - radius, radius);
        ctx.arcTo(x, y, x + radius, y, radius);
        if (fill) {
          ctx.fill();
        }
        if (stroke) {
          ctx.stroke();
        }
        ctx.strokeStyle = "black";
      }
      function drawKeyDepth(x, y) {
        expContext.strokeStyle = "black";
        expContext.beginPath();
        expContext.moveTo(x - 10, y - 10);
        expContext.lineTo(x + 30, y + 30);
        expContext.moveTo(x + 29, y - 9);
        expContext.lineTo(x - 10, y + 29);
        expContext.stroke();
        expContext.strokeStyle = fontColour;
      }
      function drawKey(
        ctx,
        faceVal,
        x,
        y,
        width,
        height,
        radius,
        fill,
        stroke,
        specialChar
      ) {
        // Perimeter / Base
        ctx.lineWidth = 4;
        roundedRect(ctx, x - 10, y - 10, width, height, radius, false, stroke);
        // Key top
        expContext.lineWidth = 3;
        drawKeyDepth(x, y);
        expContext.fillStyle = fontColour;
        fontColour;
        roundedRect(
          ctx,
          x - 5,
          y - 6,
          width - 10,
          height - 10,
          radius - 1,
          true,
          stroke
        );
        // Key Content
        expContext.fillStyle = frameColour;
        if (specialChar) {
          // used for the directional arrows
          var uni = '"\\u' + faceVal + '"';
          var faceVal = eval(uni);
        }
        expContext.fillText(faceVal, x + 10, y + 10);
        ctx.lineWidth = 1;
        expContext.fillStyle = fontColour;
      }
