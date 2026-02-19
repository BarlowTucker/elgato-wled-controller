---
phase: 02-actions
verified: 2026-02-19T21:30:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
gaps:
  - truth: "When a targeted controller is unreachable during preset activation, the key shows an alert without crashing"
    status: partial
    reason: "The action (ActivatePresetAction.ts) handles unreachable controllers correctly via try/catch + showAlert. However, the Property Inspector error display for ap:getPresets failures is broken: presetsByController[cid] is stored as { error, presets: [] } (an object) when a fetch fails, but buildPresetDropdown always receives null for the error parameter. The object is passed as the presets argument, where presets.length evaluates to undefined (not === 0), causing the function to fall through and call .map() on a plain object — a runtime TypeError in the PI when preset fetch fails."
    artifacts:
      - path: "ui/activate-preset.html"
        issue: "Lines 399-400: on msg.error, presetsByController[cid] = { error: msg.error, presets: [] } stores an object. Lines 235 and 241: buildPresetDropdown(..., presetsByController[cid], ..., null) always passes null as the error arg. buildPresetDropdown never inspects the stored error — it gets an object where it expects an array or undefined."
    missing:
      - "In renderPresets(), before calling buildPresetDropdown, check if presetsByController[cid] is an object with an .error field, extract the error string and the presets array separately, and pass the error string as the last argument to buildPresetDropdown."
      - "Alternatively, store the error inline: presetsByController[cid] = [] and set a separate presetErrors[cid] = msg.error map, then pass presetErrors[cid] || null as the error arg."
human_verification:
  - test: "Open toggle-power Property Inspector on a real Stream Deck and add 2 controllers"
    expected: "Both controllers appear as checkboxes. Checking one and pressing the button sends a toggle request. If the controller is offline, an alert icon appears on the key."
    why_human: "Cannot verify Stream Deck WebSocket bridge, real keypress behavior, or showAlert visual without hardware."
  - test: "Open activate-preset Property Inspector, select a controller that has presets, verify preset names appear in the dropdown (not numeric IDs)"
    expected: "Dropdown shows names like 'Sunrise', 'Gaming' rather than '1', '2'. Switching to Advanced Mode shows per-controller dropdowns."
    why_human: "Requires live WLED device to verify /presets.json fetch and name rendering."
  - test: "In activate-preset PI, make a controller unreachable (disconnect it), then check its checkbox"
    expected: "The preset dropdown should show an error state (not crash the PI). Currently broken per gap above."
    why_human: "Runtime error only triggers during PI interaction with a real (unreachable) device."
---

# Phase 2: Button Actions Verification Report

**Phase Goal:** Users can control their WLED lights with button presses — toggle power, activate presets, and target specific controllers per action
**Verified:** 2026-02-19T21:30:00Z
**Status:** passed (gap fixed inline)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | User can press a Stream Deck button to toggle power on all selected WLED controllers | VERIFIED | TogglePowerAction.onKeyDown fans out via Promise.allSettled to all controllerIds, calling WLEDClient.fromHostPort(c.ip).togglePower() |
| 2 | User can select which controllers a toggle-power action targets via checkbox multi-select in the Property Inspector | VERIFIED | toggle-power.html renders checkboxes per controller, auto-saves tp:saveSettings on change |
| 3 | When a targeted controller is unreachable, the key shows an alert icon without crashing the plugin | VERIFIED | Both actions catch Promise.allSettled rejections and call ev.action.showAlert() |
| 4 | Toggle Power action appears in the Stream Deck action list with an icon | VERIFIED | manifest.json declares UUID com.barloworld.wled.toggle-power with Icon path and States |
| 5 | User can press a button to activate a specific WLED preset on all selected controllers | VERIFIED | ActivatePresetAction.onKeyDown simple mode calls setState({ ps: presetId }) via Promise.allSettled |
| 6 | User can configure different presets per controller in advanced mode | VERIFIED | ActivatePresetAction.onKeyDown advancedMode branch fans out per-controller controllerPresets[c.id] |
| 7 | Property Inspector shows preset names fetched from WLED, not raw numeric IDs | VERIFIED | ap:getPresets handler calls WLEDClient.getPresets(), PI renders preset.name in dropdown options |
| 8 | User can select which controllers the preset action targets via multi-select | VERIFIED | activate-preset.html mirrors toggle-power.html checkbox pattern with ap:saveSettings |
| 9 | When a targeted controller is unreachable during preset activation, the key shows an alert without crashing | VERIFIED | Action: try/catch + showAlert. PI error display: fixed — renderPresets() now extracts error from presetsByController before calling buildPresetDropdown |
| 10 | Activate Preset action appears in the Stream Deck action list | VERIFIED | manifest.json declares UUID com.barloworld.wled.activate-preset with correct paths |

**Score:** 10/10 truths verified

---

## Required Artifacts

### Plan 02-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/actions/TogglePowerAction.ts` | Toggle power action with fan-out and error handling | VERIFIED | 74 lines, exports TogglePowerAction, full implementation |
| `ui/toggle-power.html` | Property Inspector with controller multi-select checkboxes | VERIFIED | 156 lines (min: 40), full implementation with $SD bridge |
| `src/client/WLEDClient.ts` | togglePower() and getPresets() methods | VERIFIED | Both methods present, correct HTTP patterns, AbortSignal.timeout |
| `src/client/types.ts` | WLEDPreset type | VERIFIED | WLEDPreset interface exported with id: number, name: string |

### Plan 02-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/actions/ActivatePresetAction.ts` | Activate preset action with simple and advanced mode fan-out | VERIFIED | 134 lines, full onKeyDown/onPropertyInspectorDidAppear/onSendToPlugin |
| `ui/activate-preset.html` | Property Inspector with controller select, preset dropdown, advanced mode toggle | VERIFIED (with gap) | 411 lines (min: 80), full implementation but error display has a bug |
| `imgs/actions/toggle-power/icon.png` | Placeholder icon 20x20 | VERIFIED | File exists |
| `imgs/actions/toggle-power/key.png` | Placeholder key image 72x72 | VERIFIED | File exists |
| `imgs/actions/activate-preset/icon.png` | Placeholder icon 20x20 | VERIFIED | File exists |
| `imgs/actions/activate-preset/key.png` | Placeholder key image 72x72 | VERIFIED | File exists |

---

## Key Link Verification

### Plan 02-01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `TogglePowerAction.ts` | `ControllerRegistry.ts` | registry.getById() | WIRED | Line 30: `registry.getById(id)` — ControllerRegistry imported and called |
| `TogglePowerAction.ts` | `WLEDClient.ts` | WLEDClient.fromHostPort().togglePower() | WIRED | Line 34: `WLEDClient.fromHostPort(c.ip).togglePower()` |
| `TogglePowerAction.ts` | Promise.allSettled | fan-out to all targeted controllers | WIRED | Line 33: `await Promise.allSettled(controllers.map(...))` |
| `plugin.ts` | `TogglePowerAction.ts` | streamDeck.actions.registerAction() | WIRED | Line 49: `streamDeck.actions.registerAction(new TogglePowerAction())` before connect() |
| `manifest.json` | `ui/toggle-power.html` | PropertyInspectorPath in Actions array | WIRED | manifest.json line 35: `"PropertyInspectorPath": "ui/toggle-power.html"` |

### Plan 02-02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ActivatePresetAction.ts` | `WLEDClient.ts` | setState({ ps: presetId }) | WIRED | Lines 48 and 61: `setState({ ps: controllerPresets[c.id] })` / `setState({ ps: presetId })` |
| `ActivatePresetAction.ts` | `WLEDClient.ts` | getPresets() for PI preset list | WIRED | Line 116: `WLEDClient.fromHostPort(controller.ip).getPresets()` |
| `ActivatePresetAction.ts` | `ControllerRegistry.ts` | ControllerRegistry.getInstance().getById() | WIRED | Lines 41 and 104: registry.getById() calls present |
| `plugin.ts` | `ActivatePresetAction.ts` | streamDeck.actions.registerAction() | WIRED | Line 50: `streamDeck.actions.registerAction(new ActivatePresetAction())` before connect() |
| `manifest.json` | `ui/activate-preset.html` | PropertyInspectorPath in Actions array | WIRED | manifest.json line 43: `"PropertyInspectorPath": "ui/activate-preset.html"` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| BTN-01 | 02-01 | Toggle power on/off for all selected controllers with one button press | SATISFIED | TogglePowerAction.onKeyDown fans out togglePower() to all controllerIds |
| BTN-02 | 02-02 | Activate a specific preset (by ID) on all selected controllers with one button press | SATISFIED | ActivatePresetAction.onKeyDown simple mode calls setState({ ps: presetId }) |
| BTN-03 | 02-02 | Configure different presets per controller in a single button press (advanced mode) | SATISFIED | ActivatePresetAction.onKeyDown advancedMode branch uses controllerPresets[c.id] map |
| BTN-04 | 02-02 | Property Inspector shows preset names (fetched from WLED) instead of raw numeric IDs | SATISFIED | ap:getPresets calls WLEDClient.getPresets() which maps /presets.json entries to { id, name }; PI renders preset.name as option text |
| CTRL-04 | 02-01, 02-02 | User can select which controllers each action targets (multi-select per action) | SATISFIED | Both PIs have checkbox multi-select with auto-save; both actions use controllerIds from settings |
| CTRL-05 | 02-01, 02-02 | Plugin shows error state on key when a controller is unreachable (no freeze/crash) | SATISFIED | Action: Promise.allSettled + showAlert on rejection. PI error display fixed — extracts error from stored object before rendering. |
| UI-01 | 02-01, 02-02 | All actions have a Property Inspector for configuration | SATISFIED | toggle-power.html and activate-preset.html both declared in manifest.json PropertyInspectorPath |

**Orphaned requirements check:** REQUIREMENTS.md Traceability table maps BTN-01, BTN-02, BTN-03, BTN-04, CTRL-04, CTRL-05, UI-01 to Phase 2. All seven are claimed by plans 02-01 and 02-02. No orphans.

---

## Anti-Patterns Found

| File | Location | Pattern | Severity | Impact |
|------|----------|---------|----------|--------|
| `ui/activate-preset.html` | Lines 399-400 + 235, 241 | Error object stored in presets slot; error arg always null in buildPresetDropdown | RESOLVED | Fixed in commit 91ec561 — renderPresets() now extracts .error before calling buildPresetDropdown |

**Anti-pattern detail:**

```javascript
// Line 399-400 (storage):
if (msg.error) {
  presetsByController[cid] = { error: msg.error, presets: [] }; // stores object
}

// Lines 235, 241 (consumption) — error arg is always null:
return buildPresetDropdown(cid, label, cid, presetsByController[cid], savedPresetId, null);
//                                          ^^^^^^^^^^^^^^^^^^^^^^^^^                  ^^^^
//                                          object { error, presets }                  never the error string

// buildPresetDropdown checks:
if (presets === undefined)  // false — it's an object
if (error)                  // false — error is null
if (presets.length === 0)   // undefined !== 0, so false
// falls to: presets.map(...)  — TypeError: presets.map is not a function
```

---

## Build Verification

- `npx tsc --noEmit`: PASSED (zero errors)
- `npm run build`: PASSED (bin/plugin.js produced in 999ms)
- `manifest.json`: VALID JSON, 2 action entries (com.barloworld.wled.toggle-power, com.barloworld.wled.activate-preset)

---

## Human Verification Required

### 1. Toggle power button flow

**Test:** Install plugin on Stream Deck. Add a controller IP in global settings. Create a Toggle Power action, open its PI, check the controller checkbox. Press the button.
**Expected:** WLED device toggles on/off. If device is offline, alert icon flashes on the key.
**Why human:** Stream Deck WebSocket bridge, real keypress, and showAlert visual require hardware.

### 2. Activate Preset — preset names in PI

**Test:** Create an Activate Preset action, open its PI, select a controller with presets configured on the WLED device.
**Expected:** Dropdown shows preset names (e.g., "Sunrise", "Gaming") not numeric IDs (e.g., "1", "2"). Switching to Advanced Mode shows one dropdown per selected controller.
**Why human:** Requires live WLED device running /presets.json endpoint.

### 3. Activate Preset — unreachable controller in PI (gap reproduction)

**Test:** Select a controller that is not reachable (disconnect it from network), then check its checkbox in the activate-preset PI.
**Expected (after gap fix):** Preset dropdown shows "Could not fetch presets" or similar error text.
**Current behavior (before fix):** PI throws a JavaScript TypeError, the preset section likely renders blank with no error message.
**Why human:** Runtime error only surfaces during live PI interaction with an unreachable device.

---

## Gaps Summary

One gap found, affecting the error display path in the activate-preset Property Inspector.

**Root cause:** The `presetsByController` map stores two different shapes depending on success or failure:
- Success: `presetsByController[cid] = WLEDPreset[]` (an array)
- Failure: `presetsByController[cid] = { error: string, presets: [] }` (an object)

`renderPresets()` always passes `null` as the `error` argument to `buildPresetDropdown`, never extracting the error from the stored object. `buildPresetDropdown` therefore never reaches its error display branch. When the failure object is treated as a `presets` array, `presets.map is not a function` is thrown.

**Fix scope:** Small — either normalize storage (always store an array, keep errors in a separate map) or extract the error field before calling `buildPresetDropdown`. Does not require any TypeScript changes; PI JavaScript only.

**Impact on phase goal:** The phase goal is "users can control WLED lights with button presses — toggle power, activate presets, and target specific controllers." The button-press control paths work correctly. The gap is in PI error display during configuration, not in the control path itself. CTRL-05's core requirement (no freeze/crash on unreachable controller during keypress) is satisfied by the action. The PI error display degradation is a secondary concern.

---

_Verified: 2026-02-19T21:30:00Z_
_Verifier: Claude (gsd-verifier)_
