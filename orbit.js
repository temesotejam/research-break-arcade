(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const overlay = document.getElementById("overlay");
  const overlayKicker = document.getElementById("overlayKicker");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const resultStats = document.getElementById("resultStats");
  const primaryButton = document.getElementById("primaryButton");
  const secondaryButton = document.getElementById("secondaryButton");

  const timeValue = document.getElementById("timeValue");
  const scoreValue = document.getElementById("scoreValue");
  const slingValue = document.getElementById("slingValue");
  const boostValue = document.getElementById("boostValue");
  const bestValue = document.getElementById("bestValue");
  const statusText = document.getElementById("statusText");
  const hintText = document.getElementById("hintText");
  const targetLabel = document.getElementById("targetLabel");
  const periapsisText = document.getElementById("periapsisText");
  const speedText = document.getElementById("speedText");
  const slingCallout = document.getElementById("slingCallout");

  const boostButton = document.getElementById("boostButton");
  const pauseButton = document.getElementById("pauseButton");
  const soundButton = document.getElementById("soundButton");

  const W = canvas.width;
  const H = canvas.height;
  const SESSION_SECONDS = 90;
  const BOOST_COST = 20;
  const BOOST_DV = 24;
  const BOOST_REWARD = 48;
  const PLANET_NAMES = ["Astra", "Nox", "Lyra", "Vela", "Mira", "Ceres", "Io", "Rhea", "Nova", "Eos"];
  const PLANET_COLORS = ["#8fb8ff", "#d5a4ff", "#f0b47d", "#8fe8cf", "#e58ca8", "#a8c97e"];

  const stars = makeStars(100);

  let state = "ready";
  let lastTime = performance.now();
  let sessionEnd = 0;
  let pausedAt = 0;
  let best = loadBest();
  let soundOn = false;
  let audioCtx = null;

  let ship = null;
  let target = null;
  let oldPlanets = [];
  let trail = [];
  let particles = [];
  let camera = { x: 0, y: 0 };
  let boost = 100;
  let boostCooldown = 0;
  let score = 0;
  let slings = 0;
  let streak = 0;
  let legMinDist = Infinity;
  let legTime = 0;
  let approached = false;
  let legStart = null;
  let recoveryTimer = 0;
  let prediction = null;
  let calloutTimer = 0;
  let pausedFrom = "playing";

  bestValue.textContent = best.toLocaleString("ja-JP");

  function loadBest() {
    try {
      const v = Number(localStorage.getItem("rba-orbit-sling-best"));
      return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
    } catch (_) { return 0; }
  }

  function saveBest(v) {
    best = Math.max(best, Math.floor(v));
    bestValue.textContent = best.toLocaleString("ja-JP");
    try { localStorage.setItem("rba-orbit-sling-best", String(best)); } catch (_) {}
  }

  function makeStars(count) {
    let seed = 17239;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    return Array.from({ length: count }, () => ({
      x: rnd() * W,
      y: rnd() * H,
      r: .45 + rnd() * 1.35,
      a: .22 + rnd() * .72
    }));
  }

  function randomBetween(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function startGame() {
    ship = { x: 0, y: 0, vx: 95, vy: 0 };
    camera.x = ship.x;
    camera.y = ship.y;
    boost = 100;
    score = 0;
    slings = 0;
    streak = 0;
    oldPlanets = [];
    trail = [];
    particles = [];
    recoveryTimer = 0;
    sessionEnd = performance.now() + SESSION_SECONDS * 1000;
    pausedAt = 0;
    state = pausedFrom === "recovering" ? "recovering" : "playing";
    hideOverlay();
    spawnTarget(true);
    updateHud();
  }

  function spawnTarget(first) {
    const speed = Math.max(70, Math.hypot(ship.vx, ship.vy));
    const dirX = ship.vx / speed;
    const dirY = ship.vy / speed;
    const perpX = -dirY;
    const perpY = dirX;

    const distance = randomBetween(first ? 275 : 255, first ? 295 : 285);
    const side = Math.random() < .5 ? -1 : 1;
    const offset = side * randomBetween(52, 66);
    const radius = randomBetween(24, 31);
    const mu = clamp(140000 * Math.pow(speed / 95, 2), 105000, 280000);

    target = {
      x: ship.x + dirX * distance + perpX * offset,
      y: ship.y + dirY * distance + perpY * offset,
      radius,
      mu,
      safeMin: radius + 13,
      safeMax: radius + 63,
      ideal: radius + 32,
      color: PLANET_COLORS[Math.floor(Math.random() * PLANET_COLORS.length)],
      name: PLANET_NAMES[Math.floor(Math.random() * PLANET_NAMES.length)]
    };

    legMinDist = Infinity;
    legTime = 0;
    approached = false;
    legStart = {
      x: ship.x,
      y: ship.y,
      vx: ship.vx,
      vy: ship.vy,
      boost: Math.max(boost, first ? 100 : 0)
    };

    targetLabel.textContent = "TARGET " + target.name;
    statusText.textContent = "軌道を確認";
    hintText.textContent = "白い予測線が緑の帯を通るようにBOOST。";
    updatePrediction();
  }

  function doBoost() {
    if (state !== "playing" || recoveryTimer > 0 || !ship || boostCooldown > 0) return;

    if (boost < BOOST_COST) {
      statusText.textContent = "BOOST EMPTY";
      hintText.textContent = "次のSLINGSHOT成功で燃料が回復します。";
      flashButtonEmpty();
      beep(120, .06, .02);
      return;
    }

    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed < 1) return;

    ship.vx += ship.vx / speed * BOOST_DV;
    ship.vy += ship.vy / speed * BOOST_DV;
    boost -= BOOST_COST;
    boostCooldown = .18;
    createBoostParticles();
    beep(410, .045, .025);
    updatePrediction();
    updateHud();
  }

  function flashButtonEmpty() {
    boostButton.classList.add("empty");
    setTimeout(() => boostButton.classList.remove("empty"), 260);
  }

  function createBoostParticles() {
    const speed = Math.hypot(ship.vx, ship.vy);
    const nx = ship.vx / speed;
    const ny = ship.vy / speed;
    for (let i = 0; i < 10; i++) {
      particles.push({
        x: ship.x - nx * 8,
        y: ship.y - ny * 8,
        vx: -nx * randomBetween(35, 75) + randomBetween(-18, 18),
        vy: -ny * randomBetween(35, 75) + randomBetween(-18, 18),
        life: randomBetween(.25, .55),
        r: randomBetween(1.2, 2.8)
      });
    }
  }

  function gravityFor(x, y, vx, vy, dt, planet) {
    const dx = planet.x - x;
    const dy = planet.y - y;
    const r = Math.max(planet.radius + 2, Math.hypot(dx, dy));
    const a = planet.mu / (r * r);
    return {
      vx: vx + a * dx / r * dt,
      vy: vy + a * dy / r * dt,
      r
    };
  }

  function update(dt, now) {
    const remain = sessionEnd ? Math.max(0, (sessionEnd - now) / 1000) : SESSION_SECONDS;
    timeValue.textContent = remain.toFixed(1);

    boostCooldown = Math.max(0, boostCooldown - dt);
    updateParticles(dt);
    updateCallout(dt);

    if (!ship) return;

    camera.x += (ship.x - camera.x) * Math.min(1, dt * 5);
    camera.y += (ship.y - camera.y) * Math.min(1, dt * 5);

    if (state === "recovering") {
      recoveryTimer -= dt;
      if (recoveryTimer <= 0) restoreLeg();
      return;
    }

    if (state !== "playing") return;

    if (remain <= 0) {
      finishGame();
      return;
    }

    legTime += dt;

    const g = gravityFor(ship.x, ship.y, ship.vx, ship.vy, dt, target);
    ship.vx = g.vx;
    ship.vy = g.vy;
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;

    trail.push({ x: ship.x, y: ship.y, life: 1 });
    if (trail.length > 130) trail.shift();

    const dx = ship.x - target.x;
    const dy = ship.y - target.y;
    const d = Math.hypot(dx, dy);
    legMinDist = Math.min(legMinDist, d);
    if (d < target.safeMax + 42) approached = true;

    const radialVelocity = (dx * ship.vx + dy * ship.vy) / Math.max(1, d);

    if (d <= target.radius + 2) {
      failLeg("COLLISION");
      return;
    }

    if (approached && radialVelocity > 0 && d > legMinDist + 9) {
      resolvePass();
      return;
    }

    if (legTime > 6.1 || (radialVelocity > 0 && d > 215 && legMinDist > target.safeMax)) {
      failLeg("MISSED");
      return;
    }

    if (Math.floor(legTime * 10) % 2 === 0) updatePrediction();
    updateHud();
  }

  function resolvePass() {
    const minD = legMinDist;

    if (minD < target.safeMin) {
      failLeg("TOO CLOSE");
      return;
    }
    if (minD > target.safeMax) {
      failLeg("TOO WIDE");
      return;
    }

    const err = Math.abs(minD - target.ideal);
    const span = Math.max(1, target.safeMax - target.safeMin);
    const quality = clamp(1 - err / (span * .58), 0, 1);
    const perfect = err <= 5.5;

    if (perfect) streak += 1;
    else streak = 0;

    const gain = Math.round(350 + quality * 650 + streak * 90);
    score += gain;
    slings += 1;
    boost = Math.min(100, boost + BOOST_REWARD);

    const exitSpeed = Math.hypot(ship.vx, ship.vy);
    const settledSpeed = clamp(exitSpeed * .86, 92, 120);
    ship.vx = ship.vx / exitSpeed * settledSpeed;
    ship.vy = ship.vy / exitSpeed * settledSpeed;

    saveBest(score);

    oldPlanets.push({ ...target, life: 1 });
    if (oldPlanets.length > 9) oldPlanets.shift();

    showCallout(perfect ? "PERFECT SLING ×" + Math.max(1, streak) : "SLINGSHOT +" + gain);
    statusText.textContent = perfect ? "PERFECT ORBIT" : "SLINGSHOT";
    hintText.textContent = "次の惑星を捕捉。燃料 +" + BOOST_REWARD + "%";
    beep(perfect ? 920 : 730, .07, .035);

    spawnTarget(false);
    updateHud();
  }

  function failLeg(reason) {
    if (state !== "playing") return;
    state = "recovering";
    recoveryTimer = .72;
    streak = 0;
    score = Math.max(0, score - 150);
    boost = Math.max(boost, 44);
    showCallout(reason + " · -150");
    statusText.textContent = reason;
    hintText.textContent = "同じ惑星の手前へ復帰します。予測線を見て再挑戦。";
    beep(135, .11, .03);
    updateHud();
  }

  function restoreLeg() {
    ship.x = legStart.x;
    ship.y = legStart.y;
    ship.vx = legStart.vx;
    ship.vy = legStart.vy;
    boost = Math.max(boost, Math.min(100, legStart.boost));
    camera.x = ship.x;
    camera.y = ship.y;
    trail = [];
    legMinDist = Infinity;
    legTime = 0;
    approached = false;
    state = "playing";
    statusText.textContent = "再アプローチ";
    hintText.textContent = "今度は予測線を緑の帯へ。";
    updatePrediction();
  }

  function updatePrediction() {
    if (!ship || !target) return;

    let x = ship.x;
    let y = ship.y;
    let vx = ship.vx;
    let vy = ship.vy;
    let minD = Infinity;
    const points = [];
    const dt = .065;

    for (let i = 0; i < 64; i++) {
      const g = gravityFor(x, y, vx, vy, dt, target);
      vx = g.vx;
      vy = g.vy;
      x += vx * dt;
      y += vy * dt;
      const d = Math.hypot(x - target.x, y - target.y);
      minD = Math.min(minD, d);
      points.push({ x, y });
      if (d <= target.radius + 1) break;
      if (i > 22 && d > 245) break;
    }

    let verdict = "WIDE";
    if (minD <= target.radius + 2) verdict = "COLLISION";
    else if (minD < target.safeMin) verdict = "TOO CLOSE";
    else if (minD <= target.safeMax) verdict = "SLINGSHOT";

    prediction = { points, minD, verdict };

    statusText.classList.remove("status-good", "status-warn", "status-bad");
    if (verdict === "SLINGSHOT") {
      statusText.textContent = "SLINGSHOT LINE";
      statusText.classList.add("status-good");
      hintText.textContent = "このままなら緑の帯を通ります。";
    } else if (verdict === "TOO CLOSE" || verdict === "COLLISION") {
      statusText.textContent = verdict === "COLLISION" ? "COLLISION COURSE" : "TOO CLOSE";
      statusText.classList.add("status-bad");
      hintText.textContent = "BOOSTで速度を上げ、重力による曲がりを弱める。";
    } else {
      statusText.textContent = "TOO WIDE";
      statusText.classList.add("status-warn");
      hintText.textContent = "BOOSTせず、惑星の重力にもう少し任せる。";
    }

    periapsisText.textContent = "Closest " + minD.toFixed(0) + " px";
  }

  function updateHud() {
    scoreValue.textContent = Math.floor(score).toLocaleString("ja-JP");
    slingValue.textContent = String(slings);
    boostValue.textContent = Math.round(boost);
    bestValue.textContent = best.toLocaleString("ja-JP");
    boostButton.classList.toggle("empty", boost < BOOST_COST);
    if (ship) speedText.textContent = "Speed " + Math.hypot(ship.vx, ship.vy).toFixed(0) + " px/s";
  }

  function showCallout(text) {
    slingCallout.textContent = text;
    slingCallout.hidden = false;
    calloutTimer = .76;
  }

  function updateCallout(dt) {
    if (calloutTimer <= 0) return;
    calloutTimer -= dt;
    if (calloutTimer <= 0) slingCallout.hidden = true;
  }

  function updateParticles(dt) {
    for (let i = trail.length - 1; i >= 0; i--) {
      trail[i].life -= dt * .24;
      if (trail[i].life <= 0) trail.splice(i, 1);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (const p of oldPlanets) p.life = Math.max(.22, p.life - dt * .035);
  }

  function finishGame() {
    state = "ended";
    const finalScore = Math.floor(score);
    saveBest(finalScore);
    timeValue.textContent = "0.0";
    slingCallout.hidden = true;

    overlay.hidden = false;
    overlayKicker.textContent = "BREAK COMPLETE";
    overlayTitle.textContent = slings + "回、重力を渡りました。";
    overlayText.textContent = "Score " + finalScore.toLocaleString("ja-JP") + "。90秒で航行終了です。";
    resultStats.hidden = false;
    resultStats.innerHTML =
      "<div><span>SCORE</span><strong>" + finalScore.toLocaleString("ja-JP") + "</strong></div>" +
      "<div><span>SLINGS</span><strong>" + slings + "</strong></div>" +
      "<div><span>BEST</span><strong>" + best.toLocaleString("ja-JP") + "</strong></div>";
    primaryButton.textContent = "FLY AGAIN";
    secondaryButton.hidden = false;
    secondaryButton.textContent = "研究に戻る";
  }

  function endEarly() {
    state = "ended";
    sessionEnd = performance.now();
    overlay.hidden = false;
    overlayKicker.textContent = "BACK TO RESEARCH";
    overlayTitle.textContent = "航行終了。";
    overlayText.textContent = "衛星はここで静止しています。次の休憩でまたどうぞ。";
    resultStats.hidden = true;
    primaryButton.textContent = "また飛ぶ";
    secondaryButton.hidden = true;
    timeValue.textContent = "0.0";
  }

  function togglePause() {
    if (state === "playing" || state === "recovering") {
      pausedFrom = state;
      state = "paused";
      pausedAt = performance.now();
      pauseButton.textContent = "RESUME";
      pauseButton.setAttribute("aria-pressed", "true");
      overlay.hidden = false;
      overlayKicker.textContent = "PAUSED";
      overlayTitle.textContent = "一時停止";
      overlayText.textContent = "タイマーも軌道計算も止まっています。";
      resultStats.hidden = true;
      primaryButton.textContent = "RESUME";
      secondaryButton.hidden = false;
      secondaryButton.textContent = "研究に戻る";
    } else if (state === "paused") {
      resumePause();
    }
  }

  function resumePause() {
    const now = performance.now();
    if (pausedAt && sessionEnd) sessionEnd += now - pausedAt;
    pausedAt = 0;
    state = "playing";
    hideOverlay();
    pauseButton.textContent = "PAUSE";
    pauseButton.setAttribute("aria-pressed", "false");
    updatePrediction();
  }

  function hideOverlay() {
    overlay.hidden = true;
    resultStats.hidden = true;
    secondaryButton.hidden = true;
  }

  function worldToScreen(x, y) {
    return {
      x: x - camera.x + W / 2,
      y: y - camera.y + H / 2
    };
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawSpace();
    drawOldPlanets();
    drawPrediction();
    drawTarget();
    drawTrail();
    drawParticles();
    if (ship) drawShip();
  }

  function drawSpace() {
    const g = ctx.createRadialGradient(W * .55, H * .45, 20, W * .5, H * .5, 650);
    g.addColorStop(0, "#101938");
    g.addColorStop(1, "#02040d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (const s of stars) {
      ctx.globalAlpha = s.a;
      ctx.fillStyle = "#dce6ff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawOldPlanets() {
    for (const p of oldPlanets) {
      const s = worldToScreen(p.x, p.y);
      if (s.x < -80 || s.x > W + 80 || s.y < -80 || s.y > H + 80) continue;
      ctx.globalAlpha = p.life * .45;
      drawPlanetBody(s.x, s.y, p.radius * .8, p.color, false);
    }
    ctx.globalAlpha = 1;
  }

  function drawTarget() {
    if (!target) return;
    const s = worldToScreen(target.x, target.y);

    ctx.globalAlpha = .22;
    ctx.strokeStyle = "#8fe8cf";
    ctx.lineWidth = Math.max(2, target.safeMax - target.safeMin);
    ctx.beginPath();
    ctx.arc(s.x, s.y, (target.safeMin + target.safeMax) / 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = .55;
    ctx.strokeStyle = "#dffcf4";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 7]);
    ctx.beginPath();
    ctx.arc(s.x, s.y, target.ideal, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    drawPlanetBody(s.x, s.y, target.radius, target.color, true);

    ctx.fillStyle = "rgba(228,236,255,.78)";
    ctx.font = "800 11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(target.name, s.x, s.y + target.radius + 22);
  }

  function drawPlanetBody(x, y, radius, color, targetPlanet) {
    const g = ctx.createRadialGradient(x - radius * .32, y - radius * .38, radius * .12, x, y, radius);
    g.addColorStop(0, "#f4f5ff");
    g.addColorStop(.18, color);
    g.addColorStop(1, "#111529");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    if (targetPlanet) {
      ctx.strokeStyle = "rgba(255,255,255,.18)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawPrediction() {
    if (!prediction || !prediction.points.length) return;

    ctx.strokeStyle = prediction.verdict === "SLINGSHOT"
      ? "rgba(190,255,237,.72)"
      : prediction.verdict === "WIDE"
        ? "rgba(255,210,127,.56)"
        : "rgba(255,141,154,.62)";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 8]);
    ctx.beginPath();
    prediction.points.forEach((p, i) => {
      const s = worldToScreen(p.x, p.y);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawTrail() {
    if (trail.length < 2) return;
    ctx.lineWidth = 1.4;
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1];
      const b = trail[i];
      const sa = worldToScreen(a.x, a.y);
      const sb = worldToScreen(b.x, b.y);
      ctx.globalAlpha = Math.min(a.life, b.life) * .36;
      ctx.strokeStyle = "#a9caff";
      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      ctx.lineTo(sb.x, sb.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawParticles() {
    for (const p of particles) {
      const s = worldToScreen(p.x, p.y);
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = "#9fc4ff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawShip() {
    const s = worldToScreen(ship.x, ship.y);
    const angle = Math.atan2(ship.vy, ship.vx);

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(angle);

    ctx.fillStyle = "#eff5ff";
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, -7);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, 7);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#9fc4ff";
    ctx.fillRect(-8, -2, 6, 4);
    ctx.restore();
  }

  function ensureAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  }

  function beep(freq, duration, volume) {
    if (!soundOn) return;
    ensureAudio();
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + duration);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  boostButton.addEventListener("click", doBoost);
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    doBoost();
  });

  window.addEventListener("keydown", (e) => {
    if (e.repeat || e.code !== "Space") return;
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    e.preventDefault();
    doBoost();
  });

  window.addEventListener("blur", () => {
    if (state === "playing" || state === "recovering") togglePause();
  });

  primaryButton.addEventListener("click", () => {
    if (state === "ready" || state === "ended") startGame();
    else if (state === "paused") resumePause();
  });

  secondaryButton.addEventListener("click", endEarly);
  pauseButton.addEventListener("click", togglePause);

  soundButton.addEventListener("click", () => {
    soundOn = !soundOn;
    soundButton.textContent = soundOn ? "SOUND ON" : "SOUND OFF";
    soundButton.setAttribute("aria-pressed", soundOn ? "true" : "false");
    if (soundOn) {
      ensureAudio();
      beep(620, .06, .03);
    }
  });

  function frame(now) {
    const dt = Math.max(0, Math.min(.035, (now - lastTime) / 1000));
    lastTime = now;
    update(dt, now);
    draw();
    requestAnimationFrame(frame);
  }

  draw();
  requestAnimationFrame(frame);
})();