import { fileToImage, detectIrisCircle, createCropCanvas, extractIrisFeatures, circleToCropPreview } from "./analysis.js?v=20260422e";
import { QUESTIONS, buildSingleReading, buildDualReading, getDualEasterQuestion } from "./content.js?v=20260422e";
import { matchSingle, buildDualRelation } from "./matching.js?v=20260422e";
import { generateSingleShareCard, generateDualShareCard, triggerDownload } from "./share.js?v=20260422e";

const app = document.getElementById("app");
const FULL_NEBULA_COUNT = 399;
const GAZE_COUNTER_KEY = "iris_universe_gaze_count";
const HERO_ROTATE_MS = 3200;
const BUSY_SCAN_MIN_MS = 2800;

const state = {
  nebulae: [],
  loading: true,
  mode: null,
  step: "home",
  heroSlideIndex: 0,
  gazeCount: 0,
  captures: [],
  questionDeck: [],
  answers: {},
  result: null,
  shareCard: null,
  cropper: null,
  toast: "",
  error: "",
  busyText: "",
  busyMode: "",
  busyPreviewUrl: "",
  busyReadouts: [],
};

let cropStage = null;
let cropPointer = null;
let heroCarouselTimer = null;

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function scrollViewportToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function renderView({ resetScroll = false } = {}) {
  render();
  if (resetScroll) {
    window.requestAnimationFrame(() => scrollViewportToTop());
  }
}

function createBusySeed(source = "") {
  return Array.from(String(source)).reduce((total, char, index) => total + char.charCodeAt(0) * (index + 17), 0);
}

function seededValue(seed, offset) {
  return (Math.sin(seed * 0.013 + offset * 1.37) + 1) / 2;
}

function buildScanReadouts(image, source = "") {
  const seed = createBusySeed(source) + image.width * 3 + image.height * 7;
  const symmetry = 0.63 + seededValue(seed, 1) * 0.23;
  const texture = 0.36 + seededValue(seed, 2) * 0.36;
  const radial = 0.48 + seededValue(seed, 3) * 0.34;
  const rings = 1 + Math.floor(seededValue(seed, 4) * 3);

  return [
    { label: "对称率预估", value: symmetry.toFixed(2) },
    { label: "纹理密度", value: `${Math.round(texture * 100)}%` },
    { label: "环层信号", value: `${rings} 层` },
    { label: "边缘稳定", value: `${Math.round(radial * 100)}%` },
  ];
}

function beginBusy({ text = "", mode = "generic", previewUrl = "", readouts = [] } = {}) {
  state.busyText = text;
  state.busyMode = mode;
  state.busyPreviewUrl = previewUrl;
  state.busyReadouts = readouts;
}

function clearBusy() {
  state.busyText = "";
  state.busyMode = "";
  state.busyPreviewUrl = "";
  state.busyReadouts = [];
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function keepBusyVisible(startedAt, minDuration = BUSY_SCAN_MIN_MS) {
  const elapsed = performance.now() - startedAt;
  if (elapsed < minDuration) {
    await wait(minDuration - elapsed);
  }
}

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setToast(message) {
  state.toast = message;
  render();
  window.clearTimeout(setToast.timer);
  setToast.timer = window.setTimeout(() => {
    state.toast = "";
    render();
  }, 2600);
}

function revokeShareCard() {
  if (state.shareCard?.url) {
    URL.revokeObjectURL(state.shareCard.url);
  }
  state.shareCard = null;
}

function getCaptureCount() {
  return state.mode === "dual" ? 2 : 1;
}

function shuffleArray(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function readStoredGazeCount() {
  try {
    return Number(window.localStorage.getItem(GAZE_COUNTER_KEY) || 0);
  } catch (_error) {
    return 0;
  }
}

function persistGazeCount(nextValue) {
  state.gazeCount = nextValue;
  try {
    window.localStorage.setItem(GAZE_COUNTER_KEY, String(nextValue));
  } catch (_error) {
    // Keep the in-memory count even if storage is unavailable.
  }
}

function incrementGazeCount() {
  persistGazeCount(readStoredGazeCount() + 1);
}

function scoreHeroNebula(nebula) {
  const titleText = `${nebula.title || ""} ${nebula.titleCn || ""}`;
  let score = 0;
  if (/(eye|helix|cat)/i.test(titleText)) score += 8;
  if (/[眼瞳眸]/.test(titleText)) score += 10;
  if (nebula.shapeTags?.includes("radial")) score += 3;
  if (nebula.shapeTags?.includes("glowing-core")) score += 3;
  if (nebula.shapeTags?.includes("balanced")) score += 2;
  score += Math.min(4, nebula.ring_count || 0);
  score += (nebula.symmetry_score || 0) * 2;
  return score;
}

function buildHeroSlides() {
  const ranked = [...state.nebulae]
    .sort((left, right) => scoreHeroNebula(right) - scoreHeroNebula(left))
    .slice(0, 6);
  return ranked.length ? ranked : state.nebulae.slice(0, 6);
}

function setHeroSlide(index) {
  const slides = buildHeroSlides();
  if (!slides.length) return;
  state.heroSlideIndex = (index + slides.length) % slides.length;
  render();
}

function clearHeroCarousel() {
  if (heroCarouselTimer) {
    window.clearInterval(heroCarouselTimer);
    heroCarouselTimer = null;
  }
}

function mountHomeCarousel() {
  if (state.loading || state.step !== "home") {
    clearHeroCarousel();
    return;
  }

  const slides = buildHeroSlides();
  const carousel = document.querySelector("[data-hero-carousel]");
  if (!carousel || slides.length < 2) {
    clearHeroCarousel();
    return;
  }

  if (!heroCarouselTimer) {
    heroCarouselTimer = window.setInterval(() => {
      if (state.loading || state.step !== "home") return;
      state.heroSlideIndex = (state.heroSlideIndex + 1) % slides.length;
      render();
    }, HERO_ROTATE_MS);
  }

  let touchStartX = 0;
  carousel.addEventListener("touchstart", (event) => {
    touchStartX = event.touches[0]?.clientX || 0;
  }, { passive: true });
  carousel.addEventListener("touchend", (event) => {
    const touchEndX = event.changedTouches[0]?.clientX || 0;
    const deltaX = touchEndX - touchStartX;
    if (Math.abs(deltaX) < 28) return;
    clearHeroCarousel();
    setHeroSlide(state.heroSlideIndex + (deltaX < 0 ? 1 : -1));
  }, { passive: true });
}

function currentQuestions() {
  if (state.mode === "dual") {
    const hiddenQuestion = getDualEasterQuestion(state.captures.map((capture) => capture.identity));
    return hiddenQuestion ? [...state.questionDeck, hiddenQuestion] : state.questionDeck;
  }
  if (state.questionDeck.length) return state.questionDeck;
  return QUESTIONS[state.mode || "single"];
}

function defaultCaptureLabel(index) {
  if (state.mode === "dual") return index === 0 ? "我" : "TA";
  return "我";
}

function startMode(mode) {
  revokeShareCard();
  state.mode = mode;
  state.step = "capture";
  state.questionDeck = mode === "single" ? shuffleArray(QUESTIONS.single) : [...QUESTIONS.dual];
  state.answers = {};
  state.result = null;
  state.error = "";
  state.cropper = null;
  state.captures = Array.from({ length: getCaptureCount() }, (_, index) => ({
    label: defaultCaptureLabel(index),
    originalDataUrl: "",
    previewUrl: "",
    crop: null,
    features: null,
    detectionSource: "",
    fileName: "",
    identity: "",
  }));
  renderView({ resetScroll: true });
}

function goHome() {
  revokeShareCard();
  state.mode = null;
  state.step = "home";
  state.questionDeck = [];
  state.answers = {};
  state.result = null;
  state.cropper = null;
  state.error = "";
  renderView({ resetScroll: true });
}

function allCapturesReady() {
  return state.captures.length === getCaptureCount() && state.captures.every((capture) => capture?.previewUrl && capture?.features);
}

function requiredQuestionsAnswered() {
  return currentQuestions()
    .filter((question) => question.required)
    .every((question) => Boolean(state.answers[question.id]));
}

function createImageFromSrc(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片无法打开"));
    image.src = src;
  });
}

async function loadNebulae() {
  const params = new URLSearchParams(window.location.search);
  const requestedCatalog = params.get("catalog");
  const datasetPath =
    window.IRIS_UNIVERSE_DATASET ||
    (requestedCatalog === "full" ? "./data/nebulae-full.json" : "./data/nebulae-v1.json");
  const response = await fetch(datasetPath);
  if (!response.ok) {
    throw new Error("星云数据库加载失败");
  }
  return response.json();
}

function captureSummary(capture) {
  if (!capture?.features) return [];
  return [
    `对称度 ${Math.round(capture.features.symmetryScore * 100)}%`,
    `环层 ${capture.features.ringCount} 层`,
    `纹理 ${Math.round(capture.features.textureDensity * 100)}%`,
    `辐射 ${Math.round(capture.features.radialStrength * 100)}%`,
  ];
}

function sanitizeNebulaTitle(titleCn) {
  if (!titleCn) return "";
  const compact = String(titleCn).trim();
  const hasLatin = /[A-Za-z]/.test(compact);
  const isChineseLike = /^[\u4e00-\u9fff路0-9]+$/.test(compact);
  if (hasLatin || !isChineseLike) return "";
  if (compact.length <= 8) return compact;
  if (/(星云|星系|遗迹)$/.test(compact) && compact.length <= 10) return compact;
  return "";
}

function formatReasonList(reasons) {
  return reasons.map((reason) => `<span class="reason-chip">${escapeHtml(reason)}</span>`).join("");
}

function openCropper(index, image, originalDataUrl, fileName, source = "") {
  state.cropper = {
    index,
    image,
    originalDataUrl,
    fileName,
    source,
    circle: { x: 0.5, y: 0.5, radius: 0.24 },
    previewUrl: "",
    status: "准备识别虹膜位置…",
  };
}

async function openStoredCrop(index) {
  const capture = state.captures[index];
  if (!capture?.originalDataUrl) return;
  const image = await createImageFromSrc(capture.originalDataUrl);
  openCropper(index, image, capture.originalDataUrl, capture.fileName, capture.detectionSource);
  state.cropper.circle = capture.crop || { x: 0.5, y: 0.5, radius: 0.24 };
  state.cropper.previewUrl = capture.previewUrl;
  state.cropper.status = capture.detectionSource
    ? `当前裁剪基于${capture.detectionSource === "mediapipe" ? "轻量模型定位" : "启发式定位"}`
    : "你可以继续微调这个圆框。";
  render();
}

async function ingestFile(index, file) {
  if (!file) return;
  try {
    const image = await fileToImage(file);
    const originalDataUrl = image.src;
    const busyStartedAt = performance.now();
    beginBusy({
      mode: "scan",
      text: "正在读取你的眼球纹理与虹膜轮廓，请稍等几秒。",
      previewUrl: originalDataUrl,
      readouts: buildScanReadouts(image, `${file.name}-${index}`),
    });
    render();

    const detected = await detectIrisCircle(image);
    await keepBusyVisible(busyStartedAt);

    openCropper(index, image, originalDataUrl, file.name, detected.source);
    state.cropper.circle = {
      x: clamp(detected.x, 0.18, 0.82),
      y: clamp(detected.y, 0.18, 0.82),
      radius: clamp(detected.radius, 0.14, 0.4),
    };
    state.cropper.status =
      detected.source === "mediapipe"
        ? "已用轻量模型自动定位虹膜，你可以继续微调。"
        : "已用启发式算法估算虹膜位置，你可以继续微调。";
    clearBusy();
    state.error = "";
    render();
  } catch (error) {
    clearBusy();
    state.error = error.message || "图片处理失败";
    setToast(state.error);
    render();
  }
}

function refreshCropPreview() {
  if (!state.cropper) return;
  const canvas = createCropCanvas(state.cropper.image, state.cropper.circle, 320);
  state.cropper.previewUrl = circleToCropPreview(canvas);
}

async function rerunCropDetection() {
  if (!state.cropper) return;
  const busyStartedAt = performance.now();
  beginBusy({
    mode: "scan",
    text: "正在重新扫描你的虹膜轮廓，这次会更认真一点。",
    previewUrl: state.cropper.originalDataUrl || state.cropper.previewUrl || "",
    readouts: buildScanReadouts(state.cropper.image, `${state.cropper.fileName || "recrop"}-${state.cropper.index}`),
  });
  render();

  try {
    const detected = await detectIrisCircle(state.cropper.image);
    await keepBusyVisible(busyStartedAt);
    state.cropper.circle = {
      x: clamp(detected.x, 0.18, 0.82),
      y: clamp(detected.y, 0.18, 0.82),
      radius: clamp(detected.radius, 0.14, 0.4),
    };
    state.cropper.source = detected.source;
    state.cropper.status =
      detected.source === "mediapipe"
        ? "重新用轻量模型定位成功。"
        : "已回退到启发式定位，你仍然可以手动修正。";
    refreshCropPreview();
    clearBusy();
    render();
  } catch (_error) {
    await keepBusyVisible(busyStartedAt);
    clearBusy();
    state.cropper.status = "自动识别失败了，建议直接手动微调。";
    render();
  }
}

function confirmCrop() {
  if (!state.cropper) return;
  const canvas = createCropCanvas(state.cropper.image, state.cropper.circle, 320);
  const previewUrl = circleToCropPreview(canvas);
  const features = extractIrisFeatures(canvas);
  const index = state.cropper.index;
  state.captures[index] = {
    ...state.captures[index],
    label: defaultCaptureLabel(index),
    originalDataUrl: state.cropper.originalDataUrl,
    previewUrl,
    crop: { ...state.cropper.circle },
    features,
    detectionSource: state.cropper.source,
    fileName: state.cropper.fileName,
    identity: state.captures[index].identity || "",
  };
  state.cropper = null;
  state.error = "";
  render();
}

function createSingleVariant(capture, answers, variantMatch, isPrimary = false) {
  return {
    isPrimary,
    match: variantMatch,
    reading: buildSingleReading({
      match: variantMatch,
      userFeatures: capture.features,
      answers,
    }),
  };
}

function updateAnswer(questionId, value) {
  state.answers[questionId] = value;
  render();
}

async function runMatching() {
  state.step = "loading";
  revokeShareCard();
  renderView({ resetScroll: true });
  await new Promise((resolve) => window.setTimeout(resolve, 900));

  if (state.mode === "single") {
    const capture = state.captures[0];
    const match = matchSingle(capture.features, state.answers, state.nebulae);
    const variants = [
      createSingleVariant(capture, state.answers, match, true),
      ...match.alternatives.map(({ nebula, score, matchRate }) =>
        createSingleVariant(capture, state.answers, {
          nebula,
          score,
          matchRate,
          alternatives: [],
          reasonSummary: match.reasonSummary,
        }),
      ),
    ];
    state.result = {
      type: "single",
      capture,
      variants,
      activeVariantIndex: 0,
      match: variants[0].match,
      reading: variants[0].reading,
    };
    incrementGazeCount();
    state.step = "single-result";
  } else {
    const leftCapture = state.captures[0];
    const rightCapture = state.captures[1];
    const leftMatch = matchSingle(leftCapture.features, state.answers, state.nebulae);
    const rightMatch = matchSingle(rightCapture.features, state.answers, state.nebulae);
    const relation = buildDualRelation(leftCapture.features, rightCapture.features, state.answers);
    const reading = buildDualReading({
      relation,
      answers: state.answers,
      leftMatch,
      rightMatch,
      leftFeatures: leftCapture.features,
      rightFeatures: rightCapture.features,
      identities: state.captures.map((capture) => capture.identity),
    });
    state.result = {
      type: "dual",
      leftCapture,
      rightCapture,
      leftMatch,
      rightMatch,
      relation,
      reading,
    };
    incrementGazeCount();
    state.step = "dual-result";
  }
  renderView({ resetScroll: true });
}

async function generateShareCard() {
  if (!state.result) return;
  state.busyText = "正在生成分享卡片…";
  render();
  try {
    revokeShareCard();
    state.shareCard =
      state.result.type === "single"
        ? await generateSingleShareCard(state.result)
        : await generateDualShareCard(state.result);
    state.busyText = "";
    render();
    setToast("分享图已经生成好了");
  } catch (error) {
    state.busyText = "";
    setToast(error.message || "分享图生成失败");
    render();
  }
}

async function copyShareCaption() {
  if (!state.result) return;
  const text = state.result.reading.shareCaption;
  try {
    await navigator.clipboard.writeText(text);
    setToast("结果文案已复制");
  } catch (_error) {
    setToast("复制失败了，可以手动复制结果页文案");
  }
}

function isWeChatBrowser() {
  return /MicroMessenger/i.test(navigator.userAgent);
}

function isTouchDevice() {
  return window.matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

async function downloadShareCard() {
  if (!state.shareCard?.blob) return;
  const fileName = state.result?.type === "dual" ? "iris-universe-dual.jpg" : "iris-universe-single.jpg";
  const file = new File([state.shareCard.blob], fileName, { type: state.shareCard.blob.type || "image/jpeg" });

  if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: "Iris Universe",
        text: state.result?.reading?.shareCaption || "来自虹膜宇宙的分享图",
      });
      setToast("已调起系统分享面板");
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  triggerDownload(state.shareCard.blob, fileName);
  if (isTouchDevice()) {
    setToast(
      isWeChatBrowser()
        ? "如果微信没有直接保存，请长按预览图保存到相册"
        : "如果没有直接存进相册，请在系统弹窗里选择保存图片",
    );
  }
}

function renderHome() {
  const heroSlides = buildHeroSlides();
  const activeIndex = heroSlides.length ? state.heroSlideIndex % heroSlides.length : 0;
  const activeSlide = heroSlides[activeIndex];
  return `
    <section class="panel hero">
      <div>
        <div class="eyebrow">真实星云图片 · 轻量虹膜分析 · 少量测试问题</div>
        <h1>在你的虹膜里，找到属于你的那颗星</h1>
        <p>
          虹膜像指纹一样独一无二，也像宇宙里那些形态各异的星云一样神秘而浪漫。
          这是一个偏浪漫、但过程可解释的虹膜宇宙测试。你上传一张眼睛照片，我们会在浏览器里提取纹理、环层、明暗和色调，
          再把它翻译成一颗最像你的真实星云。你也可以上传两个人的眼睛，看看这段关系在宇宙里更像哪一种轨道。
        </p>
        <div class="mode-grid">
          <button class="mode-card mode-card-launch" data-action="start-mode" data-mode="single">
            <h3>单人模式</h3>
            <p>匹配一颗真实星云，得到主叙事、事业线、爱情线、能量线和来自宇宙深处的寄语。</p>
          </button>
          <button class="mode-card mode-card-launch" data-action="start-mode" data-mode="dual">
            <h3>双人模式</h3>
            <p>分别匹配两颗星云，再计算两个人的默契线、吸引线、成长线和关系称号。</p>
          </button>
        </div>
      </div>
      <aside class="hero-card">
        <div class="hero-carousel" data-hero-carousel>
          <div class="hero-carousel-track" style="transform: translateX(-${activeIndex * 100}%);">
            ${heroSlides
              .map(
                (nebula) => `
                  <figure class="hero-slide">
                    <img src="${nebula.thumb}" alt="${escapeHtml(nebula.titleCn || nebula.titleShort || "星云预览")}" />
                    <figcaption class="hero-slide-caption">
                      <strong>${escapeHtml(nebula.titleCn || nebula.titleShort)}</strong>
                      <span>${escapeHtml(nebula.title)}</span>
                    </figcaption>
                  </figure>
                `,
              )
              .join("")}
          </div>
          <div class="hero-carousel-dots">
            ${heroSlides
              .map(
                (_nebula, index) => `
                  <button
                    class="hero-dot ${index === activeIndex ? "active" : ""}"
                    data-action="set-hero-slide"
                    data-index="${index}"
                    aria-label="切换到第 ${index + 1} 张星云"
                  ></button>
                `,
              )
              .join("")}
          </div>
        </div>
        ${activeSlide ? `<p class="hero-card-note">这些像眼睛一样望回来的真实星云，来自 1995 年以来 NASA 的长期天文影像记录。</p>` : ""}
        <div class="stat-grid">
          <div class="stat-chip">
            <strong>${FULL_NEBULA_COUNT}</strong>
            <span>张来自 NASA 的真实星云照片</span>
          </div>
          <div class="stat-chip">
            <strong>纯前端</strong>
            <span>本地分析，服务器不会采集数据</span>
          </div>
          <div class="stat-chip">
            <strong>${state.gazeCount}</strong>
            <span>次眼睛与星空对望</span>
          </div>
          <div class="stat-chip">
            <strong>3-5 题</strong>
            <span>得到一篇自己的宇宙报告</span>
          </div>
        </div>
      </aside>
    </section>
  `;
}

function renderCapture() {
  const count = getCaptureCount();
  return `
    <section class="capture-layout">
      <article class="panel capture-panel">
        <div class="capture-slot-header">
          <div>
            <div class="eyebrow">${state.mode === "dual" ? "双人关系模式" : "单人星云模式"}</div>
            <h2 class="section-title">${state.mode === "dual" ? "上传两张虹膜照片" : "上传你的虹膜照片"}</h2>
            <p class="section-copy">
              尽量让眼睛靠近镜头，光线均匀，少一点反光。我们会先自动定位虹膜，再让你手动微调圆框，保证移动端也能稳定完成。
            </p>
          </div>
          <button class="ghost-link" data-action="go-home">返回首页</button>
        </div>

        <div class="capture-grid">
          ${Array.from({ length: count }, (_, index) => {
            const capture = state.captures[index];
            const summary = captureSummary(capture);
            const uploadAction = capture.previewUrl ? "replace-upload" : "trigger-upload";
            const uploadCta = capture.previewUrl ? "点这里换一张图" : "点这里上传照片";
            return `
              <div class="capture-slot">
                <div class="row-between">
                  <strong>${index === 0 ? "照片 A" : "照片 B"} · ${capture.label}</strong>
                  ${
                    capture.previewUrl
                      ? `<span class="step-counter">${capture.detectionSource === "mediapipe" ? "模型定位" : capture.detectionSource === "heuristic" ? "启发式定位" : "已完成"}</span>`
                      : `<span class="step-counter">等待上传</span>`
                  }
                </div>
                <button class="capture-preview capture-preview-button" data-action="${uploadAction}" data-index="${index}">
                  ${
                    capture.previewUrl
                      ? `<div class="circle-preview"><img src="${capture.previewUrl}" alt="已裁剪虹膜预览" /></div>
                         <span class="capture-preview-cta">${uploadCta}</span>`
                      : `<div><strong>${escapeHtml(capture.label)}的眼睛</strong><p class="upload-note">支持手机拍摄或相册上传。上传后会立刻进入裁剪微调。</p><span class="capture-preview-cta">${uploadCta}</span></div>`
                  }
                </button>
                ${
                  state.mode === "dual"
                    ? `
                      <div style="margin-top: 14px;">
                        <div class="eyebrow">身份设定 · 仅用于双人彩蛋</div>
                        <div class="pill-row" style="margin-top: 10px;">
                          ${[
                            { value: "male", label: "男生" },
                            { value: "female", label: "女生" },
                            { value: "", label: "不设定" },
                          ]
                            .map(
                              (identityOption) => `
                                <button
                                  class="pill-button ${capture.identity === identityOption.value ? "active" : ""}"
                                  data-action="set-identity"
                                  data-index="${index}"
                                  data-value="${identityOption.value}"
                                >
                                  <span class="option-label">${identityOption.label}</span>
                                </button>
                              `,
                            )
                            .join("")}
                        </div>
                      </div>
                    `
                    : ""
                }
                <input class="file-input" type="file" accept="image/*" data-upload-index="${index}" />
                <div class="inline-actions" style="margin-top: 12px;">
                  ${capture.originalDataUrl ? `<button class="button-ghost" data-action="recrop" data-index="${index}">重新裁剪</button>` : ""}
                  ${capture.previewUrl ? `<button class="button-ghost" data-action="replace-upload" data-index="${index}">换一张图</button>` : ""}
                </div>
                ${summary.length ? `<div class="pill-row" style="margin-top: 14px;">${summary.map((item) => `<span class="answer-chip">${item}</span>`).join("")}</div>` : ""}
              </div>
            `;
          }).join("")}
        </div>

        <div class="inline-actions" style="margin-top: 24px;">
          <button class="button" data-action="go-questions" ${allCapturesReady() ? "" : "disabled"}>继续回答问题</button>
          <button class="button-ghost" data-action="go-home">重新选择模式</button>
        </div>
      </article>

      <aside class="panel side-panel">
        <h3 class="section-title">拍摄提醒</h3>
        <ul class="helper-list">
          <li>只拍一只眼睛，离镜头近一点。</li>
          <li>尽量使用带有近摄或微距能力的手机和镜头。</li>
          <li>尽量在有外置光源或光线充足的环境下拍摄。</li>
          <li>不建议使用闪光灯拍摄，会让眼睛不舒服。</li>
          <li>避免强烈美瞳反光、泪光和睫毛遮挡。</li>
          <li>如果自动定位不准，直接拖动和缩放圆框即可。</li>
          <li>双人模式里，建议两张图都用相近的拍摄距离。</li>
        </ul>
        <details class="expand-card" style="margin-top: 18px;">
          <summary>照片示例</summary>
          <div class="expand-card-body">
            <div class="example-shot">
              <img src="./example.jpg" alt="虹膜拍摄示例" />
            </div>
            <p class="helper-text">尽量参考这种构图：单只眼睛占据画面主体，睫毛和眼白可以保留一点，但不要太远；光线均匀，少反光，别贴得过近导致失焦。</p>
          </div>
        </details>
        <details class="expand-card" style="margin-top: 14px;">
          <summary>常见带近摄 / 微距能力的手机与镜头总结</summary>
          <div class="expand-card-body">
            <p class="helper-text">拍虹膜时，不一定非要“微距模式”才行。对这类眼睛近摄，优先顺序通常是：主摄近一点拍，其次是支持自动对焦的超广角微距，再其次是长焦 close-up；尽量少用畸变特别强的 0.5x 超广角硬怼到眼前。</p>
            <ul class="helper-list helper-list-compact">
              <li>Apple：iPhone 13 Pro / Pro Max 是苹果第一次把微距带进 iPhone；到 iPhone 16 / 16 Plus，普通版也因为超广角支持自动对焦而能拍微距。可以粗暴理解成：13 到 15 代更看 Pro 机型，16 代开始标准版和 Pro 都更适合近拍。</li>
              <li>Samsung：近年的 Galaxy Ultra 机型更适合拍近摄，系统会在贴近时出现 macro 提示；普通 S 系列和部分中端机是否好用，往往取决于超广角有没有自动对焦。</li>
              <li>HUAWEI：很多机型都有 Super Macro，常见工作距离大约在 2.5 到 10 厘米之间；如果系统没自动进入，也可以在相机里手动找 Super Macro。</li>
              <li>Xiaomi / Redmi：不少 Redmi Note 和 Redmi 数字系列会给独立微距镜头，常见推荐距离大约 4 厘米；但不同型号画质差异很大，拍虹膜时还是优先试主摄。</li>
              <li>OPPO：部分旗舰做过很强的微距或显微镜玩法，比如 Find X3 Pro 的 Microlens；如果你用的是 Reno / Find 系列，建议先试主摄，再试系统里的近摄或超广角模式。</li>
              <li>vivo：近年的 ZEISS 合作机型很擅长做 close-up，尤其适合把眼睛拍得更有层次；如果你的机型有长焦 close-up 或人像长焦，拍眼睛往往比硬开超广角更顺。</li>
              <li>HONOR：不少机型把超广角和微距合在一起，比如 2.5cm AF Super Macro 这类路线；如果你用的是较新的数字系列或高端机，可以先看看相机里有没有 Super Macro 提示。</li>
            </ul>
            <p class="helper-text">最稳的实操建议：先把手机默认 1x 主摄打开，靠近到刚好还能清晰对焦的位置，再多拍几张；如果一直糊，再试系统自动跳出来的微距 / 超广角模式。</p>
          </div>
        </details>
        <div class="notice" style="margin-top: 18px;">
          在虹膜宇宙，我们更在意结果的浪漫体验和分享冲击力，所以不会把它包装成严肃生物识别。结果是可解释的视觉翻译，而不是医学或人格诊断。
        </div>
      </aside>
    </section>
  `;
}

function renderQuestions() {
  const questions = currentQuestions();
  const isSingleMode = state.mode !== "dual";
  const questionIntro = isSingleMode
    ? "单人模式有五道问题。"
    : "双人模式默认有三道问题，但有隐藏彩蛋可解锁。";
  return `
    <section class="capture-layout">
      <article class="panel question-panel">
        <div class="capture-slot-header">
          <div>
            <div class="eyebrow">${state.mode === "dual" ? "关系问卷" : "个人问卷"}</div>
            <h2 class="section-title">来自宇宙深处的问题</h2>
            <p class="section-copy">${questionIntro}</p>
          </div>
          <button class="ghost-link" data-action="back-capture">返回上传页</button>
        </div>

        <div class="question-grid">
          ${questions
            .map(
              (question, index) => `
                <section class="question-card">
                  <div class="question-meta">
                    <span class="eyebrow">${escapeHtml(isSingleMode ? `问题 ${index + 1}` : `${question.title}${question.required ? "" : " · 可跳过"}`)}</span>
                    <span class="step-counter">${state.answers[question.id] ? "已选择" : question.required ? "待回答" : "可选"}</span>
                  </div>
                  <p class="question-prompt">${escapeHtml(question.prompt)}</p>
                  <div class="option-grid">
                    ${question.options
                      .map(
                        (option) => `
                          <button
                            class="pill-button ${state.answers[question.id] === option.value ? "active" : ""}"
                            data-action="answer"
                            data-question="${question.id}"
                            data-value="${option.value}"
                          >
                            <span class="option-label">${escapeHtml(option.label)}</span>
                            ${!isSingleMode && option.description ? `<span class="option-desc">${escapeHtml(option.description)}</span>` : ""}
                          </button>
                        `,
                      )
                      .join("")}
                  </div>
                </section>
              `,
            )
            .join("")}
        </div>

        <div class="inline-actions">
          <button class="button" data-action="run-matching" ${requiredQuestionsAnswered() ? "" : "disabled"}>开始匹配星云</button>
          <button class="button-ghost" data-action="back-capture">返回上传页</button>
        </div>
      </article>
    </section>
  `;
}

function renderLoading() {
  return `
    <section class="loading-wrap">
      <article class="panel loading-card">
        <div class="orbits">
          <div class="orbit"></div>
          <div class="orbit orbit-2"></div>
          <div class="orbit orbit-3"></div>
          <div class="core-dot"></div>
        </div>
        <h2 class="section-title">${state.mode === "dual" ? "正在对齐两个人的宇宙轨道…" : "正在寻找属于你的那颗星…"}</h2>
        <p class="section-copy">
          我们正在读取你的虹膜结构、环层感、纹理密度、辐射感和明暗节奏，然后和 ${state.nebulae.length} 张真实星云做本地比对。
        </p>
      </article>
    </section>
  `;
}

function renderSingleResult() {
  const { match, reading, variants = [], activeVariantIndex = 0 } = state.result;
  const variantCards = variants
    .map(
      (variant, index) => `
        <button class="mini-card mini-card-button ${index === activeVariantIndex ? "active" : ""}" data-action="open-single-variant" data-index="${index}">
          <div class="row-between">
            <h4>${escapeHtml(variant.match.nebula.titleCn || variant.match.nebula.titleShort)}</h4>
            <span class="step-counter">${variant.isPrimary ? "主匹配" : "次级"}</span>
          </div>
          <p>${variant.match.matchRate}% 匹配率 · ${escapeHtml(variant.match.nebula.cosmicFact)}</p>
        </button>
      `,
    )
    .join("");

  return `
    <section class="result-layout">
      <article class="panel result-panel">
        <div class="result-heading">
          <div class="result-score">
            <span>匹配率</span>
            <div class="score-bar"><div class="score-fill" style="width:${match.matchRate}%"></div></div>
            <strong>${match.matchRate}%</strong>
          </div>
          <div class="inline-actions">
            ${activeVariantIndex !== 0 ? `<button class="ghost-link" data-action="back-primary-variant">回到主匹配</button>` : ""}
            <button class="ghost-link" data-action="restart">重新开始</button>
          </div>
        </div>

        <div class="result-cover" style="margin-top: 20px;">
          <div class="nebula-frame">
            <img src="${match.nebula.image}" alt="${escapeHtml(match.nebula.titleCn || match.nebula.titleShort)}" />
          </div>
          <div>
            <h2 class="result-title">${escapeHtml(match.nebula.titleCn || match.nebula.titleShort)}</h2>
            <p class="result-subtitle">${escapeHtml(match.nebula.title)} 路 ${escapeHtml(match.nebula.cosmicFact)}</p>
          </div>
        </div>

        <blockquote class="result-quote">${escapeHtml(reading.narrative)}</blockquote>

        <div class="metrics-grid">
          ${reading.metrics
            .map(
              (metric) => `
                <div class="metric-card">
                  <h4>${escapeHtml(metric.label)}</h4>
                  <div class="metric-chip">
                    <strong>${escapeHtml(metric.value)}</strong>
                    <span>${escapeHtml(metric.text)}</span>
                  </div>
                </div>
              `,
            )
            .join("")}
        </div>

        <div class="line-grid">
          ${reading.lines
            .map(
              (line) => `
                <div class="line-card">
                  <h4>${escapeHtml(line.label)}</h4>
                  <p>${escapeHtml(line.text)}</p>
                </div>
              `,
            )
            .join("")}
        </div>

        <div class="result-footer">
          <div class="space-message">${escapeHtml(reading.spaceMessage)}</div>
          <div class="reason-card">
            <h4>为什么会匹配到它</h4>
            <div class="pill-row">${formatReasonList(reading.reasons)}</div>
          </div>
        </div>
      </article>

      <aside class="panel side-panel">
        <h3 class="section-title">适合分享的结果</h3>
        <p class="section-copy">先生成一张 9:16 卡片，可以保存和分享。</p>
        <div class="share-actions" style="margin-top: 18px;">
          <button class="button" data-action="generate-share">生成分享图</button>
          <button class="button-ghost" data-action="copy-caption">复制分享文案</button>
        </div>
        <div class="share-preview" style="margin-top: 18px;">
          ${
            state.shareCard?.url
              ? `
                <div class="share-canvas-wrap"><img src="${state.shareCard.url}" alt="分享图预览" /></div>
                <div class="inline-actions">
                  <button class="button-secondary" data-action="download-share">保存分享图</button>
                </div>
              `
              : `<div class="notice">分享卡还没有生成。生成后会在这里直接预览。</div>`
          }
        </div>
        <div class="notice" style="margin-top: 18px;">
          推荐文案：${escapeHtml(reading.shareCaption)}
        </div>
        ${variantCards ? `<h3 class="section-title" style="margin-top: 26px;">所有匹配候选</h3><div class="stack">${variantCards}</div>` : ""}
      </aside>
    </section>
  `;
}

function renderDualResult() {
  const { leftMatch, rightMatch, relation, reading } = state.result;
  return `
    <section class="result-layout">
      <article class="panel result-panel">
        <div class="result-heading">
          <div class="result-score">
            <span>关系共振</span>
            <div class="score-bar"><div class="score-fill" style="width:${relation.matchRate}%"></div></div>
            <strong>${relation.matchRate}%</strong>
          </div>
          <button class="ghost-link" data-action="restart">重新开始</button>
        </div>

        <div class="metrics-grid" style="margin-top: 20px;">
          <div class="pair-card">
            <div class="nebula-frame"><img src="${leftMatch.nebula.thumb}" alt="${escapeHtml(leftMatch.nebula.titleCn || leftMatch.nebula.titleShort)}" /></div>
            <h4 style="margin-top: 14px;">我 · ${escapeHtml(leftMatch.nebula.titleCn || leftMatch.nebula.titleShort)}</h4>
            <p>${escapeHtml(leftMatch.nebula.cosmicFact)}</p>
          </div>
          <div class="pair-card">
            <div class="nebula-frame"><img src="${rightMatch.nebula.thumb}" alt="${escapeHtml(rightMatch.nebula.titleCn || rightMatch.nebula.titleShort)}" /></div>
            <h4 style="margin-top: 14px;">TA 路 ${escapeHtml(rightMatch.nebula.titleCn || rightMatch.nebula.titleShort)}</h4>
            <p>${escapeHtml(rightMatch.nebula.cosmicFact)}</p>
          </div>
        </div>

        <blockquote class="result-quote">
          <strong style="display:block; margin-bottom: 10px;">${escapeHtml(reading.headline)}</strong>
          <span style="display:block; margin-bottom: 12px; color: rgba(255,255,255,0.72);">${escapeHtml(reading.subtitle)}</span>
          ${escapeHtml(reading.narrative)}
        </blockquote>

        <div class="metrics-grid">
          ${reading.metrics
            .map(
              (metric) => `
                <div class="metric-card">
                  <h4>${escapeHtml(metric.label)}</h4>
                  <div class="metric-chip">
                    <strong>${escapeHtml(metric.value)}</strong>
                    <span>${escapeHtml(metric.text)}</span>
                  </div>
                </div>
              `,
            )
            .join("")}
        </div>

        <div class="line-grid">
          ${reading.lines
            .map(
              (line) => `
                <div class="line-card">
                  <h4>${escapeHtml(line.label)}</h4>
                  <p>${escapeHtml(line.text)}</p>
                </div>
              `,
            )
            .join("")}
        </div>

        <div class="result-footer">
          <div class="space-message">${escapeHtml(relation.cosmicAdvice)}</div>
          <div class="reason-card">
            <h4>这段关系为什么会这样显示</h4>
            <div class="pill-row">${formatReasonList(reading.reasons)}</div>
          </div>
        </div>
      </article>

      <aside class="panel side-panel">
        <h3 class="section-title">关系分享卡</h3>
        <p class="section-copy">双人模式的传播重点不是数值，而是“原来我们在宇宙里像这种关系”。</p>
        <div class="share-actions" style="margin-top: 18px;">
          <button class="button" data-action="generate-share">生成双人分享图</button>
          <button class="button-ghost" data-action="copy-caption">复制分享文案</button>
        </div>
        <div class="share-preview" style="margin-top: 18px;">
          ${
            state.shareCard?.url
              ? `
                <div class="share-canvas-wrap"><img src="${state.shareCard.url}" alt="双人分享图预览" /></div>
                <div class="inline-actions">
                  <button class="button-secondary" data-action="download-share">保存分享图</button>
                </div>
              `
              : `<div class="notice">双人分享图还没有生成。生成后会在这里出现。</div>`
          }
        </div>
        <div class="notice" style="margin-top: 18px;">
          推荐文案：${escapeHtml(reading.shareCaption)}
        </div>
      </aside>
    </section>
  `;
}

function renderBusyBar() {
  if (!state.busyText || state.busyMode === "scan") return "";
  return `<div class="notice" style="margin-top: 18px;">${escapeHtml(state.busyText)}</div>`;
}

function renderBusyOverlay() {
  if (!state.busyText) return "";
  if (state.busyMode === "scan") {
    return `
      <div class="busy-overlay" aria-live="polite" aria-busy="true">
        <div class="busy-card busy-card-scan">
          <div class="scan-shell">
            <div class="scan-visor">
              <div class="scan-visor-frame">
                ${state.busyPreviewUrl ? `<img src="${state.busyPreviewUrl}" alt="正在扫描的眼睛照片" />` : `<div class="scan-fallback-eye"></div>`}
              </div>
              <div class="scan-laser"></div>
              <div class="scan-target scan-target-outer"></div>
              <div class="scan-target scan-target-inner"></div>
            </div>
            <div class="scan-readouts">
              ${state.busyReadouts
                .map(
                  (item, index) => `
                    <div class="scan-chip" style="--scan-delay:${0.24 + index * 0.26}s">
                      <span>${escapeHtml(item.label)}</span>
                      <strong>${escapeHtml(item.value)}</strong>
                    </div>
                  `,
                )
                .join("")}
            </div>
          </div>
          <h3 class="section-title busy-title-scan">正在分析这只眼睛</h3>
          <p class="section-copy">${escapeHtml(state.busyText)}</p>
        </div>
      </div>
    `;
  }
  return `
    <div class="busy-overlay" aria-live="polite" aria-busy="true">
      <div class="busy-card">
        <div class="busy-solar">
          <div class="busy-core"></div>
          <div class="busy-orbit busy-orbit-1"><span class="busy-planet busy-planet-1"></span></div>
          <div class="busy-orbit busy-orbit-2"><span class="busy-planet busy-planet-2"></span></div>
          <div class="busy-orbit busy-orbit-3"><span class="busy-planet busy-planet-3"></span></div>
        </div>
        <h3 class="section-title" style="font-size:1.5rem;">正在读取你的眼睛</h3>
        <p class="section-copy">${escapeHtml(state.busyText)}</p>
      </div>
    </div>
  `;
}

function renderCropperModal() {
  if (!state.cropper) return "";
  return `
    <div class="crop-modal">
      <div class="crop-card">
        <div class="crop-stage"><canvas id="crop-canvas"></canvas></div>
        <aside class="crop-sidebar">
          <div>
            <div class="eyebrow">虹膜微调</div>
            <h3 class="section-title" style="font-size:1.7rem;">拖动圆心，拉动边缘</h3>
            <p class="capture-hint">${escapeHtml(state.cropper.status || "你可以移动圆框并调整大小，让虹膜刚好落在圈里。")}</p>
          </div>
          <div class="crop-preview">
            ${
              state.cropper.previewUrl
                ? `<img src="${state.cropper.previewUrl}" alt="裁剪预览" />`
                : `<div style="display:grid;place-items:center;height:100%;color:var(--muted);">预览将在这里出现</div>`
            }
          </div>
          <div class="stack">
            <button class="button" data-action="confirm-crop">确认这张裁剪</button>
            <button class="button-secondary" data-action="rerun-detection">再试一次自动识别</button>
            <button class="button-ghost" data-action="reset-crop">重置到默认圆框</button>
            <button class="button-ghost" data-action="close-crop">先返回上传页</button>
          </div>
        </aside>
      </div>
    </div>
  `;
}

function renderEmptyState(message) {
  return `
    <section class="empty-state panel">
      <div>
        <h2>${escapeHtml(message)}</h2>
        <p class="section-copy">如果你刚刚刷新了页面，重新回到首页再走一遍流程就可以了。</p>
        <div class="hero-actions" style="justify-content:center;">
          <button class="button" data-action="go-home">回到首页</button>
        </div>
      </div>
    </section>
  `;
}

function render() {
  if (state.cropper) {
    refreshCropPreview();
  }

  const content =
    state.loading
      ? renderLoading()
      : state.step === "home"
        ? renderHome()
        : state.step === "capture"
          ? renderCapture()
          : state.step === "questions"
          ? renderQuestions()
            : state.step === "loading"
              ? renderLoading()
              : state.step === "single-result" && state.result
                ? renderSingleResult()
                : state.step === "dual-result" && state.result
                  ? renderDualResult()
                  : renderEmptyState("当前没有可显示的结果");

  app.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <div class="brand">
          <div class="brand-mark"></div>
          <div class="brand-copy">
            <strong>虹膜宇宙 · Iris Universe</strong>
            <span>真实星云图库 × 纯前端本地分析 × 浪漫可解释结果</span>
          </div>
        </div>
        ${state.mode ? `<button class="ghost-link" data-action="go-home">回到首页</button>` : ""}
      </header>
      ${state.error ? `<div class="notice" style="margin-bottom:18px;">${escapeHtml(state.error)}</div>` : ""}
      ${content}
      ${renderBusyBar()}
      <p class="footer-note">本网站不会保存你的照片、答案或身份信息，但虹膜仍然属于个人隐私，如果你对此在意，请谨慎使用。所有预测、匹配与结果文案都没有科学依据，仅供玩乐、参考与分享。</p>
    </div>
    ${renderCropperModal()}
    ${renderBusyOverlay()}
    ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
  `;

  if (state.cropper) {
    mountCropper();
  } else {
    cropStage = null;
    cropPointer = null;
  }

  if (!state.loading && state.step === "home") {
    mountHomeCarousel();
  } else {
    clearHeroCarousel();
  }
}

function getCanvasImageRect(canvas, image) {
  const dpr = window.devicePixelRatio || 1;
  const bounds = canvas.getBoundingClientRect();
  const width = Math.floor(bounds.width * dpr);
  const height = Math.floor(bounds.height * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const offsetX = (width - drawWidth) / 2;
  const offsetY = (height - drawHeight) / 2;
  return { width, height, scale, drawWidth, drawHeight, offsetX, offsetY };
}

function drawCropCanvas() {
  if (!cropStage || !state.cropper) return;
  const { canvas, image } = cropStage;
  const ctx = canvas.getContext("2d");
  const rect = getCanvasImageRect(canvas, image);
  cropStage.rect = rect;
  const { offsetX, offsetY, drawWidth, drawHeight } = rect;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#040510";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

  const circleX = offsetX + state.cropper.circle.x * drawWidth;
  const circleY = offsetY + state.cropper.circle.y * drawHeight;
  const circleRadius = state.cropper.circle.radius * Math.min(drawWidth, drawHeight);

  ctx.save();
  ctx.fillStyle = "rgba(4, 5, 16, 0.52)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(255, 225, 154, 0.95)";
  ctx.lineWidth = 3 * (window.devicePixelRatio || 1);
  ctx.beginPath();
  ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(143, 212, 255, 0.85)";
  ctx.lineWidth = 1.5 * (window.devicePixelRatio || 1);
  ctx.beginPath();
  ctx.moveTo(circleX - circleRadius, circleY);
  ctx.lineTo(circleX + circleRadius, circleY);
  ctx.moveTo(circleX, circleY - circleRadius);
  ctx.lineTo(circleX, circleY + circleRadius);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 188, 125, 0.95)";
  ctx.beginPath();
  ctx.arc(circleX + circleRadius, circleY, 8 * (window.devicePixelRatio || 1), 0, Math.PI * 2);
  ctx.fill();
}

function pointerToCanvasPosition(event, canvas) {
  const bounds = canvas.getBoundingClientRect();
  const scaleX = canvas.width / bounds.width;
  const scaleY = canvas.height / bounds.height;
  return {
    x: (event.clientX - bounds.left) * scaleX,
    y: (event.clientY - bounds.top) * scaleY,
  };
}

function updateCircleFromPointer(pos) {
  if (!cropStage || !state.cropper || !cropPointer) return;
  const { offsetX, offsetY, drawWidth, drawHeight } = cropStage.rect;
  const minDimension = Math.min(drawWidth, drawHeight);
  if (cropPointer.mode === "move") {
    state.cropper.circle.x = clamp((pos.x - offsetX) / drawWidth, 0.12, 0.88);
    state.cropper.circle.y = clamp((pos.y - offsetY) / drawHeight, 0.12, 0.88);
  } else if (cropPointer.mode === "resize") {
    const dx = pos.x - cropPointer.centerX;
    const dy = pos.y - cropPointer.centerY;
    const radiusPx = Math.hypot(dx, dy);
    state.cropper.circle.radius = clamp(radiusPx / minDimension, 0.12, 0.44);
  }
  drawCropCanvas();
}

function mountCropper() {
  const canvas = document.getElementById("crop-canvas");
  if (!canvas || !state.cropper) return;

  cropStage = {
    canvas,
    image: state.cropper.image,
    rect: null,
  };

  drawCropCanvas();

  const onPointerDown = (event) => {
    const pos = pointerToCanvasPosition(event, canvas);
    const { offsetX, offsetY, drawWidth, drawHeight } = cropStage.rect;
    const centerX = offsetX + state.cropper.circle.x * drawWidth;
    const centerY = offsetY + state.cropper.circle.y * drawHeight;
    const radiusPx = state.cropper.circle.radius * Math.min(drawWidth, drawHeight);
    const delta = Math.hypot(pos.x - centerX, pos.y - centerY);

    cropPointer = {
      mode: Math.abs(delta - radiusPx) < 24 * (window.devicePixelRatio || 1) ? "resize" : "move",
      centerX,
      centerY,
    };
    canvas.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!cropPointer) return;
    updateCircleFromPointer(pointerToCanvasPosition(event, canvas));
  };

  const onPointerUp = (event) => {
    if (!cropPointer) return;
    canvas.releasePointerCapture(event.pointerId);
    cropPointer = null;
    refreshCropPreview();
    render();
  };

  const onResize = () => drawCropCanvas();

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("resize", onResize, { once: true });
}

async function handleAction(action, element) {
  switch (action) {
    case "start-mode":
      startMode(element.dataset.mode);
      break;
    case "go-home":
      goHome();
      break;
    case "go-questions":
      if (allCapturesReady()) {
        state.step = "questions";
        renderView({ resetScroll: true });
      } else {
        setToast("先把需要的照片都裁剪完成");
      }
      break;
    case "set-identity": {
      const index = Number(element.dataset.index);
      state.captures[index] = {
        ...state.captures[index],
        identity: element.dataset.value || "",
      };
      render();
      break;
    }
    case "set-hero-slide":
      clearHeroCarousel();
      setHeroSlide(Number(element.dataset.index));
      break;
    case "back-capture":
      state.step = "capture";
      renderView({ resetScroll: true });
      break;
    case "answer":
      updateAnswer(element.dataset.question, element.dataset.value);
      break;
    case "run-matching":
      if (requiredQuestionsAnswered()) {
        await runMatching();
      } else {
        setToast(state.mode === "dual" ? "先完成必答题" : "先完成全部五道题");
      }
      break;
    case "restart":
      startMode(state.mode || "single");
      break;
    case "open-single-variant": {
      const index = Number(element.dataset.index);
      const variant = state.result?.variants?.[index];
      if (!variant) break;
      revokeShareCard();
      state.result.activeVariantIndex = index;
      state.result.match = variant.match;
      state.result.reading = variant.reading;
      renderView({ resetScroll: true });
      break;
    }
    case "back-primary-variant": {
      const variant = state.result?.variants?.[0];
      if (!variant) break;
      revokeShareCard();
      state.result.activeVariantIndex = 0;
      state.result.match = variant.match;
      state.result.reading = variant.reading;
      renderView({ resetScroll: true });
      break;
    }
    case "generate-share":
      await generateShareCard();
      break;
    case "copy-caption":
      await copyShareCaption();
      break;
    case "download-share":
      await downloadShareCard();
      break;
    case "recrop":
      await openStoredCrop(Number(element.dataset.index));
      break;
    case "replace-upload": {
      const index = Number(element.dataset.index);
      const input = app.querySelector(`input[data-upload-index="${index}"]`);
      if (input) input.click();
      break;
    }
    case "trigger-upload": {
      const index = Number(element.dataset.index);
      const input = app.querySelector(`input[data-upload-index="${index}"]`);
      if (input) input.click();
      break;
    }
    case "confirm-crop":
      confirmCrop();
      break;
    case "rerun-detection":
      await rerunCropDetection();
      break;
    case "reset-crop":
      if (state.cropper) {
        state.cropper.circle = { x: 0.5, y: 0.5, radius: 0.24 };
        state.cropper.status = "已重置到默认圆框。";
        refreshCropPreview();
        render();
      }
      break;
    case "close-crop":
      state.cropper = null;
      render();
      break;
    default:
      break;
  }
}

app.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  if (target.disabled) return;
  try {
    await handleAction(target.dataset.action, target);
  } catch (error) {
    state.error = error.message || "操作失败";
    render();
  }
});

app.addEventListener("change", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (!target.matches("input[data-upload-index]")) return;
  const [file] = target.files || [];
  const index = Number(target.dataset.uploadIndex);
  await ingestFile(index, file);
  target.value = "";
});

async function init() {
  try {
    state.gazeCount = readStoredGazeCount();
    const nebulae = await loadNebulae();
    state.nebulae = nebulae.map((nebula) => ({
      ...nebula,
      titleCn: nebula.titleCn,
    }));
    state.loading = false;
    state.step = "home";
    render();
  } catch (error) {
    state.loading = false;
    state.error = error.message || "初始化失败";
    render();
  }
}

init();





