"""
backend/app/services/vision_engine.py

OCR engine for image files.

Primary:  PaddleOCR  (accurate, layout-aware, supports 80+ languages)
Fallback: Pillow + pytesseract (if PaddleOCR fails to import or initialise)
Fallback-2: Return a clear error message rather than crashing the server.

The function extract_text_from_image(image_path, source_language) is the
public entry point. It selects the correct OCR language model based on the
source language passed in from the translation request.
"""

import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


# ── PaddleOCR language code mapping ──────────────────────────────────────────
# Maps BCP-47 / common language names -> PaddleOCR lang codes.
# Latin-script languages all use 'en' (the English model covers them).
# CJK and other scripts have dedicated models.
_LANG_MAP: dict[str, str] = {
    # CJK
    "zh":            "ch",
    "zh-cn":         "ch",
    "zh-hans":       "ch",
    "chinese":       "ch",
    "chinese (s)":   "ch",
    "chinese (simplified)": "ch",
    "zh-tw":         "chinese_cht",
    "zh-hant":       "chinese_cht",
    "chinese (t)":   "chinese_cht",
    "chinese (traditional)": "chinese_cht",
    "ja":            "japan",
    "ja-jp":         "japan",
    "japanese":      "japan",
    "ko":            "korean",
    "ko-kr":         "korean",
    "korean":        "korean",
    # Cyrillic
    "ru":            "cyrillic",
    "uk":            "cyrillic",
    "bg":            "cyrillic",
    "russian":       "cyrillic",
    "ukrainian":     "cyrillic",
    # Arabic / RTL
    "ar":            "arabic",
    "arabic":        "arabic",
    "fa":            "arabic",   # Persian uses Arabic script
    "ur":            "arabic",   # Urdu uses Arabic script
    "persian":       "arabic",
    "urdu":          "arabic",
    # Devanagari
    "hi":            "hi",
    "hindi":         "hi",
    # Tamil
    "ta":            "ta",
    "tamil":         "ta",
    # Thai
    "th":            "th",
    "thai":          "th",
    # Vietnamese
    "vi":            "vi",
    "vietnamese":    "vi",
    # Latin-script languages — all handled by the English model
    "en":            "en",
    "english":       "en",
    "fr":            "en",
    "french":        "en",
    "de":            "en",
    "german":        "en",
    "es":            "en",
    "spanish":       "en",
    "it":            "en",
    "italian":       "en",
    "pt":            "en",
    "portuguese":    "en",
    "nl":            "en",
    "dutch":         "en",
    "pl":            "en",
    "polish":        "en",
    "sv":            "en",
    "swedish":       "en",
    "id":            "en",
    "indonesian":    "en",
    "bn":            "en",
    "bengali":       "en",
    "turkish":       "en",
    "tr":            "en",
}

# Default: Chinese model handles CJK + is the most versatile for "auto"
_DEFAULT_PADDLE_LANG = "ch"


def _source_to_paddle_lang(source_language: str) -> str:
    """Map a BCP-47 / human language name to a PaddleOCR lang code."""
    key = source_language.strip().lower()
    return _LANG_MAP.get(key, _DEFAULT_PADDLE_LANG if key == "auto" else "en")


# ── Lazy-initialised OCR cache: paddle_lang_code -> PaddleOCR instance ────────
_PADDLE_AVAILABLE = False
_OCR_CACHE: dict[str, object] = {}

try:
    from paddleocr import PaddleOCR  # type: ignore
    _PADDLE_AVAILABLE = True
    logger.info("PaddleOCR is available.")
except ImportError as _pe:
    logger.warning("PaddleOCR not available (%s). Will use pytesseract fallback.", _pe)


def _get_paddle_ocr(paddle_lang: str):
    """Return a cached PaddleOCR instance for *paddle_lang*, initialising if needed."""
    if paddle_lang not in _OCR_CACHE:
        logger.info("Initialising PaddleOCR model for lang='%s' (first-use download may occur).", paddle_lang)
        try:
            _OCR_CACHE[paddle_lang] = PaddleOCR(
                lang=paddle_lang,
                use_angle_cls=True,
                show_log=False,
            )
            logger.info("PaddleOCR model ready for lang='%s'.", paddle_lang)
        except Exception as exc:
            logger.warning("PaddleOCR lang='%s' init failed: %s", paddle_lang, exc)
            return None
    return _OCR_CACHE.get(paddle_lang)


# ── Try to load pytesseract as secondary fallback ─────────────────────────────
_TESSERACT_AVAILABLE = False
try:
    import pytesseract  # type: ignore
    from PIL import Image  # type: ignore
    _TESSERACT_AVAILABLE = True
    logger.info("pytesseract available as OCR fallback.")
except ImportError:
    logger.warning("pytesseract not available. OCR will return a placeholder message.")


# ── Public entry point ────────────────────────────────────────────────────────

def extract_text_from_image(image_path: str, source_language: str = "auto") -> str:
    """
    Extract all text from the image file at *image_path* using OCR.

    Parameters
    ----------
    image_path      : Absolute or relative path to the image file.
    source_language : BCP-47 code or language name of the text in the image
                      (e.g. 'ja', 'japanese', 'zh', 'en', 'auto').
                      Used to select the correct OCR model.

    Order of attempts:
      1. PaddleOCR with the language-specific model.
      2. PaddleOCR with the 'ch' (Chinese/CJK) model as fallback if the first
         model returns nothing.
      3. pytesseract.
      4. Descriptive error string — never raises.
    """
    path = Path(image_path)
    if not path.exists():
        logger.error("Image file not found: %s", image_path)
        return f"[ERROR] Image file not found: {image_path}"

    paddle_lang = _source_to_paddle_lang(source_language)
    logger.info(
        "OCR for '%s': source_language='%s' -> paddle_lang='%s'",
        path.name, source_language, paddle_lang,
    )

    # ── Attempt 1: PaddleOCR with correct language model ─────────────────────
    if _PADDLE_AVAILABLE:
        extracted = _run_paddle_ocr(path, paddle_lang)
        if extracted:
            return extracted

        # If the primary model returned nothing, try the Chinese model (covers
        # Japanese and Korean reasonably well as a second pass)
        if paddle_lang not in ("ch", "en"):
            logger.info("Primary OCR model returned nothing — trying 'ch' fallback.")
            extracted = _run_paddle_ocr(path, "ch")
            if extracted:
                return extracted

    # ── Attempt 2: pytesseract ────────────────────────────────────────────────
    if _TESSERACT_AVAILABLE:
        try:
            img = Image.open(str(path))
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            text = pytesseract.image_to_string(img, timeout=30).strip()
            if text:
                logger.info("pytesseract extracted %d chars from %s", len(text), path.name)
                return text
            logger.warning("pytesseract returned empty text for %s", path.name)
        except Exception as exc:
            logger.warning("pytesseract failed for %s: %s", path.name, exc)

    # ── Attempt 3: Graceful degradation ──────────────────────────────────────
    logger.error("All OCR engines failed for %s.", path.name)
    return (
        "[OCR UNAVAILABLE] The image was uploaded successfully, but no OCR engine "
        "could extract text from it. To enable image translation:\n"
        "  • Install PaddleOCR:  pip install paddleocr paddlepaddle\n"
        "  • Or install Tesseract: https://github.com/UB-Mannheim/tesseract/wiki\n"
        "    Then: pip install pytesseract\n\n"
        f"File: {path.name}"
    )


def _group_by_bubble(ocr_page: list) -> str:
    """
    Given a single-page PaddleOCR result (a flat list of [bbox, (text, conf)]
    items), cluster text boxes into speech bubbles based on horizontal
    proximity and return a formatted string with [Dialogue N] headers.

    Algorithm
    ---------
    1. Compute the center-X and center-Y of each bounding box.
    2. Sort boxes by center-X (left → right).
    3. Walk the sorted list; if the X gap between consecutive boxes exceeds
       the threshold (2 × median box width), start a new bubble.
    4. Within each bubble, sort boxes top-to-bottom (by center-Y).
    5. Join bubbles with clear [Dialogue N] headers.
    """
    # ── Parse into structured records ────────────────────────────────────────
    records: list[dict] = []
    for item in ocr_page:
        if not item or len(item) < 2:
            continue
        bbox = item[0]  # [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
        text_info = item[1]
        text = text_info[0] if isinstance(text_info, (list, tuple)) else text_info
        if not isinstance(text, str) or not text.strip():
            continue
        xs = [pt[0] for pt in bbox]
        ys = [pt[1] for pt in bbox]
        records.append({
            "text": text.strip(),
            "cx": sum(xs) / 4,
            "cy": sum(ys) / 4,
            "box_w": max(xs) - min(xs),
        })

    if not records:
        return ""

    # ── Compute gap threshold (2× median box width) ───────────────────────────
    sorted_widths = sorted(r["box_w"] for r in records)
    median_w = sorted_widths[len(sorted_widths) // 2]
    threshold = max(median_w * 2.0, 40.0)  # never smaller than 40 px

    # ── Sort left → right, then cluster by X gap ─────────────────────────────
    records.sort(key=lambda r: r["cx"])
    bubbles: list[list[dict]] = [[records[0]]]
    for rec in records[1:]:
        # Distance from this box's center to the rightmost box in current bubble
        rightmost_cx = max(b["cx"] for b in bubbles[-1])
        if rec["cx"] - rightmost_cx > threshold:
            bubbles.append([rec])
        else:
            bubbles[-1].append(rec)

    # ── Sort each bubble top → bottom, build output ───────────────────────────
    parts: list[str] = []
    for idx, bubble in enumerate(bubbles, start=1):
        bubble.sort(key=lambda r: r["cy"])
        lines = [r["text"] for r in bubble]
        header = f"[Dialogue {idx}]" if len(bubbles) > 1 else ""
        block = "\n".join(lines)
        parts.append(f"{header}\n{block}" if header else block)

    return "\n\n".join(parts)


def _run_paddle_ocr(path: Path, paddle_lang: str) -> str:
    """Run PaddleOCR for *paddle_lang* on *path*. Returns extracted text or ''."""
    ocr = _get_paddle_ocr(paddle_lang)
    if ocr is None:
        return ""
    try:
        result = ocr.ocr(str(path), cls=True)
        if not result or not result[0]:
            logger.warning("PaddleOCR (lang=%s) returned empty result for %s", paddle_lang, path.name)
            return ""

        extracted = _group_by_bubble(result[0])
        if extracted.strip():
            bubble_count = extracted.count("[Dialogue")
            logger.info(
                "PaddleOCR (lang=%s) extracted %d dialogue(s) from %s",
                paddle_lang, max(bubble_count, 1), path.name,
            )
            return extracted

        logger.warning("PaddleOCR (lang=%s) returned empty result for %s", paddle_lang, path.name)
        return ""
    except Exception as exc:
        logger.warning("PaddleOCR (lang=%s) failed for %s: %s", paddle_lang, path.name, exc)
        return ""


def preprocess_image_for_ocr(image_path: str) -> Optional[str]:
    """
    Optional pre-processing step: enhance image contrast/sharpness before OCR.
    Returns the path to the preprocessed temp file, or None if unavailable.
    """
    try:
        import cv2  # type: ignore
        import numpy as np

        img = cv2.imread(str(image_path))
        if img is None:
            return None

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        denoised = cv2.fastNlMeansDenoising(enhanced, h=10)

        out_path = Path(image_path).with_suffix(".preprocessed.png")
        cv2.imwrite(str(out_path), denoised)
        logger.debug("Preprocessed image saved to %s", out_path)
        return str(out_path)
    except Exception as exc:
        logger.debug("Image preprocessing skipped: %s", exc)
        return None
