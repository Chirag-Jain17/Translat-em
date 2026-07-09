/**
 * src/pages/Home.jsx
 *
 * Page 1: The Translation Studio
 *
 * Sections:
 *   1. Hero — Serif headline + subtitle
 *   2. Action Board — Two cards to select input mode (text vs file)
 *   3. Active Workspace:
 *        State A: Text input/output split panel with language dropdowns
 *        State B: File drag-and-drop upload zone
 *   4. Result display panel
 */

import { useState, useRef, useCallback, useEffect } from "react";
import {
  FileText,
  Image,
  Upload,
  ArrowRight,
  Languages,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  RefreshCw,
  ChevronDown,
  Sparkles,
  X,
  FileUp,
  Compass,
} from "lucide-react";

const API_BASE_URL = "http://localhost:8000";

// ── Language options ──────────────────────────────────────────────────────────
const LANGUAGES = [
  { code: "auto",  label: "Auto Detect"   },
  { code: "en",    label: "English"       },
  { code: "fr",    label: "French"        },
  { code: "es",    label: "Spanish"       },
  { code: "de",    label: "German"        },
  { code: "it",    label: "Italian"       },
  { code: "pt",    label: "Portuguese"    },
  { code: "ru",    label: "Russian"       },
  { code: "zh",    label: "Chinese (S)"   },
  { code: "zh-TW", label: "Chinese (T)"   },
  { code: "ja",    label: "Japanese"      },
  { code: "ko",    label: "Korean"        },
  { code: "ar",    label: "Arabic"        },
  { code: "hi",    label: "Hindi"         },
  { code: "bn",    label: "Bengali"       },
  { code: "tr",    label: "Turkish"       },
  { code: "nl",    label: "Dutch"         },
  { code: "pl",    label: "Polish"        },
  { code: "sv",    label: "Swedish"       },
  { code: "vi",    label: "Vietnamese"    },
  { code: "th",    label: "Thai"          },
  { code: "id",    label: "Indonesian"    },
  { code: "uk",    label: "Ukrainian"     },
  { code: "fa",    label: "Persian"       },
  { code: "ur",    label: "Urdu"          },
];

// ── LanguageSelect ────────────────────────────────────────────────────────────
function LanguageSelect({ value, onChange, excludeAuto = false, label }) {
  const options = excludeAuto
    ? LANGUAGES.filter((l) => l.code !== "auto")
    : LANGUAGES;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="select pr-10 appearance-none"
        >
          {options.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={15}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
      </div>
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    done:       { cls: "badge-done",       label: "Done"       },
    pending:    { cls: "badge-pending",    label: "Pending"    },
    processing: { cls: "badge-processing", label: "Processing" },
    error:      { cls: "badge-error",      label: "Error"      },
  };
  const { cls, label } = map[status] ?? map.pending;
  return <span className={cls}>{label}</span>;
}

// ── CopyButton ────────────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="btn-ghost text-xs"
      title="Copy to clipboard"
    >
      {copied ? (
        <><CheckCircle2 size={13} className="text-emerald-500" /> Copied!</>
      ) : (
        <><Copy size={13} /> Copy</>
      )}
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Home({ navigate }) {
  // ── Mode: 'text' | 'file' ──
  const [mode, setMode] = useState(null); // null = not yet chosen

  // ── Text mode state ──
  const [sourceText, setSourceText] = useState("");
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("en");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("anonymous");
  const [isPublic, setIsPublic] = useState(true);

  // ── File mode state ──
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  // ── Result state ──
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);    // TranslationResponse | null
  const [error, setError] = useState(null);

  // ── Polling state for async file jobs ──
  const [pollingId, setPollingId] = useState(null);
  const pollingRef = useRef(null);

  // Clear polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // ── Poll the status endpoint every 2.5s until done/error ─────────────────
  const startPolling = useCallback((id) => {
    setPollingId(id);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/translate/${id}/status`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "done" || data.status === "error") {
          clearInterval(pollingRef.current);
          setPollingId(null);
          setLoading(false);
          if (data.status === "done") {
            // Fetch full record to show in result panel
            const full = await fetch(`${API_BASE_URL}/api/translate/${id}`);
            if (full.ok) setResult(await full.json());
          } else {
            setError(data.error_message || "Translation failed.");
          }
        }
      } catch {
        clearInterval(pollingRef.current);
        setPollingId(null);
        setLoading(false);
        setError("Network error while checking translation status.");
      }
    }, 2500);
  }, []);

  // ── Handle text translation ───────────────────────────────────────────────
  const handleTextTranslate = async () => {
    if (!sourceText.trim()) return;
    if (targetLang === "auto") {
      setError("Please select a specific target language.");
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/translate/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sourceText,
          source_language: sourceLang,
          target_language: targetLang,
          title: title || "Quick Translation",
          author: author || "anonymous",
          is_public: isPublic,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Translation failed. Please check your API key.");
      } else {
        setResult(data);
      }
    } catch (err) {
      setError("Could not reach the backend. Is the server running on port 8000?");
    } finally {
      setLoading(false);
    }
  };

  // ── Handle file translation ───────────────────────────────────────────────
  const handleFileTranslate = async () => {
    if (!file) return;
    if (targetLang === "auto") {
      setError("Please select a specific target language.");
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("source_language", sourceLang);
    formData.append("target_language", targetLang);
    formData.append("title", title || file.name);
    formData.append("author", author || "anonymous");
    formData.append("is_public", isPublic.toString());

    try {
      const res = await fetch(`${API_BASE_URL}/api/translate/file`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setLoading(false);
        setError(data.detail || "File upload failed.");
      } else {
        // Start polling for async completion
        startPolling(data.id);
      }
    } catch (err) {
      setLoading(false);
      setError("Could not reach the backend. Is the server running on port 8000?");
    }
  };

  // ── Drag & Drop handlers ─────────────────────────────────────────────────
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };
  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  const handleFileInput = (e) => {
    const chosen = e.target.files[0];
    if (chosen) setFile(chosen);
  };

  // ── Download result as .txt ──────────────────────────────────────────────
  const handleDownload = () => {
    if (!result?.result_text) return;
    const blob = new Blob([result.result_text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.title || "translation"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Reset ────────────────────────────────────────────────────────────────
  const reset = () => {
    setMode(null);
    setSourceText("");
    setFile(null);
    setResult(null);
    setError(null);
    setLoading(false);
    if (pollingRef.current) clearInterval(pollingRef.current);
    setPollingId(null);
    setTitle("");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-14">

      {/* ════════════ HERO ════════════ */}
      <section className="text-center space-y-5 animate-slide-up">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 rounded-full border border-indigo-100 mb-2">
          <Sparkles size={13} className="text-indigo-600" />
          <span className="text-xs font-semibold text-indigo-700 tracking-wide">
            Powered by Advanced AI
          </span>
        </div>

        <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.1] text-slate-900">
          Translate{" "}
          <span className="gradient-text italic">Anything.</span>
          <br />
          <span className="text-slate-500 text-4xl sm:text-5xl font-normal">Instantly.</span>
        </h1>

        <p className="text-lg text-slate-500 max-w-2xl mx-auto font-sans leading-relaxed">
          Paste your text, upload an image, or drop a PDF —{" "}
          our AI engine extracts, translates, and preserves the exact structure
          across <strong className="text-slate-700">100+ languages</strong>.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-sm text-slate-500">
          {["Text", "Images (OCR)", "PDF Documents", "100+ Languages"].map((feat) => (
            <span key={feat} className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-500" />
              {feat}
            </span>
          ))}
        </div>
      </section>

      {/* ════════════ ACTION BOARD ════════════ */}
      {!mode && !result && (
        <section className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <h2 className="text-center text-xl font-semibold text-slate-700 mb-6">
            Choose your input type
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto">

            {/* Card 1: Paste Text */}
            <button
              onClick={() => setMode("text")}
              className="card p-8 flex flex-col items-center gap-4 text-center group cursor-pointer
                         hover:border-indigo-200 hover:shadow-card-hover"
            >
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center
                              group-hover:bg-indigo-100 transition-colors duration-150">
                <FileText size={28} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-serif font-bold text-slate-900 mb-1">
                  Paste Custom Text
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Type or paste any text and get an instant AI translation with full semantic fidelity.
                </p>
              </div>
              <span className="btn-primary mt-2 text-xs">
                Open Text Studio <ArrowRight size={13} />
              </span>
            </button>

            {/* Card 2: Upload File */}
            <button
              onClick={() => setMode("file")}
              className="card p-8 flex flex-col items-center gap-4 text-center group cursor-pointer
                         hover:border-indigo-200 hover:shadow-card-hover"
            >
              <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center
                              group-hover:bg-violet-100 transition-colors duration-150">
                <Upload size={28} className="text-violet-600" />
              </div>
              <div>
                <h3 className="text-lg font-serif font-bold text-slate-900 mb-1">
                  Upload Image / PDF
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Upload a scanned document or image. OCR extracts the text and our AI engine translates it.
                </p>
              </div>
              <span className="btn-primary mt-2 text-xs bg-violet-600 hover:bg-violet-700">
                Upload File <ArrowRight size={13} />
              </span>
            </button>
          </div>
        </section>
      )}

      {/* ════════════ WORKSPACE ════════════ */}
      {mode && !result && (
        <section className="animate-slide-up space-y-6">

          {/* ── Workspace Header ── */}
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-serif font-bold text-slate-900">
              {mode === "text" ? "Text Translation Studio" : "File Translation Studio"}
            </h2>
            <button onClick={reset} className="btn-ghost text-sm">
              <X size={14} /> Back
            </button>
          </div>

          {/* ── Metadata row ── */}
          <div className="card p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Document Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={mode === "file" && file ? file.name : "e.g. Legal Contract 2024"}
                className="input"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Author Name
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="anonymous"
                className="input"
              />
            </div>
            <div className="flex flex-col gap-1 justify-end">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Visibility
              </label>
              <div className="flex items-center gap-3 h-[42px]">
                <button
                  onClick={() => setIsPublic(!isPublic)}
                  className="toggle-container"
                  aria-label={isPublic ? "Make private" : "Make public"}
                >
                  <div className={`toggle-track ${isPublic ? "bg-indigo-500" : "bg-slate-200"}`}>
                    <div className={`toggle-thumb ${isPublic ? "translate-x-5" : "translate-x-0"}`} />
                  </div>
                </button>
                <span className="text-sm font-medium text-slate-600">
                  {isPublic ? "Public" : "Private"}
                </span>
              </div>
            </div>
          </div>

          {/* ── Language row ── */}
          <div className="card p-5 flex flex-col sm:flex-row items-end gap-4">
            <div className="flex-1">
              <LanguageSelect
                value={sourceLang}
                onChange={setSourceLang}
                label="Source Language"
              />
            </div>
            <div className="flex items-center justify-center pb-1">
              <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
                <ArrowRight size={16} className="text-indigo-500" />
              </div>
            </div>
            <div className="flex-1">
              <LanguageSelect
                value={targetLang}
                onChange={setTargetLang}
                excludeAuto
                label="Target Language"
              />
            </div>
          </div>

          {/* ════ STATE A: Text Input ════ */}
          {mode === "text" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Source panel */}
              <div className="card p-1 flex flex-col">
                <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                    Source Text
                  </span>
                  <span className="text-xs text-slate-400">
                    {sourceText.length.toLocaleString()} chars
                  </span>
                </div>
                <textarea
                  className="textarea flex-1 border-none rounded-none rounded-b-xl focus:ring-0 min-h-[300px]"
                  placeholder="Paste or type your text here…

The AI will preserve paragraph breaks, bullet points, headings, and all formatting exactly as they appear in the source."
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                />
              </div>

              {/* Output panel (placeholder) */}
              <div className="card p-1 flex flex-col bg-slate-50/50">
                <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                    Translation Output
                  </span>
                  <span className="text-xs text-slate-400 italic">
                    Will appear here after translation
                  </span>
                </div>
                <div className="flex-1 min-h-[300px] px-4 py-3 flex items-center justify-center">
                  <div className="text-center text-slate-300 space-y-2">
                    <Languages size={40} className="mx-auto" />
                    <p className="text-sm">Your translation will appear here</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════ STATE B: File Drop Zone ════ */}
          {mode === "file" && (
            <div
              className={`dropzone min-h-[320px] p-10 ${dragging ? "dragging" : ""}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => !file && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.bmp,.tiff"
                onChange={handleFileInput}
              />

              {file ? (
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center">
                    {file.name.endsWith(".pdf")
                      ? <FileText size={28} className="text-indigo-600" />
                      : <Image size={28} className="text-indigo-600" />
                    }
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{file.name}</p>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="btn-ghost text-sm text-red-500 hover:bg-red-50"
                  >
                    <X size={13} /> Remove file
                  </button>
                  <p className="text-xs text-slate-400">
                    Click or drag to replace
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 text-center pointer-events-none">
                  <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center">
                    <FileUp size={32} />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-slate-600">
                      Drag & drop your file here
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                      or click to browse your files
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {["PDF", "JPG", "PNG", "WEBP", "BMP", "TIFF"].map((ext) => (
                      <span key={ext} className="px-2.5 py-0.5 rounded-md bg-slate-100 text-xs font-mono text-slate-500">
                        .{ext.toLowerCase()}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">Max 20 MB</p>
                </div>
              )}
            </div>
          )}

          {/* ── Error banner ── */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 animate-fade-in">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Translation Error</p>
                <p className="text-sm mt-0.5 text-red-600">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
                <X size={16} />
              </button>
            </div>
          )}

          {/* ── Translate Button ── */}
          <div className="flex justify-end">
            <button
              onClick={mode === "text" ? handleTextTranslate : handleFileTranslate}
              disabled={loading || (mode === "text" ? !sourceText.trim() : !file)}
              className="btn-primary px-8 py-3 text-base"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {pollingId ? "Processing…" : "Translating…"}
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Translate Now
                </>
              )}
            </button>
          </div>

          {/* ── Loading state detail ── */}
          {loading && (
            <div className="card p-6 flex items-center gap-4 animate-fade-in border-indigo-100">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Loader2 size={20} className="text-indigo-600 animate-spin" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">
                  {pollingId ? "Extracting text & translating…" : "Translating your text…"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {pollingId
                    ? "OCR + AI translation is running in the background. Checking every 2.5s…"
                    : "Our AI engine is processing your request. This may take a few seconds."
                  }
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ════════════ RESULT PANEL ════════════ */}
      {result && (
        <section className="space-y-6 animate-slide-up">

          {/* ── Success header ── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 size={20} className="text-emerald-600" />
              </div>
              <div>
                <h2 className="font-serif font-bold text-xl text-slate-900">Translation Complete</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  ID #{result.id} · {result.original_language.toUpperCase()} → {result.translated_language.toUpperCase()}
                </p>
              </div>
            </div>
            <button onClick={reset} className="btn-secondary text-sm">
              <RefreshCw size={14} /> New Translation
            </button>
          </div>

          {/* ── Split result view ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Source */}
            <div className="card p-1 flex flex-col">
              <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="lang-pill">{result.original_language.toUpperCase()}</span>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Source
                  </span>
                </div>
                {result.source_text && <CopyButton text={result.source_text} />}
              </div>
              <pre className="flex-1 min-h-[200px] max-h-[500px] overflow-y-auto px-4 py-3
                              text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
                {result.source_text || "(No source text recorded)"}
              </pre>
            </div>

            {/* Translation */}
            <div className="card p-1 flex flex-col border-indigo-100">
              <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-indigo-100 bg-indigo-50/30 rounded-t-xl">
                <div className="flex items-center gap-2">
                  <span className="lang-pill bg-indigo-600 text-white border-indigo-600">
                    {result.translated_language.toUpperCase()}
                  </span>
                  <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">
                    Translation
                  </span>
                </div>
                {result.result_text && <CopyButton text={result.result_text} />}
              </div>
              <pre className="flex-1 min-h-[200px] max-h-[500px] overflow-y-auto px-4 py-3
                              text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                {result.result_text || "(Translation is empty)"}
              </pre>
            </div>
          </div>

          {/* ── Actions row ── */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <StatusBadge status={result.status} />
              <span className="text-xs text-slate-400">
                Title: <strong className="text-slate-600">{result.title}</strong>
              </span>
              <span className="text-xs text-slate-400">
                Author: <strong className="text-slate-600">@{result.author}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleDownload} className="btn-secondary text-sm">
                <Download size={14} /> Download .txt
              </button>
              <button
                onClick={() => navigate("explore")}
                className="btn-primary text-sm"
              >
                <Compass size={14} /> Explore Feed
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
