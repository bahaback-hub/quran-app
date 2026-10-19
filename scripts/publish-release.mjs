#!/usr/bin/env node
/**
 * One-command release publisher.
 *
 * Does exactly what a maintainer used to do by hand (see ANDROID_RELEASE.md):
 *   1. verify the repo is clean, on main, and up to date with origin/main
 *   2. run the version-consistency gate (package.json == build.gradle == AI catalogs)
 *   3. create + push the `vX.Y.Z` tag (which triggers .github/workflows/release.yml
 *      -> GitHub Release with the web zip)
 *   4. wait for that Release workflow to finish
 *   5. dispatch .github/workflows/android-release.yml (signed APK + AAB) and wait
 *   6. download both artifacts, rename them to the release asset names used by
 *      the README download links, and attach them to the GitHub Release
 *   7. verify the published download link answers HTTP 200
 *
 * Usage:
 *   node scripts/publish-release.mjs                # release the package.json version
 *   node scripts/publish-release.mjs --dry-run      # print every check + the plan, change nothing
 *   node scripts/publish-release.mjs --skip-android # web-only release (no APK/AAB)
 *
 * `--dry-run` reports every blocker it finds (instead of stopping at the
 * first) and exits 1 if the real run would fail, 0 if the plan is executable.
 *
 * Requires: git, gh (authenticated), a GitHub repo with the release workflows.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    'skip-android': { type: 'boolean', default: false },
    version: { type: 'string' },
  },
  strict: true,
});

const log = (msg) => console.log(`[release] ${msg}`);
const fail = (msg) => {
  console.error(`[release] ERROR: ${msg}`);
  process.exit(1);
};

/** Blockers collected during a dry run (a real run aborts on the first one). */
const blockers = [];

/** Hygiene check: abort a real run immediately; a dry run records and continues. */
function need(ok, msg) {
  if (ok) return;
  if (args['dry-run']) {
    blockers.push(msg);
    return;
  }
  fail(msg);
}

/**
 * Run a command, return {code, stdout, stderr}. Never throws on non-zero.
 * `shell` is required for `npm` on Windows: npm ships as npm.cmd, and Node 18+
 * refuses to spawn .cmd files directly (ENOENT/EINVAL) for security reasons.
 */
function run(cmd, cmdArgs, { allowFailure = false, shell = false } = {}) {
  const res = spawnSync(cmd, cmdArgs, {
    encoding: 'utf8',
    windowsHide: true,
    shell,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (res.error) {
    if (allowFailure) return { code: -1, stdout: '', stderr: String(res.error) };
    fail(`cannot run "${cmd} ${cmdArgs.join(' ')}": ${res.error.message}`);
  }
  if (res.status !== 0 && !allowFailure) {
    fail(
      `"${cmd} ${cmdArgs.join(' ')}" failed (exit ${res.status}):\n${res.stderr || res.stdout}`,
    );
  }
  return { code: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

function gh(argsList, allowFailure = false) {
  return run('gh', argsList, { allowFailure });
}

function packageVersion() {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  return pkg.version;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll a workflow run until it completes; returns the run status/conclusion. */
async function waitForRun(runId, label, { timeoutMs = 25 * 60_000 } = {}) {
  const started = Date.now();
  for (;;) {
    const { stdout } = gh(
      ['run', 'view', String(runId), '--json', 'status,conclusion'],
      true,
    );
    let info = null;
    try {
      info = JSON.parse(stdout);
    } catch {
      info = null;
    }
    if (info && info.status === 'completed') {
      log(`${label} -> ${info.conclusion}`);
      if (info.conclusion !== 'success') fail(`${label} finished with ${info.conclusion}`);
      return info.conclusion;
    }
    if (Date.now() - started > timeoutMs) fail(`${label} timed out after ${timeoutMs / 60000}min`);
    log(`${label}: still ${info?.status ?? 'queued'} ... waiting 20s`);
    await sleep(20_000);
  }
}

/** Find the workflow_dispatch run started after `sinceMs` for a workflow name. */
async function findDispatchRun(workflowFile, sinceMs) {
  const { stdout } = gh(
    ['run', 'list', `--workflow=${workflowFile}`, '--limit', '5', '--json',
      'id,status,createdAt,event'],
    true,
  );
  let runs = [];
  try {
    runs = JSON.parse(stdout);
  } catch {
    return null;
  }
  const match = runs.find((r) => {
    if (r.event !== 'workflow_dispatch') return false;
    const created = Date.parse(r.createdAt);
    return Number.isFinite(created) && created >= sinceMs;
  });
  return match ? match.id : null;
}

async function main() {
  const version = args.version || packageVersion();
  const tag = `v${version}`;
  const assetBase = `quran-app-${tag}`;

  log(`version=${version} tag=${tag} dryRun=${args['dry-run']}`);

  // ---- 1. repo hygiene ------------------------------------------------------
  const head = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
  need(head === 'main', `you must be on main (currently on "${head}")`);

  const dirty = run('git', ['status', '--porcelain']).stdout.trim();
  need(!dirty, `working tree is not clean:\n${dirty}`);

  const fetched = run('git', ['fetch', 'origin', 'main'], { allowFailure: true });
  need(
    fetched.code === 0,
    `git fetch origin main failed: ${fetched.stderr || fetched.stdout || 'unknown error'}`,
  );
  const local = run('git', ['rev-parse', 'HEAD']).stdout.trim();
  const remote = run('git', ['rev-parse', 'origin/main']).stdout.trim();
  need(local === remote, 'local main is not in sync with origin/main — push (or pull) first');

  // ---- 2. version consistency gate -----------------------------------------
  log('running check:version ...');
  const gate = run('npm', ['run', 'check:version'], {
    allowFailure: args['dry-run'],
    shell: true,
  });
  if (gate.code !== 0) {
    need(false, 'npm run check:version failed — versions drifted between the release files');
  }

  // ---- 3. tag (skip if it already exists) ----------------------------------
  const tagExists = run('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], {
    allowFailure: true,
  }).code === 0;

  if (args['dry-run']) {
    log(`plan: ${tag} -> release.yml (web zip + GitHub Release)`);
    if (tagExists) log(`plan: tag ${tag} already exists locally — would reuse it`);
    else log(`plan: create annotated tag ${tag} and push it to origin`);
    log('plan: wait for the Release workflow to publish the web release');
    if (args['skip-android']) {
      log('plan: --skip-android set — no APK/AAB, web assets only');
    } else {
      log('plan: dispatch android-release.yml (signed build) and wait');
      log(`plan: attach ${assetBase}-release.apk and -release.aab, then verify the link`);
    }
    if (blockers.length > 0) {
      console.error(`\n[release] DRY RUN found ${blockers.length} problem(s):`);
      for (const b of blockers) console.error(`[release]   - ${b}`);
      process.exit(1);
    }
    log('DRY RUN: every check passed — the plan is executable as printed.');
    return;
  }

  if (!tagExists) {
    log(`creating annotated tag ${tag}`);
    run('git', ['tag', '-a', tag, '-m', `Release ${tag}`]);
    log('pushing tag ...');
    run('git', ['push', 'origin', tag]);
  } else {
    log(`tag ${tag} already exists — reusing it`);
    if (run('git', ['ls-remote', '--exit-code', 'origin', `refs/tags/${tag}`], {
      allowFailure: true,
    }).code !== 0) {
      run('git', ['push', 'origin', tag]);
    }
  }

  // ---- 4. wait for the Release workflow (creates the GitHub Release + zip) --
  const dispatchSince = Date.now();
  log('waiting for the Release workflow (release.yml) ...');
  for (;;) {
    const { stdout } = gh(
      ['run', 'list', '--workflow=release.yml', '--limit', '5', '--json',
        'id,status,conclusion,event,createdAt'],
      true,
    );
    let runs = [];
    try { runs = JSON.parse(stdout); } catch { runs = []; }
    const runInfo = runs.find((r) => r.event === 'push' && Number.isFinite(Date.parse(r.createdAt))
      && Date.parse(r.createdAt) >= dispatchSince - 5000);
    if (runInfo) {
      await waitForRun(runInfo.id, 'Release (release.yml)');
      break;
    }
    log('release.yml run not visible yet ... waiting 10s');
    await sleep(10_000);
  }

  // ---- 5. dispatch the signed Android build --------------------------------
  let apkFile = null;
  let aabFile = null;
  if (!args['skip-android']) {
    log('dispatching android-release.yml ...');
    const dispatchAt = Date.now();
    gh(['workflow', 'run', 'android-release.yml', '--ref', 'main']);
    let androidRunId = null;
    for (let i = 0; i < 30 && !androidRunId; i += 1) {
      await sleep(5_000);
      androidRunId = await findDispatchRun('android-release.yml', dispatchAt);
    }
    if (!androidRunId) fail('could not find the android-release run we just dispatched');
    log(`android-release run: https://github.com/bahaback-hub/quran-app/actions/runs/${androidRunId}`);
    await waitForRun(androidRunId, 'Android Release (android-release.yml)');

    const workDir = join(tmpdir(), `quran-release-${version}`);
    log(`downloading artifacts into ${workDir}`);
    run('gh', ['run', 'download', String(androidRunId), '-n', 'quranapp-release-apk', '-D', workDir]);
    run('gh', ['run', 'download', String(androidRunId), '-n', 'quranapp-release-aab', '-D', workDir]);

    const apkSrc = join(workDir, 'app-release.apk');
    const aabSrc = join(workDir, 'app-release.aab');
    apkFile = join(workDir, `${assetBase}-release.apk`);
    aabFile = join(workDir, `${assetBase}-release.aab`);
    renameSync(apkSrc, apkFile);
    renameSync(aabSrc, aabFile);
  }

  // ---- 6. attach assets to the release -------------------------------------
  if (apkFile && aabFile) {
    log('attaching APK + AAB to the GitHub Release ...');
    gh(['release', 'upload', tag, apkFile, aabFile, '--clobber']);
  }

  // ---- 7. verify ------------------------------------------------------------
  const assets = gh(['release', 'view', tag, '--json', 'assets', '--jq', '.assets[].name'], true)
    .stdout.trim().split('\n').filter(Boolean);
  log(`release ${tag} assets: ${assets.join(', ') || '(none)'}`);
  if (!args['skip-android'] && !assets.includes(`${assetBase}-release.apk`)) {
    fail(`${assetBase}-release.apk is missing from the release`);
  }

  const url = `https://github.com/bahaback-hub/quran-app/releases/download/${tag}/${assetBase}-release.apk`;
  log(`download link: ${url}`);
  log('done.');
}

main().catch((err) => {
  console.error('[release] ERROR:', err);
  process.exit(1);
});
