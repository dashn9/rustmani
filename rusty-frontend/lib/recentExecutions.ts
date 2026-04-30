"use client";

const KEY = "rusty.recentExecutions";
const CAP = 30;

export type RecentExecution = {
  id: string;
  /** epoch ms */
  spawnedAt: number;
};

export function loadRecentExecutions(): RecentExecution[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is RecentExecution =>
        !!x && typeof x === "object" && typeof (x as RecentExecution).id === "string",
    );
  } catch {
    return [];
  }
}

export function pushRecentExecution(id: string) {
  if (typeof window === "undefined" || !id) return;
  const cur = loadRecentExecutions().filter((e) => e.id !== id);
  const next: RecentExecution[] = [{ id, spawnedAt: Date.now() }, ...cur].slice(0, CAP);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
}

export function clearRecentExecutions() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
