import fs from 'node:fs';
import path from 'node:path';

const METRICS_FILE  = path.join(__dirname, 'metrics.ndjson');
const SUMMARY_FILE  = path.join(__dirname, 'metrics-summary.json');

interface RequestInfo { type: string; status: number; durationMs: number; }
interface Record     { ts: string; step: string; totalMs: number; requests: RequestInfo[]; }

function stats(values: number[]) {
  if (!values.length) return { count: 0, avg: 0, min: 0, max: 0, p50: 0, p95: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const avg = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
  const p = (pct: number) => sorted[Math.floor(sorted.length * pct / 100)] ?? sorted[sorted.length - 1];
  return { count: values.length, avg, min: sorted[0], max: sorted[sorted.length - 1], p50: p(50), p95: p(95) };
}

export default async function globalTeardown() {
  if (!fs.existsSync(METRICS_FILE)) { console.log('[teardown] No hay métricas.'); return; }

  const records: Record[] = fs.readFileSync(METRICS_FILE, 'utf-8')
    .split('\n').filter(Boolean).map(l => JSON.parse(l));

  const byStep: Record<string, Record[]> = {};
  for (const r of records) (byStep[r.step] ??= []).push(r);

  const summary: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    totalRuns: records.length,
    steps: {} as Record<string, unknown>,
  };

  const lines: string[] = [
    '',
    '══════════════════════════════════════════════════════════',
    '  RESUMEN DE MÉTRICAS',
    `  Total corridas: ${records.length}`,
    '══════════════════════════════════════════════════════════',
  ];

  for (const [step, recs] of Object.entries(byStep)) {
    const totalStats = stats(recs.map(r => r.totalMs));

    // Agrupar requests por tipo
    const reqMap: Record<string, number[]> = {};
    for (const r of recs) {
      for (const req of r.requests) {
        (reqMap[req.type] ??= []).push(req.durationMs);
      }
    }
    const requestStats: Record<string, unknown> = {};
    for (const [type, durations] of Object.entries(reqMap)) {
      requestStats[type] = stats(durations);
    }

    (summary.steps as Record<string, unknown>)[step] = { total: totalStats, requests: requestStats };

    lines.push('');
    lines.push(`  ▶ ${step.toUpperCase()} (${recs.length} corridas)`);
    lines.push(`    Total página  → avg: ${totalStats.avg}ms  min: ${totalStats.min}ms  max: ${totalStats.max}ms  p95: ${totalStats.p95}ms`);
    lines.push('    Por request:');
    for (const [type, s] of Object.entries(requestStats) as [string, ReturnType<typeof stats>][]) {
      lines.push(`      ${type.padEnd(24)} avg: ${String(s.avg).padStart(6)}ms  min: ${String(s.min).padStart(6)}ms  max: ${String(s.max).padStart(6)}ms  p95: ${String(s.p95).padStart(6)}ms`);
    }
  }

  lines.push('');
  lines.push('══════════════════════════════════════════════════════════');
  lines.push(`  JSON guardado en: metrics-summary.json`);
  lines.push('══════════════════════════════════════════════════════════');
  lines.push('');

  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2));
  console.log(lines.join('\n'));
}
