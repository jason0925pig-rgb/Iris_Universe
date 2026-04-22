const SINGLE_MOOD_OPENINGS = {
  core: "你天然带着一点会被人群看见的引力，很多目光和关系都会不自觉地向你靠近。",
  frontier: "你的虹膜节奏更偏向边缘地带的安静，不喧闹，但很有自己的内部秩序。",
  blackhole: "你的纹理里有一种危险却迷人的深度，像靠近黑洞轨道时那种无法轻易抽身的吸引。",
  nebula: "你的眼纹更像新生星云，柔软、流动、但内部一直有事情在慢慢长出来。",
};

const SINGLE_PLANET_LINES = {
  sun: "你会把自己的眼睛想成太阳，不只是因为亮，而是因为你天然会把场域的注意力往自己身上收拢。",
  earth: "你把自己放在地球的位置上，说明你看重的是生机、真实回应和可以被长期居住的关系。",
  saturn: "你更像土星，边界感、秩序感和自成体系的美都很强，不是谁都能直接进入你的轨道。",
  neptune: "你愿意把自己比作海王星，说明你对内在世界很有保护欲，很多情绪不会第一时间公开给别人看。",
};

const SINGLE_WINDOW_LINES = {
  ocean: "你看世界的方式更偏潮汐感，不是一下子定论，而是靠反复靠近和退开来确认真实。",
  alien: "你身上有一点不肯随便复制别人的部分，所以很多重要决定都更适合走自己的路径。",
  primordial: "你和时间的关系更像沉淀，很多东西不会立刻下结论，但会越放越清楚。",
  light: "你更相信那些迟到但准确的回应，所以很多关系和机会在你这里都讲究抵达感。",
};

const SINGLE_SIGNAL_LINES = {
  decode: "面对未知信号时，你更习惯先拆解结构再决定是否回应，所以你给人的第一印象通常比真实的你更冷静。",
  answer: "你一旦感到某种清晰的召唤，就很难装作没听见，所以命运向你靠近时，你通常会真的伸手。",
  observe: "你不会急着冲向未知，你更擅长先确认风向，这种慢不是犹豫，而是一种高等级的自保。",
  follow: "你对未知一直有探险欲，所以只要某件事足够新鲜、足够真，你会愿意把自己推远一点。",
};

const SINGLE_ROLE_LINES = {
  captain: "如果宇宙大航海真的开始，你会更愿意站到舰桥中央，说明你不排斥承担方向和决断。",
  navigator: "你更像领航员，擅长在混乱里校准坐标，不一定总站在最前面，但很会决定往哪去。",
  doctor: "你愿意做飞船上的医生，说明你对人的状态、损耗和恢复都比一般人更敏锐。",
  chef: "你愿意做厨师，说明你相信温度和日常能够维系一段长期关系，很多重要的连接其实都发生在细节里。",
};

const SINGLE_QUESTIONS = [
  {
    id: "habitat",
    required: true,
    prompt: "如果真的住进宇宙，你会把家安在——",
    options: [
      { value: "core", label: "宇宙中心", weights: { career: 4, love: 5, energy: 1 } },
      { value: "frontier", label: "偏远边缘地带", weights: { career: 2, love: 1, energy: 5 } },
      { value: "blackhole", label: "黑洞附近的危险轨道", weights: { career: 5, love: 2, energy: 3 } },
      { value: "nebula", label: "新生星云的航道里", weights: { career: 3, love: 4, energy: 3 } },
    ],
  },
  {
    id: "planet",
    required: true,
    prompt: "如果把你的眼睛放进太阳系，你更愿意把它比作——",
    options: [
      { value: "sun", label: "太阳", weights: { career: 5, love: 3, energy: 2 } },
      { value: "earth", label: "地球", weights: { career: 3, love: 5, energy: 4 } },
      { value: "saturn", label: "土星", weights: { career: 4, love: 2, energy: 4 } },
      { value: "neptune", label: "海王星", weights: { career: 2, love: 2, energy: 5 } },
    ],
  },
  {
    id: "window",
    required: true,
    prompt: "如果你的眼睛是一扇窗，窗外是——",
    options: [
      { value: "ocean", label: "深夜的海", weights: { career: 1, love: 4, energy: 4 } },
      { value: "alien", label: "未知星球", weights: { career: 4, love: 1, energy: 3 } },
      { value: "primordial", label: "宇宙清晨", weights: { career: 3, love: 2, energy: 5 } },
      { value: "light", label: "很久以前的一束光", weights: { career: 3, love: 5, energy: 2 } },
    ],
  },
  {
    id: "signal",
    required: true,
    prompt: "如果宇宙突然向你发来一段未知信号，你会先——",
    options: [
      { value: "decode", label: "先拆解它的规律", weights: { career: 5, love: 1, energy: 3 } },
      { value: "answer", label: "立刻回应它", weights: { career: 3, love: 5, energy: 2 } },
      { value: "observe", label: "远远观察一阵", weights: { career: 2, love: 2, energy: 5 } },
      { value: "follow", label: "顺着它去探险", weights: { career: 4, love: 3, energy: 4 } },
    ],
  },
  {
    id: "role",
    required: true,
    prompt: "如果人类进入宇宙大航海时代，你在飞船上最像——",
    options: [
      { value: "captain", label: "舰长", weights: { career: 5, love: 2, energy: 2 } },
      { value: "navigator", label: "领航员", weights: { career: 4, love: 2, energy: 5 } },
      { value: "doctor", label: "医生", weights: { career: 2, love: 5, energy: 4 } },
      { value: "chef", label: "厨师", weights: { career: 2, love: 4, energy: 4 } },
    ],
  },
];

export const QUESTIONS = {
  single: SINGLE_QUESTIONS,
  dual: [
    {
      id: "pairOrbit",
      required: true,
      title: "必答 1",
      prompt: "如果把你们的关系比作一种宇宙的运动，它更像——",
      options: [
        { value: "twin-star", label: "像月球绕着地球旋转一样", weights: { tacit: 5, chemistry: 3, growth: 4 } },
        { value: "relay", label: "像地球和火星那样，一起围绕同一个核心天体运转", weights: { tacit: 4, chemistry: 2, growth: 5 } },
        { value: "slingshot", label: "像流星划过地球夜空，一生只相交一次", weights: { tacit: 2, chemistry: 5, growth: 2 } },
        { value: "nebula-drift", label: "像未被探测出规律的某种运动", weights: { tacit: 3, chemistry: 4, growth: 3 } },
      ],
    },
    {
      id: "pairNeed",
      required: true,
      title: "必答 2",
      prompt: "人类到了宇宙大航海时代，当你和 TA 在同一艘宇宙飞船返回地球家园的时候，你对 TA 发出什么样的邀约，你觉得 TA 最不会拒绝？",
      options: [
        { value: "radar", label: "一起去酒吧小酌一杯", weights: { tacit: 5, chemistry: 2, growth: 4 } },
        { value: "spark", label: "一起去健身房健身一下", weights: { tacit: 2, chemistry: 5, growth: 2 } },
        { value: "map", label: "一起去舷窗边看地球重新亮起来", weights: { tacit: 3, chemistry: 2, growth: 5 } },
        { value: "cabin", label: "直接去休眠舱睡觉，没有邀约的必要", weights: { tacit: 4, chemistry: 4, growth: 3 } },
      ],
    },
    {
      id: "pairScene",
      required: true,
      title: "必答 3",
      prompt: "对方的眼睛给你的感觉是什么？",
      options: [
        { value: "aurora", label: "宇宙的深邃", weights: { tacit: 5, chemistry: 3, growth: 3 } },
        { value: "meteor", label: "星际大冒险的探索与冒险", weights: { tacit: 2, chemistry: 4, growth: 4 } },
        { value: "rift", label: "黑洞和暗物质之间的危险与神秘", weights: { tacit: 2, chemistry: 5, growth: 3 } },
        { value: "harbor", label: "很远的星光回到身边的温柔", weights: { tacit: 4, chemistry: 3, growth: 5 } },
      ],
    },
  ],
};

const DUAL_EASTER_QUESTIONS = {
  "male-male": {
    id: "pairEaster",
    required: true,
    title: "隐藏 4",
    prompt: "当你们又见面了的时候，当你认真看向对方的眼睛的时候，你会想什么？",
    options: [
      { value: "dad", label: "你爹来喽" },
      { value: "save", label: "又能并肩狠狠干一场了" },
      { value: "roast", label: "先损你两句再说" },
      { value: "cover", label: "这次我还是会站你这边" },
    ],
  },
  "male-female": {
    id: "pairEaster",
    required: true,
    title: "隐藏 4",
    prompt: "当你们快要分别的时候，当你看向对方的眼睛，你会想什么？",
    options: [
      { value: "steady", label: "感觉很平静，我们马上就会再见面了" },
      { value: "tease", label: "还是会有一点舍不得" },
      { value: "orbit", label: "好像还有很多话没说完" },
      { value: "wink", label: "只要你回头，我应该还会在那里" },
    ],
  },
  "female-female": {
    id: "pairEaster",
    required: true,
    title: "隐藏 4",
    prompt: "当你们马上又要见面的时候，当你认真看向对方的眼睛，你会想什么？",
    options: [
      { value: "mom", label: "姐妹你好米呀" },
      { value: "judge", label: "这次我要先抱你一下" },
      { value: "alliance", label: "完了，又要一起漂亮出场了" },
      { value: "smirk", label: "一看见你就知道今天不会无聊" },
    ],
  },
};

const ARCHETYPE_CATALOG = {
  resonance: {
    title: "同频共振",
    subtitle: "你们更像两束在同一片雾里发亮的光。",
  },
  complement: {
    title: "互补吸引",
    subtitle: "不是一样，所以刚好能把彼此照亮得更完整。",
  },
  tension: {
    title: "深海拉扯",
    subtitle: "吸引是真的，节奏差也是真的，所以这段关系有很强的问题意识。",
  },
  slowburn: {
    title: "慢热成形",
    subtitle: "它不靠立刻爆炸来证明自己，而是靠一点点稳定靠近。",
  },
  dualcore: {
    title: "双核并行",
    subtitle: "你们各自都很完整，真正重要的是如何对准轨道而不是互相吞没。",
  },
  brightshadow: {
    title: "一明一隐",
    subtitle: "你们很容易在彼此身上看见自己不常外露的那一面。",
  },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pickFrom(value, mapping, fallback = "") {
  return mapping[value] || fallback;
}

function shuffleCopy(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function toPercent(value) {
  return `${Math.round(clamp(value, 0, 1) * 100)}%`;
}

function describeBand(value, lowText, midText, highText) {
  if (value >= 0.72) return highText;
  if (value >= 0.42) return midText;
  return lowText;
}

function trimNarrative(seed) {
  const compact = (seed || "").replace(/\s+/g, " ").trim();
  if (!compact) return "";
  return compact.length > 110 ? `${compact.slice(0, 108)}…` : compact;
}

function questionLookup(questionSet, answers) {
  const labels = {};
  for (const question of questionSet) {
    const chosen = question.options.find((option) => option.value === answers[question.id]);
    if (chosen) labels[question.id] = chosen.label;
  }
  return labels;
}

function questionSetOption(questionSet, questionId, value) {
  const question = questionSet.find((item) => item.id === questionId);
  return question?.options.find((option) => option.value === value) || null;
}

export function resolveIdentityCombo(identities = []) {
  const normalized = identities.map((value) => (value || "").trim()).filter(Boolean);
  if (normalized.length < 2) return "";
  if (normalized.some((value) => !["male", "female"].includes(value))) return "";
  if (normalized.every((value) => value === "male")) return "male-male";
  if (normalized.every((value) => value === "female")) return "female-female";
  return "male-female";
}

export function getDualEasterQuestion(identities = []) {
  const combo = resolveIdentityCombo(identities);
  return combo ? DUAL_EASTER_QUESTIONS[combo] || null : null;
}

export function getQuestionOption(mode, questionId, value) {
  return questionSetOption(QUESTIONS[mode] || [], questionId, value);
}

function featureBand(score) {
  if (score >= 85) return "peak";
  if (score >= 70) return "strong";
  if (score >= 55) return "rising";
  if (score >= 40) return "forming";
  return "quiet";
}

function strongestInfluences(answers, dimension) {
  return SINGLE_QUESTIONS.map((question) => getQuestionOption("single", question.id, answers[question.id]))
    .filter(Boolean)
    .map((option) => ({
      label: option.label,
      weight: option.weights?.[dimension] || 0,
    }))
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 2);
}

function questionContribution(answers, dimension) {
  let total = 0;
  let max = 0;
  for (const question of SINGLE_QUESTIONS) {
    const option = getQuestionOption("single", question.id, answers[question.id]);
    total += option?.weights?.[dimension] || 0;
    max += 5;
  }
  return max ? total / max : 0;
}

function computeSingleLineScores(userFeatures, answers) {
  const careerFeature = clamp(
    userFeatures.indicators.intensity * 0.4 +
      userFeatures.indicators.complexity * 0.22 +
      userFeatures.radialStrength * 0.18 +
      userFeatures.symmetryScore * 0.12 +
      userFeatures.contrastLevel * 0.08,
    0,
    1,
  );
  const loveFeature = clamp(
    userFeatures.indicators.openness * 0.32 +
      userFeatures.edgeSoftness * 0.2 +
      userFeatures.radialStrength * 0.16 +
      userFeatures.textureDensity * 0.08 +
      clamp(1 - Math.abs(userFeatures.symmetryScore - 0.62) / 0.62, 0, 1) * 0.12 +
      (userFeatures.hueFamily === "warm" ? 0.12 : userFeatures.hueFamily === "cool" ? 0.06 : 0.1),
    0,
    1,
  );
  const energyFeature = clamp(
    userFeatures.indicators.stability * 0.34 +
      userFeatures.symmetryScore * 0.2 +
      userFeatures.edgeSoftness * 0.12 +
      clamp(1 - Math.abs(userFeatures.contrastLevel - 0.58) / 0.58, 0, 1) * 0.14 +
      userFeatures.indicators.openness * 0.08 +
      userFeatures.indicators.complexity * 0.12,
    0,
    1,
  );

  const careerQuestion = questionContribution(answers, "career");
  const loveQuestion = questionContribution(answers, "love");
  const energyQuestion = questionContribution(answers, "energy");

  return {
    career: Math.round(careerFeature * 58 + careerQuestion * 42),
    love: Math.round(loveFeature * 56 + loveQuestion * 44),
    energy: Math.round(energyFeature * 56 + energyQuestion * 44),
  };
}

function lineInfluenceSentence(dimension, influences) {
  const labels = influences.filter((item) => item.weight > 0).map((item) => `「${item.label}」`);
  if (!labels.length) return "";
  const pair = labels.slice(0, 2).join("和");
  if (dimension === "career") {
    return `你在 ${pair} 这些答案上给出的权重更高，说明你对成事、扩张或冒险的偏好会直接抬高事业线。`;
  }
  if (dimension === "love") {
    return `你连续把分数投给 ${pair} 这样的选择，说明你在关系里并不是被动等待，而是有非常明确的靠近方式。`;
  }
  return `你在 ${pair} 这些答案上的倾向更明显，所以你的能量线很受“怎么恢复自己、怎么守住节拍”这件事影响。`;
}

function careerFeatureSentence(features) {
  if (features.indicators.intensity >= 0.72 && features.radialStrength >= 0.54) {
    return "你的虹膜推进感和向外辐射感都很强，这类结构通常意味着你一旦确认目标，就会很敢往前推。";
  }
  if (features.indicators.complexity >= 0.68) {
    return "你的复杂度和环层感偏高，所以你并不是没有野心，只是做事更讲究布局，不爱把真正的计划一次说完。";
  }
  return "你的事业驱动力不是最张扬的类型，但底盘并不弱，更适合把能量收束成一条长期航道。";
}

function loveFeatureSentence(features) {
  if (features.indicators.openness >= 0.72 && features.edgeSoftness >= 0.62) {
    return "你的虹膜边缘柔和、开放度也高，说明你一旦确认安全感，就会很自然地把温度给出去。";
  }
  if (features.indicators.openness <= 0.42) {
    return "你的情感并不是稀少，而是进入得慢，你更需要关系先证明自己值得，你才会真正打开。";
  }
  return "你的爱情线不走极端，更像慢慢升温的深水区，先确认、再投入，一旦投入就很稳定。";
}

function energyFeatureSentence(features) {
  if (features.indicators.stability >= 0.74 && features.symmetryScore >= 0.7) {
    return "你的内部节拍和结构平衡都很稳，这意味着你天生就比很多人更会把自己从混乱里拉回来。";
  }
  if (features.contrastLevel >= 0.7 && features.indicators.stability <= 0.5) {
    return "你的亮度和反差很高，说明你容易一下子投入太深，所以能量管理最大的课题不是启动，而是收尾。";
  }
  return "你的能量线更吃节奏管理，只要外界噪音减少，你恢复自己的速度其实并不慢。";
}

function careerBandSentence(score) {
  switch (featureBand(score)) {
    case "peak":
      return "你的事业线已经进入很强的兑现区间，不只是有潜力，而是真的具备把机会抓成结果的条件。";
    case "strong":
      return "你的事业线处在明显抬升期，外部机会和内部驱动力正在慢慢对准，接下来最重要的是选主线。";
    case "rising":
      return "你的事业线已经成形，但真正的突破点还没完全压中，现在比拼的是聚焦，不是更忙。";
    case "forming":
      return "你的事业线更像打底期，不适合盲目冲刺，先把能长期投入的方向辨认清楚会更有利。";
    default:
      return "你的事业线目前偏安静，不代表没有机会，而是更适合先把内核养厚，再等真正合拍的窗口出现。";
  }
}

function loveBandSentence(score) {
  switch (featureBand(score)) {
    case "peak":
      return "你的爱情线很亮，代表你既有进入关系的能力，也有把关系真正养深的能量。";
    case "strong":
      return "你的爱情线处在很好的区间，靠近和保留之间的比例相对健康，只要对象对了，推进会很顺。";
    case "rising":
      return "你的爱情线不是没有，只是它更讲究节奏感，很多好关系需要你在确认之后再多往前走一步。";
    case "forming":
      return "你的爱情线现在更像筛选期，比起立刻热烈，更重要的是先判断谁值得你花力气。";
    default:
      return "你的爱情线偏谨慎，不是因为你不想爱，而是你很清楚错误的靠近会直接消耗你。";
  }
}

function energyBandSentence(score) {
  switch (featureBand(score)) {
    case "peak":
      return "你的能量线很强，说明你不仅恢复力好，而且在复杂环境里也能把自己重新稳住。";
    case "strong":
      return "你的能量线处在高位，日常只要别让无效消耗堆太满，整个人的内在续航会非常可观。";
    case "rising":
      return "你的能量线总体不差，但它需要被好好照顾，尤其要注意别把太多精力给到无回报的人和事。";
    case "forming":
      return "你的能量线正在重建期，规律、边界和休息会比一时的冲劲更重要。";
    default:
      return "你的能量线目前偏敏感，真正该做的不是再逼自己往前，而是先把恢复系统搭起来。";
  }
}

function lineClosingSentence(dimension, score) {
  if (dimension === "career") {
    return score >= 70 ? "接下来比起再证明自己，更重要的是把真正值得的机会抓紧。" : "先别急着和别人比速度，你更需要的是对准自己的主航道。";
  }
  if (dimension === "love") {
    return score >= 70 ? "真正适合你的人，不会只被你吸引，还会愿意配合你的节拍。"
      : "对你来说，关系质量永远比关系数量更重要，这不是缺点，是门槛。";
  }
  return score >= 70 ? "你越懂得替自己留缓冲，越能长期保持漂亮的发光状态。" : "现在最值得做的不是更拼，而是把日常恢复这件事变成稳定习惯。";
}

export function buildSingleReading({ match, userFeatures, answers }) {
  const labels = questionLookup(SINGLE_QUESTIONS, answers);
  const moodOpening = pickFrom(answers.habitat, SINGLE_MOOD_OPENINGS, "你的虹膜整体节奏并不平，它更像一段有内在起伏的宇宙纹路。");
  const planetLine = pickFrom(answers.planet, SINGLE_PLANET_LINES, "你给自己的天体投射很明确，说明你对自己在人群中的位置并不模糊。");
  const windowLine = pickFrom(answers.window, SINGLE_WINDOW_LINES, "你身上的很多信号不是喊出来的，而是会被真正懂的人慢慢看见。");
  const signalLine = pickFrom(answers.signal, SINGLE_SIGNAL_LINES, "");
  const roleLine = pickFrom(answers.role, SINGLE_ROLE_LINES, "");
  const seed = trimNarrative(match.nebula.mainNarrativeSeed || match.nebula.singleNarrativeSeed);
  const lineScores = computeSingleLineScores(userFeatures, answers);
  const careerInfluences = strongestInfluences(answers, "career");
  const loveInfluences = strongestInfluences(answers, "love");
  const energyInfluences = strongestInfluences(answers, "energy");

  const symmetryText = describeBand(
    userFeatures.symmetryScore,
    "你的结构并不追求完全规整，更像一团有生命力的真实纹路。",
    "你的对称度处在舒服区间，说明你既保留了稳定，也保留了变化。",
    "你的纹理重心很稳，这会让你给人一种情绪不乱、底盘很定的感觉。",
  );
  const complexityText = describeBand(
    userFeatures.indicators.complexity,
    "你不靠过度堆叠来显得丰富，反而更适合用留白表达自己。",
    "你的层次感适中，不会让人觉得太满，却足够耐看。",
    "你的环层感和纹理密度都偏高，说明你身上那种“不是一眼就能看懂”的部分很强。",
  );
  const shuffledOpenings = shuffleCopy([moodOpening, planetLine, windowLine, signalLine, roleLine].filter(Boolean));
  const themeLine = `${match.nebula.titleCn || match.nebula.titleShort}会落到你这里，不只是因为颜色接近，更因为你们都带着${match.reasonSummary}。`;

  const narrative = [
    shuffledOpenings[0],
    themeLine,
    shuffledOpenings[1],
    symmetryText,
    shuffledOpenings[2],
    seed,
    shuffledOpenings[3],
    complexityText,
    shuffledOpenings[4],
  ]
    .filter(Boolean)
    .join("");

  const lines = [
    {
      label: `事业线 · ${lineScores.career}分`,
      text: [
        careerBandSentence(lineScores.career),
        lineInfluenceSentence("career", careerInfluences),
        careerFeatureSentence(userFeatures),
        lineClosingSentence("career", lineScores.career),
      ].join(""),
    },
    {
      label: `爱情线 · ${lineScores.love}分`,
      text: [
        loveBandSentence(lineScores.love),
        lineInfluenceSentence("love", loveInfluences),
        loveFeatureSentence(userFeatures),
        lineClosingSentence("love", lineScores.love),
      ].join(""),
    },
    {
      label: `能量线 · ${lineScores.energy}分`,
      text: [
        energyBandSentence(lineScores.energy),
        lineInfluenceSentence("energy", energyInfluences),
        energyFeatureSentence(userFeatures),
        lineClosingSentence("energy", lineScores.energy),
      ].join(""),
    },
  ];

  const metrics = [
    {
      label: "对称感",
      value: toPercent(userFeatures.symmetryScore),
      text: userFeatures.symmetryScore >= 0.7 ? "稳定底盘" : userFeatures.symmetryScore >= 0.45 ? "稳中带波动" : "更偏流动感",
    },
    {
      label: "环层感",
      value: `${userFeatures.ringCount} 层`,
      text: userFeatures.ringCount >= 3 ? "层次明显" : userFeatures.ringCount === 2 ? "有轻微叠层" : "更偏单层直觉",
    },
    {
      label: "纹理密度",
      value: toPercent(userFeatures.textureDensity),
      text: userFeatures.textureDensity >= 0.7 ? "细节丰盛" : userFeatures.textureDensity >= 0.42 ? "密度适中" : "留白偏多",
    },
    {
      label: "辐射感",
      value: toPercent(userFeatures.radialStrength),
      text: userFeatures.radialStrength >= 0.56 ? "向外生长" : userFeatures.radialStrength >= 0.42 ? "收放平衡" : "更偏内聚",
    },
  ];

  const reasons = [
    `主色调与 ${match.nebula.titleCn || match.nebula.titleShort} 的 ${match.nebula.hue_family === "warm" ? "暖雾" : match.nebula.hue_family === "cool" ? "冷光" : "中性星云"} 气质靠近`,
    `你的虹膜呈现 ${match.reasonSummary}`,
    `三条线当前分布为：事业 ${lineScores.career} / 爱情 ${lineScores.love} / 能量 ${lineScores.energy}`,
    `${labels.planet || "这颗天体投射"} 和 ${labels.role || "你给自己的飞船角色"} 明显拉动了结果的叙事方向`,
  ];

  const shareCaption = `我在虹膜宇宙里匹配到了${match.nebula.titleCn || match.nebula.titleShort}，事业线${lineScores.career}分、爱情线${lineScores.love}分、能量线${lineScores.energy}分。`;

  return {
    headline: `${match.nebula.titleCn || match.nebula.titleShort}正在等你`,
    narrative,
    lines,
    metrics,
    reasons,
    spaceMessage: `${match.nebula.cosmicFact} 而你此刻的心，也刚好被这一束光认出来。`,
    shareCaption,
  };
}

function dualQuestionContribution(questionSet, answers, dimension) {
  let total = 0;
  let max = 0;
  for (const question of questionSet) {
    const option = questionSetOption(questionSet, question.id, answers[question.id]);
    if (!option?.weights) continue;
    total += option.weights?.[dimension] || 0;
    max += 5;
  }
  return max ? total / max : 0;
}

function strongestDualInfluences(questionSet, answers, dimension) {
  return questionSet
    .map((question) => questionSetOption(questionSet, question.id, answers[question.id]))
    .filter((option) => option?.weights)
    .map((option) => ({
      label: option.label,
      weight: option.weights?.[dimension] || 0,
    }))
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 2);
}

function nearness(a, b, spread = 1) {
  return clamp(1 - Math.abs(a - b) / spread, 0, 1);
}

function computeDualLineScores({ relation, answers, questionSet, leftFeatures, rightFeatures }) {
  const averageStability = (leftFeatures.indicators.stability + rightFeatures.indicators.stability) / 2;
  const averageIntensity = (leftFeatures.indicators.intensity + rightFeatures.indicators.intensity) / 2;
  const averageComplexity = (leftFeatures.indicators.complexity + rightFeatures.indicators.complexity) / 2;
  const averageOpenness = (leftFeatures.indicators.openness + rightFeatures.indicators.openness) / 2;
  const radialSync = nearness(leftFeatures.radialStrength, rightFeatures.radialStrength, 1);
  const symmetrySync = nearness(leftFeatures.symmetryScore, rightFeatures.symmetryScore, 1);

  const tacitFeature = clamp(
    relation.similarity * 0.42 +
      (1 - relation.rhythmGap) * 0.22 +
      relation.resonance * 0.18 +
      averageStability * 0.1 +
      symmetrySync * 0.08,
    0,
    1,
  );
  const chemistryFeature = clamp(
    relation.complement * 0.36 +
      relation.resonance * 0.22 +
      averageIntensity * 0.16 +
      averageOpenness * 0.12 +
      radialSync * 0.14,
    0,
    1,
  );
  const growthFeature = clamp(
    relation.resonance * 0.26 +
      (1 - relation.rhythmGap) * 0.18 +
      averageComplexity * 0.16 +
      averageStability * 0.14 +
      radialSync * 0.14 +
      symmetrySync * 0.12,
    0,
    1,
  );

  return {
    tacit: Math.round(tacitFeature * 30 + dualQuestionContribution(questionSet, answers, "tacit") * 70),
    chemistry: Math.round(chemistryFeature * 30 + dualQuestionContribution(questionSet, answers, "chemistry") * 70),
    growth: Math.round(growthFeature * 30 + dualQuestionContribution(questionSet, answers, "growth") * 70),
  };
}

function dualBandSentence(dimension, score) {
  switch (featureBand(score)) {
    case "peak":
      return dimension === "tacit"
        ? "你们的默契线已经进到很高的区间，很多信息甚至不用说完就能被彼此接住。"
        : dimension === "chemistry"
          ? "你们的吸引线很亮，说明这段关系不只是有感觉，而是真的带着明显的拉力。"
          : "你们的成长线很强，代表这段关系不止会发生，还很可能真的把彼此往前带。";
    case "strong":
      return dimension === "tacit"
        ? "你们的默契线稳定偏高，真正稀缺的是把这种理解长期保存下来。"
        : dimension === "chemistry"
          ? "你们的吸引线处在很好的区间，熟悉感和新鲜感之间的比例相对健康。"
          : "你们的成长线已经成形，只要方向别走散，这段关系会很有后劲。";
    case "rising":
      return dimension === "tacit"
        ? "你们的默契线正在往上长，很多真正懂彼此的瞬间会出现在具体事件里。"
        : dimension === "chemistry"
          ? "你们的吸引线不是轰炸型，而是会在靠近和回头之间反复抬头。"
          : "你们的成长线需要一点时间发酵，慢慢长出来的共同语言会比一时热烈更稳。";
    case "forming":
      return dimension === "tacit"
        ? "你们的默契线还在建立期，需要更多表达和对齐，不是没有，只是还没长稳。"
        : dimension === "chemistry"
          ? "你们的吸引线偏试探型，很多情绪要等真正进入场景之后才会显形。"
          : "你们的成长线现在更像起步阶段，先别急着定义结局，先看能不能一起走远。";
    default:
      return dimension === "tacit"
        ? "你们的默契线目前偏轻，需要靠更多确认和沟通把隐约的感觉变成可依赖的结构。"
        : dimension === "chemistry"
          ? "你们的吸引线此刻更像暗潮，不一定第一眼炸开，但会在小动作里露出来。"
          : "你们的成长线现在还比较安静，关键不在于立刻升温，而在于能不能形成持续性。";
  }
}

function dualInfluenceSentence(dimension, influences) {
  const labels = influences.filter((item) => item.weight > 0).map((item) => `「${item.label}」`);
  if (!labels.length) return "";
  const pair = labels.slice(0, 2).join("和");
  if (dimension === "tacit") {
    return `你们在 ${pair} 这些选择上投得最重，说明这段关系真正被你们看重的，是能不能接住彼此的节拍和方向。`;
  }
  if (dimension === "chemistry") {
    return `你们给 ${pair} 这些选项的分更高，所以这段关系里的火花、暧昧感和吸引欲会被明显放大。`;
  }
  return `你们反复把票投给 ${pair} 这一类未来导向的答案，所以成长线自然会被抬高。`;
}

function tacitFeatureSentence(leftFeatures, rightFeatures, relation) {
  const stabilityAverage = (leftFeatures.indicators.stability + rightFeatures.indicators.stability) / 2;
  if (relation.similarity >= 0.74 && stabilityAverage >= 0.64) {
    return "你们的纹理节拍接近，而且两个人的内部稳定度都不低，所以相处时很容易形成一种不用反复解释的默认值。";
  }
  if (relation.rhythmGap >= 0.42) {
    return "你们并不是理解不了对方，而是容易在时差上错拍，所以默契更像一种后天训练出来的能力。";
  }
  return "你们的默契不是天降的那种神同步，而是会在一次次靠近里慢慢累积成型。";
}

function chemistryFeatureSentence(leftFeatures, rightFeatures, relation) {
  const intensityAverage = (leftFeatures.indicators.intensity + rightFeatures.indicators.intensity) / 2;
  if (relation.complement >= 0.72) {
    return "你们最有吸引力的地方，恰恰是彼此不完全相同的部分，所以靠近时会有一种新鲜而上头的张力。";
  }
  if (intensityAverage >= 0.68 && relation.resonance >= 0.64) {
    return "你们两个人本身都不是低能见度的类型，所以一旦互相照到，化学反应会比普通关系明显。";
  }
  return "你们的吸引更像细流，不一定一上来就铺满全场，但会在很多小场景里反复出现。";
}

function growthFeatureSentence(leftFeatures, rightFeatures, relation) {
  const complexityAverage = (leftFeatures.indicators.complexity + rightFeatures.indicators.complexity) / 2;
  if (relation.rhythmGap <= 0.24 && relation.resonance >= 0.68) {
    return "你们的节奏差不大，共振值也高，所以这段关系天然具备一起往远处走的条件。";
  }
  if (complexityAverage >= 0.64) {
    return "你们两个都不是表层关系型的人，所以真正的成长潜力，反而藏在慢慢变深之后。";
  }
  return "这段关系的成长性不靠瞬间定胜负，而靠能不能在一次次现实碰撞之后还愿意继续调整。";
}

function resolveRelationshipName({ lineScores, relation, identities, answers }) {
  const combo = resolveIdentityCombo(identities);
  if (combo === "male-male" && answers.pairEaster === "dad") return "我是你爸爸";
  if (combo === "male-female" && answers.pairEaster === "steady") return "情比金坚的异球恋";
  if (combo === "female-female" && answers.pairEaster === "mom") return "叫妈妈";

  if (lineScores.tacit >= 82 && lineScores.growth >= 78 && lineScores.chemistry >= 60) return "老夫老妻";
  if (lineScores.chemistry >= 84 && lineScores.growth >= 66) return "甜蜜小情侣";
  if (lineScores.tacit >= 78 && lineScores.chemistry < 55) {
    if (combo === "male-male") return "塑料兄弟情";
    if (combo === "female-female") return "塑料姐妹花";
    return "嘴硬搭子";
  }
  if (lineScores.chemistry >= 80 && lineScores.tacit < 58) return "上头试飞员";
  if (lineScores.growth >= 80) return "远航共生体";
  if (relation.archetype === "brightshadow") return "互怼共犯";
  if (relation.archetype === "complement") return "灵魂共犯";
  if (relation.archetype === "slowburn") return "慢热搭子";
  return "双核拍档";
}

export function buildDualReading({ relation, answers, leftMatch, rightMatch, leftFeatures, rightFeatures, identities = [] }) {
  const easterQuestion = getDualEasterQuestion(identities);
  const questionSet = easterQuestion ? [...QUESTIONS.dual, easterQuestion] : QUESTIONS.dual;
  const labels = questionLookup(questionSet, answers);
  const archetype = ARCHETYPE_CATALOG[relation.archetype];
  const lineScores = computeDualLineScores({ relation, answers, questionSet, leftFeatures, rightFeatures });
  const tacitInfluences = strongestDualInfluences(questionSet, answers, "tacit");
  const chemistryInfluences = strongestDualInfluences(questionSet, answers, "chemistry");
  const growthInfluences = strongestDualInfluences(questionSet, answers, "growth");
  const relationshipName = resolveRelationshipName({ lineScores, relation, identities, answers });

  const orbitOpening = {
    "twin-star": "你们更像月球绕着地球旋转那样的关系，一方会更自然地靠近，另一方则像一个稳定存在的引力中心。",
    slingshot: "你们像流星划过地球夜空，一旦相交就会留下强烈痕迹，所以这段关系最迷人的地方是短暂也足够亮。",
    relay: "你们更像两颗星体围绕同一个核心天体运转，不一定永远正面相撞，但会在同一个系统里反复看见彼此。",
    "nebula-drift": "你们像某种还没被探测出规律的运动，谁也说不准下一次相遇会在什么时候，却总觉得它迟早会发生。",
  }[answers.pairOrbit] || "你们不是一眼能下定义的那种关系，而是越看越会发现它内部其实有自己的轨道。";

  const needLine = {
    radar: "如果最不会被拒绝的邀约是一起去酒吧小酌一杯，说明你们之间最自然的靠近方式是松弛地交换情绪和近况。",
    spark: "如果你第一反应是一起去健身房动一动，说明这段关系对你来说不是只适合谈心，还适合一起把身体和冲劲都点热。",
    map: "如果你最想约对方去舷窗边看地球重新亮起来，说明你们之间真正动人的，不只是相处本身，还有一起看向未来的能力。",
    cabin: "如果你觉得连邀约都没有必要，直接去休眠舱就行，说明你们的熟悉度已经高到不需要额外开场，安静待着都不尴尬。",
  }[answers.pairNeed] || "";

  const sceneLine = {
    aurora: "你说对方的眼睛更像宇宙的深邃，这说明你感受到的首先不是表面的热闹，而是一种很深、很稳、会让人想继续看下去的引力。",
    rift: "你觉得那双眼睛更像黑洞和暗物质之间的危险与神秘，说明这段关系里天生就带着一点高风险却很难回头的吸引。",
    harbor: "你从对方眼里看见的是很远的星光回到身边的温柔，所以这段关系最强的不是刺激，而是可回返、可停靠、可被安放。",
    meteor: "你把对方的眼睛联想到星际大冒险的探索与冒险，说明你感受到的不是平静，而是一种会把人往未知推过去的邀请。",
  }[answers.pairScene] || "";

  const narrative = [
    orbitOpening,
    needLine,
    sceneLine,
    `从结构上看，你们更接近「${archetype.title}」：一边的纹理在${relation.similarityLabel}，另一边的靠近方式在${relation.complementLabel}。`,
    `左边的${leftMatch.nebula.titleCn || leftMatch.nebula.titleShort}和右边的${rightMatch.nebula.titleCn || rightMatch.nebula.titleShort}，像两种不同的星云秩序在互相试探，但并没有彼此抵消，反而在找新的共轨方式。`,
    `如果一定要给这段关系一个更像人话的名字，它现在更接近「${relationshipName}」。`,
    archetype.subtitle,
  ]
    .filter(Boolean)
    .join("");

  const lines = [
    {
      label: `默契线 · ${lineScores.tacit}分`,
      text: [
        dualBandSentence("tacit", lineScores.tacit),
        dualInfluenceSentence("tacit", tacitInfluences),
        tacitFeatureSentence(leftFeatures, rightFeatures, relation),
      ].join(""),
    },
    {
      label: `吸引线 · ${lineScores.chemistry}分`,
      text: [
        dualBandSentence("chemistry", lineScores.chemistry),
        dualInfluenceSentence("chemistry", chemistryInfluences),
        chemistryFeatureSentence(leftFeatures, rightFeatures, relation),
      ].join(""),
    },
    {
      label: `成长线 · ${lineScores.growth}分`,
      text: [
        dualBandSentence("growth", lineScores.growth),
        dualInfluenceSentence("growth", growthInfluences),
        growthFeatureSentence(leftFeatures, rightFeatures, relation),
      ].join(""),
    },
  ];

  const metrics = [
    { label: "同频度", value: toPercent(relation.similarity), text: relation.similarityLabel },
    { label: "互补度", value: toPercent(relation.complement), text: relation.complementLabel },
    { label: "节奏差", value: toPercent(relation.rhythmGap), text: relation.rhythmLabel },
    { label: "关系名", value: relationshipName, text: archetype.title },
  ];

  const reasons = [
    `三条线当前分布为：默契 ${lineScores.tacit} / 吸引 ${lineScores.chemistry} / 成长 ${lineScores.growth}`,
    `你们给这段关系投出的主问题答案分别是 ${labels.pairOrbit || "共轨"}、${labels.pairNeed || "守护"}、${labels.pairScene || "同看一片天"}`,
    easterQuestion && answers.pairEaster ? `隐藏题触发后，这段关系还露出了 ${labels.pairEaster} 的侧面` : `它最终会落到 ${relationshipName} 这个名字上，不只是因为像，而是因为分数结构真的朝这个方向倾斜`,
    relation.cosmicAdvice,
  ];

  const shareCaption = `我和TA在虹膜宇宙里测出了「${relationshipName}」：默契线${lineScores.tacit}分、吸引线${lineScores.chemistry}分、成长线${lineScores.growth}分。`;

  return {
    headline: relationshipName,
    subtitle: archetype.title,
    narrative,
    lines,
    metrics,
    reasons,
    relationshipName,
    shareCaption,
  };
}

export function buildFeatureReasonSummary(features) {
  const parts = [];
  if (features.radialStrength >= 0.54) parts.push("很强的向外辐射感");
  if (features.ringCount >= 3) parts.push("层层展开的环纹");
  if (features.symmetryScore >= 0.7) parts.push("相对稳定的结构平衡");
  if (features.edgeSoftness >= 0.62) parts.push("柔和而有雾感的边缘");
  if (features.textureDensity >= 0.7) parts.push("细密但不凌乱的纹理");
  return parts.slice(0, 2).join("和") || "一种不急着说明自己的内在秩序";
}

export function describeFeaturePill(label, value) {
  return `${label} · ${value}`;
}
