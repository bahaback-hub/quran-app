#!/usr/bin/env node
/**
 * Android store-readiness probe — runs against a real, connected device.
 *
 * Produces the evidence a store submission (Xiaomi / Play) asks for and that a
 * CI pipeline cannot: cold-start time, resident memory, crash/ANR traces, and
 * the installed version vs package.json.
 *
 * Usage:
 *   node scripts/device-check.mjs                # first adb device found
 *   node scripts/device-check.mjs --serial X     # a specific device
 *   node scripts/device-check.mjs --json         # machine-readable output
 *
 * Exit code: 0 = store-ready, 1 = a hard failure (no device / not installed /
 * crash found), 2 = warnings only.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { platform } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    serial: { type: 'string' },
    json: { type: 'boolean', default: false },
  },
  strict: true,
});

const PKG = 'com.sulaimani.quranapp';
const LIMITS = {
  coldStartMs: 2500, // store reviewers abandon much slower launches
  totalPssKb: 200 * 1024, // generous for a WebView app with an open surah
};

/** Resolve an adb executable, honouring the common SDK install locations. */
function findAdb() {
  const candidates = [];
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (sdk) {
    candidates.push(
      join(sdk, 'platform-tools', platform() === 'win32' ? 'adb.exe' : 'adb'),
    );
  }
  if (platform() === 'win32' && process.env.LOCALAPPDATA) {
    candidates.push(
      join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
    );
  }
  candidates.push(platform() === 'win32' ? 'adb.exe' : 'adb');
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['version'], { encoding: 'utf8', windowsHide: true });
    if (!probe.error && probe.status === 0) return candidate;
  }
  return null;
}

function adb(adbPath, argv, { allowFailure = false } = {}) {
  const res = spawnSync(adbPath, argv, {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.error) throw new Error(`${argv.join(' ')}: ${res.error.message}`);
  if (res.status !== 0 && !allowFailure) {
    throw new Error(`${argv.join(' ')} failed: ${res.stderr || res.stdout}`);
  }
  return { code: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

/**
 * Older/regional `dumpsys meminfo` builds omit the "TOTAL PSS:" summary line
 * and only print the per-row table whose last line starts with "TOTAL". The
 * first column is always the total PSS in KB; the remaining columns vary by
 * Android version (8 or 10), so only the first is read.
 */
function parseTotalRow(meminfo) {
  const row = (meminfo.match(/^\s*TOTAL\s+([\d\s]+)$/m) || [])[1];
  if (!row) return NaN;
  return Number(row.trim().split(/\s+/)[0]);
}

function main() {
  const report = {
    package: PKG,
    device: null,
    appVersion: null,
    coldStartMs: null,
    totalPssKb: null,
    crashes: [],
    anrs: [],
    batteryLevel: null,
    warnings: [],
    failures: [],
  };

  const adbPath = findAdb();
  if (!adbPath) {
    report.failures.push('adb not found (install Android platform-tools)');
    return finish(report, args.json);
  }

  const devices = adb(adbPath, ['devices']).stdout
    .split('\n').slice(1)
    .map((line) => line.trim())
    .filter((line) => line.endsWith('\tdevice'))
    .map((line) => line.split('\t')[0]);

  const serial = args.serial || devices[0];
  if (!serial) {
    report.failures.push('no authorised device connected (check the USB debugging prompt)');
    return finish(report, args.json);
  }
  const serialArgs = ['-s', serial];

  const model = adb(adbPath, [...serialArgs, 'shell', 'getprop', 'ro.product.model'])
    .stdout.trim();
  const android = adb(adbPath, [...serialArgs, 'shell', 'getprop', 'ro.build.version.release'])
    .stdout.trim();
  report.device = { serial, model, androidVersion: android };

  const dumpsys = adb(adbPath, [...serialArgs, 'shell', 'dumpsys', 'package', PKG], {
    allowFailure: true,
  }).stdout;
  if (!dumpsys.includes('versionName=')) {
    report.failures.push(`${PKG} is not installed on this device`);
    return finish(report, args.json);
  }
  report.appVersion = (dumpsys.match(/versionName=(\S+)/) || [])[1] || null;

  const expected = (() => {
    try {
      return JSON.parse(readFileSync('package.json', 'utf8')).version;
    } catch {
      return null;
    }
  })();
  if (expected && report.appVersion !== expected) {
    report.warnings.push(
      `installed ${report.appVersion} != package.json ${expected} (publish/install the newer build)`,
    );
  }

  // Battery level — context for any "did the test drain it" question.
  const battery = adb(adbPath, [...serialArgs, 'shell', 'dumpsys', 'battery']).stdout;
  report.batteryLevel = Number((battery.match(/level:\s*(\d+)/) || [])[1] ?? null);

  // Crash + ANR traces for our package only.
  const crashLog = adb(adbPath, [
    ...serialArgs, 'logcat', '-d', '-b', 'crash', '-t', '500',
  ], { allowFailure: true }).stdout;
  report.crashes = crashLog.split('\n')
    .filter((line) => line.includes(PKG) && /FATAL|Exception|Error/i.test(line))
    .slice(0, 10);
  if (report.crashes.length) {
    report.failures.push(`${report.crashes.length} crash line(s) in the crash buffer`);
  }

  const mainLog = adb(adbPath, [
    ...serialArgs, 'logcat', '-d', '-t', '800',
  ], { allowFailure: true }).stdout;
  report.anrs = mainLog.split('\n')
    .filter((line) => line.includes(PKG) && /ANR in|Input dispatching timed out/.test(line))
    .slice(0, 5);
  if (report.anrs.length) report.failures.push('ANR traces found for the app');

  // Cold start: force-stop, then measure `am start -W`.
  adb(adbPath, [...serialArgs, 'shell', 'am', 'force-stop', PKG], { allowFailure: true });
  adb(adbPath, [...serialArgs, 'shell', 'am', 'clear-debug-app'], { allowFailure: true });
  const resolve = adb(adbPath, [
    ...serialArgs, 'shell', 'cmd', 'package', 'resolve-activity', '--brief', PKG,
  ], { allowFailure: true }).stdout.trim().split('\n').pop();
  const activity = resolve.includes('/') ? resolve : null;
  if (!activity) {
    report.warnings.push('could not resolve the launcher activity; skipping cold-start timing');
  } else {
    const started = adb(adbPath, [
      ...serialArgs, 'shell', 'am', 'start', '-W', '-n', activity,
    ], { allowFailure: true }).stdout;
    // `am start -W` prints TotalTime on most builds, but some OEM ROMs (seen on
    // Xiaomi / Android 16) only print "WaitTime" with a "LaunchState: UNKNOWN".
    // Both measure the same synchronous launch wait, so accept either.
    const ms = Number((started.match(/(?:Total|Wait)Time:\s*(\d+)/) || [])[1]);
    report.coldStartMs = Number.isFinite(ms) && ms > 0 ? ms : null;
    if (report.coldStartMs === null) {
      report.warnings.push('cold-start timing unavailable (am start -W gave no Total/WaitTime)');
    } else if (report.coldStartMs > LIMITS.coldStartMs) {
      report.warnings.push(
        `cold start ${report.coldStartMs}ms exceeds the ${LIMITS.coldStartMs}ms target`,
      );
    }
  }

  // Resident memory ~3s after the launch above.
  spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},3000)'], { windowsHide: true });
  const meminfo = adb(adbPath, [
    ...serialArgs, 'shell', 'dumpsys', 'meminfo', PKG,
  ], { allowFailure: true }).stdout;
  const pss =
    Number((meminfo.match(/TOTAL\s+PSS:\s*([\d\s]+?)\s*KB/) || [])[1]?.replace(/\s/g, '')) ||
    parseTotalRow(meminfo);
  report.totalPssKb = Number.isFinite(pss) && pss > 0 ? pss : null;
  if (report.totalPssKb === null) {
    report.warnings.push('memory reading unavailable (dumpsys meminfo format not matched)');
  } else if (report.totalPssKb > LIMITS.totalPssKb) {
    report.warnings.push(
      `resident memory ${Math.round(report.totalPssKb / 1024)}MB exceeds the ${Math.round(LIMITS.totalPssKb / 1024)}MB target`,
    );
  }

  // Leave the app closed so we do not disturb the user's session.
  adb(adbPath, [...serialArgs, 'shell', 'am', 'force-stop', PKG], { allowFailure: true });

  return finish(report, args.json);
}

function finish(report, asJson) {
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const line = (k, v) => console.log(`${k.padEnd(16)}${v}`);
    console.log('== Android store-readiness ==');
    line('device', report.device ? `${report.device.model} (Android ${report.device.androidVersion})` : '-');
    line('app version', report.appVersion || '-');
    line('cold start', report.coldStartMs === null ? '-' : `${report.coldStartMs} ms (limit ${LIMITS.coldStartMs})`);
    line('resident memory', report.totalPssKb === null ? '-' : `${Math.round(report.totalPssKb / 1024)} MB (limit ${Math.round(LIMITS.totalPssKb / 1024)})`);
    line('crashes', report.crashes.length || 0);
    line('ANRs', report.anrs.length || 0);
    line('battery', report.batteryLevel === null ? '-' : `${report.batteryLevel}%`);
    for (const warning of report.warnings) console.log(`  warn: ${warning}`);
    for (const failure of report.failures) console.log(`  FAIL: ${failure}`);
    if (report.crashes.length) {
      for (const crash of report.crashes.slice(0, 5)) console.log(`  crash: ${crash.trim()}`);
    }
  }
  if (report.failures.length) process.exit(1);
  if (report.warnings.length) process.exit(2);
  console.log('store-ready: no crashes, no ANRs, inside budget');
  process.exit(0);
}

main();
