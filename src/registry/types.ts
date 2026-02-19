export interface WLEDController {
  id: string;       // crypto.randomUUID() — stable identifier for action references
  ip: string;       // "192.168.1.50" or "192.168.1.50:8080"
  name: string;     // display name (auto-fetched from WLED or user-supplied)
  addedAt: number;  // Date.now() timestamp for ordering
}

export interface RegistryState {
  controllers: WLEDController[];
}
