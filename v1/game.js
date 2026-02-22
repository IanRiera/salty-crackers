const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const DEBUG_SHOW_FINISH = false;

const levelText = document.getElementById("levelText");
const crackersText = document.getElementById("crackersText");
const coinsValue = document.getElementById("coinsValue");
const statusText = document.getElementById("statusText");
const staminaBar = document.getElementById("staminaBar");
const staminaPillCount = document.getElementById("staminaPillCount");
const speedPillCount = document.getElementById("speedPillCount");
const noStaminaPillCount = document.getElementById("nostaminaPillCount");
const shopOverlay = document.getElementById("shopOverlay");
const shopCoins = document.getElementById("shopCoins");
const shopMessage = document.getElementById("shopMessage");
const shopNext = document.getElementById("shopNext");
const shopButtons = document.querySelectorAll(".shop-btn");
const touchItemButtons = document.querySelectorAll(".touch-btn-item");
const menuOverlay = document.getElementById("menuOverlay");
const menuMain = document.getElementById("menuMain");
const menuHelp = document.getElementById("menuHelp");
const menuAbout = document.getElementById("menuAbout");
const playBtn = document.getElementById("playBtn");
const helpBtn = document.getElementById("helpBtn");
const aboutBtn = document.getElementById("aboutBtn");
const backFromHelp = document.getElementById("backFromHelp");
const backFromAbout = document.getElementById("backFromAbout");
const restartBtn = document.getElementById("restartBtn");
const menuBtn = document.getElementById("menuBtn");
const restartFromMenu = document.getElementById("restartFromMenu");

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
  coins: 0,
  inShop: false,
  rewardPending: false,
  speedBoostUntil: 0,
  noStaminaUntil: 0,
  screen: "menu",
  inventory: {
    stamina: 0,
    speed: 0,
    nostamina: 0,
  },
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
  player.lastUseFx = null;

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
  coinsValue.textContent = `${game.coins}`;
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

  const speedBoostActive = performance.now() < game.speedBoostUntil;
  const speedScale = speedBoostActive
    ? 1.1
    : Math.max(0.55, 1.1 - (growthValue - 1) * 0.55);
  const jumpScale = Math.max(0.72, 1.0 - (growthValue - 1) * 0.55);
  player.speed = player.baseSpeed * speedScale;
  player.jumpPower = player.baseJumpPower * jumpScale;

  if (staminaPillCount) staminaPillCount.textContent = `${game.inventory.stamina}`;
  if (speedPillCount) speedPillCount.textContent = `${game.inventory.speed}`;
  if (noStaminaPillCount) noStaminaPillCount.textContent = `${game.inventory.nostamina}`;
}

function tryJump() {
  if (player.exhausted) return;
  if (player.jumpsRemaining <= 0) return;
  const noDrainActive = performance.now() < game.noStaminaUntil;
  const jumpIndex = player.maxJumps - player.jumpsRemaining + 1;
  const baseCost = 10;
  const cost = jumpIndex >= 2 ? baseCost * 2 : baseCost;
  if (!noDrainActive) {
    if (player.stamina < cost) return;
    player.stamina = Math.max(0, player.stamina - cost);
  }
  player.vy = -player.jumpPower;
  player.onGround = false;
  player.jumpsRemaining -= 1;
  if (!noDrainActive && player.stamina <= 0) {
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
  const noDrainActive = performance.now() < game.noStaminaUntil;

  if (!player.exhausted && moving && !noDrainActive) {
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
    game.transitionTimer = 60;
    game.rewardPending = true;
    const idx = game.level - 1;
    const previous = game.bestTimes[idx];
    if (!previous || game.levelElapsedMs < previous) {
      game.bestTimes[idx] = game.levelElapsedMs;
      saveBestTimes();
    }
  }
}

function openShop() {
  if (!shopOverlay) return;
  if (game.screen !== "game") return;
  if (game.inShop) return;
  if (game.rewardPending) {
    game.coins += 100;
    game.rewardPending = false;
  }
  game.inShop = true;
  setControlState("ArrowLeft", false);
  setControlState("ArrowRight", false);
  setControlState("ArrowUp", false);
  shopOverlay.classList.remove("is-hidden");
  shopOverlay.setAttribute("aria-hidden", "false");
  shopCoins.textContent = `${game.coins}`;
  shopMessage.textContent = "";
  shopNext.textContent = game.level >= game.totalLevels ? "Finish" : "Next Level";
}

function closeShop() {
  if (!shopOverlay) return;
  shopOverlay.classList.add("is-hidden");
  shopOverlay.setAttribute("aria-hidden", "true");
  game.inShop = false;
}

function tryPurchase(item) {
  if (item === "stamina") {
    if (game.coins < 50) {
      shopMessage.textContent = "Not enough coins.";
      return;
    }
    game.coins -= 50;
    game.inventory.stamina += 1;
    shopMessage.textContent = "Stamina pill added.";
  }

  if (item === "speed") {
    if (game.coins < 125) {
      shopMessage.textContent = "Not enough coins.";
      return;
    }
    game.coins -= 125;
    game.inventory.speed += 1;
    shopMessage.textContent = "Speed pill added.";
  }

  if (item === "nostamina") {
    if (game.coins < 150) {
      shopMessage.textContent = "Not enough coins.";
      return;
    }
    game.coins -= 150;
    game.inventory.nostamina += 1;
    shopMessage.textContent = "No-stamina pill added.";
  }

  shopCoins.textContent = `${game.coins}`;
  updateHUD();
}

function useStaminaPill() {
  if (game.inventory.stamina <= 0) return;
  game.inventory.stamina -= 1;
  player.stamina = player.staminaMax;
  player.exhausted = false;
  player.lastUseFx = { type: "stamina", until: performance.now() + 450 };
}

function useSpeedPill() {
  if (game.inventory.speed <= 0) return;
  game.inventory.speed -= 1;
  game.speedBoostUntil = performance.now() + 5000;
  player.lastUseFx = { type: "speed", until: performance.now() + 450 };
}

function useNoStaminaPill() {
  if (game.inventory.nostamina <= 0) return;
  game.inventory.nostamina -= 1;
  game.noStaminaUntil = performance.now() + 5000;
  player.lastUseFx = { type: "nostamina", until: performance.now() + 450 };
}

function advanceLevel() {
  if (game.level >= game.totalLevels) {
    game.completed = true;
    return;
  }

  game.level += 1;
  createLevel(game.level);
  updateHUD();
}

function resetGameState() {
  game.level = 1;
  game.crackersCollected = 0;
  game.crackersTarget = 0;
  game.completed = false;
  game.transitionTimer = 0;
  game.levelStartMs = 0;
  game.levelElapsedMs = 0;
  game.coins = 0;
  game.inShop = false;
  game.rewardPending = false;
  game.speedBoostUntil = 0;
  game.noStaminaUntil = 0;
  game.inventory.stamina = 0;
  game.inventory.speed = 0;
  game.inventory.nostamina = 0;
  closeShop();
  createLevel(game.level);
  updateHUD();
}

function setScreen(screen) {
  game.screen = screen;
  document.body.dataset.screen = screen;
  if (menuOverlay) {
    if (screen === "game") {
      menuOverlay.classList.add("is-hidden");
      menuOverlay.setAttribute("aria-hidden", "true");
    } else {
      menuOverlay.classList.remove("is-hidden");
      menuOverlay.setAttribute("aria-hidden", "false");
    }
  }
}

function showMenuPanel(panel) {
  if (!menuMain || !menuHelp || !menuAbout) return;
  menuMain.classList.toggle("is-hidden", panel !== "main");
  menuHelp.classList.toggle("is-hidden", panel !== "help");
  menuAbout.classList.toggle("is-hidden", panel !== "about");
}

function nextLevelIfReady() {
  if (game.transitionTimer <= 0) return;
  game.transitionTimer -= 1;

  if (game.transitionTimer === 0) {
    openShop();
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
  const bellyRadius = 3 + (growth - 1) * 12;
  const centerX = player.x + player.w / 2;
  const headY = player.y + 12;
  const faceTone = player.exhausted ? "#a7d8b8" : "#f2bb9c";
  const dressBase = "#f56f85";
  const dressDark = "#d65a73";
  const dressLight = "#f58a9f";

  // Hair
  ctx.fillStyle = "#3a241a";
  ctx.beginPath();
  ctx.arc(centerX, headY - 2, 12, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(centerX - 11, headY - 2, 22, 16);

  // Head
  ctx.fillStyle = faceTone;
  ctx.beginPath();
  ctx.arc(centerX, headY, 10, 0, Math.PI * 2);
  ctx.fill();

  // Eyes + mouth
  ctx.fillStyle = "#2b1c0f";
  ctx.beginPath();
  ctx.arc(centerX - 3.5, headY - 1, 1.2, 0, Math.PI * 2);
  ctx.arc(centerX + 3.5, headY - 1, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#8c4a3a";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(centerX, headY + 4, 3, 0, Math.PI);
  ctx.stroke();

  // Neck
  ctx.fillStyle = faceTone;
  ctx.fillRect(centerX - 2, headY + 8, 4, 5);

  // Dress top with folds
  const dressGrad = ctx.createLinearGradient(player.x + 4, player.y + 30, player.x + 26, player.y + 56);
  dressGrad.addColorStop(0, "#ff7b6f");
  dressGrad.addColorStop(0.5, "#ff6a5f");
  dressGrad.addColorStop(1, "#e9554c");
  ctx.fillStyle = dressGrad;
  ctx.fillRect(player.x + 4, player.y + 30, 22, 26);
  ctx.strokeStyle = "rgba(140, 65, 58, 0.45)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(player.x + 8, player.y + 32);
  ctx.lineTo(player.x + 10, player.y + 54);
  ctx.moveTo(player.x + 16, player.y + 32);
  ctx.lineTo(player.x + 14, player.y + 54);
  ctx.stroke();

  // Arms
  ctx.strokeStyle = faceTone;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(player.x + 6, player.y + 36);
  ctx.lineTo(player.x + 2, player.y + 46);
  ctx.moveTo(player.x + 24, player.y + 36);
  ctx.lineTo(player.x + 28, player.y + 46);
  ctx.stroke();

  // Belly as cloth bulge (minimal at level 1)
  const bellyX = centerX + (player.facing === 1 ? 8 : -8);
  const bellyY = player.y + 48;
  const bellyGrad = ctx.createRadialGradient(
    bellyX - 4,
    bellyY - 4,
    2,
    bellyX,
    bellyY,
    bellyRadius + 6
  );
  bellyGrad.addColorStop(0, dressLight);
  bellyGrad.addColorStop(0.55, dressBase);
  bellyGrad.addColorStop(1, dressDark);
  ctx.fillStyle = bellyGrad;
  ctx.beginPath();
  ctx.arc(bellyX, bellyY, bellyRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(120, 55, 75, 0.28)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(bellyX + 2, bellyY + 2, Math.max(2, bellyRadius - 2), -0.2, Math.PI * 0.8);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(bellyX - 3, bellyY - 3, Math.max(1, bellyRadius - 6), -0.2, Math.PI * 0.2);
  ctx.stroke();

  // Skirt with folds
  const skirtGrad = ctx.createLinearGradient(player.x + 4, player.y + 52, player.x + 26, player.y + 66);
  skirtGrad.addColorStop(0, dressLight);
  skirtGrad.addColorStop(1, dressDark);
  ctx.fillStyle = skirtGrad;
  ctx.beginPath();
  ctx.moveTo(player.x + 4, player.y + 52);
  ctx.lineTo(player.x + 26, player.y + 52);
  ctx.lineTo(player.x + 22, player.y + 64);
  ctx.lineTo(player.x + 8, player.y + 64);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(140, 65, 58, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(player.x + 9, player.y + 54);
  ctx.lineTo(player.x + 10, player.y + 63);
  ctx.moveTo(player.x + 17, player.y + 54);
  ctx.lineTo(player.x + 16, player.y + 63);
  ctx.stroke();

  // Legs + shoes
  ctx.strokeStyle = "#4c2b1d";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(player.x + 10, player.y + player.h - 2);
  ctx.lineTo(player.x + 10, player.y + 58);
  ctx.moveTo(player.x + 20, player.y + player.h - 2);
  ctx.lineTo(player.x + 20, player.y + 58);
  ctx.stroke();
  ctx.fillStyle = "#2b1c0f";
  ctx.fillRect(player.x + 6, player.y + player.h - 4, 8, 4);
  ctx.fillRect(player.x + 16, player.y + player.h - 4, 8, 4);

  if (player.lastUseFx && player.lastUseFx.until > performance.now()) {
    const pillX = player.x + player.w + 6;
    const pillY = player.y + 20;
    const w = 18;
    const h = 10;
    const r = h / 2;
    const isSpeed = player.lastUseFx.type === "speed";
    const isNoStamina = player.lastUseFx.type === "nostamina";
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#7b4a2c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pillX + r, pillY + r, r, Math.PI / 2, Math.PI * 1.5);
    ctx.arc(pillX + w - r, pillY + r, r, Math.PI * 1.5, Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = isNoStamina ? "#b9a6ff" : (isSpeed ? "#9fd0ff" : "#f2a6a6");
    ctx.beginPath();
    ctx.rect(pillX + w / 2, pillY, w / 2, h);
    ctx.fill();
  }
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

  const babyX = world.width / 2;
  const babyY = 300;

  // Blanket
  const blanketGrad = ctx.createLinearGradient(babyX - 110, babyY + 40, babyX + 110, babyY + 120);
  blanketGrad.addColorStop(0, "#ffe2b5");
  blanketGrad.addColorStop(1, "#f4c68c");
  ctx.fillStyle = blanketGrad;
  ctx.beginPath();
  ctx.ellipse(babyX, babyY + 80, 140, 60, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head with shading
  const headGrad = ctx.createRadialGradient(babyX - 18, babyY - 10, 8, babyX, babyY, 70);
  headGrad.addColorStop(0, "#ffd8c4");
  headGrad.addColorStop(0.6, "#f2bb9c");
  headGrad.addColorStop(1, "#e2a789");
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(babyX, babyY, 70, 0, Math.PI * 2);
  ctx.fill();

  // Hair curl
  ctx.strokeStyle = "#5a3118";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(babyX - 18, babyY - 28, 10, 0.2, Math.PI * 1.4);
  ctx.stroke();

  // Eyes + mouth
  ctx.fillStyle = "#2b1c0f";
  ctx.beginPath();
  ctx.arc(babyX - 18, babyY - 4, 4, 0, Math.PI * 2);
  ctx.arc(babyX + 18, babyY - 4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#b85a5a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(babyX, babyY + 16, 10, 0, Math.PI);
  ctx.stroke();

  // Swaddle
  ctx.fillStyle = "#ffd34f";
  ctx.beginPath();
  ctx.ellipse(babyX, babyY + 55, 85, 45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(170, 120, 35, 0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(babyX - 60, babyY + 40);
  ctx.lineTo(babyX + 60, babyY + 70);
  ctx.stroke();

  ctx.fillStyle = "#5a3118";
  ctx.font = "bold 24px Verdana";
  ctx.fillText("A healthy new beginning", world.width / 2, 410);
  ctx.font = "20px Verdana";
  ctx.fillText("Reload page to play again", world.width / 2, 450);
}

function render(time) {
  ctx.clearRect(0, 0, world.width, world.height);
  if (DEBUG_SHOW_FINISH) {
    drawFinishScene();
    return;
  }

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

  if (!game.completed && game.screen === "game") {
    if (!game.levelStartMs) {
      game.levelStartMs = time;
    }
    if (game.transitionTimer <= 0 && !game.inShop) {
      game.levelElapsedMs += delta;
    }
    if (!game.inShop) {
      updateStamina(delta);
      handleInput();
      applyPhysics();
      collectCrackers(time);
    }
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

  if (event.key === "1") {
    useStaminaPill();
  }
  if (event.key === "2") {
    useSpeedPill();
  }
  if (event.key === "3") {
    useNoStaminaPill();
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
setScreen("menu");
showMenuPanel("main");
requestAnimationFrame(gameLoop);

for (const button of shopButtons) {
  button.addEventListener("click", () => {
    tryPurchase(button.dataset.item);
  });
}

if (shopNext) {
  shopNext.addEventListener("click", () => {
    closeShop();
    if (game.level >= game.totalLevels) {
      game.completed = true;
      return;
    }
    advanceLevel();
  });
}

for (const button of touchItemButtons) {
  button.addEventListener("click", () => {
    const item = button.dataset.item;
    if (item === "stamina") useStaminaPill();
    if (item === "speed") useSpeedPill();
    if (item === "nostamina") useNoStaminaPill();
  });
}

if (playBtn) {
  playBtn.addEventListener("click", () => {
    showMenuPanel("main");
    setScreen("game");
  });
}

if (helpBtn) {
  helpBtn.addEventListener("click", () => {
    showMenuPanel("help");
  });
}

if (aboutBtn) {
  aboutBtn.addEventListener("click", () => {
    showMenuPanel("about");
  });
}

if (backFromHelp) {
  backFromHelp.addEventListener("click", () => {
    showMenuPanel("main");
  });
}

if (backFromAbout) {
  backFromAbout.addEventListener("click", () => {
    showMenuPanel("main");
  });
}

if (restartBtn) {
  restartBtn.addEventListener("click", () => {
    resetGameState();
    setScreen("game");
  });
}

if (menuBtn) {
  menuBtn.addEventListener("click", () => {
    showMenuPanel("main");
    setScreen("menu");
  });
}

if (restartFromMenu) {
  restartFromMenu.addEventListener("click", () => {
    resetGameState();
    showMenuPanel("main");
    setScreen("game");
  });
}
