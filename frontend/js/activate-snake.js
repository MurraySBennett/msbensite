// Trigger on clicking your name
document
  .querySelector(".profile-info h1")
  .addEventListener("click", startSnakeGame);

function startSnakeGame() {
  if (window.gameActive) return;
  window.gameActive = true;
  window.stopCurrentGame = endGame;

  const snakeGameArea = document.getElementById("game-area");
  snakeGameArea.innerHTML = ""; // Clear existing content

  const scoreDisplay = document.createElement("div");
  scoreDisplay.classList.add("score-display");
  scoreDisplay.textContent = "Score: 0";
  snakeGameArea.appendChild(scoreDisplay);

  // Keep canvas full size of snakeGameArea
  const canvas = document.createElement("canvas");
  canvas.width = snakeGameArea.clientWidth;
  canvas.height = snakeGameArea.clientHeight;
  snakeGameArea.appendChild(canvas);

  const canvasColour = "#352a51";
  const ctx = canvas.getContext("2d");
  const gridSize = 16;
  let snake = [{ x: 5, y: 5 }];
  let direction = { x: 1, y: 0 };
  let food = randomFood();
  let score = 0;
  let gameRunning = true;

  function randomFood() {
    return {
      x: Math.floor(Math.random() * (canvas.width / gridSize)),
      y: Math.floor(Math.random() * (canvas.height / gridSize)),
    };
  }

  // Handle arrow keys
  function changeDirection(e) {
    if (e.key === "ArrowUp" && direction.y === 0) {
      e.preventDefault();
      direction = { x: 0, y: -1 };
    }
    if (e.key === "ArrowDown" && direction.y === 0) {
      e.preventDefault();
      direction = { x: 0, y: 1 };
    }
    if (e.key === "ArrowLeft" && direction.x === 0) {
      e.preventDefault();
      direction = { x: -1, y: 0 };
    }
    if (e.key === "ArrowRight" && direction.x === 0) {
      e.preventDefault();
      direction = { x: 1, y: 0 };
    }
    if (e.key === "Escape") endGame();
  }

  document.addEventListener("keydown", changeDirection);

  // Game loop
  function gameLoop() {
    if (!gameRunning || !window.gameActive) {
      endGame();
      return;
    }

    // Move snake
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    snake.unshift(head);

    // Eat food or move forward
    if (head.x === food.x && head.y === food.y) {
      score++;
      food = randomFood();
    } else {
      snake.pop();
    }
    scoreDisplay.textContent = `Score: ${score}`;

    // Collision check
    if (
      head.x < 0 ||
      head.y < 0 ||
      head.x >= canvas.width / gridSize ||
      head.y >= canvas.height / gridSize ||
      snake.slice(1).some((s) => s.x === head.x && s.y === head.y)
    ) {
      gameOver();
      return;
    }

    // Draw background
    ctx.fillStyle = canvasColour;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw snake
    ctx.fillStyle = "lime";
    snake.forEach((part) =>
      ctx.fillRect(
        part.x * gridSize,
        part.y * gridSize,
        gridSize - 1,
        gridSize - 1
      )
    );

    // Draw food
    ctx.fillStyle = "red";
    ctx.fillRect(
      food.x * gridSize,
      food.y * gridSize,
      gridSize - 1,
      gridSize - 1
    );

    setTimeout(gameLoop, 100);
  }

  function gameOver() {
    gameRunning = false;
    ctx.fillStyle = "yellow";
    ctx.font = "20px 'Press Start 2P'";
    ctx.fillText("GAME OVER", canvas.width / 2 - 50, canvas.height / 2);
    setTimeout(endGame, 1500); // Call endGame after showing "GAME OVER"
  }

  function endGame() {
    gameRunning = false;
    window.gameActive = false; // Ensure global flag is reset
    window.stopCurrentGame = null; // Clear stop function
    const snakeGameArea = document.getElementById("game-area");
    snakeGameArea.classList.add("game-over");

    // Clear canvas and game area immediately
    if (snakeGameArea) {
      snakeGameArea.innerHTML = "";
      snakeGameArea.classList.remove("game-over");
    }

    // Remove event listener
    document.removeEventListener("keydown", changeDirection);

    // Ensure D-pad is hidden
    const virtualGamepad = document.getElementById("virtual-gamepad");
    if (virtualGamepad) {
      virtualGamepad.classList.remove("active");
    }

    // console.log("Snake game ended and cleaned up"); // Debug log
  }

  gameLoop();
}
