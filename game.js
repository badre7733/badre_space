//--------------------------------------
//juego hecho por badredin azzahraoui 
//v1.2
//--------------------------------------
// -------------------------------------
// CANVAS
// -------------------------------------
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 500;
canvas.height = 640;

// -------------------------------------
// IMÁGENES
// -------------------------------------
const ships = {
    basic: "img/player.png",
    fast: "img/player_fast.png",
    tank: "img/player_tank.png",
    special: "img/player_special.png"
};

const shipStats = {
    basic: { w: 40, h: 40, speed: 5, price: 0 },
    fast: { w: 45, h: 45, speed: 7, price: 500 },
    tank: { w: 55, h: 55, speed: 4, price: 1500 },
    special:{ w: 60, h: 60, speed: 8, price: 2000 } 
};

// Cargar imágenes
let shipImgs = {};
Object.keys(ships).forEach(k => {
    const im = new Image();
    im.src = ships[k];
    shipImgs[k] = im;
});

// Enemigos y Bosses
const enemyImg = new Image();
enemyImg.src = "img/enemy.png";

const bossImgs = [
    "img/boss1.png",
    "img/boss2.png",
    "img/boss3.png",
    "img/boss4.png",
    "img/boss5.png"
].map(src => {
    let i = new Image();
    i.src = src;
    return i;
});

// -------------------------------------
// SISTEMA DE NAVE SELECCIONADA
// -------------------------------------
let ownedShips = JSON.parse(localStorage.getItem("ownedShips") || '["basic"]');
let selectedShip = localStorage.getItem("selectedShip") || "basic";

// -------------------------------------
// VARIABLES DE JUEGO
// -------------------------------------
let level = 1;
let score = 0;
let lives = 3;
let gameOver = false;
let paused = false;

let enemies = [];
let bullets = [];
let enemyBullets = [];
let bossBullets = [];

let currentBoss = null;
let bossActive = false;

// -------------------------------------
// PLAYER
// -------------------------------------
const player = {
    x: canvas.width / 2 - 20,
    y: canvas.height - 80,

    get w() { return shipStats[selectedShip].w; },
    get h() { return shipStats[selectedShip].h; },
    get speed() { return shipStats[selectedShip].speed; }
};

// -------------------------------------
// INPUT
// -------------------------------------
let keys = {};

document.addEventListener("keydown", (e) => {
    if (e.code === "KeyP") paused = !paused;
    keys[e.code] = true;
});

document.addEventListener("keyup", (e) => keys[e.code] = false);

// -------------------------------------
// PLAYER SHOOT
// -------------------------------------
document.addEventListener("keydown", (e) => {
    if (!paused && e.code === "Space") {
        bullets.push({
            x: player.x + player.w / 2 - 2,
            y: player.y,
            w: 4, h: 10, speed: 8
        });
    }
});

// -------------------------------------
// SPAWN ENEMIES
// -------------------------------------
function spawnEnemies() {
    enemies = [];
    for (let i = 0; i < 5 + level; i++) {
        enemies.push({
            x: 40 + (i % 5) * 80,
            y: 40 + Math.floor(i / 5) * 50,
            w: 40,
            h: 40,
            dir: 1,
            speed: 1 + level * 0.2
        });
    }
}

// -------------------------------------
// SPAWN BOSS
// -------------------------------------
function spawnBoss() {
    bossActive = true;

    currentBoss = {
        x: canvas.width / 2 - 60,
        y: 40,
        w: 120,
        h: 120,
        life: 50 + level * 20,
        speed: 2,
        img: bossImgs[(level / 2 - 1) % bossImgs.length],
        dir: 1
    };
}

// -------------------------------------
// COLLISION
// -------------------------------------
function coll(a, b) {
    return a.x < b.x + b.w &&
           a.x + a.w > b.x &&
           a.y < b.y + b.h &&
           a.y + a.h > b.y;
}

// -------------------------------------
// UPDATE
// -------------------------------------
function update() {
    if (paused || gameOver) return;

    // PLAYER MOV
    if (keys["ArrowLeft"] && player.x > 0) player.x -= player.speed;
    if (keys["ArrowRight"] && player.x + player.w < canvas.width) player.x += player.speed;

    // ENEMIES
    enemies.forEach(e => {
        e.x += e.dir * e.speed;

        if (e.x < 0 || e.x + e.w > canvas.width) {
            e.dir *= -1;
            e.y += 10;
        }

        if (Math.random() < 0.005) {
            enemyBullets.push({
                x: e.x + e.w / 2 - 2,
                y: e.y + e.h,
                w: 4, h: 10, speed: 4
            });
        }
    });

    // BOSS
    if (bossActive && currentBoss) {
        currentBoss.x += currentBoss.dir * currentBoss.speed;

        if (currentBoss.x < 0 || currentBoss.x + currentBoss.w > canvas.width) {
            currentBoss.dir *= -1;
        }

        if (Math.random() < 0.02) {
            bossBullets.push({
                x: currentBoss.x + currentBoss.w / 2 - 5,
                y: currentBoss.y + currentBoss.h,
                w: 8, h: 16, speed: 8
            });
        }
    }

    // BULLETS
    bullets.forEach(b => b.y -= b.speed);
    bullets = bullets.filter(b => b.y > -20);

    enemyBullets.forEach(b => b.y += b.speed);
    enemyBullets = enemyBullets.filter(b => b.y < canvas.height + 20);

    bossBullets.forEach(b => b.y += b.speed);
    bossBullets = bossBullets.filter(b => b.y < canvas.height + 50);

    // COLL ENEMIES
    bullets.forEach(b => {
        enemies.forEach((e, i) => {
            if (coll(b, e)) {
                enemies.splice(i, 1);
                b.y = -999;
                score += 10;
            }
        });
    });

    // COLL BOSS
    if (bossActive && currentBoss) {
        bullets.forEach(b => {
            if (coll(b, currentBoss)) {
                currentBoss.life -= 5;
                b.y = -999;
            }
        });

        if (currentBoss.life <= 0) {
            bossActive = false;
            currentBoss = null;
            level++;
            spawnEnemies();
        }
    }

    // DAMAGE
    enemyBullets.forEach(b => {
        if (coll(b, player)) {
            lives--;
            b.y = 999;

            if (lives <= 0) gameOver = true;
        }
    });

    bossBullets.forEach(b => {
        if (coll(b, player)) {
            lives--;
            b.y = 999;

            if (lives <= 0) gameOver = true;
        }
    });

    // NEXT LEVEL
    if (!bossActive && enemies.length === 0) {
        level++;

        if (level % 2 === 0) spawnBoss();
        else spawnEnemies();
    }
}

// -------------------------------------
// DRAW MENU / TIENDA
// -------------------------------------
function drawMenu() {
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    ctx.fillStyle = "white";
    ctx.font = "32px Arial";
    ctx.fillText("PAUSA / TIENDA", 100, 80);

    ctx.font = "22px Arial";
    ctx.fillText("Score (monedas): " + score, 120, 130);

    let y = 200;

    Object.keys(shipStats).forEach(ship => {
        let owned = ownedShips.includes(ship);
        let txt = `${ship.toUpperCase()} — ${shipStats[ship].price} pts`;

        ctx.fillStyle = owned ? "lime" : "white";
        ctx.fillText(txt, 80, y);

        if (!owned) {
            ctx.fillStyle = "orange";
            ctx.fillText("Comprar → ENTER (" + ship + ")", 80, y + 25);
        } else {
            ctx.fillStyle = ship === selectedShip ? "cyan" : "gray";
            ctx.fillText("Equipar → ENTER (" + ship + ")", 80, y + 25);
        }

        y += 80;
    });

    ctx.fillStyle = "yellow";
    ctx.fillText("Nave actual: " + selectedShip.toUpperCase(), 80, 500);
    ctx.fillText("Presiona P para continuar", 80, 560);
}

// -------------------------------------
// DRAW
// -------------------------------------
function draw() {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Player
    ctx.drawImage(shipImgs[selectedShip], player.x, player.y, player.w, player.h);

    // Enemies
    enemies.forEach(e => {
        ctx.drawImage(enemyImg, e.x, e.y, e.w, e.h);
    });

    // Bullets
    ctx.fillStyle = "yellow";
    bullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));

    // Enemy bullets
    ctx.fillStyle = "red";
    enemyBullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));

    // Boss bullets
    ctx.fillStyle = "orange";
    bossBullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));

    // Boss
    if (bossActive && currentBoss) {
        ctx.drawImage(currentBoss.img, currentBoss.x, currentBoss.y, currentBoss.w, currentBoss.h);

        ctx.fillStyle = "white";
        ctx.fillRect(20, 10, canvas.width - 40, 10);

        ctx.fillStyle = "red";
        let lifeWidth = (currentBoss.life / (50 + level * 20)) * (canvas.width - 40);
        ctx.fillRect(20, 10, lifeWidth, 10);
    }

    // HUD
    ctx.fillStyle = "white";
    ctx.font = "18px Arial";
    ctx.fillText("Nivel: " + level, 10, 620);
    ctx.fillText("Score: " + score, 380, 620);
    ctx.fillText("Vidas: " + lives, 200, 620);

    if (paused || gameOver) drawMenu();
}

// -------------------------------------
// TIENDA: COMPRAR / EQUIPAR
// -------------------------------------
document.addEventListener("keydown", (e) => {
    if (!paused && !gameOver) return;
    if (e.code !== "Enter") return;

    Object.keys(shipStats).forEach(ship => {
        if (keys["Enter"]) {

            if (!ownedShips.includes(ship)) {
                // Comprar
                if (score >= shipStats[ship].price) {
                    score -= shipStats[ship].price;
                    ownedShips.push(ship);
                    localStorage.setItem("ownedShips", JSON.stringify(ownedShips));
                }
            } else {
                // Equipar
                selectedShip = ship;
                localStorage.setItem("selectedShip", ship);
            }
        }
    });
});

// -------------------------------------
// LOOP
// -------------------------------------
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

// START
spawnEnemies();
loop();
