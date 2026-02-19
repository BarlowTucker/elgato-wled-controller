# Project Research Summary

**Project:** WLED Stream Deck Plugin
**Domain:** Stream Deck Plugin + IoT LED Lighting Control (WLED)
**Researched:** 2026-02-19
**Confidence:** MEDIUM

## Executive Summary

This is a Stream Deck plugin project that lets users control WLED LED controllers (running on ESP8266/ESP32 hardware) directly from their Stream Deck or Stream Deck+ hardware. Experts build this type of plugin using Elgato's official SDK v2 (`@elgato/streamdeck` npm package), which provides a Node.js-based plugin runtime with TypeScript-native action decorators, encoder/dial support, and a built-in WebSocket bridge to the Stream Deck application. Communication with WLED devices uses the WLED JSON HTTP API (`/json/state`) — no WebSocket, no third-party services, no cloud. The architecture splits into three distinct runtime contexts: a long-running Node.js plugin backend, per-action Property Inspector HTML pages (browser context), and the WLED devices themselves accessible over the local network.

The recommended approach is to build a layered foundation before any user-facing features: project scaffold and SDK integration first, then a stateless `WLEDClient` HTTP wrapper, then a global `ControllerRegistry` singleton persisted via SDK global settings, and finally actions built on top of those shared components. This ordering is dictated by component dependencies and prevents the most costly pitfall in this domain — storing controller definitions per-action instead of centrally. The MVP feature set is: global controller management (manual IP entry), a Toggle On/Off action, a Set Preset action (simple and advanced variants), and a Brightness/Speed dial — all with error handling and preset name display in the Property Inspector.

The two highest risks in this project are architectural: (1) storing controller definitions at the action level rather than globally, which causes unmaintainable configuration and requires a full rewrite if not established from day one; and (2) missing request timeouts on WLED HTTP calls, which causes the plugin to freeze when a controller goes offline. Secondary risks are Windows-specific mDNS failures (which is why mDNS discovery is deferred to v2) and dial event flooding (which requires a 100ms debounce built into the dial handler from the start). Both critical risks must be addressed in Phase 1 before any action code is written.

---

## Key Findings

### Recommended Stack

The official Elgato toolchain is the clear choice: `@elgato/streamdeck@2.0.1` (SDK v2) with `@elgato/cli` for scaffolding, TypeScript 5.x for type safety, Node.js 20.x (minimum required by SDK), and Rollup 4.x as the bundler (SDK scaffold uses Rollup — switching adds friction). Node.js 20's built-in `fetch()` eliminates the need for an HTTP client dependency. For mDNS discovery, `multicast-dns` (pure JavaScript) is required over the `mdns` npm package, which has native C++ bindings that break on Windows. The SDK scaffold handles the project structure correctly; `streamdeck create` is the right starting point.

**Core technologies:**
- `@elgato/streamdeck@2.0.1`: Plugin runtime and SDK — official, TypeScript-native, first-class encoder support
- `TypeScript ~5.x`: Type safety — SDK types prevent runtime errors in manifest and settings handling
- `Node.js 20.x`: Runtime — minimum required by SDK, provides built-in `fetch()` and `AbortController`
- `Rollup ~4.x`: Bundler — SDK scaffold uses it; produces single-file bundle for plugin distribution
- `multicast-dns` (latest): mDNS discovery — pure JS, no native bindings, works on Windows
- `@elgato/cli` (latest): CLI tooling — scaffold, symlink for dev, pack for distribution

**What NOT to use:** `mdns` npm package (native bindings, breaks on Windows), WebSocket for WLED (HTTP is sufficient), Express or any HTTP server in the plugin (SDK handles PI messaging), SDK v1 (legacy, no dial support).

### Expected Features

Research compared this plugin to Hue, Govee, and Nanoleaf Stream Deck integrations to establish expectations. The table stakes are clear and non-negotiable for a publishable plugin.

**Must have (table stakes):**
- Activate a preset by button press — core value proposition, must feel instant (<300ms perceived)
- Toggle power on/off — universal in all lighting plugins
- Per-action controller targeting — users have controllers for different rooms
- Controller add/remove management — manual IP/hostname entry is the minimum viable approach
- Property Inspector (settings UI) — all Stream Deck plugins require a PI; without it the plugin is unusable
- Graceful error handling for unreachable controllers — show error state on key; never crash or freeze
- Multiple controllers targeted per action — parallel HTTP fan-out
- Dial (encoder) support for brightness — Stream Deck+ users specifically expect this
- Visual feedback on key image — state-reflecting icons expected by marketplace users

**Should have (competitive differentiators):**
- Preset name display in PI (fetch from `/json/presets`) — showing "Sunset" instead of "14" is dramatically better UX
- Dial for effect speed — same pattern as brightness, power user feature
- Advanced multi-preset action (per-controller preset mapping) — unique to WLED's multi-device model
- Immediate key feedback (press animation via `showOk()` / `showAlert()`) — perceived responsiveness
- Named controller aliases — makes multi-device setups manageable

**Defer to v2+:**
- mDNS auto-discovery — high complexity, Windows mDNS failure risk; manual entry covers v1
- Live key state sync (polling) — complex state management; static icons acceptable for v1
- Solid color / color picker — WLED presets cover 99% of use cases; v2 if at all
- WebSocket real-time sync — v2 upgrade path; HTTP sufficient for v1

**Explicit anti-features (never build):**
- Cloud/relay integration — contradicts WLED's offline-first ethos
- Full WLED configuration editor — duplicates WLED's own web UI
- Analytics/telemetry — users of local IoT tools are privacy-conscious; skip entirely for v1

### Architecture Approach

The plugin uses a three-context architecture managed by the Elgato SDK: a long-running Node.js plugin backend (holds all state, makes all network calls), per-action Property Inspector HTML pages (browser context, no Node.js APIs, no direct WLED access), and WLED devices on the local network. The plugin backend communicates with the Stream Deck application via SDK-managed WebSocket, with WLED devices via outbound HTTP, and with Property Inspectors via SDK's `sendToPropertyInspector` / `onSendToPlugin` messaging. The critical boundary rule: Property Inspectors relay all WLED requests through the backend — direct PI-to-WLED `fetch()` calls cause CORS failures and split state management.

**Major components:**
1. **Plugin Entry Point** (`plugin.ts`) — bootstrap SDK, register actions, initialize global settings, connect
2. **WLEDClient** (`wled/client.ts`) — stateless HTTP GET/POST wrapper for `/json/state`; handles timeouts via `AbortController`; returns normalized responses
3. **ControllerRegistry** (`controllers/registry.ts`) — global singleton; CRUD for known WLED controllers; serialized to SDK `globalSettings`; source of truth for all controller metadata
4. **Action Layer** (`actions/*.ts`) — four actions: `SetPreset`, `SetPresetAdvanced`, `ToggleOnOff`, `Dial`; each handles its own lifecycle events; reads controller IDs from own settings, resolves to metadata via registry
5. **Property Inspectors** (`ui/*.html`) — one HTML file per action type; shared controller-list component; communicates only via SDK messaging
6. **DiscoveryService** (`controllers/discovery.ts`) — mDNS scan (v2 feature); populates ControllerRegistry; deferred from v1

**Key patterns:** Optimistic dial updates (update display before awaiting HTTP), `Promise.allSettled()` for all multi-controller dispatch, global settings as the single source of truth for controller data, singleton registry initialized before any action events fire.

### Critical Pitfalls

1. **Per-action controller storage** — storing controller IPs/names in individual action settings instead of a global registry makes the plugin unmanageable at scale and requires a full architectural rewrite. Prevention: establish the global ControllerRegistry singleton in Phase 1, before any action is built. Actions store only controller IDs.

2. **No HTTP request timeout** — WLED `fetch()` calls without `AbortController` hang for minutes when a controller is offline, freezing the entire plugin. Prevention: every WLED HTTP call wrapped with `AbortController` at 500-1500ms; use `Promise.allSettled()` not `Promise.all()` for multi-controller dispatch.

3. **Dial event flooding** — `dialRotate` events fire at 20+ per second; sending an HTTP POST per event overwhelms ESP8266 TCP stack (max ~6 concurrent connections), causing WLED to crash or become unresponsive. Prevention: 100ms trailing-edge debounce on all dial handlers; send only the final value after rotation stops.

4. **mDNS broken on Windows** — `mdns` npm package requires native C++ bindings that fail to build on Windows. `.local` hostnames also fail to resolve via `dns.lookup()` on Windows. Prevention: use `multicast-dns` (pure JS); store IPs not hostnames after discovery; keep manual IP entry as primary workflow (not fallback).

5. **Settings not persisted before action fires** — new actions with no PI interaction have undefined settings; pressing a button crashes with undefined access. Prevention: define default settings in `onWillAppear`; validate settings presence before every action execution; single global settings manager with write-queue to prevent startup race conditions.

---

## Implications for Roadmap

Based on the architecture's component dependency graph and the phase-specific pitfall warnings, research strongly suggests a 4-phase build order.

### Phase 1: Foundation — SDK, HTTP Client, Controller Registry

**Rationale:** All actions depend on WLEDClient and ControllerRegistry. Building these first establishes the shared infrastructure and bakes in the critical architectural decisions (global settings, request timeouts, `Promise.allSettled()`) before any action code exists. All five "must address in Phase 1" pitfalls are architectural — they cannot be retrofitted.

**Delivers:** Working plugin scaffold connected to Stream Deck SDK; WLEDClient with timeout and multi-controller dispatch; ControllerRegistry with globalSettings persistence; global settings management with singleton write queue; manifest with correct UUIDs finalized.

**Addresses:** Controller management (manual IP entry), graceful error handling infrastructure.

**Avoids:** Pitfall 1 (per-action controller storage), Pitfall 2 (no HTTP timeout), Pitfall 7 (Promise.all silent failure), Pitfall 8 (manifest UUID collision), Pitfall 12 (global settings race condition).

**Research flag:** Standard patterns — SDK scaffold and HTTP client are well-documented; no additional research needed.

### Phase 2: Button Actions — Toggle, Set Preset, Set Preset Advanced

**Rationale:** Button actions are simpler than dial actions and prove the full round-trip (key press → plugin → WLED → SDK feedback) without encoder complexity. Establishing one working action (Toggle) validates the architecture; the remaining button actions follow the same pattern.

**Delivers:** Toggle On/Off action with PI; Set Preset action (simple, all selected controllers) with PI; Set Preset Advanced action (per-controller preset mapping) with PI; preset name fetching from `/json/presets`; `showOk()` / `showAlert()` feedback on all actions; error state display on key.

**Addresses:** Activate preset (table stakes), Toggle on/off (table stakes), per-action controller targeting, multiple controllers per action, visual feedback on key, preset name display in PI, immediate key feedback.

**Avoids:** Pitfall 5 (undefined settings on new action), Pitfall 6 (preset ID instability — store name + ID), Pitfall 7 (Promise.allSettled for multi-controller).

**Research flag:** Standard patterns — SDK action lifecycle is well-documented. Verify WLED `/json/presets` response shape against live device before implementing name dropdown.

### Phase 3: Dial Actions — Brightness and Effect Speed

**Rationale:** Dial/encoder actions are the most SDK-specific component and have the most pitfalls (event flooding, display blocking, brightness-sent-to-off device). Building them after button actions means the HTTP and registry foundation is proven; the only new complexity is encoder-specific.

**Delivers:** Dial action for brightness (rotation → brightness change, display shows current value); Dial action for effect speed (rotation → `seg[0].sx`); optimistic display updates (display updates before HTTP completes); 100ms debounce on rotation events; `on: true` included in brightness payload.

**Addresses:** Dial/encoder support for brightness (table stakes), dial for effect speed (differentiator), dial display shows live value (differentiator).

**Avoids:** Pitfall 4 (dial flooding — debounce), Pitfall 2 (blocking display on HTTP — optimistic pattern), Pitfall 11 (brightness sent to powered-off device), Pitfall 14 (WLED effect speed field name — `seg[0].sx` not top-level `speed`).

**Research flag:** Needs research — verify exact SDK encoder event names (`dialRotate`, `dialDown`), `setFeedback()` API shape, and built-in layout IDs (`$A1` etc.) against current SDK docs before implementation. WLED `seg[0].sx` field should be tested against a real device.

### Phase 4: Polish, Assets, and Publish Prep

**Rationale:** Icon requirements and marketplace submission details are defined late but should be planned early. Deferred polish items (preset name as key label, named controller aliases) belong here along with all pre-publish checks.

**Delivers:** All action icons at correct Marketplace sizes; plugin and category icons; Property Inspector UI polish; preset name as key label; named controller aliases; pre-publish checklist completed; `.streamDeckPlugin` bundle tested end-to-end on Windows.

**Addresses:** Marketplace asset compliance, preset name as key label (differentiator), named controller aliases (differentiator).

**Avoids:** Pitfall 10 (icon non-compliance at submission), Pitfall 13 (dev server URL left in PI bundle).

**Research flag:** Verify Elgato Marketplace icon size requirements at https://docs.elgato.com/sdk/plugins/publishing before starting icon work.

### Phase Ordering Rationale

- **Foundation before features** — WLEDClient and ControllerRegistry are shared dependencies of all four actions. Building them first means actions have consistent, tested infrastructure rather than per-action reinventions.
- **Button actions before dial actions** — button actions prove the full architecture (PI ↔ backend ↔ WLED round-trip) without encoder complexity. Dial actions add optimistic update patterns on top of a proven base.
- **mDNS deferred** — Windows compatibility risk and complexity relative to value; manual IP entry covers v1 completely. mDNS fits as a v2 additive feature that doesn't require changes to existing code if ControllerRegistry is designed correctly (it takes source agnostic controller objects).
- **Dial actions as one phase** — brightness and effect speed dials are identical patterns; building them together avoids redundant setup and ensures the debounce utility is implemented once and reused.
- **Polish as final phase** — icons and marketplace prep are naturally last, but they must be planned explicitly (not as afterthoughts) to avoid submission-blocking surprises.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Dial actions):** Verify SDK encoder API — exact event names, `setFeedback()` payload shape, supported built-in layout IDs — against current `@elgato/streamdeck@2.0.1` docs. Training data confidence is MEDIUM for encoder specifics.
- **Phase 2 (Preset actions):** Verify WLED `/json/presets` response schema and `seg[0].sx` field semantics against a real device or current WLED docs. API shapes have MEDIUM confidence from training data.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** SDK project scaffold via `streamdeck create`, TypeScript action class structure, and `globalSettings` persistence are well-documented official patterns. HTTP client with `AbortController` is standard Node.js.
- **Phase 4 (Polish/Publish):** Marketplace submission workflow is procedural; read Elgato docs directly rather than pre-researching.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Official SDK, npm package versions, and Node.js requirements verified. `multicast-dns` recommendation solid. WebSearch unavailable during research — versions are training-data accurate as of August 2025. |
| Features | MEDIUM | Table stakes derived from comparable plugins (Hue, Govee, Nanoleaf) are reliable. WLED API field names (`ps`, `bri`, `on`, `seg.sx`) need live verification. mDNS service type `_wled._tcp` is LOW confidence — must verify against WLED source. |
| Architecture | MEDIUM | SDK v2 action class structure, global settings pattern, and PI messaging are well-documented. Encoder-specific API (`setFeedback()`, layout IDs, event names) is MEDIUM — verify decorator syntax and event names against current SDK docs. |
| Pitfalls | MEDIUM | ESP8266/ESP32 TCP limitations, Windows mDNS failures, and SDK settings timing are based on established patterns. Specific thresholds (100ms debounce, 1000ms timeout, 4-6 concurrent connections) are informed estimates — validate against real hardware during Phase 1-2. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **WLED mDNS service type:** Research flags `_wled._tcp` as LOW confidence. Before implementing mDNS discovery (v2), verify against WLED firmware source (`wled00/network.cpp`) at https://github.com/Aircoookie/WLED
- **WLED `/json/presets` response schema:** Verify exact response shape (nested object keyed by ID, vs. array) and whether preset names are included at the top level or require cross-referencing. Test with curl against a real device before Phase 2 preset name implementation.
- **SDK encoder API specifics:** `setFeedback()` payload, built-in layout strings (`$A1`, etc.), and `dialRotate` event tick units need verification against `@elgato/streamdeck@2.0.1` changelog and docs before Phase 3.
- **Elgato Marketplace icon requirements:** Icon size specs and any updated submission requirements should be pulled from https://docs.elgato.com/sdk/plugins/publishing at the start of Phase 4, not from training data.
- **ESP8266 TCP concurrency limit:** The "4-6 concurrent connections" threshold is an informed estimate. Real-world testing during Phase 1 HTTP client development should validate the per-controller request queue concurrency limit (suggested: 1-2).

---

## Sources

### Primary (HIGH confidence)
- `@elgato/streamdeck@2.0.1` npm package — version requirements, Node.js 20 minimum
- Stream Deck SDK GitHub (`elgatosf/streamdeck`) — action class structure, globalSettings API
- WLED JSON API (`kno.wled.ge/interfaces/json-api/`) — `/json/state` POST/GET, `bri`, `on`, `ps` fields

### Secondary (MEDIUM confidence)
- Elgato Stream Deck SDK docs (`docs.elgato.com/streamdeck/sdk/`) — manifest format, encoder layout, PI messaging
- WLED community documentation — `seg[0].sx` for effect speed, preset ID behavior across firmware versions
- Node.js IoT plugin patterns — `AbortController` timeout patterns, `Promise.allSettled()` for fan-out, `multicast-dns` as Windows-safe mDNS library
- Comparable plugin survey (Hue, Govee, Nanoleaf) — table stakes features and anti-feature rationale

### Tertiary (LOW confidence — must verify before use)
- WLED mDNS service type `_wled._tcp` — needs verification against WLED firmware source
- SDK encoder event names and `setFeedback()` API shape — training data cutoff August 2025; verify against current docs
- ESP8266 concurrent TCP connection limits — general embedded networking knowledge; validate with real hardware

---

*Research completed: 2026-02-19*
*Ready for roadmap: yes*
