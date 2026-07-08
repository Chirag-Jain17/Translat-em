"""
backend/app/services/vision_engine.py

OCR engine for image files.

Primary:  PaddleOCR  (accurate, layout-aware)
Fallback: Pillow + pytesseract (if PaddleOCR fails to import or initialise)
Fallback-2: Return a clear error message rather than crashing the server.

The function extract_text_from_image(image_path) is the public entry point.
"""

import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ── Try to load PaddleOCR ─────────────────────────────────────────────────────
_PADDLE_OCR = None
try:
    from paddleocr import PaddleOCR  # type: ignore

    # Initialise with English model; suppress verbose paddle logs
    _PADDLE_OCR = PaddleOCR(lang="en", use_angle_cls=True, show_log=False)
    logger.info("PaddleOCR initialised successfully.")
except Exception as paddle_exc:
    logger.warning(
        "PaddleOCR not available (%s). Will attempt pytesseract fallback.", paddle_exc
    )

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

def extract_text_from_image(image_path: str) -> str:
    """
    Extract all text from the image file at *image_path* using OCR.

    Order of attempts:
      1. PaddleOCR  – best accuracy, layout-aware.
      2. pytesseract – lighter fallback.
      3. Descriptive error string – never raises so the translation pipeline
         can continue with a meaningful message.

    Parameters
    ----------
    image_path : Absolute or relative path to the image file.

    Returns
    -------
    Extracted text as a single string with newlines between lines.
    """
    path = Path(image_path)
    if not path.exists():
        logger.error("Image file not found: %s", image_path)
        return f"[ERROR] Image file not found: {image_path}"

    # ── Attempt 1: PaddleOCR ─────────────────────────────────────────────────
    if _PADDLE_OCR is not None:
        try:
            result = _PADDLE_OCR.ocr(str(path), cls=True)
            lines: list[str] = []
            if result and result[0]:
                for line_group in result:
                    if line_group:
                        for item in line_group:
                            # item[1] is a tuple: (text_string, confidence_score)
                            if item and len(item) >= 2 and item[1]:
                                text_piece = item[1][0] if isinstance(item[1], (list, tuple)) else item[1]
                                if isinstance(text_piece, str) and text_piece.strip():
                                    lines.append(text_piece.strip())
            extracted = "\n".join(lines)
            if extracted.strip():
                logger.info(
                    "PaddleOCR extracted %d lines from %s", len(lines), path.name
                )
                return extracted
            else:
                logger.warning("PaddleOCR returned empty result for %s", path.name)
        except Exception as exc:
            logger.warning("PaddleOCR failed for %s: %s. Trying fallback.", path.name, exc)

    # ── Attempt 2: pytesseract ────────────────────────────────────────────────
    if _TESSERACT_AVAILABLE:
        try:
            img = Image.open(str(path))
            # Pre-process: convert to RGB if needed
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            text = pytesseract.image_to_string(img, timeout=30)
            text = text.strip()
            if text:
                logger.info(
                    "pytesseract extracted %d chars from %s", len(text), path.name
                )
                return text
            else:
                logger.warning("pytesseract returned empty text for %s", path.name)
        except Exception as exc:
            logger.warning("pytesseract failed for %s: %s", path.name, exc)

    # ── Attempt 3: Graceful degradation ──────────────────────────────────────
    logger.error(
        "All OCR engines failed for %s. Returning fallback message.", path.name
    )
    return (
        "[OCR UNAVAILABLE] The image was uploaded successfully, but no OCR engine "
        "is installed or both engines failed. To enable OCR:\n"
        "  • Install PaddleOCR:  pip install paddleocr paddlepaddle\n"
        "  • Or install Tesseract: https://github.com/UB-Mannheim/tesseract/wiki\n"
        "    Then: pip install pytesseract\n\n"
        f"File: {path.name}"
    )


def preprocess_image_for_ocr(image_path: str) -> Optional[str]:
    """
    Optional pre-processing step: enhance image contrast/sharpness before OCR.
    Returns the path to the preprocessed temp file, or None if unavailable.
    Used internally; callers can ignore the return value.
    """
    try:
        import cv2  # type: ignore
        import numpy as np

        img = cv2.imread(str(image_path))
        if img is None:
            return None

        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # Apply CLAHE for contrast normalisation
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        # Denoise
        denoised = cv2.fastNlMeansDenoising(enhanced, h=10)

        out_path = Path(image_path).with_suffix(".preprocessed.png")
        cv2.imwrite(str(out_path), denoised)
        logger.debug("Preprocessed image saved to %s", out_path)
        return str(out_path)
    except Exception as exc:
        logger.debug("Image preprocessing skipped: %s", exc)
        return None
