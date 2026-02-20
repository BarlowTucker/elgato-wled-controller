import streamDeck from "@elgato/streamdeck";
import { PowerAction } from "./actions/toggle";
import { ActivatePresetAction } from "./actions/activate-preset";

// Register actions BEFORE connect
streamDeck.actions.registerAction(new PowerAction());
streamDeck.actions.registerAction(new ActivatePresetAction());

streamDeck.connect();
