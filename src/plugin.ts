import streamDeck from "@elgato/streamdeck";
import { ToggleAction } from "./actions/toggle";
import { ActivatePresetAction } from "./actions/activate-preset";

// Register actions BEFORE connect
streamDeck.actions.registerAction(new ToggleAction());
streamDeck.actions.registerAction(new ActivatePresetAction());

streamDeck.connect();
