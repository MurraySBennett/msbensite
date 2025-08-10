// Pong game canvas and logic
const pongGameArea = document.getElementById("game-area");
const pongTrigger = document.getElementById("pong");

let pongRunning = false;
let pongAnimationId;
let fadeStarted;

// Create canvas inside game-area for Pong
const canvas = document.createElement("canvas");
canvas.width = 600;
canvas.height = 250;
canvas.style.background = "#352a51";
canvas.style.display = "block";
canvas.style.margin = "0 auto";
pongGameArea.appendChild(canvas);
const ctx = canvas.getContext("2d");

// Pong variables
const paddleHeight = 40;
const paddleWidth = 8;
const ballRadius = 6;
const initialBallSpeedX = 3;
const initialBallSpeedY = 2;
const maxBallSpeed = 8;
const speedIncrement = 0.005;

let leftPaddleY = (canvas.height - paddleHeight) / 2;
let rightPaddleY = (canvas.height - paddleHeight) / 2;
let ballX = canvas.width / 2;
let ballY = canvas.height / 2;
let ballSpeedX = 3;
let ballSpeedY = 2;

function moveRightPaddle() {
  const paddleCenter = rightPaddleY + paddleHeight / 2;
  const diff = ballY - paddleCenter;
  const speed = 4;

  if (Math.abs(diff) > 5) {
    rightPaddleY += diff > 0 ? speed : -speed;
  }

  // Clamp paddle inside canvas
  rightPaddleY = Math.max(
    Math.min(rightPaddleY, canvas.height - paddleHeight),
    0
  );
}

let leftScore = 0;
let rightScore = 0;
const winningScore = 3;
let gameOver = false;

// Draw game objects
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background black
  ctx.fillStyle = "#352a51";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Net
  ctx.fillStyle = "#fff";
  for (let i = 10; i < canvas.height; i += 20) {
    ctx.fillRect(canvas.width / 2 - 1, i, 2, 10);
  }

  // Left paddle
  ctx.fillRect(10, leftPaddleY, paddleWidth, paddleHeight);

  // Right paddle
  ctx.fillRect(
    canvas.width - 10 - paddleWidth,
    rightPaddleY,
    paddleWidth,
    paddleHeight
  );

  // Ball
  ctx.beginPath();
  ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
  ctx.fill();

  // Draw scores
  ctx.fillStyle = "#fff";
  ctx.font = "16px 'Press Start 2P', monospace";
  ctx.fillText(leftScore, 50, 20);
  ctx.fillText(rightScore, canvas.width - 50, 20);

  if (gameOver) {
    ctx.fillStyle = leftScore === winningScore ? "#0f0" : "#f00";
    ctx.font = "1rem 'Press Start 2P', monospace";
    const winner = leftScore === winningScore ? "You Won!" : "You Lost!";
    const text = `${winner}`;
    const textWidth = ctx.measureText(text).width;
    ctx.fillText(text, (canvas.width - textWidth) / 2, canvas.height / 2);
  }
}

// Game update loop

function update() {
  if (gameOver) {
    draw(); // Draw the final frame with the winning message

    if (!fadeStarted) {
      fadeStarted = true;

      // Wait 2 seconds showing the message, then fade and clear
      setTimeout(() => {
        pongGameArea.classList.add("game-over");

        setTimeout(() => {
          pongGameArea.classList.remove("game-over");
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          canvas.style.display = "none";
          window.gameActive = false;
          pongRunning = false;
          gameOver = false;
          fadeStarted = false;
          leftScore = 0;
          rightScore = 0;
        }, 500); // Fade duration
      }, 2000); // Pause before fade
    }

    return; // Stop further updates
  }
  // Move ball
  ballX += ballSpeedX;
  ballY += ballSpeedY;
  // Move left paddle by speed, then clamp within canvas
  leftPaddleY += leftPaddleSpeed;
  leftPaddleY = Math.max(
    0,
    Math.min(leftPaddleY, canvas.height - paddleHeight)
  );

  // Bounce top/bottom (with reposition fix you have)
  if (ballY - ballRadius < 0) {
    ballSpeedY = -ballSpeedY;
    ballY = ballRadius;
  }
  if (ballY + ballRadius > canvas.height) {
    ballSpeedY = -ballSpeedY;
    ballY = canvas.height - ballRadius;
  }

  // Bounce left paddle
  if (
    ballX - ballRadius < 10 + paddleWidth &&
    ballX - ballRadius > 10 &&
    ballY > leftPaddleY &&
    ballY < leftPaddleY + paddleHeight
  ) {
    ballSpeedX = -ballSpeedX;
    ballX = 10 + paddleWidth + ballRadius;

    let deltaY = ballY - (leftPaddleY + paddleHeight / 2);
    ballSpeedY = deltaY * 0.3;
  }

  // Bounce right paddle
  if (
    ballX + ballRadius > canvas.width - 10 - paddleWidth &&
    ballX + ballRadius < canvas.width - 10 && // added boundary check
    ballY > rightPaddleY &&
    ballY < rightPaddleY + paddleHeight
  ) {
    ballSpeedX = -ballSpeedX;
    ballX = canvas.width - 10 - paddleWidth - ballRadius;

    let deltaY = ballY - (rightPaddleY + paddleHeight / 2);
    ballSpeedY = deltaY * 0.3;
  }
  if (ballX < 0) {
    rightScore++;
    resetBall();
  }
  if (ballX > canvas.width) {
    leftScore++;
    resetBall();
  }
  if (leftScore === winningScore || rightScore === winningScore) {
    gameOver = true;
  }

  // Gradually increase speed (but keep the direction)
  if (Math.abs(ballSpeedX) < maxBallSpeed) {
    ballSpeedX += ballSpeedX > 0 ? speedIncrement : -speedIncrement;
  }
  if (Math.abs(ballSpeedY) < maxBallSpeed) {
    ballSpeedY += ballSpeedY > 0 ? speedIncrement : -speedIncrement;
  }

  moveRightPaddle();
  draw();
  pongAnimationId = requestAnimationFrame(update);
}

function resetBall() {
  ballX = canvas.width / 2;
  ballY = canvas.height / 2;
  ballSpeedX = initialBallSpeedX * (Math.random() < 0.5 ? 1 : -1);
  ballSpeedY = initialBallSpeedY;
}

// Move left paddle with mouse over canvas
// canvas.addEventListener("mousemove", (e) => {
//   const rect = canvas.getBoundingClientRect();
//   let mouseY = e.clientY - rect.top;
//   leftPaddleY = mouseY - paddleHeight / 2;
//   // Clamp inside canvas
//   leftPaddleY = Math.max(
//     Math.min(leftPaddleY, canvas.height - paddleHeight),
//     0
//   );
// });
let leftPaddleSpeed = 0; // vertical speed of the paddle

document.addEventListener("keydown", (e) => {
  if (!pongRunning) return; // only react if game is running
  if (e.key === "ArrowUp") {
    e.preventDefault();
    leftPaddleSpeed = -5; // move paddle up
  } else if (e.key === "ArrowDown") {
    leftPaddleSpeed = 5; // move paddle down
    e.preventDefault();
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    leftPaddleSpeed = 0; // stop paddle when key released
  }
});

// Toggle Pong game on clicking the pong <p>
pongTrigger.addEventListener("click", () => {
  if (window.gameActive) {
    return;
  }
  window.gameActive = true;
  if (!pongRunning) {
    pongRunning = true;
    gameOver = false;
    leftScore = 0;
    rightScore = 0;
    resetBall();
    canvas.style.display = "block";
    update();

    // Add these event listeners ONLY when the game starts
    document.addEventListener("keydown", handlePongKeyDown);
    document.addEventListener("keyup", handlePongKeyUp);
  } else {
    // Game is running, this branch should be for ending the game
    window.gameActive = false;
    pongRunning = false;
    cancelAnimationFrame(pongAnimationId);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.display = "none";

    // REMOVE the listeners when the game ends
    document.removeEventListener("keydown", handlePongKeyDown);
    document.removeEventListener("keyup", handlePongKeyUp);
  }
});

// Move your keydown/keyup functions here and rename them
function handlePongKeyDown(e) {
  if (e.key === "ArrowUp") {
    e.preventDefault();
    leftPaddleSpeed = -5; // move paddle up
  } else if (e.key === "ArrowDown") {
    leftPaddleSpeed = 5; // move paddle down
    e.preventDefault();
  }
}

function handlePongKeyUp(e) {
  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    leftPaddleSpeed = 0; // stop paddle when key released
  }
}

canvas.style.display = "none";
