# Phase 1: Foundation - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Plugin scaffold with SDK integration, HTTP client for WLED communication, and a global controller registry with mDNS discovery. Users can add/remove WLED controllers by IP and discover them on the network. Actions and Property Inspectors for controlling lights are Phase 2+.

</domain>

<decisions>
## Implementation Decisions

### Controller registration
- User enters IP/hostname (with optional port, e.g., 192.168.1.50:8080 — defaults to port 80)
- Plugin auto-fetches the WLED device name; user can optionally override it with a custom display name
- Save immediately on add — do not validate reachability first; show offline warning indicator if unreachable
- No inline editing — user removes and re-adds to change name or IP
- Removing a controller that's referenced by existing actions is allowed — show a warning note that some actions may reference it and will show errors

### mDNS discovery
- Manual scan only — user clicks a "Scan for devices" button (no auto-scan on panel open)
- Discovered devices appear as a list with checkboxes; user selects devices and clicks "Add Selected" to batch-add
- Already-registered devices appear in scan results but visually marked (greyed out / checkmark) — cannot double-add
- Empty scan result: "No WLED devices found on your network" message with a note pointing to manual add by IP

### Settings layout
- Scan button at the top of the global settings panel
- Controller list below the scan area — simple rows: name, IP, online/offline indicator, remove button
- Manual add form at the bottom (IP field + optional name field + Add button)
- Use standard Elgato Stream Deck Property Inspector CSS — match default SD styling, no custom look
- No inline editing of controllers

### Claude's Discretion
- Connection status polling frequency and mechanism
- Exact timeout values for scan duration
- Online/offline indicator styling (dot, icon, text — within SD PI defaults)
- Error state presentation details
- Internal architecture of ControllerRegistry

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-02-19*
