import axios from 'axios';
import { logError } from '../utils/logger.js';

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
const defaultBaseURL = isBrowser ? '/api' : 'http://localhost:3001/api';
const baseURL = (import.meta?.env?.VITE_API_URL) || defaultBaseURL;

const client = axios.create({ baseURL, timeout: 15000 });

client.interceptors.request.use((config) => {
  // Ensure absolute baseURL and JSON headers
  config.headers = Object.assign({ 'Content-Type': 'application/json' }, config.headers || {});
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    // Ignore cancellations/aborts to prevent noisy logs when routes change
    const isCanceled = error?.code === 'ERR_CANCELED' ||
      error?.name === 'CanceledError' ||
      /aborted|canceled/i.test(error?.message || '');
    if (isCanceled) {
      return Promise.reject(error);
    }
    const status = error?.response?.status;
    const serverMsg = error?.response?.data?.error || error?.response?.data?.message;
    const message = serverMsg || (status ? `Request failed (${status})` : error.message || 'Request failed');
    const info = {
      message,
      status,
      url: error?.config?.url,
      method: error?.config?.method,
    };
    const derivedBaseURL = error?.config?.baseURL || (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_URL : undefined);
    // Consistent error logging for HTTP failures
    logError({
      module: 'apiClient',
      location: `${(error?.config?.method || '').toUpperCase()} ${error?.config?.url || ''}`,
      message: message,
      context: { status, baseURL: derivedBaseURL }
    }, error);
    return Promise.reject(Object.assign(error, info));
  }
);

export async function poll(fn, { interval = 2000, timeout = 60000 } = {}) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await fn();
    if (result?.status !== 202) return result;
    if (Date.now() - start > timeout) throw new Error('Polling timed out');
    await new Promise((r) => setTimeout(r, interval));
  }
}

export default client;