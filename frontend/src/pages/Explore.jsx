/**
 * src/pages/Explore.jsx
 *
 * Page 2: The Public Feed / Explore page.
 *
 * Features:
 *   - Search input (debounced)
 *   - Filter dropdown (Title / Author / Language)
 *   - Sort toggle (Recent / Popular)
 *   - Responsive grid of TranslationCard components
 *   - Pagination (load more)
 *   - Read More modal overlay
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  SlidersHorizontal,
  TrendingUp,
  Clock,
  Eye,
  BookOpen,
  Loader2,
  ArrowRight,
  X,
  Globe,
  AlertCircle,
  ChevronDown,
  RefreshCw,
} from "lucide-react";

const API_BASE_URL = "http://localhost:8000";

// ── Language code → display name mapping ─────────────────────────────────────
const LANG_NAMES = {
  en: "English", fr: "French", es: "Spanish", de: "German", it: "Italian",
  pt: "Portuguese", ru: "Russian", zh: "Chinese", ja: "Japanese", ko: "Korean",
  ar: "Arabic", hi: "Hindi", bn: "Bengali", tr: "Turkish", nl: "Dutch",
  pl: "Polish", sv: "Swedish", vi: "Vietnamese", th: "Thai", id: "Indonesian",
  uk: "Ukrainian", fa: "Persian", ur: "Urdu", auto: "Auto",
  "zh-TW": "Chinese (T)",
};
const langLabel = (code) => LANG_NAMES[code] ?? code?.toUpperCase() ?? "?";

// ── TranslationCard ───────────────────────────────────────────────────────────
function TranslationCard({ item, onReadMore }) {
  return (
    <article
      className="card p-5 flex flex-col gap-3 group animate-fade-in"
    >
      {/* Language pills + arrow */}
      <div className="flex items-center gap-2">
        <span className="lang-pill">{(item.original_language || "??").toUpperCase()}</span>
        <ArrowRight size={12} className="text-slate-300" />
        <span className="lang-pill bg-indigo-600 text-white border-indigo-600">
          {(item.translated_language || "??").toUpperCase()}
        </span>
        <div className="ml-auto">
          <span className={`
            inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
            ${item.status === "done" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}
          `}>
            {item.status === "done" ? "Done" : item.status}
          </span>
        </div>
      </div>

      {/* Title */}
      <h3 className="font-serif font-bold text-slate-900 text-lg leading-tight
                     group-hover:text-indigo-700 transition-colors duration-150 line-clamp-2">
        {item.title || "Untitled"}
      </h3>

      {/* Author */}
      <p className="text-xs font-medium text-slate-400">
        @{item.author || "anonymous"} ·{" "}
        <time dateTime={item.created_at}>
          {item.created_at
            ? new Date(item.created_at).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
              })
            : "Unknown date"}
        </time>
      </p>

      {/* Snippet */}
      {item.snippet && (
        <div className="flex-1 p-3 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 font-sans">
            {item.snippet}
          </p>
        </div>
      )}

      {/* Footer: view count + action */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Eye size={13} />
          <span>{(item.view_count || 0).toLocaleString()} views</span>
        </div>
        <button
          onClick={() => onReadMore(item)}
          className="btn-secondary text-xs px-3 py-1.5 gap-1.5"
        >
          <BookOpen size={12} /> Read More
        </button>
      </div>
    </article>
  );
}

// ── ReadMoreModal ─────────────────────────────────────────────────────────────
function ReadMoreModal({ item, onClose }) {
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
  }, [item.id, onClose]);

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

// ── EmptyState ────────────────────────────────────────────────────────────────
function EmptyState({ search }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mb-4">
        <Globe size={32} className="text-slate-300" />
      </div>
      <h3 className="font-serif font-bold text-xl text-slate-700 mb-2">
        {search ? "No results found" : "No public translations yet"}
      </h3>
      <p className="text-sm text-slate-400 max-w-sm">
        {search
          ? `Nothing matched "${search}". Try a different query or filter.`
          : "Be the first! Head to the Studio and create a public translation."}
      </p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Explore({ navigate }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  // Filters
  const [search, setSearch] = useState("");
  const [filterBy, setFilterBy] = useState("title");
  const [sortBy, setSortBy] = useState("recent");

  // Modal
  const [selectedItem, setSelectedItem] = useState(null);

  // Debounce timer
  const searchTimer = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input
  const handleSearchChange = (val) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(val), 400);
  };

  // ── Fetch translations ────────────────────────────────────────────────────
  const fetchTranslations = useCallback(
    async (currentPage, replace = false) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: currentPage.toString(),
          page_size: "12",
          sort_by: sortBy,
          filter_by: filterBy,
        });
        if (debouncedSearch) params.append("search", debouncedSearch);

        const res = await fetch(`${API_BASE_URL}/api/explore?${params}`);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const data = await res.json();

        setItems((prev) => replace ? data : [...prev, ...data]);
        setHasMore(data.length === 12);
      } catch (e) {
        setError(e.message || "Could not load translations. Is the server running?");
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, filterBy, sortBy]
  );

  // Reset and refetch when filters change
  useEffect(() => {
    setPage(1);
    setItems([]);
    setHasMore(true);
    fetchTranslations(1, true);
  }, [debouncedSearch, filterBy, sortBy]);

  // Load more
  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchTranslations(nextPage, false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">

      {/* ── Page header ── */}
      <div className="animate-slide-up">
        <h1 className="font-serif text-4xl sm:text-5xl font-bold text-slate-900 leading-tight">
          Explore Translations
        </h1>
        <p className="text-slate-500 mt-2 text-lg">
          Browse community translations across all languages and document types.
        </p>
      </div>

      {/* ── Control bar ── */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3 animate-slide-up">

        {/* Search */}
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search translations…"
            className="input pl-10"
          />
          {search && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter by */}
        <div className="relative">
          <SlidersHorizontal
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value)}
            className="select pl-9 pr-9 w-40 appearance-none"
          >
            <option value="title">By Title</option>
            <option value="author">By Author</option>
            <option value="language">By Language</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* Sort toggle */}
        <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white">
          <button
            onClick={() => setSortBy("recent")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150
              ${sortBy === "recent"
                ? "bg-indigo-600 text-white"
                : "text-slate-600 hover:bg-slate-50"
              }`}
          >
            <Clock size={14} /> Recent
          </button>
          <button
            onClick={() => setSortBy("popular")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150 border-l border-slate-200
              ${sortBy === "popular"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "text-slate-600 hover:bg-slate-50"
              }`}
          >
            <TrendingUp size={14} /> Popular
          </button>
        </div>

        {/* Refresh */}
        <button
          onClick={() => { setPage(1); setItems([]); fetchTranslations(1, true); }}
          className="btn-secondary px-4"
          title="Refresh"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* ── Results count ── */}
      {!loading && items.length > 0 && (
        <p className="text-sm text-slate-400 -mt-4">
          Showing <strong className="text-slate-600">{items.length}</strong> translation{items.length !== 1 ? "s" : ""}
          {debouncedSearch && <> matching <strong className="text-slate-600">"{debouncedSearch}"</strong></>}
        </p>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Error loading translations</p>
            <p className="text-sm mt-0.5 text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* ── Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {items.map((item) => (
          <TranslationCard
            key={item.id}
            item={item}
            onReadMore={setSelectedItem}
          />
        ))}

        {/* Empty state */}
        {!loading && items.length === 0 && (
          <EmptyState search={debouncedSearch} />
        )}

        {/* Loading skeleton cards */}
        {loading && items.length === 0 && (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse space-y-3">
              <div className="flex gap-2">
                <div className="h-5 w-12 bg-slate-200 rounded-md" />
                <div className="h-5 w-16 bg-indigo-100 rounded-md" />
              </div>
              <div className="h-6 bg-slate-200 rounded-lg w-3/4" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
              <div className="h-16 bg-slate-100 rounded-lg" />
              <div className="flex justify-between">
                <div className="h-3 w-16 bg-slate-100 rounded" />
                <div className="h-7 w-20 bg-slate-100 rounded-lg" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Load more ── */}
      {hasMore && items.length > 0 && (
        <div className="flex justify-center pt-4">
          <button
            onClick={loadMore}
            disabled={loading}
            className="btn-secondary px-8 py-3"
          >
            {loading ? (
              <><Loader2 size={15} className="animate-spin" /> Loading…</>
            ) : (
              <>Load More Translations</>
            )}
          </button>
        </div>
      )}

      {/* ── End of results ── */}
      {!hasMore && items.length > 0 && (
        <p className="text-center text-xs text-slate-400 pt-4">
          You've reached the end · {items.length} translation{items.length !== 1 ? "s" : ""} total
        </p>
      )}

      {/* ── CTA to create ── */}
      {!loading && (
        <div className="card p-8 text-center bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-100">
          <h3 className="font-serif font-bold text-2xl text-slate-900 mb-2">
            Ready to add yours?
          </h3>
          <p className="text-slate-500 text-sm mb-5">
            Translate a document and share it with the community.
          </p>
          <button
            onClick={() => navigate("home")}
            className="btn-primary"
          >
            Open Translation Studio <ArrowRight size={15} />
          </button>
        </div>
      )}

      {/* ── Read More Modal ── */}
      {selectedItem && (
        <ReadMoreModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
