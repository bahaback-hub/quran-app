#!/usr/bin/env node
/**
 * ZAP gate — fail the build when any alert at Medium or above is not triaged
 * away in .github/zap-rules.tsv.
 *
 * The zaproxy/action-baseline internal artifact upload is unreliable on
 * GitHub's backend (spurious "artifact name not valid" errors), so instead of
 * relying on its fragile `fail_action`, we parse report_json.json ourselves
 * and enforce the allowlist deterministically.
 *
 * Usage: node .github/scripts/zap-gate.mjs <report_json.json> <zap-rules.tsv>
 * Exit 1 (build fail) when any untriaged FAIL-level alert is present.
 */
import { readFileSync } from 'fs';

const [, , reportPath = 'report_json.json', rulesPath = '.github/zap-rules.tsv'] = process.argv;

const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
const triage = new Map();
for (const line of readFileSync(rulesPath, 'utf-8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) { continue; }
  const [ruleId, action] = trimmed.split('\t');
  if (/^\d+$/.test(ruleId) && action) { triage.set(ruleId, action.toUpperCase()); }
}

const RISK_FROM_CODE = { '3': 'High', '2': 'Medium', '1': 'Low', '0': 'Informational' };

const riskOf = (alert) => {
  const code = alert.riskcode;
  if (code !== undefined && code !== null && code !== '') {
    const mapped = RISK_FROM_CODE[String(code)];
    if (mapped) { return mapped; }
  }
  const desc = String(alert.riskdesc ?? '');
  if (/High/.test(desc)) { return 'High'; }
  if (/Medium/.test(desc)) { return 'Medium'; }
  if (/Low/.test(desc)) { return 'Low'; }
  return 'Informational';
};

const defaultAction = (risk) => {
  if (risk === 'High' || risk === 'Medium') { return 'FAIL'; }
  if (risk === 'Low') { return 'WARN'; }
  return 'IGNORE';
};

const rows = [];
let parsed = 0;
for (const site of report.site ?? []) {
  const alerts = Array.isArray(site.alerts) ? site.alerts : [];
  for (const alert of alerts) {
    rows.push({
      ruleId: String(alert.pluginid),
      alert: alert.alert,
      risk: riskOf(alert),
      count: Number(alert.count ?? 0),
      action: triage.get(String(alert.pluginid)) ?? defaultAction(riskOf(alert)),
    });
    parsed += 1;
  }
}

if (parsed === 0) {
  const hasAny = (report.site ?? []).some((s) => Array.isArray(s.alerts) && s.alerts.length > 0);
  if (hasAny) {
    console.error('🚨 ZAP gate failed: report contains alerts but none could be parsed (schema changed?).');
    process.exit(2);
  }
  console.info('ℹ️  ZAP report contains zero alerts.');
}

const failing = rows.filter((r) => r.action === 'FAIL' && r.count > 0);

for (const r of rows) {
  console.info(`  [${r.action.padEnd(4)}] ${r.ruleId}  ${r.alert}  (${r.count})`);
}

if (failing.length > 0) {
  console.error(`\n🚨 ZAP gate failed: ${failing.length} untriaged Medium+ alert(s):`);
  for (const f of failing) {
    console.error(`   • ${f.ruleId} ${f.alert} (${f.count} instances)`);
  }
  process.exit(1);
}
console.info('\n✅ ZAP gate passed — no untriaged Medium+ alerts.');