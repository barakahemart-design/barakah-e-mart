export type DeliveryOfflineOperation = {
  id: string;
  path: string;
  body: Record<string, any>;
  createdAt: string;
};

export function deliveryStorageKey(kind: "cache" | "queue", scope: string): string {
  const cleanScope = String(scope || "unknown").trim().toLowerCase();
  return `barakah_delivery_${kind}_v1_${encodeURIComponent(cleanScope)}`;
}

export function readDeliveryLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export function writeDeliveryLocal(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn("[Delivery offline] Local storage save failed:", error);
    return false;
  }
}

export function isRetryableDeliveryError(error: any): boolean {
  const status = Number(error?.status || 0);
  if ([408, 425, 429, 500, 502, 503, 504].includes(status) || status >= 500) return true;
  const message = String(error?.message || error || "").toLowerCase();
  return /quota|resource[_ ]exhausted|unavailable|network|failed to fetch|fetch failed|offline|timeout|temporarily unavailable|internal error/.test(message);
}

export function createDeliveryOfflineOperation(path: string, body: Record<string, any>): DeliveryOfflineOperation {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { id: random, path, body, createdAt: new Date().toISOString() };
}
