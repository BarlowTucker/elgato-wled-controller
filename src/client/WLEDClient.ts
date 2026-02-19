import type { WLEDInfo, WLEDState, WLEDPreset } from './types';

function parseHostPort(input: string, defaultPort = 80): { host: string; port: number } {
  const lastColon = input.lastIndexOf(':');
  if (lastColon > -1 && !input.startsWith('[')) {
    const maybePort = parseInt(input.slice(lastColon + 1), 10);
    if (!isNaN(maybePort) && maybePort > 0 && maybePort <= 65535) {
      return { host: input.slice(0, lastColon), port: maybePort };
    }
  }
  return { host: input, port: defaultPort };
}

export class WLEDClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  static fromHostPort(hostPort: string): WLEDClient {
    const { host, port } = parseHostPort(hostPort);
    return new WLEDClient(`http://${host}:${port}`);
  }

  async getInfo(timeoutMs = 1500): Promise<WLEDInfo> {
    const response = await fetch(`${this.baseUrl}/json/info`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`WLED HTTP ${response.status}`);
    return response.json() as Promise<WLEDInfo>;
  }

  async getState(timeoutMs = 1500): Promise<WLEDState> {
    const response = await fetch(`${this.baseUrl}/json/state`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`WLED HTTP ${response.status}`);
    return response.json() as Promise<WLEDState>;
  }

  async setState(patch: Partial<WLEDState>, timeoutMs = 1500): Promise<void> {
    const response = await fetch(`${this.baseUrl}/json/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`WLED HTTP ${response.status}`);
  }

  async isOnline(timeoutMs = 500): Promise<boolean> {
    try {
      await this.getInfo(timeoutMs);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Toggles WLED power using the "t" shorthand — bypasses typed setState because
   * "t" is a string toggle, not a boolean value.
   */
  async togglePower(timeoutMs = 1500): Promise<void> {
    const response = await fetch(`${this.baseUrl}/json/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ on: 't' }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`WLED HTTP ${response.status}`);
  }

  /**
   * Fetches the preset list from /presets.json. Filters out key "0" (system preset),
   * maps to WLEDPreset, and sorts by id ascending.
   */
  async getPresets(timeoutMs = 1500): Promise<WLEDPreset[]> {
    const response = await fetch(`${this.baseUrl}/presets.json`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`WLED HTTP ${response.status}`);
    const raw = await response.json() as Record<string, { n?: string }>;
    return Object.entries(raw)
      .filter(([key]) => !isNaN(Number(key)) && Number(key) > 0)
      .map(([key, val]) => ({
        id: Number(key),
        name: val.n?.trim() || `Preset ${key}`,
      }))
      .sort((a, b) => a.id - b.id);
  }
}
