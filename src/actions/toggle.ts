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
}
