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
      const { selectedControllers = [], powerState = "on" } = ev.payload.settings;

      if (selectedControllers.length === 0) {
        await ev.action.showAlert();
        return;
      }

      const payload = { on: powerState === "toggle" ? "t" : powerState === "on" };
      await sendToControllers(selectedControllers, payload);
      await ev.action.showOk();
    } catch (err) {
      console.error("[power] onKeyDown error:", err);
      await ev.action.showAlert();
    }
  }
}
