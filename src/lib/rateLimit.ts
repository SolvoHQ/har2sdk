// In-memory IP rate limiter. Lives per serverless invocation, so it resets on
// cold start — fine for v1 viral-burst cost protection. Move to Vercel KV in v2
// when we need persistence across function instances.

type Bucket = { count: number; windowStart: number };

const WINDOW_MS = 60 * 60 * 1000;
const LIMIT = 20;
const buckets = new Map<string, Bucket>();

export function rateLimit(ip: string): { ok: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now - b.windowStart >= WINDOW_MS) {
    buckets.set(ip, { count: 1, windowStart: now });
    return { ok: true, remaining: LIMIT - 1, resetIn: WINDOW_MS };
  }
  if (b.count >= LIMIT) {
    return { ok: false, remaining: 0, resetIn: WINDOW_MS - (now - b.windowStart) };
  }
  b.count += 1;
  return { ok: true, remaining: LIMIT - b.count, resetIn: WINDOW_MS - (now - b.windowStart) };
}

export function getClientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  const real = headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}
