const bases = [
  { code: "BASE-A", name: "森の受付", points: 10 },
  { code: "BASE-B", name: "工房カウンター", points: 15 },
  { code: "BASE-C", name: "屋上スポット", points: 20 },
  { code: "BASE-D", name: "展示ルーム", points: 25 },
];

const rewards = [
  {
    thresholdPoints: 40,
    title: "むきあうかぎ",
    body: "じぶんを見つめ、しんけんに取り組むことで、よりよいじぶんになれるかぎ。",
    image: "./assets/mukiau-kagi.png",
  },
  {
    thresholdPoints: 80,
    title: "かんがえるかぎ",
    body: "じぶんの目で見て、つながりを見つけ、新しいものを生み出すことができるかぎ。",
    image: "./assets/kangaeru-kagi.png",
  },
];

const storageKey = "qr-stamp-demo-state";
const maxStamps = 8;
const pointCooldownMs = 60 * 60 * 1000;
const pointKeyLevels = [1000, 100, 10, 1];
let stream = null;
let scanTimer = null;
let scanCanvas = null;
let scanContext = null;

const state = loadState();
const els = {
  pointTotal: document.querySelector("#pointTotal"),
  stampTotal: document.querySelector("#stampTotal"),
  stampGrid: document.querySelector("#stampGrid"),
  rewardList: document.querySelector("#rewardList"),
  baseList: document.querySelector("#baseList"),
  nextRewardText: document.querySelector("#nextRewardText"),
  aiMessage: document.querySelector("#aiMessage"),
  statusText: document.querySelector("#statusText"),
  camera: document.querySelector("#camera"),
  scannerFrame: document.querySelector(".scanner-frame"),
  manualCode: document.querySelector("#manualCode"),
  startScanButton: document.querySelector("#startScanButton"),
  stopScanButton: document.querySelector("#stopScanButton"),
  manualCheckInButton: document.querySelector("#manualCheckInButton"),
  resetButton: document.querySelector("#resetButton"),
};

els.startScanButton.addEventListener("click", startScanner);
els.stopScanButton.addEventListener("click", stopScanner);
els.manualCheckInButton.addEventListener("click", () => checkIn(els.manualCode.value));
els.manualCode.addEventListener("keydown", (event) => {
  if (event.key === "Enter") checkIn(els.manualCode.value);
});
els.resetButton.addEventListener("click", resetDemo);

unlockRewards();
saveState();
render();

function loadState() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return { stamps: [], points: 0, cards: [], lastPointAt: null };

  try {
    return { stamps: [], points: 0, cards: [], lastPointAt: null, ...JSON.parse(raw) };
  } catch {
    return { stamps: [], points: 0, cards: [], lastPointAt: null };
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function checkIn(rawCode) {
  const code = normalizeCode(rawCode);
  const base = bases.find((item) => item.code === code);

  if (!base) {
    setStatus("未登録のQRです。デモでは BASE-A などを使えます。");
    return;
  }

  if (state.stamps.some((stamp) => stamp.code === code)) {
    setStatus(`${base.name} はチェックイン済みです。別の拠点QRを読んでください。`);
    return;
  }

  if (state.stamps.length >= maxStamps) {
    setStatus("スタンプカードは満タンです。リセットすると再度試せます。");
    return;
  }

  const cooldown = getPointCooldown();
  if (cooldown.remainingMs > 0) {
    setStatus(`ポイントは60分に一度だけ獲得できます。あと${formatDuration(cooldown.remainingMs)}待ってください。`);
    return;
  }

  state.stamps.push({
    code: base.code,
    name: base.name,
    points: base.points,
    checkedInAt: new Date().toISOString(),
  });
  state.points += base.points;
  state.lastPointAt = new Date().toISOString();
  unlockRewards();
  saveState();
  render();
  setStatus(`${base.name} でチェックイン。${base.points}ポイント獲得しました。次のポイント獲得は60分後です。`);
  els.manualCode.value = "";
}

function normalizeCode(rawCode) {
  return String(rawCode || "")
    .trim()
    .toUpperCase()
    .replace(/^HTTPS?:\/\/[^?]+\?BASE=/, "");
}

function unlockRewards() {
  rewards.forEach((reward) => {
    const reached = state.points >= reward.thresholdPoints;
    const alreadyUnlocked = state.cards.includes(reward.title);
    if (reached && !alreadyUnlocked) {
      state.cards.push(reward.title);
    }
  });
}

function getPointCooldown() {
  if (!state.lastPointAt) return { remainingMs: 0 };

  const lastPointTime = new Date(state.lastPointAt).getTime();
  if (!Number.isFinite(lastPointTime)) return { remainingMs: 0 };

  const elapsedMs = Date.now() - lastPointTime;
  return { remainingMs: Math.max(0, pointCooldownMs - elapsedMs) };
}

function formatDuration(milliseconds) {
  const totalMinutes = Math.ceil(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours}時間${minutes}分`;
  if (hours > 0) return `${hours}時間`;
  return `${minutes}分`;
}

async function startScanner() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("このブラウザではカメラを開始できません。コード入力で試せます。");
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    els.camera.srcObject = stream;
    await els.camera.play();
    els.scannerFrame.classList.add("camera-on");

    if ("BarcodeDetector" in window) {
      setStatus("QRを枠内に入れてください。");
      scanLoop(new BarcodeDetector({ formats: ["qr_code"] }));
      return;
    }

    if (typeof window.jsQR === "function") {
      setStatus("QRを枠内に入れてください。");
      scanLoop(null);
      return;
    }

    stopScanner();
    setStatus("QR解析ライブラリを読み込めませんでした。コード入力で試せます。");
  } catch {
    setStatus("カメラを開始できませんでした。権限設定を確認するかコード入力で試してください。");
  }
}

function scanLoop(detector) {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(async () => {
    if (!stream) return;

    try {
      const value = detector ? await detectWithBarcodeDetector(detector) : detectWithJsQr();
      if (value) {
        checkIn(value);
        stopScanner();
        return;
      }
    } catch {
      setStatus("QRの読み取りで問題が起きました。もう一度試してください。");
    }

    scanLoop(detector);
  }, 450);
}

async function detectWithBarcodeDetector(detector) {
  const codes = await detector.detect(els.camera);
  return codes[0]?.rawValue || "";
}

function detectWithJsQr() {
  if (!els.camera.videoWidth || !els.camera.videoHeight || typeof window.jsQR !== "function") {
    return "";
  }

  if (!scanCanvas) {
    scanCanvas = document.createElement("canvas");
    scanContext = scanCanvas.getContext("2d", { willReadFrequently: true });
  }

  scanCanvas.width = els.camera.videoWidth;
  scanCanvas.height = els.camera.videoHeight;
  scanContext.drawImage(els.camera, 0, 0, scanCanvas.width, scanCanvas.height);

  const imageData = scanContext.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
  const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "dontInvert",
  });

  return code?.data || "";
}

function stopScanner() {
  clearTimeout(scanTimer);
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
  stream = null;
  els.camera.srcObject = null;
  els.scannerFrame.classList.remove("camera-on");
}

function resetDemo() {
  state.stamps = [];
  state.points = 0;
  state.cards = [];
  state.lastPointAt = null;
  saveState();
  stopScanner();
  render();
  setStatus("デモデータをリセットしました。");
}

function render() {
  els.pointTotal.textContent = `${state.points} pt`;
  els.stampTotal.textContent = state.stamps.length;
  renderStamps();
  renderRewards();
  renderBases();
  renderAiMessage();
}

function renderStamps() {
  els.stampGrid.innerHTML = "";
  const template = document.querySelector("#stampTemplate");

  for (let index = 0; index < maxStamps; index += 1) {
    const stamp = template.content.firstElementChild.cloneNode(true);
    const label = stamp.querySelector("span");
    const stampData = state.stamps[index];
    const pointKeyLevel = getPointKeyLevel(stampData?.points);
    label.textContent = "";
    label.setAttribute("aria-label", stampData ? `${stampData.points}ポイント鍵` : "未取得 ロック中");
    stamp.classList.toggle("filled", Boolean(stampData));
    if (pointKeyLevel) stamp.dataset.pointKey = String(pointKeyLevel);
    stamp.title = stampData ? `${stampData.name} ${stampData.points}ポイント鍵` : "未取得 ロック中";
    els.stampGrid.append(stamp);
  }

  const nextReward = rewards.find((reward) => state.points < reward.thresholdPoints);
  els.nextRewardText.textContent = nextReward
    ? `あと${nextReward.thresholdPoints - state.points}ptで${nextReward.title}`
    : "80ptクリア";
}

function getPointKeyLevel(points) {
  const pointValue = Number(points) || 0;
  return pointKeyLevels.find((level) => pointValue >= level) || null;
}

function renderRewards() {
  els.rewardList.innerHTML = "";
  const template = document.querySelector("#rewardTemplate");

  rewards.forEach((reward) => {
    const card = template.content.firstElementChild.cloneNode(true);
    const art = card.querySelector(".reward-art");
    const unlocked = state.cards.includes(reward.title);
    card.classList.toggle("locked", !unlocked);
    if (reward.image) {
      art.classList.add("reward-art-image");
      art.style.backgroundImage = `url("${reward.image}")`;
    }
    card.querySelector(".reward-state").textContent = unlocked
      ? "CLEAR"
      : `${reward.thresholdPoints}ptでクリア`;
    card.querySelector("h3").textContent = reward.title;
    card.querySelector(".reward-body").textContent = unlocked
      ? reward.body
      : "条件達成まで内容はロックされています。";
    els.rewardList.append(card);
  });
}

function renderBases() {
  els.baseList.innerHTML = "";
  bases.forEach((base) => {
    const row = document.createElement("div");
    row.className = "base-item";
    row.innerHTML = `<div><strong>${base.name}</strong><br><code>${base.code}</code> / ${base.points}pt</div>`;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "試す";
    button.addEventListener("click", () => checkIn(base.code));
    row.append(button);
    els.baseList.append(row);
  });
}

function renderAiMessage() {
  const lastStamp = state.stamps.at(-1);
  const unlocked = state.cards.at(-1);

  if (unlocked) {
    els.aiMessage.textContent = `AI生成例: ${unlocked} のカード説明、絵柄プロンプト、次に訪れるべき拠点案内をユーザー履歴から生成します。`;
    return;
  }

  if (lastStamp) {
    els.aiMessage.textContent = `AI生成例: ${lastStamp.name} を訪問済み。未訪問拠点から近い場所や、カード解放までの短い案内文を生成します。`;
    return;
  }

  els.aiMessage.textContent =
    "AI生成例: ユーザー属性、訪問履歴、天気やイベント情報を使って、今日おすすめの拠点とカード文言を作れます。";
}

function setStatus(message) {
  els.statusText.textContent = message;
}
