# Roadmap: WLED Stream Deck Plugin

## Overview

Build a Stream Deck plugin from scaffold to publishable release in four phases. Phase 1 establishes the shared infrastructure (SDK, HTTP client, controller registry) that all actions depend on. Phase 2 delivers all button actions with full Property Inspector UIs. Phase 3 adds dial/encoder actions with debounce and live display. Phase 4 produces a marketplace-ready artifact with compliant icons and pre-publish validation.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - SDK scaffold, WLEDClient, and ControllerRegistry with global settings persistence
- [ ] **Phase 2: Button Actions** - Toggle, Set Preset, and Set Preset Advanced with Property Inspectors and error handling
- [ ] **Phase 3: Dial Actions** - Brightness and effect speed encoders with debounce and live display
- [ ] **Phase 4: Publish Ready** - Icons, marketplace compliance, and end-to-end validation

## Phase Details

### Phase 1: Foundation
**Goal**: The plugin runs, connects to Stream Deck, manages controllers globally, and can communicate with WLED devices safely
**Depends on**: Nothing (first phase)
**Requirements**: CTRL-01, CTRL-02, CTRL-03, CTRL-06, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. Plugin loads in Stream Deck and appears in the action list without errors
  2. User can add a WLED controller by IP/hostname with a display name and it persists across Stream Deck restarts
  3. User can remove a controller from the global registry
  4. A WLED HTTP request to an offline controller times out cleanly (no plugin freeze) and reports failure
  5. mDNS discovery finds WLED controllers on the local network and adds them to the registry
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — SDK scaffold, manifest, TypeScript/Rollup config, and project structure
- [ ] 01-02-PLAN.md — WLEDClient HTTP wrapper with AbortSignal timeouts (TDD)
- [ ] 01-03-PLAN.md — ControllerRegistry, mDNS scanner, and global settings Property Inspector

### Phase 2: Button Actions
**Goal**: Users can control their WLED lights with button presses — toggle power, activate presets, and target specific controllers per action
**Depends on**: Phase 1
**Requirements**: BTN-01, BTN-02, BTN-03, BTN-04, CTRL-04, CTRL-05, UI-01
**Success Criteria** (what must be TRUE):
  1. User can press a button to toggle power on/off across all selected controllers simultaneously
  2. User can press a button to activate a specific WLED preset on all selected controllers (preset shown by name, not numeric ID)
  3. User can configure different presets per controller in a single button press (advanced mode)
  4. Each action's Property Inspector lets the user choose which controllers it targets (multi-select)
  5. When a targeted controller is unreachable, the button shows an error state on the key without crashing
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md — WLEDClient extensions (togglePower, getPresets), TogglePowerAction with PI and controller multi-select
- [ ] 02-02-PLAN.md — ActivatePresetAction with simple/advanced mode, preset name dropdowns, and per-controller mapping

### Phase 3: Dial Actions
**Goal**: Users can adjust brightness and effect speed by turning dials, with the current value shown on the dial display in real time
**Depends on**: Phase 2
**Requirements**: DIAL-01, DIAL-02, DIAL-03, DIAL-04
**Success Criteria** (what must be TRUE):
  1. Turning the brightness dial changes brightness on all selected controllers (synced absolute value)
  2. Turning the effect speed dial changes effect speed on all selected controllers (synced absolute value)
  3. The dial display updates immediately as the user turns (optimistic — does not wait for HTTP response)
  4. When the dial is first focused, it reads and displays the current value from the WLED controller
  5. Rapid dial rotation does not flood WLED with HTTP requests (100ms debounce enforced)
**Plans**: TBD

Plans:
- [ ] 03-01: Dial action foundation (encoder events, debounce, optimistic display, live state sync)
- [ ] 03-02: Brightness and effect speed dial variants with Property Inspectors

### Phase 4: Publish Ready
**Goal**: The plugin is polished enough for personal daily use and meets Elgato Marketplace submission requirements
**Depends on**: Phase 3
**Requirements**: UI-02
**Success Criteria** (what must be TRUE):
  1. All action icons display correctly on the Stream Deck at the required marketplace sizes
  2. The packaged .streamDeckPlugin installs and runs end-to-end on a clean Windows machine
  3. No development artifacts (localhost URLs, debug logging) remain in the production bundle
**Plans**: TBD

Plans:
- [ ] 04-01: Icons, marketplace assets, and pre-publish validation

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-02-19 |
| 2. Button Actions | 0/2 | Planning | - |
| 3. Dial Actions | 0/2 | Not started | - |
| 4. Publish Ready | 0/1 | Not started | - |
