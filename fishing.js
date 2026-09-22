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
  const catchValue = document.getElementById("catchValue");
  const bestValue = document.getElementById("bestValue");

  const statusText = document.getElementById("statusText");
  const hintText = document.getElementById("hintText");
  const tensionFill = document.getElementById("tensionFill");
  const reelFill = document.getElementById("reelFill");
  const tensionText = document.getElementById("tensionText");
  const reelText = document.getElementById("reelText");
  const biteCallout = document.getElementById("biteCallout");

  const actionButton = document.getElementById("actionButton");
  const actionMain = document.getElementById("actionMain");
  const actionSub = document.getElementById("actionSub");
  const pauseButton = document.getElementById("pauseButton");
  const soundButton = document.getElementById("soundButton");

  const W = canvas.width;
  const H = canvas.height;
  const SESSION_SECONDS = 90;

  const fishTable = [
    { name: "ハゼ", rarity: "COMMON", weight: 42, base: 180, strength: .58, color: "#a9bbc0", size: .78 },
    { name: "アジ", rarity: "COMMON", weight: 28, base: 260, strength: .68, color: "#b9d1d7", size: .88 },
    { name: "サバ", rarity: "UNCOMMON", weight: 15, base: 480, strength: .82, color: "#8fb8c8", size: 1.02 },
    { name: "イカ", rarity: "UNCOMMON", weight: 9, base: 650, strength: .88, color: "#cab9d2", size: .92 },
    { name: "シーバス", rarity: "RARE", weight: 5, base: 1050, strength: 1.02, color: "#d3d7c8", size: 1.22 },
    { name: "月光魚", rarity: "VERY RARE", weight: 1, base: 2500, strength: 1.16, color: "#a8e9e0", size: 1.08 }
  ];

  const stars = makeStars(80);
  const ripples = [];

  let state = "ready";
  let lastTime = performance.now();
  let sessionEnd = 0;
  let pausedAt = 0;
  let score = 0;
  let catches = 0;
  let best = loadBest();
  let soundOn = false;
  let audioCtx = null;

  let phase = "idle";
  let phaseTimer = 0;
  let biteWindow = 0;
  let holding = false;
  let tension = 0;
  let reel = 0;
  let fish = null;
  let fishPull = 0;
  let pullTimer = 0;
  let bobber = { x: W * .66, y: H * .56, dip: 0 };
  let lastCatch = "";

  bestValue.textContent = best.toLocaleString("ja-JP");

  function loadBest() {
    try {
      const v = Number(localStorage.getItem("rba-night-fishing-best"));
      return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
    } catch (_) { return 0; }
  }

  function saveBest(v) {
    best = Math.max(best, Math.floor(v));
    bestValue.textContent = best.toLocaleString("ja-JP");
    try { localStorage.setItem("rba-night-fishing-best", String(best)); } catch (_) {}
  }

  function makeStars(count) {
    let seed = 91831;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    return Array.from({ length: count }, () => ({
      x: rnd() * W,
      y: rnd() * H * .38,
      r: .5 + rnd() * 1.25,
      a: .25 + rnd() * .7
    }));
  }

  function randomBetween(a, b) { return a + Math.random() * (b - a); }

  function startSession() {
    score = 0;
    catches = 0;
    lastCatch = "";
    scoreValue.textContent = "0";
    catchValue.textContent = "0";
    sessionEnd = performance.now() + SESSION_SECONDS * 1000;
    state = "playing";
    pausedAt = 0;
    hideOverlay();
    startIdle();
  }

  function startIdle() {
    phase = "idle";
    holding = false;
    fish = null;
    tension = 0;
    reel = 0;
    biteCallout.hidden = true;
    statusText.textContent = lastCatch || "静かな水面";
    hintText.textContent = "Space / CAST で仕掛けを投げます。";
    actionMain.textContent = "CAST";
    actionSub.textContent = "Space";
    updateMeters();
  }

  function cast() {
    if (state !== "playing" || phase !== "idle") return;
    phase = "waiting";
    phaseTimer = randomBetween(1.2, 3.8);
    bobber.x = randomBetween(W * .48, W * .82);
    bobber.y = randomBetween(H * .51, H * .62);
    ripples.push({ x: bobber.x, y: bobber.y, r: 3, life: 1 });
    statusText.textContent = "待っています…";
    hintText.textContent = "食いつくまでは押さなくてOK。";
    actionMain.textContent = "WAIT";
    actionSub.textContent = "じっと待つ";
    beep(330, .04, .018);
  }

  function beginBite() {
    phase = "bite";
    biteWindow = randomBetween(.72, 1.05);
    bobber.dip = 1;
    biteCallout.hidden = false;
    statusText.textContent = "HIT! 今！";
    hintText.textContent = "Space / HIT を押して合わせる。";
    actionMain.textContent = "HIT!";
    actionSub.textContent = "NOW";
    beep(780, .06, .04);
  }

  function hookFish() {
    fish = chooseFish();
    phase = "reeling";
    tension = randomBetween(.20, .32);
    reel = .04;
    fishPull = .45;
    pullTimer = randomBetween(.3, .7);
    biteCallout.hidden = true;
    statusText.textContent = fish.name + " がかかった！";
    hintText.textContent = "押すと巻く。赤まで張ったら離して糸を休ませる。";
    actionMain.textContent = "REEL";
    actionSub.textContent = "HOLD / RELEASE";
    beep(510, .06, .035);
  }

  function chooseFish() {
    const total = fishTable.reduce((s, f) => s + f.weight, 0);
    let r = Math.random() * total;
    for (const f of fishTable) {
      r -= f.weight;
      if (r <= 0) return { ...f };
    }
    return { ...fishTable[0] };
  }

  function missBite(reason) {
    phase = "cooldown";
    phaseTimer = .7;
    biteCallout.hidden = true;
    bobber.dip = 0;
    statusText.textContent = reason;
    hintText.textContent = "少し待ってから次を投げます。";
    actionMain.textContent = "…";
    actionSub.textContent = "escaped";
    beep(150, .09, .025);
  }

  function snapLine() {
    holding = false;
    phase = "cooldown";
    phaseTimer = .9;
    statusText.textContent = "糸が切れた…";
    hintText.textContent = "張りすぎです。赤に近づいたら一度離す。";
    actionMain.textContent = "…";
    actionSub.textContent = "line snapped";
    tension = 1;
    beep(110, .14, .04);
  }

  function catchFish() {
    holding = false;
    phase = "cooldown";
    phaseTimer = 1.0;

    const tensionBonus = Math.round((1 - Math.max(0, tension - .55)) * 160);
    const scoreGain = fish.base + tensionBonus;
    score += scoreGain;
    catches += 1;
    saveBest(score);
    scoreValue.textContent = score.toLocaleString("ja-JP");
    catchValue.textContent = String(catches);

    lastCatch = fish.name + " +" + scoreGain;
    statusText.textContent = "釣れた！ " + fish.name;
    hintText.textContent = fish.rarity + " · +" + scoreGain + " pts";
    actionMain.textContent = "NICE!";
    actionSub.textContent = fish.rarity;
    reel = 1;
    tension = Math.min(tension, .8);
    beep(830, .08, .04);
    setTimeout(() => beep(1040, .10, .035), 90);
  }

  function actionDown() {
    if (state !== "playing") return;

    if (phase === "idle") {
      cast();
    } else if (phase === "waiting") {
      missBite("早すぎた。魚が逃げた");
    } else if (phase === "bite") {
      hookFish();
    } else if (phase === "reeling") {
      holding = true;
      actionButton.classList.add("active");
    }
  }

  function actionUp() {
    holding = false;
    actionButton.classList.remove("active");
  }

  function update(dt, now) {
    const remain = sessionEnd ? Math.max(0, (sessionEnd - now) / 1000) : SESSION_SECONDS;
    timeValue.textContent = remain.toFixed(1);

    updateRipples(dt);

    if (state !== "playing") {
      updateMeters();
      return;
    }

    if (remain <= 0) {
      finishSession();
      return;
    }

    if (phase === "waiting") {
      phaseTimer -= dt;
      if (phaseTimer <= 0) beginBite();
    } else if (phase === "bite") {
      biteWindow -= dt;
      bobber.dip = .5 + Math.sin(now * .035) * .5;
      if (biteWindow <= 0) missBite("遅かった。逃げられた");
    } else if (phase === "reeling") {
      pullTimer -= dt;
      if (pullTimer <= 0) {
        fishPull = randomBetween(.25, 1.0) * fish.strength;
        pullTimer = randomBetween(.28, .82);
      }

      if (holding) {
        reel += (0.105 / fish.strength) * dt;
        tension += (0.18 + fishPull * .34) * dt;
      } else {
        reel -= .018 * fish.strength * dt;
        tension -= (.28 - Math.min(.12, fishPull * .04)) * dt;
      }

      tension += Math.sin(now * .008) * .012 * fish.strength * dt * 8;
      reel = clamp(reel, 0, 1);
      tension = clamp(tension, 0, 1.08);

      if (tension >= 1) snapLine();
      else if (reel >= 1) catchFish();
    } else if (phase === "cooldown") {
      phaseTimer -= dt;
      if (phaseTimer <= 0) startIdle();
    }

    updateMeters();
  }

  function updateMeters() {
    const tp = Math.round(clamp(tension, 0, 1) * 100);
    const rp = Math.round(clamp(reel, 0, 1) * 100);
    tensionFill.style.width = tp + "%";
    reelFill.style.width = rp + "%";
    tensionText.textContent = tp + "%";
    reelText.textContent = rp + "%";
  }

  function updateRipples(dt) {
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.r += dt * 32;
      r.life -= dt * .85;
      if (r.life <= 0) ripples.splice(i, 1);
    }
  }

  function finishSession() {
    state = "ended";
    holding = false;
    actionUp();
    biteCallout.hidden = true;
    timeValue.textContent = "0.0";

    overlay.hidden = false;
    overlayKicker.textContent = "BREAK COMPLETE";
    overlayTitle.textContent = catches ? catches + "匹、釣れました。" : "今夜はボウズ。";
    overlayText.textContent = catches
      ? "Score " + score.toLocaleString("ja-JP") + "。ちょうど90秒です。"
      : "釣れない夜もあります。90秒なので、ここで研究へ戻れます。";

    resultStats.hidden = false;
    resultStats.innerHTML =
      "<div><span>SCORE</span><strong>" + score.toLocaleString("ja-JP") + "</strong></div>" +
      "<div><span>CATCH</span><strong>" + catches + "</strong></div>" +
      "<div><span>BEST</span><strong>" + best.toLocaleString("ja-JP") + "</strong></div>";

    primaryButton.textContent = "NEW 90 SEC";
    secondaryButton.hidden = false;
    secondaryButton.textContent = "研究に戻る";
  }

  function endEarly() {
    state = "ended";
    sessionEnd = performance.now();
    holding = false;
    actionUp();
    overlay.hidden = false;
    overlayKicker.textContent = "BACK TO RESEARCH";
    overlayTitle.textContent = "休憩終了。";
    overlayText.textContent = "ここで静止しています。次の休憩で続きをどうぞ。";
    resultStats.hidden = true;
    primaryButton.textContent = "また90秒釣る";
    secondaryButton.hidden = true;
    timeValue.textContent = "0.0";
  }

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      pausedAt = performance.now();
      holding = false;
      actionUp();
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
      resumePause();
    }
  }

  function resumePause() {
    const now = performance.now();
    if (pausedAt && sessionEnd) sessionEnd += now - pausedAt;
    pausedAt = 0;
    state = "playing";
    overlay.hidden = true;
    secondaryButton.hidden = true;
    pauseButton.textContent = "PAUSE";
    pauseButton.setAttribute("aria-pressed", "false");
  }

  function hideOverlay() {
    overlay.hidden = true;
    resultStats.hidden = true;
    secondaryButton.hidden = true;
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawSky();
    drawLake();
    drawPier();
    drawBobber();
    if (phase === "reeling" && fish) drawFishHint();
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H * .52);
    g.addColorStop(0, "#06101d");
    g.addColorStop(1, "#102c35");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H * .54);

    for (const s of stars) {
      ctx.globalAlpha = s.a;
      ctx.fillStyle = "#dcecf0";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "rgba(224, 238, 219, .86)";
    ctx.beginPath();
    ctx.arc(W * .18, H * .18, 34, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(6, 16, 29, .9)";
    ctx.beginPath();
    ctx.arc(W * .193, H * .168, 33, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#07151d";
    ctx.beginPath();
    ctx.moveTo(0, H * .46);
    for (let x = 0; x <= W; x += 32) {
      const y = H * .43 + Math.sin(x * .018) * 11 + Math.sin(x * .006) * 18;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H * .58);
    ctx.lineTo(0, H * .58);
    ctx.closePath();
    ctx.fill();
  }

  function drawLake() {
    const top = H * .49;
    const g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, "#153e49");
    g.addColorStop(1, "#061a24");
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, H - top);

    ctx.strokeStyle = "rgba(154, 212, 211, .08)";
    ctx.lineWidth = 1;
    for (let y = top + 18; y < H; y += 22) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= W; x += 30) {
        ctx.lineTo(x, y + Math.sin(x * .025 + y * .035) * 2);
      }
      ctx.stroke();
    }

    for (const r of ripples) {
      ctx.globalAlpha = Math.max(0, r.life) * .5;
      ctx.strokeStyle = "#a8e9e0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r * 1.7, r.r * .55, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawPier() {
    ctx.fillStyle = "#221d18";
    ctx.fillRect(0, H * .72, W * .30, H * .12);
    ctx.fillStyle = "#14110f";
    ctx.fillRect(W * .07, H * .80, 18, H * .20);
    ctx.fillRect(W * .24, H * .80, 18, H * .20);

    ctx.strokeStyle = "rgba(235, 244, 236, .66)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W * .28, H * .62, 20, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();

    ctx.strokeStyle = "rgba(218, 235, 228, .46)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(W * .30, H * .60);
    ctx.quadraticCurveTo(W * .48, H * .43, bobber.x, bobber.y - 3);
    ctx.stroke();
  }

  function drawBobber() {
    const dip = phase === "bite" ? 10 * bobber.dip : 0;
    const y = bobber.y + dip;

    ctx.fillStyle = "#f0f5ee";
    ctx.beginPath();
    ctx.arc(bobber.x, y - 5, 6, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#e8736c";
    ctx.beginPath();
    ctx.arc(bobber.x, y - 5, 6, 0, Math.PI);
    ctx.fill();

    ctx.strokeStyle = "rgba(190, 235, 226, .33)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(bobber.x, bobber.y + 2, 16, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawFishHint() {
    const depth = H * .78;
    const x = bobber.x + Math.sin(performance.now() * .002) * 44;
    const size = 26 * fish.size;

    ctx.globalAlpha = .18;
    ctx.fillStyle = fish.color;
    ctx.beginPath();
    ctx.ellipse(x, depth, size * 1.45, size * .55, 0, 0, Math.PI * 2);
    ctx.moveTo(x - size * 1.25, depth);
    ctx.lineTo(x - size * 1.9, depth - size * .55);
    ctx.lineTo(x - size * 1.9, depth + size * .55);
    ctx.closePath();
    ctx.fill();
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

  actionButton.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    try { actionButton.setPointerCapture(e.pointerId); } catch (_) {}
    actionDown();
  });
  actionButton.addEventListener("pointerup", actionUp);
  actionButton.addEventListener("pointercancel", actionUp);
  actionButton.addEventListener("lostpointercapture", actionUp);

  window.addEventListener("keydown", (e) => {
    if (e.repeat || e.code !== "Space") return;
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") return;
    e.preventDefault();
    actionDown();
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      actionUp();
    }
  });

  window.addEventListener("blur", () => {
    if (state === "playing") togglePause();
    else actionUp();
  });

  primaryButton.addEventListener("click", () => {
    if (state === "ready" || state === "ended") startSession();
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