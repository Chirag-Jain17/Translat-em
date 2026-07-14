"""
backend/app/services/llm_engine.py

Gemini API integration for AI-powered translation.

At startup, probes each candidate model with a real 1-token API call
to find one that actually works with the configured API key before
the first translation request arrives.
"""

import logging
import time
from typing import Optional

import google.generativeai as genai

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Candidate models (tried in order at startup) ──────────────────────────────
# gemini-1.5-flash has the best free tier (15 RPM / 1M tokens per day).
# Newer models like gemini-2.0-flash may have quota=0 on free-tier keys.
_CANDIDATE_MODELS = [
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
]

_GEN_CONFIG = genai.types.GenerationConfig(
    temperature=0.2,
    top_p=0.9,
    max_output_tokens=8192,
)

_MODEL = None
_MODEL_NAME = None

try:
    genai.configure(api_key=settings.GEMINI_API_KEY)

    for _candidate in _CANDIDATE_MODELS:
        try:
            # Probe with a real 1-token call — the only reliable way to confirm
            # a model is accessible with this API key (GenerativeModel() itself
            # never raises, it is just a Python object).
            _probe = genai.GenerativeModel(
                model_name=_candidate,
                generation_config=genai.types.GenerationConfig(max_output_tokens=1),
            )
            _probe.generate_content("Hi")

            # Probe succeeded — use this model for translations
            _MODEL = genai.GenerativeModel(
                model_name=_candidate,
                generation_config=_GEN_CONFIG,
            )
            _MODEL_NAME = _candidate
            logger.info("Gemini model confirmed working: %s", _candidate)
            break

        except Exception as probe_exc:
            err = str(probe_exc)
            if "429" in err or "RESOURCE_EXHAUSTED" in err:
                # Model exists but free-tier quota hit during probe.
                # Still usable (quota resets per minute) — accept it.
                logger.warning(
                    "Model %s hit rate limit during probe — accepting it (quota resets per minute).",
                    _candidate,
                )
                _MODEL = genai.GenerativeModel(
                    model_name=_candidate,
                    generation_config=_GEN_CONFIG,
                )
                _MODEL_NAME = _candidate
                break
            else:
                # 404 / permission denied / other — try next model
                logger.warning(
                    "Model %s not usable (%s), trying next...",
                    _candidate,
                    err[:100],
                )

    if _MODEL is None:
        logger.error(
            "No AI translation model is accessible with the current API key. "
            "Make sure the key is valid and the Generative Language API is enabled "
            "in your Google Cloud project."
        )

except Exception as exc:
    _MODEL = None
    logger.error("Failed to initialise Gemini client: %s", exc)


# ── System prompt ─────────────────────────────────────────────────────────────
_SYSTEM_PROMPT = """You are an expert professional translator with mastery over all world languages. \
Your sole task is to translate the provided text accurately and faithfully.

Rules you MUST follow without exception:
1. Preserve the EXACT structure: paragraph breaks, bullet points, numbered lists, headings, and indentation must all appear in the translated output at the same positions as the source.
2. Preserve semantic meaning precisely - never paraphrase, simplify, or embellish. Translate idioms with their culturally equivalent target-language expression.
3. Preserve ALL formatting tokens such as Markdown bold (**text**), italics (*text*), and code blocks (```).
4. Output ONLY the translated text. Do NOT include any preamble, commentary, notes, apologies, explanations, or the original source text.
5. If the source language is set to "auto", detect the language automatically before translating.
6. Proper nouns, brand names, and technical acronyms should remain unchanged unless a universally recognised target-language equivalent exists.
7. If the source text contains [Dialogue N] labels (e.g. [Dialogue 1], [Dialogue 2]), these mark separate speech bubbles extracted from an image. You MUST keep each label in the output at the same position, translating only the text beneath each label. Never merge or reorder dialogues."""


# ── Public API ────────────────────────────────────────────────────────────────

def _chunk_text(text: str, max_chars: int = 10000) -> list[str]:
    """
    Split a large block of text into manageable chunks safely under `max_chars`.
    Attempts to split by double newlines (paragraphs), then single newlines, then spaces.
    """
    chunks = []
    
    # First, split by paragraphs
    paragraphs = text.split("\n\n")
    
    current_chunk = ""
    
    for p in paragraphs:
        # If adding this paragraph exceeds the limit
        if len(current_chunk) + len(p) + 2 > max_chars and current_chunk:
            chunks.append(current_chunk.strip())
            current_chunk = ""
            
        # If a single paragraph is STILL larger than max_chars, we must split it further
        if len(p) > max_chars:
            lines = p.split("\n")
            for line in lines:
                if len(current_chunk) + len(line) + 1 > max_chars and current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = ""
                    
                if len(line) > max_chars:
                    # Very long line with no newlines, split by space
                    words = line.split(" ")
                    for word in words:
                        if len(current_chunk) + len(word) + 1 > max_chars and current_chunk:
                            chunks.append(current_chunk.strip())
                            current_chunk = ""
                        current_chunk += word + " "
                    current_chunk += "\n"
                else:
                    current_chunk += line + "\n"
        else:
            current_chunk += p + "\n\n"
            
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
        
    return chunks

def translate_text(
    text: str,
    target_language: str,
    source_language: str = "auto",
    progress_callback: Optional[callable] = None,
) -> str:
    """
    Translate *text* from *source_language* to *target_language* using Gemini.

    Parameters
    ----------
    text            : The source text to translate.
    target_language : BCP-47 language code or full language name, e.g. "fr", "French".
    source_language : BCP-47 code or "auto" for auto-detection.

    Returns
    -------
    The translated text as a plain string.

    Raises
    ------
    RuntimeError if the Gemini client is not initialised or the API call fails.
    """
    if not text or not text.strip():
        return ""

    if _MODEL is None:
        raise RuntimeError(
            "The AI translation model is not initialised. "
            "Check that GEMINI_API_KEY is set correctly in your .env file "
            "and that the Generative Language API is enabled."
        )

    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "your_gemini_api_key_here":
        raise RuntimeError(
            "GEMINI_API_KEY is not configured. "
            "Please open the .env file in the project root and set a valid API key."
        )

    # Build the user prompt
    if source_language.lower() in ("auto", ""):
        lang_instruction = f"Translate the following text into {target_language}."
    else:
        lang_instruction = (
            f"Translate the following text from {source_language} into {target_language}."
        )

    chunks = _chunk_text(text, max_chars=10000)
    translated_chunks = []
    
    for i, chunk in enumerate(chunks):
        user_prompt = f"{lang_instruction}\n\n---\n\n{chunk}"
        
        max_retries = 5
        chunk_translated = False
        
        for attempt in range(max_retries):
            try:
                response = _MODEL.generate_content([_SYSTEM_PROMPT, user_prompt])
                translated_chunks.append(response.text.strip())
                chunk_translated = True
                
                if progress_callback:
                    progress = int(((i + 1) / len(chunks)) * 100)
                    progress_callback(progress)
                
                # Sleep briefly between successful chunks to avoid bursting quota
                if i < len(chunks) - 1:
                    time.sleep(5)
                    
                break  # success, exit retry loop
                
            except Exception as exc:
                err_str = str(exc)
                if "429" in err_str or "quota" in err_str.lower() or "RESOURCE_EXHAUSTED" in err_str:
                    logger.warning("Rate limit hit on chunk %d (attempt %d/%d).", i + 1, attempt + 1, max_retries)
                    
                    # Try fallbacks
                    fallback_success = False
                    for fallback_name in _CANDIDATE_MODELS:
                        if fallback_name == _MODEL_NAME:
                            continue
                        try:
                            fallback = genai.GenerativeModel(fallback_name)
                            response = fallback.generate_content([_SYSTEM_PROMPT, user_prompt])
                            translated_chunks.append(response.text.strip())
                            logger.info("Fallback model %s succeeded for chunk %d.", fallback_name, i + 1)
                            fallback_success = True
                            chunk_translated = True
                            
                            if progress_callback:
                                progress = int(((i + 1) / len(chunks)) * 100)
                                progress_callback(progress)
                            
                            if i < len(chunks) - 1:
                                time.sleep(5)
                            break
                        except Exception as fb_exc:
                            logger.warning("Fallback %s failed: %s", fallback_name, str(fb_exc)[:80])
                            
                    if fallback_success:
                        break  # success, exit retry loop
                        
                    # If fallbacks also failed with rate limits, wait and retry
                    wait_time = 60 * (attempt + 1)
                    logger.info("All models rate limited. Sleeping for %d seconds before retry %d/%d...", wait_time, attempt + 1, max_retries)
                    time.sleep(wait_time)
                else:
                    # Non-retryable error
                    logger.error("AI translation API error on chunk %d: %s", i + 1, exc)
                    raise RuntimeError(f"AI translation error: {exc}") from exc
                    
        if not chunk_translated:
            raise RuntimeError(
                "The AI translation service has hit its rate limit and exhausted all retries. "
                "Please wait a few minutes before submitting large documents."
            )
            
    final_translation = "\n\n".join(translated_chunks)
    logger.info(
        "Translation complete via %s: %d chunks, %d chars -> %d chars",
        _MODEL_NAME,
        len(chunks),
        len(text),
        len(final_translation),
    )
    return final_translation


def detect_language(text: str) -> str:
    """
    Use Gemini to detect the language of a snippet of text.
    Returns a BCP-47 language code string (e.g. "en", "fr", "zh-CN").
    Falls back to "unknown" on failure.
    """
    if _MODEL is None or not text.strip():
        return "unknown"

    prompt = (
        "Identify the language of the following text. "
        "Reply with ONLY the BCP-47 language code (e.g. 'en', 'fr', 'zh-CN', 'ar'). "
        "Do not include any other text.\n\n"
        f"Text: {text[:500]}"
    )
    try:
        response = _MODEL.generate_content(prompt)
        return response.text.strip().lower()
    except Exception as exc:
        logger.warning("Language detection failed: %s", exc)
        return "unknown"
