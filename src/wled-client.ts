/**
 * WLED HTTP client — sends JSON state payloads to WLED controllers.
 */

const IP_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$/;

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
  if (!IP_PATTERN.test(ip)) {
    console.error("[wled-client] Invalid IP address format");
    return false;
  }

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
  } catch {
    console.error("[wled-client] Failed to reach controller");
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send a payload to multiple WLED controllers in parallel.
 * Uses Promise.allSettled so one failure does not block others.
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
      console.error(`[wled-client] Controller ${index + 1} rejected`);
    } else if (result.value === false) {
      console.error(`[wled-client] Controller ${index + 1} failed or timed out`);
    }
  });
}
