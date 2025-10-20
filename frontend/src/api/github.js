const GITHUB_API = 'https://api.github.com';

function getAuthHeaders() {
  const token = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GITHUB_TOKEN) || undefined;
  const headers = { 'Accept': 'application/vnd.github+json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export function parseRepoSlug(repoUrl) {
  try {
    if (!repoUrl) return null;
    const url = new URL(repoUrl);
    if (!/github\.com$/i.test(url.hostname)) return null;
    const parts = url.pathname.replace(/\.git$/, '').split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

async function requestJson(path, { signal } = {}) {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: getAuthHeaders(), signal });
  if (!res.ok) throw new Error(`GitHub API error (${res.status})`);
  return res.json();
}

export async function getRepoOverview(repoUrl, { signal } = {}) {
  const slug = parseRepoSlug(repoUrl);
  if (!slug) return null;
  const info = await requestJson(`/repos/${slug.owner}/${slug.repo}`, { signal });
  let languages = [];
  try {
    const langMap = await requestJson(`/repos/${slug.owner}/${slug.repo}/languages`, { signal });
    const total = Object.values(langMap).reduce((a, b) => a + b, 0) || 0;
    languages = Object.entries(langMap).map(([name, bytes]) => ({
      name,
      percentage: total ? Math.round((bytes / total) * 100) : 0,
    }));
  } catch {
    languages = [];
  }
  const license = info?.license?.name || 'N/A';
  const sizeMB = info?.size ? `${(info.size / 1024).toFixed(1)} MB` : 'N/A';
  return {
    repoName: info?.name || 'N/A',
    description: info?.description || 'No description available.',
    owner: info?.owner?.login || 'N/A',
    license,
    size: sizeMB,
    createdAt: info?.created_at || 'N/A',
    lastUpdated: info?.updated_at || 'N/A',
    languages,
  };
}

export async function getBranches(repoUrl, { signal } = {}) {
  const slug = parseRepoSlug(repoUrl);
  if (!slug) return [];
  const data = await requestJson(`/repos/${slug.owner}/${slug.repo}/branches?per_page=100`, { signal });
  return Array.isArray(data) ? data.map(b => b.name).slice(0, 100) : [];
}

export async function checkRepoAccess(repoUrl, { signal } = {}) {
  const slug = parseRepoSlug(repoUrl);
  if (!slug) return { ok: false, exists: false, private: false };
  try {
    await requestJson(`/repos/${slug.owner}/${slug.repo}`, { signal });
    return { ok: true, exists: true, private: false };
  } catch (e) {
    const m = String(e?.message || '').match(/GitHub API error \((\d+)\)/);
    const status = m ? parseInt(m[1], 10) : 0;
    if (status === 404) return { ok: false, exists: false, private: false };
    if (status === 403) return { ok: false, exists: true, private: true };
    return { ok: false, exists: false, private: false };
  }
}

export async function getRepoStats(repoUrl, { signal } = {}) {
  const slug = parseRepoSlug(repoUrl);
  if (!slug) return null;
  let contributors = 0;
  try {
    const contrib = await requestJson(`/repos/${slug.owner}/${slug.repo}/contributors?per_page=100`, { signal });
    contributors = Array.isArray(contrib) ? contrib.length : 0;
  } catch {}
  let commitFrequency = 'N/A';
  try {
    const activity = await requestJson(`/repos/${slug.owner}/${slug.repo}/stats/commit_activity`, { signal });
    if (Array.isArray(activity) && activity.length) {
      const recent = activity.slice(-4);
      const avg = recent.reduce((sum, week) => sum + (week.total || 0), 0) / Math.max(recent.length, 1);
      commitFrequency = `${Math.round(avg)} commits/week (recent)`;
    }
  } catch {}
  return { contributors, commitFrequency };
}