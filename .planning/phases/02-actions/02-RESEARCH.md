# Phase 2: Button Actions - Research

**Researched:** 2026-02-19
**Domain:** Stream Deck SDK v2 action implementation, WLED preset API, per-action Property Inspector, multi-target fan-out
**Confidence:** HIGH (SDK types verified from installed node_modules; WLED preset endpoint MEDIUM — endpoint confirmed but response schema verified via source code and community evidence only)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BTN-01 | User can toggle power on/off for all selected controllers with one button press | `WLEDClient.setState({ on: true/false })` or toggle via `WLEDState.on`; `SingletonAction.onKeyDown` fans out to all targeted controller IDs stored in action settings |
| BTN-02 | User can activate a specific preset (by ID) on all selected controllers with one button press | `WLEDClient.setState({ ps: presetId })`; preset IDs fetched from `GET /presets.json` and matched to names for display |
| BTN-03 | User can configure different presets per controller in a single button press (advanced mode) | Action settings store `{ controllerPresets: { [controllerId]: presetId } }`; fan-out maps each controller to its own preset before calling `setState` |
| BTN-04 | Property Inspector shows preset names (fetched from WLED) instead of raw numeric IDs | PI sends `{ type: 'getPresets', controllerId }` to plugin; plugin calls `WLEDClient.getPresets()` (new method) and returns name+id pairs via `streamDeck.ui.sendToPropertyInspector` |
| CTRL-04 | User can select which controllers each action targets (multi-select per action) | Action settings store `controllerIds: string[]`; PI renders checkbox list of all registered controllers from `ControllerRegistry.getAll()` |
| CTRL-05 | Plugin shows error state on key when a controller is unreachable (no freeze/crash) | `Promise.allSettled()` fan-out catches per-controller failures; `ev.action.showAlert()` on any failure; `AbortSignal.timeout(1500)` prevents freeze |
| UI-01 | All actions have a Property Inspector for configuration | Each action declares `"PropertyInspectorPath"` in manifest.json `Actions` array; per-action PI HTML communicates via `onSendToPlugin`/`streamDeck.ui.sendToPropertyInspector` |
</phase_requirements>

---

## Summary

Phase 2 adds two Stream Deck action classes — `TogglePowerAction` and `ActivatePresetAction` — that use the Phase 1 `ControllerRegistry` and `WLEDClient` to control WLED devices. Each action stores its targeted controller IDs and preset configuration in per-action settings (`ev.action.setSettings` / `ev.payload.settings`). When a key is pressed, the action fans out HTTP calls to all targeted controllers in parallel using `Promise.allSettled()`, and shows an alert on failure.

The WLED preset name display requirement (BTN-04) requires fetching `GET /presets.json` from each controller. This endpoint returns a JSON object keyed by numeric string IDs (e.g. `"1"`, `"2"`) with an `"n"` field for the preset name. The WLEDClient needs a new `getPresets()` method. The preset list is loaded when the PI opens (`onPropertyInspectorDidAppear`) and sent back to the PI via `streamDeck.ui.sendToPropertyInspector`.

Advanced mode (BTN-03) stores a per-controller preset mapping in action settings (`{ controllerPresets: { [controllerId]: presetId } }`). The PI needs a mode toggle to expose this mapping form. Both simple mode (one preset ID for all targets) and advanced mode (per-controller mapping) must be supported in a single action type for `ActivatePresetAction`.

**Primary recommendation:** Implement two actions (`TogglePowerAction`, `ActivatePresetAction`), store all per-action config in action settings, fan out with `Promise.allSettled()`, use `ev.action.showAlert()` for errors, and fetch preset lists from `GET /presets.json` (object keyed by numeric string, `"n"` = name field).

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@elgato/streamdeck` | `^2.0.1` (installed) | SDK — `SingletonAction`, `KeyDownEvent`, action settings, PI messaging | Already installed; provides the action lifecycle and all needed APIs |
| Node.js `fetch()` | Built-in (Node 20) | HTTP calls to WLED via `WLEDClient` | Already used in Phase 1; no new dependency needed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `crypto.randomUUID()` | Built-in (Node 20) | Not needed in Phase 2 — UUIDs generated in Phase 1 | N/A — just listed for completeness |

### No New Dependencies

Phase 2 requires zero new npm dependencies. All required infrastructure (`WLEDClient`, `ControllerRegistry`, SDK) was built in Phase 1. The only new files are action classes, PI HTML files, and `WLEDClient.getPresets()`.

**Installation:**
```bash
# No new packages needed
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── plugin.ts                          # MODIFIED: add registerAction() calls
├── actions/
│   ├── TogglePowerAction.ts           # NEW: toggle power on all targeted controllers
│   └── ActivatePresetAction.ts        # NEW: activate preset (simple + advanced mode)
├── client/
│   ├── WLEDClient.ts                  # MODIFIED: add getPresets() method
│   └── types.ts                       # MODIFIED: add WLEDPreset, WLEDPresetsResponse
├── registry/
│   ├── ControllerRegistry.ts          # UNCHANGED
│   └── types.ts                       # UNCHANGED
└── discovery/
    └── MDNSScanner.ts                 # UNCHANGED

ui/
├── global-settings.html               # UNCHANGED
├── toggle-power.html                  # NEW: action PI for toggle power
└── activate-preset.html               # NEW: action PI for activate preset

manifest.json                          # MODIFIED: add Actions array entries
```

### Pattern 1: SingletonAction — the Action Class Pattern

**What:** Extend `SingletonAction<TSettings>` where `TSettings` is the per-instance configuration type. Register with `streamDeck.actions.registerAction()` before `streamDeck.connect()`.

**When to use:** Every Stream Deck action type is its own `SingletonAction` subclass.

**Example (verified from installed SDK node_modules):**
```typescript
// Source: node_modules/@elgato/streamdeck/dist/plugin/actions/singleton-action.d.ts
import streamDeck, { action, SingletonAction } from '@elgato/streamdeck';
import type { KeyDownEvent, SendToPluginEvent, WillAppearEvent,
              PropertyInspectorDidAppearEvent } from '@elgato/streamdeck';

interface TogglePowerSettings {
  controllerIds: string[];  // IDs from ControllerRegistry
}

@action({ UUID: 'com.barloworld.wled.toggle-power' })
export class TogglePowerAction extends SingletonAction<TogglePowerSettings> {
  override async onKeyDown(ev: KeyDownEvent<TogglePowerSettings>): Promise<void> {
    const { controllerIds = [] } = ev.payload.settings;
    // fan-out logic here
  }

  override async onPropertyInspectorDidAppear(
    ev: PropertyInspectorDidAppearEvent<TogglePowerSettings>
  ): Promise<void> {
    // push current state to PI when it opens
  }

  override async onSendToPlugin(
    ev: SendToPluginEvent<{ type: string }, TogglePowerSettings>
  ): Promise<void> {
    // handle PI messages
  }
}
```

**plugin.ts registration (before connect):**
```typescript
// Source: https://docs.elgato.com/streamdeck/sdk/guides/actions/
streamDeck.actions.registerAction(new TogglePowerAction());
streamDeck.actions.registerAction(new ActivatePresetAction());
await streamDeck.connect();
```

### Pattern 2: Action Settings — Per-Instance Persistence

**What:** Per-action settings are read from `ev.payload.settings` in all event handlers (settings arrive with every event), and written with `ev.action.setSettings(newSettings)`.

**When to use:** Any configuration the user sets for a specific button placement (which controllers to target, which preset to activate).

**Key facts verified from installed SDK types:**
- `ev.payload.settings` is typed as `TSettings` on `KeyDownEvent<TSettings>`, `WillAppearEvent<TSettings>`, etc.
- `ev.action.setSettings(settings)` persists settings and notifies the PI
- Settings arrive with `onDidReceiveSettings` when they change
- Settings are NOT secure (exported with profiles) — do not store credentials

```typescript
// Source: node_modules/@elgato/streamdeck/dist/plugin/actions/action.d.ts
// Reading: ev.payload.settings is already typed, no async call needed
override async onKeyDown(ev: KeyDownEvent<MySettings>): Promise<void> {
  const { controllerIds = [] } = ev.payload.settings;
  // use controllerIds directly
}

// Writing: saves and notifies PI
await ev.action.setSettings({ controllerIds: ['id-1', 'id-2'] });
```

### Pattern 3: Fan-Out with Promise.allSettled()

**What:** Fan out WLED HTTP calls to multiple controllers in parallel. `Promise.allSettled()` ensures all calls complete regardless of individual failures, then check results for any rejections.

**When to use:** Every key press that targets multiple controllers. Never use `Promise.all()` — one offline controller would prevent all others from updating.

```typescript
// Source: MDN + prior Phase 1 pattern (sendControllerList uses same pattern)
override async onKeyDown(ev: KeyDownEvent<TogglePowerSettings>): Promise<void> {
  const { controllerIds = [] } = ev.payload.settings;
  const registry = ControllerRegistry.getInstance();

  const results = await Promise.allSettled(
    controllerIds
      .map(id => registry.getById(id))
      .filter((c): c is WLEDController => c !== undefined)
      .map(c => WLEDClient.fromHostPort(c.ip).setState({ on: true }, 1500))
  );

  const anyFailed = results.some(r => r.status === 'rejected');
  if (anyFailed) {
    await ev.action.showAlert();
  }
}
```

### Pattern 4: Power Toggle — Read-Then-Write

**What:** Toggle requires reading current `on` state, then inverting it. Use `GET /json/state` then `POST /json/state`.

**When to use:** Toggle power action. Caveat: if controllers are in different on/off states, we cannot know which "toggle" means — recommended behavior is treat any ON as "should turn off", if all OFF then turn on. Or alternatively just always write `{ on: "t" }` using WLED's toggle shorthand.

**WLED toggle shorthand (MEDIUM confidence — from JSON API docs):**
```json
POST /json/state: { "on": "t" }
```
The string `"t"` means toggle. This avoids a read-then-write round trip. However, our existing `WLEDState` interface types `on` as `boolean`. The `setState` method signature must be changed to accept `{ on: boolean | "t" }` for the toggle case, or a separate `togglePower()` method added to `WLEDClient`.

**Alternative:** Use `GET /json/state` to read `on`, then `POST { on: !currentState.on }`. This is two requests but keeps the type system clean.

**Recommendation:** Add `WLEDClient.togglePower()` that POSTs `{ on: "t" }` directly. Requires a `Partial<WLEDState> & { on?: boolean | "t" }` type for the state patch.

### Pattern 5: Per-Action Property Inspector Communication

**What:** The PI for an action communicates with the plugin via `onSendToPlugin` (on the `SingletonAction` subclass) and `streamDeck.ui.sendToPropertyInspector` (sends to the currently visible PI).

**Critical SDK finding (verified from installed node_modules):**
- `sendToPropertyInspector` is ONLY on `streamDeck.ui`, NOT on `ev.action` — it sends to whichever PI is currently open
- `ev.action` has: `setSettings()`, `getSettings()`, `showAlert()`, `isKey()`, `isDial()`
- `KeyAction` (what `ev.action` is when key is pressed) additionally has: `setImage()`, `setTitle()`, `setState()`, `showOk()`
- The `onSendToPlugin` override on a `SingletonAction` subclass receives messages from THAT action's PI specifically — correct for per-action PI

```typescript
// Plugin side: action-level PI message handling
override async onSendToPlugin(
  ev: SendToPluginEvent<{ type: string; [k: string]: unknown }, TogglePowerSettings>
): Promise<void> {
  const payload = ev.payload as { type: string; [k: string]: unknown };
  if (payload.type === 'getControllers') {
    // streamDeck.ui.sendToPropertyInspector sends to the currently visible PI
    await streamDeck.ui.sendToPropertyInspector({
      type: 'controllerList',
      controllers: ControllerRegistry.getInstance().getAll(),
    });
  }
}
```

```javascript
// PI HTML side (same pattern as global-settings.html)
const { streamDeckClient } = SDPIComponents;
streamDeckClient.sendToPlugin({ type: 'getControllers' });
streamDeckClient.onMessage((msg) => {
  if (msg.type === 'controllerList') renderCheckboxList(msg.controllers);
});
```

### Pattern 6: WLED Preset Fetching

**What:** `GET /presets.json` returns an object keyed by numeric string preset IDs. Each preset has an `"n"` field for the name.

**Response schema (MEDIUM confidence — verified from WLED source code `presets.cpp` + community evidence):**
```typescript
// Source: WLED source code analysis + github.com/wled/WLED/issues/3139
interface WLEDPresetEntry {
  n: string;         // preset name (e.g. "Rainbow")
  on?: boolean;
  bri?: number;
  transition?: number;
  seg?: unknown[];   // segment data — not needed for name display
  // ... other state fields
}

// The full response shape:
type WLEDPresetsResponse = {
  [presetId: string]: WLEDPresetEntry;  // keys are "1", "2", "3", etc.
};

// Simplified type for display use:
interface WLEDPreset {
  id: number;
  name: string;
}
```

**New WLEDClient method:**
```typescript
// Add to WLEDClient.ts
async getPresets(timeoutMs = 1500): Promise<WLEDPreset[]> {
  const response = await fetch(`${this.baseUrl}/presets.json`, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`WLED HTTP ${response.status}`);
  const raw = await response.json() as Record<string, { n?: string }>;
  return Object.entries(raw)
    .filter(([key]) => !isNaN(Number(key)))  // skip any non-numeric keys
    .map(([key, val]) => ({
      id: Number(key),
      name: val.n ?? `Preset ${key}`,         // fallback if no name set
    }))
    .sort((a, b) => a.id - b.id);
}
```

**Activate a preset:**
```typescript
// POST /json/state with { ps: presetId }
// Source: https://kno.wled.ge/interfaces/json-api/
await client.setState({ ps: presetId }, 1500);
```

Note: `ps` is already in the existing `WLEDState` interface as `ps: number`.

### Pattern 7: Manifest Action Declarations

**What:** Each action is declared in the manifest `Actions` array with a `UUID` matching the `@action` decorator, a `PropertyInspectorPath` pointing to its own HTML file, and a `States` array.

```json
{
  "Actions": [
    {
      "Name": "Toggle Power",
      "UUID": "com.barloworld.wled.toggle-power",
      "Icon": "imgs/actions/toggle-power/icon",
      "PropertyInspectorPath": "ui/toggle-power.html",
      "Controllers": ["Keypad"],
      "States": [
        { "Image": "imgs/actions/toggle-power/key" }
      ]
    },
    {
      "Name": "Activate Preset",
      "UUID": "com.barloworld.wled.activate-preset",
      "Icon": "imgs/actions/activate-preset/icon",
      "PropertyInspectorPath": "ui/activate-preset.html",
      "Controllers": ["Keypad"],
      "States": [
        { "Image": "imgs/actions/activate-preset/key" }
      ]
    }
  ]
}
```

**Important:** Images must exist at the declared paths or Stream Deck will refuse to show the action. At minimum, create 20×20 and 40×40 PNG placeholders.

### Anti-Patterns to Avoid

- **`Promise.all()` for fan-out:** One offline controller aborts the whole array. Always use `Promise.allSettled()`.
- **Reading state before setState for toggle:** Adds latency and race conditions. Use WLED's `"t"` toggle shorthand: `POST { "on": "t" }`.
- **Calling `streamDeck.ui.onSendToPlugin` in plugin.ts for action PI messages:** The global `streamDeck.ui.onSendToPlugin` handles ALL PI messages from any action. For per-action handling, override `onSendToPlugin` in the `SingletonAction` subclass — it fires only for that action's PI. The global handler in Phase 1 still handles the global settings PI messages.
- **Fetching presets on every key press:** Presets change rarely. Fetch when the PI opens (`onPropertyInspectorDidAppear`), not on every button press. Cache in PI memory for the session.
- **Storing controller IPs in action settings:** Store controller IDs (UUIDs) from `ControllerRegistry`, not IPs. If a user changes a controller's IP, action settings referencing that ID still work — `ControllerRegistry.getById()` returns the updated controller.
- **Setting key images without a fallback:** `setImage` is only effective when the user hasn't set a custom image. If the user customized the key image in Stream Deck, `setImage` has no effect. Use `setTitle` for text-based feedback instead.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-action settings persistence | Custom file storage or global settings keyed by action | `ev.action.setSettings()` / `ev.payload.settings` | SDK handles scoping, serialization, and profile export automatically |
| Fan-out error collection | Try/catch with accumulator | `Promise.allSettled()` | Built-in; correctly handles mixed success/failure; never short-circuits |
| Action error feedback on key | Custom image overlay or title | `ev.action.showAlert()` | SDK standard; shows yellow triangle; user-recognizable |
| Action success feedback on key | Custom image | `ev.action.showOk()` | SDK standard; shows green checkmark; correct UX pattern |
| Preset name → ID mapping | Custom ID parser | `GET /presets.json` + object entries | WLED stores names; just fetch and map |
| Request timeout | Custom setTimeout + AbortController | `AbortSignal.timeout(ms)` | Already used in Phase 1; correct `TimeoutError` type |

**Key insight:** The SDK provides all action UI primitives. Business logic (fan-out, WLED state changes) is the only custom code needed.

---

## Common Pitfalls

### Pitfall 1: `streamDeck.ui.sendToPropertyInspector` is Global, Not Per-Action

**What goes wrong:** Code sends a response to the PI from within `onSendToPlugin`, but the wrong PI receives it (or no PI receives it if the action's PI has been closed).

**Why it happens:** `streamDeck.ui.sendToPropertyInspector` always sends to the currently visible PI, regardless of which action triggered `onSendToPlugin`. If two action PIs are quickly switching, responses may go to the wrong one.

**How to avoid:** Only call `streamDeck.ui.sendToPropertyInspector` from within `onSendToPlugin` handlers (where the PI is guaranteed to be the caller), or from `onPropertyInspectorDidAppear`. Never call it from async callbacks that outlive the PI's visibility (e.g., don't call it 3 seconds later from a timer).

**Warning signs:** PI updates showing stale data from a different action instance.

### Pitfall 2: Action Settings Default to Empty Object on New Placement

**What goes wrong:** When a user drags a new action onto the deck, `ev.payload.settings` is an empty object `{}`. Code that does `ev.payload.settings.controllerIds.map(...)` throws "Cannot read properties of undefined".

**Why it happens:** Action settings only have values after the user has configured them via the PI.

**How to avoid:** Always destructure with defaults: `const { controllerIds = [] } = ev.payload.settings`. In `onKeyDown`, check `if (!controllerIds.length) { await ev.action.showAlert(); return; }` and show a helpful alert.

**Warning signs:** `TypeError` on first key press of a newly placed action.

### Pitfall 3: `/presets.json` May Return an Empty Object or Fail

**What goes wrong:** On a fresh WLED device with no presets saved, `GET /presets.json` returns `{}`. Code that iterates without handling this shows an empty dropdown. Worse, older WLED firmware versions may return a 404.

**Why it happens:** Presets are optional; not all users have them configured.

**How to avoid:** Handle empty object gracefully — show "No presets configured on this device" in the PI dropdown. Catch fetch errors and show the same message. Do not block action saving on preset load failure.

**Warning signs:** Empty dropdown when fetching presets; 404 errors in older firmware.

### Pitfall 4: `onSendToPlugin` in Plugin.ts Global Handler vs SingletonAction Override

**What goes wrong:** Both the global `streamDeck.ui.onSendToPlugin` in `plugin.ts` (for global settings PI) AND the per-action `onSendToPlugin` method on `SingletonAction` subclasses fire. If an action PI sends `{ type: 'addController' }`, the global handler will also receive it and potentially run.

**Why it happens:** The global `streamDeck.ui.onSendToPlugin` in `plugin.ts` receives ALL `sendToPlugin` messages from all PIs (both global settings and per-action). The `SingletonAction.onSendToPlugin` override receives only messages from that action's PI.

**How to avoid:** Use namespace-prefixed message types in per-action PIs (e.g. `{ type: 'tp:getControllers' }` for toggle-power, `{ type: 'ap:getPresets' }` for activate-preset). This prevents the global handler from accidentally matching action PI messages. Alternatively, add a type guard at the top of the global handler.

**Warning signs:** Global settings handler running when action PI is open and user interacts with it.

### Pitfall 5: Toggle vs Set — Mismatched On/Off State Across Multiple Controllers

**What goes wrong:** User presses toggle button; one controller is ON and one is OFF. Using `{ on: "t" }` sends toggle to both — one turns off, one turns on. Now they're still out of sync.

**Why it happens:** Toggle is per-device. If devices start at different states, toggle diverges them further.

**How to avoid:** Two options:
1. **Read majority state:** `GET /json/state` from all targets, take majority `on` value, then set all to the opposite. Costs extra round trip.
2. **Always use `"t"` shorthand:** Simpler, one fewer request. Accept that out-of-sync devices will drift. This is the simpler choice; document the behavior.

**Recommendation:** Use `POST { "on": "t" }` shorthand for simplicity (per-request decision documented). The goal is "toggle from the user's perspective" — if they pressed toggle, all devices flip regardless of current state.

**Warning signs:** After multiple presses, some controllers end up opposite state from others.

### Pitfall 6: `ev.action.showAlert()` is on `Action` Base Class — Always Available

**What goes wrong:** Code checks `if (ev.action.isKey())` before calling `showAlert()`, but `showAlert()` is actually on the `Action` base class (not `KeyAction`), so the check is unnecessary.

**Why it happens:** Confusion about where methods live in the class hierarchy.

**How to avoid:** Call `ev.action.showAlert()` directly — no `.isKey()` guard needed. Methods like `setImage()`, `setTitle()`, `showOk()` are on `KeyAction` and require `ev.action.isKey()` guard. `showAlert()` and `setSettings()` do not.

**Warning signs:** Unnecessary `isKey()` checks wrapping `showAlert()` calls.

---

## Code Examples

Verified patterns from official sources and installed SDK types:

### TogglePowerAction — Full Implementation Pattern

```typescript
// Source: node_modules/@elgato/streamdeck types + WLED JSON API docs
import streamDeck, { action, SingletonAction } from '@elgato/streamdeck';
import type { KeyDownEvent, SendToPluginEvent,
              PropertyInspectorDidAppearEvent } from '@elgato/streamdeck';
import { ControllerRegistry } from '../registry/ControllerRegistry';
import { WLEDClient } from '../client/WLEDClient';
import type { WLEDController } from '../registry/types';

interface TogglePowerSettings {
  controllerIds: string[];
}

@action({ UUID: 'com.barloworld.wled.toggle-power' })
export class TogglePowerAction extends SingletonAction<TogglePowerSettings> {

  override async onKeyDown(ev: KeyDownEvent<TogglePowerSettings>): Promise<void> {
    const { controllerIds = [] } = ev.payload.settings;

    if (!controllerIds.length) {
      await ev.action.showAlert();
      return;
    }

    const registry = ControllerRegistry.getInstance();
    const controllers = controllerIds
      .map(id => registry.getById(id))
      .filter((c): c is WLEDController => c !== undefined);

    // POST { "on": "t" } toggle shorthand — no read-then-write round trip
    const results = await Promise.allSettled(
      controllers.map(c => WLEDClient.fromHostPort(c.ip).togglePower())
    );

    const anyFailed = results.some(r => r.status === 'rejected');
    if (anyFailed) {
      await ev.action.showAlert();
    }
  }

  override async onPropertyInspectorDidAppear(
    ev: PropertyInspectorDidAppearEvent<TogglePowerSettings>
  ): Promise<void> {
    // Push current controller list and current settings to the PI
    await streamDeck.ui.sendToPropertyInspector({
      type: 'init',
      controllers: ControllerRegistry.getInstance().getAll(),
      settings: ev.action.isKey()
        ? await ev.action.getSettings()
        : { controllerIds: [] },
    });
  }

  override async onSendToPlugin(
    ev: SendToPluginEvent<{ type: string; [k: string]: unknown }, TogglePowerSettings>
  ): Promise<void> {
    const payload = ev.payload as Record<string, unknown>;
    if (payload.type === 'tp:saveSettings') {
      await ev.action.setSettings({
        controllerIds: payload.controllerIds as string[],
      });
    }
  }
}
```

### ActivatePresetAction — Settings Type

```typescript
// Action settings for ActivatePresetAction
interface ActivatePresetSettings {
  controllerIds: string[];       // all targeted controllers
  presetId: number | null;       // simple mode: same preset for all
  advancedMode: boolean;         // whether advanced mode is enabled
  controllerPresets: {           // advanced mode: per-controller preset ID
    [controllerId: string]: number;
  };
}
```

### WLEDClient.getPresets() — New Method

```typescript
// Add to src/client/types.ts
export interface WLEDPreset {
  id: number;
  name: string;
}

// Add to src/client/WLEDClient.ts
async getPresets(timeoutMs = 1500): Promise<WLEDPreset[]> {
  const response = await fetch(`${this.baseUrl}/presets.json`, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`WLED HTTP ${response.status}`);
  const raw = await response.json() as Record<string, { n?: string }>;
  return Object.entries(raw)
    .filter(([key]) => !isNaN(Number(key)) && Number(key) > 0)
    .map(([key, val]) => ({
      id: Number(key),
      name: val.n?.trim() || `Preset ${key}`,
    }))
    .sort((a, b) => a.id - b.id);
}
```

### WLEDClient.togglePower() — New Method

```typescript
// Add to src/client/WLEDClient.ts
// Source: https://kno.wled.ge/interfaces/json-api/ — "on":"t" = toggle
async togglePower(timeoutMs = 1500): Promise<void> {
  const response = await fetch(`${this.baseUrl}/json/state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ on: 't' }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`WLED HTTP ${response.status}`);
}
```

Note: The existing `setState(patch: Partial<WLEDState>)` types `on` as `boolean`. The toggle shorthand `"t"` is a WLED-specific string value. Adding a separate `togglePower()` method keeps the type-safe `setState` clean.

### Action Property Inspector — Controller Multi-Select Pattern

```html
<!-- ui/toggle-power.html (skeleton) -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <script src="sdpi-components.js"></script>
</head>
<body>
  <div id="app" style="display: none;">
    <sdpi-item label="Target Controllers">
      <div id="controller-list"><!-- rendered by JS --></div>
    </sdpi-item>
    <sdpi-item>
      <sdpi-button id="btn-save" value="Save"></sdpi-button>
    </sdpi-item>
  </div>

  <script>
    const { streamDeckClient } = SDPIComponents;
    let currentSettings = { controllerIds: [] };
    let controllers = [];

    // Request current state from plugin
    streamDeckClient.sendToPlugin({ type: 'tp:getControllers' });
    // Note: onPropertyInspectorDidAppear fires on plugin side and sends 'init'

    streamDeckClient.onMessage((msg) => {
      if (msg.type === 'init') {
        controllers = msg.controllers;
        currentSettings = msg.settings;
        renderControllerCheckboxes();
        document.getElementById('app').style.display = '';
      }
    });

    function renderControllerCheckboxes() {
      const list = document.getElementById('controller-list');
      list.innerHTML = controllers.map(c => `
        <label>
          <input type="checkbox"
            value="${c.id}"
            ${currentSettings.controllerIds.includes(c.id) ? 'checked' : ''}
          /> ${c.name} (${c.ip})
        </label>
      `).join('<br>');
    }

    document.getElementById('btn-save').addEventListener('click', () => {
      const checked = Array.from(
        document.querySelectorAll('#controller-list input:checked')
      ).map(el => el.value);
      streamDeckClient.sendToPlugin({
        type: 'tp:saveSettings',
        controllerIds: checked,
      });
    });
  </script>
</body>
</html>
```

### manifest.json — Adding Actions

```json
{
  "Actions": [
    {
      "Name": "Toggle Power",
      "UUID": "com.barloworld.wled.toggle-power",
      "Icon": "imgs/actions/toggle-power/icon",
      "PropertyInspectorPath": "ui/toggle-power.html",
      "Controllers": ["Keypad"],
      "States": [
        { "Image": "imgs/actions/toggle-power/key" }
      ]
    },
    {
      "Name": "Activate Preset",
      "UUID": "com.barloworld.wled.activate-preset",
      "Icon": "imgs/actions/activate-preset/icon",
      "PropertyInspectorPath": "ui/activate-preset.html",
      "Controllers": ["Keypad"],
      "States": [
        { "Image": "imgs/actions/activate-preset/key" }
      ]
    }
  ]
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SDKv1 raw WebSocket `sendToPropertyInspector` | `SingletonAction.onSendToPlugin` override + `streamDeck.ui.sendToPropertyInspector` | SDKv2 (2023) | Type-safe, scoped to action |
| `Promise.all()` for multi-device fan-out | `Promise.allSettled()` | ES2020 standard | Partial failures don't abort siblings |
| Reading current state then setting toggle | WLED `{ "on": "t" }` shorthand | WLED 0.11.0+ | One fewer round-trip |
| Action icons as static PNGs only | SVG strings via `setImage(svgString)` | SDKv2 | Dynamic icon generation in plugin code |

**Deprecated/outdated:**
- `streamDeck.actions.registerAction()` must be called before `streamDeck.connect()` — calling after connect is not supported.
- Using `streamDeck.ui.onSendToPlugin` in plugin.ts as the sole message handler: still works for global settings PI, but per-action PIs should use `SingletonAction.onSendToPlugin` override to keep concerns separated.

---

## Open Questions

1. **`/presets.json` — exact endpoint confirmed but schema not validated against real device**
   - What we know: `GET /presets.json` is the documented endpoint; object keyed by numeric string IDs; `"n"` field for name; confirmed via WLED source code and GitHub issue discussion
   - What's unclear: Whether older WLED firmware (pre-0.11.0) returns 404 or different format; whether ID `0` is a special case (system preset)
   - Recommendation: Add graceful handling for empty object `{}` and HTTP errors. Treat ID `0` as special (skip it or label as "Default"). Verify against a real device before finalizing the `getPresets()` method.

2. **Image assets — placeholder vs final icons**
   - What we know: manifest.json `States[].Image` and `Icon` paths must exist on disk. Stream Deck will not show the action if images are missing.
   - What's unclear: Whether placeholder 1×1 transparent PNGs suffice for development, or whether the SDK validates minimum dimensions.
   - Recommendation: Create minimal 20×20 and 72×72 PNG placeholders in `imgs/actions/toggle-power/` and `imgs/actions/activate-preset/` to unblock development. Final assets can be polished later.

3. **Advanced mode PI complexity (BTN-03)**
   - What we know: BTN-03 requires per-controller preset selection; this means the PI must show a separate preset dropdown per targeted controller.
   - What's unclear: Whether preset lists for each controller should be fetched in parallel on PI open, or lazily on dropdown open. Parallel fetch is simpler but multiplies requests; lazy is more complex JS.
   - Recommendation: Fetch all presets for all targeted controllers in parallel on `onPropertyInspectorDidAppear`. Show a loading state per controller while fetching. Cache results in PI memory — no need to re-fetch unless controller list changes.

4. **Interaction between global `streamDeck.ui.onSendToPlugin` and per-action `onSendToPlugin`**
   - What we know: Both fire. The `SingletonAction.onSendToPlugin` override fires only for that action's PI messages. The global `streamDeck.ui.onSendToPlugin` in plugin.ts fires for ALL PI messages (global settings AND action PIs).
   - What's unclear: Whether the global handler in plugin.ts should be modified to filter out action PI messages (to avoid accidental processing), or whether namespace-prefixing message types is sufficient.
   - Recommendation: Namespace all action PI message types (e.g. `"tp:"`, `"ap:"` prefixes). Update global handler in plugin.ts to reject unknown message types silently rather than processing them.

---

## Sources

### Primary (HIGH confidence)
- `node_modules/@elgato/streamdeck/dist/plugin/actions/action.d.ts` — `Action` class: `setSettings`, `getSettings`, `showAlert`
- `node_modules/@elgato/streamdeck/dist/plugin/actions/key.d.ts` — `KeyAction`: `setImage`, `setTitle`, `setState`, `showOk`
- `node_modules/@elgato/streamdeck/dist/plugin/actions/singleton-action.d.ts` — `SingletonAction` event method signatures
- `node_modules/@elgato/streamdeck/dist/plugin/ui.d.ts` — `streamDeck.ui.sendToPropertyInspector` signature; confirmed it is on `ui` not on `action`
- `node_modules/@elgato/streamdeck/dist/plugin/events/ui-message-event.d.ts` — `SendToPluginEvent<TPayload, TSettings>` shape
- `https://docs.elgato.com/streamdeck/sdk/guides/actions/` — Action class, @action decorator, registerAction, manifest structure
- `https://docs.elgato.com/streamdeck/sdk/guides/settings/` — `ev.payload.settings` usage, `setSettings` usage
- `https://docs.elgato.com/streamdeck/sdk/guides/keys/` — `showAlert`, `showOk`, `setImage`

### Secondary (MEDIUM confidence)
- `https://kno.wled.ge/interfaces/json-api/` — `ps` field activates preset, `{ "on": "t" }` toggle shorthand
- `https://kno.wled.ge/features/presets/` — `/presets.json` endpoint documented as canonical way to get preset list
- `https://github.com/wled/WLED/blob/main/wled00/presets.cpp` — source code analysis: `"n"` field for preset name, numeric-string keyed object structure
- `https://github.com/wled/WLED/issues/3139` — confirms numeric string keys `"1"`, `"2"`, etc. and `"n"` field in real presets.json

### Tertiary (LOW confidence — flag for validation)
- `{ "on": "t" }` toggle shorthand — mentioned in JSON API docs but not independently verified against a real device
- `/presets.json` returning empty object `{}` on fresh device — inferred behavior, not explicitly documented
- ID `0` being a special/system preset — implied from filtering `Number(key) > 0` in community examples; not confirmed in official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All SDK types verified from installed node_modules; no new dependencies required
- Architecture: HIGH — Action lifecycle patterns verified from installed SDK; fan-out pattern established in Phase 1
- WLED preset API: MEDIUM — `/presets.json` endpoint confirmed; schema `"n"` field confirmed from source code; not validated against a real device; flag for early implementation testing
- Pitfalls: HIGH — SDK-level pitfalls verified from type definitions; WLED-level pitfalls are MEDIUM (inference from API patterns)

**Research date:** 2026-02-19
**Valid until:** 2026-03-21 (30 days — SDK is stable at v2.0.1; WLED API is stable since 0.11.0)
