export interface WledController {
  ip: string;
  name: string;
}

export interface GlobalSettings {
  controllers: WledController[];
}

export interface ToggleSettings {
  selectedControllers: string[]; // array of IP addresses
  powerState: "on" | "off";
}

export interface ActivatePresetSettings {
  selectedControllers: string[]; // array of IP addresses
  presetId: number;
}
