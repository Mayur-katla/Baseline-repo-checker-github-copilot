// Simple in-memory rate limiter middleware (fixed window per IP)
// Disabled when NODE_ENV === 'test' via index.js wiring

function rateLimiter(options = {}) {
  const windowMs = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || options.windowMs || '60000', 10);
  const max = Number.parseInt(process.env.RATE_LIMIT_MAX || options.max || '60', 10);
  const skipPathsEnv = process.env.RATE_LIMIT_SKIP_PATHS || options.skipPaths || '/socket.io,/api/browsers';
  const skipPaths = String(skipPathsEnv)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const buckets = new Map(); // ip -> { count, resetTs }

  return function(req, res, next) {
    try {
      const path = req.path || '';
      if (skipPaths.some(p => path.startsWith(p))) return next();

      const ip = (req.ip || req.connection?.remoteAddress || 'unknown');
      const now = Date.now();
      let entry = buckets.get(ip);
      if (!entry || now >= entry.resetTs) {
        entry = { count: 0, resetTs: now + windowMs };
        buckets.set(ip, entry);
      }

      entry.count += 1;
      const remaining = Math.max(0, max - entry.count);

      // Set helpful headers
      res.set('X-RateLimit-Limit', String(max));
      res.set('X-RateLimit-Remaining', String(remaining));
      res.set('X-RateLimit-Reset', String(entry.resetTs));

      if (entry.count > max) {
        const retryAfterMs = entry.resetTs - now;
        res.set('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
        return res.status(429).json({ error: 'Too many requests' });
      }

      return next();
    } catch (err) {
      // Fail open to avoid blocking traffic on errors
      return next();
    }
  };
}

module.exports = rateLimiter;