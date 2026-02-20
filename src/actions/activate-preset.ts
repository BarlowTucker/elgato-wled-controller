import {
  action,
  KeyDownEvent,
  SingletonAction,
} from "@elgato/streamdeck";
import type { ActivatePresetSettings } from "../types";
import { sendToControllers } from "../wled-client";

@action({ UUID: "com.barlowtucker.wled.activate-preset" })
export class ActivatePresetAction extends SingletonAction<ActivatePresetSettings> {
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
      await ev.action.showOk();
    } catch (err) {
      console.error("[activate-preset] onKeyDown error:", err);
      await ev.action.showAlert();
    }
  }
}
