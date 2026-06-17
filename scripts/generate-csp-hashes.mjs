#!/usr/bin/env node
/**
 * Post-build script: Generate CSP hashes for inline scripts/styles.
 *
 * This script reads the built index.html, extracts all inline <script>
 * and <style> tags, generates SHA-256 hashes, and outputs a CSP header
 * that can replace 'unsafe-inline' with specific hashes.
 *
 * Usage: node scripts/generate-csp-hashes.mjs
 */
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

const DIST_DIR = 'dist';
const HTML_FILE = `${DIST_DIR}/index.html`;

function sha256(content) {
  return 'sha256-' + createHash('sha256').update(content).digest('base64');
}

function generateHashes() {
  console.log('🔐 Generating CSP hashes for inline scripts/styles...');

  const html = readFileSync(HTML_FILE, 'utf-8');

  // Extract inline scripts
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;

  const scriptHashes = [];
  const styleHashes = [];

  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const content = match[1].trim();
    if (content) {
      scriptHashes.push(sha256(content));
    }
  }

  while ((match = styleRegex.exec(html)) !== null) {
    const content = match[1].trim();
    if (content) {
      styleHashes.push(sha256(content));
    }
  }

  console.log(`   Found ${scriptHashes.length} inline scripts, ${styleHashes.length} inline styles`);

  // Generate CSP string
  const scriptSrc = scriptHashes.length > 0
    ? `script-src 'self' ${scriptHashes.map(h => `'${h}'`).join(' ')} blob:;`
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:;";

  const styleSrc = styleHashes.length > 0
    ? `style-src 'self' ${styleHashes.map(h => `'${h}'`).join(' ')};`
    : "style-src 'self' 'unsafe-inline';";

  const csp = `default-src 'self' data: blob:; ${scriptSrc} ${styleSrc} font-src 'self' https://cdn.jsdelivr.net data:; img-src 'self' data: https: blob:; media-src 'self' https: blob: data:; connect-src 'self' https://api.alquran.cloud https://api.quran.com https://cdn.jsdelivr.net https://api.aladhan.com https://server6.mp3quran.net https://server7.mp3quran.net https://server8.mp3quran.net https://server9.mp3quran.net https://server10.mp3quran.net https://server11.mp3quran.net https://server12.mp3quran.net https: blob: data:; frame-src 'none';`;

  // Write the CSP to a file for reference
  const output = {
    generatedAt: new Date().toISOString(),
    scriptHashes,
    styleHashes,
    csp,
  };

  writeFileSync(`${DIST_DIR}/csp-generated.json`, JSON.stringify(output, null, 2));
  console.log('   ✅ CSP hashes generated → dist/csp-generated.json');

  // Also output as HTTP header for _headers file
  const headers = `# Auto-generated CSP with inline hashes\n/*\n  Content-Security-Policy: ${csp}\n`;
  writeFileSync(`${DIST_DIR}/csp-headers.txt`, headers);
  console.log('   ✅ CSP headers → dist/csp-headers.txt');
}

generateHashes();
