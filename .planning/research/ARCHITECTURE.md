# Architecture Patterns

**Domain:** Stream Deck Plugin (WLED LED Controller)
**Researched:** 2026-02-19
**Confidence:** MEDIUM — SDK v2 architecture from training data (Aug 2025 cutoff); WLED API is stable/well-documented; verify SDK specifics against official docs before Phase 1

---

## Recommended Architecture

The plugin is a Node.js process managed by the Stream Deck application. It has three distinct runtime contexts that communicate via defined channels:

```
┌─────────────────────────────────────────────────────────────┐
│                  Stream Deck Application                     │
│                  (Host process, Elgato)                      │
└──────────────────────────┬──────────────────────────────────┘
                           │ WebSocket (managed by SDK)
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Plugin Backend                            │
│                 (Node.js, long-running)                      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Action Layer │  │  Controller  │  │   WLED Client    │  │
│  │              │  │  Registry    │  │                  │  │
│  │ SetPreset    │  │              │  │  HTTP JSON API   │  │
│  │ SetPreset    │  │ Global state │  │  /json/state     │  │
│  │ Advanced     │  │ of known     │  │  GET + POST      │  │
│  │ ToggleOnOff  │  │ controllers  │  │                  │  │
│  │ Dial         │  │              │  │  mDNS Discovery  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │            │
│         └─────────────────┴────────────────────┘            │
│                       Internal calls                         │
└──────────────────────────────────────────────────────────────┘
                           │ sendToPropertyInspector /
                           │ onSendToPlugin (via SDK)
┌──────────────────────────▼──────────────────────────────────┐
│                  Property Inspector (PI)                     │
│               (Browser context, per-action UI)               │
│                                                              │
│  HTML + CSS + JS (no Node.js APIs available)                 │
│  Rendered in Stream Deck's embedded browser                  │
│  One PI instance per action type                             │
└─────────────────────────────────────────────────────────────┘
                           │ HTTP
┌──────────────────────────▼──────────────────────────────────┐
│                   WLED Controllers                           │
│                 (Local network devices)                      │
│                                                              │
│   WLED device (:80/json/state)   mDNS: _wled._tcp.local     │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Communicates With | Runtime Context |
|-----------|---------------|-------------------|-----------------|
| **Plugin Entry Point** (`plugin.ts`) | Bootstrap SDK, register actions, connect | Stream Deck app via SDK WebSocket | Node.js |
| **Action: SetPreset** | Handle keyDown, send preset to all selected controllers | ControllerRegistry, WLEDClient | Node.js |
| **Action: SetPresetAdvanced** | Handle keyDown, send per-controller preset assignments | ControllerRegistry, WLEDClient | Node.js |
| **Action: ToggleOnOff** | Handle keyDown, GET current state then toggle on/off | ControllerRegistry, WLEDClient | Node.js |
| **Action: Dial** | Handle dial rotation + touch, set brightness or speed, update display | ControllerRegistry, WLEDClient | Node.js |
| **ControllerRegistry** | Global shared state of all known WLED controllers; CRUD; serialization to globalSettings | All action classes, DiscoveryService | Node.js |
| **WLEDClient** | HTTP GET/POST to `/json/state`; normalize WLED API responses | All action classes | Node.js |
| **DiscoveryService** | mDNS scan for `_wled._tcp.local`; emit discovered controllers to registry | ControllerRegistry | Node.js |
| **Property Inspector (SetPreset)** | UI: select controllers, enter preset ID | Plugin backend via `sendToPropertyInspector` / `onSendToPlugin` | Browser |
| **Property Inspector (SetPresetAdvanced)** | UI: per-controller preset assignment table | Plugin backend via messaging | Browser |
| **Property Inspector (ToggleOnOff)** | UI: select controllers | Plugin backend via messaging | Browser |
| **Property Inspector (Dial)** | UI: select controllers, choose brightness vs speed | Plugin backend via messaging | Browser |
| **Manifest** (`manifest.json`) | Declares actions, icons, PI paths, SDK version, entry point | Stream Deck application at install time | Static JSON |

### Boundary Rules

- Property Inspectors have NO direct network access to WLED — they relay through the plugin backend.
- The plugin backend holds all runtime state — settings are persisted via SDK's `setSettings` / `setGlobalSettings`.
- Actions share the ControllerRegistry as a singleton — no duplicated controller lists per action.
- WLEDClient is stateless (no connection pooling needed for HTTP) — each call is fire-and-forget or await response.

---

## Data Flow

### Flow 1: User Presses a Preset Button

```
Stream Deck physical key press
  → Stream Deck app (host)
    → SDK WebSocket message: keyDown event
      → SetPreset action handler
        → reads action settings (preset ID, selected controller IDs)
        → calls ControllerRegistry.getControllers(selectedIds)
        → for each controller: WLEDClient.setPreset(host, presetId)
          → HTTP POST /json/state { "ps": presetId }
          → WLED device acknowledges
```

### Flow 2: User Turns a Dial

```
Stream Deck dial rotation event
  → Stream Deck app
    → SDK WebSocket message: dialRotate event (ticks: +1/-1)
      → Dial action handler
        → calculates new value (clamp 0–255)
        → updates in-memory currentValue
        → calls WLEDClient.setBrightness(host, value) for each controller
          → HTTP POST /json/state { "bri": value }
        → calls action.setFeedback({ value: newValue }) to update dial display
```

### Flow 3: Property Inspector Opens (Settings Load)

```
User opens action settings (PI opens)
  → SDK triggers onPropertyInspectorDidAppear
    → Plugin backend: sendToPropertyInspector({
        type: "settingsLoaded",
        controllers: ControllerRegistry.getAll(),
        settings: action.getSettings()
      })
      → PI renders controller list with checkboxes
      → User makes changes
        → PI: sendToPlugin({ type: "settingsChanged", ... })
          → Plugin backend: action.setSettings(newSettings)
```

### Flow 4: mDNS Discovery

```
Plugin startup (or manual trigger from PI)
  → DiscoveryService.scan()
    → mDNS query for _wled._tcp.local
    → For each discovered device:
        → WLEDClient.getInfo(host) to fetch device name
        → ControllerRegistry.addOrUpdate({ host, name, source: "mdns" })
          → SDK globalSettings updated
            → All open PIs notified via sendToPropertyInspector broadcast
```

### Flow 5: Controller Registry Persistence

```
ControllerRegistry mutated (add/remove/edit controller)
  → serialize to plain object
  → streamDeck.settings.setGlobalSettings({ controllers: [...] })
    → Stream Deck app persists to disk
      → On next plugin startup:
          → streamDeck.settings.getGlobalSettings()
            → ControllerRegistry.hydrate(saved controllers)
```

---

## File / Project Layout

```
com.yourname.wled-controller.sdPlugin/
├── manifest.json                  # Plugin declaration (actions, icons, entry point)
├── package.json
├── src/
│   ├── plugin.ts                  # Entry point: register actions, connect SDK
│   ├── actions/
│   │   ├── set-preset.ts          # SetPreset action class
│   │   ├── set-preset-advanced.ts # SetPresetAdvanced action class
│   │   ├── toggle-on-off.ts       # ToggleOnOff action class
│   │   └── dial.ts                # Dial action class (brightness + speed)
│   ├── controllers/
│   │   ├── registry.ts            # ControllerRegistry singleton
│   │   └── discovery.ts           # mDNS discovery service
│   ├── wled/
│   │   └── client.ts              # WLEDClient: HTTP GET/POST wrapper
│   └── shared/
│       └── types.ts               # Shared TypeScript interfaces
├── ui/                            # Property Inspector browser code
│   ├── set-preset.html
│   ├── set-preset-advanced.html
│   ├── toggle-on-off.html
│   ├── dial.html
│   └── components/                # Shared PI JS/CSS (vanilla or Svelte)
│       ├── controller-list.js
│       └── styles.css
├── imgs/
│   ├── actions/                   # Action icons (1x and 2x PNG)
│   │   ├── set-preset.png
│   │   ├── set-preset-advanced.png
│   │   ├── toggle-on-off.png
│   │   └── dial.png
│   └── plugin/                    # Plugin icon for marketplace
└── dist/                          # Compiled output (bundle.js)
```

**Note on directory naming:** The `.sdPlugin` folder name must match the plugin UUID in `manifest.json`. The UUID convention is `com.{author}.{plugin-name}`.

---

## Patterns to Follow

### Pattern 1: Action as Self-Contained Unit

**What:** Each action class handles its own lifecycle — `onKeyDown`, `onDialRotate`, `onPropertyInspectorAppear`, `onDidReceiveSettings`. The action class is the boundary.

**When:** Always. The SDK routes events to specific action instances by UUID and context.

**Example:**
```typescript
import streamDeck, { Action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";

@streamDeck.action({ UUID: "com.yourname.wled.set-preset" })
export class SetPreset extends SingletonAction {
  async onKeyDown(ev: KeyDownEvent<SetPresetSettings>): Promise<void> {
    const { presetId, controllerIds } = ev.payload.settings;
    const controllers = registry.getControllers(controllerIds);
    await Promise.all(controllers.map(c => wledClient.setPreset(c.host, presetId)));
  }
}
```

### Pattern 2: Global Settings for Shared State

**What:** Use `streamDeck.settings.setGlobalSettings` / `getGlobalSettings` for the controller registry. This persists across plugin restarts and is accessible from any action instance.

**When:** For any data shared across actions (controller list, discovery results).

**Example:**
```typescript
// Save
await streamDeck.settings.setGlobalSettings({ controllers: registry.serialize() });

// Restore on startup
streamDeck.settings.onDidReceiveGlobalSettings(({ payload }) => {
  registry.hydrate(payload.settings.controllers ?? []);
});
```

### Pattern 3: PI Messaging Protocol

**What:** Define a typed message protocol between PI and backend. Backend sends state down; PI sends user actions up.

**When:** Whenever the PI needs data from backend (controller list, current settings) or needs to trigger backend behavior (discovery scan).

**Example:**
```typescript
// Backend → PI
action.sendToPropertyInspector({
  type: "state",
  controllers: registry.getAll(),
  settings: ev.payload.settings
});

// PI → Backend
streamDeck.onSendToPlugin(({ payload }) => {
  if (payload.type === "triggerDiscovery") {
    discoveryService.scan();
  }
});
```

### Pattern 4: Optimistic Dial Updates

**What:** Update the dial display immediately on rotation without waiting for WLED HTTP response. Send HTTP fire-and-forget or with minimal error handling.

**When:** Dial rotation, where latency perception matters. For button actions, await is acceptable.

**Example:**
```typescript
async onDialRotate(ev: DialRotateEvent<DialSettings>): Promise<void> {
  this.currentValue = clamp(this.currentValue + ev.payload.ticks, 0, 255);
  // Update display immediately
  await ev.action.setFeedback({ value: this.currentValue });
  // Send to WLED without blocking
  Promise.all(controllers.map(c => wledClient.setBrightness(c.host, this.currentValue)))
    .catch(err => console.error("WLED update failed:", err));
}
```

### Pattern 5: Singleton Registry Initialized on Connect

**What:** Initialize ControllerRegistry and load globalSettings in the plugin entry point after SDK connects, before any action events can fire.

**When:** Plugin startup sequence.

**Example:**
```typescript
// plugin.ts
import streamDeck from "@elgato/streamdeck";
import { registry } from "./controllers/registry";

streamDeck.settings.onDidReceiveGlobalSettings(({ payload }) => {
  registry.hydrate(payload.settings.controllers ?? []);
});

streamDeck.connect(); // This triggers globalSettings fetch
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Per-Action Controller Storage

**What:** Each action stores its own copy of the full controller list in action settings.

**Why bad:** Controllers get out of sync across actions. Adding a controller in one action's PI doesn't appear in others. Produces stale hostname/IP references.

**Instead:** Store only controller IDs in action settings. The registry (globalSettings) is the source of truth for controller metadata.

### Anti-Pattern 2: Blocking Dial Display on HTTP Response

**What:** `await wledClient.setBrightness(...)` before calling `setFeedback(...)`.

**Why bad:** WLED HTTP responses take 20-200ms. Dial display lags visibly behind physical rotation, feels broken.

**Instead:** Update display immediately (pattern 4). Fire HTTP calls without blocking the display update.

### Anti-Pattern 3: Direct DOM/Network Access from Property Inspector

**What:** Property Inspector JavaScript making `fetch()` calls directly to WLED devices.

**Why bad:** CORS issues (WLED doesn't set CORS headers for browser requests). PI context is a browser, not Node.js. Creates parallel state management.

**Instead:** All network calls go through the plugin backend. PI sends a message, backend executes HTTP call, backend sends result back to PI.

### Anti-Pattern 4: One PI HTML File for All Actions

**What:** Reusing a single `property-inspector.html` file for all four action types.

**Why bad:** Conditional show/hide logic becomes unmanageable. Different actions have meaningfully different settings shapes.

**Instead:** One HTML file per action type. Shared UI components (controller checklist) are extracted into shared JS modules included in each.

### Anti-Pattern 5: Plugin UUID Mismatch

**What:** Action UUID in manifest doesn't exactly match UUID string in `@streamDeck.action({ UUID: "..." })` decorator.

**Why bad:** Action events are silently not dispatched. Extremely difficult to debug because no error is thrown.

**Instead:** Keep UUIDs in a constants file imported by both the manifest generation script and action files, or use a build-time check.

---

## Stream Deck SDK v2 Manifest Structure

```json
{
  "Name": "WLED Controller",
  "Author": "Your Name",
  "Description": "Control WLED LED controllers from Stream Deck",
  "Category": "Smart Home",
  "CategoryIcon": "imgs/plugin/category-icon",
  "CodePath": "dist/bundle.js",
  "Icon": "imgs/plugin/marketplace",
  "SDKVersion": 2,
  "Software": { "MinimumVersion": "6.4" },
  "OS": [
    { "Platform": "windows", "MinimumVersion": "10" },
    { "Platform": "mac", "MinimumVersion": "10.15" }
  ],
  "Actions": [
    {
      "Name": "Set Preset",
      "UUID": "com.yourname.wled.set-preset",
      "Icon": "imgs/actions/set-preset",
      "PropertyInspectorPath": "ui/set-preset.html",
      "Controllers": ["Keypad"],
      "States": [{ "Image": "imgs/actions/set-preset" }]
    },
    {
      "Name": "Set Preset Advanced",
      "UUID": "com.yourname.wled.set-preset-advanced",
      "Icon": "imgs/actions/set-preset-advanced",
      "PropertyInspectorPath": "ui/set-preset-advanced.html",
      "Controllers": ["Keypad"],
      "States": [{ "Image": "imgs/actions/set-preset-advanced" }]
    },
    {
      "Name": "Toggle On/Off",
      "UUID": "com.yourname.wled.toggle-on-off",
      "Icon": "imgs/actions/toggle-on-off",
      "PropertyInspectorPath": "ui/toggle-on-off.html",
      "Controllers": ["Keypad"],
      "States": [
        { "Image": "imgs/actions/toggle-off" },
        { "Image": "imgs/actions/toggle-on" }
      ]
    },
    {
      "Name": "Brightness / Speed",
      "UUID": "com.yourname.wled.dial",
      "Icon": "imgs/actions/dial",
      "PropertyInspectorPath": "ui/dial.html",
      "Controllers": ["Encoder"],
      "Encoder": {
        "layout": "$A1",
        "StackedLayout": "$A1",
        "Icon": "imgs/actions/dial"
      }
    }
  ]
}
```

**Key points (MEDIUM confidence — verify against current SDK docs):**
- `Controllers: ["Keypad"]` for buttons, `Controllers: ["Encoder"]` for dials.
- Dial actions use `"Encoder"` object to configure the touch display layout.
- `CodePath` points to the compiled JS bundle, not the TypeScript source.
- `SDKVersion: 2` is required for v2 features (encoder support, `@elgato/streamdeck` npm package).

---

## Scalability Considerations

This is a local network plugin with a bounded device count. Scalability concerns are network and UX, not compute.

| Concern | At 1-5 controllers | At 10-20 controllers | At 50+ controllers |
|---------|-------------------|---------------------|--------------------|
| HTTP fan-out latency | Parallel fetch, <200ms total | Parallel fetch, 200-500ms | Acceptable — local network, unlikely to have 50+ WLED devices |
| Registry size | Trivial in globalSettings | Trivial | JSON serialization still fast; not a concern |
| PI controller list | Simple checkbox list | Scrollable list with search | Not a real-world concern for this domain |
| mDNS scan time | Instant | 1-2 second scan window | Same — mDNS is a broadcast, response time is device-dependent |

**Conclusion:** No scalability architecture needed. Optimize for simplicity over scalability.

---

## Build Order Implications

Dependencies between components dictate phase order:

```
manifest.json + plugin.ts scaffold (nothing depends on this)
  │
  ▼
WLEDClient (no dependencies — pure HTTP)
  │
  ▼
ControllerRegistry (depends on: SDK globalSettings API, WLEDClient for info fetches)
  │
  ├──▶ DiscoveryService (depends on: ControllerRegistry)
  │
  └──▶ Actions (depend on: ControllerRegistry, WLEDClient)
        │
        ▼
      Property Inspectors (depend on: knowing what actions exist and their settings shape)
        │
        ▼
      Dial display feedback (depends on: working Dial action + SDK encoder API)
```

**Recommended build order:**
1. Project scaffold + manifest + SDK connection (validates SDK integration works)
2. WLEDClient (validates WLED API integration independently)
3. ControllerRegistry with manual-entry only (no mDNS yet)
4. First action: SetPreset with basic PI (proves the full round-trip)
5. Remaining button actions: SetPresetAdvanced, ToggleOnOff
6. Dial action with display feedback (most SDK-specific, leave for when fundamentals are proven)
7. mDNS discovery (additive feature, no existing code depends on it)
8. Polish: icons, error handling, PI UX improvements

---

## Sources

- Stream Deck SDK v2 (`@elgato/streamdeck`) — training data, Aug 2025 cutoff. Confidence: MEDIUM. Verify at https://docs.elgato.com/sdk/plugins/
- Stream Deck SDK v2 npm package — https://www.npmjs.com/package/@elgato/streamdeck
- Elgato SDK GitHub — https://github.com/elgatosf/streamdeck
- WLED HTTP JSON API — https://kno.wled.ge/interfaces/json-api/ (stable, well-documented)
- WLED mDNS — `_wled._tcp.local` service type, confirmed in WLED docs
- Stream Deck manifest format — https://docs.elgato.com/sdk/plugins/manifest

**Confidence notes:**
- WLEDClient API endpoints and JSON shapes: HIGH (WLED API is stable and well-documented)
- SDK v2 action class structure, `SingletonAction`, `@streamDeck.action` decorator: MEDIUM (from training; verify decorator syntax and exact event names against current SDK docs)
- Manifest field names (`Controllers`, `Encoder`, `SDKVersion`): MEDIUM (from training; verify against https://docs.elgato.com/sdk/plugins/manifest)
- mDNS service type `_wled._tcp.local`: MEDIUM (from WLED community docs; verify against WLED firmware source)
- Property Inspector messaging API (`sendToPropertyInspector`, `onSendToPlugin`): MEDIUM (stable pattern across SDK versions; verify method names)
