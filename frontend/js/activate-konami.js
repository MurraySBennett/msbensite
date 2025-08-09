const gameArea = document.getElementById("game-area");
const pacman = document.getElementById("profile-photo");
const pacmanContainer = document.getElementById("pacman-container");

const originalSpritesData = [
  { key: "up", imgSrc: "assets/images/button-icons/button-up.png" },
  { key: "up", imgSrc: "assets/images/button-icons/button-up.png" },
  { key: "down", imgSrc: "assets/images/button-icons/button-down.png" },
  { key: "down", imgSrc: "assets/images/button-icons/button-down.png" },
  { key: "left", imgSrc: "assets/images/button-icons/button-left.png" },
  { key: "right", imgSrc: "assets/images/button-icons/button-right.png" },
  { key: "left", imgSrc: "assets/images/button-icons/button-left.png" },
  { key: "right", imgSrc: "assets/images/button-icons/button-right.png" },
  { key: "b", imgSrc: "assets/images/button-icons/button-b.png" },
  { key: "a", imgSrc: "assets/images/button-icons/button-a.png" },
];

let spritesData = [...originalSpritesData];
let activeSprites = []; // Array to hold all active sprites
let gameRunning = false;

const spriteSpeed = 4; // pixels per frame
const spawnInterval = 500; // 1 second between sprites
const responseWindow = 1500;

// Create sprite element and tracking object
function createSprite(spriteInfo) {
  const img = document.createElement("img");
  img.src = spriteInfo.imgSrc;
  img.classList.add("sprite");
  img.dataset.key = spriteInfo.key;
  img.style.left = gameArea.offsetWidth + "px";
  gameArea.appendChild(img);

  return {
    img,
    key: spriteInfo.key,
    x: gameArea.offsetWidth,
    waitingForInput: false,
    inputTimeout: null,
    caught: false,
  };
}

// Move sprites independently
function moveSprites() {
  activeSprites.forEach((spriteObj, index) => {
    if (spriteObj.caught) return; // Skip caught sprites

    spriteObj.x -= spriteSpeed;
    spriteObj.img.style.left = spriteObj.x + "px";

    // Start waiting for input if near Pacman
    if (spriteObj.x <= 50 && !spriteObj.waitingForInput) {
      spriteObj.waitingForInput = true;
      console.log(`Press this key: "${spriteObj.key}"`);
      spriteObj.inputTimeout = setTimeout(() => {
        endGame("Missed the sprite!");
      }, responseWindow);
    }

    // If sprite moves completely off screen without being caught
    if (spriteObj.x + spriteObj.img.offsetWidth < -150) {
      console.log(spriteObj);
      endGame("Sprite escaped!");
    }
  });

  if (gameRunning) {
    animationFrameId = requestAnimationFrame(moveSprites);
  }
}

let animationFrameId;
let spawnTimerId;

function startSpawning() {
  gameRunning = true;
  spawnTimerId = setInterval(() => {
    if (spritesData.length === 0) {
      clearInterval(spawnTimerId);
      spawnTimerId = null;
      if (activeSprites.length === 0) {
        resetGame();
      }
      return;
    }
    const spriteInfo = spritesData.shift();
    const newSprite = createSprite(spriteInfo);
    activeSprites.push(newSprite);
  }, spawnInterval);

  animationFrameId = requestAnimationFrame(moveSprites);
}

// End game and reset
function endGame(message) {
  gameRunning = false;
  cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
  clearInterval(spawnTimerId);
  spawnTimerId = null;

  // Clear all input timeouts
  activeSprites.forEach((s) => {
    if (s.inputTimeout) clearTimeout(s.inputTimeout);
  });
  console.log(message);

  pacmanContainer.classList.add("shake");
  setTimeout(() => pacmanContainer.classList.remove("shake"), 500);

  resetGame();
}

// Reset game variables and DOM
function resetGame() {
  activeSprites.forEach((spriteObj) => {
    if (spriteObj.img.parentNode)
      spriteObj.img.parentNode.removeChild(spriteObj.img);
  });
  activeSprites = [];
  spritesData = [...originalSpritesData];
  pacman.classList.remove("bite");
}

// Listen for key presses to catch any matching sprite waiting for input
const keyMap = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

window.addEventListener("keydown", (e) => {
  if (gameRunning && (e.key.startsWith("Arrow") || e.key == " ")) {
    e.preventDefault();
  }
  const pressedKey = keyMap[e.key] || e.key;

  for (const spriteObj of activeSprites) {
    if (
      spriteObj.waitingForInput &&
      !spriteObj.caught &&
      pressedKey === spriteObj.key
    ) {
      clearTimeout(spriteObj.inputTimeout);
      spriteObj.caught = true;
      spriteObj.waitingForInput = false;

      pacman.classList.add("bite");

      setTimeout(() => {
        if (spriteObj.img.parentNode) {
          spriteObj.img.parentNode.removeChild(spriteObj.img);
        }
        pacman.classList.remove("bite");

        // Remove sprite from activeSprites array
        activeSprites = activeSprites.filter((s) => s !== spriteObj);

        // If no sprites left to spawn and none active, player wins
        if (spritesData.length === 0 && activeSprites.length === 0) {
          //   alert("You win! All sprites caught!");
          resetGame();
        }
      }, 300);

      break; // Only handle one sprite per key press
    }
  }
});

// Start game when profile pic is clicked
pacman.addEventListener("click", () => {
  if (gameRunning) return;
  resetGame();
  startSpawning();
});
