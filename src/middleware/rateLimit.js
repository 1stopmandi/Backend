/**
 * Simple in-memory sliding-window rate limiter for expensive endpoints.
 * Not suitable for multi-instance production without a shared store.
 */
const buckets = new Map();

function rateLimit({ key, max, windowMs }) {
  return (req, res, next) => {
    const k = key(req);
    const now = Date.now();
    let b = buckets.get(k);
    if (!b || now > b.resetAt) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(k, b);
    }
    b.count += 1;
    if (b.count > max) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests',
        code: 'RATE_LIMITED',
      });
    }
    next();
  };
}

module.exports = { rateLimit };
