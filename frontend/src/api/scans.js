import client from './client.js';

export async function applyScanChanges(scanId, changes) {
  if (!scanId) throw new Error('Missing scanId');
  const res = await client.post(`/scans/${scanId}/apply`, { changes });
  return res.data;
}