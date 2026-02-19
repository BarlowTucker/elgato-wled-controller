---
phase: 01-foundation
plan: 03
subsystem: registry
tags: [wled, controller-registry, mdns, discovery, global-settings, property-inspector, typescript]

# Dependency graph
requires:
  - phase: 01-01
    provides: TypeScript project scaffold, rollup build pipeline, tsconfig
  - phase: 01-02
    provides: WLEDClient HTTP wrapper with getInfo/isOnline methods
provides:
  - ControllerRegistry singleton with CRUD and global settings persistence
  - WLEDController and RegistryState TypeScript interfaces
  - MDNSScanner for _wled._tcp.local PTR queries
  - Global settings Property Inspector UI (scan/list/add)
  - Plugin entry point with full PI message wiring
affects: [02-actions, 03-dial, 04-publishing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - ControllerRegistry singleton pattern with lazy initialization
    - Promise.allSettled for parallel online status checks
    - mDNS scan with explicit m.destroy() in both timeout and error paths
    - as-any casts for @elgato/utils JsonObject constraint on setGlobalSettings/sendToPropertyInspector

key-files:
  created:
    - src/registry/types.ts
    - src/registry/ControllerRegistry.ts
    - src/discovery/MDNSScanner.ts
    - ui/global-settings.html
  modified:
    - src/plugin.ts
    - manifest.json

key-decisions:
  - "as-any cast on streamDeck.settings.setGlobalSettings/getGlobalSettings and sendToPropertyInspector — @elgato/utils JsonObject requires [key: string]: JsonValue index signature, but our domain interfaces use concrete types; casting is the right tradeoff vs polluting domain models with index signatures"
  - "MDNSScanner destructs multicast-dns socket in both timeout and error handlers — prevents UDP socket leaks (RESEARCH.md pitfall 3)"
  - "ControllerRegistry.add() saves immediately without reachability validation — name fetch is best-effort; if offline, falls back to nameOverride or ip (per locked plan decision)"
  - "Background polling not implemented — PI requests status on open via getControllers message; avoids complexity and resource usage when panel is closed"

patterns-established:
  - "ControllerRegistry.getInstance() is the entry point for all action code to resolve controllers"
  - "registry.load() must be called before streamDeck.connect() in plugin.ts"
  - "All sendToPropertyInspector calls use as-any cast to work around JsonValue constraint"

requirements-completed: [CTRL-01, CTRL-02, CTRL-03, CTRL-06]

# Metrics
duration: 4min
completed: 2026-02-19
---

# Phase 1 Plan 03: ControllerRegistry and Global Settings UI Summary

**ControllerRegistry singleton with CRUD/persistence, MDNSScanner for device discovery, and three-section global settings Property Inspector (scan/list/add) wired end-to-end to the plugin backend**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-19T19:51:26Z
- **Completed:** 2026-02-19T19:55:05Z
- **Tasks:** 2 (Task 1: registry + scanner; Task 2: UI + plugin wiring)
- **Files modified:** 6

## Accomplishments

- `src/registry/types.ts` — `WLEDController` and `RegistryState` interfaces defining the stable controller model (UUID, ip, name, addedAt)
- `src/registry/ControllerRegistry.ts` — Singleton with `load`, `add`, `remove`, `getAll`, `getById`, `has`. `add()` auto-fetches WLED device name via `WLEDClient.getInfo()` (best-effort, falls back to nameOverride or IP). Persists via `streamDeck.settings.setGlobalSettings`.
- `src/discovery/MDNSScanner.ts` — Queries `_wled._tcp.local` PTR records, collects A record IPs from both answers and additionals (RFC 6762 compliant). `m.destroy()` called in both timeout and error handlers to prevent UDP socket leaks.
- `ui/global-settings.html` — Three-section layout: scan (top) with checkbox batch-add, controller list (middle) with online/offline indicators and per-row remove, manual add form (bottom). Already-registered devices greyed out in scan results. "No WLED devices found" message when scan is empty.
- `src/plugin.ts` — Loads ControllerRegistry before `streamDeck.connect()`. Handles all 5 PI message types: `getControllers`, `addController`, `removeController`, `scan`, `addDiscovered`. Parallel online checks via `Promise.allSettled`.
- `manifest.json` — `PropertyInspectorPath` set to `ui/global-settings.html`.

## Task Commits

Each task committed atomically:

1. **ControllerRegistry, MDNSScanner, types** - `c8e1c83` (feat)
2. **Global settings PI, plugin wiring, manifest** - `894696e` (feat)

## Files Created/Modified

- `src/registry/types.ts` — WLEDController and RegistryState interfaces
- `src/registry/ControllerRegistry.ts` — Singleton registry with CRUD and persistence
- `src/discovery/MDNSScanner.ts` — mDNS scanner for WLED device discovery
- `ui/global-settings.html` — Global settings Property Inspector (scan/list/add)
- `src/plugin.ts` — Plugin entry point updated with registry load and PI message handling
- `manifest.json` — PropertyInspectorPath added

## Decisions Made

- Used `as any` casts on `setGlobalSettings`/`getGlobalSettings` and `sendToPropertyInspector` — the `@elgato/utils` `JsonObject` type requires `[key: string]: JsonValue` index signatures, which would pollute domain interfaces. Casting is the cleanest tradeoff.
- Background polling not implemented — the PI polls on open via `getControllers`; polling when panel may be closed adds unnecessary complexity and network load.
- `ControllerRegistry.add()` saves immediately per plan's locked decision — no pre-validation gate on reachability.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript JsonObject constraint on streamDeck settings API**
- **Found during:** Task 1 build
- **Issue:** `streamDeck.settings.getGlobalSettings<RegistryState>()` and `setGlobalSettings(this.state)` emitted TS errors: `RegistryState` does not satisfy `JsonObject` constraint (missing `[key: string]: JsonValue` index signature). Same issue on `streamDeck.ui.sendToPropertyInspector()` in plugin.ts.
- **Fix:** Applied `as any` cast on the three call sites (`getGlobalSettings`, `setGlobalSettings`, `sendToPropertyInspector`). Domain interfaces left clean — no index signatures added to `WLEDController` or `RegistryState`.
- **Files modified:** `src/registry/ControllerRegistry.ts`, `src/plugin.ts`
- **Verification:** `npm run build` exits 0 with no warnings
- **Committed in:** `c8e1c83` (ControllerRegistry), `894696e` (plugin.ts)

**2. [Rule 1 - Bug] Fixed MDNSScanner record.data TypeScript error**
- **Found during:** Task 1 build
- **Issue:** `record.data` on filtered `Answer` type caused TS2339 — `data` property does not exist on `OptAnswer` variant of the union.
- **Fix:** Cast record to `any` before accessing `.data` — `(record as any).data`. The filter already ensures `type === 'A'` so the cast is safe.
- **Files modified:** `src/discovery/MDNSScanner.ts`
- **Committed in:** `c8e1c83`

---

**Total deviations:** 2 auto-fixed (Rule 1 - TypeScript type constraint bugs)
**Impact on plan:** No scope change, no API changes. Build is clean.

## Issues Encountered

None — build clean after type fixes. All 5 PI message types implemented, all verification criteria met.

## User Setup Required

None - no external service configuration required for this plan.

## Next Phase Readiness

- `ControllerRegistry.getInstance()` is ready for all Phase 2 actions to resolve controllers
- Global settings panel is fully wired — users can scan, add, remove, and see online/offline status
- `WLEDClient.fromHostPort()` + `ControllerRegistry` provide the complete controller resolution chain
- Phase 2 (action implementations) can now reference controllers by UUID from the registry

---
*Phase: 01-foundation*
*Completed: 2026-02-19*

## Self-Check: PASSED

- src/registry/types.ts: FOUND
- src/registry/ControllerRegistry.ts: FOUND
- src/discovery/MDNSScanner.ts: FOUND
- ui/global-settings.html: FOUND
- src/plugin.ts: FOUND (modified)
- manifest.json: FOUND (modified)
- .planning/phases/01-foundation/01-03-SUMMARY.md: FOUND
- Commit c8e1c83 (Task 1 - registry + scanner): FOUND
- Commit 894696e (Task 2 - PI + wiring + manifest): FOUND
