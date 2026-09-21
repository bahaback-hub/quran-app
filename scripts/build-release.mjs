#!/usr/bin/env node
/**
 * Build a signed Android release (AAB + APK) for the quran-app.
 *
 * The Gradle release signing reads from environment variables (never commit a
 * keystore or its passwords):
 *   - QURANAPP_KEYSTORE   absolute path to the .jks keystore file
 *   - QURANAPP_STORE_PASS keystore password
 *   - QURANAPP_KEY_ALIAS  key alias (e.g. "quranapp")
 *   - QURANAPP_KEY_PASS   key password
 *
 * Without those variables the script warns and exits 0 (so a manual `npm run
 * android:release` on a dev machine without the keystore is harmless). Pass
 * `--ci` to turn that warning into a hard failure.
 *
 * The script sets BUILD_TARGET itself so it works on Windows, macOS, and Linux
 * alike (`npm run android:build` uses a bash-only env prefix).
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isCi = process.argv.includes('--ci');

const REQUIRED_ENV = ['QURANAPP_KEYSTORE', 'QURANAPP_STORE_PASS', 'QURANAPP_KEY_ALIAS', 'QURANAPP_KEY_PASS'];

function missingVars() {
  return REQUIRED_ENV.filter((key) => !process.env[key] || String(process.env[key]).trim() === '');
}

function guidance() {
  return [
    'Android release signing is not configured.',
    `Missing environment variables: ${missingVars().join(', ')}.`,
    '',
    'Generate a keystore once:',
    '  keytool -genkey -v -keystore quranapp-release.jks -alias quranapp \\',
    '    -keyalg RSA -keysize 2048 -validity 10000',
    '',
    'Then cross-platform (PowerShell):',
    '  $env:QURANAPP_KEYSTORE = "C:\\path\\to\\quranapp-release.jks"',
    '  $env:QURANAPP_STORE_PASS = "..."',
    '  $env:QURANAPP_KEY_ALIAS = "quranapp"',
    '  $env:QURANAPP_KEY_PASS = "..."',
    '  npm run android:release',
    '',
  ].join('\n');
}

const missing = missingVars();
if (missing.length > 0) {
  if (isCi) {
    console.error(guidance());
    process.exit(1);
  }
  console.warn(guidance());
  console.warn('Skipping the signed release build (keystore not configured).');
  process.exit(0);
}

const keystore = String(process.env.QURANAPP_KEYSTORE);
if (!existsSync(keystore)) {
  if (isCi) {
    console.error(`QURANAPP_KEYSTORE points at a missing file: ${keystore}`);
    process.exit(1);
  }
  console.warn(`QURANAPP_KEYSTORE points at a missing file: ${keystore} — skipping.`);
  process.exit(0);
}

function run(command, cwd = root) {
  console.log(`\n> ${command}  (in ${cwd})\n`);
  execSync(command, { stdio: 'inherit', cwd });
}

// Enable the Capacitor build path portably (mirrors `android:build`).
process.env.BUILD_TARGET = 'capacitor';
run('npm run build');
run('npx cap sync', root);

const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
run(`${gradle} assembleRelease bundleRelease`, join(root, 'android'));

console.log('\nSigned release artifacts:');
console.log('  android/app/build/outputs/apk/release/app-release.apk');
console.log('  android/app/build/outputs/bundle/release/app-release.aab');
