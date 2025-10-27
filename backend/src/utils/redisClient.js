const IORedis = require('ioredis');

let redis = null;

function getRedis() {
  if (redis !== null) return redis;
  try {
    const disabled = String(process.env.REDIS_DISABLE || '').toLowerCase() === 'true';
    if (disabled) {
      console.log('[redis] disabled via REDIS_DISABLE');
      redis = null;
      return redis;
    }

    const url = process.env.REDIS_URL || '';
    const host = process.env.REDIS_HOST || '';

    // Only attempt connection when explicitly configured
    if (!url && !host) {
      console.log('[redis] disabled (no REDIS_URL/REDIS_HOST configured)');
      redis = null;
      return redis;
    }

    if (url) {
      redis = new IORedis(url, { maxRetriesPerRequest: 1, enableReadyCheck: true });
    } else {
      const port = Number(process.env.REDIS_PORT || 6379);
      const password = process.env.REDIS_PASSWORD || undefined;
      redis = new IORedis({ host, port, password, maxRetriesPerRequest: 1, enableReadyCheck: true });
    }
    redis.on('error', (err) => {
      console.warn('[redis] error', err?.message || err);
    });
    redis.on('ready', () => {
      console.log('[redis] ready');
    });
  } catch (err) {
    console.warn('[redis] init failed', err?.message || err);
    redis = null;
  }
  return redis;
}

module.exports = { getRedis };
