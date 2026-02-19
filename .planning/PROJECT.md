# WLED Stream Deck Plugin

## What This Is

A Stream Deck plugin that gives physical button and dial control over WLED LED controllers on the local network. Users configure buttons to activate presets, toggle power, and use dials to adjust brightness and effect speed — all targeting any number of WLED controllers simultaneously.

## Core Value

One button press controls multiple WLED lights instantly — no app switching, no phone, just tactile control.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Set Preset action — send a preset to all selected WLED controllers
- [ ] Set Preset Advanced action — send different presets per controller in one button press
- [ ] Toggle On/Off action — toggle power for all defined WLED controllers
- [ ] Dial action for brightness — control brightness across selected controllers (stay in sync)
- [ ] Dial action for effect speed — control effect speed across selected controllers (stay in sync)
- [ ] Dial shows current value on the Stream Deck display as user turns it
- [ ] Controller management — add controllers via mDNS auto-discovery or manual hostname/IP entry
- [ ] Per-action controller selection — choose which controllers each action targets
- [ ] HTTP JSON API communication with WLED (/json/state endpoint)
- [ ] Built on Stream Deck SDK v2 (Node.js-based plugin system)
- [ ] Static icons for button actions
- [ ] Publishable quality — works personally and polished enough for Elgato Marketplace / GitHub

### Out of Scope

- Set Solid Color action — defer to v2
- Set Effect action (specific effect + colors) — defer to v2
- WebSocket communication — HTTP JSON API is sufficient for v1
- Mobile companion app
- WLED firmware updates or configuration

## Context

- WLED exposes a JSON API at `/json/state` for reading and `/json/state` (POST) for setting state
- WLED presets are referenced by numeric ID (PS field in the API)
- WLED controllers are typically accessed via mDNS (.local hostnames) or static IPs
- Stream Deck SDK v2 uses Node.js, supports actions (buttons) and encoders (dials)
- Dials have touch display and rotation events — rotation for value changes, touch display for current value
- Plugin will need a Property Inspector (settings UI) for configuring controllers and action parameters

## Constraints

- **Platform**: Stream Deck SDK v2 — must follow Elgato's plugin architecture and manifest format
- **Network**: Controllers are on local network — no cloud dependency, mDNS + HTTP only
- **API**: WLED HTTP JSON API — well-documented, synchronous request/response

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| HTTP JSON API over WebSocket | Simpler implementation, sufficient for button press/dial turn latency | — Pending |
| SDK v2 (not v1) | Modern Node.js architecture, better dial/encoder support, actively maintained | — Pending |
| Sync mode for dials (not relative) | Sets same absolute value on all controllers — simpler mental model | — Pending |
| Both simple + advanced preset modes | Simple covers 90% of cases, advanced available for power users | — Pending |

---
*Last updated: 2026-02-19 after initialization*
