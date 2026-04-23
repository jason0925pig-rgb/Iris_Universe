from __future__ import annotations

import subprocess
import sys
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "assets" / "fonts"
CACHE_DIR = ROOT / ".font-cache"
TEXT_PATH = CACHE_DIR / "subset-text.txt"

FONT_SOURCES = {
    "noto-serif-sc-400": "https://fonts.gstatic.com/s/notoserifsc/v35/H4cyBXePl9DZ0Xe7gG9cyOj7uK2-n-D2rd4FY7SCqyWv.ttf",
    "noto-serif-sc-500": "https://fonts.gstatic.com/s/notoserifsc/v35/H4cyBXePl9DZ0Xe7gG9cyOj7uK2-n-D2rd4FY7SwqyWv.ttf",
    "noto-serif-sc-600": "https://fonts.gstatic.com/s/notoserifsc/v35/H4cyBXePl9DZ0Xe7gG9cyOj7uK2-n-D2rd4FY7RcrCWv.ttf",
    "noto-serif-sc-700": "https://fonts.gstatic.com/s/notoserifsc/v35/H4cyBXePl9DZ0Xe7gG9cyOj7uK2-n-D2rd4FY7RlrCWv.ttf",
    "space-grotesk-400": "https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj7oUUsj.ttf",
    "space-grotesk-500": "https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj7aUUsj.ttf",
    "space-grotesk-700": "https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj4PVksj.ttf",
}

TEXT_SOURCES = [
    ROOT / "index.html",
    ROOT / "README.md",
    *sorted((ROOT / "js").glob("*.js")),
    *sorted((ROOT / "styles").glob("*.css")),
    *sorted((ROOT / "data").glob("*.json")),
]

EXTRA_TEXT = (
    " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`"
    "abcdefghijklmnopqrstuvwxyz{|}~"
    "，。！？：；（）《》“”‘’、·…—"
)


def collect_text() -> str:
    parts: list[str] = [EXTRA_TEXT]
    for path in TEXT_SOURCES:
        parts.append(path.read_text(encoding="utf-8"))
    return "".join(parts)


def unique_text(text: str) -> str:
    seen = set()
    ordered = []
    for char in text:
      if char not in seen:
        seen.add(char)
        ordered.append(char)
    return "".join(ordered)


def download_font(name: str, url: str) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    target = CACHE_DIR / f"{name}.ttf"
    if not target.exists():
        urllib.request.urlretrieve(url, target)
    return target


def subset_font(source: Path, output: Path) -> None:
    subprocess.run(
        [
            sys.executable,
            "-m",
            "fontTools.subset",
            str(source),
            f"--output-file={output}",
            "--flavor=woff2",
            f"--text-file={TEXT_PATH}",
            "--layout-features=*",
            "--name-IDs=*",
            "--name-legacy",
            "--symbol-cmap",
            "--legacy-cmap",
            "--notdef-glyph",
            "--notdef-outline",
            "--recommended-glyphs",
        ],
        check=True,
    )


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    TEXT_PATH.write_text(unique_text(collect_text()), encoding="utf-8")

    for font_name, font_url in FONT_SOURCES.items():
        source_path = download_font(font_name, font_url)
        output_path = OUTPUT_DIR / f"{font_name}-subset.woff2"
        subset_font(source_path, output_path)
        print(f"built {output_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
