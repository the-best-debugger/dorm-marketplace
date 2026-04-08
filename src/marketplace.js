export const CLAIM_WINDOW_MS = 20 * 1000;
export const STORAGE_KEY = "dorm-marketplace-items-v1";

export const State = Object.freeze({
  AVAILABLE: "available",
  CLAIMED: "claimed",
  SOLD: "sold",
  REMOVED: "removed",
});

export function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistItems(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function normalize(value) {
  return String(value ?? "").trim();
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
