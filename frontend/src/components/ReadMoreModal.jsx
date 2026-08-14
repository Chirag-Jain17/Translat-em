/**
 * src/components/ReadMoreModal.jsx
 *
 * A modal that fetches and displays the full details (original vs translated text)
 * of a translation. Used in both Explore and Profile pages.
 */

import { useState, useEffect } from "react";
import { X, ArrowRight, Loader2, AlertCircle } from "lucide-react";

// You could extract this to a shared utils file later
const langLabel = (code) => {
  const map = {
    en: "EN", fr: "FR", es: "ES", de: "DE", it: "IT", pt: "PT",
    ru: "RU", zh: "ZH", ja: "JA", ko: "KO", ar: "AR", hi: "HI",
    bn: "BN", tr: "TR", nl: "NL", pl: "PL", sv: "SV", vi: "VI",
    th: "TH", id: "ID", uk: "UK", fa: "FA", ur: "UR", auto: "AUTO",
  };
  return map[code] ?? (code?.toUpperCase() ?? "??");
};

export default function ReadMoreModal({ item, onClose, API_BASE_URL }) {
  const [full, setFull] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [splitRatio, setSplitRatio] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [navHeight, setNavHeight] = useState(64); // Fallback to 64px if not found

  useEffect(() => {
    const fetchFull = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/translate/${item.id}`);
        if (!res.ok) throw new Error("Could not load translation.");
        setFull(await res.json());
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchFull();

    // Close on Escape
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [item.id, onClose, API_BASE_URL]);

  useEffect(() => {
    const header = document.querySelector(".glass-nav");
    if (!header) return;
    
    const updateNavBottom = () => {
      setNavHeight(header.offsetHeight);
    };
    
    // Set initial position
    updateNavBottom();
    
    // Track dynamic resizes of the navbar
    const observer = new ResizeObserver(updateNavBottom);
    
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const newRatio = (e.clientX / window.innerWidth) * 100;
      if (newRatio > 20 && newRatio < 80) {
        setSplitRatio(newRatio);
      }
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex flex-col bg-slate-900/40 backdrop-blur-sm animate-fade-in select-none"
      style={{ top: `${navHeight}px`, marginTop: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full h-full flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="lang-pill">{(item.original_language || "??").toUpperCase()}</span>
              <ArrowRight size={12} className="text-slate-300" />
              <span className="lang-pill bg-indigo-600 text-white border-indigo-600">
                {(item.translated_language || "??").toUpperCase()}
              </span>
            </div>
            <h2 className="font-serif font-bold text-xl text-slate-900">
              {item.title}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              By @{item.author} · {(item.view_count || 0).toLocaleString()} views
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-6 flex flex-col min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 size={24} className="animate-spin mr-3" /> Loading…
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}
          {full && (
            <div className="flex flex-col md:flex-row h-full min-h-0 gap-4 md:gap-0">
              <div
                className="flex flex-col h-full min-h-0"
                style={{ width: isMobile ? '100%' : `calc(${splitRatio}% - 4px)` }}
              >
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 shrink-0">
                  Original ({langLabel(full.original_language)})
                </h3>
                {full.file_type === "image" ? (
                  <div className="w-full flex-1 min-h-0 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center overflow-hidden p-2">
                    <img
                      src={`${API_BASE_URL}/api/translate/${full.id}/file`}
                      className="w-full h-full object-contain"
                      alt="Original"
                    />
                  </div>
                ) : full.file_type === "pdf" ? (
                  <div className="w-full flex-1 min-h-0 bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                    <object
                      data={`${API_BASE_URL}/api/translate/${full.id}/file`}
                      type="application/pdf"
                      className="w-full h-full"
                    >
                      <p className="p-4 text-sm text-slate-500">PDF cannot be displayed. <a href={`${API_BASE_URL}/api/translate/${full.id}/file`} className="text-indigo-600 hover:underline">Download it here</a>.</p>
                    </object>
                  </div>
                ) : (
                  <pre className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-sans
                                  bg-slate-50 rounded-xl p-4 border border-slate-100 flex-1 min-h-0 overflow-y-auto">
                    {full.source_text || "(No source text)"}
                  </pre>
                )}
              </div>

              {!isMobile && (
                <div
                  className="w-2 cursor-col-resize hover:bg-indigo-400 active:bg-indigo-600 rounded-full transition-colors flex-shrink-0 mx-2 flex items-center justify-center group"
                  onMouseDown={() => setIsDragging(true)}
                >
                  <div className="w-1 h-8 bg-slate-300 group-hover:bg-white rounded-full transition-colors" />
                </div>
              )}

              <div
                className="flex flex-col h-full min-h-0"
                style={{ width: isMobile ? '100%' : `calc(${100 - splitRatio}% - 4px)` }}
              >
                <h3 className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mb-2 shrink-0">
                  Translation ({langLabel(full.translated_language)})
                </h3>
                <pre className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans
                                bg-indigo-50/40 rounded-xl p-4 border border-indigo-100 flex-1 min-h-0 overflow-y-auto">
                  {full.result_text || "(Empty)"}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4 flex justify-end">
          <button onClick={onClose} className="btn-secondary">Close</button>
        </div>
      </div>
    </div>
  );
}
