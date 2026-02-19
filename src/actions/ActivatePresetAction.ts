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
interface ActivatePresetSettings extends Record<string, any> {
  controllerIds: string[];
  presetId: number | null;          // simple mode: same preset for all
  advancedMode: boolean;            // whether per-controller mapping is active
  controllerPresets: {              // advanced mode: per-controller preset ID
    [controllerId: string]: number;
  };
}

@action({ UUID: 'com.barloworld.wled.activate-preset' })
export class ActivatePresetAction extends SingletonAction<ActivatePresetSettings> {
  override async onKeyDown(ev: KeyDownEvent<ActivatePresetSettings>): Promise<void> {
    const registry = ControllerRegistry.getInstance();
    const {
      controllerIds = [],
      presetId = null,
      advancedMode = false,
      controllerPresets = {},
    } = ev.payload.settings;

    if (controllerIds.length === 0) {
      await ev.action.showAlert();
      return;
    }

    const controllers = controllerIds
      .map((id) => registry.getById(id))
      .filter((c): c is WLEDController => c !== undefined);

    if (advancedMode) {
      // Fan out: per-controller preset mapping
      const results = await Promise.allSettled(
        controllers
          .filter((c) => controllerPresets[c.id] !== undefined)
          .map((c) => WLEDClient.fromHostPort(c.ip).setState({ ps: controllerPresets[c.id] }))
      );
      const anyFailed = results.some((r) => r.status === 'rejected');
      if (anyFailed) {
        await ev.action.showAlert();
      }
    } else {
      // Simple mode: same preset for all controllers
      if (presetId === null) {
        await ev.action.showAlert();
        return;
      }
      const results = await Promise.allSettled(
        controllers.map((c) => WLEDClient.fromHostPort(c.ip).setState({ ps: presetId }))
      );
      const anyFailed = results.some((r) => r.status === 'rejected');
      if (anyFailed) {
        await ev.action.showAlert();
      }
    }
  }

  override async onPropertyInspectorDidAppear(
    ev: PropertyInspectorDidAppearEvent<ActivatePresetSettings>
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
    ev: SendToPluginEvent<JsonValue, ActivatePresetSettings>
  ): Promise<void> {
    const registry = ControllerRegistry.getInstance();
    const payload = ev.payload as { type: string; [key: string]: unknown };

    if (payload.type === 'ap:saveSettings') {
      const controllerIds = (payload.controllerIds as string[]) || [];
      const presetId = (payload.presetId as number | null) ?? null;
      const advancedMode = Boolean(payload.advancedMode);
      const controllerPresets = (payload.controllerPresets as { [id: string]: number }) || {};
      await ev.action.setSettings({ controllerIds, presetId, advancedMode, controllerPresets });
    } else if (payload.type === 'ap:getControllers') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (streamDeck.ui.sendToPropertyInspector as any)({
        type: 'controllerList',
        controllers: registry.getAll(),
      });
    } else if (payload.type === 'ap:getPresets') {
      const controllerId = String(payload.controllerId || '');
      const controller = registry.getById(controllerId);
      if (!controller) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (streamDeck.ui.sendToPropertyInspector as any)({
          type: 'presetList',
          controllerId,
          presets: [],
          error: 'Controller not found',
        });
        return;
      }
      try {
        const presets = await WLEDClient.fromHostPort(controller.ip).getPresets();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (streamDeck.ui.sendToPropertyInspector as any)({
          type: 'presetList',
          controllerId,
          presets,
        });
      } catch {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (streamDeck.ui.sendToPropertyInspector as any)({
          type: 'presetList',
          controllerId,
          presets: [],
          error: 'Could not fetch presets',
        });
      }
    }
  }
}
