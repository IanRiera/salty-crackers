const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const levelText = document.getElementById("levelText");
const crackersText = document.getElementById("crackersText");
const statusText = document.getElementById("statusText");

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

const game = {
  totalLevels: 9,
  level: 1,
  crackersCollected: 0,
  crackersTarget: 0,
  completed: false,
  transitionTimer: 0,
};

const player = {
  x: 90,
  y: 100,
  w: 30,
  h: 64,
  vx: 0,
  vy: 0,
  speed: 0.85,
  jumpPower: 12,
  onGround: false,
  facing: 1,
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
}

function crackersTargetSafe(value) {
  game.crackersTarget = Math.max(1, value);
  game.crackersCollected = 0;
}

function updateHUD() {
  levelText.textContent = `Level ${Math.min(game.level, game.totalLevels)} / ${game.totalLevels}`;
  crackersText.textContent = `Crackers: ${game.crackersCollected} / ${game.crackersTarget}`;
  const growth = (1 + (Math.min(game.level, game.totalLevels) - 1) * 0.16).toFixed(2);
  statusText.textContent = `Belly Growth: ${growth}x`;
}

function handleInput() {
  if (controls.ArrowLeft) {
    player.vx -= player.speed;
    player.facing = -1;
  }
  if (controls.ArrowRight) {
    player.vx += player.speed;
    player.facing = 1;
  }
  if (controls.ArrowUp && player.onGround) {
    player.vy = -player.jumpPower;
    player.onGround = false;
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
    }

    cracker.bob = Math.sin(time * 0.004 + cracker.bobOffset) * 2.5;
  }

  if (game.crackersCollected >= game.crackersTarget && game.transitionTimer <= 0) {
    game.transitionTimer = 75;
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

  ctx.fillStyle = "#f2bb9c";
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
  ctx.fillText(text, world.width / 2, world.height / 2);
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
  if (!game.completed) {
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
    controls[event.key] = true;
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key in controls) {
    controls[event.key] = false;
    event.preventDefault();
  }
});

createLevel(game.level);
updateHUD();
requestAnimationFrame(gameLoop);
