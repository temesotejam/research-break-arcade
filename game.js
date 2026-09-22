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
  const bestScoreValue = document.getElementById("bestScoreValue");
  const pauseButton = document.getElementById("pauseButton");
  const soundButton = document.getElementById("soundButton");
  const missionText = document.getElementById("missionText");
  const environmentText = document.getElementById("environmentText");
  const padRule = document.getElementById("padRule");
  const vsRule = document.getElementById("vsRule");
  const hsRule = document.getElementById("hsRule");

  const timeValue = document.getElementById("timeValue");
  const fuelValue = document.getElementById("fuelValue");
  const altValue = document.getElementById("altValue");
  const vsValue = document.getElementById("vsValue");
  const hsValue = document.getElementById("hsValue");
  const windValue = document.getElementById("windValue");

  const leftButton = document.getElementById("leftButton");
  const thrustButton = document.getElementById("thrustButton");
  const rightButton = document.getElementById("rightButton");

  const W = canvas.width;
  const H = canvas.height;
  const PX_PER_M = 12;
  const SESSION_SECONDS = 90;
  const LANDER_HALF_W = 14;
  const LANDER_HALF_H = 18;
  const MAX_VS = 2.25;
  const MAX_HS = 1.35;
  const keys = { left: false, right: false, thrust: false };
  const stars = makeStars(90);

  let state = "ready";
  let lastTime = performance.now();
  let sessionEnd = 0;
  let runStart = 0;
  let pausedAt = 0;
  let bestScore = loadBest();
  let soundOn = false;
  let audioCtx = null;

  let pad = { x: 500, width: 150, y: 520 };
  let terrain = [];
  let env = { gravity: 1.62, wind: 0 };
  let lander = makeLander();

  bestScoreValue.textContent = bestScore.toLocaleString("ja-JP");

  function loadBest() {
    try {
      const value = Number(localStorage.getItem("rba-tiny-lander-best"));
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    } catch (_) {
      return 0;
    }
  }

  function saveBest(value) {
    bestScore = Math.max(bestScore, Math.floor(value));
    bestScoreValue.textContent = bestScore.toLocaleString("ja-JP");
    try { localStorage.setItem("rba-tiny-lander-best", String(bestScore)); } catch (_) {}
  }

  function makeStars(count) {
    let seed = 43117;
    const next = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    return Array.from({ length: count }, () => ({
      x: next() * W,
      y: next() * 390,
      r: 0.5 + next() * 1.4,
      a: 0.3 + next() * 0.7
    }));
  }

  function makeLander() {
    return { x: W * 0.5, y: 88, vx: 0, vy: 0, fuel: 100, alive: true };
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function generateRound() {
    pad.width = Math.round(randomBetween(125, 165));
    pad.x = Math.round(randomBetween(115 + pad.width / 2, W - 115 - pad.width / 2));
    pad.y = Math.round(randomBetween(505, 532));

    terrain = [];
    const step = 48;
    for (let x = 0; x <= W + step; x += step) {
      const wave = Math.sin(x * 0.018) * 14 + Math.sin(x * 0.006 + 1.8) * 17;
      terrain.push({ x, y: 525 + wave + randomBetween(-10, 10) });
    }

    env.gravity = randomBetween(1.42, 1.90);
    env.wind = randomBetween(-0.32, 0.32);
    if (Math.abs(env.wind) < 0.07) env.wind = Math.sign(env.wind || 1) * 0.07;

    lander = makeLander();
    lander.x = Math.max(100, Math.min(W - 100, pad.x + randomBetween(-300, 300)));
    if (Math.abs(lander.x - pad.x) < 80) {
      lander.x += lander.x < W / 2 ? -150 : 150;
      lander.x = Math.max(100, Math.min(W - 100, lander.x));
    }
    lander.vx = randomBetween(-5, 5);
    lander.vy = randomBetween(0, 5);

    environmentText.textContent =
      "Gravity " + env.gravity.toFixed(2) + " m/s² / Wind " +
      (env.wind >= 0 ? "+" : "") + env.wind.toFixed(2) + " m/s²";
    windValue.textContent = (env.wind >= 0 ? "+" : "") + env.wind.toFixed(2);
    missionText.textContent = "3条件をすべて満たして接地すると SUCCESS。";
  }

  function startSession() {
    sessionEnd = performance.now() + SESSION_SECONDS * 1000;
    startRound();
  }

  function startRound() {
    if (!sessionEnd || sessionEnd <= performance.now()) {
      sessionEnd = performance.now() + SESSION_SECONDS * 1000;
    }
    generateRound();
    runStart = performance.now();
    state = "playing";
    pausedAt = 0;
    hideOverlay();
    clearInputs();
    pauseButton.textContent = "PAUSE";
    pauseButton.setAttribute("aria-pressed", "false");
    beep(520, 0.05, 0.025);
  }

  function remainingSeconds(now = performance.now()) {
    if (!sessionEnd) return SESSION_SECONDS;
    return Math.max(0, (sessionEnd - now) / 1000);
  }

  function update(dt, now) {
    const remaining = remainingSeconds(now);
    timeValue.textContent = remaining.toFixed(1);

    if (remaining <= 0 && state !== "ready" && state !== "ended") {
      finishBreak();
      return;
    }

    if (state !== "playing") {
      updateHud();
      return;
    }

    const gravityPx = env.gravity * PX_PER_M;
    const windPx = env.wind * PX_PER_M;
    lander.vy += gravityPx * dt;
    lander.vx += windPx * dt;

    if (lander.fuel > 0) {
      if (keys.thrust) {
        lander.vy -= 4.85 * PX_PER_M * dt;
        lander.fuel -= 10.5 * dt;
      }
      if (keys.left) {
        lander.vx -= 2.0 * PX_PER_M * dt;
        lander.fuel -= 5.5 * dt;
      }
      if (keys.right) {
        lander.vx += 2.0 * PX_PER_M * dt;
        lander.fuel -= 5.5 * dt;
      }
    }

    lander.fuel = Math.max(0, lander.fuel);
    lander.vx *= Math.pow(0.999, dt * 60);
    lander.x += lander.vx * dt;
    lander.y += lander.vy * dt;

    if (lander.x < LANDER_HALF_W) {
      lander.x = LANDER_HALF_W;
      lander.vx = Math.abs(lander.vx) * 0.35;
    } else if (lander.x > W - LANDER_HALF_W) {
      lander.x = W - LANDER_HALF_W;
      lander.vx = -Math.abs(lander.vx) * 0.35;
    }

    const ground = groundYAt(lander.x);
    if (lander.y + LANDER_HALF_H >= ground) {
      resolveTouchdown(now);
    }

    updateHud();
  }

  function groundYAt(x) {
    const padLeft = pad.x - pad.width / 2;
    const padRight = pad.x + pad.width / 2;
    if (x >= padLeft - 8 && x <= padRight + 8) return pad.y;

    const clamped = Math.max(0, Math.min(W, x));
    const step = 48;
    const i = Math.min(terrain.length - 2, Math.floor(clamped / step));
    const a = terrain[i] || { x: 0, y: 525 };
    const b = terrain[i + 1] || a;
    const t = b.x === a.x ? 0 : (clamped - a.x) / (b.x - a.x);
    return a.y + (b.y - a.y) * t;
  }

  function resolveTouchdown(now) {
    const padLeft = pad.x - pad.width / 2 + LANDER_HALF_W;
    const padRight = pad.x + pad.width / 2 - LANDER_HALF_W;
    const onPad = lander.x >= padLeft && lander.x <= padRight;
    const vx = Math.abs(lander.vx / PX_PER_M);
    const vy = Math.abs(lander.vy / PX_PER_M);
    const verticalOk = vy <= MAX_VS;
    const horizontalOk = vx <= MAX_HS;
    const soft = verticalOk && horizontalOk;

    lander.y = groundYAt(lander.x) - LANDER_HALF_H;
    lander.alive = false;
    clearInputs();

    if (onPad && soft) {
      const runSeconds = Math.max(0.1, (now - runStart) / 1000);
      const centerError = Math.abs(lander.x - pad.x) / (pad.width / 2);
      const score = Math.max(0, Math.round(
        8000 +
        lander.fuel * 28 +
        Math.max(0, 1 - centerError) * 1700 -
        vx * 520 -
        vy * 700 -
        runSeconds * 35
      ));
      state = "result";
      if (score > bestScore) saveBest(score);
      missionText.textContent = "LANDING SUCCESS";
      beep(760, 0.08, 0.04);
      setTimeout(() => beep(980, 0.10, 0.035), 90);
      showResult(true, score, vx, vy, onPad, verticalOk, horizontalOk);
    } else {
      state = "result";
      const failed = [];
      if (!onPad) failed.push("PAD外");
      if (!verticalOk) failed.push("V/S超過");
      if (!horizontalOk) failed.push("H/S超過");
      missionText.textContent = "FAILED: " + failed.join(" / ");
      beep(150, 0.15, 0.05);
      showResult(false, 0, vx, vy, onPad, verticalOk, horizontalOk);
    }
  }

  function showResult(success, score, vx, vy, onPad, verticalOk, horizontalOk) {
    overlay.hidden = false;
    overlayKicker.textContent = success ? "TOUCHDOWN" : "TRY AGAIN";
    overlayTitle.textContent = success ? "着陸成功。" : "着陸失敗。";
    if (success) {
      overlayText.textContent = "3条件をすべて満たしました。残り時間でもう一度狙えます。";
    } else {
      const reasons = [];
      if (!onPad) reasons.push("機体全体がPAD内に入っていません");
      if (!verticalOk) reasons.push("V/S が 2.25 m/s を超えています");
      if (!horizontalOk) reasons.push("H/S が 1.35 m/s を超えています");
      overlayText.textContent = "失敗理由: " + reasons.join(" / ");
    }

    resultStats.hidden = false;
    resultStats.innerHTML =
      "<div><span>SCORE</span><strong>" + score.toLocaleString("ja-JP") + "</strong></div>" +
      "<div><span>V/S</span><strong>" + vy.toFixed(2) + "</strong></div>" +
      "<div><span>H/S</span><strong>" + vx.toFixed(2) + "</strong></div>";

    primaryButton.textContent = remainingSeconds() > 2 ? "もう1回" : "NEW BREAK";
    secondaryButton.hidden = false;
    secondaryButton.textContent = "研究に戻る";
  }

  function finishBreak() {
    state = "ended";
    clearInputs();
    timeValue.textContent = "0.0";
    overlay.hidden = false;
    overlayKicker.textContent = "BREAK COMPLETE";
    overlayTitle.textContent = "90秒、終了。";
    overlayText.textContent = "ちょうどいいところで研究へ戻れます。続けたくなったら、新しい90秒をどうぞ。";
    resultStats.hidden = true;
    primaryButton.textContent = "NEW 90 SEC";
    secondaryButton.hidden = false;
    secondaryButton.textContent = "このまま終了";
  }

  function endEarly() {
    state = "ended";
    sessionEnd = performance.now();
    clearInputs();
    overlay.hidden = false;
    overlayKicker.textContent = "BACK TO RESEARCH";
    overlayTitle.textContent = "休憩終了。";
    overlayText.textContent = "ゲームはここで静止しています。このタブはそのまま閉じても大丈夫です。";
    resultStats.hidden = true;
    primaryButton.textContent = "また90秒遊ぶ";
    secondaryButton.hidden = true;
    timeValue.textContent = "0.0";
  }

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      pausedAt = performance.now();
      clearInputs();
      pauseButton.textContent = "RESUME";
      pauseButton.setAttribute("aria-pressed", "true");
      overlay.hidden = false;
      overlayKicker.textContent = "PAUSED";
      overlayTitle.textContent = "一時停止";
      overlayText.textContent = "休憩タイマーも止まっています。";
      resultStats.hidden = true;
      primaryButton.textContent = "RESUME";
      secondaryButton.hidden = false;
      secondaryButton.textContent = "研究に戻る";
    } else if (state === "paused") {
      resumeFromPause();
    }
  }

  function resumeFromPause() {
    const now = performance.now();
    if (pausedAt && sessionEnd) sessionEnd += now - pausedAt;
    if (pausedAt && runStart) runStart += now - pausedAt;
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
    const ground = groundYAt(lander.x);
    const altitude = Math.max(0, (ground - (lander.y + LANDER_HALF_H)) / PX_PER_M);
    const vs = Math.abs(lander.vy / PX_PER_M);
    const hs = Math.abs(lander.vx / PX_PER_M);
    const safePadLeft = pad.x - pad.width / 2 + LANDER_HALF_W;
    const safePadRight = pad.x + pad.width / 2 - LANDER_HALF_W;
    const onPad = lander.x >= safePadLeft && lander.x <= safePadRight;

    fuelValue.textContent = Math.round(lander.fuel);
    altValue.textContent = altitude.toFixed(1);
    vsValue.textContent = vs.toFixed(2);
    hsValue.textContent = hs.toFixed(2);

    setRuleState(padRule, onPad);
    setRuleState(vsRule, vs <= MAX_VS);
    setRuleState(hsRule, hs <= MAX_HS);
  }

  function setRuleState(element, ok) {
    if (!element) return;
    element.classList.toggle("ok", ok);
    element.setAttribute("aria-label", (ok ? "条件達成: " : "条件未達: ") + element.textContent.trim());
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, "#030813");
    gradient.addColorStop(0.65, "#071425");
    gradient.addColorStop(1, "#102035");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    for (const s of stars) {
      ctx.globalAlpha = s.a;
      ctx.fillStyle = "#dcecff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    drawWind();
    drawTerrain();
    drawPad();
    drawLander();
  }

  function drawWind() {
    const strength = Math.abs(env.wind);
    if (!strength) return;
    const y = 72;
    ctx.strokeStyle = "rgba(145, 190, 225, .28)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const dir = Math.sign(env.wind);
    const start = dir > 0 ? 70 : W - 70;
    const end = start + dir * (55 + strength * 80);
    ctx.moveTo(start, y);
    ctx.lineTo(end, y);
    ctx.lineTo(end - dir * 10, y - 5);
    ctx.moveTo(end, y);
    ctx.lineTo(end - dir * 10, y + 5);
    ctx.stroke();
    ctx.fillStyle = "rgba(165, 204, 232, .52)";
    ctx.font = "700 11px system-ui";
    ctx.textAlign = dir > 0 ? "left" : "right";
    ctx.fillText("WIND", start, y - 10);
  }

  function drawTerrain() {
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, groundYAt(0));
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, groundYAt(x));
    ctx.lineTo(W, H);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, 480, 0, H);
    grad.addColorStop(0, "#25354a");
    grad.addColorStop(1, "#101a29");
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    for (let x = 0; x <= W; x += 8) {
      const y = groundYAt(x);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(189, 216, 241, .28)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawPad() {
    const left = pad.x - pad.width / 2;
    const right = pad.x + pad.width / 2;

    ctx.strokeStyle = "#8be0ff";
    ctx.fillStyle = "rgba(139, 224, 255, .12)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(left, pad.y - 2);
    ctx.lineTo(right, pad.y - 2);
    ctx.stroke();
    ctx.fillRect(left, pad.y - 7, pad.width, 6);

    const safeLeft = left + LANDER_HALF_W;
    const safeRight = right - LANDER_HALF_W;
    ctx.strokeStyle = "rgba(167, 243, 208, .56)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(safeLeft, pad.y - 9);
    ctx.lineTo(safeLeft, pad.y + 4);
    ctx.moveTo(safeRight, pad.y - 9);
    ctx.lineTo(safeRight, pad.y + 4);
    ctx.stroke();

    ctx.fillStyle = "rgba(208, 239, 255, .84)";
    ctx.font = "800 11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("PAD / LAND HERE", pad.x, pad.y + 18);

    ctx.strokeStyle = "rgba(139, 224, 255, .30)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.x, pad.y - 2);
    ctx.lineTo(pad.x, pad.y - 24);
    ctx.stroke();
  }

  function drawLander() {
    ctx.save();
    ctx.translate(lander.x, lander.y);
    const tilt = Math.max(-0.18, Math.min(0.18, lander.vx * 0.004));
    ctx.rotate(tilt);

    if (state === "playing" && lander.fuel > 0 && keys.thrust) {
      const flame = 15 + Math.random() * 9;
      ctx.fillStyle = "#ffd38a";
      ctx.beginPath();
      ctx.moveTo(-6, 16);
      ctx.lineTo(0, 16 + flame);
      ctx.lineTo(6, 16);
      ctx.closePath();
      ctx.fill();
    }

    if (state === "playing" && lander.fuel > 0 && keys.left) {
      ctx.fillStyle = "#8be0ff";
      ctx.fillRect(11, -2, 13 + Math.random() * 7, 4);
    }
    if (state === "playing" && lander.fuel > 0 && keys.right) {
      ctx.fillStyle = "#8be0ff";
      ctx.fillRect(-24 - Math.random() * 7, -2, 13, 4);
    }

    ctx.strokeStyle = "#dcecff";
    ctx.lineWidth = 2.4;
    ctx.fillStyle = "#1a2d43";
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(12, -4);
    ctx.lineTo(10, 14);
    ctx.lineTo(-10, 14);
    ctx.lineTo(-12, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#77d4ff";
    ctx.beginPath();
    ctx.arc(0, -5, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-8, 12);
    ctx.lineTo(-15, 20);
    ctx.moveTo(8, 12);
    ctx.lineTo(15, 20);
    ctx.stroke();

    ctx.restore();
  }

  function clearInputs() {
    keys.left = keys.right = keys.thrust = false;
    leftButton.classList.remove("active");
    rightButton.classList.remove("active");
    thrustButton.classList.remove("active");
  }

  function bindHold(button, keyName) {
    const set = (value) => {
      if (state !== "playing" && value) return;
      keys[keyName] = value;
      button.classList.toggle("active", value);
      if (value) beep(keyName === "thrust" ? 250 : 190, 0.025, 0.008);
    };
    button.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      try { button.setPointerCapture(e.pointerId); } catch (_) {}
      set(true);
    });
    button.addEventListener("pointerup", () => set(false));
    button.addEventListener("pointercancel", () => set(false));
    button.addEventListener("lostpointercapture", () => set(false));
  }

  bindHold(leftButton, "left");
  bindHold(thrustButton, "thrust");
  bindHold(rightButton, "right");

  window.addEventListener("keydown", (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (e.key === "Escape") {
      e.preventDefault();
      togglePause();
      return;
    }
    if (state !== "playing") return;

    if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
      keys.left = true;
      leftButton.classList.add("active");
      e.preventDefault();
    }
    if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
      keys.right = true;
      rightButton.classList.add("active");
      e.preventDefault();
    }
    if (e.key === "ArrowUp" || e.code === "Space" || e.key.toLowerCase() === "w") {
      keys.thrust = true;
      thrustButton.classList.add("active");
      e.preventDefault();
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
      keys.left = false;
      leftButton.classList.remove("active");
    }
    if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
      keys.right = false;
      rightButton.classList.remove("active");
    }
    if (e.key === "ArrowUp" || e.code === "Space" || e.key.toLowerCase() === "w") {
      keys.thrust = false;
      thrustButton.classList.remove("active");
    }
  });

  window.addEventListener("blur", () => {
    if (state === "playing") togglePause();
    else clearInputs();
  });

  primaryButton.addEventListener("click", () => {
    if (state === "ready" || state === "ended") startSession();
    else if (state === "paused") resumeFromPause();
    else if (state === "result") {
      if (remainingSeconds() > 2) startRound();
      else startSession();
    }
  });

  secondaryButton.addEventListener("click", endEarly);
  pauseButton.addEventListener("click", togglePause);

  soundButton.addEventListener("click", () => {
    soundOn = !soundOn;
    soundButton.textContent = soundOn ? "SOUND ON" : "SOUND OFF";
    soundButton.setAttribute("aria-pressed", soundOn ? "true" : "false");
    if (soundOn) {
      ensureAudio();
      beep(620, 0.06, 0.03);
    }
  });

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
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  function frame(now) {
    const rawDt = (now - lastTime) / 1000;
    lastTime = now;
    const dt = Math.max(0, Math.min(0.035, rawDt));
    update(dt, now);
    draw();
    requestAnimationFrame(frame);
  }

  generateRound();
  updateHud();
  draw();
  requestAnimationFrame(frame);
})();