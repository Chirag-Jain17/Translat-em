/**
 * src/services/api.js
 *
 * Centralised API client.
 * All fetch calls in the app use the functions defined here
 * so the base URL and auth token are handled in exactly one place.
 */

const API_BASE_URL = "http://localhost:8000";
const TOKEN_KEY    = "ai_translator_token";

// ── Generic helper ────────────────────────────────────────────────────────────
async function request(path, options = {}) {
  const url   = `${API_BASE_URL}${path}`;
  const token = localStorage.getItem(TOKEN_KEY);

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Attach bearer token when available
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 204) return null; // No content (DELETE)

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.detail || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// ── File upload helper (multipart — browser sets Content-Type boundary) ────────
async function requestFile(path, formData) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
  return data;
}

// ── Auth endpoints ────────────────────────────────────────────────────────────

export const authRegister = (payload) =>
  request("/api/auth/register", { method: "POST", body: JSON.stringify(payload) });

export const authLogin = (payload) =>
  request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) });

export const authMe = () => request("/api/auth/me");

// ── Translation endpoints ─────────────────────────────────────────────────────

export const translateText = (payload) =>
  request("/api/translate/text", { method: "POST", body: JSON.stringify(payload) });

export const uploadFile = (formData) => requestFile("/api/translate/file", formData);

export const getTranslationStatus = (id) => request(`/api/translate/${id}/status`);

export const getTranslation = (id) => request(`/api/translate/${id}`);

export const updateVisibility = (id, is_public) =>
  request(`/api/translate/${id}/visibility`, {
    method: "PATCH",
    body:   JSON.stringify({ is_public }),
  });

export const deleteTranslation = (id) =>
  request(`/api/translate/${id}`, { method: "DELETE" });

// ── Explore endpoint ──────────────────────────────────────────────────────────

export const exploreTranslations = ({ search, filter_by, sort_by, page, page_size } = {}) => {
  const params = new URLSearchParams();
  if (search)     params.set("search",    search);
  if (filter_by)  params.set("filter_by", filter_by);
  if (sort_by)    params.set("sort_by",   sort_by);
  if (page)       params.set("page",      page);
  if (page_size)  params.set("page_size", page_size);
  return request(`/api/explore?${params}`);
};

// ── User / Profile endpoints ──────────────────────────────────────────────────

export const getProfile = (username) => request(`/api/profile/${username}`);

export const createUser = (payload) =>
  request("/api/users", { method: "POST", body: JSON.stringify(payload) });

export const getUser = (username) => request(`/api/users/${username}`);

export { API_BASE_URL };
