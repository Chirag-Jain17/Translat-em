/**
 * src/App.jsx
 *
 * Root application component.
 * Implements pure-state routing using a `currentPage` string.
 * No react-router-dom required.
 */

import { useState } from "react";
import Navbar from "./components/Navbar.jsx";
import Home from "./pages/Home.jsx";
import Explore from "./pages/Explore.jsx";
import Profile from "./pages/Profile.jsx";

// ── Global constant used by all fetch calls ───────────────────────────────────
export const API_BASE_URL = "http://localhost:8000";

// ── Demo user (replace with real auth in production) ──────────────────────────
export const DEMO_USER = {
  username: "translator_demo",
  email: "demo@translator.app",
  avatar_url: null,
};

export default function App() {
  const [currentPage, setCurrentPage] = useState("home");

  const navigate = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-cream-50 flex flex-col">
      <Navbar currentPage={currentPage} navigate={navigate} />

      <main className="flex-1 animate-fade-in">
        {currentPage === "home"    && <Home    navigate={navigate} />}
        {currentPage === "explore" && <Explore navigate={navigate} />}
        {currentPage === "profile" && <Profile navigate={navigate} />}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-100 bg-white mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center">
              <span className="text-white font-serif font-bold text-xs">T</span>
            </div>
            <span className="text-sm font-semibold text-slate-700">AI Translator</span>
          </div>
          <p className="text-xs text-slate-400">
            Built with FastAPI + React · AI-powered translation engine
          </p>
          <div className="flex gap-4 text-xs text-slate-400">
            <button onClick={() => navigate("home")}    className="hover:text-indigo-600 transition-colors">Studio</button>
            <button onClick={() => navigate("explore")} className="hover:text-indigo-600 transition-colors">Explore</button>
            <button onClick={() => navigate("profile")} className="hover:text-indigo-600 transition-colors">Profile</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
