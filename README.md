<h1 align="center">
  <img src="https://rustybrowser.com/logos/rusty-browser_inv.png" height="50" valign="middle" />
  &nbsp;Rusty Browser
</h1>

**Distributed AI-driven stealth browser automation at scale — built in Rust.**

Rusty is a serverless browser automation platform. You spawn and manage browser agents on demand via an HTTP API, CLI, or the Frontend, send them commands (navigate, click, type, screenshot, scroll, eval JS), or drive them with natural language through an AI instruct engine. Each agent runs in isolation.

---

## Demo

![Rusty Browser demo](https://github.com/user-attachments/assets/0ed6e155-8ba2-4481-a058-5fb5f5c98b33)

**Cluster bootstrap → 36 live-streamed Chromes → auto-scale → teardown — all driven from the CLI.**

- Boots a 3-node cluster (`e2-medium`, 2 vCPU / 4 GB each) with one command
- Spawns **36 Chrome browsers**, each streaming its display and logs to the frontend in real time
- Auto-scales to a 4th node the moment load hits the configured ceiling — visible live on the dashboard
- Tears the whole thing down on demand

## Postman APIs

All API endpoints are available in the [Rusty Browser Postman workspace](https://www.postman.com/ishogbon/workspace/rusty-browser).

---


**Rusty is for when you need browsers to behave like serverless functions** — spawn on demand, run independently, scale horizontally via [Flux](https://github.com/dashn9/serverless-flux), and clean up automatically. It is not a wrapper around Playwright or Puppeteer. It uses [rustenium-identity](https://github.com/dashn9/rustenium-identity) for stealth identity, and drives Chromium directly via the `Webdriver BiDi` / CDP protocol through [rustenium](https://github.com/dashn9/rustenium).


---

## Configuration

See [`rusty-server/example.rusty.yaml`](rusty-server/example.rusty.yaml) for a full annotated reference.


### Local development / usage (no Flux)

Set `flux.local_binary` in your config to spawn agents as local subprocesses instead of deploying via Flux. Agent stdout/stderr is forwarded through the server's tracing output, prefixed with the execution ID.

```yaml
flux:
  local_binary: "cargo run -p rusty-agent --"  # or path to a built binary
```

Agent logs are emitted under the `rusty_agent` target and can be filtered independently:

```sh
RUST_LOG=rusty=info,rusty_agent=debug cargo run -p rusty-server
```

---

## Initialization

Before spawning any browsers, call `POST /initialize/` once. This generates TLS certs, registers the agent function with Flux, downloads the agent binary, bundles everything into a zip, and deploys it. Re-run after any agent code changes or when rotating TLS certs.

---

## Proxy Support

See [`rusty-server/example.agent-proxies.yaml`](rusty-server/example.agent-proxies.yaml). Proxies are geo-matched to the browser identity and bundled into each agent at initialization.

---

## Setup

Run the interactive setup script — it downloads all binaries, walks you through configuration, and generates launch scripts:

```
powershell -Command "curl.exe -sSL https://raw.githubusercontent.com/dashn9/rusty-browser/main/setup.ps1 -o setup.ps1; & .\setup.ps1"
```

**Prerequisites:** Node.js v18+ (for the frontend), Redis running or accessible.

> **Not publicly reachable?** You'll need [ngrok](https://ngrok.com/download) to tunnel the gRPC port. The setup script will prompt you and tell you the exact command to run.

Once setup completes, start the stack:

```powershell
rusty-launch             # server only
rusty-launch -Frontend   # server + frontend
```

To start the frontend independently:

```powershell
rusty-frontend
```

Then initialize once before spawning any browsers (generates TLS certs, deploys agent to Flux):

```sh
rusty-cli init
# or use the Initialize button in the frontend UI
```

---

## Postman

All API endpoints are available in the [Rusty Browser Postman workspace](https://www.postman.com/ishogbon/workspace/rusty-browser).

---

## License

MIT
