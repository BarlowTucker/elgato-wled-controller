import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";

@action({ UUID: "com.barlowtucker.wled.toggle" })
export class ToggleAction extends SingletonAction {
  override async onKeyDown(_ev: KeyDownEvent): Promise<void> {
    // Implementation in future plan
  }
}
