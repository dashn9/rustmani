"use client";

import { loadConfig } from "./config";

export type BrowserState = "idle" | "reserved" | "partial_reserved";

export type Browser = {
  browser_id: string;
  execution_id: string;
  public_ip: string;
  private_ip: string;
  grpc_port: number;
  state: BrowserState;
  contexts: string[];
};

export type SpawnResult = { execution_id: string };

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

type ReqOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  baseOverride?: string;
  keyOverride?: string;
  signal?: AbortSignal;
};

async function request<T>(path: string, opts: ReqOptions = {}): Promise<T> {
  const cfg = loadConfig();
  const base = opts.baseOverride ?? cfg?.serverUrl;
  const key = opts.keyOverride ?? cfg?.apiKey ?? "";
  if (!base) throw new ApiError(0, "Not configured");

  const headers: Record<string, string> = { Accept: "application/json" };
  if (key) {
    headers["Authorization"] = `Bearer ${key}`;
    headers["X-API-Key"] = key;
  }
  const method = opts.method ?? "GET";
  const sendsBody = opts.body !== undefined && method !== "GET";
  if (sendsBody) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: sendsBody ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e) {
    throw new ApiError(0, e instanceof Error ? e.message : "Network error");
  }

  const text = await res.text();
  let parsed: unknown = text;
  if (text && res.headers.get("content-type")?.includes("application/json")) {
    try { parsed = JSON.parse(text); } catch { /* leave as text */ }
  }

  if (!res.ok) {
    const msg = (parsed && typeof parsed === "object" && "message" in parsed)
      ? String((parsed as { message: unknown }).message)
      : res.statusText || `HTTP ${res.status}`;
    throw new ApiError(res.status, msg, parsed);
  }
  return parsed as T;
}

export const api = {
  ping: (baseOverride?: string, keyOverride?: string) =>
    request<Browser[]>("/browsers/", { baseOverride, keyOverride }),

  listBrowsers: (signal?: AbortSignal) => request<Browser[]>("/browsers/", { signal }),
  getBrowser: (id: string, signal?: AbortSignal) =>
    request<Browser>(`/browsers/${id}/`, { signal }),

  spawnBrowser: (identity?: Record<string, unknown>) =>
    request<SpawnResult>("/browsers/", { method: "PUT", body: { identity: identity ?? null } }),

  closeBrowser: (id: string) =>
    request<void>(`/browsers/${id}/`, { method: "DELETE" }),
  closeAllBrowsers: () => request<void>("/browsers/", { method: "DELETE" }),

  createContext: (id: string) =>
    request<{ execution_id: string; context_id: string }>(
      `/browsers/${id}/contexts/`, { method: "PUT", body: {} },
    ),
  closeContext: (id: string, ctxId: string) =>
    request<void>(`/browsers/${id}/contexts/${ctxId}/`, { method: "DELETE" }),

  navigate: (id: string, url: string, wait_until?: string) =>
    request<{ ok: true }>(`/browsers/${id}/navigate/`, { method: "POST", body: { url, wait_until } }),
  click: (id: string, x: number, y: number, human = true) =>
    request<{ ok: true }>(`/browsers/${id}/click/`, { method: "POST", body: { x, y, human } }),
  nodeClick: (id: string, node_id: number, human = true) =>
    request<{ ok: true }>(`/browsers/${id}/node-click/`, { method: "POST", body: { node_id, human } }),
  type: (id: string, text: string, node_id?: number) =>
    request<{ ok: true }>(`/browsers/${id}/type/`, { method: "POST", body: { text, node_id } }),
  scrollBy: (id: string, y: number, human = false) =>
    request<{ ok: true }>(`/browsers/${id}/scroll-by/`, { method: "POST", body: { y, human } }),
  scrollTo: (id: string, node_id: number, human = false) =>
    request<{ ok: true }>(`/browsers/${id}/scroll-to/`, { method: "POST", body: { node_id, human } }),
  evaluate: (id: string, script: string) =>
    request<{ result: unknown }>(`/browsers/${id}/eval/`, { method: "POST", body: { script } }),
  sendKeys: (id: string, keys: string) =>
    request<{ ok: true }>(`/browsers/${id}/send-keys/`, { method: "POST", body: { keys } }),
  holdKey: (id: string, key: string) =>
    request<{ ok: true }>(`/browsers/${id}/hold-key/`, { method: "POST", body: { key } }),

  screenshot: (id: string) =>
    request<{ data: string }>(`/browsers/${id}/screenshot/`, { method: "POST", body: {} }),
  fetchHtml: (id: string, node_id?: number) =>
    request<{ html: string }>(`/browsers/${id}/fetch-html/`, { method: "POST", body: { node_id } }),
  fetchText: (id: string, node_id: number) =>
    request<{ text: string }>(`/browsers/${id}/fetch-text/`, { method: "POST", body: { node_id } }),
  findNode: (id: string, selector: string) =>
    request<{ node_id: number }>(`/browsers/${id}/find-node/`, { method: "POST", body: { selector } }),
  waitForNode: (id: string, selector: string, timeout_ms: number) =>
    request<{ node_id: number }>(`/browsers/${id}/wait-for-node/`, {
      method: "POST", body: { selector, timeout_ms },
    }),
  uiMap: (id: string, signal?: AbortSignal) =>
    request<unknown>(`/browsers/${id}/ui-map/`, { signal }),
  uiMapDiff: (id: string, signal?: AbortSignal) =>
    request<unknown>(`/browsers/${id}/ui-map-diff/`, { signal }),

  instruct: (id: string, instruction: string) =>
    request<{ execution_id: string; status: string }>(`/browsers/${id}/instruct/`, {
      method: "POST", body: { instruction },
    }),
  logs: (id: string, signal?: AbortSignal) =>
    request<{ logs: string }>(`/browsers/${id}/logs/`, { signal }),

  teardown: () => request<unknown>("/teardown/", { method: "DELETE" }),
};
