const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const CACHE_DIR = path.join(__dirname, '..', '..', '.cache');
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getCache(key) {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const cacheFile = path.join(CACHE_DIR, `${key}.json`);
    const data = await fs.readFile(cacheFile, 'utf8');
    const { timestamp, value } = JSON.parse(data);

    if (Date.now() - timestamp > CACHE_TTL) {
      return null;
    }

    return value;
  } catch (error) {
    return null;
  }
}

async function setCache(key, value) {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const cacheFile = path.join(CACHE_DIR, `${key}.json`);
    const data = {
      timestamp: Date.now(),
      value,
    };
    await fs.writeFile(cacheFile, JSON.stringify(data));
  } catch (error) {
    console.error(`Failed to write to cache: ${error.message}`);
  }
}

function generateCacheKey(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

module.exports = { getCache, setCache, generateCacheKey };