import type { WLEDInfo, WLEDState } from './types';

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
}
