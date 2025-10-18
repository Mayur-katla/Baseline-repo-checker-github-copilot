const fs = require('fs');
const path = require('path');
const { walkFiles } = require('./repoAnalyzer');

const DEFAULT_EXTS = ['.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.py', '.java', '.go', '.css', '.html'];

function tokenize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t && t.length > 1);
}

function scoreText(text, queryTokens) {
  const tokens = tokenize(text);
  const counts = new Map();
  for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);
  let score = 0;
  for (const q of queryTokens) {
    const c = counts.get(q) || 0;
    score += c;
  }
  return score;
}

function extractSnippet(text, queryTokens, contextLines = 2) {
  const lines = (text || '').split(/\r?\n/);
  const targets = new Set(queryTokens);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toLowerCase();
    for (const q of targets) {
      if (l.includes(q)) {
        const start = Math.max(0, i - contextLines);
        const end = Math.min(lines.length, i + contextLines + 1);
        return {
          startLine: start + 1,
          endLine: end,
          snippet: lines.slice(start, end).join('\n'),
          matchLine: i + 1,
        };
      }
    }
  }
  return null;
}

async function searchFiles(repoPath, query, options = {}) {
  const exts = options.extensions || DEFAULT_EXTS;
  const maxResults = options.maxResults || 10;
  const queryTokens = tokenize(query);
  const files = await walkFiles(repoPath, { extensions: exts });
  const results = [];

  for (const rel of files) {
    const full = path.join(repoPath, rel);
    let content = '';
    try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }
    const score = scoreText(content, queryTokens);
    if (score > 0) {
      const snippet = extractSnippet(content, queryTokens, 2);
      results.push({ file: rel, score, snippet });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults);
}

function searchLogs(logs, query, options = {}) {
  if (!Array.isArray(logs)) return [];
  const maxResults = options.maxResults || 10;
  const queryTokens = tokenize(query);
  const results = [];
  for (let i = 0; i < logs.length; i++) {
    const line = logs[i] || '';
    const score = scoreText(line, queryTokens);
    if (score > 0) {
      results.push({ lineNumber: i + 1, score, line });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults);
}

module.exports = { searchFiles, searchLogs, tokenize };