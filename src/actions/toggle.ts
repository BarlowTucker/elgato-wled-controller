import {
  action,
  KeyDownEvent,
  SingletonAction,
} from "@elgato/streamdeck";
import type { PowerSettings } from "../types";
import { sendToControllers } from "../wled-client";

@action({ UUID: "com.barlowtucker.wled.toggle" })
export class PowerAction extends SingletonAction<PowerSettings> {
  override async onKeyDown(ev: KeyDownEvent<PowerSettings>): Promise<void> {
    try {
      console.log("[power] onKeyDown settings:", JSON.stringify(ev.payload.settings));
      const { selectedControllers = [], powerState = "on" } = ev.payload.settings;

      if (selectedControllers.length === 0) {
        console.log("[power] no controllers selected, showing alert");
        await ev.action.showAlert();
        return;
      }

      const payload = { on: powerState === "toggle" ? "t" : powerState === "on" };
      console.log("[power] sending to controllers:", selectedControllers, "payload:", payload);
      await sendToControllers(selectedControllers, payload);
      console.log("[power] send complete");
    } catch (err) {
      console.error("[power] onKeyDown error:", err);
      await ev.action.showAlert();
    }
  }
}
