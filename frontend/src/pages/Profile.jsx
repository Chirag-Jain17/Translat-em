/**
 * src/pages/Profile.jsx
 *
 * Page 3: User Profile / Dashboard
 *
 * Behaviour
 * ─────────
 * • Loads the logged-in user's own profile on mount.
 * • "Find a user" panel lets you look up any username — but the result is
 *   shown read-only (no edit / delete controls, public translations only).
 * • Edit controls (visibility toggle, delete) are only shown on your OWN profile.
 */

import { useState, useEffect, useCallback } from "react";
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
  Calendar,
  Sparkles,
  Search,
  ChevronLeft,
  BookOpen,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ReadMoreModal from "../components/ReadMoreModal";

const API_BASE_URL = "http://localhost:8000";
const TOKEN_KEY    = "ai_translator_token";

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

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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

// ── AvatarInitial ─────────────────────────────────────────────────────────────
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
  const pct   = Math.min((count / limit) * 100, 100);
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
      <p className="text-xs text-slate-400">{limit - count} free translations remaining</p>
    </div>
  );
}

// ── HistoryRow ────────────────────────────────────────────────────────────────
// isOwner = true  → show edit/delete controls (own profile)
// isOwner = false → read-only view (looking at another user)
function HistoryRow({ item, isOwner, onVisibilityChange, onDelete, onReadMore }) {
  const [toggling,       setToggling]       = useState(false);
  const [deleting,       setDeleting]       = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/translate/${item.id}/visibility`,
        {
          method:  "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body:    JSON.stringify({ is_public: !item.is_public }),
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
        method:  "DELETE",
        headers: authHeaders(),
      });
      if (res.ok || res.status === 204) onDelete(item.id);
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
            {/* Visibility badge (read-only indicator for non-owner) */}
            {!isOwner && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                {item.is_public
                  ? <><Globe size={11} className="text-emerald-500" /> Public</>
                  : <><Lock  size={11} className="text-slate-400"  /> Private</>
                }
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Right: controls ── */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        <button
          onClick={() => onReadMore(item)}
          className="btn-secondary text-xs px-3 py-1.5 gap-1.5"
        >
          <BookOpen size={12} /> Read More
        </button>

        {isOwner && (
          <>
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
            title={confirmDelete ? "Click again to confirm" : "Delete translation"}
            onBlur={() => setConfirmDelete(false)}
          >
            {deleting
              ? <Loader2 size={12} className="animate-spin" />
              : <Trash2  size={12} />
            }
            {confirmDelete ? "Confirm?" : "Delete"}
          </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Profile({ navigate }) {
  const { user: authUser, logout } = useAuth();

  const [profile,      setProfile]      = useState(null);
  const [translations, setTranslations] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  // lookupUsername: null = viewing own profile, string = viewing another user
  const [lookupUsername, setLookupUsername] = useState(null);
  const [lookupInput,    setLookupInput]    = useState("");
  const [lookupLoading,  setLookupLoading]  = useState(false);
  const [lookupError,    setLookupError]    = useState(null);

  const [selectedItem, setSelectedItem] = useState(null);

  const [stats, setStats] = useState({ total: 0, public: 0, private: 0, done: 0 });

  const [deletingAccount, setDeletingAccount] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);

  // Are we showing our own profile?
  const isOwnProfile = lookupUsername === null;

  const handleDeleteAccount = async () => {
    if (!confirmDeleteAccount) {
      setConfirmDeleteAccount(true);
      return;
    }
    setDeletingAccount(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete account");
      logout();
      navigate("login"); // redirect to login or home
    } catch (err) {
      setError(err.message);
      setDeletingAccount(false);
      setConfirmDeleteAccount(false);
    }
  };

  // ── Fetch own profile ─────────────────────────────────────────────────────
  const fetchOwnProfile = useCallback(async () => {
    if (!authUser) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/${authUser.username}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to load your profile.");
      const data = await res.json();
      setProfile(data.user);
      const list = data.translations || [];
      setTranslations(list);
      setStats({
        total:   data.user.translation_count,
        public:  list.filter((t) => t.is_public).length,
        private: list.filter((t) => !t.is_public).length,
        done:    list.filter((t) => t.status === "done").length,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  // Load own profile on mount / when auth user changes
  useEffect(() => {
    fetchOwnProfile();
  }, [fetchOwnProfile]);

  // ── Handlers for own-profile mutations ───────────────────────────────────
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

  const handleDelete = (id) => {
    setTranslations((prev) => {
      const target = prev.find((t) => t.id === id);
      if (target) {
        setStats((s) => ({
          ...s,
          public:  target.is_public ? s.public - 1 : s.public,
          private: !target.is_public ? s.private - 1 : s.private,
          done:    target.status === "done" ? s.done - 1 : s.done,
        }));
      }
      return prev.filter((t) => t.id !== id);
    });
  };

  // ── Lookup another user (read-only) ──────────────────────────────────────
  const [lookupProfile,      setLookupProfile]      = useState(null);
  const [lookupTranslations, setLookupTranslations] = useState([]);

  const handleLookup = async (e) => {
    e.preventDefault();
    const target = lookupInput.trim();
    if (!target) return;

    // If they searched for themselves, just highlight own profile
    if (authUser && target.toLowerCase() === authUser.username.toLowerCase()) {
      setLookupInput("");
      return;
    }

    setLookupLoading(true);
    setLookupError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/${target}`);
      if (!res.ok) throw new Error(`User "@${target}" not found.`);
      const data = await res.json();
      setLookupProfile(data.user);
      // Only show PUBLIC translations for other users
      setLookupTranslations((data.translations || []).filter((t) => t.is_public));
      setLookupUsername(target);
      setLookupInput("");
    } catch (e) {
      setLookupError(e.message);
    } finally {
      setLookupLoading(false);
    }
  };

  const returnToOwnProfile = () => {
    setLookupUsername(null);
    setLookupProfile(null);
    setLookupTranslations([]);
    setLookupError(null);
  };

  // ── Decide what to display ────────────────────────────────────────────────
  const displayProfile      = isOwnProfile ? profile      : lookupProfile;
  const displayTranslations = isOwnProfile ? translations : lookupTranslations;
  const displayLoading      = isOwnProfile ? loading      : lookupLoading;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">

      {/* ── Page header ── */}
      <div className="animate-slide-up">
        {isOwnProfile ? (
          <>
            <h1 className="font-serif text-4xl font-bold text-slate-900">My Profile</h1>
            <p className="text-slate-500 mt-1">
              Manage your translations, control visibility, and track your activity.
            </p>
          </>
        ) : (
          <div className="flex items-start gap-4">
            <button
              onClick={returnToOwnProfile}
              className="btn-secondary text-sm mt-1 shrink-0"
              id="profile-back-btn"
            >
              <ChevronLeft size={15} /> My Profile
            </button>
            <div>
              <h1 className="font-serif text-4xl font-bold text-slate-900">
                @{lookupUsername}
              </h1>
              <p className="text-slate-500 mt-1 flex items-center gap-1.5">
                <Eye size={13} className="text-slate-400" />
                Viewing public profile — read-only
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Error (own profile) ── */}
      {isOwnProfile && error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Error</p>
            <p className="text-sm text-red-600 mt-0.5">{error}</p>
          </div>
          <button onClick={fetchOwnProfile} className="ml-auto">
            <RefreshCw size={15} className="text-red-400 hover:text-red-700" />
          </button>
        </div>
      )}

      {/* ══════════ PROFILE HEADER ══════════ */}
      <div className="card p-6 sm:p-8 animate-slide-up">
        {displayLoading && !displayProfile ? (
          <div className="flex items-center gap-5 animate-pulse">
            <div className="w-20 h-20 rounded-2xl bg-slate-200" />
            <div className="space-y-2">
              <div className="h-6 w-36 bg-slate-200 rounded-lg" />
              <div className="h-4 w-48 bg-slate-100 rounded" />
              <div className="h-3 w-28 bg-slate-100 rounded" />
            </div>
          </div>
        ) : displayProfile ? (
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Avatar */}
            <div className="shrink-0">
              <AvatarInitial username={displayProfile.username} size="xl" />
            </div>

            {/* Info */}
            <div className="flex-1 space-y-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="font-serif font-bold text-2xl text-slate-900">
                    @{displayProfile.username}
                  </h2>
                  {!isOwnProfile && (
                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full font-medium">
                      Public profile
                    </span>
                  )}
                </div>
                {/* Only show email on own profile */}
                {isOwnProfile && (
                  <p className="text-slate-500 text-sm mt-0.5">{displayProfile.email}</p>
                )}
                {displayProfile.created_at && (
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                    <Calendar size={11} />
                    Member since{" "}
                    {new Date(displayProfile.created_at).toLocaleDateString("en-US", {
                      month: "long", year: "numeric",
                    })}
                  </p>
                )}
              </div>

              {/* Stats — only on own profile */}
              {isOwnProfile && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Total",   value: stats.total,   color: "text-slate-700",   bg: "bg-slate-50"    },
                      { label: "Done",    value: stats.done,    color: "text-emerald-700",  bg: "bg-emerald-50"  },
                      { label: "Public",  value: stats.public,  color: "text-indigo-700",   bg: "bg-indigo-50"   },
                      { label: "Private", value: stats.private, color: "text-slate-500",    bg: "bg-slate-50"    },
                    ].map(({ label, value, color, bg }) => (
                      <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                        <p className={`text-2xl font-bold font-serif ${color}`}>{value}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="max-w-sm">
                    <UsageMeter count={stats.total} limit={50} />
                  </div>
                </>
              )}

              {/* Public translation count for other users */}
              {!isOwnProfile && (
                <p className="text-sm text-slate-500">
                  {lookupTranslations.length} public translation{lookupTranslations.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
        ) : !displayLoading && lookupError ? (
          <div className="flex items-center gap-3 text-red-600">
            <AlertCircle size={18} />
            <p className="text-sm">{lookupError}</p>
          </div>
        ) : null}
      </div>

      {/* ── Find a user panel (only on own profile) ── */}
      {isOwnProfile && (
        <div className="card p-5 animate-slide-up">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Search size={14} className="text-slate-400" />
            Find a user
          </h3>
          <form onSubmit={handleLookup} className="flex gap-3">
            <input
              type="text"
              value={lookupInput}
              onChange={(e) => setLookupInput(e.target.value)}
              placeholder="Enter a username to view their public profile"
              className="input flex-1"
              id="profile-lookup-input"
            />
            <button
              type="submit"
              disabled={lookupLoading}
              className="btn-primary px-5"
              id="profile-lookup-btn"
            >
              {lookupLoading
                ? <Loader2 size={14} className="animate-spin" />
                : <Search size={14} />
              }
              {lookupLoading ? "Searching…" : "View"}
            </button>
          </form>
          {lookupError && (
            <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
              <AlertCircle size={11} /> {lookupError}
            </p>
          )}
        </div>
      )}

      {/* ══════════ TRANSLATION HISTORY ══════════ */}
      <div className="space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <h2 className="font-serif font-bold text-2xl text-slate-900">
            {isOwnProfile ? "Translation History" : `@${lookupUsername}'s Public Translations`}
          </h2>
          {isOwnProfile && (
            <button onClick={fetchOwnProfile} className="btn-ghost text-sm">
              <RefreshCw size={14} /> Refresh
            </button>
          )}
        </div>

        {displayLoading ? (
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
        ) : displayTranslations.length === 0 ? (
          <div className="card p-12 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
              <Languages size={28} className="text-indigo-400" />
            </div>
            <h3 className="font-serif font-bold text-xl text-slate-700 mb-2">
              {isOwnProfile ? "No translations yet" : "No public translations"}
            </h3>
            <p className="text-sm text-slate-400 mb-5 max-w-sm">
              {isOwnProfile
                ? "Head over to the Translation Studio and create your first translation."
                : `@${lookupUsername} hasn't made any public translations yet.`
              }
            </p>
            {isOwnProfile && (
              <button onClick={() => navigate("home")} className="btn-primary">
                <Sparkles size={15} /> Open Studio
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {displayTranslations.map((item) => (
              <HistoryRow
                key={item.id}
                item={item}
                isOwner={isOwnProfile}
                onVisibilityChange={handleVisibilityChange}
                onDelete={handleDelete}
                onReadMore={setSelectedItem}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── CTA (own profile only) ── */}
      {isOwnProfile && !loading && translations.length > 0 && (
        <div className="card p-6 bg-gradient-to-r from-indigo-50 to-violet-50 border-indigo-100
                        flex flex-col sm:flex-row items-center justify-between gap-4 animate-slide-up">
          <div>
            <h3 className="font-serif font-bold text-lg text-slate-900">Keep translating!</h3>
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

      {/* ── Danger Zone (own profile only) ── */}
      {isOwnProfile && !loading && (
        <div className="card p-6 border-red-100 bg-red-50/30 flex flex-col sm:flex-row items-center justify-between gap-4 animate-slide-up">
          <div>
            <h3 className="font-serif font-bold text-lg text-red-900">Danger Zone</h3>
            <p className="text-sm text-red-600/80 mt-0.5">
              Permanently delete your account and all associated translations. This action cannot be undone.
            </p>
          </div>
          <button
            onClick={handleDeleteAccount}
            disabled={deletingAccount}
            onBlur={() => setConfirmDeleteAccount(false)}
            className={`
              shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm
              transition-all duration-150
              ${confirmDeleteAccount
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-white text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300"
              }
              ${deletingAccount ? "opacity-50 cursor-not-allowed" : ""}
            `}
          >
            {deletingAccount ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Trash2 size={15} />
            )}
            {confirmDeleteAccount ? "Are you sure?" : "Delete Account"}
          </button>
        </div>
      )}

      {/* ── Modal ── */}
      {selectedItem && (
        <ReadMoreModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          API_BASE_URL={API_BASE_URL}
        />
      )}
    </div>
  );
}
