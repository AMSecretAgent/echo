"""
Wraps your four existing ingestion paths: paste, file import (.txt/.csv),
screenshot vision read, and Instagram Graph API pull.

REPLACE each function body with your real implementation — these are
intentionally thin so `routes/opportunities.py` has one stable interface
regardless of which ingestion path was used.
"""
from typing import List


def from_pasted_text(raw: str) -> List[str]:
    return [line.strip() for line in raw.splitlines() if line.strip()]


def from_file(contents: str) -> List[str]:
    # .txt: one comment per line. .csv: naive first-column split (replace with csv.reader if headers matter)
    lines = []
    for line in contents.splitlines():
        line = line.strip()
        if not line:
            continue
        lines.append(line.split(",")[0] if "," in line else line)
    return lines


def from_screenshot(image_bytes: bytes) -> List[str]:
    # Plug in your existing vision-based OCR/read here (needs ANTHROPIC_API_KEY per README).
    raise NotImplementedError("Wire this to your existing screenshot-reading code.")


def from_instagram(access_token: str) -> List[str]:
    # Plug in your existing Instagram Graph API comment pull here.
    raise NotImplementedError("Wire this to your existing Instagram ingestion code.")
