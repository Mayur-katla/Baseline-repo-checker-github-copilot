const IORedis = require('ioredis');

let redis = null;

function getRedis() {
  if (redis) return redis;
  try {
    const url = process.env.REDIS_URL || '';
    if (url) {
      redis = new IORedis(url, { maxRetriesPerRequest: 1, enableReadyCheck: true });
    } else {
      const host = process.env.REDIS_HOST || '127.0.0.1';
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
