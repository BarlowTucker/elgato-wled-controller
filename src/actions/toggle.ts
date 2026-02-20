import {
  action,
  KeyDownEvent,
  SingletonAction,
} from "@elgato/streamdeck";
import type { ToggleSettings } from "../types";
import { sendToControllers } from "../wled-client";

@action({ UUID: "com.barlowtucker.wled.toggle" })
export class ToggleAction extends SingletonAction<ToggleSettings> {
  override async onKeyDown(ev: KeyDownEvent<ToggleSettings>): Promise<void> {
    try {
      console.log("[toggle] onKeyDown settings:", JSON.stringify(ev.payload.settings));
      const { selectedControllers = [], powerState = "on" } = ev.payload.settings;

      if (selectedControllers.length === 0) {
        console.log("[toggle] no controllers selected, showing alert");
        await ev.action.showAlert();
        return;
      }

      const payload = { on: powerState === "on" };
      console.log("[toggle] sending to controllers:", selectedControllers, "payload:", payload);
      await sendToControllers(selectedControllers, payload);
      console.log("[toggle] send complete");
    } catch (err) {
      console.error("[toggle] onKeyDown error:", err);
      await ev.action.showAlert();
    }
  }
}
