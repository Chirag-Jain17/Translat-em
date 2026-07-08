/**
 * src/services/api.js
 *
 * Centralised API client.
 * All fetch calls in the app use the functions defined here
 * so the base URL is defined in exactly one place.
 */

const API_BASE_URL = "http://localhost:8000";

// ── Generic helper ────────────────────────────────────────────────────────────
async function request(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (res.status === 204) return null; // No content (DELETE)

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.detail || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// ── Translation endpoints ─────────────────────────────────────────────────────

export const translateText = (payload) =>
  request("/api/translate/text", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const uploadFile = (formData) =>
  fetch(`${API_BASE_URL}/api/translate/file`, {
    method: "POST",
    body: formData,         // Do NOT set Content-Type header — browser handles multipart boundary
  }).then(async (res) => {
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
    return data;
  });

export const getTranslationStatus = (id) =>
  request(`/api/translate/${id}/status`);

export const getTranslation = (id) =>
  request(`/api/translate/${id}`);

export const updateVisibility = (id, is_public) =>
  request(`/api/translate/${id}/visibility`, {
    method: "PATCH",
    body: JSON.stringify({ is_public }),
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

export const getProfile = (username) =>
  request(`/api/profile/${username}`);

export const createUser = (payload) =>
  request("/api/users", { method: "POST", body: JSON.stringify(payload) });

export const getUser = (username) =>
  request(`/api/users/${username}`);

export { API_BASE_URL };
