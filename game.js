
// ===============================================
// JUEGO MEJORADO CON CHISPA MAXIMA - 2025 EDITION
// ===============================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 500;
canvas.height = 640;

// ---------- IMÁGENES (NO TOCADAS) ----------
const ships = {
    basic: "img/player.png",
    fast: "img/player_fast.png",
    tank: "img/player_tank.png",
    special: "img/player_special.png"
};

const shipStats = {
    basic: { w: 40, h: 40, speed: 5, price: 0 },
    fast: { w: 45, h: 45, speed: 7, price: 200 },
    tank: { w: 55, h: 55, speed: 8, price: 500 },
    special: { w: 60, h: 60, speed: 10, price: 700 }
};

let shipImgs = {};
Object.keys(ships).forEach(k => {
    const im = new Image();
    im.src = ships[k];
    shipImgs[k] = im;
});

const enemyImg = new Image(); enemyImg.src = "img/enemy.png";
const bossImgs = ["img/boss.png","img/boss1.png","img/boss2.png","img/boss3.png","img/boss4.png","img/boss5.png"]
    .map(src => { let i=new Image(); i.src=src; return i; });

// ---------- VARIABLES GLOBALES ----------
let ownedShips = JSON.parse(localStorage.getItem("ownedShips") || '["basic"]');
let selectedShip = localStorage.getItem("selectedShip") || "basic";

let score = 0, lives = 3, level = 1, gameOver = false, paused = true;
let enemies = [], bullets = [], enemyBullets = [], bossBullets = [], particles = [], explosions = [];
let currentBoss = null, bossActive = false;

// Power-up temporal
let doubleShot = false, doubleTimer = 0;

// ---------- PARTICULAS & EXPLOSIONES ----------
function createParticles(x,y,color="yellow",count=15) {
    for(let i=0;i<count;i++){
        particles.push({
            x, y,
            vx: Math.random()*8-4,
            vy: Math.random()*8-4,
            life: 30+Math.random()*20,
            color,
            size: 2+Math.random()*3
        });
    }
}

function createExplosion(x,y,size=1) {
    explosions.push({x,y,size,life:20});
    createParticles(x,y,"orange",30);
    createParticles(x,y,"yellow",20);
    createParticles(x,y,"red",15);
}

// ---------- SONIDOS (Web Audio API - sin archivos) ----------
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function beep(freq=440,duration=0.1,vol=0.3,type="square") {
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = freq;
    osc.type = type;
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
}

function shootSound(){ beep(800,0.08,0.2,"triangle"); }
function enemyDie(){ beep(200,0.15,0.4,"sawtooth"); }
function bossHit(){ beep(100,0.3,0.6,"square"); }
function playerHit(){ beep(150,0.4,0.5,"sine"); }
function explosionSound(){ beep(80,0.4,0.8,"sawtooth"); }

// ---------- PLAYER ----------
const player = {
    x: canvas.width/2-20,
    y: canvas.height-100,
    ship: selectedShip,
    get w(){return shipStats[this.ship].w},
    get h(){return shipStats[this.ship].h},
    get speed(){return shipStats[this.ship].speed},
    invulnerable: 0,

    updateShip(){
        this.ship = selectedShip;
        if(this.x + this.w > canvas.width) this.x = canvas.width - this.w;
    }
};

// ---------- INPUT ----------
let keys = {};
window.addEventListener("keydown", e=>{
    keys[e.code]=true;
    if(e.code==="KeyP" && !gameOver) { paused=!paused; if(!paused) audioCtx.resume(); }
    if(e.code==="Space") e.preventDefault();
});
window.addEventListener("keyup", e=>keys[e.code]=false);

// Disparo
let canShoot = true;
window.addEventListener("keydown", e=>{
    if(paused || gameOver || e.code!=="Space") return;
    if(canShoot){
        shootSound();
        let px = player.x + player.w/2;
        bullets.push({x:px-3, y:player.y, w:6,h:16,speed:12,color:"#0ff"});
        if(doubleShot){
            bullets.push({x:px-12, y:player.y+10, w:6,h:16,speed:12,color:"#0ff"});
            bullets.push({x:px+6, y:player.y+10, w:6,h:16,speed:12,color:"#0ff"});
        }
        canShoot=false;
        setTimeout(()=>{canShoot=true;}, doubleShot?150:250);
    }
});

// ---------- SPAWN ----------
function spawnEnemies(){
    enemies=[];
    let rows = 3 + Math.floor(level/3);
    let cols = 6;
    for(let r=0;r<rows;r++){
        for(let c=0;c<cols;c++){
            enemies.push({
                x: 50 + c*65,
                y: 50 + r*55,
                w:40,h:40,
                dir:1,
                speed:0.8 + level*0.15 + r*0.1,
                shootTimer: Math.random()*100
            });
        }
    }
}

function spawnBoss(){
    bossActive=true;
    currentBoss = {
        x: canvas.width/2 - 80,
        y: 30,
        w:160,h:140,
        life: 80 + level*35,
        maxLife: 80 + level*35,
        speed:1.5 + level*0.2,
        dir:1,
        img: bossImgs[Math.floor(level/2) % bossImgs.length],
        shootTimer:0
    };
}

// ---------- COLISIÓN ----------
function coll(a,b){
    return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}

// ---------- UPDATE ----------
function update(){
    if(paused || gameOver) return;

    // Player movement + efecto "inercia visual"
    if(keys["ArrowLeft"] && player.x>0) player.x -= player.speed;
    if(keys["ArrowRight"] && player.x+player.w<canvas.width) player.x += player.speed;

    player.invulnerable = Math.max(0, player.invulnerable-1);

    // Enemies
    let edge = false;
    enemies.forEach(e=>{
        e.x += e.dir * e.speed;
        e.shootTimer++;
        if(e.x <=0 || e.x+e.w >= canvas.width) edge=true;
        if(e.shootTimer > 120 + Math.random()*200){
            enemyBullets.push({
                x: e.x + e.w/2 -4,
                y: e.y + e.h,
                w:8,h:18,speed:3+level*0.3,
                color: "#f0f"
            });
            e.shootTimer=0;
            beep(300,0.1,0.2);
        }
    });
    if(edge){
        enemies.forEach(e=>{ e.dir *= -1; e.y += 25; });
    }

    // Boss
    if(bossActive && currentBoss){
        currentBoss.x += currentBoss.dir * currentBoss.speed;
        if(currentBoss.x <=0 || currentBoss.x+currentBoss.w >= canvas.width) currentBoss.dir *= -1;

        currentBoss.shootTimer++;
        if(currentBoss.shootTimer > 80){
            let patterns = [
                ()=>bossBullets.push({x:currentBoss.x+30,y:currentBoss.y+currentBoss.h,w:12,h:25,speed:5,color:"#ff0"}),
                ()=>bossBullets.push({x:currentBoss.x+currentBoss.w-42,y:currentBoss.y+currentBoss.h,w:12,h:25,speed:5,color:"#ff0"}),
                ()=>{
                    for(let i=-2;i<=2;i++){
                        bossBullets.push({
                            x:currentBoss.x + currentBoss.w/2 -6,
                            y:currentBoss.y+currentBoss.h,
                            w:10,h:20,
                            speed:4,
                            vx:i*2,
                            color:"#f80"
                        });
                }
            ];
            patterns[Math.floor(Math.random()*patterns.length)]();
            currentBoss.shootTimer=0;
            beep(150,0.2,0.5);
        }
    }

    // Bullets movement
    bullets.forEach(b=> { b.y -= b.speed; });
    bullets = bullets.filter(b=>b.y > -50);
    enemyBullets.forEach(b=> { b.y += b.speed; if(b.vx) b.x += b.vx; });
    enemyBullets = enemyBullets.filter(b=>b.y < canvas.height+50);
    bossBullets.forEach(b=> { b.y += b.speed; if(b.vx) b.x += b.vx; });
    bossBullets = bossBullets.filter(b=>b.y < canvas.height+50);

    // Colisiones balas jugador → enemigos
    for(let i=bullets.length-1;i>=0;i--){
        let b = bullets[i];
        // Enemigos normales
        for(let j=enemies.length-1;j>=0;j--){
            if(coll(b,enemies[j])){
                createExplosion(enemies[j].x+20,enemies[j].y+20);
                enemyDie();
                enemies.splice(j,1);
                bullets.splice(i,1);
                score += 20 + level*5;
                // Posible power-up
                if(Math.random()<0.07){
                    doubleShot=true;
                    doubleTimer=800;
                }
                break;
            }
        }
        // Boss
        if(bossActive && currentBoss && coll(b,currentBoss)){
            currentBoss.life -= 8 + (doubleShot?4:0);
            bullets.splice(i,1);
            bossHit();
            createParticles(b.x,b.y,"cyan",10);
            if(currentBoss.life<=0){
                explosionSound();
                createExplosion(currentBoss.x+80,currentBoss.y+70,2);
                score += 500 + level*200;
                bossActive=false;
                currentBoss=null;
                level++;
                spawnEnemies();
            }
        }
    }

    // Daño al jugador
    [...enemyBullets, ...bossBullets].forEach(b=>{
        if(player.invulnerable===0 && coll(b,player)){
            lives--;
            playerHit();
            player.invulnerable = 120;
            createExplosion(player.x+player.w/2, player.y+player.h/2);
            b.y = 9999;
            if(lives<=0){
                gameOver=true;
                explosionSound();
                createExplosion(player.x+player.w/2, player.y+player.h/2,3);
            }
        }
    });

    // Siguiente oleada
    if(!bossActive && enemies.length===0){
        level++;
        if(level%3===0) spawnBoss();
        else spawnEnemies();
    }

    // Double shot timer
    if(doubleShot){
        doubleTimer--;
        if(doubleTimer<=0) doubleShot=false;
    }

    // Partículas
    particles = particles.filter(p=>{
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        return p.life>0;
    });

    explosions = explosions.filter(e=> {
        e.life--;
        e.size += 0.5;
        return e.life>0;
    });
}

// ---------- DRAW ----------
function draw(){
    // Fondo con estrellas animadas
    ctx.fillStyle = "#000814";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // Estrellas parpadeantes
    for(let i=0;i<80;i++){
        let x = (i*37 + Date.now()*0.02)%canvas.width;
        let y = (i*59 + Date.now()*0.01)%canvas.height;
        let brightness = 127 + 128*Math.sin(Date.now()*0.001 + i);
        ctx.fillStyle = `rgb(${brightness},${brightness+50},${brightness+100})`;
        ctx.fillRect(x,y,2,2);
    }

    // Dibujar jugador con efecto glow si invulnerable
    if(player.invulnerable>0 && player.invulnerable%8<4) {
        ctx.shadowBlur = 30;
        ctx.shadowColor = "#0ff";
    } else {
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#0f0";
    }
    ctx.drawImage(shipImgs[player.ship], player.x, player.y, player.w, player.h);
    ctx.shadowBlur = 0;

    // Enemigos con ligero "temblor" al moverse
    enemies.forEach(e=>{
        ctx.save();
        ctx.translate(e.x+e.w/2, e.y+e.h/2);
        ctx.rotate(Math.sin(Date.now()*0.01 + e.x)*0.05);
        ctx.drawImage(enemyImg, -e.w/2, -e.h/2, e.w, e.h);
        ctx.restore();
    });

    // Balas con gradiente
    bullets.forEach(b=>{
        let grad = ctx.createLinearGradient(b.x,b.y,b.x,b.y+b.h);
        grad.addColorStop(0,"#0ff");
        grad.addColorStop(1,"#0f8");
        ctx.fillStyle = grad;
        ctx.fillRect(b.x,b.y,b.w,b.h);
    });

    enemyBullets.forEach(b=>{
        let grad = ctx.createLinearGradient(b.x,b.y,b.x,b.y+b.h);
        grad.addColorStop(0,"#f0f");
        grad.addColorStop(1,"#80f");
        ctx.fillStyle = grad;
        ctx.fillRect(b.x,b.y,b.w,b.h);
    });

    bossBullets.forEach(b=>{
        ctx.fillStyle = b.color || "#ff0";
        ctx.fillRect(b.x,b.y,b.w,b.h);
    });

    // Boss + barra vida épica
    if(bossActive && currentBoss){
        ctx.drawImage(currentBoss.img, currentBoss.x, currentBoss.y, currentBoss.w, currentBoss.h);

        // Barra de vida con glow
        let ratio = currentBoss.life / currentBoss.maxLife;
        ctx.fillStyle = "rgba(255,0,0,0.4)";
        ctx.fillRect(50, 15, canvas.width-100, 20);
        let grad = ctx.createLinearGradient(50,0,canvas.width-50,0);
        grad.addColorStop(0,"#f00");
        grad.addColorStop(0.5,"#ff0");
        grad.addColorStop(1,"#0f0");
        ctx.fillStyle = grad;
        ctx.fillRect(50,15, (canvas.width-100)*ratio, 20);

        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 4;
        ctx.strokeRect(50,15,canvas.width-100,20);

        ctx.fillStyle = "#fff";
        ctx.font = "bold 20px Arial";
        ctx.fillText("BOSS", canvas.width/2-40, 60);
    }

    // Explosiones
    explosions.forEach(e=>{
        let alpha = e.life/20;
        ctx.globalAlpha = alpha;
        let grad = ctx.createRadialGradient(e.x,e.y,0,e.x,e.y,e.size*15);
        grad.addColorStop(0,"#ff0");
        grad.addColorStop(0.4,"#f80");
        grad.addColorStop(1,"#800");
        ctx.fillStyle = grad;
        ctx.fillRect(e.x-e.size*20, e.y-e.size*20, e.size*40, e.size*40);
    });
    ctx.globalAlpha = 1;

    // Partículas
    particles.forEach(p=>{
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life/50;
        ctx.fillRect(p.x,p.y,p.size,p.size);
    });
    ctx.globalAlpha = 1;

    // HUD con estilo neón
    ctx.fillStyle = "#0ff";
    ctx.font = "bold 22px Arial";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#0ff";
    ctx.fillText(`Nivel: ${level}`, 20, canvas.height-40);
    ctx.fillText(`Score: ${score}`, 170, canvas.height-40);
    ctx.fillText(`Vidas: ${lives}`, 350, canvas.height-40);
    ctx.shadowBlur = 0;

    if(doubleShot){
        ctx.fillStyle = "#ff0";
        ctx.fillText("DOUBLE SHOT!!", canvas.width/2-90, 80);
    }

    // Menú / Pausa
    if(paused || gameOver){
        ctx.fillStyle = "rgba(0,0,20,0.85)";
        ctx.fillRect(0,0,canvas.width,canvas.height);

        ctx.fillStyle = "#0ff";
        ctx.font = "bold 40px Arial";
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#0ff";
        ctx.fillText(gameOver ? "GAME OVER" : "PAUSA / TIENDA", 60, 100);

        ctx.font = "28px Arial";
        ctx.fillStyle = "#fff";
        ctx.fillText("Monedas: " + score, 160, 160);

        if(gameOver){
            ctx.fillStyle = "#f00";
            ctx.fillText("Pulsa F5 para reiniciar", 80, 400);
        } else {
            // Tienda mejorada
            let y = 220;
            const shipKeys = Object.keys(shipStats);
            shipKeys.forEach((ship,i)=>{
                let owned = ownedShips.includes(ship);
                ctx.fillStyle = owned ? "#0f0" : "#ccc";
                ctx.font = "24px Arial";
                ctx.fillText(`${ship.toUpperCase()} - ${shipStats[ship].price} monedas`, 80, y);

                ctx.fillStyle = selectedShip===ship ? "#0ff" : "#666";
                ctx.fillText(owned ? "→ ENTER para equipar" : "→ ENTER para comprar", 100, y+30);

                if(i===menuIndex){
                    ctx.strokeStyle = "#ff0";
                    ctx.lineWidth = 3;
                    ctx.strokeRect(70, y-30, 360, 70);
                }
                y+=100;
            });

            ctx.fillStyle = "#ff0";
            ctx.fillText(`Nave actual: ${selectedShip.toUpperCase()}`, 80, 520);
            ctx.fillText("P → Continuar", 80, 570);
        }
        ctx.shadowBlur = 0;
    }
}

// ---------- TIENDA ----------
let menuIndex = 0;
const shipKeys = Object.keys(shipStats);

window.addEventListener("keydown", e=>{
    if(!paused || gameOver) return;

    if(e.code==="ArrowUp") menuIndex = (menuIndex-1+shipKeys.length)%shipKeys.length;
    if(e.code==="ArrowDown") menuIndex = (menuIndex+1)%shipKeys.length;

    if(e.code==="Enter"){
        const ship = shipKeys[menuIndex];
        if(!ownedShips.includes(ship)){
            if(score >= shipStats[ship].price){
                score -= shipStats[ship].price;
                ownedShips.push(ship);
                localStorage.setItem("ownedShips", JSON.stringify(ownedShips));
                beep(1000,0.1);
            } else {
                beep(200,0.2);
            }
        } else {
            selectedShip = ship;
            localStorage.setItem("selectedShip", ship);
            player.updateShip();
            beep(1200,0.15);
        }
    }
});

// ---------- LOOP ----------
function loop(){
    update();
    draw();
    requestAnimationFrame(loop);
}

// INICIO
spawnEnemies();
paused = false; // empieza directo
loop();
