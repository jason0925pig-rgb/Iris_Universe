const LANGUAGE_STORAGE_KEY = "iris_universe_language";

const SUPPORTED_LANGUAGES = new Set(["zh", "en"]);

function normalizeLanguage(language) {
  const value = String(language || "").toLowerCase();
  if (value.startsWith("zh")) return "zh";
  if (value.startsWith("en")) return "en";
  return "en";
}

function readStoredLanguage() {
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch (_error) {
    return "";
  }
}

function readUrlLanguage() {
  const params = new URLSearchParams(window.location.search);
  const rawQueryLanguage = params.get("lang");
  if (rawQueryLanguage) {
    const queryLanguage = normalizeLanguage(rawQueryLanguage);
    if (SUPPORTED_LANGUAGES.has(queryLanguage)) return queryLanguage;
  }

  const path = window.location.pathname.toLowerCase();
  if (path === "/zh" || path.startsWith("/zh/")) return "zh";
  if (path === "/en" || path.startsWith("/en/")) return "en";
  return "";
}

function detectInitialLanguage() {
  const urlLanguage = readUrlLanguage();
  if (urlLanguage) return urlLanguage;

  const stored = readStoredLanguage();
  if (SUPPORTED_LANGUAGES.has(stored)) return stored;
  return normalizeLanguage(navigator.language || navigator.userLanguage || "en");
}

let currentLanguage = detectInitialLanguage();

export function getLanguage() {
  return currentLanguage;
}

export function isEnglish() {
  return currentLanguage === "en";
}

export function setLanguage(language) {
  currentLanguage = normalizeLanguage(language);
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
  } catch (_error) {
    // Language switching should still work when storage is unavailable.
  }
  document.documentElement.lang = currentLanguage === "zh" ? "zh-CN" : "en";
  return currentLanguage;
}

export function text(zh, en) {
  return currentLanguage === "en" ? en : zh;
}

export function format(template, values = {}) {
  return Object.entries(values).reduce(
    (output, [key, value]) => output.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export function localizeQuestion(question) {
  return {
    ...question,
    title: text(question.title || "", question.titleEn || question.title || ""),
    prompt: text(question.prompt || "", question.promptEn || question.prompt || ""),
    options: (question.options || []).map((option) => ({
      ...option,
      label: text(option.label || "", option.labelEn || option.label || ""),
      description: text(option.description || "", option.descriptionEn || option.description || ""),
    })),
  };
}

export function nebulaName(nebula) {
  if (!nebula) return "";
  return currentLanguage === "en"
    ? nebula.title || nebula.titleShort || nebula.titleCn || ""
    : nebula.titleCn || nebula.titleShort || nebula.title || "";
}

export function nebulaFact(nebula) {
  if (!nebula) return "";
  if (currentLanguage === "zh") return nebula.cosmicFact || "";
  if (nebula.cosmicFactEn) return nebula.cosmicFactEn;
  const name = nebula.title || nebula.titleShort || "this nebula";
  return `${name} is a real NASA deep-sky image; here, its color, structure, and luminous rhythm become the visual anchor for your reading.`;
}

export function nebulaAlt(nebula) {
  return nebulaName(nebula) || text("星云预览", "Nebula preview");
}

setLanguage(currentLanguage);
