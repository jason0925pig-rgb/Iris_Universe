import { fileToImage, detectIrisCircle, createCropCanvas, extractIrisFeatures, circleToCropPreview } from "./analysis.js?v=20260422e";
import { QUESTIONS, buildSingleReading, buildDualReading, getDualEasterQuestion } from "./content.js?v=20260503a";
import { matchSingle, buildDualRelation } from "./matching.js?v=20260503a";
import { generateSingleShareCard, generateDualShareCard, triggerDownload } from "./share.js?v=20260503a";
import { getLanguage, localizeQuestion, nebulaAlt, nebulaFact, nebulaName, setLanguage, text } from "./i18n.js?v=20260503a";

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
  hiddenQuestion: null,
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
  language: getLanguage(),
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
    { label: text("对称率预估", "Symmetry estimate"), value: symmetry.toFixed(2) },
    { label: text("纹理密度", "Texture density"), value: `${Math.round(texture * 100)}%` },
    { label: text("环层信号", "Ring signal"), value: text(`${rings} 层`, `${rings} layers`) },
    { label: text("边缘稳定", "Edge stability"), value: `${Math.round(radial * 100)}%` },
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

function cloneQuestion(question) {
  const localized = localizeQuestion(question);
  return {
    ...localized,
    options: shuffleArray((localized.options || []).map((option) => ({ ...option }))),
  };
}

function buildQuestionDeck(mode) {
  return shuffleArray((QUESTIONS[mode] || QUESTIONS.single).map(cloneQuestion));
}

function getPreparedHiddenQuestion() {
  if (state.mode !== "dual") {
    state.hiddenQuestion = null;
    return null;
  }

  const hiddenTemplate = getDualEasterQuestion(state.captures.map((capture) => capture.identity));
  if (!hiddenTemplate) {
    state.hiddenQuestion = null;
    return null;
  }

  if (!state.hiddenQuestion || state.hiddenQuestion.prompt !== hiddenTemplate.prompt) {
    state.hiddenQuestion = cloneQuestion(hiddenTemplate);
  }

  return state.hiddenQuestion;
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
    const hiddenQuestion = getPreparedHiddenQuestion();
    return hiddenQuestion ? [...state.questionDeck, hiddenQuestion] : state.questionDeck;
  }
  if (state.questionDeck.length) return state.questionDeck;
  return QUESTIONS[state.mode || "single"];
}

function defaultCaptureLabel(index) {
  if (state.mode === "dual") return index === 0 ? text("我", "Me") : "TA";
  return text("我", "Me");
}

function changeLanguage(language) {
  state.language = setLanguage(language);
  state.questionDeck = state.mode ? buildQuestionDeck(state.mode) : [];
  state.hiddenQuestion = null;
  if (state.result) {
    revokeShareCard();
    state.result = null;
    state.step = state.captures.length ? "questions" : "home";
  }
  renderView({ resetScroll: false });
}

function startMode(mode) {
  revokeShareCard();
  state.mode = mode;
  state.step = "capture";
  state.questionDeck = buildQuestionDeck(mode);
  state.hiddenQuestion = null;
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
  state.hiddenQuestion = null;
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
    image.onerror = () => reject(new Error(text("图片无法打开", "The image could not be opened")));
    image.src = src;
  });
}

async function loadNebulae() {
  const params = new URLSearchParams(window.location.search);
  const requestedCatalog = params.get("catalog");
  const datasetPath =
    window.IRIS_UNIVERSE_DATASET ||
    (requestedCatalog === "v1" ? "./data/nebulae-v1.json" : "./data/nebulae-full.json");
  const response = await fetch(datasetPath);
  if (!response.ok) {
    throw new Error(text("星云数据库加载失败", "Failed to load the nebula database"));
  }
  return response.json();
}

function captureSummary(capture) {
  if (!capture?.features) return [];
  return [
    text(`对称度 ${Math.round(capture.features.symmetryScore * 100)}%`, `Symmetry ${Math.round(capture.features.symmetryScore * 100)}%`),
    text(`环层 ${capture.features.ringCount} 层`, `Rings ${capture.features.ringCount}`),
    text(`纹理 ${Math.round(capture.features.textureDensity * 100)}%`, `Texture ${Math.round(capture.features.textureDensity * 100)}%`),
    text(`辐射 ${Math.round(capture.features.radialStrength * 100)}%`, `Radiance ${Math.round(capture.features.radialStrength * 100)}%`),
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
    status: text("准备识别虹膜位置…", "Preparing to locate the iris..."),
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
    ? text(
        `当前裁剪基于${capture.detectionSource === "mediapipe" ? "轻量模型定位" : "启发式定位"}`,
        `Current crop is based on ${capture.detectionSource === "mediapipe" ? "lightweight model detection" : "heuristic detection"}`,
      )
    : text("你可以继续微调这个圆框。", "You can keep adjusting this circle.");
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
      text: text("正在读取你的眼球纹理与虹膜轮廓，请稍等几秒。", "Reading your iris texture and contour. Please wait a few seconds."),
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
        ? text("已用轻量模型自动定位虹膜，你可以继续微调。", "The lightweight model located your iris. You can keep fine-tuning it.")
        : text("已用启发式算法估算虹膜位置，你可以继续微调。", "The iris position was estimated heuristically. You can keep fine-tuning it.");
    clearBusy();
    state.error = "";
    render();
  } catch (error) {
    clearBusy();
    state.error = error.message || text("图片处理失败", "Image processing failed");
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
    text: text("正在重新扫描你的虹膜轮廓，这次会更认真一点。", "Rescanning your iris contour with extra care."),
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
        ? text("重新用轻量模型定位成功。", "The lightweight model located it successfully.")
        : text("已回退到启发式定位，你仍然可以手动修正。", "Fell back to heuristic detection. You can still adjust it manually.");
    refreshCropPreview();
    clearBusy();
    render();
  } catch (_error) {
    await keepBusyVisible(busyStartedAt);
    clearBusy();
    state.cropper.status = text("自动识别失败了，建议直接手动微调。", "Auto-detection failed. Manual adjustment is recommended.");
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
  state.busyText = text("正在生成分享卡片…", "Generating your share card...");
  render();
  try {
    revokeShareCard();
    state.shareCard =
      state.result.type === "single"
        ? await generateSingleShareCard(state.result)
        : await generateDualShareCard(state.result);
    state.busyText = "";
    render();
    setToast(text("分享图已经生成好了", "Your share image is ready"));
  } catch (error) {
    state.busyText = "";
    setToast(error.message || text("分享图生成失败", "Failed to generate the share image"));
    render();
  }
}

async function copyShareCaption() {
  if (!state.result) return;
  const captionText = state.result.reading.shareCaption;
  try {
    await navigator.clipboard.writeText(captionText);
    setToast(text("结果文案已复制", "Caption copied"));
  } catch (_error) {
    setToast(text("复制失败了，可以手动复制结果页文案", "Copy failed. You can copy the result text manually."));
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
        text: state.result?.reading?.shareCaption || text("来自虹膜宇宙的分享图", "A share image from Iris Universe"),
      });
      setToast(text("已调起系统分享面板", "System share panel opened"));
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  triggerDownload(state.shareCard.blob, fileName);
  if (isTouchDevice()) {
    setToast(
      isWeChatBrowser()
        ? text("如果微信没有直接保存，请长按预览图保存到相册", "If WeChat does not save it directly, long-press the preview to save it.")
        : text("如果没有直接存进相册，请在系统弹窗里选择保存图片", "If it is not saved directly, choose Save Image in the system dialog."),
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
        <div class="eyebrow">${text("真实星云图片 · 轻量虹膜分析 · 少量测试问题", "Real NASA imagery · Lightweight iris analysis · A few cosmic questions")}</div>
        <h1>${text("在你的虹膜里，找到属于你的那颗星", "Find the nebula hidden in your iris")}</h1>
        <p>
          ${text(
            "虹膜像指纹一样独一无二，也像宇宙里那些形态各异的星云一样神秘而浪漫。这是一个偏浪漫、但过程可解释的虹膜宇宙测试。你上传一张眼睛照片，我们会在浏览器里提取纹理、环层、明暗和色调，再把它翻译成一颗最像你的真实星云。你也可以上传两个人的眼睛，看看这段关系在宇宙里更像哪一种轨道。",
            "Your iris is as unique as a fingerprint, and as mysterious as the nebulae scattered across deep space. Iris Universe is a romantic but explainable browser-based test: upload an eye photo, and the page reads texture, rings, contrast, and color locally, then translates them into a real NASA nebula. You can also upload two eyes and see what kind of orbit the relationship resembles.",
          )}
        </p>
        <div class="mode-grid">
          <button class="mode-card mode-card-launch" data-action="start-mode" data-mode="single">
            <h3>${text("单人模式", "Solo Mode")}</h3>
            <p>${text("匹配一颗真实星云，得到主叙事、事业线、爱情线、能量线和来自宇宙深处的寄语。", "Match with a real nebula and receive a personal cosmic report: your main reading, Career Line, Love Line, Energy Line, and a message from deep space.")}</p>
          </button>
          <button class="mode-card mode-card-launch" data-action="start-mode" data-mode="dual">
            <h3>${text("双人模式", "Dual Mode")}</h3>
            <p>${text("分别匹配两颗星云，再计算两个人的默契线、吸引线、成长线和关系称号。", "Match two eyes to two nebulae, then calculate your Tacit Line, Attraction Line, Growth Line, and relationship title.")}</p>
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
                    <img src="${nebula.thumb}" alt="${escapeHtml(nebulaAlt(nebula))}" />
                    <figcaption class="hero-slide-caption">
                      <strong>${escapeHtml(nebulaName(nebula))}</strong>
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
                    aria-label="${text(`切换到第 ${index + 1} 张星云`, `Switch to nebula ${index + 1}`)}"
                  ></button>
                `,
              )
              .join("")}
          </div>
        </div>
        ${activeSlide ? `<p class="hero-card-note">${text("这些像眼睛一样望回来的真实星云，来自 1995 年以来 NASA 的长期天文影像记录。", "These real nebulae that seem to gaze back like eyes come from NASA's long-running astronomical image archive since 1995.")}</p>` : ""}
        <div class="stat-grid">
          <div class="stat-chip">
            <strong>${FULL_NEBULA_COUNT}</strong>
            <span>${text("张来自 NASA 的真实星云照片", "real NASA nebula images")}</span>
          </div>
          <div class="stat-chip">
            <strong>${text("纯前端", "Local First")}</strong>
            <span>${text("本地分析，服务器不会采集数据", "Browser analysis; the server does not collect your data")}</span>
          </div>
          <div class="stat-chip">
            <strong>${text("免费测试", "Free Test")}</strong>
            <span>${text("双人模式里还藏着一些隐藏彩蛋", "Dual Mode includes hidden easter eggs")}</span>
          </div>
          <div class="stat-chip">
            <strong>${text("5-8 题", "5-8 Questions")}</strong>
            <span>${text("得到一篇自己的宇宙报告", "Receive your own cosmic report")}</span>
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
            <div class="eyebrow">${state.mode === "dual" ? text("双人关系模式", "Dual Relationship Mode") : text("单人星云模式", "Solo Nebula Mode")}</div>
            <h2 class="section-title">${state.mode === "dual" ? text("上传两张虹膜照片", "Upload two iris photos") : text("上传你的虹膜照片", "Upload your iris photo")}</h2>
            <p class="section-copy">
              ${text("尽量让眼睛靠近镜头，光线均匀，少一点反光。我们会先自动定位虹膜，再让你手动微调圆框，保证移动端也能稳定完成。", "Keep the eye close to the camera with even light and minimal reflection. We will auto-locate the iris first, then let you fine-tune the circle manually so it works smoothly on mobile.")}
            </p>
          </div>
          <button class="ghost-link" data-action="go-home">${text("返回首页", "Home")}</button>
        </div>

        <div class="capture-grid">
          ${Array.from({ length: count }, (_, index) => {
            const capture = state.captures[index];
            const summary = captureSummary(capture);
            const uploadAction = capture.previewUrl ? "replace-upload" : "trigger-upload";
            const uploadCta = capture.previewUrl ? text("点这里换一张图", "Tap to replace") : text("点这里上传照片", "Tap to upload");
            return `
              <div class="capture-slot">
                <div class="row-between">
                  <strong>${index === 0 ? text("照片 A", "Photo A") : text("照片 B", "Photo B")} · ${capture.label}</strong>
                  ${
                    capture.previewUrl
                      ? `<span class="step-counter">${capture.detectionSource === "mediapipe" ? text("模型定位", "Model located") : capture.detectionSource === "heuristic" ? text("启发式定位", "Heuristic located") : text("已完成", "Ready")}</span>`
                      : `<span class="step-counter">${text("等待上传", "Waiting")}</span>`
                  }
                </div>
                <button class="capture-preview capture-preview-button" data-action="${uploadAction}" data-index="${index}">
                  ${
                    capture.previewUrl
                      ? `<div class="circle-preview"><img src="${capture.previewUrl}" alt="${text("已裁剪虹膜预览", "Cropped iris preview")}" /></div>
                         <span class="capture-preview-cta">${uploadCta}</span>`
                      : `<div><strong>${escapeHtml(capture.label)}${text("的眼睛", "'s eye")}</strong><p class="upload-note">${text("支持手机拍摄或相册上传。上传后会立刻进入裁剪微调。", "Camera capture and album upload are both supported. After upload, you will enter crop adjustment.")}</p><span class="capture-preview-cta">${uploadCta}</span></div>`
                  }
                </button>
                ${
                  state.mode === "dual"
                    ? `
                      <div style="margin-top: 14px;">
                        <div class="eyebrow">${text("身份设定 · 仅用于双人彩蛋", "Identity setting · only for dual easter eggs")}</div>
                        <div class="pill-row" style="margin-top: 10px;">
                          ${[
                            { value: "male", label: text("男生", "Male") },
                            { value: "female", label: text("女生", "Female") },
                            { value: "", label: text("不设定", "Unset") },
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
                  ${capture.originalDataUrl ? `<button class="button-ghost" data-action="recrop" data-index="${index}">${text("重新裁剪", "Recrop")}</button>` : ""}
                  ${capture.previewUrl ? `<button class="button-ghost" data-action="replace-upload" data-index="${index}">${text("换一张图", "Replace")}</button>` : ""}
                </div>
                ${summary.length ? `<div class="pill-row" style="margin-top: 14px;">${summary.map((item) => `<span class="answer-chip">${item}</span>`).join("")}</div>` : ""}
              </div>
            `;
          }).join("")}
        </div>

        <div class="inline-actions" style="margin-top: 24px;">
          <button class="button" data-action="go-questions" ${allCapturesReady() ? "" : "disabled"}>${text("继续回答问题", "Continue to questions")}</button>
          <button class="button-ghost" data-action="go-home">${text("重新选择模式", "Choose mode again")}</button>
        </div>
      </article>

      <aside class="panel side-panel">
        <h3 class="section-title">${text("拍摄提醒", "Photo Tips")}</h3>
        <ul class="helper-list">
          <li>${text("只拍一只眼睛，离镜头近一点。", "Photograph one eye only, close to the camera.")}</li>
          <li>${text("尽量使用带有近摄或微距能力的手机和镜头。", "Use a phone or lens with close-up or macro capability if possible.")}</li>
          <li>${text("尽量在有外置光源或光线充足的环境下拍摄。", "Shoot in bright, even light or with an external light source.")}</li>
          <li>${text("不建议使用闪光灯拍摄，会让眼睛不舒服。", "Avoid flash; it can be uncomfortable for the eye.")}</li>
          <li>${text("避免强烈美瞳反光、泪光和睫毛遮挡。", "Avoid strong contact-lens glare, tears, and heavy eyelash blockage.")}</li>
          <li>${text("如果自动定位不准，直接拖动和缩放圆框即可。", "If auto-detection is off, drag and resize the circle manually.")}</li>
          <li>${text("双人模式里，建议两张图都用相近的拍摄距离。", "In Dual Mode, keep both photos at a similar shooting distance.")}</li>
        </ul>
        <details class="expand-card" style="margin-top: 18px;">
          <summary>${text("照片示例", "Photo example")}</summary>
          <div class="expand-card-body">
            <div class="example-shot">
              <img src="./example.jpg" alt="${text("虹膜拍摄示例", "Iris photo example")}" />
            </div>
            <p class="helper-text">${text("尽量参考这种构图：单只眼睛占据画面主体，睫毛和眼白可以保留一点，但不要太远；光线均匀，少反光，别贴得过近导致失焦。", "Try this kind of framing: one eye fills most of the image, with a little eyelash and sclera allowed. Keep lighting even, reflections low, and avoid getting so close that focus is lost.")}</p>
          </div>
        </details>
        <details class="expand-card" style="margin-top: 14px;">
          <summary>${text("常见带近摄 / 微距能力的手机与镜头总结", "Phones and lenses with close-up / macro capability")}</summary>
          <div class="expand-card-body">
            <p class="helper-text">${text("拍虹膜时，不一定非要“微距模式”才行。对这类眼睛近摄，优先顺序通常是：主摄近一点拍，其次是支持自动对焦的超广角微距，再其次是长焦 close-up；尽量少用畸变特别强的 0.5x 超广角硬怼到眼前。", "You do not always need a formal macro mode. For eye close-ups, usually try the main camera first, then an autofocus ultra-wide macro mode, then telephoto close-up. Avoid forcing a highly distorted 0.5x ultra-wide lens too close to the eye.")}</p>
            <ul class="helper-list helper-list-compact">
              <li>${text("Apple：iPhone 13 Pro / Pro Max 是苹果第一次把微距带进 iPhone；到 iPhone 16 / 16 Plus，普通版也因为超广角支持自动对焦而能拍微距。可以粗暴理解成：13 到 15 代更看 Pro 机型，16 代开始标准版和 Pro 都更适合近拍。", "Apple: iPhone 13 Pro / Pro Max first brought macro to iPhone. By iPhone 16 / 16 Plus, standard models can also shoot macro thanks to autofocus ultra-wide lenses. Roughly: 13-15 generations favor Pro models; from 16 onward, both standard and Pro are better for close-ups.")}</li>
              <li>${text("Samsung：近年的 Galaxy Ultra 机型更适合拍近摄，系统会在贴近时出现 macro 提示；普通 S 系列和部分中端机是否好用，往往取决于超广角有没有自动对焦。", "Samsung: recent Galaxy Ultra models are stronger for close-ups and often show a macro prompt when you move close. For standard S models and midrange phones, performance often depends on whether the ultra-wide lens has autofocus.")}</li>
              <li>${text("HUAWEI：很多机型都有 Super Macro，常见工作距离大约在 2.5 到 10 厘米之间；如果系统没自动进入，也可以在相机里手动找 Super Macro。", "HUAWEI: many models include Super Macro, often working around 2.5 to 10 cm. If it does not switch automatically, look for Super Macro manually in the camera app.")}</li>
              <li>${text("Xiaomi / Redmi：不少 Redmi Note 和 Redmi 数字系列会给独立微距镜头，常见推荐距离大约 4 厘米；但不同型号画质差异很大，拍虹膜时还是优先试主摄。", "Xiaomi / Redmi: many Redmi Note and Redmi numbered models include a dedicated macro lens, often around a 4 cm recommended distance. Quality varies a lot, so try the main camera first for iris shots.")}</li>
              <li>${text("OPPO：部分旗舰做过很强的微距或显微镜玩法，比如 Find X3 Pro 的 Microlens；如果你用的是 Reno / Find 系列，建议先试主摄，再试系统里的近摄或超广角模式。", "OPPO: some flagships have strong macro or microscope-style modes, such as the Find X3 Pro Microlens. On Reno / Find phones, try the main camera first, then the built-in close-up or ultra-wide mode.")}</li>
              <li>${text("vivo：近年的 ZEISS 合作机型很擅长做 close-up，尤其适合把眼睛拍得更有层次；如果你的机型有长焦 close-up 或人像长焦，拍眼睛往往比硬开超广角更顺。", "vivo: recent ZEISS collaboration models are good at close-ups and can capture more layered eye images. If your phone has telephoto close-up or portrait telephoto, it may work better than forcing ultra-wide.")}</li>
              <li>${text("HONOR：不少机型把超广角和微距合在一起，比如 2.5cm AF Super Macro 这类路线；如果你用的是较新的数字系列或高端机，可以先看看相机里有没有 Super Macro 提示。", "HONOR: many models combine ultra-wide and macro, such as 2.5 cm AF Super Macro. On newer number-series or flagship phones, check whether the camera app shows a Super Macro prompt.")}</li>
            </ul>
            <p class="helper-text">${text("最稳的实操建议：先把手机默认 1x 主摄打开，靠近到刚好还能清晰对焦的位置，再多拍几张；如果一直糊，再试系统自动跳出来的微距 / 超广角模式。", "Most reliable workflow: start with the default 1x main camera, move close until focus still holds, and take several shots. If it stays blurry, then try the phone's automatic macro / ultra-wide mode.")}</p>
          </div>
        </details>
        <div class="notice" style="margin-top: 18px;">
          ${text("在虹膜宇宙，我们更在意结果的浪漫体验和分享冲击力，所以不会把它包装成严肃生物识别。结果是可解释的视觉翻译，而不是医学或人格诊断。", "Iris Universe is built for romantic experience and shareable visual impact, not serious biometric identification. The result is an explainable visual translation, not medical or personality diagnosis.")}
        </div>
      </aside>
    </section>
  `;
}

function renderQuestions() {
  const questions = currentQuestions();
  const isSingleMode = state.mode !== "dual";
  const questionIntro = isSingleMode
    ? text(`单人模式现在有 ${QUESTIONS.single.length} 道必答题。`, `Solo Mode has ${QUESTIONS.single.length} required questions.`)
    : text(`双人模式现在有 ${QUESTIONS.dual.length} 道必答题，另外仍然可能解锁隐藏彩蛋。`, `Dual Mode has ${QUESTIONS.dual.length} required questions, with possible hidden easter eggs.`);
  return `
    <section class="capture-layout">
      <article class="panel question-panel">
        <div class="capture-slot-header">
          <div>
            <div class="eyebrow">${state.mode === "dual" ? text("关系问卷", "Relationship Questions") : text("个人问卷", "Personal Questions")}</div>
            <h2 class="section-title">${text("来自宇宙深处的问题", "Questions from deep space")}</h2>
            <p class="section-copy">${questionIntro}</p>
          </div>
          <button class="ghost-link" data-action="back-capture">${text("返回上传页", "Back to upload")}</button>
        </div>

        <div class="question-grid">
          ${questions
            .map(
              (question, index) => `
                <section class="question-card">
                  <div class="question-meta">
                    <span class="eyebrow">${escapeHtml(text(`问题 ${index + 1}`, `Question ${index + 1}`))}</span>
                    <span class="step-counter">${state.answers[question.id] ? text("已选择", "Selected") : question.required ? text("待回答", "Required") : text("可选", "Optional")}</span>
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
          <button class="button" data-action="run-matching" ${requiredQuestionsAnswered() ? "" : "disabled"}>${text("开始匹配星云", "Start nebula matching")}</button>
          <button class="button-ghost" data-action="back-capture">${text("返回上传页", "Back to upload")}</button>
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
        <h2 class="section-title">${state.mode === "dual" ? text("正在对齐两个人的宇宙轨道…", "Aligning two cosmic orbits...") : text("正在寻找属于你的那颗星…", "Searching for your nebula...")}</h2>
        <p class="section-copy">
          ${text(`我们正在读取你的虹膜结构、环层感、纹理密度、辐射感和明暗节奏，然后和 ${state.nebulae.length} 张真实星云做本地比对。`, `We are reading iris structure, ring signal, texture density, radiance, and contrast rhythm, then comparing them locally with ${state.nebulae.length} real nebula images.`)}
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
            <h4>${escapeHtml(nebulaName(variant.match.nebula))}</h4>
            <span class="step-counter">${variant.isPrimary ? text("主匹配", "Primary") : text("次级", "Alternate")}</span>
          </div>
          <p>${variant.match.matchRate}% ${text("匹配率", "match")} · ${escapeHtml(nebulaFact(variant.match.nebula))}</p>
        </button>
      `,
    )
    .join("");

  return `
    <section class="result-layout">
      <article class="panel result-panel">
        <div class="result-heading">
          <div class="result-score">
            <span>${text("匹配率", "Match")}</span>
            <div class="score-bar"><div class="score-fill" style="width:${match.matchRate}%"></div></div>
            <strong>${match.matchRate}%</strong>
          </div>
          <div class="inline-actions">
            ${activeVariantIndex !== 0 ? `<button class="ghost-link" data-action="back-primary-variant">${text("回到主匹配", "Back to primary")}</button>` : ""}
            <button class="ghost-link" data-action="restart">${text("重新开始", "Restart")}</button>
          </div>
        </div>

        <div class="result-cover" style="margin-top: 20px;">
          <div class="nebula-frame">
            <img src="${match.nebula.image}" alt="${escapeHtml(nebulaAlt(match.nebula))}" />
          </div>
          <div>
            <h2 class="result-title">${escapeHtml(nebulaName(match.nebula))}</h2>
            <p class="result-subtitle">${escapeHtml(match.nebula.title)} · ${escapeHtml(nebulaFact(match.nebula))}</p>
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
            <h4>${text("为什么会匹配到它", "Why this match appears")}</h4>
            <div class="pill-row">${formatReasonList(reading.reasons)}</div>
          </div>
        </div>
      </article>

      <aside class="panel side-panel">
        <h3 class="section-title">${text("适合分享的结果", "Shareable Result")}</h3>
        <p class="section-copy">${text("先生成一张 9:16 卡片，可以保存和分享。", "Generate a 9:16 card first, then save or share it.")}</p>
        <div class="share-actions" style="margin-top: 18px;">
          <button class="button" data-action="generate-share">${text("生成分享图", "Generate card")}</button>
          <button class="button-ghost" data-action="copy-caption">${text("复制分享文案", "Copy caption")}</button>
        </div>
        <div class="share-preview" style="margin-top: 18px;">
          ${
            state.shareCard?.url
              ? `
                <div class="share-canvas-wrap"><img src="${state.shareCard.url}" alt="${text("分享图预览", "Share card preview")}" /></div>
                <div class="inline-actions">
                  <button class="button-secondary" data-action="download-share">${text("保存分享图", "Save card")}</button>
                </div>
              `
              : `<div class="notice">${text("分享卡还没有生成。生成后会在这里直接预览。", "The share card has not been generated yet. It will preview here.")}</div>`
          }
        </div>
        <div class="notice" style="margin-top: 18px;">
          ${text("推荐文案：", "Suggested caption: ")}${escapeHtml(reading.shareCaption)}
        </div>
        ${variantCards ? `<h3 class="section-title" style="margin-top: 26px;">${text("所有匹配候选", "All match candidates")}</h3><div class="stack">${variantCards}</div>` : ""}
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
            <span>${text("关系共振", "Resonance")}</span>
            <div class="score-bar"><div class="score-fill" style="width:${relation.matchRate}%"></div></div>
            <strong>${relation.matchRate}%</strong>
          </div>
          <button class="ghost-link" data-action="restart">${text("重新开始", "Restart")}</button>
        </div>

        <div class="metrics-grid" style="margin-top: 20px;">
          <div class="pair-card">
            <div class="nebula-frame"><img src="${leftMatch.nebula.thumb}" alt="${escapeHtml(nebulaAlt(leftMatch.nebula))}" /></div>
            <h4 style="margin-top: 14px;">${text("我", "Me")} · ${escapeHtml(nebulaName(leftMatch.nebula))}</h4>
            <p>${escapeHtml(nebulaFact(leftMatch.nebula))}</p>
          </div>
          <div class="pair-card">
            <div class="nebula-frame"><img src="${rightMatch.nebula.thumb}" alt="${escapeHtml(nebulaAlt(rightMatch.nebula))}" /></div>
            <h4 style="margin-top: 14px;">TA · ${escapeHtml(nebulaName(rightMatch.nebula))}</h4>
            <p>${escapeHtml(nebulaFact(rightMatch.nebula))}</p>
          </div>
        </div>

        <blockquote class="result-quote">
          <strong class="relationship-badge">${escapeHtml(reading.headline)}</strong>
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
            <h4>${text("这段关系为什么会这样显示", "Why this relationship appears this way")}</h4>
            <div class="pill-row">${formatReasonList(reading.reasons)}</div>
          </div>
        </div>
      </article>

      <aside class="panel side-panel">
        <h3 class="section-title">${text("关系分享卡", "Relationship Share Card")}</h3>
        <p class="section-copy">${text("双人模式的传播重点不是数值，而是“原来我们在宇宙里像这种关系”。", "Dual Mode is not about the number; it is about realizing, 'so this is what we look like in the universe.'")}</p>
        <div class="share-actions" style="margin-top: 18px;">
          <button class="button" data-action="generate-share">${text("生成双人分享图", "Generate dual card")}</button>
          <button class="button-ghost" data-action="copy-caption">${text("复制分享文案", "Copy caption")}</button>
        </div>
        <div class="share-preview" style="margin-top: 18px;">
          ${
            state.shareCard?.url
              ? `
                <div class="share-canvas-wrap"><img src="${state.shareCard.url}" alt="${text("双人分享图预览", "Dual share card preview")}" /></div>
                <div class="inline-actions">
                  <button class="button-secondary" data-action="download-share">${text("保存分享图", "Save card")}</button>
                </div>
              `
              : `<div class="notice">${text("双人分享图还没有生成。生成后会在这里出现。", "The dual share card has not been generated yet. It will appear here.")}</div>`
          }
        </div>
        <div class="notice" style="margin-top: 18px;">
          ${text("推荐文案：", "Suggested caption: ")}${escapeHtml(reading.shareCaption)}
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
                ${state.busyPreviewUrl ? `<img src="${state.busyPreviewUrl}" alt="${text("正在扫描的眼睛照片", "Eye photo being scanned")}" />` : `<div class="scan-fallback-eye"></div>`}
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
          <h3 class="section-title busy-title-scan">${text("正在分析这只眼睛", "Analyzing this eye")}</h3>
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
        <h3 class="section-title" style="font-size:1.5rem;">${text("正在读取你的眼睛", "Reading your eye")}</h3>
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
            <div class="eyebrow">${text("虹膜微调", "Iris Fine-Tuning")}</div>
            <h3 class="section-title" style="font-size:1.7rem;">${text("拖动圆心，拉动边缘", "Drag the center, resize the edge")}</h3>
            <p class="capture-hint">${escapeHtml(state.cropper.status || text("你可以移动圆框并调整大小，让虹膜刚好落在圈里。", "Move and resize the circle until the iris sits inside it."))}</p>
          </div>
          <div class="crop-preview">
            ${
              state.cropper.previewUrl
                ? `<img src="${state.cropper.previewUrl}" alt="${text("裁剪预览", "Crop preview")}" />`
                : `<div style="display:grid;place-items:center;height:100%;color:var(--muted);">${text("预览将在这里出现", "Preview will appear here")}</div>`
            }
          </div>
          <div class="stack">
            <button class="button" data-action="confirm-crop">${text("确认这张裁剪", "Confirm this crop")}</button>
            <button class="button-secondary" data-action="rerun-detection">${text("再试一次自动识别", "Try auto-detect again")}</button>
            <button class="button-ghost" data-action="reset-crop">${text("重置到默认圆框", "Reset circle")}</button>
            <button class="button-ghost" data-action="close-crop">${text("先返回上传页", "Back to upload")}</button>
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
        <p class="section-copy">${text("如果你刚刚刷新了页面，重新回到首页再走一遍流程就可以了。", "If you just refreshed the page, return home and start the flow again.")}</p>
        <div class="hero-actions" style="justify-content:center;">
          <button class="button" data-action="go-home">${text("回到首页", "Back home")}</button>
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
                  : renderEmptyState(text("当前没有可显示的结果", "No result is available right now"));

  app.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <div class="brand">
          <div class="brand-mark"></div>
          <div class="brand-copy">
            <strong>${text("虹膜宇宙 · Iris Universe", "Iris Universe")}</strong>
            <span>${text("真实星云图库 × 纯前端本地分析 × 浪漫可解释结果", "Real NASA nebulae × local browser analysis × romantic explainable results")}</span>
          </div>
        </div>
        <div class="header-actions">
          <label class="language-select">
            <span>${text("语言", "Language")}</span>
            <select data-action="change-language">
              <option value="zh" ${state.language === "zh" ? "selected" : ""}>中文</option>
              <option value="en" ${state.language === "en" ? "selected" : ""}>English</option>
            </select>
          </label>
          ${state.mode ? `<button class="ghost-link" data-action="go-home">${text("回到首页", "Home")}</button>` : ""}
        </div>
      </header>
      ${state.error ? `<div class="notice" style="margin-bottom:18px;">${escapeHtml(state.error)}</div>` : ""}
      ${content}
      ${renderBusyBar()}
      <p class="footer-note">${text("本网站不会保存你的照片、答案或身份信息，但虹膜仍然属于个人隐私，如果你对此在意，请谨慎使用。所有预测、匹配与结果文案都没有科学依据，仅供玩乐、参考与分享。", "This website does not save your photos, answers, or identity information. However, iris images are still personal privacy, so please use with care if that concerns you. All predictions, matches, and readings have no scientific basis and are for fun, reference, and sharing only.")}</p>
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
    case "change-language":
      changeLanguage(element.value);
      break;
    case "go-home":
      goHome();
      break;
    case "go-questions":
      if (allCapturesReady()) {
        state.step = "questions";
        renderView({ resetScroll: true });
      } else {
        setToast(text("先把需要的照片都裁剪完成", "Please finish cropping the required photos first."));
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
        setToast(state.mode === "dual" ? text("先完成必答题", "Please finish the required questions first.") : text("先完成全部五道题", "Please finish all required questions first."));
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
        state.cropper.status = text("已重置到默认圆框。", "Reset to the default circle.");
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
  if (event.target instanceof HTMLSelectElement) return;
  const target = event.target.closest("[data-action]");
  if (!target) return;
  if (target.disabled) return;
  try {
    await handleAction(target.dataset.action, target);
  } catch (error) {
    state.error = error.message || text("操作失败", "Operation failed");
    render();
  }
});

app.addEventListener("change", async (event) => {
  const target = event.target;
  if (target instanceof HTMLSelectElement && target.matches("select[data-action='change-language']")) {
    changeLanguage(target.value);
    return;
  }
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
    state.error = error.message || text("初始化失败", "Initialization failed");
    render();
  }
}

init();





