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
  const lapValue = document.getElementById("lapValue");
  const bestValue = document.getElementById("bestValue");
  const statusText = document.getElementById("statusText");
  const hintText = document.getElementById("hintText");
  const flowText = document.getElementById("flowText");
  const flowFill = document.getElementById("flowFill");
  const roadText = document.getElementById("roadText");
  const checkpointCallout = document.getElementById("checkpointCallout");

  const driftButton = document.getElementById("driftButton");
  const pauseButton = document.getElementById("pauseButton");
  const soundButton = document.getElementById("soundButton");

  const W = canvas.width;
  const H = canvas.height;
  const CX = W / 2;
  const CY = H / 2;
  const TRACK_R = 190;
  const TRACK_HALF = 56;
  const INNER_R = TRACK_R - TRACK_HALF;
  const OUTER_R = TRACK_R + TRACK_HALF;
  const SESSION_SECONDS = 90;

  const checkpoints = [
    { x: CX + TRACK_R, y: CY, label: "CHECK 1" },
    { x: CX, y: CY - TRACK_R, label: "CHECK 2" },
    { x: CX - TRACK_R, y: CY, label: "CHECK 3" },
    { x: CX, y: CY + TRACK_R, label: "LAP" }
  ];

  let state = "ready";
  let lastTime = performance.now();
  let sessionEnd = 0;
  let pausedAt = 0;
  let best = loadBest();
  let soundOn = false;
  let audioCtx = null;

  let car = null;
  let holding = false;
  let steer = 0;
  let score = 0;
  let lap = 0;
  let checkpointIndex = 0;
  let flow = 0;
  let offroadTime = 0;
  let tireMarks = [];
  let particles = [];
  let calloutTimer = 0;
  let lastOnRoad = true;

  bestValue.textContent = String(best);

  function loadBest() {
    try {
      const v = Number(localStorage.getItem("rba-one-button-drift-best"));
      return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
    } catch (_) { return 0; }
  }

  function saveBest(v) {
    best = Math.max(best, Math.floor(v));
    bestValue.textContent = String(best);
    try { localStorage.setItem("rba-one-button-drift-best", String(best)); } catch (_) {}
  }

  function startGame() {
    car = {
      x: CX,
      y: CY + TRACK_R,
      angle: 0,
      speed: 165,
      prevX: CX,
      prevY: CY + TRACK_R
    };
    holding = false;
    steer = 0;
    score = 0;
    lap = 0;
    checkpointIndex = 0;
    flow = 0;
    offroadTime = 0;
    tireMarks = [];
    particles = [];
    calloutTimer = 0;
    lastOnRoad = true;
    sessionEnd = performance.now() + SESSION_SECONDS * 1000;
    pausedAt = 0;
    state = "playing";
    hideOverlay();
    updateHud();
    statusText.textContent = "GO!";
    hintText.textContent = "押して曲がる、離して外へ膨らませる。";
  }

  function setHolding(v) {
    if (state !== "playing" && v) return;
    holding = v;
    driftButton.classList.toggle("active", v);
  }

  function update(dt, now) {
    const remain = sessionEnd ? Math.max(0, (sessionEnd - now) / 1000) : SESSION_SECONDS;
    timeValue.textContent = remain.toFixed(1);

    updateParticles(dt);
    updateCallout(dt);

    if (state !== "playing" || !car) return;

    if (remain <= 0) {
      finishGame();
      return;
    }

    const dx = car.x - CX;
    const dy = car.y - CY;
    const radius = Math.hypot(dx, dy);
    const onRoad = radius >= INNER_R && radius <= OUTER_R;
    const centerError = Math.abs(radius - TRACK_R);

    steer += ((holding ? 1 : 0) - steer) * Math.min(1, dt * 6.5);

    const targetSpeed = onRoad ? Math.min(208, 176 + lap * 6) : 104;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * (onRoad ? 2.4 : 5));

    const turnRate = 1.42 * steer * (car.speed / 176);
    car.angle -= turnRate * dt;

    car.prevX = car.x;
    car.prevY = car.y;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;

    const newRadius = Math.hypot(car.x - CX, car.y - CY);
    const newOnRoad = newRadius >= INNER_R && newRadius <= OUTER_R;
    const newCenterError = Math.abs(newRadius - TRACK_R);

    if (newOnRoad) {
      offroadTime = Math.max(0, offroadTime - dt * 2.6);

      const quality = 1 - Math.min(1, newCenterError / TRACK_HALF);
      if (quality > .48) {
        flow += dt * (.22 + quality * .22);
      } else {
        flow -= dt * .22;
      }

      if (steer > .18 && car.speed > 145) {
        addTireMark();
      }

      score += dt * (10 + 18 * quality) * (1 + Math.min(2, flow) * .48);
    } else {
      offroadTime += dt;
      flow -= dt * .75;
      if (Math.random() < dt * 12) addDust();
    }

    flow = clamp(flow, 0, 2);

    if (lastOnRoad !== newOnRoad) {
      statusText.textContent = newOnRoad ? "路面に復帰" : "コースアウト";
      hintText.textContent = newOnRoad ? "中央へ戻すとFLOWが回復します。" : "自動で減速。コースへ戻してください。";
    }
    lastOnRoad = newOnRoad;

    if (newOnRoad) checkCheckpoint();

    if (offroadTime > 1.65 || newRadius < 72 || newRadius > 350) {
      respawn();
    }

    updateHud();
  }

  function checkCheckpoint() {
    const cp = checkpoints[checkpointIndex];
    const d = Math.hypot(car.x - cp.x, car.y - cp.y);
    if (d > 54) return;

    checkpointIndex += 1;
    score += Math.round(180 * (1 + flow * .4));
    showCallout(cp.label);
    beep(570 + checkpointIndex * 55, .04, .018);

    if (checkpointIndex >= checkpoints.length) {
      checkpointIndex = 0;
      lap += 1;
      score += 700 + lap * 80;
      flow = Math.min(2, flow + .28);
      statusText.textContent = "LAP " + lap + " COMPLETE";
      hintText.textContent = "少し速度が上がりました。";
      showCallout("LAP " + lap + "!");
      beep(900, .08, .032);
    }
  }

  function respawn() {
    const lastCheckpoint = checkpoints[(checkpointIndex + checkpoints.length - 1) % checkpoints.length];
    car.x = lastCheckpoint.x;
    car.y = lastCheckpoint.y;
    const theta = Math.atan2(car.y - CY, car.x - CX);
    car.angle = theta - Math.PI / 2;
    car.speed = 130;
    steer = 0;
    holding = false;
    driftButton.classList.remove("active");
    offroadTime = 0;
    flow = Math.max(0, flow - .5);
    score = Math.max(0, score - 120);
    statusText.textContent = "AUTO RESET";
    hintText.textContent = "大きく外れたのでコース中央へ復帰しました。";
    showCallout("-120");
    beep(145, .08, .025);
  }

  function addTireMark() {
    tireMarks.push({
      x1: car.prevX,
      y1: car.prevY,
      x2: car.x,
      y2: car.y,
      life: 1
    });
    if (tireMarks.length > 180) tireMarks.shift();
  }

  function addDust() {
    const a = Math.random() * Math.PI * 2;
    particles.push({
      x: car.x,
      y: car.y,
      vx: Math.cos(a) * (12 + Math.random() * 20),
      vy: Math.sin(a) * (12 + Math.random() * 20),
      life: .35 + Math.random() * .3,
      r: 2 + Math.random() * 3
    });
  }

  function updateParticles(dt) {
    for (let i = tireMarks.length - 1; i >= 0; i--) {
      tireMarks[i].life -= dt * .16;
      if (tireMarks[i].life <= 0) tireMarks.splice(i, 1);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function showCallout(text) {
    checkpointCallout.textContent = text;
    checkpointCallout.hidden = false;
    calloutTimer = .7;
  }

  function updateCallout(dt) {
    if (calloutTimer <= 0) return;
    calloutTimer -= dt;
    if (calloutTimer <= 0) checkpointCallout.hidden = true;
  }

  function finishGame() {
    state = "ended";
    setHolding(false);
    const finalScore = Math.floor(score);
    saveBest(finalScore);
    timeValue.textContent = "0.0";
    checkpointCallout.hidden = true;

    overlay.hidden = false;
    overlayKicker.textContent = "BREAK COMPLETE";
    overlayTitle.textContent = lap + "周、走りました。";
    overlayText.textContent = "Score " + finalScore.toLocaleString("ja-JP") + "。90秒で終了です。";
    resultStats.hidden = false;
    resultStats.innerHTML =
      "<div><span>SCORE</span><strong>" + finalScore.toLocaleString("ja-JP") + "</strong></div>" +
      "<div><span>LAP</span><strong>" + lap + "</strong></div>" +
      "<div><span>BEST</span><strong>" + best.toLocaleString("ja-JP") + "</strong></div>";
    primaryButton.textContent = "DRIVE AGAIN";
    secondaryButton.hidden = false;
    secondaryButton.textContent = "研究に戻る";
  }

  function endEarly() {
    state = "ended";
    setHolding(false);
    sessionEnd = performance.now();
    overlay.hidden = false;
    overlayKicker.textContent = "BACK TO RESEARCH";
    overlayTitle.textContent = "休憩終了。";
    overlayText.textContent = "車はここで停車しています。次の休憩でまたどうぞ。";
    resultStats.hidden = true;
    primaryButton.textContent = "また走る";
    secondaryButton.hidden = true;
    timeValue.textContent = "0.0";
  }

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      pausedAt = performance.now();
      setHolding(false);
      pauseButton.textContent = "RESUME";
      pauseButton.setAttribute("aria-pressed", "true");
      overlay.hidden = false;
      overlayKicker.textContent = "PAUSED";
      overlayTitle.textContent = "一時停止";
      overlayText.textContent = "タイマーも車も止まっています。";
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
    const finalScore = Math.floor(score);
    scoreValue.textContent = finalScore.toLocaleString("ja-JP");
    lapValue.textContent = String(lap);
    bestValue.textContent = String(best);

    const multiplier = 1 + flow * .5;
    flowText.textContent = "×" + multiplier.toFixed(2);
    flowFill.style.width = Math.round((flow / 2) * 100) + "%";

    if (car) {
      const r = Math.hypot(car.x - CX, car.y - CY);
      const onRoad = r >= INNER_R && r <= OUTER_R;
      const error = Math.abs(r - TRACK_R);
      if (!onRoad) roadText.textContent = "OFF ROAD";
      else if (error < 15) roadText.textContent = "CENTER LINE";
      else roadText.textContent = error < 35 ? "GOOD LINE" : "EDGE";
    }
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawGround();
    drawTrack();
    drawMarks();
    drawCheckpoints();
    drawParticles();
    if (car) drawCar();
  }

  function drawGround() {
    const g = ctx.createRadialGradient(CX, CY, 40, CX, CY, 520);
    g.addColorStop(0, "#172019");
    g.addColorStop(1, "#0b100d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,.025)";
    for (let i = 0; i < 90; i++) {
      const x = (i * 137) % W;
      const y = (i * 83) % H;
      ctx.fillRect(x, y, 2, 2);
    }

    ctx.fillStyle = "#0a1518";
    ctx.beginPath();
    ctx.arc(CX, CY, INNER_R - 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(86, 139, 153, .10)";
    ctx.beginPath();
    ctx.arc(CX, CY, INNER_R - 42, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTrack() {
    ctx.strokeStyle = "#353a3b";
    ctx.lineWidth = TRACK_HALF * 2;
    ctx.beginPath();
    ctx.arc(CX, CY, TRACK_R, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(235, 239, 229, .14)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CX, CY, INNER_R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(CX, CY, OUTER_R, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(235, 239, 229, .20)";
    ctx.lineWidth = 2;
    ctx.setLineDash([16, 18]);
    ctx.beginPath();
    ctx.arc(CX, CY, TRACK_R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    drawStartLine();
  }

  function drawStartLine() {
    const y = CY + TRACK_R;
    const tile = 8;
    for (let i = -6; i < 7; i++) {
      for (let j = 0; j < 4; j++) {
        ctx.fillStyle = ((i + j) & 1) ? "#e8ece9" : "#202526";
        ctx.fillRect(CX + i * tile, y - 16 + j * tile, tile, tile);
      }
    }
  }

  function drawMarks() {
    ctx.lineWidth = 2;
    for (const m of tireMarks) {
      ctx.globalAlpha = Math.max(0, m.life) * .35;
      ctx.strokeStyle = "#060707";
      ctx.beginPath();
      ctx.moveTo(m.x1, m.y1);
      ctx.lineTo(m.x2, m.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawCheckpoints() {
    checkpoints.forEach((cp, i) => {
      ctx.globalAlpha = i === checkpointIndex ? .78 : .20;
      ctx.fillStyle = i === checkpointIndex ? "#b9f27c" : "#eef5ec";
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, i === checkpointIndex ? 7 : 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = "#a78f6a";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawCar() {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    const slip = steer * .16;
    ctx.rotate(slip);

    ctx.fillStyle = "#b9f27c";
    ctx.fillRect(-13, -7, 26, 14);

    ctx.fillStyle = "#192123";
    ctx.fillRect(-5, -5, 10, 10);

    ctx.fillStyle = "#f0f6e9";
    ctx.fillRect(7, -5, 4, 3);
    ctx.fillRect(7, 2, 4, 3);

    ctx.fillStyle = "#080a0a";
    ctx.fillRect(-9, -9, 6, 3);
    ctx.fillRect(5, -9, 6, 3);
    ctx.fillRect(-9, 6, 6, 3);
    ctx.fillRect(5, 6, 6, 3);

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

  driftButton.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    try { driftButton.setPointerCapture(e.pointerId); } catch (_) {}
    setHolding(true);
  });
  driftButton.addEventListener("pointerup", () => setHolding(false));
  driftButton.addEventListener("pointercancel", () => setHolding(false));
  driftButton.addEventListener("lostpointercapture", () => setHolding(false));

  window.addEventListener("keydown", (e) => {
    if (e.repeat || e.code !== "Space") return;
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    e.preventDefault();
    setHolding(true);
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      setHolding(false);
    }
  });

  window.addEventListener("blur", () => {
    if (state === "playing") togglePause();
    else setHolding(false);
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