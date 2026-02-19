/**
 * WLED HTTP client — sends JSON state payloads to WLED controllers.
 * Uses AbortController for timeout (no built-in fetch timeout in Node 20).
 */

/**
 * Send a payload to a single WLED controller.
 * Returns true on success (HTTP 200 OK), false on any error.
 * Never throws.
 */
export async function sendToController(
  ip: string,
  payload: Record<string, unknown>,
  timeoutMs = 3000
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`http://${ip}/json/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return response.ok;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[wled-client] Failed to reach controller ${ip}: ${message}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send a payload to multiple WLED controllers in parallel.
 * Uses Promise.allSettled so one failure does not block others.
 * Logs each failure but never throws.
 */
export async function sendToControllers(
  ips: string[],
  payload: Record<string, unknown>
): Promise<void> {
  const results = await Promise.allSettled(
    ips.map((ip) => sendToController(ip, payload))
  );

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(
        `[wled-client] Unexpected rejection for controller ${ips[index]}: ${result.reason}`
      );
    } else if (result.value === false) {
      console.error(
        `[wled-client] Controller ${ips[index]} returned failure or timed out`
      );
    }
  });
}
