/* paddle-exp · rendering.js */
/* globals: all shared vars declared in setup.js */

      function entryPageStyling() {
        drawPanel(25, 25, 20, "#62bb47");
        drawPanel(45, 45, 20, "#fcb827");
        drawPanel(65, 65, 20, "#f6821f");
        drawPanel(85, 85, 20, "#e03a3e");
        drawPanel(105, 105, 20, "#963d97");
        drawPanel(125, 125, 20, "#009ddc");
      }
      function drawPanel(xCross, yCross, width, fillColour) {
        // xCross is where on the top of the screen it crosses the screen, yCross is the same but for the left of screen
        expContext.fillStyle = fillColour;
        expContext.beginPath();
        expContext.moveTo(xCross, frameTop);
        expContext.lineTo(xCross + width, frameTop);
        expContext.lineTo(0, yCross + width);
        expContext.lineTo(0, yCross);
        expContext.fill();
      }

      function drawInstControls() {
        // CONTROLS
        let x = expCanvas.width / 2 - 110;
        let y = 25;
        let bitColours = [
          "#6500ab",
          "#f20794",
          "#d60003",
          "#f1983a",
          "#fcf351",
        ];
        let sz = 5;
        let gridLength = 42;
        let gridRows = 5;
        let gridVals = {
          1: [
            2, 3, 4, 7, 8, 11, 15, 17, 18, 19, 20, 21, 24, 25, 29, 30, 33, 38,
            39, 40,
          ],
          2: [1, 6, 9, 11, 12, 15, 19, 23, 26, 28, 31, 33, 37],
          3: [1, 6, 9, 11, 13, 15, 19, 23, 24, 25, 28, 31, 33, 38, 39],
          4: [1, 6, 9, 11, 14, 15, 19, 23, 25, 28, 31, 33, 40],
          5: [
            2, 3, 4, 7, 8, 11, 15, 19, 23, 26, 29, 30, 33, 34, 35, 37, 38, 39,
          ],
        };
        for (let r = 1; r <= gridRows; r++) {
          let colour = bitColours[r - 1];
          let gridCounter = 1;
          for (let c = 1; c <= gridLength; c++) {
            if (gridVals[r].includes(gridCounter)) {
              drawBit(x + sz * gridCounter, y + r * sz, sz, sz, colour);
            }
            gridCounter++;
          }
        }
      }

      function drawGameTitle() {
        // TEAM SPIRIT — pixel art title
        // sz=6 makes each pixel 6x6 CSS pixels, centred at 800/2=400
        // Grid is 50 columns wide → total width = 50*6 = 300px → start at 400-150=250
        let sz = 6;
        let x = expCanvas.width / 2 - (50 * sz) / 2;
        let y = 12;
        let bitColours = [
          "#6500ab",
          "#f20794",
          "#d60003",
          "#f1983a",
          "#fcf351",
        ];
        let gridLength = 50;
        let gridRows = 10;
        let gridVals = {
          1: [1, 2, 3, 4, 5, 28, 29, 30, 31, 48],
          2: [3, 27, 32, 48],
          3: [3, 27, 48],
          4: [
            3, 7, 8, 9, 13, 14, 16, 18, 20, 22, 27, 34, 36, 39, 41, 43, 46, 48,
            49, 50,
          ],
          5: [
            3, 6, 10, 12, 15, 16, 18, 19, 21, 23, 28, 29, 30, 31, 34, 35, 37,
            41, 42, 44, 48,
          ],
          6: [3, 6, 10, 12, 16, 18, 21, 23, 32, 34, 37, 39, 41, 46, 48],
          7: [
            3, 6, 7, 8, 9, 12, 16, 18, 21, 23, 32, 34, 35, 36, 39, 41, 46, 48,
          ],
          8: [3, 6, 12, 16, 18, 23, 32, 34, 39, 41, 46, 48],
          9: [3, 6, 10, 12, 15, 16, 18, 23, 27, 32, 34, 39, 41, 46, 48, 50],
          10: [
            3, 7, 8, 9, 13, 14, 16, 18, 23, 28, 29, 30, 31, 34, 39, 41, 46, 49,
          ],
        };
        let colourCounter = 0;
        for (let r = 1; r <= gridRows; r++) {
          let colour = bitColours[colourCounter];
          let gridCounter = 1;
          for (let c = 1; c <= gridLength; c++) {
            if (gridVals[r].includes(gridCounter)) {
              drawBitGlow(x + sz * gridCounter, y + r * sz, sz, sz, colour);
            }
            gridCounter++;
          }
          if (r % 2 == 0) {
            colourCounter++;
          }
        }
      }
      function drawTrialEnd() {
        //TRIAL OVER
        let x = expCanvas.width / 2 - 110;
        let y = 50;
        let bitColours = [
          "#6500ab",
          "#f20794",
          "#d60003",
          "#f1983a",
          "#fcf351",
        ];
        let sz = 5;
        let gridLength = 42;
        let gridRows = 5;
        let gridVals = {
          1: [
            1, 2, 3, 4, 5, 7, 8, 9, 12, 15, 16, 19, 25, 26, 29, 33, 35, 36, 37,
            39, 40, 41,
          ],
          2: [3, 7, 10, 12, 14, 17, 19, 24, 27, 29, 33, 35, 39, 42],
          3: [
            3, 7, 8, 9, 12, 14, 15, 16, 17, 19, 24, 27, 29, 33, 35, 36, 39, 40,
            41,
          ],
          4: [3, 7, 9, 12, 14, 17, 19, 24, 27, 30, 32, 35, 39, 41],
          5: [3, 7, 10, 12, 14, 17, 19, 20, 21, 25, 26, 31, 35, 36, 37, 39, 42],
        };
        for (let r = 1; r <= gridRows; r++) {
          let colour = bitColours[r - 1];
          let gridCounter = 1;
          for (let c = 1; c <= gridLength; c++) {
            if (gridVals[r].includes(gridCounter)) {
              drawBit(x + sz * gridCounter, y + r * sz, sz, sz, colour);
            }
            gridCounter++;
          }
        }
      }


      function drawBit(x, y, width, height, colour) {
        // Outer dark outline pixel
        expContext.fillStyle = fontColour;
        expContext.fillRect(x, y, width, height);
        // Coloured fill, inset 1px
        expContext.fillStyle = colour;
        expContext.fillRect(x - 1, y - 1, width - 1, height - 1);
      }

      function drawBitGlow(x, y, width, height, colour, glowColour) {
        // Same as drawBit but with a soft glow shadow — used for the title
        expContext.shadowColor = glowColour || colour;
        expContext.shadowBlur = 6;
        expContext.fillStyle = fontColour;
        expContext.fillRect(x, y, width, height);
        expContext.fillStyle = colour;
        expContext.fillRect(x - 1, y - 1, width - 1, height - 1);
        expContext.shadowBlur = 0;
      }

      // It is important to reward goal achievement
      let fireworks = [];
      let pxSize = 10;
      class Spark {
        constructor(x, y, angle, maxRadius) {
          this.x = x;
          this.y = y;
          this.angle = angle;
          this.maxRadius = maxRadius;
          this.radius = 0;
          this.xOld = x;
          this.yOld = y;
          this.opacityModifier = 0.5 + Math.random() * 0.5;
        }
        update() {
          const radiusIncrease =
            (Math.sqrt(this.maxRadius) *
              Math.pow(this.maxRadius - this.radius, 3)) /
            Math.pow(this.maxRadius, 3);
          this.radius += radiusIncrease;
          this.y += 0.5;
        }
        draw(ctx, colour, baseAlpha) {
          const dx = Math.cos(this.angle) * this.radius;
          const dy = Math.sin(this.angle) * this.radius;
          ctx.globalAlpha = baseAlpha * this.opacityModifier;

          ctx.fillStyle = colour;
          ctx.fillRect(p(this.x + dx), p(this.y + dy), pxSize, pxSize);

          this.xOld = p(this.x + dx - 1);
          this.yOld = p(this.y + dy - 1);
        }
      }
      class Firework {
        constructor(x, y, altitude, colour, size) {
          this.x = x;
          this.y = y;
          this.altitude = altitude;
          this.sparks = [];
          this.colour = colour;
          this.size = size;
          this.explodedAt = null;
          this.opacity = 1;
        }
        _createSparks() {
          const numSparks = this.size / Math.pow(pxSize, 1 / 3);
          for (let i = 0; i < numSparks; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const maxRadius = (1 - Math.pow(Math.random(), 2)) * this.size;
            this.sparks.push(
              new Spark(this.x, this.altitude, angle, maxRadius)
            );
          }
          this.explodedAt = new Date();
        }
        update() {
          if (this.y <= this.altitude) {
            if (this.explodedAt) {
              this.sparks.forEach((s) => s.update());

              const timeSinceBoomBoom = new Date() - this.explodedAt;
              const expansionDuration = 2000;

              if (timeSinceBoomBoom >= expansionDuration) {
                const timeSinceComplete = timeSinceBoomBoom - expansionDuration;
                const fade = 1000;
                if (timeSinceComplete <= fade) {
                  this.opacity = 1 - timeSinceComplete / fade;
                } else {
                  this.opacity = 0;
                }
              }
            } else {
              this._createSparks();
            }
          } else {
            this.y -= 5;
          }
          return this.opacity;
        }

        draw(ctx) {
          if (this.explodedAt) {
            ctx.fillStyle = this.colour;
            this.sparks.forEach((s) => s.draw(ctx, this.colour, this.opacity));
          } else {
            // ctx.fillStyle = fontColour;
            // ctx.fillRect(p(this.x), p(this.y), pxSize, pxSize)
            ctx.beginPath();
            ctx.arc(p(this.x), p(this.y), bRad, 0, Math.PI * 2);
            ctx.fillStyle = this.colour;
            ctx.fill();
            ctx.stroke();
          }
        }
      }

      function getColour() {
        const fireworkColours = [
          "#1abc9c",
          "#2ecc71",
          "#3498db",
          "#9b59b6",
          "#f1c40f",
          "#e67e22",
          "#e74c3c",
          "#ecf0f1",
        ];
        return fireworkColours[
          Math.floor(Math.random() * fireworkColours.length)
        ];
      }
      function p(x) {
        return pxSize * Math.round(x / pxSize);
      }
      function drawFireWorks() {
        if (dispFireworks) {
          fwCtx.clearRect(0, 0, expCanvas.width, expCanvas.height);

          if (Math.random() < 0.01) {
            const x = frameWidth * 0.25 + Math.random() * frameWidth * 0.5;
            const y = frameBottom;
            const altitude =
              frameHeight * 0.25 + Math.random() * frameHeight * 0.5;
            const minDimension = Math.min(frameHeight, frameWidth);
            const size = Math.max(
              minDimension * 0.1,
              Math.random() * minDimension * 0.5
            );

            fireworks.push(new Firework(x, y, altitude, getColour(), size));
          }
          fireworks = fireworks.filter((f) => f.update());
          fireworks.forEach((f) => f.draw(fwCtx));
          celebrAF = requestAnimationFrame(drawFireWorks);
        }
      }

      // instructions bordering
      function drawWaitingRoomTimer() {
        // draws the timer and returns the time remaining
        if (drawWaitingRoomScientist) {
          expTimeout = waitingRoomTimer(totalWait, waitingRoomStart);
          waiter = requestAnimationFrame(drawWaitingRoomTimer);
          // if (expTimeout <= 0){
          //     expTimeout = 0;
          //     cancelAnimationFrame(waiter);
          //     return
          // }
          if (expTimeout % 4 > 3) {
            waitType = "down";
          } else {
            waitType = "up";
          }
          drawWaiter(expCanvas.width / 2 - 80, 409, 2, waitType);
        } else {
          cancelAnimationFrame(waiter);
          fwCtx.clearRect(0, 0, expCanvas.width, expCanvas.height);
          return;
        }
      }

      function drawWaiterBG(x, y, pxSize) {
        waiterBackground = [
          18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18,
          18, 18, 18, 18, 16, 18, 16, 18, 18, 18, 18, 18, 18, 18, 16, 16, 16,
          18, 16, 18, 18, 18, 16, 16, 16, 16, 18, 18, 18, 18, 18, 18, 18, 18,
          18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18,
          18, 18, 16, 18, 16, 18, 16, 18, 16, 16, 18, 18, 16, 16, 16, 18, 16,
          18, 18, 16, 16, 18, 16, 18, 18, 16, 18, 16, 18, 18, 18, 18, 18, 18,
          18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18,
          16, 16, 16, 16, 16, 18, 16, 16, 16, 16, 16, 18, 18, 16, 16, 18, 16,
          16, 16, 16, 16, 18, 18, 16, 18, 16, 16, 18, 18, 18, 18, 18, 18, 18,
          18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 16, 16,
          16, 16, 16, 14, 16, 16, 16, 16, 14, 16, 18, 16, 16, 18, 16, 16, 16,
          18, 18, 14, 16, 16, 16, 18, 16, 18, 18, 18, 16, 18, 18, 18, 18, 18,
          18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18,
          18, 16, 18, 16, 18, 18, 18, 18, 14, 14, 18, 18, 18, 18, 18, 16, 16,
          16, 16, 16, 16, 18, 16, 16, 18, 16, 16, 16, 16, 18, 18, 18, 18, 18,
          18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18,
          18, 18, 18, 16, 18, 16, 18, 18, 18, 14, 18, 18, 16, 16, 18, 14, 18,
          16, 16, 16, 16, 16, 18, 16, 18, 16, 16, 18, 18, 18, 18, 18, 18, 18,
          18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18,
          18, 16, 16, 16, 18, 18, 16, 16, 18, 14, 16, 16, 16, 14, 16, 18, 18,
          16, 16, 16, 16, 16, 18, 16, 16, 14, 18, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
          5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 16, 16, 16, 5, 5, 16, 16, 16,
          16, 5, 14, 5, 16, 16, 16, 16, 16, 16, 16, 5, 16, 4, 16, 16, 14, 16,
          18, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
          16, 16, 16, 14, 16, 16, 5, 16, 5, 16, 16, 5, 16, 5, 5, 16, 5, 16, 16,
          14, 16, 16, 16, 4, 18, 16, 16, 18, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
          5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 16, 16, 14, 16, 5, 16, 16, 5,
          5, 5, 16, 16, 5, 5, 5, 14, 16, 5, 16, 16, 4, 16, 18, 16, 18, 5, 5, 5,
          5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 16,
          16, 16, 5, 16, 14, 14, 14, 5, 5, 14, 14, 14, 5, 14, 14, 5, 16, 4, 4,
          16, 18, 16, 18, 18, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
          5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 14, 14, 14, 14, 5, 5, 5, 14,
          14, 5, 5, 5, 4, 4, 4, 18, 18, 18, 18, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
          4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 14,
          14, 14, 4, 14, 14, 4, 4, 4, 4, 4, 4, 4, 18, 18, 18, 18, 3, 3, 3, 3, 3,
          3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
          3, 3, 3, 3, 3, 3, 13, 14, 14, 14, 14, 3, 3, 1, 1, 1, 18, 18, 18, 18,
          18, 18, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
          3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 13, 14, 14, 14, 14, 3, 3, 1, 1,
          1, 18, 18, 18, 18, 18, 18, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
          3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 13, 14,
          14, 14, 3, 3, 1, 1, 1, 18, 18, 18, 18, 18, 18, 3, 7, 7, 7, 7, 7, 7, 7,
          3, 3, 3, 3, 3, 3, 7, 7, 7, 7, 7, 7, 3, 3, 3, 3, 7, 7, 7, 7, 7, 7, 3,
          3, 3, 3, 3, 13, 14, 14, 14, 3, 3, 1, 1, 1, 18, 18, 18, 18, 18, 18, 3,
          8, 8, 8, 8, 8, 8, 8, 3, 3, 3, 3, 3, 3, 8, 8, 8, 8, 8, 8, 3, 3, 3, 3,
          8, 8, 8, 8, 8, 8, 3, 3, 3, 3, 3, 13, 13, 14, 14, 3, 3, 1, 1, 1, 18,
          18, 18, 18, 18, 18, 3, 8, 8, 8, 8, 8, 8, 8, 3, 3, 3, 3, 3, 3, 8, 8, 8,
          8, 8, 8, 3, 3, 3, 3, 8, 8, 8, 8, 8, 8, 3, 3, 3, 3, 3, 13, 14, 14, 14,
          3, 3, 1, 1, 1, 18, 18, 18, 18, 18, 18, 3, 8, 8, 8, 8, 8, 8, 8, 3, 3,
          3, 3, 3, 3, 8, 8, 8, 8, 8, 8, 3, 3, 3, 3, 8, 8, 8, 8, 8, 8, 3, 3, 3,
          3, 3, 13, 14, 14, 14, 3, 3, 1, 1, 1, 18, 18, 18, 18, 18, 18, 3, 8, 8,
          8, 8, 8, 8, 8, 3, 3, 3, 3, 3, 3, 8, 8, 8, 8, 8, 8, 3, 3, 3, 3, 8, 8,
          8, 8, 8, 8, 3, 3, 3, 3, 3, 13, 14, 14, 14, 3, 3, 1, 1, 1, 18, 18, 18,
          18, 18, 18, 3, 8, 8, 8, 8, 8, 8, 8, 3, 3, 3, 3, 3, 3, 8, 8, 8, 8, 8,
          8, 3, 3, 3, 3, 8, 8, 8, 8, 8, 8, 3, 3, 3, 3, 3, 13, 14, 13, 14, 3, 3,
          1, 1, 1, 18, 18, 18, 18, 18, 18, 3, 7, 7, 7, 7, 7, 7, 7, 3, 3, 3, 3,
          3, 3, 7, 7, 7, 7, 7, 7, 3, 3, 3, 3, 7, 7, 7, 7, 7, 7, 3, 3, 3, 3, 3,
          13, 13, 14, 14, 3, 3, 1, 1, 1, 18, 18, 18, 18, 18, 18, 3, 3, 3, 3, 3,
          3, 3, 3, 3, 3, 3, 3, 3, 3, 7, 7, 7, 7, 7, 7, 3, 3, 3, 3, 7, 7, 7, 7,
          7, 7, 3, 3, 3, 3, 3, 13, 14, 14, 14, 3, 3, 1, 1, 1, 18, 18, 18, 18,
          18, 18, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 7, 7, 7, 7, 7, 7, 3,
          3, 3, 3, 7, 7, 7, 7, 7, 7, 3, 3, 3, 3, 3, 13, 14, 14, 14, 3, 3, 1, 1,
          1, 18, 18, 18, 18, 18, 15, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
          7, 7, 7, 7, 7, 7, 3, 3, 3, 3, 7, 7, 7, 7, 7, 7, 3, 3, 3, 3, 3, 13, 14,
          14, 14, 3, 3, 15, 1, 15, 18, 18, 18, 18, 15, 18, 3, 3, 3, 3, 3, 3, 3,
          3, 3, 3, 3, 3, 3, 3, 7, 7, 7, 7, 7, 7, 3, 3, 3, 3, 7, 7, 7, 7, 7, 7,
          3, 3, 3, 3, 3, 13, 13, 14, 14, 3, 3, 15, 1, 1, 15, 18, 18, 15, 15, 18,
          3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 8, 8, 8, 8, 8, 8, 3, 3, 3,
          3, 8, 8, 8, 8, 8, 8, 3, 3, 3, 3, 3, 13, 14, 14, 15, 3, 3, 1, 15, 15,
          18, 15, 18, 15, 18, 18, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 8,
          8, 8, 8, 8, 8, 3, 3, 3, 3, 8, 8, 8, 8, 8, 8, 3, 3, 3, 3, 3, 13, 14,
          14, 14, 15, 15, 1, 1, 15, 15, 18, 15, 18, 15, 18, 3, 3, 3, 3, 3, 3, 3,
          3, 3, 3, 3, 3, 3, 3, 8, 8, 8, 8, 8, 8, 3, 3, 3, 3, 8, 17, 8, 8, 8, 8,
          3, 3, 3, 3, 3, 13, 14, 14, 14, 3, 15, 15, 15, 15, 18, 15, 15, 15, 18,
          18, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 8, 8, 8, 8, 8, 8, 3, 3,
          3, 3, 8, 8, 17, 8, 8, 17, 3, 3, 3, 3, 3, 13, 14, 14, 15, 15, 15, 15,
          13, 12, 11, 11, 15, 15, 15, 18, 3, 3, 10, 10, 10, 10, 10, 3, 3, 3, 3,
          3, 3, 3, 8, 8, 8, 8, 8, 8, 3, 3, 3, 3, 17, 8, 8, 8, 17, 8, 17, 3, 3,
          3, 3, 13, 14, 14, 14, 15, 3, 15, 13, 12, 11, 11, 15, 15, 18, 18, 3, 3,
          10, 12, 12, 12, 10, 3, 3, 3, 3, 3, 3, 3, 7, 7, 7, 7, 7, 7, 17, 3, 3,
          17, 7, 17, 7, 17, 7, 7, 3, 3, 3, 3, 3, 13, 14, 14, 14, 3, 15, 15, 13,
          12, 11, 11, 15, 18, 18, 15, 3, 3, 10, 12, 12, 12, 10, 3, 3, 3, 3, 3,
          3, 3, 7, 7, 7, 7, 7, 17, 3, 3, 3, 3, 7, 17, 7, 17, 7, 17, 17, 3, 3, 3,
          13, 14, 14, 14, 14, 15, 15, 15, 13, 12, 12, 12, 15, 18, 15, 18, 3, 3,
          10, 12, 12, 12, 10, 3, 3, 3, 3, 3, 3, 3, 7, 7, 7, 17, 7, 17, 3, 3, 3,
          3, 7, 7, 17, 17, 7, 17, 3, 17, 3, 3, 13, 14, 14, 15, 14, 15, 3, 15,
          13, 12, 11, 12, 15, 15, 15, 18, 3, 3, 10, 12, 12, 9, 10, 3, 3, 3, 3,
          3, 3, 3, 7, 7, 17, 7, 17, 7, 3, 3, 3, 3, 7, 7, 17, 17, 17, 7, 3, 3, 3,
          3, 13, 13, 14, 14, 15, 3, 15, 15, 13, 12, 11, 12, 15, 15, 16, 16, 3,
          3, 10, 12, 12, 12, 10, 3, 3, 3, 3, 3, 3, 3, 7, 7, 7, 7, 17, 7, 17, 3,
          3, 3, 7, 7, 7, 17, 17, 7, 3, 3, 3, 3, 13, 14, 14, 14, 14, 15, 3, 15,
          13, 12, 11, 12, 15, 15, 15, 16, 3, 3, 10, 12, 12, 12, 10, 3, 3, 3, 3,
          3, 3, 3, 7, 7, 7, 7, 17, 17, 3, 17, 3, 3, 7, 7, 7, 17, 7, 7, 3, 3, 3,
          3, 13, 13, 14, 14, 14, 3, 15, 15, 13, 12, 11, 12, 15, 15, 16, 16, 9,
          9, 9, 9, 9, 9, 9, 9, 9, 6, 6, 6, 6, 3, 7, 7, 7, 7, 17, 7, 3, 3, 3, 3,
          7, 7, 7, 17, 7, 7, 3, 3, 3, 13, 13, 14, 14, 14, 14, 14, 3, 15, 13, 12,
          12, 12, 15, 16, 16, 16, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 6, 6, 6, 6, 2,
          2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 14, 14, 14, 14, 14, 2,
          2, 14, 14, 14, 2, 13, 12, 12, 12, 16, 16, 16, 16, 15, 15, 15, 15, 15,
          15, 15, 15, 9, 9, 9, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
          6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 2, 2, 2, 2, 13, 12, 12, 12, 2, 16,
          16, 16, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15,
          15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 2,
          2, 2, 1, 6, 6, 6, 6, 2, 2, 2, 2, 2, 2, 2, 2, 16, 16, 16, 15, 16, 15,
          16, 15, 16, 15, 16, 15, 16, 15, 16, 15, 16, 15, 16, 15, 16, 15, 16,
          15, 16, 15, 16, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 2, 1, 6,
          6, 6, 6, 1, 1, 2, 2, 2, 2, 2, 2, 15, 16, 15, 16, 15, 16, 15, 16, 15,
          16, 15, 16, 15, 16, 15, 16, 15, 16, 15, 16, 15, 16, 15, 16, 15, 16,
          15, 16, 15, 16, 15, 15, 15, 15, 15, 15, 15, 15, 2, 6, 6, 6, 6, 6, 1,
          2, 2, 2, 2, 2, 16, 15, 16, 15, 16, 15, 16, 15, 16, 15, 16, 15, 16, 15,
          16, 15, 16, 15, 16, 15, 16, 15, 16, 15, 16, 15, 16, 15, 16, 15, 16,
          15, 16, 15, 15, 15, 15, 15, 15, 2, 1, 6, 6, 6, 6, 1, 1, 2, 2, 2, 16,
          16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16,
          16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16,
          16, 16, 16, 16, 16, 2, 1, 1, 6, 6, 6, 6, 1, 1, 2, 17, 17, 17, 17, 17,
          17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17,
          17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17,
          17, 17, 17, 1, 1, 6, 6, 6, 6, 6, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1,
        ];
        waiterBGColours = [
          "#7C4B38",
          "#B5755B",
          "#B3793F",
          "#BAB733",
          "#D0D058",
          "#AEAAAA",
          "#BFBFBF",
          "#808080",
          "#757171",
          "#3A3838",
          "#000000",
          "#FFFFFF",
          "#DDEBF7",
          "#FCEEEF",
          "#A9D08E",
          "#81BA5A",
          "#186a3b",
          "#BDD7EE",
        ];
        let row = 0;

        for (let i = 0; i < waiterBackground.length; i++) {
          expContext.fillStyle = waiterBGColours[waiterBackground[i] - 1];
          if (i % 50 == 0) {
            row++;
          }
          xPos = x + (i % 50) * pxSize;
          yPos = y + row * pxSize;
          if (waiterBackground[i] == 3) {
            let grd = expContext.createLinearGradient(
              xPos,
              yPos,
              xPos + pxSize,
              yPos + pxSize
            );
            grd.addColorStop(0, "#7C4B38");
            grd.addColorStop(0.75, "#B3793F");
            expContext.fillStyle = grd;
          }
          if (waiterBackground[i] == 5) {
            let grd = expContext.createLinearGradient(
              xPos,
              yPos,
              xPos,
              yPos + pxSize
            );
            grd.addColorStop(0, "#BAB733");
            grd.addColorStop(0.1, "#D0D058");
            expContext.fillStyle = grd;
          }
          expContext.fillRect(xPos, yPos, pxSize, pxSize);
        }
      }
      function drawWaiter(x, y, pxSize, waitType) {
        fwCtx.clearRect(0, 0, expCanvas.width, expCanvas.height);
        // 8 squares wide, 17 high
        waiter = {
          up: [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 0, 0, 0, 0, 0, 5, 4, 4, 0, 0,
            0, 0, 0, 5, 4, 4, 0, 0, 0, 0, 0, 0, 4, 4, 0, 0, 0, 0, 3, 3, 3, 3, 3,
            3, 0, 3, 0, 3, 3, 3, 3, 0, 3, 4, 0, 3, 3, 3, 3, 0, 4, 4, 0, 3, 3, 3,
            3, 0, 4, 0, 4, 3, 3, 3, 3, 4, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 2, 2,
            2, 2, 0, 0, 0, 0, 0, 2, 0, 2, 0, 0, 0, 0, 0, 2, 0, 2, 0, 0, 0, 0, 0,
            2, 0, 2, 0, 0, 0, 0, 0, 2, 0, 2, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0,
          ],
          down: [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 0, 0,
            0, 0, 0, 5, 4, 4, 0, 0, 0, 0, 0, 5, 4, 4, 0, 0, 0, 0, 0, 0, 4, 4, 0,
            0, 0, 0, 3, 3, 3, 3, 3, 3, 0, 3, 0, 3, 3, 3, 3, 0, 3, 4, 0, 3, 3, 3,
            3, 0, 4, 4, 0, 3, 3, 3, 3, 0, 4, 0, 4, 3, 3, 3, 3, 4, 0, 0, 0, 2, 2,
            2, 2, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 2, 0, 2, 0, 0, 0, 0, 2,
            0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 2, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0,
          ],
        };
        waiterColours = ["#000000", "#801E56", "#002060", "#F8CBAD", "#58472E"];
        let row = 0;
        let currentWaiter = waiter[waitType];
        for (let i = 0; i < waiter.up.length; i++) {
          fwCtx.fillStyle = waiterColours[currentWaiter[i] - 1];
          if (i % 8 == 0) {
            row++;
          }
          xPos = x + (i % 8) * pxSize;
          yPos = y + row * pxSize;
          if (currentWaiter[i] == 0) {
            continue;
          }
          fwCtx.fillRect(xPos, yPos, pxSize, pxSize);
        }
      }

      // Set Instructions
      function waitingRoom() {
        bInWaiting = true;
        // Draw pixel art waiter on the canvas underneath the overlay
        drawCanvas(fontColour);
        drawFrame();
        drawWaiterBG(expCanvas.width / 2 - 125, 30, 5);
        drawWaitingRoomTimer();
        OV.show('ov-waiting');
      }

      function waitingRoomTimer(totalWaitTime, start) {
        let timeRemaining;
        let startTime = Date.now();
        timeRemaining = (startTime - start) / 1000; //+totalWaitTime;
        let dispTime = timeRemaining.toFixed(0);

        return timeRemaining;
      }
      function userEntry() {
        ws.send(JSON.stringify({ platformID: username1 }));
        if (state.status === "waiting") {
          drawWaitingRoomScientist = true;
          waitingRoom();
        } else {
          instructions1();
          drawWaitingRoomScientist = false;
        }
      }

      function instructions1() {
        bInInstructions1 = true;
        drawCanvas(fontColour); drawFrame(); drawGameTitle();
        INST.show(1);
      }

            function instructionsOnline() {
        bInInstructionsOnline = true;
        drawCanvas(fontColour); drawFrame(); drawGameTitle();
        let ptxt = document.getElementById('ov-partner-text');
        if (botratheon && ptxt) {
          if (ambigubot) {
            ptxt.innerHTML = 'During this experiment you will be collaborating and competing with another player.';
          } else {
            ptxt.innerHTML = 'Your partner in this experiment is a <strong>computer agent</strong> designed to play the game. Bot performance can be very good, so the collaborative and competitive conditions will be challenging!';
          }
        }
        INST.show(2);
      }

            function instructions2() {
        bInInstructions2 = true;
        drawCanvas(fontColour); drawFrame(); drawInstControls();
        INST.show(3);
      }

      function selectHand(handChoice) {
        // Called by the Right/Left hand buttons on the controls page.
        // Sets all the key bindings and updates the server.
        if (handChoice === 'Left') {
          hand1 = 'left';
          p1Hand = [LHdrtRespKey];
          plyr1DRTrespKey = LHdrtRespKey;
          left  = LHleft;
          right = LHright;
          ws.send(JSON.stringify({ hand: 'Left' }));
        } else {
          hand1 = 'right';
          p1Hand = [RHdrtRespKey];
          plyr1DRTrespKey = RHdrtRespKey;
          left  = RHleft;
          right = RHright;
          ws.send(JSON.stringify({ hand: 'Right' }));
        }
        p1HandChosen = true;
        drawnKeys = true;
        showChosenControls();

        // Highlight the selected button, dim the other
        const rBtn = document.getElementById('hand-btn-right');
        const lBtn = document.getElementById('hand-btn-left');
        if (rBtn && lBtn) {
          if (handChoice === 'Right') {
            rBtn.style.borderColor = 'var(--accent)';
            rBtn.style.color       = 'var(--accent)';
            lBtn.style.opacity     = '0.4';
          } else {
            lBtn.style.borderColor = 'var(--accent)';
            lBtn.style.color       = 'var(--accent)';
            rBtn.style.opacity     = '0.4';
          }
        }
      }

      function showChosenControls() {
        let cdisp = document.getElementById('ov-controls-display');
        let ctxt  = document.getElementById('ov-controls-text');
        if (!cdisp) return;
        cdisp.style.display = 'block';
        if (plyr1DRTrespKey == RHdrtRespKey) {
          ctxt.innerHTML = 'Move with your <strong>right hand</strong> (← → arrow keys). Respond to the light with your <strong>left hand</strong> (Z key).';
          OV.buildKeys('ov-controls-keys', [
            { label: 'Move paddle', keys: [{sym:'←', small:true}, {sym:'→', small:true}] },
            { label: 'Light response', keys: [{sym:'Z'}] }
          ]);
        } else {
          ctxt.innerHTML = 'Move with your <strong>left hand</strong> (Z and C keys). Respond to the light with your <strong>right hand</strong> (↑ arrow key).';
          OV.buildKeys('ov-controls-keys', [
            { label: 'Move paddle', keys: [{sym:'Z'}, {sym:'C'}] },
            { label: 'Light response', keys: [{sym:'↑', small:true}] }
          ]);
        }
        // Unlock continue
        if (INST.step === 3) {
          INST.canContinue = true;
          proceed = true;
          const nav = document.getElementById('ov-nav');
          if (nav) nav.classList.add('visible');
        }
      }

            function instructions3() {
        bInInstructions3 = true;
        drawCanvas(fontColour); drawFrame(); drawInstControls();
        if (plyr1DRTrespKey == RHdrtRespKey) {
          OV.buildKeys('ov-drt-keys', [{ label: 'Non-dominant (left) hand', keys: [{sym:'Z'}] }]);
        } else {
          OV.buildKeys('ov-drt-keys', [{ label: 'Non-dominant (right) hand', keys: [{sym:'↑', small:true}] }]);
        }
        INST.show(4);
      }

            function instructions4() {
        bInInstructions4 = true;
        drawCanvas(fontColour); drawFrame();
        let t = document.getElementById('ov-inst5-text');
        if (t) t.textContent = show_drt
          ? "Now let's practice a full-length trial with more balls and the light together."
          : "Now let's practice a full-length trial with more balls!";
        INST.show(5);
      }

            function instructionsEnd() {
        bInInstructionsEnd = true;
        drawCanvas(fontColour); drawFrame();
        INST.show(6);
      }

            function drawPracInst(time) {
        expContext.fillStyle = p1Colour;   // uses p1 colour, not hardcoded red
        expContext.font = "bold 18px var(--font-display, 'Space Grotesk', sans-serif)";
        expContext.textAlign = "center";
        expContext.fillText(
          "PRACTICE TRIAL",
          frameLeft + frameWidth / 2,
          frameTop + 40
        );
        expContext.fillStyle = fontColour;
        expContext.font = "14px var(--font-body, 'DM Sans', sans-serif)";

        if (time > practiceTrialDuration - dirInst) {
          if (bInPaddlePractice) {
            if (plyr1DRTrespKey == RHdrtRespKey) {
              expContext.fillText(
                "Left arrow to move left",
                frameLeft + frameWidth / 2,
                frameBottom - frameHeight / 4
              );
              expContext.fillText(
                "Right arrow to move right",
                frameLeft + frameWidth / 2,
                frameBottom - frameHeight / 4 + 25
              );
            } else {
              expContext.fillText(
                "'Z' to move left",
                frameLeft + frameWidth / 2,
                frameBottom - frameHeight / 4
              );
              expContext.fillText(
                "'C' to move right",
                frameLeft + frameWidth / 2,
                frameBottom - frameHeight / 4 + 25
              );
            }
          } else if (bInDRTPractice) {
            expContext.fillText(
              "Light Response:",
              expCanvas.width / 2,
              frameBottom - frameHeight / 4 - 25
            );
            if (plyr1DRTrespKey == RHdrtRespKey) {
              expContext.fillText(
                "Press 'Z'",
                expCanvas.width / 2,
                frameBottom - frameHeight / 4
              );
            } else {
              expContext.fillText(
                "Press 'UP' arrow",
                expCanvas.width / 2,
                frameBottom - frameHeight / 4
              );
            }
          }
        }
      }
