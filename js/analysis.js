import { text } from "./i18n.js?v=20260503a";

const MEDIAPIPE_VERSION = "0.10.14";
const FACE_LANDMARK_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const LEFT_IRIS_INDEXES = [468, 469, 470, 471, 472];
const RIGHT_IRIS_INDEXES = [473, 474, 475, 476, 477];

let mediaPipePromise = null;
let faceLandmarkerPromise = null;

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function average(points) {
  const total = points.reduce(
    (acc, point) => {
      acc.x += point.x;
      acc.y += point.y;
      return acc;
    },
    { x: 0, y: 0 },
  );
  return { x: total.x / points.length, y: total.y / points.length };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizeImageToCanvas(image, size = 320) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const scale = Math.min(size / image.width, size / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const offsetX = (size - drawWidth) / 2;
  const offsetY = (size - drawHeight) / 2;
  ctx.fillStyle = "#05060f";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  return canvas;
}

export function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(text("无法读取图片文件", "Could not read the image file")));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(text("图片加载失败", "Image loading failed")));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function loadMediaPipe() {
  if (!mediaPipePromise) {
    mediaPipePromise = import(
      `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/vision_bundle.mjs`
    );
  }
  return mediaPipePromise;
}

async function getFaceLandmarker() {
  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = (async () => {
      const vision = await loadMediaPipe();
      const resolver = await vision.FilesetResolver.forVisionTasks(
        `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`,
      );
      return vision.FaceLandmarker.createFromOptions(resolver, {
        baseOptions: {
          modelAssetPath: FACE_LANDMARK_MODEL,
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
    })();
  }
  return faceLandmarkerPromise;
}

function circleFromIrisLandmarks(landmarks, indexes) {
  const points = indexes.map((index) => landmarks[index]).filter(Boolean);
  if (points.length < 5) return null;
  const center = average(points);
  const radii = points.map((point) => distance(center, point));
  const radius = radii.reduce((sum, value) => sum + value, 0) / radii.length;
  return {
    x: center.x,
    y: center.y,
    radius: radius * 4.6,
  };
}

async function detectWithMediaPipe(image) {
  const landmarker = await getFaceLandmarker();
  const result = landmarker.detect(image);
  const landmarks = result.faceLandmarks?.[0];
  if (!landmarks) {
    throw new Error("No face landmarks detected");
  }

  const left = circleFromIrisLandmarks(landmarks, LEFT_IRIS_INDEXES);
  const right = circleFromIrisLandmarks(landmarks, RIGHT_IRIS_INDEXES);
  const chosen = [left, right]
    .filter(Boolean)
    .sort((a, b) => b.radius - a.radius)[0];

  if (!chosen) {
    throw new Error("No iris landmarks detected");
  }

  return {
    x: clamp(chosen.x),
    y: clamp(chosen.y),
    radius: clamp(chosen.radius, 0.12, 0.42),
    source: "mediapipe",
  };
}

function heuristicPupilDetection(image) {
  const canvas = normalizeImageToCanvas(image, 192);
  const ctx = canvas.getContext("2d");
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const gray = new Float32Array(width * height);

  for (let idx = 0; idx < gray.length; idx += 1) {
    const offset = idx * 4;
    gray[idx] = 0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2];
  }

  let best = { score: Number.POSITIVE_INFINITY, x: width / 2, y: height / 2 };
  const xStart = Math.floor(width * 0.18);
  const xEnd = Math.floor(width * 0.82);
  const yStart = Math.floor(height * 0.18);
  const yEnd = Math.floor(height * 0.82);

  for (let y = yStart; y < yEnd; y += 2) {
    for (let x = xStart; x < xEnd; x += 2) {
      const idx = y * width + x;
      const center = gray[idx];
      let local = center;
      let count = 1;
      for (let dy = -3; dy <= 3; dy += 1) {
        for (let dx = -3; dx <= 3; dx += 1) {
          const sx = clamp(x + dx, 0, width - 1);
          const sy = clamp(y + dy, 0, height - 1);
          local += gray[sy * width + sx];
          count += 1;
        }
      }
      const distancePenalty =
        Math.abs(x - width / 2) / width * 12 + Math.abs(y - height / 2) / height * 12;
      const score = local / count + distancePenalty;
      if (score < best.score) {
        best = { score, x, y };
      }
    }
  }

  const centerValue = gray[Math.round(best.y) * width + Math.round(best.x)];
  const threshold = Math.min(centerValue + 28, 92);
  let totalX = 0;
  let totalY = 0;
  let totalWeight = 0;
  let area = 0;

  for (let y = Math.max(0, best.y - 26); y < Math.min(height, best.y + 26); y += 1) {
    for (let x = Math.max(0, best.x - 26); x < Math.min(width, best.x + 26); x += 1) {
      const value = gray[y * width + x];
      if (value <= threshold) {
        const weight = threshold - value + 1;
        totalX += x * weight;
        totalY += y * weight;
        totalWeight += weight;
        area += 1;
      }
    }
  }

  if (totalWeight > 0) {
    best.x = totalX / totalWeight;
    best.y = totalY / totalWeight;
  }

  const pupilRadius = clamp(Math.sqrt(Math.max(20, area) / Math.PI) / width, 0.04, 0.11);
  const irisRadius = clamp(pupilRadius * 2.65, 0.16, 0.34);

  return {
    x: best.x / width,
    y: best.y / height,
    radius: irisRadius,
    source: "heuristic",
  };
}

export async function detectIrisCircle(image) {
  try {
    return await detectWithMediaPipe(image);
  } catch (_error) {
    return heuristicPupilDetection(image);
  }
}

export function createCropCanvas(image, circle, size = 320) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const cx = circle.x * image.width;
  const cy = circle.y * image.height;
  const radius = circle.radius * Math.min(image.width, image.height);

  ctx.fillStyle = "#05060f";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(
    image,
    cx - radius,
    cy - radius,
    radius * 2,
    radius * 2,
    0,
    0,
    size,
    size,
  );
  return canvas;
}

function buildRingMask(size, inner = 0.18, outer = 0.72) {
  const mask = new Uint8Array(size * size);
  const center = (size - 1) / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = y * size + x;
      const radius = Math.hypot(x - center, y - center) / center;
      mask[idx] = radius >= inner && radius <= outer ? 1 : 0;
    }
  }
  return mask;
}

function rgbToHsv(r, g, b) {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const delta = max - min;
  let hue = 0;

  if (delta > 0) {
    if (max === nr) hue = ((ng - nb) / delta) % 6;
    else if (max === ng) hue = (nb - nr) / delta + 2;
    else hue = (nr - ng) / delta + 4;
    hue /= 6;
    if (hue < 0) hue += 1;
  }

  const saturation = max === 0 ? 0 : delta / max;
  return { hue, saturation, value: max };
}

function inferHueFamily(weightedHue) {
  const hueDeg = weightedHue * 360;
  if (hueDeg < 50 || hueDeg > 320) return "warm";
  if (hueDeg >= 170 && hueDeg <= 290) return "cool";
  return "neutral";
}

function radialProfile(gray, size, steps = 36) {
  const center = (size - 1) / 2;
  const profile = new Float32Array(steps);
  const counts = new Uint16Array(steps);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const radius = Math.hypot(x - center, y - center) / center;
      if (radius < 0.12 || radius > 0.82) continue;
      const index = Math.min(steps - 1, Math.floor(((radius - 0.12) / 0.7) * steps));
      profile[index] += gray[y * size + x];
      counts[index] += 1;
    }
  }
  for (let idx = 0; idx < steps; idx += 1) {
    if (counts[idx] > 0) profile[idx] /= counts[idx];
  }
  return profile;
}

function smoothProfile(profile, radius = 1) {
  const smoothed = new Float32Array(profile.length);
  for (let idx = 0; idx < profile.length; idx += 1) {
    let sum = 0;
    let count = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const sampleIndex = idx + offset;
      if (sampleIndex < 0 || sampleIndex >= profile.length) continue;
      sum += profile[sampleIndex];
      count += 1;
    }
    smoothed[idx] = sum / Math.max(1, count);
  }
  return smoothed;
}

function countPeaks(profile) {
  const smoothed = smoothProfile(profile, 1);
  let minValue = Number.POSITIVE_INFINITY;
  let maxValue = Number.NEGATIVE_INFINITY;
  for (let idx = 0; idx < smoothed.length; idx += 1) {
    minValue = Math.min(minValue, smoothed[idx]);
    maxValue = Math.max(maxValue, smoothed[idx]);
  }
  const adaptiveThreshold = Math.max(1.1, (maxValue - minValue) * 0.11);
  let peaks = 0;
  for (let idx = 1; idx < smoothed.length - 1; idx += 1) {
    const center = smoothed[idx];
    const left = smoothed[idx - 1];
    const right = smoothed[idx + 1];
    const prominence = center - (left + right) / 2;
    if (center > left && center > right && prominence >= adaptiveThreshold) peaks += 1;
  }
  return Math.min(5, peaks);
}

function buildIndicators(features) {
  return {
    stability: clamp(features.symmetryScore * 0.6 + (1 - Math.abs(features.contrastLevel - 0.6)) * 0.4),
    complexity: clamp(features.textureDensity * 0.45 + (features.ringCount / 5) * 0.35 + features.radialStrength * 0.2),
    openness: clamp(features.edgeSoftness * 0.55 + features.radialStrength * 0.3 + (1 - features.textureDensity) * 0.15),
    intensity: clamp(features.contrastLevel * 0.5 + features.textureDensity * 0.25 + features.radialStrength * 0.25),
  };
}

export function extractIrisFeatures(cropCanvas) {
  const ctx = cropCanvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, cropCanvas.width, cropCanvas.height);
  const { data, width, height } = imageData;
  const size = width;
  const ringMask = buildRingMask(size);
  const gray = new Float32Array(size * size);
  const hueHist = new Float32Array(24);

  let hueWeightSum = 0;
  let hueSum = 0;
  let graySum = 0;
  let graySqSum = 0;
  let pixelCount = 0;

  for (let idx = 0; idx < size * size; idx += 1) {
    const offset = idx * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    gray[idx] = luminance;

    if (!ringMask[idx]) continue;

    const hsv = rgbToHsv(r, g, b);
    const weight = hsv.saturation * hsv.value + 0.0001;
    const bin = Math.max(0, Math.min(23, Math.floor(hsv.hue * 24)));
    hueHist[bin] += weight;
    hueSum += hsv.hue * weight;
    hueWeightSum += weight;
    graySum += luminance;
    graySqSum += luminance * luminance;
    pixelCount += 1;
  }

  const normalizedHueHist = Array.from(hueHist, (value) => value / Math.max(1e-6, hueWeightSum));
  const grayMean = graySum / Math.max(1, pixelCount);
  const grayVariance = graySqSum / Math.max(1, pixelCount) - grayMean * grayMean;
  const contrastLevel = clamp(Math.sqrt(Math.max(0, grayVariance)) / 50);

  let gradSum = 0;
  let gradCount = 0;
  let alignmentSum = 0;
  const center = (size - 1) / 2;

  for (let y = 1; y < size - 1; y += 1) {
    for (let x = 1; x < size - 1; x += 1) {
      const idx = y * size + x;
      if (!ringMask[idx]) continue;
      const gx =
        -gray[(y - 1) * size + (x - 1)] -
        2 * gray[y * size + (x - 1)] -
        gray[(y + 1) * size + (x - 1)] +
        gray[(y - 1) * size + (x + 1)] +
        2 * gray[y * size + (x + 1)] +
        gray[(y + 1) * size + (x + 1)];
      const gy =
        -gray[(y - 1) * size + (x - 1)] -
        2 * gray[(y - 1) * size + x] -
        gray[(y - 1) * size + (x + 1)] +
        gray[(y + 1) * size + (x - 1)] +
        2 * gray[(y + 1) * size + x] +
        gray[(y + 1) * size + (x + 1)];
      const gradient = Math.hypot(gx, gy);
      gradSum += gradient;
      gradCount += 1;

      const rx = x - center;
      const ry = y - center;
      const radialNorm = Math.hypot(rx, ry) || 1;
      const gradNorm = Math.hypot(gx, gy) || 1;
      alignmentSum += Math.abs((gx / gradNorm) * (rx / radialNorm) + (gy / gradNorm) * (ry / radialNorm));
    }
  }

  const textureDensity = clamp((gradSum / Math.max(1, gradCount)) / 30);
  const radialStrength = clamp(alignmentSum / Math.max(1, gradCount));

  let diffSum = 0;
  let diffCount = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = y * size + x;
      if (!ringMask[idx]) continue;
      const mirrorX = y * size + (size - 1 - x);
      const mirrorY = (size - 1 - y) * size + x;
      diffSum += Math.abs(gray[idx] - gray[mirrorX]) + Math.abs(gray[idx] - gray[mirrorY]);
      diffCount += 2;
    }
  }
  const symmetryScore = clamp(1 - diffSum / Math.max(1, diffCount) / 95);

  let outerGrad = 0;
  let outerCount = 0;
  for (let y = 1; y < size - 1; y += 1) {
    for (let x = 1; x < size - 1; x += 1) {
      const radius = Math.hypot(x - center, y - center) / center;
      if (radius < 0.58 || radius > 0.82) continue;
      const gx = gray[y * size + (x + 1)] - gray[y * size + (x - 1)];
      const gy = gray[(y + 1) * size + x] - gray[(y - 1) * size + x];
      outerGrad += Math.hypot(gx, gy);
      outerCount += 1;
    }
  }
  const edgeSoftness = clamp(1 - outerGrad / Math.max(1, outerCount) / 38);

  const profile = radialProfile(gray, size);
  const ringCount = countPeaks(profile);
  const weightedHue = hueWeightSum > 0 ? hueSum / hueWeightSum : 0;
  const hueFamily = inferHueFamily(weightedHue);

  const features = {
    hueFamily,
    hueHist: normalizedHueHist,
    contrastLevel,
    textureDensity,
    radialStrength,
    ringCount,
    symmetryScore,
    edgeSoftness,
  };

  return {
    ...features,
    indicators: buildIndicators(features),
  };
}

export function circleToCropPreview(canvas) {
  return canvas.toDataURL("image/jpeg", 0.92);
}
