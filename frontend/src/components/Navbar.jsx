/**
 * src/components/Navbar.jsx
 *
 * Glassmorphism sticky navigation bar.
 * Shows user avatar + username when logged in, Sign In / Register when logged out.
 */

import { useState } from "react";
import {
  Languages,
  Compass,
  User,
  Menu,
  X,
  Sparkles,
  LogIn,
  LogOut,
  UserPlus,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const NAV_LINKS = [
  { id: "home",    label: "Studio",  Icon: Languages },
  { id: "explore", label: "Explore", Icon: Compass   },
  { id: "profile", label: "Profile", Icon: User      },
];

export default function Navbar({ currentPage, navigate }) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (page) => {
    navigate(page);
    setMobileOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate("login");
    setMobileOpen(false);
  };

  // Initials avatar from username
  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : "?";

  return (
    <header className="glass-nav sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* ── Logo ── */}
          <button
            onClick={() => handleNav("home")}
            className="flex items-center gap-2.5 group"
            aria-label="Go to home"
          >
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm
                            group-hover:bg-indigo-700 transition-colors duration-150">
              <Languages size={18} className="text-white" />
            </div>
            <div className="leading-none">
              <span className="font-serif font-bold text-slate-900 text-lg tracking-tight">
                AI Translator
              </span>
              <span className="block text-[10px] text-slate-400 font-sans font-medium tracking-widest uppercase">
                AI-Powered Translation
              </span>
            </div>
          </button>

          {/* ── Desktop nav links ── */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {NAV_LINKS.map(({ id, label, Icon }) => {
              const isActive = currentPage === id;
              return (
                <button
                  key={id}
                  onClick={() => handleNav(id)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                    transition-all duration-150 ease-in-out
                    ${isActive
                      ? "bg-indigo-50 text-indigo-700 font-semibold"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }
                  `}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={15} />
                  {label}
                </button>
              );
            })}
          </nav>

          {/* ── Desktop right side ── */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              /* ── Logged-in state ── */
              <>
                <button
                  onClick={() => handleNav("profile")}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-slate-100
                             transition-colors duration-150 group"
                  title="View profile"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center
                                  text-white text-xs font-bold shadow-sm">
                    {initials}
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
                    @{user.username}
                  </span>
                </button>
                <button
                  onClick={handleLogout}
                  className="btn-secondary text-xs px-3 py-2 text-red-600 border-red-200
                             hover:bg-red-50 hover:border-red-300"
                  title="Sign out"
                  id="navbar-logout-btn"
                >
                  <LogOut size={13} /> Logout
                </button>
              </>
            ) : (
              /* ── Logged-out state ── */
              <>
                <button
                  onClick={() => handleNav("login")}
                  className="btn-secondary text-xs px-4 py-2"
                  id="navbar-signin-btn"
                >
                  <LogIn size={13} /> Sign In
                </button>
                <button
                  onClick={() => handleNav("register")}
                  className="btn-primary text-xs px-4 py-2"
                  id="navbar-register-btn"
                >
                  <UserPlus size={13} /> Register
                </button>
              </>
            )}
          </div>

          {/* ── Mobile hamburger ── */}
          <button
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* ── Mobile menu ── */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white/95 backdrop-blur-md animate-fade-in">
          <div className="max-w-7xl mx-auto px-4 py-3 space-y-1">
            {NAV_LINKS.map(({ id, label, Icon }) => {
              const isActive = currentPage === id;
              return (
                <button
                  key={id}
                  onClick={() => handleNav(id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                    transition-all duration-150
                    ${isActive
                      ? "bg-indigo-50 text-indigo-700 font-semibold"
                      : "text-slate-700 hover:bg-slate-50"
                    }
                  `}
                >
                  <Icon size={17} />
                  {label}
                </button>
              );
            })}

            <div className="pt-2 pb-1 border-t border-slate-100 mt-2 space-y-2">
              {user ? (
                <>
                  <div className="flex items-center gap-3 px-4 py-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center
                                    text-white text-xs font-bold">
                      {initials}
                    </div>
                    <span className="text-sm font-medium text-slate-700">@{user.username}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium
                               text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={17} /> Sign Out
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleNav("login")}
                    className="btn-secondary w-full justify-center"
                  >
                    <LogIn size={14} /> Sign In
                  </button>
                  <button
                    onClick={() => handleNav("register")}
                    className="btn-primary w-full justify-center"
                  >
                    <UserPlus size={14} /> Register
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
