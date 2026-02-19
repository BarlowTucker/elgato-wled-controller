import streamDeck from '@elgato/streamdeck';
import { ControllerRegistry } from './registry/ControllerRegistry';
import { MDNSScanner } from './discovery/MDNSScanner';
import { WLEDClient } from './client/WLEDClient';
import { TogglePowerAction } from './actions/TogglePowerAction';
import { ActivatePresetAction } from './actions/ActivatePresetAction';

const registry = ControllerRegistry.getInstance();

/**
 * Build and send the current controller list + online status to the Property Inspector.
 */
async function sendControllerList(): Promise<void> {
  const controllers = registry.getAll();

  // Check online status for all controllers in parallel
  const onlineResults = await Promise.allSettled(
    controllers.map(async (c) => {
      const online = await WLEDClient.fromHostPort(c.ip).isOnline();
      return { id: c.id, online };
    })
  );

  const onlineStatus: Record<string, boolean> = {};
  for (const result of onlineResults) {
    if (result.status === 'fulfilled') {
      onlineStatus[result.value.id] = result.value.online;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (streamDeck.ui.sendToPropertyInspector as any)({
    type: 'controllerList',
    controllers,
    onlineStatus,
  });
}

async function main() {
  // Load the controller registry before connecting so all actions have access
  await registry.load();

  // Sync registry when global settings change externally (e.g. from another device)
  streamDeck.settings.onDidReceiveGlobalSettings(async () => {
    await registry.load();
  });

  // Register actions before connecting
  streamDeck.actions.registerAction(new TogglePowerAction());
  streamDeck.actions.registerAction(new ActivatePresetAction());

  // Handle messages from the Property Inspector (global settings panel)
  streamDeck.ui.onSendToPlugin(async (ev) => {
    const payload = ev.payload as { type: string; [key: string]: unknown };

    // Skip namespaced messages (e.g. 'tp:*', 'ap:*') — these are handled by
    // the individual SingletonAction subclass overrides, not this global handler.
    if (payload.type && /^[a-z]+:/.test(payload.type)) {
      return;
    }

    switch (payload.type) {
      case 'getControllers': {
        await sendControllerList();
        break;
      }

      case 'addController': {
        const ip = String(payload.ip || '').trim();
        const name = payload.name ? String(payload.name).trim() : undefined;
        if (ip) {
          await registry.add(ip, name || undefined);
          await sendControllerList();
        }
        break;
      }

      case 'removeController': {
        const id = String(payload.id || '');
        if (id) {
          await registry.remove(id);
          await sendControllerList();
        }
        break;
      }

      case 'scan': {
        const scanner = new MDNSScanner();
        const devices = await scanner.scan(4000);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (streamDeck.ui.sendToPropertyInspector as any)({
          type: 'scanResults',
          devices,
        });
        await streamDeck.ui.sendToPropertyInspector({ type: 'scanComplete' });
        break;
      }

      case 'addDiscovered': {
        const devices = payload.devices as Array<{ ip: string; name?: string }> | undefined;
        if (Array.isArray(devices)) {
          for (const device of devices) {
            const ip = String(device.ip || '').trim();
            if (ip && !registry.has(ip)) {
              await registry.add(ip, device.name || undefined);
            }
          }
          await sendControllerList();
        }
        break;
      }
    }
  });

  await streamDeck.connect();
}

main().catch(console.error);
