// Trigger on clicking your name
document
  .querySelector(".profile-info h1")
  .addEventListener("click", startSnakeGame);

function startSnakeGame() {
  if (window.gameActive) return;
  window.gameActive = true;

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

  // Controls
  document.addEventListener("keydown", changeDirection);
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
    if (e.key === "Escape") endGame(); // Allow quitting
  }

  function gameLoop() {
    if (!gameRunning) return;

    // Move snake
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    snake.unshift(head);

    // Check collision with food
    if (head.x === food.x && head.y === food.y) {
      score++;
      food = randomFood();
    } else {
      snake.pop();
    }
    scoreDisplay.textContent = `Score: ${score}`;

    // Check collision with walls or self
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

    // Draw
    ctx.fillStyle = canvasColour;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "lime";
    snake.forEach((part) =>
      ctx.fillRect(
        part.x * gridSize,
        part.y * gridSize,
        gridSize - 1,
        gridSize - 1
      )
    );

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
    setTimeout(() => {
      endGame();
    }, 1500);
  }

  function endGame() {
    snakeGameArea.classList.add("game-over");
    setTimeout(() => {
      snakeGameArea.innerHTML = ""; // Clear the game & score display
      snakeGameArea.classList.remove("game-over");
    }, 500);
    document.removeEventListener("keydown", changeDirection);
    window.gameActive = false;
  }

  gameLoop();
}
