import streamDeck from '@elgato/streamdeck';

async function main() {
  // ControllerRegistry.load() will be added here in plan 01-03
  await streamDeck.connect();
}

main().catch(console.error);
