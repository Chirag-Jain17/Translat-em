"""
backend/app/services/pdf_engine.py

PDF text extraction using PyMuPDF (fitz).

Primary:  PyMuPDF – page-by-page text extraction with layout hinting.
Fallback: pdfplumber – if PyMuPDF is not available.
Fallback-2: Descriptive error string – never raises.

Public entry point: extract_text_from_pdf(pdf_path: str) -> str
"""

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# ── Try to load PyMuPDF ───────────────────────────────────────────────────────
_FITZ_AVAILABLE = False
try:
    import fitz  # PyMuPDF

    _FITZ_AVAILABLE = True
    logger.info("PyMuPDF (fitz) loaded successfully — version %s.", fitz.version)
except ImportError as exc:
    logger.warning("PyMuPDF not available (%s). Will try pdfplumber fallback.", exc)

# ── Try to load pdfplumber as secondary fallback ──────────────────────────────
_PDFPLUMBER_AVAILABLE = False
try:
    import pdfplumber  # type: ignore

    _PDFPLUMBER_AVAILABLE = True
    logger.info("pdfplumber available as PDF fallback.")
except ImportError:
    logger.warning("pdfplumber not available. PDF extraction will return a placeholder.")


# ── Public entry point ────────────────────────────────────────────────────────

def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Extract all readable text from the PDF file at *pdf_path*.

    Iterates over every page, calls .get_text() on each one, and joins the
    results with page-break markers so the LLM can preserve document structure.

    Parameters
    ----------
    pdf_path : Absolute or relative path to the PDF file.

    Returns
    -------
    Full document text as a single string.  Page boundaries are marked with
    '--- Page N ---' headers so the translation preserves document flow.
    """
    path = Path(pdf_path)
    if not path.exists():
        logger.error("PDF file not found: %s", pdf_path)
        return f"[ERROR] PDF file not found: {pdf_path}"

    # ── Attempt 1: PyMuPDF ────────────────────────────────────────────────────
    if _FITZ_AVAILABLE:
        try:
            doc = fitz.open(str(path))
            all_pages_text: list[str] = []

            # Iterate explicitly through all pages
            for page_number, page in enumerate(doc.pages(), start=1):
                # get_text("text") returns plain text; "blocks" returns structured data
                page_text: str = page.get_text("text")

                cleaned = page_text.strip()
                if cleaned:
                    all_pages_text.append(f"--- Page {page_number} ---\n{cleaned}")

            doc.close()

            if all_pages_text:
                full_text = "\n\n".join(all_pages_text)
                logger.info(
                    "PyMuPDF extracted %d pages / %d chars from %s",
                    len(all_pages_text),
                    len(full_text),
                    path.name,
                )
                return full_text
            else:
                logger.warning(
                    "PyMuPDF found no text in %s (may be a scanned PDF). "
                    "Returning empty-page notice.",
                    path.name,
                )
                return (
                    "[SCANNED PDF] This PDF appears to contain only scanned images "
                    "with no embedded text layer. For best results, upload the "
                    "individual page images instead so OCR can be applied."
                )
        except Exception as exc:
            logger.warning(
                "PyMuPDF failed for %s: %s. Trying pdfplumber.", path.name, exc
            )

    # ── Attempt 2: pdfplumber ─────────────────────────────────────────────────
    if _PDFPLUMBER_AVAILABLE:
        try:
            import pdfplumber

            all_pages_text = []
            with pdfplumber.open(str(path)) as pdf_doc:
                for page_number, page in enumerate(pdf_doc.pages, start=1):
                    page_text = page.extract_text() or ""
                    cleaned = page_text.strip()
                    if cleaned:
                        all_pages_text.append(f"--- Page {page_number} ---\n{cleaned}")

            if all_pages_text:
                full_text = "\n\n".join(all_pages_text)
                logger.info(
                    "pdfplumber extracted %d pages from %s", len(all_pages_text), path.name
                )
                return full_text
            else:
                return (
                    "[SCANNED PDF] No embedded text found. "
                    "Upload individual page images for OCR-based translation."
                )
        except Exception as exc:
            logger.warning("pdfplumber failed for %s: %s", path.name, exc)

    # ── Attempt 3: Graceful degradation ──────────────────────────────────────
    logger.error("All PDF engines failed for %s.", path.name)
    return (
        "[PDF EXTRACTION UNAVAILABLE] No PDF library is installed or all libraries "
        "failed.\n"
        "To enable PDF extraction:\n"
        "  • pip install pymupdf   (recommended)\n"
        "  • pip install pdfplumber  (fallback)\n\n"
        f"File: {path.name}"
    )


def get_pdf_metadata(pdf_path: str) -> dict:
    """
    Return basic metadata from a PDF file (title, author, page count).
    Returns an empty dict if extraction fails.
    """
    meta: dict = {}
    if not _FITZ_AVAILABLE:
        return meta
    try:
        import fitz

        doc = fitz.open(str(pdf_path))
        raw_meta = doc.metadata or {}
        meta["page_count"] = doc.page_count
        meta["title"] = raw_meta.get("title", "")
        meta["author"] = raw_meta.get("author", "")
        meta["subject"] = raw_meta.get("subject", "")
        doc.close()
    except Exception as exc:
        logger.debug("PDF metadata extraction failed: %s", exc)
    return meta
