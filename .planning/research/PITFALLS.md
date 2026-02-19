# Domain Pitfalls

**Domain:** Stream Deck plugin + WLED IoT lighting control
**Researched:** 2026-02-19
**Confidence note:** External tools unavailable during this session. All findings are drawn from training-data knowledge of the Stream Deck SDK v2 (Node.js), WLED HTTP/JSON API, mDNS/Bonjour, and Node.js IoT plugin patterns. Confidence levels reflect source quality accordingly.

---

## Critical Pitfalls

Mistakes that cause rewrites, corrupted settings, or plugin rejection.

---

### Pitfall 1: Settings Stored at Action Level Instead of Global Level

**What goes wrong:** Controller definitions (IP/hostname, friendly name) are stored inside each action's settings rather than in a shared global store. When a user renames or removes a controller, they must update every single action that references it. With 10+ actions this becomes unmanageable and users stop trusting the plugin.

**Why it happens:** The Stream Deck SDK makes `action.getSettings()` and `action.setSettings()` the obvious first path. Developers reach for per-action settings before discovering `streamDeck.settings.getGlobalSettings()` / `setGlobalSettings()`.

**Consequences:**
- Renaming one controller requires updating dozens of actions manually
- Controller list in Property Inspector is per-action, so adding a new controller means editing every action
- Settings become inconsistent — some actions have stale IPs after a controller changes
- Complete architectural rewrite mid-project when the problem becomes undeniable

**Prevention:**
- Store the controller registry (list of WLED devices) in global settings only
- Each action stores only a list of controller IDs (not IPs or names)
- Property Inspector reads the global controller list at open time; actions resolve IDs at runtime
- Establish this architecture in Phase 1 before any action is built

**Detection (warning signs):**
- Property Inspector has an "IP Address" field directly on action settings UI
- Different actions show different controller lists
- User complains that changing a controller's IP broke only some buttons

**Phase:** Must be addressed in Phase 1 (foundation/architecture). Cannot be retrofitted cheaply.

---

### Pitfall 2: No Timeout on WLED HTTP Requests

**What goes wrong:** HTTP requests to offline or unreachable WLED controllers hang indefinitely (or for Node.js's default ~2-minute TCP timeout). When the user presses a button targeting an offline controller, the plugin appears frozen. If multiple controllers are targeted simultaneously, one hung request blocks feedback for all.

**Why it happens:** Node.js `fetch` / `http.request` have no built-in request timeout. Developers test on a live network and never discover this until a controller goes offline.

**Consequences:**
- Plugin appears completely unresponsive for minutes when a controller is down
- Error state is never shown on button (no feedback to user)
- With `Promise.all()` across multiple controllers, one offline unit blocks all feedback
- Under repeated button presses, you accumulate a queue of hung requests that cascade when the controller comes back

**Prevention:**
- Wrap every WLED HTTP call with `AbortController` and a timeout (500ms–1500ms max for local network)
- Use `Promise.allSettled()` not `Promise.all()` when targeting multiple controllers
- On timeout, immediately set the button to an error/offline state
- Implement per-controller health tracking so offline controllers are skipped until they recover

**Detection (warning signs):**
- Tests only run against a powered-on WLED device
- No AbortController in HTTP utility code
- Using `Promise.all()` for multi-controller dispatch

**Phase:** Phase 1 (HTTP client foundation). Retrofitting timeout behavior later requires touching every call site.

---

### Pitfall 3: mDNS Discovery Broken on Windows Without Explicit Bonjour Dependency

**What goes wrong:** mDNS service discovery (finding `wled-device.local` hostnames) works perfectly on macOS during development but silently fails on Windows unless Bonjour (Apple's mDNS implementation) is installed or an alternative is explicitly provided. Stream Deck runs predominantly on Windows. The `.local` hostname resolution itself (not just discovery) can also fail on Windows without proper mDNS support.

**Why it happens:** Node.js `dns.lookup()` on Windows does not use mDNS for `.local` names by default. macOS resolves `.local` natively at the OS level. Libraries like `mdns` npm package require platform-specific native builds that frequently break on Windows.

**Consequences:**
- mDNS auto-discovery works in dev (macOS) but fails for 90% of users (Windows)
- Even manually entered `.local` hostnames fail to resolve
- Plugin gets 1-star reviews: "doesn't find my WLED" on Windows
- Developer discovers this at publish time, not during development

**Prevention:**
- Use `multicast-dns` (pure JavaScript, no native bindings) over `mdns` (requires native build)
- Test mDNS resolution explicitly on Windows — run Stream Deck on Windows during dev even if primary OS is macOS
- Always offer manual IP/hostname entry as the primary fallback, not secondary option
- Document in setup that `.local` hostnames require Bonjour on Windows (Apple's iTunes installer includes it)
- Consider resolving `.local` to IP at discovery time and storing the IP, not the `.local` name

**Detection (warning signs):**
- Using `mdns` npm package (has native bindings)
- `.local` hostnames stored directly in settings without IP fallback
- No Windows test environment during development

**Phase:** Phase 1 (controller discovery). This is an architecture decision — store IPs vs. `.local` names — that cannot be easily changed later.

---

### Pitfall 4: Dial (Encoder) Rotation Not Debounced or Rate-Limited

**What goes wrong:** Stream Deck dials fire `dialRotate` events at high frequency when turned quickly. Each event triggers an HTTP POST to all selected WLED controllers. A user turning a brightness dial quickly can fire 20+ events per second, flooding the WLED device's HTTP server (an ESP8266/ESP32 with limited TCP stack capacity). Result: WLED stops responding, drops connections, or crashes.

**Why it happens:** SDK events are synchronous and immediate. Developers implement the obvious pattern: `on('dialRotate', () => sendToWled())`. The ESP chip's HTTP server is not designed for rapid concurrent connections.

**Consequences:**
- WLED device becomes unresponsive during aggressive dial use
- User must power-cycle their lights
- Requests arrive out of order — the last request may not have the highest/latest value
- Multiple controllers receive different final values if some requests fail mid-burst

**Prevention:**
- Implement debounce (trailing edge, ~100ms) OR throttle (leading edge, emit at most every 100ms) on all dial events
- Use a single "current target value" variable updated by each dial event; only the debounced callback sends the HTTP request
- With multiple controllers, send to all in parallel with `Promise.allSettled()` after debounce resolves
- For absolute value (brightness 0–255), always send the latest value, not cumulative delta

**Detection (warning signs):**
- `dialRotate` handler directly calls `sendToWled()` with no rate limiting
- HTTP request count in network tab spikes to 20+ per second during dial test
- WLED device becomes unreachable after aggressive dial use during testing

**Phase:** Phase 2 (dial implementation). Must be built in from the start of dial work, not added as a patch.

---

### Pitfall 5: Property Inspector Settings Not Persisted Before Action Fires

**What goes wrong:** The Property Inspector (PI) is a separate HTML page that communicates with the plugin via `sendToPlugin` / `sendToPropertyInspector`. Developers assume settings are always available when an action fires. In practice: the PI sends settings when the user interacts with it, but if the user never opens the PI for a newly-added action, settings are undefined. Also, settings sent from PI may not yet be persisted when the button is immediately pressed.

**Why it happens:** The settings flow (PI → plugin → `setSettings` → persisted) is asynchronous and indirect. Developers test their happy path (open PI, configure, press button) and never test "press button without opening PI first."

**Consequences:**
- New actions with default settings do nothing or throw on undefined access
- Race condition: user closes PI and immediately presses button before `setSettings` round-trip completes
- After Stream Deck restart, settings are correctly loaded — hiding the bug during development

**Prevention:**
- Always define default settings in the `onWillAppear` event using `action.getSettings()` and merging defaults
- Validate settings presence before every action execution; show an alert if unconfigured
- Use `streamDeck.settings.getGlobalSettings()` in `onDidReceiveGlobalSettings` handler — always await before using
- Test the "newly added action, never opened PI" scenario explicitly

**Detection (warning signs):**
- No `onWillAppear` handler that ensures default settings
- Direct property access on settings object without null checks (`settings.controllers[0].ip`)
- PI sends settings only on user interaction, not on `onSendToPropertyInspector` / PI open

**Phase:** Phase 1 (action skeleton). Default-settings pattern must be established before any action logic is built.

---

## Moderate Pitfalls

---

### Pitfall 6: WLED Preset IDs Are Not Stable Across Firmware Updates or Config Restore

**What goes wrong:** WLED preset IDs are integers assigned sequentially. Users who restore a WLED config backup, reset their device, or upgrade firmware may find that preset #5 "Cozy Evening" becomes preset #12 after restoration. The plugin has stored preset ID 5 — now it activates the wrong effect.

**Why it happens:** Developers store numeric preset IDs as the canonical reference and assume they are stable.

**Consequences:**
- Wrong preset activates silently — no error, just wrong lighting
- Users must manually re-map every action after any WLED restore
- User confusion, bug reports that are actually a WLED issue but blamed on plugin

**Prevention:**
- Display preset names (fetched from `/json/presets`) in the Property Inspector alongside IDs
- Refresh preset names when the PI opens — warn if a preset ID no longer exists on the device
- Store both the ID and the name; show a warning indicator if the name doesn't match what the device reports
- Document in the plugin README that preset IDs can change after WLED config changes

**Detection (warning signs):**
- PI shows only numeric preset IDs, not names fetched from the device
- No validation that a stored preset ID still exists on the target controller

**Phase:** Phase 2 (preset action implementation).

---

### Pitfall 7: Targeting Multiple Controllers With Promise.all Fails Silently

**What goes wrong:** `Promise.all([sendToControllerA(), sendToControllerB()])` — if controller A is offline and throws, the entire promise rejects. Controller B may or may not have received the command. The UI shows an error state but it's unclear which controller failed or whether partial success occurred.

**Why it happens:** `Promise.all` is the natural multi-async pattern. Most tutorials use it. Its fail-fast behavior is rarely considered in IoT contexts where partial success is the normal case.

**Consequences:**
- Offline controller prevents online controllers from being commanded
- User cannot use their lights even when only one of five controllers is down
- Error state on button doesn't tell user which controller is the problem

**Prevention:**
- Always use `Promise.allSettled()` for multi-controller dispatch
- Log which controllers succeeded vs. failed
- Show partial-success state on button (e.g., yellow warning vs. red error)
- Consider: if all controllers failed = error state; some failed = warning state; all succeeded = normal

**Detection (warning signs):**
- `Promise.all()` used for multi-controller calls in action handlers
- No per-controller success/failure tracking in dispatch logic

**Phase:** Phase 1 (HTTP client) and Phase 2 (action dispatch logic).

---

### Pitfall 8: Manifest UUID Collision or Incorrect Action ID Format

**What goes wrong:** Stream Deck plugin manifests require globally unique action UUIDs in reverse-domain format (e.g., `com.yourname.wled.preset`). Developers copy example manifests and forget to update all UUIDs, or use a format that passes local testing but fails Elgato marketplace validation.

**Why it happens:** Manifest validation only surfaces at publish time, not during local development. The SDK loads plugins regardless of UUID conflicts with other installed plugins during dev.

**Consequences:**
- Plugin rejected by Elgato marketplace review
- UUID collision with another installed plugin causes one to override the other's actions
- Actions lose their settings if UUID changes between plugin versions

**Prevention:**
- Use your GitHub username or a domain you own as the prefix: `com.github.yourusername.wled.*`
- Finalize UUIDs in the manifest before any action development — changing them later corrupts existing user settings
- Validate manifest structure against Elgato's schema before first publish attempt
- Never reuse UUIDs from tutorial or sample code

**Detection (warning signs):**
- Manifest copied from a sample and UUID prefix not changed
- Action IDs changed between plugin versions (settings will be lost for existing users)

**Phase:** Phase 1 (project scaffolding). UUID is foundational — must never change after first release.

---

### Pitfall 9: WLED HTTP API Overwhelmed by Concurrent Connections From Multiple Actions

**What goes wrong:** When multiple Stream Deck buttons are pressed simultaneously (or a Profile switch activates multiple `onWillAppear` events at once), multiple concurrent HTTP requests hit the same WLED device simultaneously. ESP8266-based WLED devices typically handle only 4–6 concurrent TCP connections. ESP32 is more capable but still limited. Exceeding this drops connections.

**Why it happens:** Developers test with one action at a time. Production use involves profiles with many actions all querying or setting state simultaneously.

**Consequences:**
- Connection refused errors on profile switches with many WLED actions
- Intermittent failures that are hard to reproduce
- Users with older ESP8266 devices have much worse experience than testers with ESP32

**Prevention:**
- Implement a per-controller request queue (concurrency limit of 1–2 per device) using a simple queue or a library like `p-limit`
- On `onWillAppear` (profile load), stagger state-read requests with small delays or queue them
- Do not fetch current state on every `onWillAppear` if it can be cached
- Document that ESP8266-based WLED devices have lower reliability under concurrent use

**Detection (warning signs):**
- Unconstrained parallel requests to same controller IP
- No per-controller request queue in HTTP client
- Testing only with single-action scenarios

**Phase:** Phase 1 (HTTP client). Queue architecture is foundational.

---

### Pitfall 10: Plugin Icon and UI Assets Not Following Elgato Marketplace Requirements

**What goes wrong:** The Elgato Marketplace has specific requirements for plugin icons: plugin icon (72x72 PNG), action icons (20x20, 72x72 PNG at minimum), key images sized correctly, Property Inspector within size constraints. Developers discover these requirements at submission time, requiring a design sprint that delays launch.

**Why it happens:** During development, placeholder icons work fine. Asset requirements are buried in Elgato's plugin submission documentation that isn't read until submission.

**Consequences:**
- Plugin rejected at marketplace review for asset non-compliance
- Rushed icon design at end of project produces lower-quality result
- Stream Deck software renders oversized icons incorrectly

**Prevention:**
- Read Elgato marketplace submission requirements before starting icon work
- Design icons at required sizes from the beginning (not "scale later")
- Include icon production as a defined task in the roadmap, not an afterthought
- Prepare both light and dark variants if required

**Detection (warning signs):**
- Icons designed at arbitrary sizes with plan to resize
- No marketplace submission checklist reviewed before asset work
- Property Inspector HTML not tested at actual Stream Deck PI dimensions

**Phase:** Phase 3 or final polish phase — but plan for it explicitly, not as an afterthought.

---

## Minor Pitfalls

---

### Pitfall 11: WLED "on" State Not Checked Before Brightness Change

**What goes wrong:** Sending a brightness POST to a WLED device that is powered off (`on: false`) sets the brightness but does not turn the device on in most WLED versions. The user turns the dial, sees no light change, assumes the plugin is broken.

**Why it happens:** Developers test with lights already on. The brightness endpoint accepts the value regardless of power state.

**Prevention:**
- For brightness dial actions, optionally include `on: true` in the same POST payload
- Or explicitly document this behavior so users understand it

**Phase:** Phase 2 (dial implementation).

---

### Pitfall 12: Global Settings Overwritten by Race Condition on Startup

**What goes wrong:** Multiple action instances call `getGlobalSettings()` on startup and then `setGlobalSettings()` with their local version. If two actions start simultaneously and both read an empty global settings object, both write their initial state — the second write can overwrite data written by the first.

**Why it happens:** `getGlobalSettings()` fires `onDidReceiveGlobalSettings` asynchronously. Developers don't realize multiple actions can trigger this simultaneously during plugin load.

**Prevention:**
- Use a single global settings manager singleton in the plugin (not per-action reads/writes)
- Implement a "settings loaded" flag and queue all writes until the initial read completes
- Only one code path should ever call `setGlobalSettings()`

**Phase:** Phase 1 (settings architecture).

---

### Pitfall 13: Property Inspector Uses Hardcoded localhost for Dev Server

**What goes wrong:** Stream Deck Property Inspector HTML files are loaded from the plugin bundle (file:// protocol). During development, developers sometimes point the PI to a local dev server for hot-reload. They ship the plugin with the dev server URL still active, which breaks the PI for all users.

**Why it happens:** Convenience during development, forgotten at ship time.

**Prevention:**
- Use a build process that enforces production bundling of PI assets
- Have a pre-publish checklist that includes "verify PI loads from plugin bundle, not localhost"

**Phase:** Final publish phase.

---

### Pitfall 14: WLED Effect Speed Field Name Confusion

**What goes wrong:** WLED uses `sx` for effect speed (segment-level), not a top-level `speed` field. The segment speed is nested under `seg[0].sx`. Developers reading general WLED documentation assume a simpler top-level structure and send the wrong field, seeing no effect.

**Why it happens:** WLED's JSON schema has evolved and documentation examples sometimes show abbreviated or legacy formats.

**Prevention:**
- Test every WLED API call manually with curl or Postman against a real device before coding
- Use `/json/state` GET response to understand the actual response shape
- For segment-level properties (speed, intensity, colors), always address `seg[0]` or broadcast to all segments

**Phase:** Phase 2 (effect speed dial implementation).

---

### Pitfall 15: Stream Deck Software Must Be Restarted to Apply Manifest Changes

**What goes wrong:** During early development, changes to `manifest.json` (adding actions, changing UUIDs, modifying layout) do not take effect until Stream Deck software is fully restarted. Developers assume the plugin auto-reloads and waste time debugging behavior that's actually the old manifest.

**Why it happens:** The JavaScript plugin code hot-reloads in some SDK versions, but the manifest is parsed at startup. This is undocumented or easy to miss.

**Prevention:**
- Any manifest change = full Stream Deck restart
- Add this to development workflow documentation / README from day one

**Phase:** Phase 1 (affects entire development workflow).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Project scaffolding | Manifest UUID format wrong, will break after first publish | Choose reverse-domain UUID prefix before any action code |
| Settings architecture | Per-action controller storage causes unmaintainable config | Global settings for controller registry from day one |
| HTTP client foundation | No request timeout; offline controller hangs plugin | AbortController with 1000ms timeout on every call |
| HTTP client foundation | Concurrent requests overwhelm ESP8266 | Per-controller request queue, concurrency limit 1-2 |
| mDNS discovery | Windows resolution failure for .local hostnames | Pure-JS multicast-dns; store IPs not hostnames |
| Dial implementation | Dial events flood WLED HTTP server | Debounce at 100ms before any HTTP dispatch |
| Dial implementation | Brightness sent to powered-off device shows nothing | Include `on: true` in brightness payload |
| Preset action | Preset IDs are not stable | Store + validate preset name alongside ID |
| Multi-controller dispatch | Promise.all fails silently on partial offline | Always Promise.allSettled() |
| Settings PI | Race condition on global settings startup write | Singleton settings manager, queue writes until read complete |
| Publishing | Icon sizes non-compliant with Elgato requirements | Read submission docs early, plan icon work explicitly |
| Publishing | Dev server URL left in PI bundle | Build process enforces production bundle |

---

## Sources

**Confidence assessment:** All findings are MEDIUM confidence based on:
- Training data knowledge of Stream Deck SDK v2 (Node.js), architecture patterns documented in Elgato's developer docs as of August 2025 knowledge cutoff
- WLED HTTP/JSON API behavior from WLED documentation and community knowledge (kno.wled.ge, WLED GitHub)
- Node.js IoT plugin patterns and ESP8266/ESP32 networking constraints from general embedded networking knowledge
- mDNS/Bonjour Windows behavior from Node.js ecosystem documentation

External verification was not possible in this session (web tools unavailable). The following sources should be verified directly before treating these as HIGH confidence:
- Elgato Stream Deck SDK v2 docs: https://docs.elgato.com/sdk/
- WLED JSON API reference: https://kno.wled.ge/interfaces/json-api/
- WLED GitHub issues for API edge cases: https://github.com/Aircoookie/WLED/issues
- Elgato Marketplace submission requirements: https://docs.elgato.com/sdk/plugins/publishing
