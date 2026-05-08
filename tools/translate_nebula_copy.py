import json
import re
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_FILES = [
    ROOT / "data" / "nebulae-full.json",
    ROOT / "data" / "nebulae-v1.json",
]
CACHE_DIR = ROOT / ".translation-cache"
CACHE_FILE = CACHE_DIR / "nebula_zh_en.json"
SOURCE_FIELDS = [
    "cosmicFact",
    "singleNarrativeSeed",
    "mainNarrativeSeed",
    "closingSeed",
]


def load_cache():
    if CACHE_FILE.exists():
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    return {}


def save_cache(cache):
    CACHE_DIR.mkdir(exist_ok=True)
    CACHE_FILE.write_text(
        json.dumps(cache, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )


def cleanup_translation(text):
    replacements = {
        " milky way": " Milky Way",
        " nasa": " NASA",
        " hubble": " Hubble",
        " james webb": " James Webb",
        " m42": " M42",
        " m31": " M31",
        " m51": " M51",
        " ta ": " TA ",
    }
    output = text.strip()
    output = output.replace("——", " - ")
    output = output.replace(" ,", ",").replace(" .", ".").replace(" ;", ";").replace(" :", ":")
    output = output.replace("“", "\"").replace("”", "\"").replace("‘", "'").replace("’", "'")
    output = re.sub(r"\s+", " ", output)
    for old, new in replacements.items():
        output = re.sub(re.escape(old), new, output, flags=re.IGNORECASE)
    output = output.replace("Iris Membrane Universe", "Iris Universe")
    output = output.replace("iris membrane", "iris")
    output = output.replace("pupil", "iris")
    output = output.replace("You are also", "So are you")
    output = output.replace("blow out this rose", "breathe this rose into being")
    output = output.replace("blew out this rose", "breathed this rose into being")
    output = output.replace("breathe this rose into being that spans", "breathe into being this rose spanning")
    output = output.replace("breathed this rose into being that spans", "breathed into being this rose spanning")
    output = output.replace("It is not a flower, it is the delivery room of an entire star.", "It is not merely a flower; it is a nursery for an entire generation of stars.")
    output = output.replace("People selected by", "People chosen by")
    output = output.replace("people selected by", "people chosen by")
    output = output.replace("The person selected by", "The person chosen by")
    output = output.replace("the person selected by", "the person chosen by")
    output = output.replace("\"Rose Nebula\"", "\"Rosette Nebula\"")
    output = output.replace("very hard or very soft", "unyielding or soft")
    output = output.replace(
        "You too, underneath the seemingly gentle outer shell, is a very powerful person.",
        "So are you: beneath the seemingly gentle shell is someone with real power.",
    )
    return output.strip()


def translate_once(text, retry=3):
    params = urllib.parse.urlencode(
        {
            "client": "gtx",
            "sl": "zh-CN",
            "tl": "en",
            "dt": "t",
            "q": text,
        }
    )
    url = f"https://translate.googleapis.com/translate_a/single?{params}"
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    last_error = None
    for attempt in range(retry):
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                payload = json.loads(response.read().decode("utf-8"))
            translated = "".join(part[0] for part in payload[0] if part and part[0])
            return cleanup_translation(translated)
        except Exception as error:  # noqa: BLE001 - script should keep translating the rest.
            last_error = error
            time.sleep(0.8 + attempt * 0.8)
    raise RuntimeError(f"Failed to translate text after retries: {last_error}")


def fallback_copy(item, source):
    name = item.get("title") or item.get("titleShort") or item.get("titleCn") or "This deep-sky object"
    category = item.get("category") or "deep-sky object"
    shape = ", ".join(item.get("shapeTags") or []) or "luminous structure"
    mood = ", ".join(item.get("moodTags") or []) or "quiet cosmic mood"
    return (
        f"{name} is a real NASA {category} image with {shape} and a {mood}. "
        "In this reading, its light becomes a mirror for the part of you that is hard to summarize: "
        "not a scientific diagnosis, but a poetic translation of color, rhythm, and structure."
    )


def has_cjk(text):
    return bool(re.search(r"[\u4e00-\u9fff]", text or ""))


def split_zh_sentences(text):
    parts = re.split(r"(?<=[。！？])", text)
    return [part.strip() for part in parts if part.strip()]


def translate_text(text):
    translated = translate_once(text)
    if not has_cjk(translated):
        return translated

    sentence_outputs = []
    for sentence in split_zh_sentences(text):
        sentence_outputs.append(translate_once(sentence))
        time.sleep(0.08)
    translated = cleanup_translation(" ".join(sentence_outputs))
    return translated


def main():
    cache = load_cache()
    datasets = {path: json.loads(path.read_text(encoding="utf-8")) for path in DATA_FILES}
    unique_texts = []
    for items in datasets.values():
        for item in items:
            for field in SOURCE_FIELDS:
                value = (item.get(field) or "").strip()
                if value and (value not in cache or has_cjk(cache.get(value))):
                    unique_texts.append(value)

    unique_texts = sorted(set(unique_texts), key=len)
    print(f"Need translations: {len(unique_texts)}")
    if unique_texts:
        completed = 0
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = {executor.submit(translate_text, text): text for text in unique_texts}
            for future in as_completed(futures):
                source = futures[future]
                try:
                    cache[source] = future.result()
                except Exception as error:  # noqa: BLE001
                    print(f"WARNING: {error}")
                completed += 1
                if completed % 50 == 0:
                    print(f"Translated {completed}/{len(unique_texts)}")
                    save_cache(cache)
        save_cache(cache)

    for path, items in datasets.items():
        for item in items:
            for field in SOURCE_FIELDS:
                source = (item.get(field) or "").strip()
                english = cleanup_translation(cache.get(source) or fallback_copy(item, source))
                if has_cjk(english):
                    english = fallback_copy(item, source)
                item[f"{field}En"] = english

        missing = []
        for item in items:
            for field in SOURCE_FIELDS:
                english_field = f"{field}En"
                if not item.get(english_field) or has_cjk(item.get(english_field)):
                    missing.append((item.get("id"), english_field))
        if missing:
            raise SystemExit(f"{path.name} still has untranslated fields: {missing[:10]}")

        path.write_text(
            json.dumps(items, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"Updated {path.relative_to(ROOT)}: {len(items)} items")


if __name__ == "__main__":
    main()
