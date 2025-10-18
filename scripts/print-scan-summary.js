const fs = require('fs');
const path = require('path');

function findLatestPrettyScan(rootDir) {
  const files = fs.readdirSync(rootDir)
    .filter(f => f.startsWith('scan-') && f.endsWith('.pretty.json'))
    .map(f => ({ f, mtime: fs.statSync(path.join(rootDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return files.length ? path.join(rootDir, files[0].f) : null;
}

function formatTable(headers, rows) {
  const cols = headers.length;
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => (r[i] + '').length)));
  const sep = '+' + widths.map(w => '-'.repeat(w + 2)).join('+') + '+\n';
  const header = '|' + headers.map((h, i) => ' ' + h.padEnd(widths[i]) + ' ').join('|') + '|\n';
  const body = rows.map(r => '|' + r.map((v, i) => ' ' + (v + '').padEnd(widths[i]) + ' ').join('|') + '|\n').join('');
  return sep + header + sep + body + sep;
}

function humanSize(bytes) {
  if (bytes == null) return '';
  const units = ['B','KB','MB','GB'];
  let b = bytes, u = 0;
  while (b >= 1024 && u < units.length - 1) { b /= 1024; u++; }
  return `${b.toFixed(u === 0 ? 0 : 1)} ${units[u]}`;
}

function main() {
  const argPath = process.argv[2];
  const scanPath = argPath ? path.resolve(argPath) : findLatestPrettyScan(process.cwd());
  if (!scanPath || !fs.existsSync(scanPath)) {
    console.error('Scan pretty JSON not found.');
    process.exit(1);
  }
  const buf = fs.readFileSync(scanPath);
  let content;
  // Detect BOM / encoding
  if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
    // UTF-16 LE
    content = buf.toString('utf16le');
  } else if (buf.length >= 2 && buf[0] === 0xFE && buf[1] === 0xFF) {
    // UTF-16 BE
    // Convert to LE by swapping pairs then decode
    const swapped = Buffer.alloc(buf.length - 2);
    for (let i = 2; i < buf.length; i += 2) {
      swapped[i - 2] = buf[i + 1];
      swapped[i - 1] = buf[i];
    }
    content = swapped.toString('utf16le');
  } else {
    // Assume UTF-8
    content = buf.toString('utf8');
  }
  // Strip UTF BOM if present
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  const data = JSON.parse(content);

  // Overview
  const overviewHeaders = ['Key', 'Value'];
  const repo = data.repoDetails || {};
  const overviewRows = [
    ['Scan ID', data.id],
    ['Repo URL', data.repoUrl],
    ['Status', data.status],
    ['Progress', data.progress],
    ['Total Files', repo.totalFiles],
    ['Total LOC', repo.totalLinesOfCode],
    ['Project Size', humanSize(repo.projectSize)],
    ['Created', repo.createdDate],
    ['Last Updated', repo.lastUpdatedDate],
  ];
  console.log('\nScan Overview');
  console.log(formatTable(overviewHeaders, overviewRows));

  // Project features (frameworks)
  const pf = data.projectFeatures || {};
  const frameworksHeaders = ['Category', 'Items'];
  const frameworksRows = Object.entries(pf).map(([k, v]) => [k, (v || []).join(', ')]);
  console.log('Frameworks & Features');
  console.log(formatTable(frameworksHeaders, frameworksRows));

  // Health and maintenance
  const hm = data.healthAndMaintenance || {};
  const hmHeaders = ['Metric', 'Value'];
  const hmRows = [
    ['README', hm.readme ? 'yes' : 'no'],
    ['License', hm.license ? 'yes' : 'no'],
    ['Contributing', hm.contributing ? 'yes' : 'no'],
    ['Comment Density', hm.codeCommentDensity]
  ];
  console.log('Health & Maintenance');
  console.log(formatTable(hmHeaders, hmRows));

  // Modernization suggestions
  const mods = (data.modernizationSuggestions || []);
  const modHeaders = ['ID', 'Severity', 'File', 'Description'];
  const modRows = mods.map(m => [m.id, m.severity, m.file, m.description]);
  console.log('Modernization Suggestions');
  console.log(formatTable(modHeaders, modRows.length ? modRows : [['<none>','-','-','-']]));

  // Detected features aggregation
  const featuresByFile = data.features || data.detectedFeatures || data.featureUsage || {};
  const counts = {};
  for (const feats of Object.values(featuresByFile)) {
    (feats || []).forEach(f => { counts[f] = (counts[f] || 0) + 1; });
  }
  const featHeaders = ['Feature', 'Files Using'];
  const featRows = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  console.log('Detected Features (Aggregated)');
  console.log(formatTable(featHeaders, featRows.length ? featRows : [['<none>',0]]));

  // Per-file feature usage (limited rows for readability)
  const fileFeatHeaders = ['File', 'Features'];
  const fileFeatRows = Object.entries(featuresByFile)
    .map(([file, feats]) => [file, (feats || []).join(', ')])
    .sort((a,b)=>a[0].localeCompare(b[0]));
  const maxRows = 40;
  const trimmedRows = fileFeatRows.length > maxRows ? fileFeatRows.slice(0, maxRows) : fileFeatRows;
  console.log(`Per-File Feature Usage (showing ${trimmedRows.length}/${fileFeatRows.length})`);
  console.log(formatTable(fileFeatHeaders, trimmedRows.length ? trimmedRows : [['<none>','-']]));

  // Browser compatibility (selected features)
  const bc = data.browserCompatibility || {};
  const bcFeatures = Object.keys(bc);
  for (const feat of bcFeatures) {
    const map = bc[feat];
    if (!map) continue;
    const bcHeaders = ['Browser', 'Min Supported Version'];
    const bcRows = Object.entries(map).map(([br, ver]) => [br, ver]);
    console.log(`Browser Compatibility — ${feat}`);
    console.log(formatTable(bcHeaders, bcRows));
  }

  // Performance bottlenecks — large assets
  const sp = data.securityAndPerformance || {};
  const bottlenecks = (sp.performanceBottlenecks || []).find(b => b.type === 'Large Assets');
  const assetHeaders = ['File', 'Size'];
  const assetRows = bottlenecks && bottlenecks.files
    ? bottlenecks.files
        .map(f => [f.file, humanSize(f.size)])
        .sort((a,b)=>{
          const pa = parseFloat(a[1]);
          const pb = parseFloat(b[1]);
          // Assuming sizes are mostly KB/MB; rough numeric sort
          return pb - pa;
        })
        .slice(0, 10)
    : [['<none>', '-']];
  console.log('Performance Bottlenecks — Large Assets (Top 10)');
  console.log(formatTable(assetHeaders, assetRows));
}

main();