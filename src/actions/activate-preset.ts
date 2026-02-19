import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";

@action({ UUID: "com.barlowtucker.wled.activate-preset" })
export class ActivatePresetAction extends SingletonAction {
  override async onKeyDown(_ev: KeyDownEvent): Promise<void> {
    // Implementation in future plan
  }
}
