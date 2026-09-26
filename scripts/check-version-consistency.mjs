/**
 * Release Version Consistency
 *
 * The project reports its version in two independent places:
 *   - package.json "version"  -> injected as __APP_VERSION__ (vite.config.js)
 *                               and rendered by the settings panel, so it is
 *                               what every user reads inside the app.
 *   - android/app/build.gradle "versionName" -> what Android installs and what
 *                               app stores display.
 *
 * They drifted apart (package.json 3.1.20 vs versionName 3.1.26), so the app
 * told users "3.1.20" while the installed package was 3.1.26. Nothing failed
 * because each file is internally valid.
 *
 * This guard keeps the two in lockstep and validates versionCode, so a release
 * can never ship a package whose own settings screen disagrees with it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const PACKAGE_JSON = resolve(ROOT, 'package.json');
const BUILD_GRADLE = resolve(ROOT, 'android/app/build.gradle');

const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'));
const gradle = readFileSync(BUILD_GRADLE, 'utf8');

const versionName = gradle.match(/versionName\s+["']([^"']+)["']/)?.[1] ?? null;
const versionCode = gradle.match(/versionCode\s+(\d+)/)?.[1] ?? null;

console.log(`[Version] package.json version : ${pkg.version}`);
console.log(`[Version] build.gradle versionName: ${versionName ?? '(not found)'}`);
console.log(`[Version] build.gradle versionCode: ${versionCode ?? '(not found)'}`);

const errors = [];

if (!versionName) {
  errors.push('android/app/build.gradle has no versionName "x.y.z" line.');
} else if (versionName !== pkg.version) {
  errors.push(
    `Version drift: package.json says "${pkg.version}" but build.gradle ships "${versionName}".\n` +
      `   The settings panel would report ${pkg.version} inside a ${versionName} build.\n` +
      `   Bump both to the same value (package.json is the in-app label, build.gradle is the package).`,
  );
}

if (!versionCode) {
  errors.push('android/app/build.gradle has no numeric versionCode line.');
} else if (Number(versionCode) < 1) {
  errors.push(`versionCode must be a positive integer, found ${versionCode}.`);
}

if (errors.length > 0) {
  console.error(`\n❌ [Version] ${errors.length} problem(s) found:`);
  for (const e of errors) {
    console.error(`   ${e}`);
  }
  console.error('\nSet the same x.y.z in package.json and android/app/build.gradle, then re-run.');
  process.exit(1);
}

console.log(`✅ [Version] Passed: in-app label and Android package both report ${pkg.version}.`);
