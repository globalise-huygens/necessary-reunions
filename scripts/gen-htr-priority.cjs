/**
 * Generate the HTR priority JSON from the Suriname TSV.
 *
 * Keyed by canvas id (the "id" column in the TSV, matching the canvas
 * order in the Suriname manifest). Each entry stores:
 *   - priority: 0-6
 *   - link: handle URL if available, otherwise IIIF manifest URL
 *
 * Usage: node scripts/gen-htr-priority.js
 */

const fs = require('fs');
const path = require('path');

const tsvPath = path.join(
  __dirname,
  '..',
  'Surinaams kaartmateriaal - for HTR_OCR (5).tsv',
);
const outPath = path.join(
  __dirname,
  '..',
  'public',
  'suriname-htr-priority.json',
);

const tsv = fs.readFileSync(tsvPath, 'utf8');
const lines = tsv.split('\n');
const result = {};

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split('\t');
  const id = parseInt(cols[0], 10);
  const prio = parseInt(cols[3], 10);
  if (isNaN(id) || isNaN(prio)) continue;

  const handle = (cols[2] || '').trim();
  const iiifManifest = (cols[21] || '').trim();

  // Prefer handle, fall back to IIIF manifest. Skip placeholder '-'
  let link = null;
  if (handle && handle !== '-') link = handle;
  else if (iiifManifest && iiifManifest !== '-') link = iiifManifest;

  const entry = { priority: prio };
  if (link) entry.link = link;
  result[String(id)] = entry;
}

fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log('Wrote', Object.keys(result).length, 'entries to', outPath);

// Stats
const counts = {};
Object.values(result).forEach((v) => {
  counts[v.priority] = (counts[v.priority] || 0) + 1;
});
console.log('By priority:', JSON.stringify(counts));

// Sample
Object.entries(result)
  .slice(0, 5)
  .forEach(([k, v]) => console.log('  canvas', k, '->', JSON.stringify(v)));
