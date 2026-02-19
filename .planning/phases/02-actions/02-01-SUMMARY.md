---
phase: 02-actions
plan: 01
subsystem: actions/toggle-power
tags: [action, toggle-power, wled-client, property-inspector, decorator]
dependency_graph:
  requires: [01-03]
  provides: [TogglePowerAction, WLEDClient.togglePower, WLEDClient.getPresets, WLEDPreset, toggle-power.html]
  affects: [src/plugin.ts, manifest.json, tsconfig.json]
tech_stack:
  added: []
  patterns:
    - SingletonAction subclass with @action decorator (TC39 stage-3, not legacy experimentalDecorators)
    - Per-action namespaced message types (tp:*) to avoid collision with global plugin.ts handler
    - Promise.allSettled fan-out for multi-controller error tolerance
    - Index signature on settings interface (Record<string, any> extends) to satisfy JsonObject constraint
    - getSettings() async call in onPropertyInspectorDidAppear (no payload on that event)
key_files:
  created:
    - src/actions/TogglePowerAction.ts
    - ui/toggle-power.html
    - imgs/actions/toggle-power/icon.png
    - imgs/actions/toggle-power/key.png
  modified:
    - src/client/WLEDClient.ts
    - src/client/types.ts
    - src/plugin.ts
    - manifest.json
    - tsconfig.json
decisions:
  - experimentalDecorators set to false — SDK @action uses TC39 stage-3 ClassDecoratorContext, incompatible with legacy TS experimental decorator mode
  - Per-action settings fetched via ev.action.getSettings() in onPropertyInspectorDidAppear — PropertyInspectorDidAppearEvent is ActionWithoutPayloadEvent (no payload property)
  - TogglePowerSettings extends Record<string, any> for JsonObject compatibility — same pattern as Phase 01-03 global settings as-any cast
metrics:
  duration: 3 min
  completed: 2026-02-19
  tasks_completed: 3
  files_changed: 9
---

# Phase 2 Plan 1: Toggle Power Action Summary

TogglePowerAction with fan-out to multiple controllers via Promise.allSettled, Property Inspector with checkbox multi-select, and WLEDClient extended with togglePower() and getPresets() methods.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Extend WLEDClient, add WLEDPreset type | daaa6b5 | src/client/WLEDClient.ts, src/client/types.ts |
| 2 | TogglePowerAction, plugin.ts, manifest, icons | 7b8c04c | src/actions/TogglePowerAction.ts, src/plugin.ts, manifest.json, tsconfig.json, imgs/ |
| 3 | toggle-power.html Property Inspector | 53059be | ui/toggle-power.html |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed legacy decorator mode incompatibility**
- **Found during:** Task 2
- **Issue:** `experimentalDecorators: true` in tsconfig.json puts TypeScript in legacy decorator mode (expects 2-arg `(target, key)` signature). The `@elgato/streamdeck` SDK `@action` decorator uses TC39 stage-3 decorators (expects `(target, context: ClassDecoratorContext)`). This caused TS1238 errors.
- **Fix:** Set `experimentalDecorators: false` in tsconfig.json.
- **Files modified:** tsconfig.json
- **Commit:** 7b8c04c

**2. [Rule 1 - Bug] PropertyInspectorDidAppearEvent has no payload**
- **Found during:** Task 2
- **Issue:** Plan specified `ev.payload.settings` in `onPropertyInspectorDidAppear`, but `PropertyInspectorDidAppearEvent` is `ActionWithoutPayloadEvent` — no payload property.
- **Fix:** Used `await ev.action.getSettings()` to fetch current settings asynchronously.
- **Files modified:** src/actions/TogglePowerAction.ts
- **Commit:** 7b8c04c

## Verification Results

All 7 plan criteria verified:

1. `npx tsc --noEmit` — zero errors
2. `npm run build` — produces `bin/plugin.js` without errors
3. `manifest.json` — valid JSON with 1 action (com.barloworld.wled.toggle-power)
4. Image paths — `imgs/actions/toggle-power/icon.png` and `key.png` exist
5. TogglePowerAction imported and registered in `plugin.ts` before `connect()`
6. `WLEDClient.togglePower()` and `getPresets()` methods exist
7. Global `onSendToPlugin` handler skips `tp:`-namespaced messages

## Key Patterns Established

- **Namespaced messages:** All per-action PI messages use `tp:` prefix (toggle-power), `ap:` for activate-preset, etc. Global plugin.ts handler guards with regex `/^[a-z]+:/` to skip them.
- **Action settings type:** Must extend `Record<string, any>` (or add index signature) to satisfy SDK's `JsonObject` constraint.
- **onPropertyInspectorDidAppear:** Use `ev.action.getSettings()` — no payload on this event type.
- **Fan-out pattern:** `Promise.allSettled()` for multi-controller operations — partial failures trigger `showAlert()` without crashing.

## Self-Check: PASSED

Files exist:
- FOUND: src/actions/TogglePowerAction.ts
- FOUND: ui/toggle-power.html
- FOUND: imgs/actions/toggle-power/icon.png
- FOUND: imgs/actions/toggle-power/key.png
- FOUND: src/client/WLEDClient.ts (modified)
- FOUND: src/client/types.ts (modified)

Commits exist:
- FOUND: daaa6b5
- FOUND: 7b8c04c
- FOUND: 53059be
