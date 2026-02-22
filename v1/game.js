const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const levelText = document.getElementById("levelText");
const crackersText = document.getElementById("crackersText");
const statusText = document.getElementById("statusText");
const staminaBar = document.getElementById("staminaBar");

const world = {
  gravity: 0.55,
  friction: 0.82,
  width: canvas.width,
  height: canvas.height,
};

const controls = {
  ArrowLeft: false,
  ArrowRight: false,
  ArrowUp: false,
};

const touchButtons = document.querySelectorAll("[data-control]");

function setControlState(control, isDown) {
  if (!(control in controls)) return;
  controls[control] = isDown;
}

function bindTouchControls() {
  for (const button of touchButtons) {
    const control = button.dataset.control;

    const press = (event) => {
      event.preventDefault();
      setControlState(control, true);
      if (control === "ArrowUp") {
        tryJump();
      }
      button.classList.add("is-active");
    };

    const release = (event) => {
      event.preventDefault();
      setControlState(control, false);
      button.classList.remove("is-active");
    };

    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  }
}

const game = {
  totalLevels: 9,
  level: 1,
  crackersCollected: 0,
  crackersTarget: 0,
  completed: false,
  transitionTimer: 0,
  levelStartMs: 0,
  levelElapsedMs: 0,
  lastFrameMs: 0,
  bestTimes: [],
};

const player = {
  x: 90,
  y: 100,
  w: 30,
  h: 64,
  vx: 0,
  vy: 0,
  baseSpeed: 0.85,
  baseJumpPower: 12,
  speed: 0.85,
  jumpPower: 12,
  onGround: false,
  facing: 1,
  jumpsRemaining: 2,
  maxJumps: 2,
  stamina: 100,
  staminaMax: 100,
  exhausted: false,
};

let platforms = [];
let crackers = [];

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function createLevel(level) {
  const ground = { x: 0, y: world.height - 52, w: world.width, h: 52 };
  const midY = world.height - 150;
  const highY = world.height - 250;
  const topY = world.height - 340;

  platforms = [
    ground,
    { x: 80, y: midY, w: 160, h: 20 },
    { x: 300, y: highY, w: 180, h: 20 },
    { x: 560, y: topY, w: 180, h: 20 },
    { x: 770, y: highY - 10, w: 130, h: 20 },
    { x: 500, y: midY + 45, w: 120, h: 20 },
  ];

  const needed = 3 + level;
  crackersTargetSafe(needed);
  crackers = [];

  for (let i = 0; i < needed; i += 1) {
    const p = platforms[1 + ((i + level) % (platforms.length - 1))];
    const x = p.x + 20 + ((i * 67 + level * 29) % Math.max(30, p.w - 40));
    crackers.push({
      x,
      y: p.y - 22,
      w: 16,
      h: 16,
      collected: false,
      bobOffset: Math.random() * Math.PI * 2,
    });
  }

  player.x = 90;
  player.y = 90;
  player.vx = 0;
  player.vy = 0;
  player.jumpsRemaining = player.maxJumps;
  player.exhausted = false;
  player.stamina = player.staminaMax;

  game.levelStartMs = 0;
  game.levelElapsedMs = 0;
}

function loadBestTimes() {
  const raw = window.localStorage.getItem("salty-crackers-best-times");
  if (!raw) {
    game.bestTimes = Array.from({ length: game.totalLevels }, () => null);
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("Invalid best times");
    game.bestTimes = Array.from({ length: game.totalLevels }, (_, i) => {
      const value = parsed[i];
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    });
  } catch (error) {
    game.bestTimes = Array.from({ length: game.totalLevels }, () => null);
  }
}

function saveBestTimes() {
  window.localStorage.setItem("salty-crackers-best-times", JSON.stringify(game.bestTimes));
}

function formatSeconds(ms) {
  return (ms / 1000).toFixed(2);
}

function crackersTargetSafe(value) {
  game.crackersTarget = Math.max(1, value);
  game.crackersCollected = 0;
}

function updateHUD() {
  levelText.textContent = `Level ${Math.min(game.level, game.totalLevels)} / ${game.totalLevels}`;
  crackersText.textContent = `Crackers: ${game.crackersCollected} / ${game.crackersTarget}`;
  const growthValue = 1 + (Math.min(game.level, game.totalLevels) - 1) * 0.16;
  const growth = growthValue.toFixed(2);
  const seconds = formatSeconds(game.levelElapsedMs);
  const best = game.bestTimes[game.level - 1];
  const bestText = best ? `${formatSeconds(best)}s` : "--";
  statusText.textContent = `Time: ${seconds}s · Best: ${bestText} · Belly Growth: ${growth}x`;
  if (staminaBar) {
    const ratio = player.stamina / player.staminaMax;
    staminaBar.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
  }

  const speedScale = Math.max(0.55, 1.1 - (growthValue - 1) * 0.55);
  const jumpScale = Math.max(0.72, 1.0 - (growthValue - 1) * 0.55);
  player.speed = player.baseSpeed * speedScale;
  player.jumpPower = player.baseJumpPower * jumpScale;
}

function tryJump() {
  if (player.exhausted) return;
  if (player.jumpsRemaining <= 0) return;
  const jumpIndex = player.maxJumps - player.jumpsRemaining + 1;
  const baseCost = 10;
  const cost = jumpIndex >= 2 ? baseCost * 2 : baseCost;
  if (player.stamina < cost) return;
  player.stamina = Math.max(0, player.stamina - cost);
  player.vy = -player.jumpPower;
  player.onGround = false;
  player.jumpsRemaining -= 1;
  if (player.stamina <= 0) {
    player.exhausted = true;
  }
}

function handleInput() {
  if (player.exhausted) return;
  if (controls.ArrowLeft) {
    player.vx -= player.speed;
    player.facing = -1;
  }
  if (controls.ArrowRight) {
    player.vx += player.speed;
    player.facing = 1;
  }
}

function updateStamina(deltaMs) {
  const delta = deltaMs / 1000;
  const moving = controls.ArrowLeft || controls.ArrowRight;
  const drainRate = 12;
  const recoverRate = 10;
  const exhaustedRecoverRate = 18;

  if (!player.exhausted && moving) {
    player.stamina = Math.max(0, player.stamina - drainRate * delta);
  } else {
    const rate = player.exhausted ? exhaustedRecoverRate : recoverRate;
    player.stamina = Math.min(player.staminaMax, player.stamina + rate * delta);
  }

  if (!player.exhausted && player.stamina <= 0) {
    player.exhausted = true;
  }
  if (player.exhausted && player.stamina >= player.staminaMax) {
    player.exhausted = false;
  }
  if (player.exhausted) {
    player.vx = 0;
  }
}

function applyPhysics() {
  player.vy += world.gravity;
  player.vx *= world.friction;
  player.vx = Math.max(-7, Math.min(7, player.vx));

  player.x += player.vx;
  if (player.x < 0) {
    player.x = 0;
    player.vx = 0;
  }
  if (player.x + player.w > world.width) {
    player.x = world.width - player.w;
    player.vx = 0;
  }

  player.y += player.vy;
  player.onGround = false;

  for (const p of platforms) {
    const wasAbove = player.y + player.h - player.vy <= p.y;
    const overlaps = rectsOverlap(player, p);

    if (overlaps && player.vy >= 0 && wasAbove) {
      player.y = p.y - player.h;
      player.vy = 0;
      player.onGround = true;
      player.jumpsRemaining = player.maxJumps;
    }
  }

  if (player.y > world.height + 120) {
    player.x = 90;
    player.y = 90;
    player.vx = 0;
    player.vy = 0;
  }
}

function collectCrackers(time) {
  for (const cracker of crackers) {
    if (cracker.collected) continue;

    const collision = rectsOverlap(player, cracker);
    if (collision) {
      cracker.collected = true;
      game.crackersCollected += 1;
      player.stamina = Math.min(player.staminaMax, player.stamina + 25);
    }

    cracker.bob = Math.sin(time * 0.004 + cracker.bobOffset) * 2.5;
  }

  if (game.crackersCollected >= game.crackersTarget && game.transitionTimer <= 0) {
    game.transitionTimer = 75;
    const idx = game.level - 1;
    const previous = game.bestTimes[idx];
    if (!previous || game.levelElapsedMs < previous) {
      game.bestTimes[idx] = game.levelElapsedMs;
      saveBestTimes();
    }
  }
}

function nextLevelIfReady() {
  if (game.transitionTimer <= 0) return;
  game.transitionTimer -= 1;

  if (game.transitionTimer === 0) {
    if (game.level >= game.totalLevels) {
      game.completed = true;
      return;
    }

    game.level += 1;
    createLevel(game.level);
    updateHUD();
  }
}

function drawPlatform(platform) {
  ctx.fillStyle = "#7e4f2a";
  ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
  ctx.fillStyle = "#9a6a40";
  ctx.fillRect(platform.x, platform.y, platform.w, 6);
}

function drawCracker(cracker) {
  if (cracker.collected) return;
  const y = cracker.y + (cracker.bob || 0);

  ctx.fillStyle = "#f7d58f";
  ctx.fillRect(cracker.x, y, cracker.w, cracker.h);
  ctx.strokeStyle = "#cf9d4a";
  ctx.lineWidth = 2;
  ctx.strokeRect(cracker.x, y, cracker.w, cracker.h);
  ctx.fillStyle = "#b97830";
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.arc(cracker.x + 4 + i * 3, y + 8 + ((i % 2) ? 2 : -2), 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer() {
  const growth = 1 + (Math.min(game.level, game.totalLevels) - 1) * 0.16;
  const bellyRadius = 12 * growth;

  const centerX = player.x + player.w / 2;
  const headY = player.y + 12;

  ctx.fillStyle = "#543426";
  ctx.fillRect(player.x + 9, player.y + 20, 12, 22);

  ctx.fillStyle = player.exhausted ? "#a7d8b8" : "#f2bb9c";
  ctx.beginPath();
  ctx.arc(centerX, headY, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff6f61";
  ctx.fillRect(player.x + 3, player.y + 34, 24, 24);

  ctx.fillStyle = "#f7a9a0";
  const bellyX = centerX + (player.facing === 1 ? 7 : -7);
  ctx.beginPath();
  ctx.arc(bellyX, player.y + 47, bellyRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#54281d";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(player.x + 10, player.y + player.h - 2);
  ctx.lineTo(player.x + 10, player.y + 56);
  ctx.moveTo(player.x + 20, player.y + player.h - 2);
  ctx.lineTo(player.x + 20, player.y + 56);
  ctx.stroke();
}

function drawLevelTransition() {
  if (game.transitionTimer <= 0) return;

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillRect(0, 0, world.width, world.height);
  ctx.fillStyle = "#5a3118";
  ctx.font = "bold 38px Verdana";
  ctx.textAlign = "center";
  const text = game.level >= game.totalLevels ? "Final Level Cleared" : `Level ${game.level} Cleared!`;
  const seconds = formatSeconds(game.levelElapsedMs);
  const best = game.bestTimes[game.level - 1];
  const bestText = best ? `${formatSeconds(best)}s` : "--";
  ctx.fillText(text, world.width / 2, world.height / 2 - 20);
  ctx.font = "bold 24px Verdana";
  ctx.fillText(`Time: ${seconds}s`, world.width / 2, world.height / 2 + 10);
  ctx.fillText(`Best: ${bestText}`, world.width / 2, world.height / 2 + 44);
}

function drawBackground(time) {
  const sunPulse = 30 + Math.sin(time * 0.0018) * 4;
  ctx.fillStyle = "#ffd37a";
  ctx.beginPath();
  ctx.arc(810, 95, sunPulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.beginPath();
  ctx.ellipse(180, 90, 70, 26, 0, 0, Math.PI * 2);
  ctx.ellipse(240, 95, 60, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(560, 130, 90, 28, 0, 0, Math.PI * 2);
  ctx.ellipse(640, 137, 64, 24, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawFinishScene() {
  ctx.fillStyle = "#fff6eb";
  ctx.fillRect(0, 0, world.width, world.height);

  ctx.fillStyle = "#4e2b17";
  ctx.textAlign = "center";
  ctx.font = "bold 44px Verdana";
  ctx.fillText("Level 9 Complete", world.width / 2, 140);

  ctx.font = "bold 36px Verdana";
  ctx.fillText("The baby is born!", world.width / 2, 200);

  ctx.fillStyle = "#f2bb9c";
  ctx.beginPath();
  ctx.arc(world.width / 2, 300, 70, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffd34f";
  ctx.beginPath();
  ctx.arc(world.width / 2, 300, 45, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#5a3118";
  ctx.font = "bold 24px Verdana";
  ctx.fillText("A healthy new beginning", world.width / 2, 410);
  ctx.font = "20px Verdana";
  ctx.fillText("Reload page to play again", world.width / 2, 450);
}

function render(time) {
  ctx.clearRect(0, 0, world.width, world.height);

  if (game.completed) {
    drawFinishScene();
    return;
  }

  drawBackground(time);

  for (const p of platforms) drawPlatform(p);
  for (const cracker of crackers) drawCracker(cracker);
  drawPlayer();
  drawLevelTransition();
}

function gameLoop(time) {
  if (!game.lastFrameMs) {
    game.lastFrameMs = time;
  }
  const delta = Math.min(64, time - game.lastFrameMs);
  game.lastFrameMs = time;

  if (!game.completed) {
    if (!game.levelStartMs) {
      game.levelStartMs = time;
    }
    if (game.transitionTimer <= 0) {
      game.levelElapsedMs += delta;
    }
    updateStamina(delta);
    handleInput();
    applyPhysics();
    collectCrackers(time);
    nextLevelIfReady();
    updateHUD();
  }

  render(time);
  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (event) => {
  if (event.key in controls) {
    setControlState(event.key, true);
    event.preventDefault();
  }

  if (event.key === "ArrowUp") {
    tryJump();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key in controls) {
    setControlState(event.key, false);
    event.preventDefault();
  }
});

window.addEventListener("blur", () => {
  setControlState("ArrowLeft", false);
  setControlState("ArrowRight", false);
  setControlState("ArrowUp", false);
});

bindTouchControls();
loadBestTimes();
createLevel(game.level);
updateHUD();
requestAnimationFrame(gameLoop);
