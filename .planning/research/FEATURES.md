# Feature Landscape

**Domain:** Stream Deck Plugin — IoT/LED Lighting Control (WLED)
**Researched:** 2026-02-19
**Confidence:** MEDIUM — based on training knowledge of Stream Deck ecosystem, WLED API, and comparable IoT plugins (Hue, Govee, Nanoleaf). WebSearch unavailable during this session; flags noted where live verification would strengthen claims.

---

## Table Stakes

Features users expect from any Stream Deck lighting plugin. Missing any of these and users abandon or leave bad reviews.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Activate a preset by button press** | Core value proposition — one button = one lighting scene. Every comparable plugin does this. | Low | Maps to WLED `/json/state` POST with `ps` field. Must feel instant (<300ms perceived). |
| **Toggle power on/off** | Universal in all lighting plugins. Users need a kill switch. | Low | WLED `/json/state` POST `{"on": true/false}` or `{"on": "t"}` for toggle. |
| **Visual feedback on key image** | Elgato Marketplace expects icons. Users expect button state to reflect current state (on/off indicator). | Medium | Static icons acceptable for v1. Animated or dynamic state (active/inactive color) is table stakes for polished feel. |
| **Per-action controller targeting** | Users have multiple WLED controllers for different rooms/purposes. Must be able to target specific ones. | Medium | Requires global controller registry + per-action multi-select. |
| **Property Inspector (settings UI)** | All Stream Deck plugins require a PI for configuration. Without it the plugin is unusable. | Medium | Must cover: controller selection, preset ID/name, action-specific params. |
| **Controller add/remove management** | Users can't use the plugin without being able to register their WLED devices. | Medium | Global settings panel or PI-based. mDNS discovery is a strong bonus but manual IP/hostname entry is the minimum. |
| **Graceful error handling — unreachable controller** | Network errors happen. Plugin must not crash or freeze the Stream Deck. Users expect silent failure or a clear error icon. | Low | Show error state on key; log to console. Do not throw unhandled. |
| **Multiple controllers targeted per action** | Controlling one room's ambiance often means hitting 2-3 strips simultaneously. All comparable multi-device plugins support this. | Medium | Fire HTTP requests to all selected controllers (parallel). |
| **Works without internet** | WLED is local-only. Users expect zero cloud dependency. | Low | This is naturally satisfied by the architecture, but must not accidentally phone home. |
| **Dial (encoder) support for brightness** | Stream Deck+ users specifically buy dials for analog-feeling controls. Brightness is the #1 use case. | Medium | Rotation changes brightness, touch/press resets or toggles. Display shows current value. |

---

## Differentiators

Features that set this plugin apart. Not universally expected, but valued — especially by power users and content creators who use WLED heavily.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **mDNS auto-discovery** | Eliminates the #1 friction point: finding device IPs. Users with WLED almost universally use `.local` hostnames or rely on router DHCP. Auto-discovery makes first-run effortless. | High | Requires mDNS/Bonjour library (e.g., `mdns`, `multicast-dns`). WLED advertises `_wled._tcp` service type. Windows mDNS support can be tricky — needs careful testing. |
| **Preset name display (not just ID)** | WLED presets are referenced by numeric ID, but users name them. Showing "Sunset" instead of "14" in the PI is dramatically better UX. | Medium | Requires fetching `/json/presets` from controller on open. Cache result. Map ID→name in UI. |
| **Dial for effect speed** | WLED effects have a speed parameter distinct from brightness. Creators who use animated effects will love speed control. | Medium | Same encoder pattern as brightness. `/json/state` POST `{"seg":[{"sx": value}]}`. |
| **Advanced multi-preset action (per-controller presets)** | One button sets different presets on different controllers simultaneously. E.g., press "Stream Mode": desk lights go to preset 3, background strip goes to preset 7. This is unique to WLED's multi-device model. | High | Requires per-controller preset configuration in the PI. Complex UI but powerful. |
| **Dial display shows live value** | As the user turns, the encoder's LCD shows current brightness/speed percentage. Most dial plugins do this but the real differentiator is that it stays accurate even if WLED state changes externally. | Medium | On dial focus/press, read current state from WLED and sync. Display updates on every tick. |
| **Key image reflects active preset or state** | Button visually indicates current state — dimmed/lit icon for off/on, or a colored indicator for which preset is active. Users who use Stream Deck as a control surface prefer contextual feedback. | High | Requires polling WLED state or caching last-known state. Adds complexity to state management. Defer to v2 if needed. |
| **Preset name as key label** | Show the preset name (e.g., "Gaming") on the key instead of a generic icon. Very common in Hue/Govee plugins. | Low | Use `setTitle()` with fetched preset name. Requires preset name fetching. |
| **Immediate key feedback (press animation)** | Brief key highlight on press, before network response. Makes the plugin feel responsive even on slow networks. | Low | Use `showOk()` / `showAlert()` from Stream Deck SDK for instant feedback. |
| **Named controller aliases** | Let users name their controllers ("Desk Strip", "Room Backlight") instead of showing raw IPs. Makes multi-controller setups manageable. | Low | Simple string field in controller registry. No API calls needed. |
| **Per-action brightness/color override on preset activate** | Send a preset but also override brightness inline. E.g., "Movie Mode at 20%". | Medium | Combine `ps` + `bri` in the same POST payload. Add brightness field to advanced PI. |

---

## Anti-Features

Features to deliberately NOT build. These add complexity, scope creep, or conflict with the plugin's focused purpose.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Cloud/relay integration** | WLED is local-only by design. Adding cloud would introduce auth complexity, privacy concerns, and a reliability dependency that contradicts WLED's offline-first ethos. Users would not expect or want this. | Stay HTTP local. If user needs remote access, they handle it via VPN/reverse proxy themselves. |
| **Full WLED configuration editor** | This duplicates the WLED web UI, which is already excellent. Building a PI that edits WiFi settings, LED counts, etc. is massive scope with no Stream Deck-specific value. | Link to WLED web UI for config. Plugin controls state only. |
| **WLED firmware update management** | Out of scope for a Stream Deck plugin entirely. Firmware is managed in WLED's own UI. | Not applicable — do not build. |
| **WebSocket real-time sync (v1)** | WebSocket adds connection lifecycle complexity (reconnect, heartbeat, per-controller connection pooling). HTTP is sufficient for button-press latency and simpler to debug. | HTTP JSON API for v1. WebSocket can be a v2 upgrade path for live state sync. |
| **Color picker UI for ad-hoc color setting** | Implementing a color wheel or RGB picker in the Stream Deck PI is complex and better suited to a touchscreen app. WLED presets already capture color configurations. | Presets cover 99% of color use cases. Defer solid color to v2 with a simple hex/RGB field only. |
| **Effect browser / effect picker** | WLED has 100+ effects. Browsing them via a Stream Deck PI is impractical UX. A preset captures the effect + colors + settings already. | Use presets. If effect control is needed, it's a v2 advanced action with direct effect ID entry. |
| **Multi-profile / scene grouping within the plugin** | Stream Deck already has Profiles for switching button layouts. Duplicating scene management inside the plugin fights the SDK. | Use Stream Deck profiles for scene switching. The plugin's presets are the scenes. |
| **Mobile companion app** | Outside the plugin architecture entirely. Stream Deck plugins are desktop-only by design. | Not applicable. |
| **Analytics / telemetry** | Users of local-only IoT tools are privacy-conscious. Any telemetry — even crash reporting — should be opt-in with explicit notice. For v1, skip entirely. | Log locally to console only. |
| **Accounts / login / API keys** | WLED has no auth (or optional basic auth). Building an account system would be massive scope with zero user demand. | Use IP/hostname direct. If a user has WLED basic auth, support username/password fields as an optional advanced setting — but no "accounts". |

---

## Feature Dependencies

```
Controller Registry (add/remove/name controllers)
    → Per-action Controller Selection (need registry to select from)
        → Set Preset Action (needs controller targets + preset ID)
        → Toggle On/Off Action (needs controller targets)
        → Dial: Brightness (needs controller targets)
        → Dial: Effect Speed (needs controller targets)

mDNS Discovery
    → Controller Registry (populates it automatically)

Preset Name Fetching (/json/presets)
    → Preset Name Display in PI (enriches the selection UX)
    → Key Label = Preset Name (requires fetched name)

Set Preset (simple) — prerequisite pattern for:
    → Set Preset Advanced (per-controller mapping extends simple concept)

Dial Rotation Handler
    → Dial Display (LCD feedback is part of same encoder action)
    → Live State Sync on dial focus (reads current value before first turn)
```

---

## MVP Recommendation

Prioritize for v1 (publishable quality):

1. **Controller Registry** — global settings: add by IP/hostname with display name, manual only. mDNS as an enhancement after core works.
2. **Toggle On/Off action** — simplest action, validates the full HTTP→WLED pipeline.
3. **Set Preset action (simple)** — single preset ID, all selected controllers. Covers 90% of user needs.
4. **Dial: Brightness** — encoder action, rotation adjusts brightness, display shows value. Validates dial architecture.
5. **Dial: Effect Speed** — identical pattern to brightness, second dial action.
6. **Set Preset Advanced action** — per-controller preset mapping. Power user feature, but differentiating enough to include in v1.
7. **Error state on key** — `showAlert()` on HTTP failure. Required for publishable quality.
8. **Preset name display in PI** — fetch from `/json/presets`, show name not ID in the PI dropdown. Differentiating UX improvement, low-medium effort.

Defer to v2:

- **mDNS auto-discovery** — high complexity, Windows mDNS issues. Manual entry covers v1.
- **Live key state sync (polling)** — complex state management. Static icons acceptable for v1.
- **Key label = preset name** — nice-to-have, depends on preset name fetching.
- **Solid color / effect actions** — explicitly out of scope per PROJECT.md.

---

## Confidence Notes

| Area | Confidence | Basis |
|------|------------|-------|
| Table stakes features | MEDIUM-HIGH | Consistent across all comparable plugins (Hue, Govee, Nanoleaf) in training data. Elgato Marketplace conventions well-established. |
| WLED API fields (`ps`, `bri`, `on`, `seg.sx`) | MEDIUM | Training knowledge of WLED API. WLED docs at kno.wled.ge should be verified before implementation. |
| mDNS service type for WLED (`_wled._tcp`) | LOW | Training data — must verify against WLED source or docs before implementing discovery. |
| Stream Deck SDK v2 encoder API | MEDIUM | SDK v2 conventions well-established in training. Verify `showOk()`, `showAlert()`, encoder event names against official SDK docs. |
| Anti-feature rationale | HIGH | Based on design principles that are technology-agnostic. |

---

## Sources

- WLED API documentation: https://kno.wled.ge/interfaces/json-api/ (verify before implementation — not fetched this session)
- Stream Deck SDK v2 docs: https://docs.elgato.com/streamdeck/sdk/references/ (verify encoder/dial API against current SDK)
- Comparable plugins surveyed via training knowledge: Philips Hue for Stream Deck, HomeControl for Stream Deck, Govee, Nanoleaf integrations
- WLED mDNS service type: verify at https://github.com/Aircoookie/WLED source (`wled00/network.cpp`)
