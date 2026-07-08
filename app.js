const bases = [
  { code: "BASE-A", name: "森の受付", points: 10 },
  { code: "BASE-B", name: "工房カウンター", points: 15 },
  { code: "BASE-C", name: "屋上スポット", points: 20 },
  { code: "BASE-D", name: "展示ルーム", points: 25 },
];

const rewards = [
  {
    threshold: 3,
    title: "ビギナーカード",
    body: "最初の3拠点を巡った記念カード。次の拠点候補をAIが提案できます。",
  },
  {
    threshold: 5,
    title: "エリアマスター",
    body: "5スタンプ到達で解放。限定クーポンや会員証デザインにも展開できます。",
  },
  {
    threshold: 8,
    title: "シークレットカード",
    body: "全スタンプ達成で解放。画像生成AIで特別カードを発行する想定です。",
  },
];

const storageKey = "qr-stamp-demo-state";
const maxStamps = 8;
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

render();

function loadState() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return { stamps: [], points: 0, cards: [] };

  try {
    return JSON.parse(raw);
  } catch {
    return { stamps: [], points: 0, cards: [] };
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

  state.stamps.push({
    code: base.code,
    name: base.name,
    points: base.points,
    checkedInAt: new Date().toISOString(),
  });
  state.points += base.points;
  unlockRewards();
  saveState();
  render();
  setStatus(`${base.name} でチェックイン。${base.points}ポイント獲得しました。`);
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
    const reached = state.stamps.length >= reward.threshold;
    const alreadyUnlocked = state.cards.includes(reward.title);
    if (reached && !alreadyUnlocked) {
      state.cards.push(reward.title);
    }
  });
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
    label.textContent = stampData ? "✓" : index + 1;
    stamp.classList.toggle("filled", Boolean(stampData));
    stamp.title = stampData ? stampData.name : "未取得";
    els.stampGrid.append(stamp);
  }

  const nextReward = rewards.find((reward) => state.stamps.length < reward.threshold);
  els.nextRewardText.textContent = nextReward
    ? `あと${nextReward.threshold - state.stamps.length}個で${nextReward.title}`
    : "すべて解放済み";
}

function renderRewards() {
  els.rewardList.innerHTML = "";
  const template = document.querySelector("#rewardTemplate");

  rewards.forEach((reward) => {
    const card = template.content.firstElementChild.cloneNode(true);
    const unlocked = state.cards.includes(reward.title);
    card.classList.toggle("locked", !unlocked);
    card.querySelector(".reward-state").textContent = unlocked
      ? "UNLOCKED"
      : `${reward.threshold}スタンプで解放`;
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
