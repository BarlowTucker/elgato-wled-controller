# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-19)

**Core value:** One button press controls multiple WLED lights instantly — no app switching, no phone, just tactile control.
**Current focus:** Phase 2 — Actions (Phase 1 complete)

## Current Position

Phase: 2 of 4 (Actions)
Plan: 2 of N in current phase
Status: In progress — Plan 02-02 complete (ActivatePresetAction, activate-preset PI with preset name dropdowns)
Last activity: 2026-02-19 — Plan 02-02 complete (ActivatePresetAction simple/advanced mode, preset name dropdowns from WLED)

Progress: [█████░░░░░] 42% (5 of 12 total plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: 2.2 min
- Total execution time: 15 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3 | 7 min | 2.3 min |
| 02-actions | 2 | 8 min | 4 min |

**Recent Trend:**
- Last 5 plans: 01-01 (2 min), 01-02 (1 min), 01-03 (4 min), 02-01 (3 min), 02-02 (5 min)
- Trend: Fast

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Research]: Use HTTP JSON API over WebSocket — simpler, sufficient latency for button/dial events
- [Research]: Global ControllerRegistry singleton in Phase 1 — per-action storage causes architectural rewrite; must be established before any action code
- [Research]: AbortController 500-1500ms timeout on all WLED requests — prevents plugin freeze when controller is offline
- [Research]: 100ms trailing-edge debounce on all dial handlers — dial events fire at 20+/sec; ESP8266 TCP stack limit ~4-6 concurrent connections
- [Research]: Use multicast-dns (pure JS) not mdns (native bindings) — mdns breaks on Windows
- [Phase 01-01]: Used @elgato/cli@1.7.1 (version 2.0.0 does not exist on npm — latest is 1.7.1)
- [Phase 01-01]: Node.js built-ins fully externalized in rollup.config.mjs to support multicast-dns dgram dependency
- [Phase 01-01]: PropertyInspectorPath omitted from manifest.json in 01-01 — to be added in plan 01-03 when global settings HTML is created
- [Phase 01-02]: Use AbortSignal.timeout(ms) directly (not AbortController) — cleaner syntax, no manual cleanup needed
- [Phase 01-02]: DOMException.name is read-only — set via constructor second arg new DOMException(msg, 'AbortError'), not Object.assign
- [Phase 01-02]: vitest v4 selected for test runner — ESM-native, no babel/jest config overhead
- [Phase 01-03]: as-any cast on setGlobalSettings/getGlobalSettings and sendToPropertyInspector — @elgato/utils JsonObject constraint requires index signatures that would pollute domain models
- [Phase 01-03]: Background polling not implemented in PI — polls on open via getControllers; avoids resource overhead when panel is closed
- [Phase 01-03]: ControllerRegistry.add() saves immediately without reachability check per locked plan decision; name fetch is best-effort only
- [Phase 02-01]: experimentalDecorators set to false — SDK @action uses TC39 stage-3 ClassDecoratorContext, incompatible with legacy TS experimental decorator mode
- [Phase 02-01]: TogglePowerSettings extends Record<string, any> for JsonObject compatibility — avoids index signature pollution on domain types
- [Phase 02-01]: onPropertyInspectorDidAppear uses ev.action.getSettings() — PropertyInspectorDidAppearEvent has no payload property (ActionWithoutPayloadEvent)
- [Phase 02-01]: Per-action namespaced messages (tp:*) + global plugin.ts guard regex to avoid collision
- [Phase 02-02]: ActivatePresetSettings extends Record<string, any> for JsonObject compatibility — same pattern as TogglePowerSettings
- [Phase 02-02]: PI stores presetsByController as local map; re-renders dropdowns on presetList without re-fetching on mode switch
- [Phase 02-02]: Advanced mode skips controllers with no preset mapped — allows partial configuration without alerting
- [Phase 02-02]: Simple mode sources preset dropdown from first selected controller only — predictable UX for common case

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2]: Verify WLED /presets.json response schema against real device before shipping — preset name dropdown implemented using best-effort schema from research (MEDIUM confidence)
- [Phase 3]: Verify SDK encoder API — exact event names, setFeedback() payload, built-in layout IDs — against @elgato/streamdeck@2.0.1 docs before implementation (MEDIUM confidence)
- [Phase 4]: Pull Elgato Marketplace icon size specs from docs.elgato.com/sdk/plugins/publishing at start of phase (do not rely on training data)

## Session Continuity

Last session: 2026-02-19T21:01:00Z
Stopped at: Completed 02-02-PLAN.md
Resume file: .planning/phases/02-actions/ (next plan in Phase 2)
