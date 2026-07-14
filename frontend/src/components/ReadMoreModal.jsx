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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-card max-w-3xl w-full max-h-[90vh] flex flex-col animate-slide-up">
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
        <div className="flex-1 overflow-y-auto p-6">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                  Original ({langLabel(full.original_language)})
                </h3>
                <pre className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-sans
                                bg-slate-50 rounded-xl p-4 border border-slate-100 max-h-[400px] overflow-y-auto">
                  {full.source_text || "(No source text)"}
                </pre>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mb-2">
                  Translation ({langLabel(full.translated_language)})
                </h3>
                <pre className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans
                                bg-indigo-50/40 rounded-xl p-4 border border-indigo-100 max-h-[400px] overflow-y-auto">
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
