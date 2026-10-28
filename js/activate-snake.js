const SNAKE_GRID_SIZE = 16;
const SNAKE_BASE_TICK_MS = 100;
const SNAKE_FAST_TICK_MS = 70;
const SNAKE_COLOR = "#5BCEFA";
const APPLE_COLOR = "#F5A9B8";
const SNAKE_BACKGROUND = "#100b2e";
const SNAKE_GRID_COLOR = "rgba(126, 103, 255, 0.16)";
const SNAKE_WALL_COLOR = "#E68FB2";

const SNAKE_POWERUPS = [
  { id: "jalapeno", name: "Jalapeño" },
  { id: "peach", name: "Peach" },
  { id: "grapes", name: "Grapes" },
  { id: "lime", name: "Lime" },
  { id: "pineapple", name: "Pineapple" },
  { id: "starfruit", name: "Starfruit" },
  { id: "mango", name: "Mango" },
  { id: "pomegranate", name: "Pomegranate" },
  { id: "lemon", name: "Lemon" },
];

const FRUIT_SPRITES = {
  apple: {
    colors: { p: APPLE_COLOR, d: "#d97891", g: "#3f9b62", l: "#b6edbf" },
    pixels: ["...gg...", "..ggg...", ".ppppp..", "ppppppp.", "pppppppp", "pppppppp", ".pppppp.", "..dddd.."],
  },
  jalapeno: {
    colors: { g: "#69bd68", d: "#368a50", l: "#a1db72" },
    pixels: ["...dd...", "..dgg...", "...ggl..", "..ggll..", ".gggll..", ".gggl...", "..ggd...", "...dd..."],
  },
  peach: {
    colors: { o: "#ffb468", p: "#ff7897", d: "#d76b70", g: "#5caa69" },
    pixels: ["...gg...", "..gog...", ".oooooo.", "ooppppoo", "oppppppo", "oppppppo", ".oppppo.", "..oddo.."],
  },
  grapes: {
    colors: { p: "#9655c7", d: "#65369e", g: "#63bd69", l: "#c99be8" },
    pixels: ["...gg...", "..ggg...", "...p....", "..ppp...", ".ppdpp..", ".pplppp.", "..ppppp.", "...pp..."],
  },
  lime: {
    colors: { g: "#62c85d", d: "#268d54", l: "#d7f078", w: "#f1ffd1" },
    pixels: ["...gg...", "..ggg...", ".gggggg.", "ggllllgg", "gllwwllg", "gllwwllg", ".gllllg.", "..gggg.."],
  },
  pineapple: {
    colors: { y: "#f6c84e", o: "#dd8c39", g: "#58a95c", d: "#a95f36" },
    pixels: ["..gggg..", ".g.gggg.", "..yyyy..", ".yyyyyy.", ".yoyyoy.", ".yyyyyy.", "..yoyy..", "...dd..."],
  },
  starfruit: {
    colors: { y: "#ffe45c", o: "#f5aa38", w: "#fff5aa", g: "#54a85f" },
    pixels: ["...gg...", "..gyg...", "...y....", ".yyyyyy.", "..yyyy..", "...yy...", "..y..y..", ".oo..oo."],
  },
  mango: {
    colors: { o: "#ff9b36", y: "#ffd052", r: "#eb604d", g: "#58a85b" },
    pixels: ["...gg...", "..ggy...", ".ooooo..", "oyyyyyo.", "oyyrryyo", ".oyrryo.", "..oyyo..", "...oo..."],
  },
  pomegranate: {
    colors: { r: "#d73751", d: "#9d2949", p: "#f46d70", g: "#4c9d57" },
    pixels: ["..g.g...", ".ggggg..", "..rrr...", ".rrrrr..", "rrrrrrr.", "rrpprrr.", ".rrrrr..", "..ddd..."],
  },
  lemon: {
    colors: { y: "#ffe45a", d: "#e6b832", w: "#fff4a6", g: "#57a95f" },
    pixels: ["...gg...", "..ggy...", ".yyyyy..", "yyyyyyy.", "yywyyyyy", "yyyyyyy.", ".yyyyy..", "..ddd..."],
  },
};

document
  .querySelector(".profile-info h1")
  ?.addEventListener("click", startSnakeGame);

function startSnakeGame() {
  if (window.gameActive) return;
  window.gameActive = true;
  window.stopCurrentGame = endGame;

  const snakeGameArea = document.getElementById("game-area");
  if (!snakeGameArea) {
    window.gameActive = false;
    window.stopCurrentGame = null;
    return;
  }
  snakeGameArea.innerHTML = "";
  const topRow = snakeGameArea.closest(".top-row");
  const inventoryPanel = document.createElement("section");
  inventoryPanel.classList.add("snake-inventory");
  inventoryPanel.setAttribute("aria-label", "Snake score and powerup inventory");
  if (topRow) {
    topRow.classList.add("snake-game-active");
    topRow.insertBefore(inventoryPanel, snakeGameArea);
  } else {
    snakeGameArea.before(inventoryPanel);
  }

  const scoreDisplay = document.createElement("div");
  scoreDisplay.classList.add("score-display");
  scoreDisplay.textContent = "Score: 0";

  const hudHeader = document.createElement("div");
  hudHeader.classList.add("snake-hud-header");
  hudHeader.appendChild(scoreDisplay);

  const powerupStatus = document.createElement("div");
  powerupStatus.classList.add("powerup-status");
  powerupStatus.setAttribute("aria-live", "polite");
  powerupStatus.textContent = "";

  const powerupList = document.createElement("div");
  powerupList.classList.add("powerup-inventory");
  powerupList.setAttribute("aria-label", "Powerup fruits");
  const powerupSlots = {};
  for (const powerup of SNAKE_POWERUPS) {
    const slot = document.createElement("div");
    slot.classList.add("powerup-slot");
    slot.setAttribute("aria-label", `${powerup.name} powerup`);

    const label = document.createElement("span");
    label.classList.add("powerup-label");

    const iconWrap = document.createElement("span");
    iconWrap.classList.add("powerup-icon-wrap");
    const icon = document.createElement("canvas");
    icon.classList.add("powerup-icon");
    icon.width = 32;
    icon.height = 32;
    icon.setAttribute("aria-hidden", "true");

    const count = document.createElement("span");
    count.classList.add("powerup-count");
    count.hidden = true;
    count.setAttribute("aria-hidden", "true");

    iconWrap.append(icon, count);
    slot.append(label, iconWrap);
    powerupList.appendChild(slot);
    powerupSlots[powerup.id] = { slot, label, icon, count };
  }

  const powerupTimer = document.createElement("div");
  powerupTimer.classList.add("powerup-timer");
  powerupTimer.setAttribute("aria-live", "polite");
  hudHeader.appendChild(powerupTimer);
  inventoryPanel.append(hudHeader, powerupStatus, powerupList);

  const canvas = document.createElement("canvas");
  canvas.width = snakeGameArea.clientWidth;
  canvas.height = Math.max(80, snakeGameArea.clientHeight);
  snakeGameArea.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const gridSize = SNAKE_GRID_SIZE;
  const columns = Math.floor(canvas.width / gridSize);
  const rows = Math.floor(canvas.height / gridSize);
  const wallCells = new Set();
  for (let x = 0; x < columns; x++) {
    wallCells.add(`${x},0`);
    wallCells.add(`${x},${rows - 1}`);
  }
  for (let y = 1; y < rows - 1; y++) {
    wallCells.add(`0,${y}`);
    wallCells.add(`${columns - 1},${y}`);
  }
  let snake = [{ x: 5, y: 5 }];
  let direction = { x: 1, y: 0 };
  const directionQueue = [];
  let score = 0;
  let food = null;
  let powerupPickup = null;
  let pickupSpawnTimer = null;
  let pickupExpiryTimer = null;
  let powerupsUnlocked = false;
  let gameRunning = true;
  let statusNote = "";
  let statusNoteUntil = 0;

  const effects = {
    speedMoves: 0,
    tailPasses: 0,
    wallWraps: 0,
    doubleAppleCount: 0,
    magnetMoves: 0,
    bonusApples: [],
    portal: null,
    portalPlacement: null,
  };

  food = randomFood();
  SNAKE_POWERUPS.forEach(powerup => {
    const iconContext = powerupSlots[powerup.id].icon.getContext("2d");
    paintSprite(iconContext, powerup.id, 0, 0, 32);
  });

  function randomEmptyCell(size = 1, { ignoreFood = false } = {}) {
    const available = [];
    for (let y = 0; y <= rows - size; y++) {
      for (let x = 0; x <= columns - size; x++) {
        let isFree = true;
        for (let dy = 0; dy < size && isFree; dy++) {
          for (let dx = 0; dx < size; dx++) {
            if (isCellBlocked(x + dx, y + dy, { ignoreFood })) {
              isFree = false;
              break;
            }
          }
        }
        if (isFree) available.push({ x, y });
      }
    }
    if (!available.length) return null;
    return available[Math.floor(Math.random() * available.length)] ?? null;
  }

  function randomFood(large = false) {
    let cell = randomEmptyCell(large ? 2 : 1, { ignoreFood: true });
    let isLarge = large;
    if (!cell && large) {
      isLarge = false;
      cell = randomEmptyCell();
    }
    return cell ? { ...cell, large: isLarge } : null;
  }

  function isCellBlocked(x, y, { ignoreFood = false } = {}) {
    if (isWallCell({ x, y })) return true;
    if (snake.some(part => part.x === x && part.y === y)) return true;
    if (!ignoreFood && food && foodContains(food, x, y)) return true;
    if (powerupPickup && powerupPickup.x === x && powerupPickup.y === y) return true;
    if (effects.bonusApples.some(apple => apple.x === x && apple.y === y)) return true;
    if (effects.portal && (sameCell(effects.portal.a, { x, y }) || sameCell(effects.portal.b, { x, y }))) return true;
    if (effects.portalPlacement) {
      if (effects.portalPlacement.first && sameCell(effects.portalPlacement.first, { x, y })) return true;
    }
    return false;
  }

  function sameCell(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  function foodContains(item, x, y) {
    const size = item.large ? 2 : 1;
    return x >= item.x && x < item.x + size && y >= item.y && y < item.y + size;
  }

  function chooseNextPowerup() {
    const index = Math.floor(Math.random() * SNAKE_POWERUPS.length);
    return SNAKE_POWERUPS[index] ?? SNAKE_POWERUPS[0];
  }

  function scheduleNextPowerup() {
    if (!gameRunning || score < 5 || powerupPickup || pickupSpawnTimer !== null) return;
    const delay = 10000 + Math.floor(Math.random() * 20001);
    pickupSpawnTimer = setTimeout(() => {
      pickupSpawnTimer = null;
      spawnPowerup();
    }, delay);
  }

  function spawnPowerup() {
    if (!gameRunning || score < 5 || powerupPickup) return;
    const type = chooseNextPowerup();
    const cell = randomEmptyCell();
    if (!cell) {
      scheduleNextPowerup();
      return;
    }
    powerupPickup = { ...cell, type, expiresAt: Date.now() + 5000 };
    pickupExpiryTimer = setTimeout(() => {
      pickupExpiryTimer = null;
      if (!gameRunning || !powerupPickup) return;
      powerupPickup = null;
      scheduleNextPowerup();
      updateHud();
      draw();
    }, 5000);
    updateHud();
    draw();
  }

  function clearPickupTimers() {
    if (pickupSpawnTimer !== null) clearTimeout(pickupSpawnTimer);
    if (pickupExpiryTimer !== null) clearTimeout(pickupExpiryTimer);
    pickupSpawnTimer = null;
    pickupExpiryTimer = null;
  }

  function unlockPowerupsIfNeeded() {
    if (score >= 5 && !powerupsUnlocked) {
      powerupsUnlocked = true;
      spawnPowerup();
    }
  }

  function awardApple() {
    const points = effects.doubleAppleCount > 0 ? 2 : 1;
    if (effects.doubleAppleCount > 0) effects.doubleAppleCount--;
    score += points;
    unlockPowerupsIfNeeded();
  }

  function addBonusApples(count) {
    const expiresAt = Date.now() + 30000;
    for (let index = 0; index < count; index++) {
      const cell = randomEmptyCell();
      if (!cell) break;
      effects.bonusApples.push({ ...cell, expiresAt });
    }
  }

  function trimTail(count) {
    const keepLength = Math.max(1, snake.length - count);
    snake = snake.slice(0, keepLength);
  }

  function beginPortalPlacement() {
    const x = Math.max(0, Math.min(columns - 1, snake[0].x + direction.x * 2));
    const y = Math.max(0, Math.min(rows - 1, snake[0].y + direction.y * 2));
    effects.portalPlacement = {
      cursor: { x, y },
      first: null,
      expiresAt: Date.now() + 16000,
    };
  }

  function applyPowerup(powerup) {
    switch (powerup.id) {
      case "jalapeno":
        effects.speedMoves = 80;
        break;
      case "peach": {
        if (food && !food.large) {
          const canExpand = food.x < columns - 1 && food.y < rows - 1 &&
            !isCellBlocked(food.x + 1, food.y, { ignoreFood: true }) &&
            !isCellBlocked(food.x, food.y + 1, { ignoreFood: true }) &&
            !isCellBlocked(food.x + 1, food.y + 1, { ignoreFood: true });
          if (canExpand) food.large = true;
          else food = randomFood(true) ?? food;
        }
        statusNote = "Next apple is larger";
        statusNoteUntil = Date.now() + 1800;
        break;
      }
      case "grapes":
        effects.tailPasses = Math.min(2, effects.tailPasses + 1);
        break;
      case "lime":
        effects.wallWraps = Math.min(2, effects.wallWraps + 1);
        break;
      case "pineapple":
        trimTail(3);
        statusNote = "Tail trimmed by 3";
        statusNoteUntil = Date.now() + 1800;
        break;
      case "starfruit":
        effects.doubleAppleCount = 3;
        break;
      case "mango":
        effects.magnetMoves = 80;
        break;
      case "pomegranate":
        addBonusApples(3);
        break;
      case "lemon":
        beginPortalPlacement();
        break;
      default:
        break;
    }
    updateHud();
  }

  function collectPickup() {
    const collected = powerupPickup;
    if (!collected) return;
    powerupPickup = null;
    if (pickupExpiryTimer !== null) clearTimeout(pickupExpiryTimer);
    pickupExpiryTimer = null;
    applyPowerup(collected.type);
    scheduleNextPowerup();
  }

  function moveMagnetTarget() {
    if (effects.magnetMoves <= 0 || !food) return;
    effects.magnetMoves--;
    if (effects.magnetMoves % 5 !== 0) return;
    const dx = snake[0].x - food.x;
    const dy = snake[0].y - food.y;
    const candidates = [];
    if (dx !== 0) candidates.push({ x: food.x + Math.sign(dx), y: food.y });
    if (dy !== 0) candidates.push({ x: food.x, y: food.y + Math.sign(dy) });
    for (const candidate of candidates) {
      const size = food.large ? 2 : 1;
      if (candidate.x < 0 || candidate.y < 0 || candidate.x + size > columns || candidate.y + size > rows) continue;
      let available = true;
      for (let y = candidate.y; y < candidate.y + size && available; y++) {
        for (let x = candidate.x; x < candidate.x + size; x++) {
          if (isCellBlocked(x, y, { ignoreFood: true })) {
            available = false;
            break;
          }
        }
      }
      if (available) {
        food = { ...food, ...candidate };
        break;
      }
    }
  }

  function updateTimedEffects(now) {
    effects.bonusApples = effects.bonusApples.filter(apple => apple.expiresAt > now);
    if (effects.portalPlacement && effects.portalPlacement.expiresAt <= now) {
      effects.portalPlacement = null;
      statusNote = "Portal placement timed out";
      statusNoteUntil = now + 1800;
    }
    if (statusNoteUntil <= now) statusNote = "";
  }

  function updateHud() {
    let timerText = "";
    const now = Date.now();
    if (effects.portalPlacement) timerText = `${Math.max(0, Math.ceil((effects.portalPlacement.expiresAt - now) / 1000))}s`;
    else if (powerupPickup && score >= 5) timerText = `${Math.max(0, Math.ceil((powerupPickup.expiresAt - now) / 1000))}s`;
    powerupTimer.textContent = timerText;
    powerupTimer.classList.toggle("active", Boolean(timerText));

    const active = {
      jalapeno: [effects.speedMoves > 0, "Speed boost", effects.speedMoves],
      peach: [Boolean(food?.large), "Big apple", 0],
      grapes: [effects.tailPasses > 0, "Tail pass", effects.tailPasses],
      lime: [effects.wallWraps > 0, "Wall wrap", effects.wallWraps],
      pineapple: [statusNote === "Tail trimmed by 3" && statusNoteUntil > now, "Tail trim", 0],
      starfruit: [effects.doubleAppleCount > 0, "Double points", effects.doubleAppleCount],
      mango: [effects.magnetMoves > 0, "Apple magnet", effects.magnetMoves],
      pomegranate: [effects.bonusApples.length > 0, "Bonus apples", effects.bonusApples.length],
      lemon: [Boolean(effects.portalPlacement || effects.portal), effects.portalPlacement ? (effects.portalPlacement.first ? "Place B" : "Place A + B") : "Portal pair", 0],
    };
    SNAKE_POWERUPS.forEach(powerup => {
      const [isActive, label, count] = active[powerup.id];
      const slot = powerupSlots[powerup.id];
      slot.slot.classList.toggle("active", isActive);
      slot.label.textContent = isActive ? label : "";
      slot.count.textContent = count > 1 ? `×${count}` : count === 1 ? "1" : "";
      slot.count.hidden = count <= 0;
      slot.slot.setAttribute("aria-label", isActive ? `${powerup.name}: ${label}${count ? `, ${count} remaining` : ""}` : `${powerup.name} powerup`);
    });
    powerupStatus.textContent = statusNote && statusNoteUntil > now ? statusNote : "";
  }

  function paintSprite(targetContext, spriteId, x, y, size = gridSize) {
    const sprite = FRUIT_SPRITES[spriteId];
    if (!sprite) return;
    const pixelSize = size / 8;
    for (let row = 0; row < sprite.pixels.length; row++) {
      const line = sprite.pixels[row];
      for (let column = 0; column < line.length; column++) {
        const color = sprite.colors[line[column]];
        if (!color) continue;
        targetContext.fillStyle = color;
        targetContext.fillRect(x + column * pixelSize, y + row * pixelSize, pixelSize, pixelSize);
      }
    }
  }

  function drawSprite(spriteId, x, y, size = gridSize) {
    paintSprite(ctx, spriteId, x, y, size);
  }

  function drawPortalMarker(cell, label, cursor = false) {
    if (!cell) return;
    const centerX = (cell.x + 0.5) * gridSize;
    const centerY = (cell.y + 0.5) * gridSize;
    ctx.strokeStyle = cursor ? "#fff2a6" : "#d9c8ff";
    ctx.lineWidth = 2;
    ctx.setLineDash(cursor ? [3, 2] : []);
    ctx.beginPath();
    ctx.arc(centerX, centerY, gridSize * 0.46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#ffffff";
    ctx.font = "8px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, centerX, centerY + 3);
    ctx.textAlign = "start";
  }

  function draw() {
    ctx.fillStyle = SNAKE_BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.strokeStyle = SNAKE_GRID_COLOR;
    ctx.lineWidth = 1;
    for (let x = gridSize; x < canvas.width; x += gridSize) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, canvas.height);
    }
    for (let y = gridSize; y < canvas.height; y += gridSize) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(canvas.width, y + 0.5);
    }
    ctx.stroke();

    ctx.fillStyle = SNAKE_WALL_COLOR;
    wallCells.forEach(cell => {
      const [x, y] = cell.split(",").map(Number);
      ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
      ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
      ctx.fillRect(x * gridSize + 2, y * gridSize + 2, gridSize - 4, 2);
      ctx.fillStyle = SNAKE_WALL_COLOR;
    });

    ctx.fillStyle = SNAKE_COLOR;
    snake.forEach(part => ctx.fillRect(part.x * gridSize, part.y * gridSize, gridSize - 1, gridSize - 1));

    if (food) drawSprite("apple", food.x * gridSize, food.y * gridSize, food.large ? gridSize * 2 : gridSize);
    effects.bonusApples.forEach(apple => drawSprite("apple", apple.x * gridSize, apple.y * gridSize));

    if (powerupPickup) drawSprite(powerupPickup.type.id, powerupPickup.x * gridSize, powerupPickup.y * gridSize);
    if (effects.portal) {
      drawPortalMarker(effects.portal.a, "A");
      drawPortalMarker(effects.portal.b, "B");
    }
    if (effects.portalPlacement) {
      if (effects.portalPlacement.first) drawPortalMarker(effects.portalPlacement.first, "A");
      drawPortalMarker(effects.portalPlacement.cursor, effects.portalPlacement.first ? "B" : "?", true);
    }
  }

  function movePortalCursor(requestedDirection) {
    const placement = effects.portalPlacement;
    if (!placement) return false;
    placement.cursor = {
      x: Math.max(0, Math.min(columns - 1, placement.cursor.x + requestedDirection.x)),
      y: Math.max(0, Math.min(rows - 1, placement.cursor.y + requestedDirection.y)),
    };
    updateHud();
    draw();
    return true;
  }

  function placePortalEndpoint(which) {
    const placement = effects.portalPlacement;
    if (!placement) return false;
    const cursor = placement.cursor;
    if (isCellBlocked(cursor.x, cursor.y, { ignoreFood: false })) {
      powerupStatus.textContent = "Choose an empty portal tile";
      return true;
    }
    if (which === "a" && !placement.first) {
      placement.first = { ...cursor };
    } else if (which === "b" && placement.first && !sameCell(placement.first, cursor)) {
      const second = { ...cursor };
      effects.portal = { a: placement.first, b: second };
      effects.portalPlacement = null;
    }
    updateHud();
    draw();
    return true;
  }

  function changeDirection(event) {
    if (event.key === "Escape") {
      endGame();
      return;
    }
    const turns = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
    };
    const requestedDirection = turns[event.key];
    if (requestedDirection) {
      event.preventDefault();
      if (effects.portalPlacement) {
        movePortalCursor(requestedDirection);
        return;
      }
      const previousDirection = directionQueue[directionQueue.length - 1] ?? direction;
      if (
        directionQueue.length < 2 &&
        requestedDirection.x !== -previousDirection.x &&
        requestedDirection.y !== -previousDirection.y
      ) {
        directionQueue.push(requestedDirection);
      }
      return;
    }
    if (effects.portalPlacement && (event.key.toLowerCase() === "a" || event.key.toLowerCase() === "b")) {
      event.preventDefault();
      placePortalEndpoint(event.key.toLowerCase());
    }
  }

  function isWallCell(cell) {
    return cell.x < 0 || cell.y < 0 || cell.x >= columns || cell.y >= rows || wallCells.has(`${cell.x},${cell.y}`);
  }

  function isOuterWallCell(cell) {
    return cell.x <= 0 || cell.y <= 0 || cell.x >= columns - 1 || cell.y >= rows - 1;
  }

  function portalExit(cell) {
    if (!effects.portal) return cell;
    if (sameCell(cell, effects.portal.a)) return effects.portal.b;
    if (sameCell(cell, effects.portal.b)) return effects.portal.a;
    return cell;
  }

  function finishGameOver() {
    gameRunning = false;
    clearPickupTimers();
    document.removeEventListener("keydown", changeDirection);
    updateHud();
    powerupStatus.textContent = "Game over";
    ctx.fillStyle = "yellow";
    ctx.font = "18px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);
    ctx.textAlign = "start";
    setTimeout(endGame, 1500);
  }

  function gameLoop() {
    if (!gameRunning || !window.gameActive) {
      endGame();
      return;
    }

    const now = Date.now();
    updateTimedEffects(now);
    if (effects.portalPlacement) {
      updateHud();
      draw();
      setTimeout(gameLoop, SNAKE_BASE_TICK_MS);
      return;
    }

    if (directionQueue.length) direction = directionQueue.shift();
    if (effects.speedMoves > 0) effects.speedMoves--;
    const nextHead = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    if (isWallCell(nextHead)) {
      if (isOuterWallCell(nextHead) && effects.wallWraps > 0) {
        effects.wallWraps--;
        if (nextHead.x <= 0) nextHead.x = columns - 2;
        else if (nextHead.x >= columns - 1) nextHead.x = 1;
        if (nextHead.y <= 0) nextHead.y = rows - 2;
        else if (nextHead.y >= rows - 1) nextHead.y = 1;
      } else {
        finishGameOver();
        return;
      }
    }

    const teleportedHead = portalExit(nextHead);
    const eatingFood = food && foodContains(food, teleportedHead.x, teleportedHead.y);
    const bonusIndex = effects.bonusApples.findIndex(apple => sameCell(apple, teleportedHead));
    const eatingBonus = bonusIndex >= 0;
    const grows = Boolean(eatingFood || eatingBonus);
    const collisionIndex = snake.findIndex(part => sameCell(part, teleportedHead));
    if (collisionIndex >= 0) {
      const isVacatingTail = collisionIndex === snake.length - 1 && !grows;
      if (!isVacatingTail && effects.tailPasses > 0) effects.tailPasses--;
      else if (!isVacatingTail) {
        finishGameOver();
        return;
      }
    }

    snake.unshift({ ...teleportedHead });
    if (eatingFood) {
      const wasLarge = food.large;
      food = null;
      awardApple();
      food = randomFood();
      if (!food) {
        updateHud();
        draw();
        finishGameOver();
        return;
      }
      if (wasLarge) statusNote = "Big apple collected";
    } else if (eatingBonus) {
      effects.bonusApples.splice(bonusIndex, 1);
      awardApple();
    } else {
      snake.pop();
    }

    moveMagnetTarget();
    if (powerupPickup && sameCell(powerupPickup, teleportedHead)) collectPickup();
    scoreDisplay.textContent = `Score: ${score}`;
    updateHud();
    draw();
    setTimeout(gameLoop, effects.speedMoves > 0 ? SNAKE_FAST_TICK_MS : SNAKE_BASE_TICK_MS);
  }

  function endGame() {
    if (!gameRunning && !window.gameActive) return;
    gameRunning = false;
    window.gameActive = false;
    window.stopCurrentGame = null;
    clearPickupTimers();
    document.removeEventListener("keydown", changeDirection);
    const area = document.getElementById("game-area");
    if (area) {
      area.innerHTML = "";
      area.classList.remove("game-over");
    }
    inventoryPanel.remove();
    topRow?.classList.remove("snake-game-active");
    const virtualGamepad = document.getElementById("virtual-gamepad");
    if (virtualGamepad) virtualGamepad.classList.remove("active");
  }

  document.addEventListener("keydown", changeDirection);
  draw();
  gameLoop();
}
