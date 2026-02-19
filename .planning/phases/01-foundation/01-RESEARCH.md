# Phase 1: Foundation - Research

**Researched:** 2026-02-19
**Domain:** Stream Deck SDK v2 TypeScript plugin, WLED HTTP JSON API, mDNS discovery, global settings persistence
**Confidence:** HIGH (core stack verified via official docs; mDNS discovery MEDIUM due to Windows-specific nuances)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Controller registration
- User enters IP/hostname (with optional port, e.g., 192.168.1.50:8080 — defaults to port 80)
- Plugin auto-fetches the WLED device name; user can optionally override it with a custom display name
- Save immediately on add — do not validate reachability first; show offline warning indicator if unreachable
- Removing a controller that's referenced by existing actions is allowed — show a warning note that some actions may reference it and will show errors
- No inline editing — user removes and re-adds to change name or IP

#### mDNS discovery
- Manual scan only — user clicks a "Scan for devices" button (no auto-scan on panel open)
- Discovered devices appear as a list with checkboxes; user selects devices and clicks "Add Selected" to batch-add
- Already-registered devices appear in scan results but visually marked (greyed out / checkmark) — cannot double-add
- Empty scan result: "No WLED devices found on your network" message with a note pointing to manual add by IP

#### Settings layout
- Scan button at the top of the global settings panel
- Controller list below the scan area — simple rows: name, IP, online/offline indicator, remove button
- Manual add form at the bottom (IP field + optional name field + Add button)
- Use standard Elgato Stream Deck Property Inspector CSS — match default SD styling, no custom look
- No inline editing of controllers

### Claude's Discretion
- Connection status polling frequency and mechanism
- Exact timeout values for scan duration
- Online/offline indicator styling (dot, icon, text — within SD PI defaults)
- Error state presentation details
- Internal architecture of ControllerRegistry

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CTRL-01 | User can add WLED controllers by IP address or hostname with a display name | Global settings API (`setGlobalSettings`/`getGlobalSettings`) stores controller list; PI sends `SendToPlugin` message to trigger add; WLEDClient fetches `/json/info` to auto-populate name |
| CTRL-02 | User can remove WLED controllers from the global registry | ControllerRegistry removes entry from global settings array and calls `setGlobalSettings`; PI re-renders list |
| CTRL-03 | User can assign a friendly name to each controller (e.g., "Desk Strip") | Name stored in controller record within global settings; auto-populated from `info.name` on add, overridable in add form |
| CTRL-06 | User can discover WLED controllers on the local network via mDNS auto-discovery | `multicast-dns` 7.2.5 (pure JS, no native bindings) queries `_wled._tcp.local` PTR records; resolved IPs passed to WLEDClient |
| UI-03 | Plugin communicates with WLED via HTTP JSON API (local network only, no cloud) | `fetch()` with `AbortSignal.timeout()` to `/json/info` (read) and `/json/state` (write); no WebSocket |
| UI-04 | Plugin built on Stream Deck SDK v2 with TypeScript | `@elgato/streamdeck` package with `SingletonAction` base class and `@action()` decorator; scaffold via `streamdeck create` |
</phase_requirements>

---

## Summary

Phase 1 establishes the entire foundation that every subsequent phase builds on. The three plan areas — SDK scaffold, WLEDClient HTTP wrapper, and ControllerRegistry — are well-understood territory with high-quality official documentation and no surprising architectural constraints.

The Stream Deck SDK v2 (`@elgato/streamdeck`) provides a TypeScript-first, decorator-based plugin model. Global settings (the storage mechanism for the controller registry) are a first-class SDK feature: `streamDeck.settings.setGlobalSettings()` / `getGlobalSettings()` persist JSON to secure local storage and survive restarts. The global settings panel is a standard Property Inspector HTML file declared at the plugin level in `manifest.json` via `PropertyInspectorPath`. The PI communicates with the plugin backend via `SendToPlugin` / `sendToPropertyInspector` WebSocket messages.

WLED exposes a clean HTTP JSON API. `GET /json/info` returns the device friendly name (`info.name`), which handles the auto-name-on-add requirement. `POST /json/state` controls lights. All requests must use `AbortSignal.timeout()` to prevent plugin freeze on offline controllers. mDNS discovery uses `multicast-dns` 7.2.5 (pure JavaScript, no native bindings, Windows-safe) by querying for `_wled._tcp.local` PTR records.

**Primary recommendation:** Scaffold with `streamdeck create`, implement `ControllerRegistry` as a singleton that wraps global settings persistence, build `WLEDClient` with `AbortSignal.timeout()` on every request, and use `multicast-dns` for PTR record discovery. These are proven patterns with no need for custom infrastructure.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@elgato/streamdeck` | Latest (SDKv2) | Stream Deck plugin framework | Official Elgato SDK; provides actions, settings, PI communication, manifest |
| `@elgato/cli` | Latest | Project scaffold and dev tooling | Official CLI; creates project structure, provides `npm run watch` hot-reload |
| Node.js | 20.x or 24.x | Plugin runtime | Required by SD 7.x; version declared in `manifest.json` `Nodejs.Version` field |
| TypeScript | Bundled via scaffold | Type safety | Pre-configured by `streamdeck create`; uses Rollup for bundling |
| `multicast-dns` | 7.2.5 | mDNS PTR/SRV/A record querying | Pure JS (no native bindings), Windows-safe; widely used (576 dependents) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/multicast-dns` | 7.2.4 | TypeScript types for multicast-dns | Always — add alongside `multicast-dns` for type safety |
| `sdpi-components` | Latest (local copy) | Pre-built SD UI web components | Use for the global settings panel HTML; download and reference locally (not CDN) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `multicast-dns` | `mdns` (native) | `mdns` requires Apple Bonjour SDK on Windows — hard dependency, breaks in dev/CI. `multicast-dns` is pure JS and works everywhere. |
| `multicast-dns` | `@astronautlabs/mdns` | Newer, native TS, also pure JS. `multicast-dns` has broader ecosystem use and stable API. Only switch if `multicast-dns` has Windows UDP issues. |
| `fetch()` built-in | `axios` or `node-fetch` | Node.js 20+ has native `fetch()` with `AbortSignal` support. No extra library needed. |

**Installation:**
```bash
# After streamdeck create scaffold:
npm install multicast-dns
npm install --save-dev @types/multicast-dns
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── plugin.ts                    # Entry point — streamDeck.connect()
├── actions/                     # Phase 2+: action classes go here
├── client/
│   └── WLEDClient.ts            # HTTP wrapper with AbortSignal timeouts
├── registry/
│   ├── ControllerRegistry.ts    # Singleton: CRUD + global settings persistence
│   └── types.ts                 # WLEDController interface, RegistryState
└── discovery/
    └── MDNSScanner.ts           # multicast-dns PTR scan, returns discovered IPs

.sdPlugin/
├── manifest.json                # Plugin metadata, Nodejs version, global PI path
├── bin/                         # Compiled output (rollup output)
├── ui/
│   └── global-settings.html     # Global settings Property Inspector
└── imgs/                        # Plugin and category icons
```

### Pattern 1: Global Settings as Controller Store

**What:** The `ControllerRegistry` singleton reads/writes the entire controller list from `streamDeck.settings.setGlobalSettings()`. No database, no file I/O — the SDK handles persistence.

**When to use:** Any plugin-wide state that must survive restarts and be accessible to all actions.

**Example:**
```typescript
// Source: https://docs.elgato.com/streamdeck/sdk/guides/settings/
interface RegistryState {
  controllers: WLEDController[];
}

interface WLEDController {
  id: string;          // uuid — stable identifier for action references
  ip: string;          // e.g. "192.168.1.50" or "192.168.1.50:8080"
  name: string;        // display name (auto-fetched or user-set)
  addedAt: number;     // timestamp for ordering
}

class ControllerRegistry {
  private static instance: ControllerRegistry;
  private state: RegistryState = { controllers: [] };

  static getInstance(): ControllerRegistry {
    if (!ControllerRegistry.instance) {
      ControllerRegistry.instance = new ControllerRegistry();
    }
    return ControllerRegistry.instance;
  }

  async load(): Promise<void> {
    const saved = await streamDeck.settings.getGlobalSettings<RegistryState>();
    this.state = saved ?? { controllers: [] };
  }

  async add(controller: WLEDController): Promise<void> {
    this.state.controllers.push(controller);
    await streamDeck.settings.setGlobalSettings(this.state);
  }

  async remove(id: string): Promise<void> {
    this.state.controllers = this.state.controllers.filter(c => c.id !== id);
    await streamDeck.settings.setGlobalSettings(this.state);
  }

  getAll(): WLEDController[] {
    return this.state.controllers;
  }
}
```

### Pattern 2: WLEDClient with AbortSignal.timeout()

**What:** Every WLED HTTP request uses `AbortSignal.timeout()` — the modern Node.js 20+ built-in that auto-aborts after N milliseconds. No `setTimeout` + `clearTimeout` boilerplate.

**When to use:** All WLED requests (info fetch, state POST). Timeout 500ms for online checks, 1500ms for state writes.

**Example:**
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static
// and prior WLED plugin research decisions
class WLEDClient {
  constructor(private readonly baseUrl: string) {}

  async getInfo(): Promise<WLEDInfo> {
    const response = await fetch(`${this.baseUrl}/json/info`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<WLEDInfo>;
  }

  async setState(patch: Partial<WLEDState>): Promise<void> {
    const response = await fetch(`${this.baseUrl}/json/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  }

  static fromController(controller: WLEDController): WLEDClient {
    const host = controller.ip.includes(':')
      ? controller.ip
      : `${controller.ip}:80`;
    return new WLEDClient(`http://${host}`);
  }
}
```

### Pattern 3: Global Settings Property Inspector Communication

**What:** The global settings HTML panel (`global-settings.html`) talks to the plugin backend via the WebSocket `SendToPlugin` / `sendToPropertyInspector` message pair.

**When to use:** Whenever the PI needs to trigger side effects in the plugin (e.g., add a controller, run an mDNS scan). Do not try to call plugin logic from PI JavaScript directly — use message passing.

**Example:**
```typescript
// Plugin backend (plugin.ts) — listen for PI messages
streamDeck.ui.onDidReceiveMessage((ev) => {
  const { action, payload } = ev;
  if (payload.type === 'addController') {
    ControllerRegistry.getInstance().add(payload.controller);
    // Push updated list back to PI
    ev.action.sendToPropertyInspector({ type: 'controllerList', controllers: ... });
  }
});
```

```javascript
// global-settings.html — send message to plugin
const { streamDeckClient } = SDPIComponents;
document.getElementById('btn-add').addEventListener('click', () => {
  streamDeckClient.sendToPlugin({
    type: 'addController',
    controller: { ip: document.getElementById('ip').value, name: ... }
  });
});
```

### Pattern 4: mDNS PTR Scan with multicast-dns

**What:** Send a PTR query for `_wled._tcp.local` and collect SRV + A record responses within a timeout window (3-5 seconds), then destroy the socket.

**When to use:** When user clicks "Scan for devices" in the global settings panel.

**Example:**
```typescript
// Source: https://github.com/mafintosh/multicast-dns (README API)
import mdns from 'multicast-dns';

async function scanForWLED(timeoutMs = 4000): Promise<DiscoveredDevice[]> {
  return new Promise((resolve) => {
    const m = mdns();
    const discovered = new Map<string, DiscoveredDevice>();
    const timer = setTimeout(() => {
      m.destroy();
      resolve(Array.from(discovered.values()));
    }, timeoutMs);

    m.on('response', (response) => {
      // PTR answer contains service instance name
      const ptrAnswers = response.answers.filter(r => r.type === 'PTR');
      // A records in additionals contain IPv4 addresses
      const aRecords = response.additionals.filter(r => r.type === 'A');
      // SRV records in additionals contain the hostname and port
      const srvRecords = response.additionals.filter(r => r.type === 'SRV');

      for (const a of aRecords) {
        if (!discovered.has(a.name)) {
          discovered.set(a.data as string, {
            ip: a.data as string,
            name: a.name.replace('.local', ''),
          });
        }
      }
    });

    m.query({ questions: [{ name: '_wled._tcp.local', type: 'PTR' }] });
  });
}
```

### Pattern 5: manifest.json Global Settings Panel Declaration

**What:** Declare `PropertyInspectorPath` at the plugin root level (not inside an action) to provide a global settings UI panel.

```json
{
  "UUID": "com.yourname.wled-stream-deck",
  "Name": "WLED",
  "Author": "Your Name",
  "Version": "0.1.0.0",
  "Description": "Control WLED LED strips from Stream Deck",
  "SDKVersion": 2,
  "Software": { "MinimumVersion": "6.6" },
  "OS": [{ "Platform": "mac", "MinimumVersion": "10.15" }, { "Platform": "windows", "MinimumVersion": "10" }],
  "Nodejs": { "Version": "20", "Debug": "enabled" },
  "CodePath": "bin/plugin.js",
  "Icon": "imgs/plugin-icon",
  "Category": "WLED",
  "PropertyInspectorPath": "ui/global-settings.html",
  "Actions": []
}
```

### Anti-Patterns to Avoid

- **Per-action controller storage:** Storing controller data in action-level settings (`ev.action.setSettings()`) causes every action to have its own copy. When a controller IP changes, every action must update. Use global settings for the registry, always.
- **Synchronous global settings access:** `getGlobalSettings()` is async. Do not read `this.state` before `await load()` completes on plugin startup.
- **`new AbortController()` + `setTimeout` boilerplate:** Node.js 20+ has `AbortSignal.timeout(ms)` — use it directly. The old pattern adds unnecessary cleanup code.
- **`mdns` (native) package on Windows:** Requires Apple Bonjour SDK and `BONJOUR_SDK_HOME`. Breaks on most dev machines and CI. Use `multicast-dns` (pure JS) only.
- **PI auto-save button for settings:** Elgato guidelines explicitly say "don't add a Save button for action settings." Settings should auto-persist on change. For controller add, use an explicit "Add" button only (it's a write operation, not a settings change).
- **Bundling dependencies externally:** Stream Deck plugins are bundled via Rollup into a single `bin/plugin.js`. All `node_modules` dependencies must be bundled in (not `node_modules/` deployed). The scaffold handles this but verify `rollup.config.mjs` includes `multicast-dns`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Settings persistence across restarts | Custom JSON file write/read | `streamDeck.settings.setGlobalSettings()` | SDK handles path, encryption, race conditions, and restart recovery |
| mDNS UDP packet construction | Custom UDP multicast socket + DNS wire format | `multicast-dns` 7.2.5 | DNS wire format is complex; PTR/SRV/A record parsing has many edge cases |
| Fetch request cancellation on timeout | `setTimeout` + `controller.abort()` + `clearTimeout` | `AbortSignal.timeout(ms)` | Built into Node.js 20+; correct error type (`TimeoutError`) for free |
| PI communication layer | Custom `postMessage` bridge | `SDPIComponents.streamDeckClient` | Handles WebSocket registration, reconnection, and message routing |
| PI styling | Custom CSS | `sdpi-components.js` web components | Ensures exact visual match to native SD look; Elgato-maintained |

**Key insight:** The Stream Deck SDK provides persistence, communication, and UI primitives. The only custom logic needed is business logic (controller list operations, HTTP calls to WLED, mDNS result filtering).

---

## Common Pitfalls

### Pitfall 1: Plugin Freezes When Controller Is Offline

**What goes wrong:** `fetch()` without a timeout will hang indefinitely if the WLED device is powered off or unreachable. The plugin becomes unresponsive.

**Why it happens:** TCP connection attempts to offline hosts can take 20-75 seconds to time out at the OS level.

**How to avoid:** Every `fetch()` call to WLED **must** include `signal: AbortSignal.timeout(ms)`. Use 1500ms for state operations, 500ms for online-check pings. Catch `TimeoutError` and `TypeError` (network failure) and mark controller as offline.

**Warning signs:** Plugin stops responding to key presses; SD logs show long-running async operations.

### Pitfall 2: Global Settings Lost on Plugin Restart If Not Loaded First

**What goes wrong:** The `ControllerRegistry` singleton initializes with an empty state. If any code path reads `getAll()` before `await load()` completes, it returns an empty list — silently, with no error.

**Why it happens:** `getGlobalSettings()` is async; JavaScript constructors are synchronous.

**How to avoid:** In `plugin.ts`, `await ControllerRegistry.getInstance().load()` before `streamDeck.connect()`. Never expose `getAll()` without a guard that ensures `load()` has been called.

**Warning signs:** Controllers disappear after Stream Deck restart; adding a controller and restarting shows empty list.

### Pitfall 3: mDNS Scan Leaks UDP Socket

**What goes wrong:** If the `multicast-dns` instance is not destroyed after the scan timeout, it keeps a UDP socket open indefinitely, consuming resources and potentially conflicting with subsequent scans.

**Why it happens:** `multicast-dns` binds to UDP port 5353. Leaving it open means the next scan call gets a conflict error.

**How to avoid:** Always call `m.destroy()` in the timeout handler and in any error handler. Use a `try/finally` pattern or ensure the timer always calls `destroy()`.

**Warning signs:** Second scan fails with `EADDRINUSE`; memory/socket usage grows with each scan.

### Pitfall 4: `multicast-dns` A Records in Additional Section, Not Answers

**What goes wrong:** Code that only inspects `response.answers` misses IP addresses because WLED mDNS responses put A records in `response.additionals`, not `response.answers`. You get PTR records in answers but no IPs.

**Why it happens:** This is correct mDNS/DNS-SD behavior per RFC 6762 — PTR records identify services; A/SRV records go in the "additional" section of the response.

**How to avoid:** Always check `response.additionals` (and possibly `response.answers`) for A/AAAA records. Also check both `response.answers` and `response.additionals` for SRV records.

**Warning signs:** Scanner returns discovered device names but `ip` is `undefined`; every discovered device shows as unreachable.

### Pitfall 5: Double-Bundling Node Core Modules

**What goes wrong:** Rollup fails to bundle `multicast-dns` because it depends on Node.js core modules (`dgram`, `os`, `dns`) that Rollup doesn't know are externals.

**Why it happens:** Rollup treats everything as bundleable unless told otherwise. `multicast-dns` uses `dgram` for UDP.

**How to avoid:** In `rollup.config.mjs`, mark Node core modules as external:
```javascript
external: ['dgram', 'os', 'dns', 'net', 'crypto', 'path', 'fs']
```
Or use `@rollup/plugin-node-resolve` with `{ preferBuiltins: true }`.

**Warning signs:** Rollup build error mentioning `dgram` or `os` not found; `Cannot find module 'dgram'` at runtime.

### Pitfall 6: Port Parsing for `ip:port` Format

**What goes wrong:** Using the raw `ip` field (e.g., `"192.168.1.50:8080"`) directly in a URL constructor yields `http://192.168.1.50:8080:80` or fails validation.

**Why it happens:** The user can enter `host:port` format; the code must parse it correctly.

**How to avoid:** Parse with a helper:
```typescript
function parseHostPort(input: string, defaultPort = 80): { host: string; port: number } {
  const lastColon = input.lastIndexOf(':');
  // Check if colon is part of an IPv6 address or a port separator
  if (lastColon > -1 && !input.startsWith('[')) {
    const maybePart = input.slice(lastColon + 1);
    const maybePort = parseInt(maybePart, 10);
    if (!isNaN(maybePort)) {
      return { host: input.slice(0, lastColon), port: maybePort };
    }
  }
  return { host: input, port: defaultPort };
}
```

---

## Code Examples

Verified patterns from official sources:

### Global Settings Read/Write (plugin.ts startup)

```typescript
// Source: https://docs.elgato.com/streamdeck/sdk/guides/settings/
import streamDeck from '@elgato/streamdeck';

async function main() {
  // Load registry before connecting — ensures state is ready for any incoming events
  await ControllerRegistry.getInstance().load();

  // Subscribe to global settings changes (e.g., from PI or another plugin process)
  streamDeck.settings.onDidReceiveGlobalSettings((ev) => {
    ControllerRegistry.getInstance().applyState(ev.payload.settings);
  });

  await streamDeck.connect();
}

main().catch(console.error);
```

### WLED Info Fetch (WLEDClient — auto-name-on-add)

```typescript
// Source: https://kno.wled.ge/interfaces/json-api/ (info endpoint)
// info.name = "Friendly name of the light. Intended for display in lists and titles."
async function fetchDeviceName(ip: string): Promise<string | null> {
  try {
    const { host, port } = parseHostPort(ip);
    const response = await fetch(`http://${host}:${port}/json/info`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return null;
    const info = await response.json() as { name: string };
    return info.name ?? null;
  } catch {
    return null; // Offline or unreachable — caller shows offline indicator
  }
}
```

### Online/Offline Check (ControllerRegistry polling)

```typescript
// Ping-style check using /json/info — light-weight, no state mutation
async function isOnline(ip: string): Promise<boolean> {
  try {
    const { host, port } = parseHostPort(ip);
    await fetch(`http://${host}:${port}/json/info`, {
      signal: AbortSignal.timeout(500),
    });
    return true;
  } catch {
    return false;
  }
}
```

### mDNS Scan for WLED Devices

```typescript
// Source: https://github.com/mafintosh/multicast-dns API
// Service type confirmed: https://deepwiki.com/zackelia/wled-matter-bridge/5.1-mdns-discovery
import mdns from 'multicast-dns';

interface DiscoveredDevice {
  ip: string;
  name: string;
}

async function scanForWLED(timeoutMs = 4000): Promise<DiscoveredDevice[]> {
  return new Promise((resolve) => {
    const m = mdns();
    const discovered = new Map<string, DiscoveredDevice>(); // key: ip

    const done = () => {
      m.destroy();
      resolve(Array.from(discovered.values()));
    };

    const timer = setTimeout(done, timeoutMs);

    m.on('response', (response) => {
      // A records carry the IPv4 address — found in additionals per RFC 6762
      const aRecords = [
        ...response.answers.filter((r: any) => r.type === 'A'),
        ...response.additionals.filter((r: any) => r.type === 'A'),
      ];

      for (const record of aRecords) {
        const ip: string = record.data;
        if (!discovered.has(ip)) {
          // name comes from the record's name field (hostname); strip ".local"
          const name = (record.name as string).replace(/\.local\.?$/, '');
          discovered.set(ip, { ip, name });
        }
      }
    });

    m.on('error', () => {
      clearTimeout(timer);
      done();
    });

    m.query({ questions: [{ name: '_wled._tcp.local', type: 'PTR' }] });
  });
}
```

### manifest.json (minimal working example)

```json
{
  "UUID": "com.yourname.wled-stream-deck",
  "Name": "WLED",
  "Author": "Your Name",
  "Version": "0.1.0.0",
  "Description": "Control WLED LED strips from Stream Deck",
  "SDKVersion": 2,
  "Software": { "MinimumVersion": "6.6" },
  "OS": [
    { "Platform": "mac", "MinimumVersion": "10.15" },
    { "Platform": "windows", "MinimumVersion": "10" }
  ],
  "Nodejs": { "Version": "20", "Debug": "enabled" },
  "CodePath": "bin/plugin.js",
  "Icon": "imgs/plugin-icon",
  "Category": "WLED",
  "CategoryIcon": "imgs/category-icon",
  "PropertyInspectorPath": "ui/global-settings.html",
  "Actions": []
}
```

Note: `PropertyInspectorPath` at the root level (not inside an action) is the plugin-level global settings panel. It displays when the user opens plugin preferences.

### SDPI Components Global Settings Panel (HTML skeleton)

```html
<!-- Source: https://docs.elgato.com/streamdeck/sdk/guides/ui/ -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <script src="sdpi-components.js"></script>
</head>
<body>
  <!-- Hidden until DOM ready to prevent flash -->
  <div id="app" style="display: none;">
    <sdpi-item label="Scan">
      <sdpi-button id="btn-scan" value="Scan for devices"></sdpi-button>
    </sdpi-item>

    <div id="controller-list">
      <!-- Rendered dynamically from plugin message -->
    </div>

    <sdpi-item label="Add by IP">
      <sdpi-textfield id="input-ip" placeholder="192.168.1.50 or :8080"></sdpi-textfield>
    </sdpi-item>
    <sdpi-item label="Name (optional)">
      <sdpi-textfield id="input-name" placeholder="Desk Strip"></sdpi-textfield>
    </sdpi-item>
    <sdpi-item>
      <sdpi-button id="btn-add" value="Add Controller"></sdpi-button>
    </sdpi-item>
  </div>

  <script>
    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('app').style.display = '';

      const { streamDeckClient } = SDPIComponents;

      // Request current controller list from plugin
      streamDeckClient.sendToPlugin({ type: 'getControllers' });

      // Listen for responses from plugin backend
      streamDeckClient.onMessage((msg) => {
        if (msg.type === 'controllerList') renderControllers(msg.controllers);
        if (msg.type === 'scanResults') renderScanResults(msg.devices);
      });

      document.getElementById('btn-scan').addEventListener('click', () => {
        streamDeckClient.sendToPlugin({ type: 'scan' });
      });

      document.getElementById('btn-add').addEventListener('click', () => {
        streamDeckClient.sendToPlugin({
          type: 'addController',
          ip: document.getElementById('input-ip').value.trim(),
          name: document.getElementById('input-name').value.trim() || null,
        });
      });
    });
  </script>
</body>
</html>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `new AbortController()` + `setTimeout` | `AbortSignal.timeout(ms)` | Node.js 17.3+ (stable in Node.js 20) | Less boilerplate; correct `TimeoutError` type for catch logic |
| `node-fetch` package | Native `fetch()` | Node.js 18+ (stable) | No extra dependency; same API as browser fetch |
| `mdns` (native bindings) | `multicast-dns` (pure JS) | Community standard shift ~2020 | No Bonjour SDK required on Windows; works in all environments |
| SDKVersion 1 (JavaScript) | SDKVersion 2 (TypeScript, `@elgato/streamdeck`) | SD SDK v2 launch 2023 | Full TypeScript, decorator-based actions, built-in settings management |

**Deprecated/outdated:**
- `SDKVersion: 1` with raw WebSocket event handling: Replaced by `@elgato/streamdeck` SDK v2. Do not use.
- `node-fetch` package: Unnecessary in Node.js 20+ — native `fetch()` is stable and equivalent.
- `mdns` npm package: Requires Bonjour SDK on Windows. Do not use; use `multicast-dns` instead.

---

## Open Questions

1. **`streamDeck.ui.onDidReceiveMessage` exact API shape**
   - What we know: The SDK has a mechanism for the plugin to receive messages from the PI; docs reference `SendToPlugin` WebSocket event.
   - What's unclear: Whether it's `streamDeck.ui.onDidReceiveMessage` or `streamDeck.plugin.onSendToPlugin` in the v2 TypeScript API. The WebSocket reference says `SendToPlugin` event exists.
   - Recommendation: Check `@elgato/streamdeck` TypeScript exports on `streamDeck.ui` or `streamDeck.plugin` at implementation time. The functionality definitely exists — only the exact method name needs verification. Alternatively, the scaffold sample plugins likely demonstrate this pattern.

2. **Polling frequency for online/offline status**
   - What we know: Polling `/json/info` with a 500ms timeout works as an online check. This is left to Claude's discretion.
   - What's unclear: Optimal polling interval. Too frequent wastes ESP8266 TCP connections; too rare means stale indicators.
   - Recommendation: Poll every 30 seconds when the global settings panel is visible; poll every 60 seconds as a background heartbeat. Both are Claude's discretion per CONTEXT.md.

3. **mDNS on Windows — UDP multicast reliability**
   - What we know: `multicast-dns` is pure JS and does not require native bindings. `mdns` requires Bonjour on Windows.
   - What's unclear: Whether Windows Firewall blocks UDP multicast port 5353 in practice. Some reports suggest Windows Firewall may block multicast without a rule.
   - Recommendation: Implement mDNS scan with graceful error handling. If scan returns zero devices, show the "No devices found" message with a note to try manual IP entry. Do not treat this as a blocking issue — manual-add-by-IP is always available per the locked decisions.

---

## Sources

### Primary (HIGH confidence)
- `https://docs.elgato.com/streamdeck/sdk/introduction/getting-started/` — SDK scaffold, Node.js requirements, CLI commands
- `https://docs.elgato.com/streamdeck/sdk/guides/settings/` — `getGlobalSettings` / `setGlobalSettings` API with TypeScript examples
- `https://docs.elgato.com/streamdeck/sdk/references/manifest/` — Full manifest.json field reference including plugin-level `PropertyInspectorPath`
- `https://docs.elgato.com/streamdeck/sdk/references/websocket/ui/` — PI WebSocket events: `SendToPlugin`, `SetGlobalSettings`, `GetGlobalSettings`
- `https://docs.elgato.com/streamdeck/sdk/guides/ui/` — Property Inspector setup, sdpi-components, plugin vs action level
- `https://kno.wled.ge/interfaces/json-api/` — WLED JSON API endpoints, `info.name` field, state fields (`on`, `bri`, `seg`)
- `https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static` — `AbortSignal.timeout()` API

### Secondary (MEDIUM confidence)
- `https://github.com/mafintosh/multicast-dns` — multicast-dns API (README); version 7.2.5 confirmed via npm search result
- `https://deepwiki.com/zackelia/wled-matter-bridge/5.1-mdns-discovery` — WLED mDNS service type `_wled._tcp.local` confirmed; PTR/A record structure documented
- `https://docs.elgato.com/guidelines/streamdeck/plugins/ui/` — PI UI guidelines (no Save button, auto-save, hidden on load)

### Tertiary (LOW confidence — flag for validation)
- `@types/multicast-dns` version 7.2.4 — from npm search result, not directly verified on npmjs.com (403 blocked)
- Windows Firewall blocking UDP 5353 multicast — community reports only, not verified with official source

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All core libraries verified via official Elgato docs + npmjs search; Node.js 20 requirement confirmed
- Architecture: HIGH — Settings API, PI communication, and manifest structure verified via official docs
- mDNS discovery: MEDIUM — multicast-dns API confirmed via GitHub README; `_wled._tcp.local` service type confirmed via Matter bridge docs; Windows behavior LOW
- Pitfalls: HIGH (fetch timeout, settings ordering) / MEDIUM (mDNS UDP socket, rollup externals) — based on official docs + known Node.js patterns

**Research date:** 2026-02-19
**Valid until:** 2026-03-21 (30 days — stable SDKs; re-verify if Elgato releases SDK v3 or multicast-dns v8)
