"use client";

import { ApiError, api } from "./api";
import { clearRecentExecutions } from "./recentExecutions";

export const DEFAULT_SERVER_URL = "http://localhost:1011";
export const DEFAULT_FLUX_URL = "http://127.0.0.1:7227";

const KEY_URL = "rusty.serverUrl";
const KEY_API = "rusty.apiKey";
const KEY_FLUX_URL = "rusty.fluxUrl";
const KEY_FLUX_KEY = "rusty.fluxKey";

export type Config = {
  serverUrl: string;
  apiKey: string;
  fluxUrl?: string;
  fluxKey?: string;
};

export function loadConfig(): Config | null {
  if (typeof window === "undefined") return null;
  const serverUrl = localStorage.getItem(KEY_URL);
  const apiKey = localStorage.getItem(KEY_API);
  if (!serverUrl) return null;
  return {
    serverUrl,
    apiKey: apiKey ?? "",
    fluxUrl: localStorage.getItem(KEY_FLUX_URL) ?? undefined,
    fluxKey: localStorage.getItem(KEY_FLUX_KEY) ?? undefined,
  };
}

export function saveConfig(c: Config) {
  localStorage.setItem(KEY_URL, c.serverUrl.replace(/\/+$/, ""));
  localStorage.setItem(KEY_API, c.apiKey);
  if (c.fluxUrl) localStorage.setItem(KEY_FLUX_URL, c.fluxUrl.replace(/\/+$/, ""));
  else localStorage.removeItem(KEY_FLUX_URL);
  if (c.fluxKey) localStorage.setItem(KEY_FLUX_KEY, c.fluxKey);
  else localStorage.removeItem(KEY_FLUX_KEY);
}

export function isValidUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function connect(input: Config): Promise<Config> {
  const serverUrl = input.serverUrl.trim().replace(/\/+$/, "");
  const fluxUrl = input.fluxUrl?.trim().replace(/\/+$/, "") || undefined;
  const fluxKey = input.fluxKey?.trim() || undefined;
  const apiKey = input.apiKey.trim();

  if (!isValidUrl(serverUrl)) {
    throw new ApiError(0, "Server URL must include http:// or https://");
  }
  if (fluxUrl && !isValidUrl(fluxUrl)) {
    throw new ApiError(0, "Flux URL must include http:// or https://");
  }

  await api.ping(serverUrl, apiKey);
  const cfg = { serverUrl, apiKey, fluxUrl, fluxKey };
  saveConfig(cfg);
  return cfg;
}

export function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return e.message || "Cannot reach server";
    return `${e.status} — ${e.message}`;
  }
  return (e as Error).message;
}

export function clearConfig() {
  localStorage.removeItem(KEY_URL);
  localStorage.removeItem(KEY_API);
  localStorage.removeItem(KEY_FLUX_URL);
  localStorage.removeItem(KEY_FLUX_KEY);
  clearRecentExecutions();
}

export function isConfigured(): boolean {
  return loadConfig() !== null;
}
