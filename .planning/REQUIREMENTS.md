# Requirements: WLED Stream Deck Plugin

**Defined:** 2026-02-19
**Core Value:** One button press controls multiple WLED lights instantly — no app switching, no phone, just tactile control.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Controller Management

- [ ] **CTRL-01**: User can add WLED controllers by IP address or hostname with a display name
- [ ] **CTRL-02**: User can remove WLED controllers from the global registry
- [ ] **CTRL-03**: User can assign a friendly name to each controller (e.g., "Desk Strip")
- [ ] **CTRL-04**: User can select which controllers each action targets (multi-select per action)
- [ ] **CTRL-05**: Plugin shows error state on key when a controller is unreachable (no freeze/crash)
- [ ] **CTRL-06**: User can discover WLED controllers on the local network via mDNS auto-discovery

### Button Actions

- [ ] **BTN-01**: User can toggle power on/off for all selected controllers with one button press
- [ ] **BTN-02**: User can activate a specific preset (by ID) on all selected controllers with one button press
- [ ] **BTN-03**: User can configure different presets per controller in a single button press (advanced mode)
- [ ] **BTN-04**: Property Inspector shows preset names (fetched from WLED) instead of raw numeric IDs

### Dial/Encoder Actions

- [ ] **DIAL-01**: User can adjust brightness via dial rotation across all selected controllers (synced value)
- [ ] **DIAL-02**: User can adjust effect speed via dial rotation across all selected controllers (synced value)
- [ ] **DIAL-03**: Dial display shows current brightness/speed value as user turns the dial
- [ ] **DIAL-04**: Dial reads current value from WLED controller when first focused (live state sync)

### UI & Infrastructure

- [ ] **UI-01**: All actions have a Property Inspector for configuration
- [ ] **UI-02**: Plugin includes static icons for each action type
- [ ] **UI-03**: Plugin communicates with WLED via HTTP JSON API (local network only, no cloud)
- [ ] **UI-04**: Plugin built on Stream Deck SDK v2 with TypeScript

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Polish

- **POL-01**: Key press shows brief visual confirmation (showOk/showAlert feedback)
- **POL-02**: Preset name displayed as key label on the button
- **POL-03**: Dynamic key images reflecting on/off state or active preset

### Additional Actions

- **ACT-01**: Set solid color action (hex/RGB to selected controllers)
- **ACT-02**: Set effect action (specific WLED effect with configured parameters)

## Out of Scope

| Feature | Reason |
|---------|--------|
| WebSocket communication | HTTP JSON API sufficient for button/dial latency; WebSocket adds connection lifecycle complexity |
| WLED configuration editing | Duplicates WLED's own excellent web UI; plugin controls state only |
| WLED firmware updates | Out of scope for a Stream Deck plugin entirely |
| Cloud/relay integration | WLED is local-only by design; cloud contradicts offline-first ethos |
| Color picker UI | Complex PI widget; presets cover 99% of color use cases |
| Effect browser | WLED has 100+ effects; browsing via PI is impractical; use presets |
| Mobile companion app | Outside Stream Deck plugin architecture |
| Analytics/telemetry | Users of local IoT tools are privacy-conscious; log locally only |
| Multi-profile scene grouping | Stream Deck already has Profiles for scene switching |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CTRL-01 | Phase 1 | Pending |
| CTRL-02 | Phase 1 | Pending |
| CTRL-03 | Phase 1 | Pending |
| CTRL-06 | Phase 1 | Pending |
| UI-03 | Phase 1 | Pending |
| UI-04 | Phase 1 | Pending |
| BTN-01 | Phase 2 | Pending |
| BTN-02 | Phase 2 | Pending |
| BTN-03 | Phase 2 | Pending |
| BTN-04 | Phase 2 | Pending |
| CTRL-04 | Phase 2 | Pending |
| CTRL-05 | Phase 2 | Pending |
| UI-01 | Phase 2 | Pending |
| DIAL-01 | Phase 3 | Pending |
| DIAL-02 | Phase 3 | Pending |
| DIAL-03 | Phase 3 | Pending |
| DIAL-04 | Phase 3 | Pending |
| UI-02 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-02-19*
*Last updated: 2026-02-19 after roadmap creation*
