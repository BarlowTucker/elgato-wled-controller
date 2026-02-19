---
phase: 02-actions
plan: 02
subsystem: ui
tags: [streamdeck, wled, preset, property-inspector, typescript]

# Dependency graph
requires:
  - phase: 02-actions
    provides: TogglePowerAction, WLEDClient.togglePower/getPresets, toggle-power PI, ap:/tp: namespace pattern
  - phase: 01-foundation
    provides: ControllerRegistry singleton, WLEDClient, registry types
provides:
  - ActivatePresetAction with simple and advanced per-controller preset mode
  - activate-preset.html Property Inspector with preset name dropdowns
  - manifest.json second action entry for com.barloworld.wled.activate-preset
affects: [03-dials, 04-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - ap: namespace prefix for all ActivatePresetAction PI messages (mirrors tp: from 02-01)
    - Promise.allSettled fan-out with showAlert on any rejection
    - Per-controller presets map (controllerPresets: { [id]: number }) for advanced mode
    - PI fetches preset names via ap:getPresets before showing dropdown

key-files:
  created:
    - src/actions/ActivatePresetAction.ts
    - ui/activate-preset.html
    - imgs/actions/activate-preset/icon.png
    - imgs/actions/activate-preset/key.png
  modified:
    - src/plugin.ts
    - manifest.json

key-decisions:
  - "ActivatePresetSettings extends Record<string, any> for JsonObject compatibility — same pattern as TogglePowerSettings"
  - "PI stores presetsByController as a local map; re-renders dropdowns on every presetList message"
  - "Advanced mode skips controllers with no preset mapped (does not call setState for unmapped controllers)"
  - "Simple mode shows presets from first selected controller only — simplifies UX for most common case"

patterns-established:
  - "Action PI message namespace: ap: for ActivatePresetAction (consistent with tp: for TogglePowerAction)"
  - "PI requests presets only for checked controllers; fetches lazily when checkbox is checked"

requirements-completed: [BTN-02, BTN-03, BTN-04, CTRL-04, CTRL-05, UI-01]

# Metrics
duration: 5min
completed: 2026-02-19
---

# Phase 2 Plan 02: Activate Preset Action Summary

**ActivatePresetAction with simple/advanced preset fan-out modes and PI showing WLED preset names fetched dynamically per controller**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-19T20:56:12Z
- **Completed:** 2026-02-19T21:01:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- ActivatePresetAction compiles with zero TypeScript errors, registered in plugin.ts
- Simple mode applies one preset ID to all selected controllers via `setState({ ps })`
- Advanced mode fans out per-controller preset mapping, skipping unmapped controllers
- Property Inspector fetches preset names dynamically via `ap:getPresets` and displays names (not IDs) in dropdowns
- PI supports mode toggle between simple (one dropdown) and advanced (per-controller dropdowns)
- Graceful error states: no controllers, no presets, fetch failure, no preset selected

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ActivatePresetAction class with simple and advanced mode** - `ae269af` (feat)
2. **Task 2: Create activate-preset Property Inspector HTML with preset dropdowns and advanced mode** - `23543e3` (feat)

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `src/actions/ActivatePresetAction.ts` - Action class with onKeyDown fan-out, onSendToPlugin handling ap:saveSettings/ap:getControllers/ap:getPresets
- `ui/activate-preset.html` - PI with controller multi-select, mode toggle, preset dropdowns populated from WLED
- `src/plugin.ts` - Added ActivatePresetAction import and registerAction call
- `manifest.json` - Added second action entry for com.barloworld.wled.activate-preset
- `imgs/actions/activate-preset/icon.png` - Placeholder icon (20x20)
- `imgs/actions/activate-preset/key.png` - Placeholder key image (72x72)

## Decisions Made
- ActivatePresetSettings extends `Record<string, any>` for JsonObject compatibility — consistent with TogglePowerSettings established in 02-01
- PI stores preset lists in a `presetsByController` map keyed by controller ID — allows re-rendering without re-fetching on mode switch
- Advanced mode silently skips controllers with no preset mapped rather than showing an alert — gives user flexibility to leave some controllers unconfigured
- Simple mode sources preset dropdown from the first selected controller — most users will have same presets across devices; selecting from the first is predictable

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both button actions (toggle power, activate preset) are complete and registered
- Phase 2 may continue with dial/encoder actions (Phase 3 track) or Phase 2 can be considered done
- Blocker still open: verify WLED /presets.json response schema against real device before shipping

---
*Phase: 02-actions*
*Completed: 2026-02-19*
