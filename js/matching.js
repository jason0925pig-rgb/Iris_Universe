import { buildFeatureReasonSummary } from "./content.js?v=20260503a";
import { text } from "./i18n.js?v=20260503a";

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function histogramIntersection(left, right) {
  const length = Math.min(left.length, right.length);
  let total = 0;
  for (let idx = 0; idx < length; idx += 1) {
    total += Math.min(left[idx], right[idx]);
  }
  return clamp(total);
}

function closeness(a, b, spread = 1) {
  return clamp(1 - Math.abs(a - b) / spread);
}

function ringCloseness(a, b) {
  return clamp(1 - Math.min(4, Math.abs(a - b)) / 4);
}

function hasTag(collection, tag) {
  return Array.isArray(collection) && collection.includes(tag);
}

function nebulaFamilyKey(nebula) {
  return (nebula.titleCn || nebula.titleShort || nebula.title || nebula.id || "").trim().toLowerCase();
}

function questionBonus(nebula, answers) {
  let bonus = 0;
  if (!answers) return bonus;

  if (answers.habitat === "core") {
    if (hasTag(nebula.moodTags, "expansive")) bonus += 0.014;
    if (nebula.radial_strength >= 0.54) bonus += 0.01;
    if (nebula.contrast_level >= 0.58) bonus += 0.008;
  }
  if (answers.habitat === "frontier") {
    if (hasTag(nebula.shapeTags, "defined")) bonus += 0.012;
    if (nebula.symmetry_score >= 0.66) bonus += 0.012;
    if (nebula.edge_softness >= 0.56) bonus += 0.008;
  }
  if (answers.habitat === "blackhole") {
    if (hasTag(nebula.moodTags, "complex")) bonus += 0.014;
    if (nebula.contrast_level_label === "high") bonus += 0.012;
    if (nebula.texture_density >= 0.6) bonus += 0.008;
  }
  if (answers.habitat === "nebula") {
    if (hasTag(nebula.moodTags, "dreamlike")) bonus += 0.014;
    if (hasTag(nebula.shapeTags, "diffuse")) bonus += 0.01;
    if (nebula.edge_softness >= 0.58) bonus += 0.008;
  }

  if (answers.planet === "sun") {
    if (nebula.contrast_level_label === "high") bonus += 0.012;
    if (nebula.radial_strength >= 0.56) bonus += 0.01;
    if (hasTag(nebula.moodTags, "expansive")) bonus += 0.008;
  }
  if (answers.planet === "earth") {
    if (nebula.edge_softness >= 0.58) bonus += 0.012;
    if (nebula.symmetry_score >= 0.62) bonus += 0.008;
    if (hasTag(nebula.pairMoodTags, "gentle")) bonus += 0.008;
  }
  if (answers.planet === "saturn") {
    if (nebula.ring_count >= 2) bonus += 0.012;
    if (hasTag(nebula.shapeTags, "defined")) bonus += 0.01;
    if (nebula.symmetry_score >= 0.68) bonus += 0.008;
  }
  if (answers.planet === "neptune") {
    if (nebula.hue_family === "cool") bonus += 0.012;
    if (nebula.edge_softness >= 0.6) bonus += 0.01;
    if (hasTag(nebula.moodTags, "dreamlike")) bonus += 0.008;
  }

  if (answers.window === "ocean" && nebula.edge_softness >= 0.58) bonus += 0.012;
  if (answers.window === "ocean" && nebula.hue_family === "cool") bonus += 0.008;
  if (answers.window === "alien" && nebula.texture_density >= 0.58) bonus += 0.012;
  if (answers.window === "alien" && hasTag(nebula.moodTags, "complex")) bonus += 0.008;
  if (answers.window === "primordial" && nebula.hue_family === "warm") bonus += 0.012;
  if (answers.window === "primordial" && nebula.ring_count >= 2) bonus += 0.008;
  if (answers.window === "light" && nebula.radial_strength >= 0.5) bonus += 0.012;
  if (answers.window === "light" && hasTag(nebula.moodTags, "dreamlike")) bonus += 0.008;

  if (answers.signal === "decode") {
    if (nebula.symmetry_score >= 0.68) bonus += 0.012;
    if (nebula.texture_density >= 0.56) bonus += 0.008;
  }
  if (answers.signal === "answer") {
    if (nebula.radial_strength >= 0.54) bonus += 0.012;
    if (hasTag(nebula.pairMoodTags, "magnetic")) bonus += 0.008;
  }
  if (answers.signal === "observe") {
    if (hasTag(nebula.shapeTags, "defined")) bonus += 0.012;
    if (nebula.symmetry_score >= 0.66) bonus += 0.008;
  }
  if (answers.signal === "follow") {
    if (hasTag(nebula.moodTags, "expansive")) bonus += 0.012;
    if (hasTag(nebula.moodTags, "complex")) bonus += 0.008;
  }

  if (answers.role === "captain") {
    if (nebula.contrast_level >= 0.7) bonus += 0.012;
    if (hasTag(nebula.shapeTags, "radial")) bonus += 0.008;
  }
  if (answers.role === "navigator") {
    if (nebula.symmetry_score >= 0.68) bonus += 0.012;
    if (hasTag(nebula.shapeTags, "defined")) bonus += 0.008;
    if (nebula.radial_strength >= 0.52) bonus += 0.008;
  }
  if (answers.role === "doctor") {
    if (nebula.edge_softness >= 0.6) bonus += 0.012;
    if (hasTag(nebula.pairMoodTags, "gentle")) bonus += 0.008;
  }
  if (answers.role === "chef") {
    if (nebula.hue_family === "warm") bonus += 0.012;
    if (nebula.edge_softness >= 0.58) bonus += 0.008;
    if (hasTag(nebula.pairMoodTags, "gentle")) bonus += 0.008;
  }

  return bonus;
}

function scoreAgainstNebula(userFeatures, nebula, answers, familyPenalty = 0) {
  const color = histogramIntersection(userFeatures.hueHist, nebula.hue_hist);
  const hueFamilyBonus = userFeatures.hueFamily === nebula.hue_family ? 0.02 : 0;
  const contrast = closeness(userFeatures.contrastLevel, nebula.contrast_level, 1);
  const texture = closeness(userFeatures.textureDensity, nebula.texture_density, 1);
  const radial = closeness(userFeatures.radialStrength, nebula.radial_strength, 0.7);
  const rings = ringCloseness(userFeatures.ringCount, nebula.ring_count);
  const symmetry = closeness(userFeatures.symmetryScore, nebula.symmetry_score, 1);
  const edge = closeness(userFeatures.edgeSoftness, nebula.edge_softness, 1);

  const score =
    color * 0.24 +
    contrast * 0.15 +
    texture * 0.18 +
    radial * 0.18 +
    rings * 0.09 +
    symmetry * 0.09 +
    edge * 0.07 +
    questionBonus(nebula, answers) +
    hueFamilyBonus -
    familyPenalty;

  return clamp(score);
}

function scoreToMatchRate(score, nextScore = null) {
  const absolute = 60 + score * 24;
  const gapScore = nextScore == null ? 0.35 : clamp((score - nextScore) / 0.14);
  const rate = absolute + gapScore * 12;
  return Math.round(clamp(rate, 61, 96));
}

function relationToMatchRate(resonance, similarity, complement, rhythmGap) {
  const stability = clamp((1 - rhythmGap) * 0.58 + similarity * 0.42);
  const rate = 56 + resonance * 20 + stability * 12 + complement * 8;
  return Math.round(clamp(rate, 58, 96));
}

function uniqueByNebulaTitle(ranked, limit) {
  const seen = new Set();
  const picked = [];

  for (const item of ranked) {
    const titleKey = nebulaFamilyKey(item.nebula);
    if (seen.has(titleKey)) continue;
    seen.add(titleKey);
    picked.push(item);
    if (picked.length >= limit) break;
  }

  return picked;
}

export function matchSingle(userFeatures, answers, nebulae) {
  const familyCounts = nebulae.reduce((map, nebula) => {
    const key = nebulaFamilyKey(nebula);
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());

  const ranked = nebulae
    .map((nebula) => ({
      nebula,
      score: scoreAgainstNebula(
        userFeatures,
        nebula,
        answers,
        Math.min(0.028, ((familyCounts.get(nebulaFamilyKey(nebula)) || 1) - 1) * 0.007),
      ),
    }))
    .sort((left, right) => right.score - left.score);

  const uniqueRanked = uniqueByNebulaTitle(ranked, 4);
  const rated = uniqueRanked.map((item, index) => ({
    ...item,
    rawMatchRate: scoreToMatchRate(item.score, uniqueRanked[index + 1]?.score ?? Math.max(0, item.score - 0.08)),
  }));

  if (rated[0]) {
    rated[0].matchRate = rated[0].rawMatchRate;
  }

  for (let index = 1; index < rated.length; index += 1) {
    rated[index].matchRate = Math.min(rated[index].rawMatchRate, rated[index - 1].matchRate - 1);
  }

  for (let index = 1; index < rated.length; index += 1) {
    rated[index].matchRate = clamp(rated[index].matchRate, 55, 95);
  }

  const top = rated[0];
  const alternatives = rated.slice(1, 4).map(({ rawMatchRate, ...item }) => item);

  return {
    nebula: top.nebula,
    score: top.score,
    matchRate: top.matchRate,
    alternatives,
    reasonSummary: buildFeatureReasonSummary(userFeatures),
  };
}

function deriveComplement(a, b) {
  const hueMix = a.hueFamily !== b.hueFamily ? 0.14 : 0;
  const intensityBalance = Math.abs(a.indicators.intensity - b.indicators.intensity);
  const opennessBalance = Math.abs(a.indicators.openness - b.indicators.openness);
  const structureBalance = Math.abs(a.indicators.complexity - b.indicators.complexity);
  const weighted =
    hueMix +
    clamp(1 - Math.abs(intensityBalance - 0.32) / 0.32) * 0.36 +
    clamp(1 - Math.abs(opennessBalance - 0.28) / 0.28) * 0.28 +
    clamp(1 - Math.abs(structureBalance - 0.24) / 0.24) * 0.22;
  return clamp(weighted);
}

function describeSimilarity(score) {
  if (score >= 0.74) return text("纹理节奏高度同步", "highly synchronized texture rhythm");
  if (score >= 0.54) return text("有明显的相似频段", "a clear shared frequency band");
  return text("并不天然同频", "not naturally on the same frequency");
}

function describeComplement(score) {
  if (score >= 0.74) return text("差异刚好能形成吸引", "differences that create attraction");
  if (score >= 0.54) return text("有互补的空间", "room for complementarity");
  return text("互补感并不算主导", "complementarity is not the main force");
}

function describeRhythm(score) {
  if (score >= 0.46) return text("需要主动调时差", "needs active rhythm adjustment");
  if (score >= 0.28) return text("偶尔会出现拍子不一致", "occasionally falls out of beat");
  return text("整体节拍相对稳定", "overall rhythm is relatively stable");
}

function pickArchetype(similarity, complement, rhythmGap, a, b) {
  const intensityGap = Math.abs(a.indicators.intensity - b.indicators.intensity);
  const opennessGap = Math.abs(a.indicators.openness - b.indicators.openness);

  if (similarity >= 0.74 && rhythmGap < 0.24) return "resonance";
  if (complement >= 0.72 && rhythmGap < 0.38) return "complement";
  if (intensityGap >= 0.34 && opennessGap >= 0.24) return "brightshadow";
  if (rhythmGap >= 0.46) return "tension";
  if (Math.abs(a.ringCount - b.ringCount) >= 2 || similarity < 0.58) return "slowburn";
  return "dualcore";
}

export function buildDualRelation(leftFeatures, rightFeatures, answers) {
  const similarity =
    histogramIntersection(leftFeatures.hueHist, rightFeatures.hueHist) * 0.22 +
    closeness(leftFeatures.contrastLevel, rightFeatures.contrastLevel, 1) * 0.16 +
    closeness(leftFeatures.textureDensity, rightFeatures.textureDensity, 1) * 0.16 +
    closeness(leftFeatures.radialStrength, rightFeatures.radialStrength, 0.7) * 0.18 +
    ringCloseness(leftFeatures.ringCount, rightFeatures.ringCount) * 0.12 +
    closeness(leftFeatures.symmetryScore, rightFeatures.symmetryScore, 1) * 0.1 +
    closeness(leftFeatures.edgeSoftness, rightFeatures.edgeSoftness, 1) * 0.06;

  let complement = deriveComplement(leftFeatures, rightFeatures);
  let rhythmGap =
    Math.abs(leftFeatures.contrastLevel - rightFeatures.contrastLevel) * 0.4 +
    Math.abs(leftFeatures.textureDensity - rightFeatures.textureDensity) * 0.25 +
    Math.abs(leftFeatures.radialStrength - rightFeatures.radialStrength) * 0.2 +
    Math.abs(leftFeatures.edgeSoftness - rightFeatures.edgeSoftness) * 0.15;

  let resonanceBoost = 0;

  if (answers?.pairOrbit === "twin-star") resonanceBoost += 0.02;
  if (answers?.pairOrbit === "slingshot") complement = clamp(complement + 0.02);
  if (answers?.pairOrbit === "relay") resonanceBoost += 0.015;
  if (answers?.pairNeed === "radar") resonanceBoost += 0.015;
  if (answers?.pairNeed === "spark") complement = clamp(complement + 0.02);
  if (answers?.pairNeed === "map") resonanceBoost += 0.01;
  if (answers?.pairScene === "harbor") resonanceBoost += 0.012;
  if (answers?.pairScene === "rift") rhythmGap = clamp(rhythmGap + 0.015);
  if (answers?.pairScene === "aurora") resonanceBoost += 0.01;
  const resonance = clamp(similarity * 0.58 + complement * 0.42 - rhythmGap * 0.22 + resonanceBoost);

  const archetype = pickArchetype(similarity, complement, rhythmGap, leftFeatures, rightFeatures);
  const matchRate = relationToMatchRate(resonance, similarity, complement, rhythmGap);

  let cosmicAdvice = text(
    "真正适合你们的，不是零冲突，而是冲突之后还能重新回到同一片天幕。",
    "What truly suits you is not zero conflict, but the ability to return to the same sky after conflict.",
  );
  if (archetype === "complement") cosmicAdvice = text("别急着把彼此磨成一样，差异正是这段关系的光源。", "Do not rush to make each other identical; difference is the light source of this bond.");
  if (archetype === "slowburn") cosmicAdvice = text("慢一点不是没感觉，而是这段关系更适合把时间变成证据。", "Slower does not mean weaker; this bond is better at turning time into evidence.");
  if (archetype === "tension") cosmicAdvice = text("当吸引和节奏差并存时，边界会比情绪更重要。", "When attraction and rhythm gap coexist, boundaries matter more than emotion.");
  if (archetype === "brightshadow") cosmicAdvice = text("你们会在彼此身上看见自己不常外露的部分，所以靠近也会带一点轻微眩晕。", "You will see in each other the parts you rarely show, so closeness can feel slightly dizzy.");

  return {
    similarity: clamp(similarity),
    complement,
    rhythmGap: clamp(rhythmGap),
    resonance,
    archetype,
    matchRate,
    similarityLabel: describeSimilarity(similarity),
    complementLabel: describeComplement(complement),
    rhythmLabel: describeRhythm(rhythmGap),
    cosmicAdvice,
  };
}
