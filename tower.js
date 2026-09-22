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
  const heightValue = document.getElementById("heightValue");
  const comboValue = document.getElementById("comboValue");
  const bestValue = document.getElementById("bestValue");
  const statusText = document.getElementById("statusText");
  const hintText = document.getElementById("hintText");
  const accuracyText = document.getElementById("accuracyText");
  const speedText = document.getElementById("speedText");
  const perfectCallout = document.getElementById("perfectCallout");

  const dropButton = document.getElementById("dropButton");
  const pauseButton = document.getElementById("pauseButton");
  const soundButton = document.getElementById("soundButton");

  const W = canvas.width;
  const H = canvas.height;
  const SESSION_SECONDS = 90;
  const BLOCK_H = 30;
  const START_WIDTH = 300;
  const MIN_WIDTH = 18;
  const PERFECT_PX = 4;

  let state = "ready";
  let lastTime = performance.now();
  let sessionEnd = 0;
  let pausedAt = 0;
  let best = loadBest();
  let soundOn = false;
  let audioCtx = null;

  let blocks = [];
  let active = null;
  let scraps = [];
  let particles = [];
  let height = 0;
  let combo = 0;
  let maxCombo = 0;
  let cameraY = 0;
  let targetCameraY = 0;
  let lastAlign = null;
  let calloutTimer = 0;

  bestValue.textContent = String(best);

  function loadBest() {
    try {
      const v = Number(localStorage.getItem("rba-stack-tower-best"));
      return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
    } catch (_) { return 0; }
  }

  function saveBest(v) {
    best = Math.max(best, Math.floor(v));
    bestValue.textContent = String(best);
    try { localStorage.setItem("rba-stack-tower-best", String(best)); } catch (_) {}
  }

  function startGame() {
    blocks = [{
      x: W / 2 - START_WIDTH / 2,
      y: H - 75,
      width: START_WIDTH,
      height: BLOCK_H,
      level: 0
    }];
    scraps = [];
    particles = [];
    height = 0;
    combo = 0;
    maxCombo = 0;
    cameraY = 0;
    targetCameraY = 0;
    lastAlign = null;
    calloutTimer = 0;
    perfectCallout.hidden = true;
    sessionEnd = performance.now() + SESSION_SECONDS * 1000;
    pausedAt = 0;
    state = "playing";
    hideOverlay();
    spawnActive();
    updateHud();
    statusText.textContent = "タイミングを合わせて DROP";
    hintText.textContent = "中央に近いほど幅を失いません。";
  }

  function spawnActive() {
    const base = blocks[blocks.length - 1];
    const dir = (height % 2 === 0) ? 1 : -1;
    active = {
      x: dir > 0 ? -base.width : W,
      y: base.y - BLOCK_H,
      width: base.width,
      height: BLOCK_H,
      vx: dir * getSpeed(),
      level: height + 1
    };
    speedText.textContent = "Speed " + Math.round(Math.abs(active.vx)) + " px/s";
  }

  function getSpeed() {
    return Math.min(355, 150 + height * 8.5);
  }

  function drop() {
    if (state !== "playing" || !active) return;

    const base = blocks[blocks.length - 1];
    const activeLeft = active.x;
    const activeRight = active.x + active.width;
    const baseLeft = base.x;
    const baseRight = base.x + base.width;

    const overlapLeft = Math.max(activeLeft, baseLeft);
    const overlapRight = Math.min(activeRight, baseRight);
    const overlap = overlapRight - overlapLeft;

    if (overlap <= 0) {
      createScrap(active.x, active.y, active.width, active.vx * .25);
      active = null;
      finishGame(false);
      return;
    }

    const alignError = active.x - base.x;
    const perfect = Math.abs(alignError) <= PERFECT_PX;
    lastAlign = Math.abs(alignError);

    let newX = overlapLeft;
    let newWidth = overlap;

    if (perfect) {
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      const restore = Math.min(10, combo * 1.1);
      newWidth = Math.min(START_WIDTH, base.width + restore);
      newX = base.x + (base.width - newWidth) / 2;
      showPerfect();
      burst(base.x + base.width / 2, active.y + BLOCK_H / 2);
      beep(760 + Math.min(combo, 8) * 35, .055, .028);
    } else {
      combo = 0;
      const scrapWidth = active.width - overlap;
      if (scrapWidth > 1) {
        const scrapX = activeLeft < baseLeft ? activeLeft : overlapRight;
        createScrap(scrapX, active.y, scrapWidth, active.vx * .22);
      }
      beep(380, .035, .014);
    }

    blocks.push({
      x: newX,
      y: active.y,
      width: newWidth,
      height: BLOCK_H,
      level: active.level
    });

    height += 1;
    active = null;
    saveBest(height);

    if (newWidth < MIN_WIDTH) {
      statusText.textContent = "細すぎて崩れた…";
      finishGame(false);
      return;
    }

    const topScreenY = blocks[blocks.length - 1].y - cameraY;
    if (topScreenY < H * .34) {
      targetCameraY -= BLOCK_H;
    }

    updateHud();
    statusText.textContent = perfect ? "PERFECT! ×" + combo : "積めた。次へ";
    hintText.textContent = perfect
      ? "ピッタリ。少し幅が回復しました。"
      : "ズレ " + Math.round(lastAlign) + " px。切り落とされた分だけ細くなります。";

    spawnActive();
  }

  function createScrap(x, y, width, vx) {
    scraps.push({ x, y, width, height: BLOCK_H, vx, vy: 20, rot: 0, vr: vx * .0025 });
  }

  function burst(x, y) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 35 + Math.random() * 85;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 25,
        life: .55 + Math.random() * .35,
        r: 1.5 + Math.random() * 2.5
      });
    }
  }

  function showPerfect() {
    perfectCallout.textContent = combo > 1 ? "PERFECT ×" + combo : "PERFECT!";
    perfectCallout.hidden = false;
    calloutTimer = .62;
  }

  function update(dt, now) {
    const remain = sessionEnd ? Math.max(0, (sessionEnd - now) / 1000) : SESSION_SECONDS;
    timeValue.textContent = remain.toFixed(1);

    cameraY += (targetCameraY - cameraY) * Math.min(1, dt * 6);

    for (let i = scraps.length - 1; i >= 0; i--) {
      const s = scraps[i];
      s.vy += 720 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += s.vr;
      if (s.y - cameraY > H + 100) scraps.splice(i, 1);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.vy += 160 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    if (calloutTimer > 0) {
      calloutTimer -= dt;
      if (calloutTimer <= 0) perfectCallout.hidden = true;
    }

    if (state !== "playing") return;

    if (remain <= 0) {
      finishGame(true);
      return;
    }

    if (active) {
      active.x += active.vx * dt;
      if (active.vx > 0 && active.x > W + 6) active.x = -active.width;
      if (active.vx < 0 && active.x + active.width < -6) active.x = W;
    }
  }

  function finishGame(timeUp) {
    state = "ended";
    perfectCallout.hidden = true;
    if (active) {
      if (!timeUp) createScrap(active.x, active.y, active.width, active.vx * .2);
      active = null;
    }

    overlay.hidden = false;
    overlayKicker.textContent = timeUp ? "TIME UP" : "GAME OVER";
    overlayTitle.textContent = height + "段、積めました。";
    overlayText.textContent = timeUp
      ? "90秒終了。かなり高くなりました。"
      : (height < 5 ? "最初はゆっくり。中央をよく見ると合わせやすいです。" : "いいところまで来ました。もう一度なら、もっと高くいけそうです。");

    resultStats.hidden = false;
    resultStats.innerHTML =
      "<div><span>HEIGHT</span><strong>" + height + "</strong></div>" +
      "<div><span>MAX COMBO</span><strong>×" + maxCombo + "</strong></div>" +
      "<div><span>BEST</span><strong>" + best + "</strong></div>";

    primaryButton.textContent = "TRY AGAIN";
    secondaryButton.hidden = false;
    secondaryButton.textContent = "研究に戻る";
  }

  function endEarly() {
    state = "ended";
    sessionEnd = performance.now();
    active = null;
    overlay.hidden = false;
    overlayKicker.textContent = "BACK TO RESEARCH";
    overlayTitle.textContent = "休憩終了。";
    overlayText.textContent = "塔はここで静止しています。次の休憩でまたどうぞ。";
    resultStats.hidden = true;
    primaryButton.textContent = "また積む";
    secondaryButton.hidden = true;
    timeValue.textContent = "0.0";
  }

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      pausedAt = performance.now();
      pauseButton.textContent = "RESUME";
      pauseButton.setAttribute("aria-pressed", "true");
      overlay.hidden = false;
      overlayKicker.textContent = "PAUSED";
      overlayTitle.textContent = "一時停止";
      overlayText.textContent = "タイマーもブロックも止まっています。";
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
  }

  function hideOverlay() {
    overlay.hidden = true;
    resultStats.hidden = true;
    secondaryButton.hidden = true;
  }

  function updateHud() {
    heightValue.textContent = String(height);
    comboValue.textContent = "×" + combo;
    bestValue.textContent = String(best);
    accuracyText.textContent = lastAlign == null
      ? "—"
      : (lastAlign <= PERFECT_PX ? "PERFECT" : Math.round(lastAlign) + " px");
  }

  function blockColor(level) {
    const hue = (260 + level * 12) % 360;
    return "hsl(" + hue + " 48% " + (58 + Math.min(10, level * .25)) + "%)";
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawTower();
    drawScraps();
    drawParticles();
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#11172c");
    g.addColorStop(.62, "#18162b");
    g.addColorStop(1, "#0a0c16");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(234, 223, 255, .7)";
    for (let i = 0; i < 44; i++) {
      const x = (i * 193) % W;
      const y = (i * 83) % Math.floor(H * .53);
      const r = (i % 3 === 0) ? 1.1 : .6;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const groundY = H - 45 - cameraY;
    ctx.fillStyle = "#090b14";
    ctx.fillRect(0, groundY, W, H - groundY + 100);

    ctx.fillStyle = "rgba(255,255,255,.025)";
    for (let x = 18; x < W; x += 52) {
      const h = 35 + ((x * 17) % 90);
      ctx.fillRect(x, groundY - h, 34, h);
    }
  }

  function drawTower() {
    for (const b of blocks) drawBlock(b.x, b.y - cameraY, b.width, b.height, b.level, 1);

    if (active) {
      drawBlock(active.x, active.y - cameraY, active.width, active.height, active.level, .98);

      const base = blocks[blocks.length - 1];
      const guideY = active.y + BLOCK_H + 7 - cameraY;
      ctx.strokeStyle = "rgba(194, 182, 255, .16)";
      ctx.setLineDash([6, 7]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(base.x, guideY);
      ctx.lineTo(base.x + base.width, guideY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawBlock(x, y, width, height, level, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = blockColor(level);
    ctx.fillRect(x, y, width, height);

    ctx.fillStyle = "rgba(255,255,255,.12)";
    ctx.fillRect(x, y, width, 3);

    ctx.fillStyle = "rgba(0,0,0,.15)";
    ctx.fillRect(x, y + height - 4, width, 4);
    ctx.globalAlpha = 1;
  }

  function drawScraps() {
    for (const s of scraps) {
      ctx.save();
      ctx.translate(s.x + s.width / 2, s.y - cameraY + s.height / 2);
      ctx.rotate(s.rot);
      drawBlock(-s.width / 2, -s.height / 2, s.width, s.height, height + 1, .72);
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = "#c9fff5";
      ctx.beginPath();
      ctx.arc(p.x, p.y - cameraY, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
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

  dropButton.addEventListener("click", drop);
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    drop();
  });

  window.addEventListener("keydown", (e) => {
    if (e.repeat || e.code !== "Space") return;
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    e.preventDefault();
    drop();
  });

  window.addEventListener("blur", () => {
    if (state === "playing") togglePause();
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