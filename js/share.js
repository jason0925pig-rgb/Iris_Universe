import { nebulaName, text } from "./i18n.js?v=20260503a";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#090816");
  gradient.addColorStop(0.45, "#0f0d22");
  gradient.addColorStop(1, "#121225");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const glow1 = ctx.createRadialGradient(width * 0.78, height * 0.14, 0, width * 0.78, height * 0.14, 360);
  glow1.addColorStop(0, "rgba(255, 123, 123, 0.22)");
  glow1.addColorStop(1, "rgba(255, 123, 123, 0)");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(width * 0.2, height * 0.88, 0, width * 0.2, height * 0.88, 320);
  glow2.addColorStop(0, "rgba(116, 194, 255, 0.2)");
  glow2.addColorStop(1, "rgba(116, 194, 255, 0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  for (let idx = 0; idx < 130; idx += 1) {
    const x = (Math.sin(idx * 19.23) * 0.5 + 0.5) * width;
    const y = (Math.cos(idx * 11.81) * 0.5 + 0.5) * height;
    const radius = idx % 17 === 0 ? 2.8 : idx % 7 === 0 ? 1.9 : 1.2;
    ctx.fillStyle = idx % 9 === 0 ? "rgba(255, 208, 168, 0.66)" : "rgba(255,255,255,0.72)";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawImageCard(ctx, image, x, y, width, height, radius) {
  ctx.save();
  roundedRect(ctx, x, y, width, height, radius);
  ctx.clip();
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const offsetX = x + (width - drawWidth) / 2;
  const offsetY = y + (height - drawHeight) / 2;
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  ctx.restore();
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const chars = Array.from(text);
  let line = "";
  const lines = [];
  for (const char of chars) {
    const test = line + char;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = char;
      if (lines.length >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);

  lines.forEach((content, idx) => {
    ctx.fillText(content, x, y + idx * lineHeight);
  });
}

async function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
  });
}

export async function generateSingleShareCard(result) {
  const width = 1080;
  const height = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  drawBackground(ctx, width, height);

  const nebula = await loadImage(result.match.nebula.image);
  drawImageCard(ctx, nebula, 72, 86, 936, 860, 52);

  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.font = "700 34px Space Grotesk";
  ctx.fillText("IRIS UNIVERSE", 84, 84);

  ctx.font = "600 58px Noto Serif SC";
  ctx.fillStyle = "#fff8ea";
  drawWrappedText(ctx, result.reading.headline, 84, 1030, 720, 84, 2);

  ctx.font = "500 30px Space Grotesk";
  ctx.fillStyle = "rgba(255,255,255,0.68)";
  ctx.fillText(`${result.reading.shareLabels?.matchRate || text("匹配率", "Match")} ${result.match.matchRate}%`, 84, 1176);

  roundedRect(ctx, 84, 1216, 912, 300, 36);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.stroke();

  ctx.fillStyle = "#fff5df";
  ctx.font = "500 40px Noto Serif SC";
  drawWrappedText(ctx, result.reading.spaceMessage, 126, 1298, 830, 58, 4);

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "500 28px Space Grotesk";
  ctx.fillText(nebulaName(result.match.nebula), 84, 1570);

  ctx.font = "500 26px Space Grotesk";
  ctx.fillStyle = "rgba(255,255,255,0.52)";
  ctx.fillText(result.reading.shareLabels?.tagline || text("真实星云图像 x 可解释虹膜匹配", "Real NASA imagery x explainable iris matching"), 84, 1614);

  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.font = "700 32px Space Grotesk";
  ctx.fillText(result.reading.shareLabels?.cta || text("扫描你的眼睛，找到你的星云。", "Scan your eye. Find your nebula."), 84, 1786);

  const blob = await canvasToBlob(canvas);
  return { canvas, blob, url: URL.createObjectURL(blob) };
}

export async function generateDualShareCard(result) {
  const width = 1080;
  const height = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  drawBackground(ctx, width, height);

  const left = await loadImage(result.leftMatch.nebula.image);
  const right = await loadImage(result.rightMatch.nebula.image);

  drawImageCard(ctx, left, 72, 96, 438, 438, 42);
  drawImageCard(ctx, right, 570, 96, 438, 438, 42);

  ctx.font = "700 54px Noto Serif SC";
  ctx.fillStyle = "#fff8ea";
  drawWrappedText(ctx, result.reading.headline, 84, 634, 920, 76, 2);

  ctx.font = "500 28px Space Grotesk";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText(`${result.reading.shareLabels?.resonance || text("关系共振", "Resonance")} ${result.relation.matchRate}%`, 84, 752);

  roundedRect(ctx, 72, 804, 936, 368, 44);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.stroke();

  ctx.fillStyle = "#fff5df";
  ctx.font = "500 38px Noto Serif SC";
  drawWrappedText(ctx, result.reading.subtitle, 120, 892, 840, 58, 2);

  ctx.font = "500 32px Noto Serif SC";
  drawWrappedText(ctx, result.relation.cosmicAdvice, 120, 1016, 840, 50, 3);

  ctx.font = "700 30px Space Grotesk";
  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.fillText(nebulaName(result.leftMatch.nebula), 84, 1308);
  ctx.fillText(nebulaName(result.rightMatch.nebula), 570, 1308);

  ctx.font = "500 24px Space Grotesk";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(result.reading.shareLabels?.leftNebula || text("左眼星云", "Left Nebula"), 84, 1342);
  ctx.fillText(result.reading.shareLabels?.rightNebula || text("右眼星云", "Right Nebula"), 570, 1342);

  ctx.font = "700 32px Space Grotesk";
  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.fillText(result.reading.shareLabels?.cta || text("在虹膜宇宙里，看见你们的关系轨道。", "See your shared orbit in Iris Universe."), 84, 1764);

  const blob = await canvasToBlob(canvas);
  return { canvas, blob, url: URL.createObjectURL(blob) };
}

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}
