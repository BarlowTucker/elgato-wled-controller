import streamDeck, {
  action,
  JsonValue,
  KeyDownEvent,
  PropertyInspectorDidAppearEvent,
  SendToPluginEvent,
  SingletonAction,
} from "@elgato/streamdeck";
import type { GlobalSettings, ToggleSettings } from "../types";
import { sendToControllers } from "../wled-client";

@action({ UUID: "com.barlowtucker.wled.toggle" })
export class ToggleAction extends SingletonAction<ToggleSettings> {
  /**
   * Handle button press — send on/off command to selected controllers.
   */
  override async onKeyDown(ev: KeyDownEvent<ToggleSettings>): Promise<void> {
    try {
      const { selectedControllers = [], powerState = "on" } = ev.payload.settings;

      if (selectedControllers.length === 0) {
        await ev.action.showAlert();
        return;
      }

      const payload = { on: powerState === "on" };
      await sendToControllers(selectedControllers, payload);
    } catch (err) {
      console.error("[toggle] onKeyDown error:", err);
      await ev.action.showAlert();
    }
  }

  /**
   * Handle messages from Property Inspector — controller add/remove.
   */
  override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, ToggleSettings>): Promise<void> {
    try {
      const globals = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
      const controllers = globals.controllers ?? [];

      // Payload arrives as JsonValue — cast to access fields
      const msg = ev.payload as { event?: string; ip?: string; name?: string };

      let updatedList = controllers;

      if (msg.event === "addController" && msg.ip && msg.name) {
        // Avoid duplicates by IP
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
      console.error("[toggle] onSendToPlugin error:", err);
    }
  }

  /**
   * Send current controller list to PI when it opens.
   */
  override async onPropertyInspectorDidAppear(
    ev: PropertyInspectorDidAppearEvent<ToggleSettings>
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
      console.error("[toggle] onPropertyInspectorDidAppear error:", err);
    }
  }
}
