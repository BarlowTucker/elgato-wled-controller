import streamDeck, { action, SingletonAction } from '@elgato/streamdeck';
import type { JsonValue } from '@elgato/utils';
import type {
  KeyDownEvent,
  PropertyInspectorDidAppearEvent,
  SendToPluginEvent,
} from '@elgato/streamdeck';
import { ControllerRegistry } from '../registry/ControllerRegistry';
import { WLEDClient } from '../client/WLEDClient';
import type { WLEDController } from '../registry/types';

// Index signature required to satisfy JsonObject constraint (same pattern as global settings)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface TogglePowerSettings extends Record<string, any> {
  controllerIds: string[];
}

@action({ UUID: 'com.barloworld.wled.toggle-power' })
export class TogglePowerAction extends SingletonAction<TogglePowerSettings> {
  override async onKeyDown(ev: KeyDownEvent<TogglePowerSettings>): Promise<void> {
    const registry = ControllerRegistry.getInstance();
    const { controllerIds = [] } = ev.payload.settings;

    if (controllerIds.length === 0) {
      await ev.action.showAlert();
      return;
    }

    const controllers = controllerIds
      .map((id) => registry.getById(id))
      .filter((c): c is WLEDController => c !== undefined);

    const results = await Promise.allSettled(
      controllers.map((c) => WLEDClient.fromHostPort(c.ip).togglePower())
    );

    const anyFailed = results.some((r) => r.status === 'rejected');
    if (anyFailed) {
      await ev.action.showAlert();
    }
  }

  override async onPropertyInspectorDidAppear(
    ev: PropertyInspectorDidAppearEvent<TogglePowerSettings>
  ): Promise<void> {
    const registry = ControllerRegistry.getInstance();
    // PropertyInspectorDidAppearEvent has no payload — fetch settings via action
    const settings = await ev.action.getSettings();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (streamDeck.ui.sendToPropertyInspector as any)({
      type: 'init',
      controllers: registry.getAll(),
      settings,
    });
  }

  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, TogglePowerSettings>
  ): Promise<void> {
    const registry = ControllerRegistry.getInstance();
    const payload = ev.payload as { type: string; [key: string]: unknown };

    if (payload.type === 'tp:saveSettings') {
      const controllerIds = (payload.controllerIds as string[]) || [];
      await ev.action.setSettings({ controllerIds });
    } else if (payload.type === 'tp:getControllers') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (streamDeck.ui.sendToPropertyInspector as any)({
        type: 'controllerList',
        controllers: registry.getAll(),
      });
    }
  }
}
