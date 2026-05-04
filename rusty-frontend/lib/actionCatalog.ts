"use client";

import { api } from "./api";

export type ActionField =
  | { kind: "text"; name: string; placeholder?: string; mono?: boolean; required?: boolean }
  | { kind: "number"; name: string; placeholder?: string; required?: boolean }
  | { kind: "checkbox"; name: string; label: string };

export type ActionGroup = "Navigation" | "Interaction" | "Inspection" | "Lifecycle" | "AI";

export type ActionDef = {
  id: string;
  label: string;
  group: ActionGroup;
  destructive?: boolean;
  /** Clear the selection after a fully-successful batch run (e.g. closed browsers no longer exist). */
  clearSelectionOnSuccess?: boolean;
  fields: ActionField[];
  run: (browserId: string, values: Record<string, string>) => Promise<unknown>;
};

const num = (s: string | undefined): number | undefined =>
  s == null || s.trim() === "" ? undefined : Number(s);

export const ACTIONS: ActionDef[] = [
  {
    id: "navigate", label: "Navigate", group: "Navigation",
    fields: [{ kind: "text", name: "url", placeholder: "https://example.com", mono: true, required: true }],
    run: (id, v) => api.navigate(id, v.url),
  },
  {
    id: "click", label: "Click", group: "Interaction",
    fields: [
      { kind: "number", name: "x", placeholder: "x", required: true },
      { kind: "number", name: "y", placeholder: "y", required: true },
    ],
    run: (id, v) => api.click(id, Number(v.x), Number(v.y)),
  },
  {
    id: "node-click", label: "Node click", group: "Interaction",
    fields: [{ kind: "number", name: "node_id", placeholder: "node_id", required: true }],
    run: (id, v) => api.nodeClick(id, Number(v.node_id)),
  },
  {
    id: "type", label: "Type", group: "Interaction",
    fields: [
      { kind: "text", name: "text", placeholder: "text", required: true },
      { kind: "number", name: "node_id", placeholder: "node_id (optional)" },
    ],
    run: (id, v) => api.type(id, v.text, num(v.node_id)),
  },
  {
    id: "scroll-by", label: "Scroll by", group: "Interaction",
    fields: [{ kind: "number", name: "y", placeholder: "Y px", required: true }],
    run: (id, v) => api.scrollBy(id, Number(v.y)),
  },
  {
    id: "scroll-to", label: "Scroll to node", group: "Interaction",
    fields: [{ kind: "number", name: "node_id", placeholder: "node_id", required: true }],
    run: (id, v) => api.scrollTo(id, Number(v.node_id)),
  },
  {
    id: "send-keys", label: "Send keys", group: "Interaction",
    fields: [{ kind: "text", name: "keys", placeholder: "Enter, Tab, Ctrl+A…", mono: true, required: true }],
    run: (id, v) => api.sendKeys(id, v.keys),
  },
  {
    id: "hold-key", label: "Hold key", group: "Interaction",
    fields: [{ kind: "text", name: "key", placeholder: "Shift, Control…", mono: true, required: true }],
    run: (id, v) => api.holdKey(id, v.key),
  },
  {
    id: "eval", label: "Eval JS", group: "Interaction",
    fields: [{ kind: "text", name: "script", placeholder: "1 + 1", mono: true, required: true }],
    run: (id, v) => api.evaluate(id, v.script),
  },

  {
    id: "screenshot", label: "Screenshot", group: "Inspection", fields: [],
    run: (id) => api.screenshot(id),
  },
  {
    id: "fetch-html", label: "Fetch HTML", group: "Inspection",
    fields: [{ kind: "number", name: "node_id", placeholder: "node_id (optional, full page)" }],
    run: (id, v) => api.fetchHtml(id, num(v.node_id)),
  },
  {
    id: "fetch-text", label: "Fetch text", group: "Inspection",
    fields: [{ kind: "number", name: "node_id", placeholder: "node_id", required: true }],
    run: (id, v) => api.fetchText(id, Number(v.node_id)),
  },
  {
    id: "find-node", label: "Find node", group: "Inspection",
    fields: [{ kind: "text", name: "selector", placeholder: "CSS selector", mono: true, required: true }],
    run: (id, v) => api.findNode(id, v.selector),
  },
  {
    id: "wait-for-node", label: "Wait for node", group: "Inspection",
    fields: [
      { kind: "text", name: "selector", placeholder: "CSS selector", mono: true, required: true },
      { kind: "number", name: "timeout_ms", placeholder: "timeout ms", required: true },
    ],
    run: (id, v) => api.waitForNode(id, v.selector, Number(v.timeout_ms)),
  },

  {
    id: "create-context", label: "Create context", group: "Lifecycle", fields: [],
    run: (id) => api.createContext(id),
  },
  {
    id: "close-context", label: "Close context", group: "Lifecycle",
    fields: [{ kind: "text", name: "ctx", placeholder: "context id", mono: true, required: true }],
    run: (id, v) => api.closeContext(id, v.ctx),
  },
  {
    id: "close-browser", label: "Close browser", group: "Lifecycle",
    destructive: true, clearSelectionOnSuccess: true,
    fields: [{ kind: "checkbox", name: "force", label: "Force" }],
    run: (id, v) => api.closeBrowser(id, v.force === "true"),
  },

  {
    id: "instruct", label: "Instruct", group: "AI",
    fields: [{ kind: "text", name: "instruction", placeholder: "Find the sign-up link and click it…", required: true }],
    run: (id, v) => api.instruct(id, v.instruction),
  },
];

export function getAction(id: string): ActionDef | undefined {
  return ACTIONS.find((a) => a.id === id);
}

export function actionsByGroup(): Record<ActionGroup, ActionDef[]> {
  const groups: Record<ActionGroup, ActionDef[]> = {
    Navigation: [], Interaction: [], Inspection: [], Lifecycle: [], AI: [],
  };
  for (const a of ACTIONS) groups[a.group].push(a);
  return groups;
}
