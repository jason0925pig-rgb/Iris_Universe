const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = process.cwd();
const FULL_PATH = path.join(ROOT, "data", "nebulae-full.json");
const V1_PATH = path.join(ROOT, "data", "nebulae-v1.json");
const META_PATH = path.join(ROOT, "image", "metadata.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashFile(filePath) {
  return crypto.createHash("md5").update(fs.readFileSync(filePath)).digest("hex");
}

function byNewest(left, right) {
  return String(right.sourceDate).localeCompare(String(left.sourceDate));
}

const full = readJson(FULL_PATH);
const v1 = readJson(V1_PATH);
const metadata = readJson(META_PATH);

const byTitle = new Map();
for (const item of full) {
  if (!byTitle.has(item.title)) byTitle.set(item.title, []);
  byTitle.get(item.title).push(item);
}

const idsToRemove = new Set();
const reasons = [];

for (const [title, items] of byTitle.entries()) {
  if (items.length < 2) continue;
  const hashes = items.map((item) => hashFile(path.join(ROOT, item.image.replace("./", ""))));
  const uniqueHashes = new Set(hashes);
  if (uniqueHashes.size === 1) {
    const sorted = [...items].sort(byNewest);
    const keep = sorted[0];
    for (const item of sorted.slice(1)) {
      idsToRemove.add(item.id);
    }
    reasons.push({
      title,
      mode: "exact-image-duplicate",
      keep: keep.id,
      remove: sorted.slice(1).map((item) => item.id),
    });
  }
}

const tarantulaTitle = "In the Heart of the Tarantula Nebula";
const tarantulaItems = [...(byTitle.get(tarantulaTitle) || [])].sort(byNewest);
if (tarantulaItems.length > 1) {
  const keep = tarantulaItems[0];
  for (const item of tarantulaItems.slice(1)) {
    idsToRemove.add(item.id);
  }
  reasons.push({
    title: tarantulaTitle,
    mode: "title-dedup-user-request",
    keep: keep.id,
    remove: tarantulaItems.slice(1).map((item) => item.id),
  });
}

const removedFullItems = full.filter((item) => idsToRemove.has(item.id));
const nextFull = full.filter((item) => !idsToRemove.has(item.id));
const nextV1 = v1.filter((item) => !idsToRemove.has(item.id));
const removedDates = new Set(removedFullItems.map((item) => item.sourceDate));
const nextMetadata = metadata.filter((item) => !removedDates.has(item.date));

for (const item of removedFullItems) {
  const optimizedImage = path.join(ROOT, item.image.replace("./", ""));
  const optimizedThumb = path.join(ROOT, item.thumb.replace("./", ""));
  const rawImage = path.join(ROOT, "image", "raw", `${item.sourceDate}.jpg`);
  for (const filePath of [optimizedImage, optimizedThumb, rawImage]) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

writeJson(FULL_PATH, nextFull);
writeJson(V1_PATH, nextV1);
writeJson(META_PATH, nextMetadata);

console.log(`full: ${full.length} -> ${nextFull.length}`);
console.log(`v1: ${v1.length} -> ${nextV1.length}`);
console.log(`metadata: ${metadata.length} -> ${nextMetadata.length}`);
console.log("removed ids:");
for (const item of removedFullItems) {
  console.log(`- ${item.id} :: ${item.title}`);
}
console.log("reasons:");
for (const reason of reasons) {
  console.log(JSON.stringify(reason));
}
