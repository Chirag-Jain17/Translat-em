/**
 * src/pages/Profile.jsx
 *
 * Page 3: User Profile / Dashboard
 *
 * Sections:
 *   1. Profile Header — Avatar, username, usage meter
 *   2. Translation History — Flex rows with:
 *        - Document title + language pills
 *        - Timestamp + status badge
 *        - Public/Private toggle (PATCH /api/translate/{id}/visibility)
 *        - Delete button (DELETE /api/translate/{id})
 *   3. Empty state
 */

import { useState, useEffect } from "react";
import {
  User,
  Languages,
  FileText,
  Image,
  File,
  Trash2,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Loader2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  BarChart2,
  Calendar,
  CheckCircle2,
  Settings,
  Sparkles,
} from "lucide-react";

const API_BASE_URL = "http://localhost:8000";

// ── Demo user ─────────────────────────────────────────────────────────────────
const DEMO_USERNAME = "anonymous";

// ── Helpers ───────────────────────────────────────────────────────────────────
const langLabel = (code) => {
  const map = {
    en: "EN", fr: "FR", es: "ES", de: "DE", it: "IT", pt: "PT",
    ru: "RU", zh: "ZH", ja: "JA", ko: "KO", ar: "AR", hi: "HI",
    bn: "BN", tr: "TR", nl: "NL", pl: "PL", sv: "SV", vi: "VI",
    th: "TH", id: "ID", uk: "UK", fa: "FA", ur: "UR", auto: "AUTO",
  };
  return map[code] ?? (code?.toUpperCase() ?? "??");
};

const fileTypeIcon = (type) => {
  if (type === "pdf")   return <FileText size={15} className="text-red-500" />;
  if (type === "image") return <Image    size={15} className="text-violet-500" />;
  return                       <File     size={15} className="text-slate-400" />;
};

function StatusBadge({ status }) {
  const map = {
    done:       "badge-done",
    pending:    "badge-pending",
    processing: "badge-processing",
    error:      "badge-error",
  };
  return (
    <span className={map[status] ?? "badge-pending"}>
      {(status?.charAt(0).toUpperCase() ?? "") + (status?.slice(1) ?? "Unknown")}
    </span>
  );
}

// ── ToggleSwitch ──────────────────────────────────────────────────────────────
function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`
        relative inline-flex items-center w-11 h-6 rounded-full
        transition-colors duration-200 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        ${checked ? "bg-indigo-500" : "bg-slate-200"}
      `}
      aria-label={checked ? "Make private" : "Make public"}
    >
      <span
        className={`
          inline-block w-5 h-5 bg-white rounded-full shadow
          transform transition-transform duration-200 ease-in-out
          ${checked ? "translate-x-5" : "translate-x-0.5"}
        `}
      />
    </button>
  );
}

// ── AvatarInitial ────────────────────────────────────────────────────────────
function AvatarInitial({ username, size = "xl" }) {
  const initial = (username || "?")[0].toUpperCase();
  const sizeCls = {
    xl: "w-20 h-20 text-3xl",
    md: "w-10 h-10 text-base",
  }[size];

  return (
    <div className={`${sizeCls} rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600
                     flex items-center justify-center font-serif font-bold text-white shadow-md`}>
      {initial}
    </div>
  );
}

// ── UsageMeter ────────────────────────────────────────────────────────────────
function UsageMeter({ count, limit = 50 }) {
  const pct = Math.min((count / limit) * 100, 100);
  const color = pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-slate-500">
        <span>Translations used</span>
        <span className="font-semibold text-slate-700">{count} / {limit}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-slate-400">
        {limit - count} free translations remaining
      </p>
    </div>
  );
}

// ── HistoryRow ────────────────────────────────────────────────────────────────
function HistoryRow({ item, onVisibilityChange, onDelete }) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/translate/${item.id}/visibility`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_public: !item.is_public }),
        }
      );
      if (!res.ok) throw new Error("Toggle failed");
      const updated = await res.json();
      onVisibilityChange(item.id, updated.is_public);
    } catch (e) {
      console.error(e);
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/translate/${item.id}`, {
        method: "DELETE",
      });
      if (res.ok || res.status === 204) {
        onDelete(item.id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="card p-4 flex flex-col sm:flex-row sm:items-center gap-4 group animate-fade-in
                    hover:border-slate-200 hover:shadow-card">

      {/* ── Left: icon + info ── */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0
                        group-hover:bg-indigo-50 transition-colors duration-150">
          {fileTypeIcon(item.file_type)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 text-sm truncate max-w-[200px]">
              {item.title || "Untitled"}
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="lang-pill text-[10px] px-1.5 py-0.5">
                {langLabel(item.original_language)}
              </span>
              <ArrowRight size={10} className="text-slate-300" />
              <span className="lang-pill bg-indigo-600 text-white border-indigo-600 text-[10px] px-1.5 py-0.5">
                {langLabel(item.translated_language)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <StatusBadge status={item.status} />
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Calendar size={11} />
              {item.created_at
                ? new Date(item.created_at).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })
                : "—"}
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Eye size={11} />
              {(item.view_count || 0).toLocaleString()} views
            </span>
            {item.snippet && (
              <p className="text-xs text-slate-400 italic truncate max-w-[200px] hidden md:block">
                "{item.snippet}"
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Right: controls ── */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">

        {/* Public / Private toggle */}
        <div className="flex items-center gap-2">
          {item.is_public
            ? <Globe size={13} className="text-emerald-500" />
            : <Lock  size={13} className="text-slate-400"  />
          }
          <ToggleSwitch
            checked={item.is_public}
            onChange={handleToggle}
            disabled={toggling}
          />
          {toggling && <Loader2 size={12} className="animate-spin text-slate-400" />}
          <span className="text-xs text-slate-500 w-12 font-medium">
            {item.is_public ? "Public" : "Private"}
          </span>
        </div>

        {/* Delete button */}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className={`
            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
            transition-all duration-150
            ${confirmDelete
              ? "bg-red-600 text-white hover:bg-red-700"
              : "text-red-500 hover:bg-red-50 hover:text-red-700"
            }
            ${deleting ? "opacity-50 cursor-not-allowed" : ""}
          `}
          title={confirmDelete ? "Click again to confirm deletion" : "Delete translation"}
          onBlur={() => setConfirmDelete(false)}
        >
          {deleting
            ? <Loader2 size={12} className="animate-spin" />
            : <Trash2  size={12} />
          }
          {confirmDelete ? "Confirm?" : "Delete"}
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Profile({ navigate }) {
  const [profile, setProfile] = useState(null);
  const [translations, setTranslations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [username, setUsername] = useState(DEMO_USERNAME);
  const [lookupInput, setLookupInput] = useState("");
  const [stats, setStats] = useState({ total: 0, public: 0, private: 0, done: 0 });

  // ── Fetch profile ─────────────────────────────────────────────────────────
  const fetchProfile = async (uname) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/${uname}`);
      if (!res.ok) throw new Error(`Failed to load profile for "${uname}".`);
      const data = await res.json();
      setProfile(data.user);
      const list = data.translations || [];
      setTranslations(list);

      // Compute stats
      setStats({
        total:   list.length,
        public:  list.filter((t) => t.is_public).length,
        private: list.filter((t) => !t.is_public).length,
        done:    list.filter((t) => t.status === "done").length,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(username); }, [username]);

  // ── Handle visibility update ──────────────────────────────────────────────
  const handleVisibilityChange = (id, newPublic) => {
    setTranslations((prev) =>
      prev.map((t) => (t.id === id ? { ...t, is_public: newPublic } : t))
    );
    setStats((prev) => ({
      ...prev,
      public:  newPublic ? prev.public + 1 : prev.public - 1,
      private: newPublic ? prev.private - 1 : prev.private + 1,
    }));
  };

  // ── Handle delete ─────────────────────────────────────────────────────────
  const handleDelete = (id) => {
    setTranslations((prev) => prev.filter((t) => t.id !== id));
    setStats((prev) => ({ ...prev, total: prev.total - 1 }));
  };

  // ── Lookup a different user ───────────────────────────────────────────────
  const handleLookup = (e) => {
    e.preventDefault();
    if (lookupInput.trim()) {
      setUsername(lookupInput.trim());
      setLookupInput("");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">

      {/* ── Page header ── */}
      <div className="animate-slide-up">
        <h1 className="font-serif text-4xl font-bold text-slate-900">Profile</h1>
        <p className="text-slate-500 mt-1">
          Manage your translations, control visibility, and track your activity.
        </p>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Error</p>
            <p className="text-sm text-red-600 mt-0.5">{error}</p>
          </div>
          <button onClick={() => fetchProfile(username)} className="ml-auto">
            <RefreshCw size={15} className="text-red-400 hover:text-red-700" />
          </button>
        </div>
      )}

      {/* ══════════ PROFILE HEADER ══════════ */}
      <div className="card p-6 sm:p-8 animate-slide-up">
        {loading && !profile ? (
          <div className="flex items-center gap-5 animate-pulse">
            <div className="w-20 h-20 rounded-2xl bg-slate-200" />
            <div className="space-y-2">
              <div className="h-6 w-36 bg-slate-200 rounded-lg" />
              <div className="h-4 w-48 bg-slate-100 rounded" />
              <div className="h-3 w-28 bg-slate-100 rounded" />
            </div>
          </div>
        ) : profile ? (
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Avatar */}
            <div className="shrink-0">
              <AvatarInitial username={profile.username} size="xl" />
            </div>

            {/* Info */}
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="font-serif font-bold text-2xl text-slate-900">
                  @{profile.username}
                </h2>
                <p className="text-slate-500 text-sm mt-0.5">{profile.email}</p>
                {profile.created_at && (
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                    <Calendar size={11} />
                    Member since{" "}
                    {new Date(profile.created_at).toLocaleDateString("en-US", {
                      month: "long", year: "numeric",
                    })}
                  </p>
                )}
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total",   value: stats.total,   color: "text-slate-700", bg: "bg-slate-50"    },
                  { label: "Done",    value: stats.done,    color: "text-emerald-700", bg: "bg-emerald-50" },
                  { label: "Public",  value: stats.public,  color: "text-indigo-700",  bg: "bg-indigo-50"  },
                  { label: "Private", value: stats.private, color: "text-slate-500",   bg: "bg-slate-50"   },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                    <p className={`text-2xl font-bold font-serif ${color}`}>{value}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Usage meter */}
              <div className="max-w-sm">
                <UsageMeter count={stats.total} limit={50} />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── User lookup form ── */}
      <div className="card p-5 animate-slide-up">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Settings size={14} className="text-slate-400" />
          Look up a different user
        </h3>
        <form onSubmit={handleLookup} className="flex gap-3">
          <input
            type="text"
            value={lookupInput}
            onChange={(e) => setLookupInput(e.target.value)}
            placeholder="Enter username (e.g. anonymous)"
            className="input flex-1"
          />
          <button type="submit" className="btn-primary px-5">
            Load Profile
          </button>
        </form>
        <p className="text-xs text-slate-400 mt-2">
          Currently viewing: <strong className="text-slate-600">@{username}</strong>
        </p>
      </div>

      {/* ══════════ TRANSLATION HISTORY ══════════ */}
      <div className="space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <h2 className="font-serif font-bold text-2xl text-slate-900">
            Translation History
          </h2>
          <button
            onClick={() => fetchProfile(username)}
            className="btn-ghost text-sm"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-4 animate-pulse flex items-center gap-4">
                <div className="w-9 h-9 rounded-xl bg-slate-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-slate-200 rounded" />
                  <div className="h-3 w-32 bg-slate-100 rounded" />
                </div>
                <div className="w-24 h-6 bg-slate-100 rounded-full" />
                <div className="w-16 h-6 bg-slate-100 rounded-lg" />
              </div>
            ))}
          </div>
        ) : translations.length === 0 ? (
          <div className="card p-12 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
              <Languages size={28} className="text-indigo-400" />
            </div>
            <h3 className="font-serif font-bold text-xl text-slate-700 mb-2">
              No translations yet
            </h3>
            <p className="text-sm text-slate-400 mb-5 max-w-sm">
              Head over to the Translation Studio and create your first translation.
            </p>
            <button
              onClick={() => navigate("home")}
              className="btn-primary"
            >
              <Sparkles size={15} /> Open Studio
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {translations.map((item) => (
              <HistoryRow
                key={item.id}
                item={item}
                onVisibilityChange={handleVisibilityChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── CTA ── */}
      {!loading && translations.length > 0 && (
        <div className="card p-6 bg-gradient-to-r from-indigo-50 to-violet-50 border-indigo-100
                        flex flex-col sm:flex-row items-center justify-between gap-4 animate-slide-up">
          <div>
            <h3 className="font-serif font-bold text-lg text-slate-900">
              Keep translating!
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {50 - stats.total > 0
                ? `You have ${50 - stats.total} free translations left.`
                : "You've used all your free translations."
              }
            </p>
          </div>
          <button onClick={() => navigate("home")} className="btn-primary shrink-0">
            <Sparkles size={15} /> New Translation
          </button>
        </div>
      )}
    </div>
  );
}
