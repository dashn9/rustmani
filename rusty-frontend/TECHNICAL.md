# Rusty Browser Frontend — Technical Reference

---

## Prerequisites

### 1. Redis *(optional)*
If no Redis URL is provided, the server will automatically download and start a local Redis
instance on `127.0.0.1:6379`. No manual setup required for local development.

To use your own Redis instance, set the URL in `rusty.yaml`:
```yaml
redis:
  url: "redis://127.0.0.1:6379"
```
Omit the `redis` block entirely to use auto-download.

---

### 2. rusty-server binary

**Download from GitHub Releases:**
```
https://github.com/<org>/rustmani/releases/latest
```
Pick the binary for your platform: `rusty` (Linux/macOS) or `rusty.exe` (Windows).

**Or build from source:**
```bash
cargo build --release -p rusty-server
# binary: target/release/rusty
```

---

### 3. rusty-agent binary

The agent is deployed automatically by Flux when a browser is spawned.  
For **local mode** (no Flux), you need it built locally:

```bash
cargo build --release -p rusty-agent
# binary: target/release/rusty-agent
```

---

### 4. rusty-cli (optional)

```bash
cargo install --path rusty-cli
```

Used for `rusty-cli init` (generates certs + registers the agent function) and general API interaction from the terminal.

---

## Configuration — rusty.yaml

Create `rusty.yaml` before starting the server. Minimal local config:

```yaml
server:
  http_port: 8080
  insecure_grpc: true          # no TLS in local dev

redis:
  url: "redis://127.0.0.1:6379"

ai:
  provider: "openrouter"       # or "openai"
  api_key: "your_api_key"
  model: "anthropic/claude-sonnet-4-20250514"

flux:
  url: "http://127.0.0.1:7227" # ignored when local_binary is set
  token: "unused"
  local_binary: "target/release/rusty-agent"  # spawn agents locally

api_keys:
  - "your-dashboard-key"       # used by the frontend as the API key
```

For Flux deployment, remove `local_binary` and set the real Flux URL and token.

Full annotated reference: [`rusty-server/example.rusty.yaml`](../rusty-server/example.rusty.yaml)

---

## Initialization

Before spawning any browsers, the server must be initialized once.  
This generates TLS certs and registers the agent function with Flux.

```bash
# via CLI
rusty-cli init

# or directly
curl -X POST http://localhost:8080/initialize/ \
  -H "X-API-Key: your-dashboard-key"
```

Response:
```json
{ "status": "initialized", "function": "rusty-agent", "version": "x.x.x" }
```

For **local mode** (no Flux), initialization is still required to generate the TLS certs that agent processes use to register back to the master.

---

## Starting the server

```bash
RUSTY_CONFIG=rusty.yaml ./rusty
# or from source:
RUSTY_CONFIG=rusty-server/rusty.yaml cargo run --bin rusty
```

Server listens on `http://0.0.0.0:<http_port>` (default 8080).

---

## Frontend connection

Open `index.html` in a browser. On the Setup screen:

**Connect mode:**
- Server URL: `http://localhost:8080` (or remote URL)
- API Key: value from `api_keys` in rusty.yaml

**Local setup mode:**
- Pre-fills `http://localhost:8080`, no key required if `api_keys` is empty

The frontend pings `GET /browsers/` on connect to verify reachability.

---

## API Reference

All requests send `Authorization: Bearer <api_key>` (or `X-API-Key: <api_key>`).  
Base URL: configured at setup, stored in app state.

### Browsers

| Method | Path | Body | Notes |
|--------|------|------|-------|
| `GET`    | `/browsers/` | — | List all agents |
| `PUT`    | `/browsers/` | `{ geo? }` | Spawn new agent |
| `DELETE` | `/browsers/` | — | Delete all |
| `GET`    | `/browsers/{id}/` | — | Get one |
| `DELETE` | `/browsers/{id}/` | — | Close one |

### Contexts

| Method | Path | Notes |
|--------|------|-------|
| `PUT`    | `/browsers/{id}/contexts/` | Create a new browsing context (tab) |
| `DELETE` | `/browsers/{id}/contexts/{ctx_id}/` | Close a context |

### Interaction

| Method | Path | Body |
|--------|------|------|
| `POST` | `/browsers/{id}/navigate/` | `{ url }` |
| `POST` | `/browsers/{id}/click/` | `{ x, y }` |
| `POST` | `/browsers/{id}/node-click/` | `{ node_id }` |
| `POST` | `/browsers/{id}/type/` | `{ text, node_id? }` |
| `POST` | `/browsers/{id}/scroll-by/` | `{ y }` |
| `POST` | `/browsers/{id}/scroll-to/` | `{ node_id }` |
| `POST` | `/browsers/{id}/eval/` | `{ script }` → result |

### Inspection

| Method | Path | Body |
|--------|------|------|
| `POST` | `/browsers/{id}/screenshot/` | `{}` → `{ screenshot: base64 }` |
| `POST` | `/browsers/{id}/fetch-html/` | `{ node_id? }` → inner HTML |
| `POST` | `/browsers/{id}/fetch-text/` | `{ node_id }` → inner text |
| `POST` | `/browsers/{id}/find-node/` | `{ selector }` → `{ node_id }` |
| `POST` | `/browsers/{id}/wait-for-node/` | `{ selector, timeout_ms? }` → `{ node_id }` |
| `GET`  | `/browsers/{id}/ui-map/` | — → accessibility node tree |

### AI & logs

| Method | Path | Body | Notes |
|--------|------|------|-------|
| `POST` | `/browsers/{id}/instruct/` | `{ instruction }` | Returns 202, async |
| `GET`  | `/browsers/{id}/logs/` | — | Flux execution logs |

### Batch actions (frontend-only, no dedicated endpoint)

Batch actions are implemented by the frontend fanning out the same request to each
selected browser in parallel. No special server endpoint — just concurrent individual calls.

### System

| Method | Path | Notes |
|--------|------|-------|
| `POST`   | `/initialize/` | One-time setup: gen certs + register Flux function |
| `DELETE` | `/teardown/` | Close all browsers + terminate Flux nodes |

---

## Flux API Reference

Used by the Overview and Nodes pages to display infrastructure state.
Base URL: the `flux.url` value from the server config (e.g. `http://127.0.0.1:7227`).
Flux API key sent as `X-API-Key: <flux_token>`.

### Nodes

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/agents` | List all registered Flux agents — no auth required |

Response fields per agent: `id`, `status` (online/offline), `platform` (linux/windows),
`memory_used_mb`, `memory_limit_mb`, `cpu_percent`, `functions` (list), `registered_at`.

### Executions

| Method | Path | Notes |
|--------|------|-------|
| `GET`    | `/executions/{id}` | Poll execution status and live output |
| `DELETE` | `/executions/{id}` | Cancel a running execution |

Execution fields: `id`, `status`, `output` (live log lines), `started_at`, `finished_at`.

### Functions

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/functions` | List registered functions |

### Node teardown

| Method | Path | Notes |
|--------|------|-------|
| `DELETE` | `/nodes/{id}` | Terminate a specific Flux node |

---

## Data flow: Overview page

```
Overview renders on load:

1. GET <rusty_url>/browsers/            → browser list for stats + chart data
2. GET <flux_url>/agents                → node table (status, memory, CPU, functions)
3. GET <flux_url>/executions/{id}       → per-browser log/status (one per browser id)

Flux requests are best-effort: if unreachable, show warning and render rusty data only.
```
