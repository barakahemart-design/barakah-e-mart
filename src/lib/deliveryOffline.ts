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


/**
 * Persist one successfully loaded panel without replacing other panels' last
 * known-good local data. Track successful sections so each device can confirm
 * that its complete delivery snapshot has been primed.
 */
export function writeDeliveryCacheSection<T extends Record<string, any>>(
  key: string,
  section: string,
  value: unknown
): boolean {
  const current = readDeliveryLocal<T & { _deliveryCacheMeta?: any }>(key, {} as T & { _deliveryCacheMeta?: any });
  const now = new Date().toISOString();
  const count = Array.isArray(value) ? value.length : value && typeof value === "object" ? Object.keys(value as object).length : 0;
  const previousMeta = current._deliveryCacheMeta || {};
  return writeDeliveryLocal(key, {
    ...current,
    [section]: value,
    savedAt: now,
    _deliveryCacheMeta: {
      ...previousMeta,
      sections: {
        ...(previousMeta.sections || {}),
        [section]: { savedAt: now, recordCount: count }
      },
      lastSuccessfulLoadAt: now
    }
  });
}

/** Save current React state while preserving per-section cache readiness metadata. */
export function writeDeliveryCacheSnapshot(key: string, snapshot: Record<string, any>): boolean {
  const current = readDeliveryLocal<Record<string, any>>(key, {});
  return writeDeliveryLocal(key, {
    ...snapshot,
    _deliveryCacheMeta: current._deliveryCacheMeta || {},
    savedAt: new Date().toISOString()
  });
}

/** True only after every required section has been successfully fetched and saved locally. */
export function isDeliveryCachePrimed(key: string, requiredSections: string[]): boolean {
  const current = readDeliveryLocal<Record<string, any>>(key, {});
  const sections = current._deliveryCacheMeta?.sections || {};
  return requiredSections.every(section =>
    Object.prototype.hasOwnProperty.call(current, section) &&
    Boolean(sections[section]?.savedAt)
  );
}
