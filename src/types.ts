import type { JsonObject } from "@elgato/utils";

export interface WledController {
  ip: string;
  name: string;
  [key: string]: string; // satisfies JsonObject index signature
}

export interface GlobalSettings extends JsonObject {
  controllers: WledController[];
}

export interface PowerSettings extends JsonObject {
  selectedControllers: string[]; // array of IP addresses
  powerState: "on" | "off" | "toggle";
}

export interface ActivatePresetSettings extends JsonObject {
  selectedControllers: string[]; // array of IP addresses
  presetId: number;
}
