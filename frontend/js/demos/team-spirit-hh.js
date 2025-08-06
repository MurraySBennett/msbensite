// This script will be loaded by experiment-demo-loader.js
// It's responsible for injecting its HTML structure into #demo-area
// and running the interactive logic for the Team Spirit game.

// Define the HTML structure for the Team Spirit demo
// This will be injected into the #demo-area of experiment-demo-viewer.html
const demoHtml = `
    <style>
        /* Specific styles for the Team Spirit Demo */
        #game-container-inner { /* Renamed from #game-container to avoid ID conflict with main HTML */
            position: relative;
            width: 800px; /* Game frame width */
            height: 600px; /* Game frame height */
            background-color:#fffacd;
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            overflow: hidden;
            border-radius: 0; /* Make edges square */
            border: 4px solid #FFD700; /* Outer orange border */
            box-shadow: 0 0 0 4px #FFA500, /* Inner yellow panel */
                        0 0 0 8px rgb(255, 77, 0); /* Outer red panel (extends beyond the yellow) */
        }

        #game-container-inner canvas {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1;
        }

        #game-container-inner #fireworks {
            z-index: 2;
        }

        /* General text and headings within the game */
        #game-container-inner h1, #game-container-inner h2, #game-container-inner h3, #game-container-inner {
            font-family: 'Press Start 2P', cursive; /* Retro font for headings */
            color: #6A5ACD; /* SlateBlue */
            text-shadow: 1px 1px 0px rgba(0,0,0,0.1);
            text-align: center;
            margin: 0;
            padding: 0;
        }

        .overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(255, 250, 205, 0.95); /* Semi-transparent Lemon Chiffon */
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 100;
            padding: 20px;
            box-sizing: border-box;
        }

        .overlay-content {
            background-color: #fffacd;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 100%;
            text-align: center;
        }

        .overlay-content p {
            font-family: 'Inter', sans-serif;
            font-size: 1.1em;
            line-height: 1.6;
            margin-bottom: 15px;
            color: #333;
        }

        .overlay-button {
            background-color: #98fb98; /* PaleGreen */
            color: #FFF;
            font-family: 'Press Start 2P', cursive;
            padding: 15px 30px;
            font-size: 1.1em;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 5px 10px rgba(0,0,0,0.2);
            margin-top: 20px;
            text-shadow:
                -1px -1px 0 black,  /* Top-left shadow */
                1px -1px 0 black,   /* Top-right shadow */
                -1px 1px 0 black,   /* Bottom-left shadow */
                1px 1px 0 black;    /* Bottom-right shadow */
        }

        .overlay-button:hover {
            background-color: #3CB371; /* MediumSeaGreen */
            color: #fff; /* White text */
            transform: translateY(-3px);
           box-shadow: 0 8px 15px rgba(0,0,0,0.3);
            text-shadow:
                -1px -1px 0 black,  /* Top-left shadow */
                1px -1px 0 black,   /* Top-right shadow */
                -1px 1px 0 black,   /* Bottom-left shadow */
                1px 1px 0 black;    /* Bottom-right shadow */
        }

        #score-display {
            position: absolute;
            top: 60px;
            width: 100%;
            display: flex;
            justify-content: space-around;
            font-family: 'Press Start 2P', cursive;
            font-size: 1em;
            color: #6A5ACD;
            z-index: 50;
        }
        #score-display div {
            background-color: rgba(255, 255, 255, 0.8);
            padding: 5px 10px;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        #score-display span {
            color: #333;
            margin-left: 10px;
        }

        #timer-display {
            position: absolute;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            font-family: 'Press Start 2P', cursive;
            font-size: 1em;
            color: #6A5ACD;
            background-color: rgba(255, 255, 255, 0.8);
            padding: 5px 10px;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            z-index: 50;
        }

        #block-info { /* Renamed from #practice-info */
            position: absolute;
            bottom: 20px;
            width: 100%;
            text-align: center;
            font-family: 'Press Start 2P', cursive;
            color: #6A5ACD;
            font-size: 1em;
            z-index: 50;
        }
    </style>
    <div id="game-container-inner">
        <canvas id="canvas" width="800" height="600"></canvas>
        <canvas id="fireworks" width="800" height="600"></canvas>

        <div id="score-display">
            <div id="p1-score-display-container">P1 Score: <span id="p1-score">0</span></div>
            <div id="p2-score-display-container">P2 Score: <span id="p2-score">0</span></div>
            <div id="team-score-display-container">Team Score: <span id="team-score">0</span></div>
        </div>
        <div id="timer-display">Time: <span id="game-timer">0</span>s</div>
        <div id="block-info" style="display:none;"></div>

        <div id="instructions-overlay" class="overlay">
            <div class="overlay-content">
                <h2>Welcome to Team Spirit!</h2>
                <p>This is a 2-player local demo. You and a friend (or two hands!) will control paddles to hit flying balls to score points.</p>
                <p>
                    <strong>Player 1 (Red Paddle):</strong><br>
                    Left: 'A' | Right: 'D'
                </p>
                <p>
                    <strong>Player 2 (Blue Paddle):</strong><br>
                    Left: 'Left Arrow' | Right: 'Right Arrow'
                </p>
                <p>Try to hit as many balls as possible within the time limit!</p>
                <button id="start-game-button" class="overlay-button">Start Game</button>
            </div>
        </div>

        <div id="block-instructions-overlay" class="overlay" style="display:none;">
            <div class="overlay-content">
                <h3 id="block-instruction-title">Block Instructions</h3>
                <p id="block-instruction-text"></p>
                <button id="continue-block-button" class="overlay-button">Continue</button>
            </div>
        </div>

        <div id="end-game-overlay" class="overlay" style="display:none;">
            <div class="overlay-content">
                <h2 id="end-game-title">Game Over!</h2>
                <p>Final Scores:</p>
                <p>Player 1: <span id="final-p1-score">0</span></p>
                <p>Player 2: <span id="final-p2-score">0</span></p>
                <p>Team Score: <span id="final-team-score">0</span></p>
                <button id="restart-game-button" class="overlay-button">Play Again</button>
            </div>
        </div>
    </div>
`;

// Inject the HTML into the #demo-area of the viewer page
const demoArea = document.getElementById("demo-area");
if (demoArea) {
  demoArea.innerHTML = demoHtml;
} else {
  console.error("Could not find #demo-area to inject Team Spirit demo.");
}

// --- Configuration ---
const conf = {
  trialDuration: 15, // Total game duration in seconds (6 blocks * 10s/block)
  paddleWidthRatio: 0.1, // Paddle width as a ratio of frameWidth
  paddleHeightRatio: 0.02, // Paddle height as a ratio of frameHeight
  paddleSpeedFactor: 0.5, // Speed factor for paddles (pixels per frame)
  ballRadiusRatio: 0.015, // Ball radius as a ratio of frameHeight
  ballSpeedFactor: 0.25, // Ball speed factor (pixels per ms)
  ballSpawnInterval: 0, // Milliseconds between ball spawns (continuous spawn)
  frameWidth: 800,
  frameHeight: 600,
  frameLeft: 0,
  frameRight: 800,
  frameTop: 0,
  frameBottom: 600,
  paddleY: 550, // Y position of paddles
  p1Colour: "FireBrick", // Red
  p2Colour: "RoyalBlue", // Blue
  ballColour: "purple", // Shared ball color for team game
  fontColour: "black",
  ballHitScore: 1,
  blocks: [
    {
      type: "separate",
      nBalls: 2,
      description: "Only hit balls that match the colour of your paddle!",
    }, // 3 balls per player * 2 players = 6 total
    {
      type: "separate",
      nBalls: 6,
      description: "Only hit balls that match the colour of your paddle!",
    }, // 6 balls per player * 2 players = 12 total
    {
      type: "collaborative",
      nBalls: 2,
      description: "Work together to score as high as you can!",
    }, // 6 total
    {
      type: "collaborative",
      nBalls: 6,
      description: "Work together to score as high as you can!",
    }, // 12 total
    {
      type: "competitive",
      nBalls: 2,
      description: "Try to outscore your opponent!",
    }, // 6 total
    {
      type: "competitive",
      nBalls: 6,
      description: "Try to outscore your opponent!",
    }, // 12 total
  ],
  // Key codes for player 1 (A, D) and player 2 (Left Arrow, Right Arrow)
  p1LeftKey: "KeyA",
  p1RightKey: "KeyD",
  p2LeftKey: "ArrowLeft",
  p2RightKey: "ArrowRight",
};

// Derived constants
conf.pWidth = conf.frameWidth * conf.paddleWidthRatio;
conf.pHeight = conf.frameHeight * conf.paddleHeightRatio;
conf.bRad = conf.frameHeight * conf.ballRadiusRatio;
conf.pSpeed = conf.paddleSpeedFactor;
conf.bSpeed = conf.ballSpeedFactor;

// --- Game State ---
let state = {
  gamePhase: "INSTRUCTIONS", // 'INSTRUCTIONS', 'BLOCK_INSTRUCTIONS', 'RUNNING', 'GAME_OVER'
  currentBlockIndex: 0,
  currentBlockStartTime: 0,
  gameStartTime: 0,
  p1Score: 0, // Score for the current block
  p2Score: 0, // Score for the current block
  teamScore: 0, // Score for the current block
  overallP1Score: 0, // Cumulative score across all blocks
  overallP2Score: 0, // Cumulative score across all blocks
  overallTeamScore: 0, // Cumulative score across all blocks
  p1Left: false,
  p1Right: false,
  p2Left: false,
  p2Right: false,
  allBalls: [],
  paddle1: null,
  paddle2: null,
  expContext: null, // Main canvas context
  fireworksContext: null, // Fireworks canvas context
  lastFrameTime: 0,
  ballSpawnTimer: 0,
  gameEnded: false, // Flag to prevent multiple endGame calls
};

// --- DOM Element References ---
let $canvas, $fireworksCanvas;
let $p1ScoreDisplay, $p2ScoreDisplay, $teamScoreDisplay, $gameTimerDisplay;
let $p1ScoreDisplayContainer,
  $p2ScoreDisplayContainer,
  $teamScoreDisplayContainer; // New references for containers
let $instructionsOverlay, $blockInstructionsOverlay, $endGameOverlay;
let $startGameButton, $continueBlockButton, $restartGameButton;
let $finalP1Score, $finalP2Score, $finalTeamScore;
let $blockInfo, $blockInstructionTitle, $blockInstructionText;

// --- Helper Functions ---
function deg2rad(degrees) {
  return degrees * (Math.PI / 180);
}

// function disableScroll() {
//   // Get the current page scroll position
//   const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
//   const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

//   // if any scroll is attempted, set this to the previous value
//   window.onscroll = function () {
//     window.scrollTo(scrollLeft, scrollTop);
//   };
// }

// --- Sprite Classes ---
class Ball {
  constructor(x, y, colour, playerAssignment = null) {
    this.x = x;
    this.y = y;
    this.size = conf.bRad;
    this.colour = colour;
    this.speed = conf.bSpeed;
    // Initial angle to be downwards, not too flat
    this.angle = Math.random() * Math.PI * 0.6 + Math.PI * 0.2; // Angle between 36 and 144 degrees (downwards)
    if (Math.random() < 0.5) this.angle = -this.angle; // Randomly flip direction for variety
    this.playerAssignment = playerAssignment; // 'p1', 'p2', or null for team balls
    this.hit = false; // Flag to track if hit in current bounce cycle
  }

  move(elapsed) {
    let dx = this.speed * Math.cos(this.angle) * elapsed;
    let dy = this.speed * Math.sin(this.angle) * elapsed;

    this.x += dx;
    this.y += dy;

    // Wall collisions
    if (
      this.x + this.size > conf.frameRight ||
      this.x - this.size < conf.frameLeft
    ) {
      this.angle = Math.PI - this.angle; // Reflect horizontally
      this.x = Math.max(
        conf.frameLeft + this.size,
        Math.min(conf.frameRight - this.size, this.x)
      ); // Clamp
    }
    if (this.y - this.size < conf.frameTop) {
      this.angle = -this.angle; // Reflect vertically
      this.y = conf.frameTop + this.size; // Clamp
    }

    // Paddle collision (only if moving downwards and near paddle Y)
    if (
      this.angle > 0 &&
      this.y + this.size >= conf.paddleY &&
      this.y < conf.paddleY + conf.pHeight
    ) {
      let collided = false;
      let hitPaddle = null; // To know which paddle hit it

      if (
        this.x + this.size > state.paddle1.x &&
        this.x - this.size < state.paddle1.x + conf.pWidth
      ) {
        collided = true;
        hitPaddle = "p1";
      } else if (
        this.x + this.size > state.paddle2.x &&
        this.x - this.size < state.paddle2.x + conf.pWidth
      ) {
        collided = true;
        hitPaddle = "p2";
      }

      if (collided) {
        // Prevent multiple hits per bounce and ensure it's a new collision
        const currentBlockType = conf.blocks[state.currentBlockIndex].type;
        if (currentBlockType === "separate") {
          if (this.playerAssignment && this.playerAssignment !== hitPaddle) {
            // If this ball is assigned to a player, it should only be hit by that player
            return true; // Keep ball if not hit by the correct paddle
          }
        }
        if (!this.hit) {
          this.hit = true; // Mark as hit for this bounce cycle
          this.angle = -this.angle; // Reflect vertically

          // Adjust angle based on where it hit the paddle (Pong-like physics)
          let paddleX = hitPaddle === "p1" ? state.paddle1.x : state.paddle2.x;
          let impactOffset =
            (this.x - (paddleX + conf.pWidth / 2)) / (conf.pWidth / 2);
          this.angle += impactOffset * (Math.PI / 4); // Max 45 degree deflection

          // Ensure angle is within reasonable bounds (e.g., not too flat)
          const minAngle = deg2rad(40); // 20 degrees
          if (Math.abs(this.angle) < minAngle) {
            this.angle = Math.sign(this.angle) * minAngle;
          }

          // Update scores based on block type and who hit it
          if (currentBlockType === "separate") {
            // In separate mode, only score if hit matches paddle color
            if (this.playerAssignment === hitPaddle) {
              if (hitPaddle === "p1") state.p1Score += conf.ballHitScore;
              else state.p2Score += conf.ballHitScore;
            }
            state.teamScore = state.p1Score + state.p2Score; // Team score is sum of individual scores
          } else if (currentBlockType === "collaborative") {
            state.p1Score += conf.ballHitScore / 2; // Split score for individual display
            state.p2Score += conf.ballHitScore / 2;
            state.teamScore += conf.ballHitScore;
          } else if (currentBlockType === "competitive") {
            if (hitPaddle === "p1") {
              state.p1Score += conf.ballHitScore;
            } else if (hitPaddle === "p2") {
              state.p2Score += conf.ballHitScore;
            }
            state.teamScore = state.p1Score + state.p2Score; // Team score is sum of competitive scores
          }
        }
        this.y = conf.paddleY - this.size; // Clamp above paddle
      }
    }

    // Bottom wall (miss)
    if (this.y + this.size > conf.frameBottom) {
      // Ball went past the paddle
      if (this.y > conf.frameBottom) {
        // Ensure it's truly off-screen
        // No penalty for missing balls as per request
        // Mark ball for removal
        return false;
      }
    } else if (this.y < conf.paddleY) {
      // Reset hit flag once ball is above paddle line
      this.hit = false;
    }
    return true; // Keep ball if not missed
  }

  draw() {
    state.expContext.beginPath();
    state.expContext.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    state.expContext.fillStyle = this.colour;
    state.expContext.fill();
    state.expContext.stroke();
  }
}

class Paddle {
  constructor(x, colour) {
    this.x = x;
    this.colour = colour;
  }

  move(mvLeft, mvRight, elapsed) {
    const speed = conf.pSpeed * elapsed; // Scale speed by elapsed time

    if (mvLeft) {
      this.x -= speed;
      if (this.x <= conf.frameLeft) {
        this.x = conf.frameLeft;
      }
    }
    if (mvRight) {
      this.x += speed;
      if (this.x + conf.pWidth >= conf.frameRight) {
        this.x = conf.frameRight - conf.pWidth;
      }
    }
  }

  draw() {
    state.expContext.beginPath();
    state.expContext.rect(this.x, conf.paddleY, conf.pWidth, conf.pHeight);
    state.expContext.fillStyle = this.colour;
    state.expContext.fill();
    state.expContext.stroke();
  }
}

// --- Game Initialization ---
function initializeGameElements() {
  // Select elements within the injected HTML
  $canvas = document.getElementById("canvas");
  $fireworksCanvas = document.getElementById("fireworks");
  state.expContext = $canvas.getContext("2d");
  state.fireworksContext = $fireworksCanvas.getContext("2d");

  $p1ScoreDisplay = document.getElementById("p1-score");
  $p2ScoreDisplay = document.getElementById("p2-score");
  $teamScoreDisplay = document.getElementById("team-score");
  $gameTimerDisplay = document.getElementById("game-timer");

  // Get references to the score display containers
  $p1ScoreDisplayContainer = document.getElementById(
    "p1-score-display-container"
  );
  $p2ScoreDisplayContainer = document.getElementById(
    "p2-score-display-container"
  );
  $teamScoreDisplayContainer = document.getElementById(
    "team-score-display-container"
  );

  $instructionsOverlay = document.getElementById("instructions-overlay");
  $blockInstructionsOverlay = document.getElementById(
    "block-instructions-overlay"
  ); // New
  $endGameOverlay = document.getElementById("end-game-overlay");
  $startGameButton = document.getElementById("start-game-button");
  $continueBlockButton = document.getElementById("continue-block-button"); // New
  $restartGameButton = document.getElementById("restart-game-button");
  $finalP1Score = document.getElementById("final-p1-score");
  $finalP2Score = document.getElementById("final-p2-score");
  $finalTeamScore = document.getElementById("final-team-score");
  $blockInfo = document.getElementById("block-info"); // Renamed
  $blockInstructionTitle = document.getElementById("block-instruction-title"); // New
  $blockInstructionText = document.getElementById("block-instruction-text"); // New

  state.paddle1 = new Paddle(
    conf.frameWidth / 4 - conf.pWidth / 2,
    conf.p1Colour
  );
  state.paddle2 = new Paddle(
    (conf.frameWidth * 3) / 4 - conf.pWidth / 2,
    conf.p2Colour
  );

  //   disableScroll(); // Disable page scrolling
}

// --- Game Loop ---
let animationFrameId = null; // To store the requestAnimationFrame ID

function gameLoop(currentTime) {
  if (!state.lastFrameTime) state.lastFrameTime = currentTime;
  const elapsed = currentTime - state.lastFrameTime;
  state.lastFrameTime = currentTime;

  update(elapsed);
  draw();

  if (state.gamePhase === "RUNNING") {
    animationFrameId = requestAnimationFrame(gameLoop);
  }
}

function update(elapsed) {
  // Calculate total elapsed game time
  const totalElapsedTime = (performance.now() - state.gameStartTime) / 1000;

  // Update game timer display
  const remainingGameTime = Math.max(
    0,
    conf.trialDuration - Math.floor(totalElapsedTime)
  );
  $gameTimerDisplay.textContent = remainingGameTime;

  // Update trial timer and transition blocks
  const trialElapsedTime =
    (performance.now() - state.currentBlockStartTime) / 1000;
  if (trialElapsedTime >= conf.trialDuration) {
    // Add current block scores to overall scores
    state.overallP1Score += state.p1Score;
    state.overallP2Score += state.p2Score;
    state.overallTeamScore += state.teamScore;

    // Reset current block scores for the new block
    state.p1Score = 0;
    state.p2Score = 0;
    state.teamScore = 0;
    state.paddle1.x = conf.frameWidth / 4 - conf.pWidth / 2;
    state.paddle2.x = (conf.frameWidth * 3) / 4 - conf.pWidth / 2;

    if (state.currentBlockIndex < conf.blocks.length - 1) {
      state.currentBlockIndex++;
      showBlockInstructions(); // Show instructions for the next block
      state.allBalls = state.allBalls.filter((ball) => {
        ball.x = conf.frameWidth / 2;
        ball.y = conf.frameTop + conf.bRad;
      });
      return; // Exit update loop, wait for user to continue
    } else {
      // All blocks completed, end the game
      endGame();
      return; // Exit update loop
    }
  }

  // Paddle movement
  state.paddle1.move(state.p1Left, state.p1Right, elapsed);
  state.paddle2.move(state.p2Left, state.p2Right, elapsed);

  // Ball spawning
  state.ballSpawnTimer += elapsed;
  const currentBlock = conf.blocks[state.currentBlockIndex];
  // Only spawn up to the maxBallsOnScreen for the current block
  if (
    state.ballSpawnTimer >= conf.ballSpawnInterval &&
    state.allBalls.length < currentBlock.nBalls
  ) {
    spawnBall();
    state.ballSpawnTimer = 0;
  }

  // Update and filter balls
  state.allBalls = state.allBalls.filter((ball) => {
    // The ball.move method now returns false if the ball is missed and should be removed
    return ball.move(elapsed);
  });

  // Update scores display (current block scores)
  $p1ScoreDisplay.textContent = state.p1Score;
  $p2ScoreDisplay.textContent = state.p2Score;
  $teamScoreDisplay.textContent = state.teamScore;
}

function draw() {
  // Clear canvases
  state.expContext.clearRect(0, 0, conf.frameWidth, conf.frameHeight);
  state.fireworksContext.clearRect(0, 0, conf.frameWidth, conf.frameHeight); // Clear fireworks canvas

  // Draw paddles
  state.paddle1.draw();
  state.paddle2.draw();

  // Draw balls
  state.allBalls.forEach((ball) => ball.draw());
}

function spawnBall() {
  const currentBlock = conf.blocks[state.currentBlockIndex];
  const x = conf.frameWidth / 2; // Start in the middle top
  const y = conf.frameTop + conf.bRad;
  let ballColor = conf.ballColour;
  let playerAssignment = null; // No specific player by default

  if (currentBlock.type === "separate") {
    // In separate mode, alternate ball assignment for P1 and P2 specific balls
    playerAssignment =
      state.allBalls.filter((b) => b.playerAssignment === "p1").length <
      currentBlock.nBalls / 2
        ? "p1"
        : "p2";
    ballColor = playerAssignment === "p1" ? conf.p1Colour : conf.p2Colour;
  } else if (
    currentBlock.type === "collaborative" ||
    currentBlock.type === "competitive"
  ) {
    // For collaborative and competitive, balls are shared and are the default purple
    ballColor = conf.ballColour;
  }

  state.allBalls.push(new Ball(x, y, ballColor, playerAssignment));
}

function startGame() {
  // Initial setup for the first block's instructions
  state.gamePhase = "BLOCK_INSTRUCTIONS";
  state.currentBlockIndex = 0; // Ensure starting from the first block
  state.gameEnded = false; // Reset game ended flag

  // Reset all scores for a fresh game start
  state.p1Score = 0;
  state.p2Score = 0;
  state.teamScore = 0;
  state.overallP1Score = 0;
  state.overallP2Score = 0;
  state.overallTeamScore = 0;

  // Hide initial instructions and end game overlay
  $instructionsOverlay.style.display = "none";
  $endGameOverlay.style.display = "none";

  // Show block instructions for the first block
  showBlockInstructions();
}

function showBlockInstructions() {
  state.gamePhase = "BLOCK_INSTRUCTIONS";
  cancelAnimationFrame(animationFrameId); // Stop the game loop if it's running

  const currentBlock = conf.blocks[state.currentBlockIndex];
  $blockInstructionTitle.textContent = `Starting trial ${
    state.currentBlockIndex + 1
  } of ${conf.blocks.length}`;
  $blockInstructionText.textContent = currentBlock.description;

  $blockInstructionsOverlay.style.display = "flex";
  $blockInfo.style.display = "none"; // Hide block info during instructions
  updateScoreDisplayVisibility(currentBlock.type); // Update score display visibility for the upcoming block
}

function continueToNextBlock() {
  state.gamePhase = "RUNNING";
  state.gameStartTime = performance.now(); // Reset game timer for the new block
  state.currentBlockStartTime = performance.now(); // Reset block timer
  state.allBalls = []; // Clear balls for new block type
  state.ballSpawnTimer = 0; // Reset spawn timer

  $blockInstructionsOverlay.style.display = "none";
  $blockInfo.style.display = "block"; // Show block info
  //   $blockInfo.textContent = `Block ${state.currentBlockIndex + 1}/${
  // conf.blocks.length
  //   }: ${conf.blocks[state.currentBlockIndex].description}`;

  animationFrameId = requestAnimationFrame(gameLoop); // Restart the game loop
}

function endGame() {
  if (state.gameEnded) return; // Prevent multiple calls
  state.gameEnded = true;
  state.gamePhase = "GAME_OVER";
  cancelAnimationFrame(animationFrameId); // Stop the game loop

  // Final update to cumulative scores for the last block
  state.overallP1Score += state.p1Score;
  state.overallP2Score += state.p2Score;
  state.overallTeamScore += state.teamScore;

  $finalP1Score.textContent = state.overallP1Score.toFixed(0);
  $finalP2Score.textContent = state.overallP2Score.toFixed(0);
  $finalTeamScore.textContent = state.overallTeamScore.toFixed(0);
  $endGameOverlay.style.display = "flex";
  $blockInfo.style.display = "none"; // Hide block info
  updateScoreDisplayVisibility("game_over"); // Hide all scores for game over screen
}

function resetGame() {
  // Reset all state variables to initial values
  state.gamePhase = "INSTRUCTIONS";
  state.currentBlockIndex = 0;
  state.currentBlockStartTime = 0;
  state.gameStartTime = 0;
  state.p1Score = 0;
  state.p2Score = 0;
  state.teamScore = 0;
  state.overallP1Score = 0;
  state.overallP2Score = 0;
  state.overallTeamScore = 0;
  state.p1Left = false;
  state.p1Right = false;
  state.p2Left = false;
  state.p2Right = false;
  state.allBalls = [];
  state.lastFrameTime = 0;
  state.ballSpawnTimer = 0;
  state.gameEnded = false;
  cancelAnimationFrame(animationFrameId); // Ensure any running loop is stopped

  // Reset paddle positions
  state.paddle1.x = conf.frameWidth / 4 - conf.pWidth / 2;
  state.paddle2.x = (conf.frameWidth * 3) / 4 - conf.pWidth / 2;

  // Update display to reflect reset scores and timer
  $p1ScoreDisplay.textContent = "0";
  $p2ScoreDisplay.textContent = "0";
  $teamScoreDisplay.textContent = "0";
  $gameTimerDisplay.textContent = conf.trialDuration;

  // Show initial instructions overlay and hide others
  $instructionsOverlay.style.display = "flex";
  $blockInstructionsOverlay.style.display = "none";
  $endGameOverlay.style.display = "none";
  $blockInfo.style.display = "none";
  updateScoreDisplayVisibility("initial"); // Show all scores for initial state
}

// New function to control score display visibility
function updateScoreDisplayVisibility(blockType) {
  if (blockType === "collaborative") {
    $p1ScoreDisplayContainer.style.display = "none";
    $p2ScoreDisplayContainer.style.display = "none";
    $teamScoreDisplayContainer.style.display = "block";
  } else if (blockType === "separate" || blockType === "competitive") {
    $p1ScoreDisplayContainer.style.display = "block";
    $p2ScoreDisplayContainer.style.display = "block";
    $teamScoreDisplayContainer.style.display = "none";
  } else {
    // 'initial' or 'game_over'
    $p1ScoreDisplayContainer.style.display = "none";
    $p2ScoreDisplayContainer.style.display = "none";
    $teamScoreDisplayContainer.style.display = "none";
  }
}

// --- Event Listeners ---
function setupEventListeners() {
  $startGameButton.addEventListener("click", startGame);
  $continueBlockButton.addEventListener("click", continueToNextBlock); // New listener
  $restartGameButton.addEventListener("click", resetGame);

  document.addEventListener("keydown", (e) => {
    if (state.gamePhase !== "RUNNING") {
      return; // Only process paddle keys during RUNNING phase
    }

    switch (e.code) {
      case conf.p1LeftKey:
        state.p1Left = true;
        break;
      case conf.p1RightKey:
        state.p1Right = true;
        break;
      case conf.p2LeftKey:
        state.p2Left = true;
        break;
      case conf.p2RightKey:
        state.p2Right = true;
        break;
    }
  });

  document.addEventListener("keyup", (e) => {
    switch (e.code) {
      case conf.p1LeftKey:
        state.p1Left = false;
        break;
      case conf.p1RightKey:
        state.p1Right = false;
        break;
      case conf.p2LeftKey:
        state.p2Left = false;
        break;
      case conf.p2RightKey:
        state.p2Right = false;
        break;
    }
  });

  // Handle window resize for canvas responsiveness (optional but good practice)
  window.addEventListener("resize", () => {
    // For this fixed-size game, we'll just ensure it remains centered.
  });
}

// Main initialization sequence for the demo
// This runs immediately when the script is loaded by the demo loader.
initializeGameElements(); // Call this AFTER demoHtml is injected
setupEventListeners(); // Set up event listeners
resetGame(); // Set initial state and show instructions
