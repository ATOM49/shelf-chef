/**
 * Defensive helpers for reading the Instamart MCP tool responses.
 *
 * The Swiggy docs only publish the outer `{ success, data, message }` /
 * `{ success, error }` envelope for each tool — the shape of `data` itself is
 * not documented. Per the docs' own guidance to coding agents ("never invent
 * tool names or parameters"), we don't hardcode a guessed field path. Instead
 * these helpers search the response defensively (by key name, across common
 * nesting shapes) and always leave the raw payload available for display, so
 * the UI degrades to "show the JSON" instead of silently mis-parsing it.
 */

/** Recursively collects every object in `value` that owns at least one of `keyNames` (case-insensitive). */
export function findObjectsWithKey(
  value: unknown,
  keyNames: string[],
  options: { maxResults?: number; maxDepth?: number } = {},
): Record<string, unknown>[] {
  const { maxResults = 30, maxDepth = 6 } = options;
  const lowerKeys = keyNames.map((key) => key.toLowerCase());
  const results: Record<string, unknown>[] = [];

  function walk(node: unknown, remainingDepth: number) {
    if (results.length >= maxResults || remainingDepth < 0 || node == null) return;

    if (Array.isArray(node)) {
      for (const item of node) walk(item, remainingDepth - 1);
      return;
    }

    if (typeof node === "object") {
      const obj = node as Record<string, unknown>;
      const ownKeys = Object.keys(obj);
      if (ownKeys.some((key) => lowerKeys.includes(key.toLowerCase()))) {
        results.push(obj);
      }
      for (const child of Object.values(obj)) walk(child, remainingDepth - 1);
    }
  }

  walk(value, maxDepth);
  return results;
}

/** Returns the first non-empty string (or stringified number) found at `keys` on `obj`. */
export function pickString(
  obj: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!obj) return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

/** Returns the first array found either directly at `value` or under one of `keys`. */
export function pickFirstArray(value: unknown, keys: string[]): unknown[] | undefined {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of keys) {
      const candidate = obj[key];
      if (Array.isArray(candidate)) return candidate;
    }
  }
  return undefined;
}
