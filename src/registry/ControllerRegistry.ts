import streamDeck from '@elgato/streamdeck';
import { WLEDClient } from '../client/WLEDClient';
import type { WLEDController, RegistryState } from './types';

export class ControllerRegistry {
  private static instance: ControllerRegistry;
  private state: RegistryState = { controllers: [] };

  private constructor() {}

  static getInstance(): ControllerRegistry {
    if (!ControllerRegistry.instance) {
      ControllerRegistry.instance = new ControllerRegistry();
    }
    return ControllerRegistry.instance;
  }

  async load(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const saved = await (streamDeck.settings.getGlobalSettings as any)() as RegistryState | undefined;
    if (saved && saved.controllers) {
      this.state = saved;
    } else {
      this.state = { controllers: [] };
    }
  }

  async add(ip: string, nameOverride?: string): Promise<WLEDController> {
    // Auto-fetch device name via WLEDClient — best-effort, never block on result
    let name = nameOverride || ip;
    try {
      const client = WLEDClient.fromHostPort(ip);
      const info = await client.getInfo(1500);
      if (info.name) {
        name = info.name;
      }
    } catch {
      // Offline or unreachable — use nameOverride or ip as fallback
    }

    const controller: WLEDController = {
      id: crypto.randomUUID(),
      ip,
      name,
      addedAt: Date.now(),
    };

    this.state.controllers.push(controller);
    await this.save();
    return controller;
  }

  async remove(id: string): Promise<void> {
    this.state.controllers = this.state.controllers.filter((c) => c.id !== id);
    await this.save();
  }

  getAll(): WLEDController[] {
    return [...this.state.controllers];
  }

  getById(id: string): WLEDController | undefined {
    return this.state.controllers.find((c) => c.id === id);
  }

  has(ip: string): boolean {
    return this.state.controllers.some((c) => c.ip === ip);
  }

  private async save(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (streamDeck.settings.setGlobalSettings as any)(this.state);
  }
}
