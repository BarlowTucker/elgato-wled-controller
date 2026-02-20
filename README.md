# WLED Control for Stream Deck

Control [WLED](https://kno.wled.ge/) LED controllers directly from your Elgato Stream Deck.

## Actions

### Power
Turn WLED controllers on, off, or toggle their power state with a single button press.

### Activate Preset
Activate a saved WLED preset (1–250) on one or more controllers. Automatically powers on the controller.

## Installation

Install from the [Elgato Marketplace](https://marketplace.elgato.com/) by searching for "WLED Control".

## Setup

1. Drag a **Power** or **Activate Preset** action onto your Stream Deck.
2. In the Property Inspector, click **Manage Controllers** to expand the controller management panel.
3. Enter the IP address and a friendly name for each WLED controller, then click **Add**.
4. Select target controllers using the checkboxes.
5. Configure the action (power state or preset ID).

Controllers are shared across all WLED actions — add them once and they appear everywhere.

## Development

### Prerequisites
- [Node.js](https://nodejs.org/) 20+
- [Stream Deck SDK CLI](https://docs.elgato.com/sdk/plugins/getting-started) (`npm install -g @elgato/cli`)

### Build
```bash
npm install
npm run build
```

### Package for distribution
```bash
npm run pack
```

## License

[MIT](LICENSE)
