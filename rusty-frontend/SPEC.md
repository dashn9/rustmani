# Rusty Browser Frontend — Spec

---

## What is Rusty Browser

Rusty Browser is a browser automation cluster. It lets you spawn, manage, and control
multiple browser instances at scale — each running as an isolated agent — and drive them
with either direct commands or natural language instructions powered by an AI model.

### How it works

There are three layers:

**rusty-server** is the control plane. It exposes an HTTP API that the frontend talks to.
It maintains a registry of all active browser agents, routes commands to them over gRPC,
and runs an AI instruct engine that takes screenshots and issues browser actions in a loop
until a natural language instruction is completed.

**rusty-agent** is a single-browser worker. Each agent owns exactly one Chromium instance,
binds a gRPC server, and registers itself back to the master on startup. The master then
sends it commands directly. Agents are stateless — they sync on startup and can be replaced.

**Flux** is the serverless execution platform that spawns and manages agent processes across
nodes. When a browser is spawned, Flux launches a rusty-agent binary on an available node,
injects the master's gRPC URL, and returns an execution ID. Rusty Browser uses this ID to
track the agent and fetch its logs. For local development, agents can be spawned as local
subprocesses instead, bypassing Flux entirely.

Redis sits underneath rusty-server as the shared state store for the browser registry.

---

## Feel

Cool, modern, minimal. Inspired by dev-tool dashboards (Vercel, Railway, Linear).
Motion is subtle. Typography is tight and technical — monospace for IDs, ports, and URLs.
Status communicated through color-coded badges.

---

## Colors

```
Brand dark (sidebar, primary buttons):  --wb          oklch(0.2982 0.0214 25.41)
Brand scale:                            --wb-50–950   warm hue 25.41
White text on dark:                     --wb-inverse
Hover fills:                            --wb-hover
Page background:                        --background  oklch(1 0.0214 5.41)
Cards:                                  --card        oklch(1 0 0)
Borders:                                --border      oklch(0.922 0 0)
Muted text:                             --muted-foreground  oklch(0.556 0 0)
Vibrant CTA accent:                     --chart-1     oklch(0.646 0.222 41.116)

Added:
  Active green:  oklch(0.72 0.17 148)
  Error red:     oklch(0.60 0.20 25)
  Loading amber: oklch(0.78 0.16 68)
```

---

## Sidebar

Fixed left column. Sections:

1. **Brand strip** — logo icon + "Rusty Browser" wordmark
2. **Nav items** — icon + label, with count badges where relevant:
   - Overview
   - Browsers (browser count badge)
   - Logs
   - Nodes (node count badge)
   - Settings
3. **Footer** — pulsing green connected dot + server URL (monospace, truncated). Red dot if disconnected.

---

## Pages & State

### 1. Setup

Two-column full-page. Left: hero panel with brand copy. Right: form.

**State: idle**
- Mode picker: "Connect to server" / "Local setup"

**State: mode = Connect**
- Server URL input, API key input (with show/hide toggle), Connect button

**State: mode = Local**
- Pre-filled defaults info block, optional API key field, Launch button

**State: connecting**
- Button loading, inputs disabled

**State: failed**
- Error shown, form re-enabled

**State: connected**
- Redirect to Overview

---

### 2. Overview (home)

Full system state at a glance.

**Rusty Browser stats** — stat cards: Total browsers, Active, Idle, Errors

**Charts**
- Browsers spawned over time (line/area chart)
- Context count per browser agent (bar chart)

**Nodes summary** — pulled from the Flux API
- Node table: ID, status, platform, memory, CPU, registered functions, uptime
- Shows "Flux unreachable" warning if the Flux URL is not reachable

**State: loading** — skeleton loaders throughout

**State: Flux unreachable** — rusty-server stats still show; nodes section shows warning card

---

### 3. Browsers

**State: loading** — skeleton grid

**State: empty** — empty state + Spawn CTA

**State: populated**
- Stat bar: Total / Active / Idle / Errors
- Topbar: Spawn button. When browsers are selected: batch action bar appears
- Browser card grid. Each card: ID, status badge, host, gRPC port, context count
- Clicking a card opens the Browser Detail panel (see below)
- Each card has a checkbox for multi-select

**State: one or more selected**
- Batch action bar slides in above the grid with actions:
  - Close selected
  - Navigate all (opens URL input, navigates all selected browsers)
  - Instruct all (opens instruction input, sends to all selected browsers)
  - Screenshot all

**State: spawning** — modal with optional geo input

---

### 3a. Browser Detail

Opened by clicking a browser card. Renders as a slide-over panel or full detail page.

**Info section**
- Full browser ID, status, host, gRPC port, context count, Flux execution ID

**Actions**

Interaction:
- Navigate — URL input
- Click — x/y coordinate inputs
- Node click — CSS selector input (resolves node_id then clicks)
- Type — text input, optional CSS selector to target a node
- Scroll by — Y pixel amount input
- Scroll to node — CSS selector input, scrolls node into view
- Evaluate JS — code input, output rendered inline

Inspection:
- Screenshot — renders current viewport inline
- Fetch HTML — optional CSS selector; returns inner HTML
- Fetch text — CSS selector; returns inner text
- Find node — CSS selector; returns node_id
- Wait for node — CSS selector + optional timeout; returns node_id when found
- UI map — renders the full accessibility node tree

Contexts:
- Create context — opens a new browsing context (tab)
- Close context — context ID input, closes that context

AI:
- Instruct — natural language input, fire-and-forget (202), output visible in logs section

Lifecycle:
- Close browser — confirm then delete

**Logs section**
- Live log output from `/browsers/{id}/logs/` shown inline at the bottom of the detail view

**State: loading** — skeleton for info and logs

**State: screenshot taken** — image rendered inline below the action

---

### 4. Logs

**State: none selected** — placeholder

**State: browser selected**
- Terminal-style scrollable log output
- Auto-scroll toggle

---

### 5. Nodes

**State: loading** — skeleton rows

**State: loaded**
- Full node table (ID, status, platform, memory, CPU, functions, joined)
- Each row expandable: active executions, detail
- Terminate node action per row

**State: unreachable** — error state with retry button

---

### 6. Settings

- Rusty Browser: Server URL, API key, Save & reconnect
- Flux URL (read-only, informational)
- Danger zone: Disconnect, Teardown all (closes all browsers + terminates Flux nodes)

**State: saving** — loading, fields disabled

**State: disconnected** — returns to Setup
