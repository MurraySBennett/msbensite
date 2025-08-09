const pixelGameArea = document.getElementById("game-area");
const startGameBtn = document.getElementById("pixel-chaser");

let sprite,
  trailPixels = [];
let animationId;
let caught = false;

// Rainbow colors for dust trail pixels
const rainbowColors = [
  "#ff3c00",
  "#ff9900",
  "#fffb00",
  "#00ff0d",
  "#00ffff",
  "#0049ff",
  "#ff00ff",
];

// Create the rainbow sprite div
function createSprite() {
  const spr = document.createElement("div");
  spr.classList.add("rainbow-sprite");
  spr.style.background =
    "conic-gradient(from 0deg, " + rainbowColors.join(",") + ")";
  pixelGameArea.appendChild(spr);
  return spr;
}

// Create a trail pixel with velocity and color properties
function createTrailPixel(x, y, color, velocityX, velocityY) {
  const pixel = document.createElement("div");
  pixel.classList.add("trail-pixel");
  pixel.style.background = color;
  pixel.style.left = x + "px";
  pixel.style.top = y + "px";

  // Attach custom properties for animation
  pixel.velocityX = velocityX;
  pixel.velocityY = velocityY;
  pixel.age = 0;

  pixel.style.position = "absolute";

  pixelGameArea.appendChild(pixel);
  trailPixels.push(pixel);
  return pixel;
}

function startRainbowChase() {
  if (sprite) return; // only one game at a time

  sprite = document.createElement("img");
  sprite.src = "../assets/images/sprites/raincloud.gif";
  sprite.classList.add("rainbow-sprite");
  sprite.style.position = "absolute";

  // Smaller sprite size (24x24)
  const spriteSize = 64;
  sprite.style.width = spriteSize + "px";
  sprite.style.height = spriteSize + "px";

  // Random start position within game area
  let pos = {
    x: Math.random() * (pixelGameArea.clientWidth - spriteSize),
    y: Math.random() * (pixelGameArea.clientHeight - spriteSize),
  };

  // Random initial velocity direction and speed
  const speed = 3;
  let angle = Math.random() * 2 * Math.PI;
  let velocity = {
    x: Math.cos(angle) * speed,
    y: Math.sin(angle) * speed,
  };

  // Angular velocity for spin (radians per frame)
  let angularVelocity =
    (Math.random() * 0.04 + 0.01) * (Math.random() < 0.5 ? -1 : 1);

  sprite.style.left = pos.x + "px";
  sprite.style.top = pos.y + "px";

  pixelGameArea.appendChild(sprite);

  sprite.addEventListener("mouseenter", () => {
    if (caught) return;
    caught = true;
    cancelAnimationFrame(animationId);
    cleanup();
    window.gameActive = false;
  });

  function animate() {
    if (caught) return;

    const speedMagnitude = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);

    // Reduce angular velocity magnitude to a small fraction of speed (e.g., 5% of speed)
    const maxAngularVel = 0.02; // max radians per frame (adjust as needed)
    angularVelocity =
      Math.sign(angularVelocity) *
      Math.min(
        Math.abs(angularVelocity),
        maxAngularVel * (speedMagnitude / speed)
      );

    // Apply angular velocity to angle
    angle = Math.atan2(velocity.y, velocity.x);
    angle += angularVelocity;

    // Update velocity with new angle but keep speed magnitude same
    velocity.x = Math.cos(angle) * speedMagnitude;
    velocity.y = Math.sin(angle) * speedMagnitude;

    // Move sprite
    pos.x += velocity.x;
    pos.y += velocity.y;

    // Bounce off edges and randomize trajectory a bit on bounce
    let bounced = false;
    if (pos.x <= 0) {
      pos.x = 0;
      velocity.x = Math.abs(velocity.x);
      bounced = true;
    } else if (pos.x >= pixelGameArea.clientWidth - spriteSize) {
      pos.x = pixelGameArea.clientWidth - spriteSize;
      velocity.x = -Math.abs(velocity.x);
      bounced = true;
    }
    if (pos.y <= 0) {
      pos.y = 0;
      velocity.y = Math.abs(velocity.y);
      bounced = true;
    } else if (pos.y >= pixelGameArea.clientHeight - spriteSize) {
      pos.y = pixelGameArea.clientHeight - spriteSize;
      velocity.y = -Math.abs(velocity.y);
      bounced = true;
    }

    if (bounced) {
      const speedMagnitude = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
      let newAngle =
        Math.atan2(velocity.y, velocity.x) + (Math.random() * 0.6 - 0.3); // ± ~17 degrees
      velocity.x = Math.cos(newAngle) * speedMagnitude;
      velocity.y = Math.sin(newAngle) * speedMagnitude;
    }

    sprite.style.left = pos.x + "px";
    sprite.style.top = pos.y + "px";

    // Emit multiple trail pixels each frame ("rainbow rain")
    const numPixels = 3;
    for (let i = 0; i < numPixels; i++) {
      const baseAngle = Math.PI / 2; // 90 degrees (down)
      const horizontalOffset = velocity.x > 0 ? -Math.PI / 8 : Math.PI / 8; // ±22.5 degrees
      const spread = (Math.random() - 0.5) * (Math.PI / 12); // ±7.5 degrees
      const angleWithSpread = baseAngle + horizontalOffset + spread;

      const speedTrail = Math.random() * 1.5 + 0.5;

      const velX = Math.cos(angleWithSpread) * speedTrail;
      const velY = Math.sin(angleWithSpread) * speedTrail;

      const spreadRadius = 20; // pixels of randomness in start position

      const startX =
        pos.x +
        spriteSize / 2 +
        Math.cos(angleWithSpread) * 10 +
        (Math.random() * 2 - 1) * spreadRadius;

      const startY =
        pos.y +
        40 +
        spriteSize / 2 +
        Math.sin(angleWithSpread) * 10 +
        (Math.random() * 2 - 1) * spreadRadius;

      const color =
        rainbowColors[Math.floor(Math.random() * rainbowColors.length)];

      createTrailPixel(startX, startY, color, velX, velY);
    }

    // Update and fade trail pixels
    for (let i = trailPixels.length - 1; i >= 0; i--) {
      const p = trailPixels[i];
      p.age++;
      p.style.left = p.offsetLeft + p.velocityX + "px";
      p.style.top = p.offsetTop + p.velocityY + "px";
      p.style.opacity = Math.max(1 - p.age / 30, 0);

      if (p.age > 20) {
        p.remove();
        trailPixels.splice(i, 1);
      }
    }

    animationId = requestAnimationFrame(animate);
  }

  animate();
}

function cleanup() {
  if (sprite) sprite.remove();
  trailPixels.forEach((p) => p.remove());
  trailPixels = [];
  sprite = null;
  caught = false;
  window.gameActive = false;
}

startGameBtn.addEventListener("click", () => {
  if (window.gameActive) return;
  window.gameActive = true;
  if (!sprite) {
    startRainbowChase();
  }
});
