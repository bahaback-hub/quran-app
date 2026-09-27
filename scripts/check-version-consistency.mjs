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
const AI_CATALOG = resolve(ROOT, 'public/.well-known/ai-catalog.json');
const ARD_CATALOG = resolve(ROOT, 'public/.well-known/ard.json');

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

/*
 * The AI discovery manifests repeat the release version so an agent reading
 * them can tell which build it is looking at. A stale version there is worse
 * than no version at all, so it is held to the same lockstep as the other two.
 * ard.json is ARD v0.91's current path and ai-catalog.json its predecessor
 * name; both are served, so they must not diverge either.
 */
let catalog = null;
let catalogText = '';
let ardCatalogText = '';
try {
  catalogText = readFileSync(AI_CATALOG, 'utf8');
  ardCatalogText = readFileSync(ARD_CATALOG, 'utf8');
  catalog = JSON.parse(catalogText);
  JSON.parse(ardCatalogText);
} catch (e) {
  errors.push(`Could not read the AI discovery manifests: ${e.message}`);
}

if (catalog) {
  if (catalog.specVersion !== '1.0') {
    errors.push(
      `public/.well-known/ai-catalog.json: specVersion must be "1.0", found ${JSON.stringify(catalog.specVersion)}.`,
    );
  }
  if (!Array.isArray(catalog.entries) || catalog.entries.length === 0) {
    errors.push('public/.well-known/ai-catalog.json: entries must be a non-empty array.');
  } else {
    const urn = /^urn:air:[a-zA-Z0-9.-]+(:[a-zA-Z0-9._-]+)+$/;
    const stale = [];
    catalog.entries.forEach((entry, i) => {
      if (!urn.test(entry.identifier ?? '')) {
        errors.push(
          `public/.well-known/ai-catalog.json: entries[${i}].identifier "${entry.identifier}" is not a domain-anchored urn:air: URN.`,
        );
      }
      if (entry.version !== pkg.version) {
        stale.push(`entries[${i}].version is ${JSON.stringify(entry.version)}`);
      }
    });
    if (stale.length > 0) {
      errors.push(
        `AI discovery manifest version drift: package.json says "${pkg.version}" but ${stale.join(' and ')}.\n`   +
          `   An agent reading the manifest would report the wrong build. Set version to ${pkg.version} in every entry.`,
      );
    }
  }
  if (ardCatalogText !== '') {
    if (ardCatalogText.trim() !== catalogText.trim()) {
      errors.push(
        'public/.well-known/ard.json and public/.well-known/ai-catalog.json differ.\n' +
          '   Both paths are advertised from index.html, so an agent that reads one must read the same thing.\n' +
          '   Copy the same JSON into both files.',
      );
    }
  }
}

if (errors.length > 0) {
  console.error(`\n❌ [Version] ${errors.length} problem(s) found:`);
  for (const e of errors) {
    console.error(`   ${e}`);
  }
  console.error('\nSet the same x.y.z in package.json and android/app/build.gradle, then re-run.');
  process.exit(1);
}

console.log(`✅ [Version] Passed: in-app label, Android package and AI discovery manifests all report ${pkg.version}.`);
