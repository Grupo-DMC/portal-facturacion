import "server-only";

/** Limitador en memoria (ventana fija). En producción multi-instancia, mover a Redis/BD. */
interface Bucket { count: number; reset: number }
const g = globalThis as unknown as { __rl?: Map<string, Bucket> };
const buckets = (g.__rl ??= new Map());

export function hit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterS: 0 };
  }
  b.count++;
  return { allowed: b.count <= limit, remaining: Math.max(0, limit - b.count), retryAfterS: Math.ceil((b.reset - now) / 1000) };
}

export const peek = (key: string, limit: number) => {
  const b = buckets.get(key);
  return !b || b.reset < Date.now() || b.count < limit;
};
export const clear = (key: string) => void buckets.delete(key);

// limpieza ocasional para que el Map no crezca
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
}, 60_000).unref?.();
