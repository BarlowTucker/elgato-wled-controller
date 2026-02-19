import streamDeck, {
  action,
  JsonValue,
  KeyDownEvent,
  PropertyInspectorDidAppearEvent,
  SendToPluginEvent,
  SingletonAction,
} from "@elgato/streamdeck";
import type { ActivatePresetSettings, GlobalSettings } from "../types";
import { sendToControllers } from "../wled-client";

@action({ UUID: "com.barlowtucker.wled.activate-preset" })
export class ActivatePresetAction extends SingletonAction<ActivatePresetSettings> {
  /**
   * Handle button press — activate preset on selected controllers.
   */
  override async onKeyDown(ev: KeyDownEvent<ActivatePresetSettings>): Promise<void> {
    try {
      const { selectedControllers = [], presetId } = ev.payload.settings;

      if (selectedControllers.length === 0) {
        await ev.action.showAlert();
        return;
      }

      const id = Number(presetId);
      if (!Number.isInteger(id) || id < 1 || id > 250) {
        await ev.action.showAlert();
        return;
      }

      const payload = { ps: id, on: true };
      await sendToControllers(selectedControllers, payload);
    } catch (err) {
      console.error("[activate-preset] onKeyDown error:", err);
      await ev.action.showAlert();
    }
  }

  /**
   * Handle messages from Property Inspector — controller add/remove.
   */
  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, ActivatePresetSettings>
  ): Promise<void> {
    try {
      const globals = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
      const controllers = globals.controllers ?? [];

      // Payload arrives as JsonValue — cast to access fields
      const msg = ev.payload as { event?: string; ip?: string; name?: string };

      let updatedList = controllers;

      if (msg.event === "addController" && msg.ip && msg.name) {
        const exists = controllers.some((c) => c.ip === msg.ip);
        if (!exists) {
          updatedList = [...controllers, { ip: msg.ip as string, name: msg.name as string }];
        }
      } else if (msg.event === "removeController" && msg.ip) {
        updatedList = controllers.filter((c) => c.ip !== msg.ip);
      } else {
        return;
      }

      await streamDeck.settings.setGlobalSettings({ controllers: updatedList });

      // Send updated list back to PI
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "controllersUpdated",
        controllers: updatedList,
      });
    } catch (err) {
      console.error("[activate-preset] onSendToPlugin error:", err);
    }
  }

  /**
   * Send current controller list to PI when it opens.
   */
  override async onPropertyInspectorDidAppear(
    ev: PropertyInspectorDidAppearEvent<ActivatePresetSettings>
  ): Promise<void> {
    void ev; // suppress unused parameter warning
    try {
      const globals = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
      const controllers = globals.controllers ?? [];
      await streamDeck.ui.current?.sendToPropertyInspector({
        event: "controllersUpdated",
        controllers,
      });
    } catch (err) {
      console.error("[activate-preset] onPropertyInspectorDidAppear error:", err);
    }
  }
}
