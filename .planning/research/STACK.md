# Stack Research

**Domain:** Stream Deck Plugin + WLED IoT Control
**Researched:** 2026-02-19
**Confidence:** MEDIUM-HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @elgato/streamdeck | 2.0.1 | Stream Deck SDK v2 — plugin framework | Official SDK; Node.js-based; first-class encoder/dial support; TypeScript decorators for actions |
| @elgato/cli | latest | CLI tooling — scaffold, link, bundle | Official companion; `streamdeck create` generates correct project structure and manifest |
| TypeScript | ~5.x | Type safety | SDK is TypeScript-native; manifest types, action settings types prevent runtime errors |
| Node.js | 20.x | Runtime | Required by Stream Deck SDK v2 (minimum Node.js v20) |
| Rollup | ~4.x | Bundler | SDK scaffold uses Rollup; generates single-file plugin for .sdPlugin/bin/ |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| multicast-dns | latest | mDNS device discovery | Pure JS, no native bindings — critical for Windows compatibility. Use for auto-discovering WLED controllers on LAN |
| node-fetch or built-in fetch | Node 20 built-in | HTTP client for WLED API | Node 20 has global `fetch()` — no extra dependency needed for HTTP JSON API calls |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| @elgato/cli (`streamdeck link`) | Symlink plugin into Stream Deck for live dev | Run once after scaffold; Stream Deck loads plugin from your dev directory |
| @elgato/cli (`streamdeck pack`) | Package .streamDeckPlugin for distribution | Produces installable archive for Marketplace or GitHub release |
| VS Code + Node.js debugger | Debug plugin process | SDK enables debugging by default; attach to plugin's Node.js process |

## Installation

```bash
# Scaffold project (recommended starting point)
npm install -g @elgato/cli
streamdeck create

# Core (installed by scaffold)
npm install @elgato/streamdeck

# mDNS discovery
npm install multicast-dns

# Dev dependencies (installed by scaffold)
npm install -D typescript rollup @rollup/plugin-typescript @rollup/plugin-node-resolve
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| @elgato/streamdeck (SDK v2) | elgato-stream-deck (community) | Only if you need direct USB HID access (custom hardware); not for standard plugin development |
| Built-in fetch (Node 20) | axios, node-fetch | Only if you need interceptors or advanced retry logic beyond what AbortController provides |
| multicast-dns | mdns (native), bonjour-service | `mdns` requires native compilation (breaks on Windows). `bonjour-service` is higher-level but adds weight |
| Rollup | esbuild, webpack | SDK scaffold uses Rollup — switching bundlers adds unnecessary friction |
| TypeScript | JavaScript | SDK types are TypeScript-native; JS loses manifest validation and settings type safety |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `mdns` npm package | Requires native C++ bindings (mDNSResponder); fails to build on Windows without Bonjour SDK installed | `multicast-dns` (pure JS) |
| WebSocket for WLED | Adds connection management complexity; HTTP is sufficient for button-press latency | Built-in `fetch()` to WLED JSON API |
| SDK v1 / Property Inspector WebSocket protocol | Legacy; no dial support; deprecated manifest format | @elgato/streamdeck v2 |
| Express/HTTP server in plugin | Plugin doesn't need to serve — PI communicates via SDK messaging, WLED via outbound HTTP | SDK's built-in PI ↔ plugin messaging |

## Stack Patterns

**For WLED HTTP communication:**
- Use `fetch()` with `AbortController` for timeouts (2-3 second timeout per controller)
- Use `Promise.allSettled()` when sending to multiple controllers (one offline shouldn't block others)
- POST to `/json/state` with JSON body for state changes
- GET from `/json/state` for reading current state

**For dial/encoder debouncing:**
- Implement simple debounce (100ms) on dial rotation events
- WLED controllers (ESP8266/ESP32) can't handle >10-20 req/sec
- Send only the final value after rotation stops

**For mDNS discovery:**
- Query for `_http._tcp.local` services, filter by WLED responses
- Cache discovered devices; don't query on every PI open
- Always allow manual IP/hostname fallback

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| @elgato/streamdeck@2.0.1 | Node.js 20.x | Minimum Node 20 required |
| @elgato/streamdeck@2.0.1 | Stream Deck 6.4+ | Plugin manifest v2 format |
| multicast-dns | Node.js 20.x | Pure JS, no native dependencies |
| Built-in fetch | Node.js 18+ | Global `fetch()` available without imports in Node 20 |

## Sources

- [npm: @elgato/streamdeck](https://www.npmjs.com/package/@elgato/streamdeck) — version 2.0.1 verified, Node 20 requirement confirmed
- [Stream Deck SDK docs](https://docs.elgato.com/streamdeck/sdk/introduction/getting-started/) — project structure, CLI workflow
- [WLED JSON API docs](https://kno.wled.ge/interfaces/json-api/) — endpoint structure, POST/GET patterns
- [GitHub: multicast-dns](https://github.com/mafintosh/multicast-dns) — pure JS mDNS implementation
- [GitHub: elgatosf/streamdeck](https://github.com/elgatosf/streamdeck) — SDK source, action patterns

---
*Stack research for: WLED Stream Deck Plugin*
*Researched: 2026-02-19*
