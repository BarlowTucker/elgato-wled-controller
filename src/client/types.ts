export interface WLEDInfo {
  ver: string;       // firmware version
  name: string;      // device friendly name
  udpport: number;
  live: boolean;
  fxcount: number;
  palcount: number;
  mac?: string;      // MAC address
  arch?: string;     // CPU architecture
  core?: string;     // Arduino core version
  lwip?: number;     // lwip version
  maxleds?: number;  // max LED count
  brand?: string;    // brand string
  product?: string;  // product name
}

export interface WLEDSegment {
  id: number;
  start: number;
  stop: number;
  len: number;
  col: number[][];   // colors [[r,g,b], ...]
  fx: number;        // effect index
  sx: number;        // effect speed
  ix: number;        // effect intensity
  pal: number;       // palette index
  on: boolean;
  bri: number;
}

export interface WLEDState {
  on: boolean;       // power on/off
  bri: number;       // brightness 0-255
  ps: number;        // current preset (-1 for none)
  pl: number;        // current playlist
  nl: {
    on: boolean;
    dur: number;
    mode: number;
    tbri: number;
    rem: number;
  };
  udpn: {
    send: boolean;
    recv: boolean;
  };
  lor: number;
  mainseg: number;
  seg?: WLEDSegment[];
}

export interface WLEDPreset {
  id: number;    // preset id (numeric key from /presets.json, > 0)
  name: string;  // preset display name
}
