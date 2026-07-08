"""
backend/app/services/llm_engine.py

Gemini API integration for AI-powered translation.

At startup, probes each candidate model with a real 1-token API call
to find one that actually works with the configured API key before
the first translation request arrives.
"""

import logging
from typing import Optional

import google.generativeai as genai

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Candidate models (tried in order at startup) ──────────────────────────────
# gemini-1.5-flash has the best free tier (15 RPM / 1M tokens per day).
# Newer models like gemini-2.0-flash may have quota=0 on free-tier keys.
_CANDIDATE_MODELS = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-002",
    "gemini-1.5-flash-8b",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-pro-latest",
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
6. Proper nouns, brand names, and technical acronyms should remain unchanged unless a universally recognised target-language equivalent exists."""


# ── Public API ────────────────────────────────────────────────────────────────

def translate_text(
    text: str,
    target_language: str,
    source_language: str = "auto",
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

    user_prompt = f"{lang_instruction}\n\n---\n\n{text}"

    try:
        response = _MODEL.generate_content([_SYSTEM_PROMPT, user_prompt])
        translated = response.text.strip()
        logger.info(
            "Translation complete via %s: %d chars -> %d chars",
            _MODEL_NAME,
            len(text),
            len(translated),
        )
        return translated

    except Exception as exc:
        err_str = str(exc)

        # 429 / quota exceeded: try each fallback model once before giving up
        if "429" in err_str or "quota" in err_str.lower() or "RESOURCE_EXHAUSTED" in err_str:
            logger.warning("Quota exceeded on %s — trying fallback models.", _MODEL_NAME)
            for fallback_name in _CANDIDATE_MODELS:
                if fallback_name == _MODEL_NAME:
                    continue
                try:
                    fallback = genai.GenerativeModel(
                        model_name=fallback_name,
                        generation_config=_GEN_CONFIG,
                    )
                    response = fallback.generate_content([_SYSTEM_PROMPT, user_prompt])
                    translated = response.text.strip()
                    logger.info("Fallback model %s succeeded.", fallback_name)
                    return translated
                except Exception as fb_exc:
                    logger.warning("Fallback %s also failed: %s", fallback_name, str(fb_exc)[:80])

            raise RuntimeError(
                "The AI translation service has hit its rate limit. "
                "Please wait ~60 seconds and try again, or check your quota at "
                "https://ai.google.dev/gemini-api/docs/rate-limits"
            ) from exc

        logger.error("AI translation API error: %s", exc)
        raise RuntimeError(f"AI translation error: {exc}") from exc


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
