# Security Policy

## Supported Versions

| Version | Supported          | Notes                                      |
| ------- | ------------------ | ------------------------------------------ |
| 3.1.x   | :white_check_mark: | Current — full support                     |
| 3.0.x   | :white_check_mark: | Security fixes only                        |
| 2.x     | :white_check_mark: | Security fixes only                        |
| 1.x     | :warning:          | Critical security fixes only               |
| < 1.0   | :x:                | End of life                                |

> **Note**: The current version is defined in `package.json`. This table is
> aligned with the actual release version as of the last update.

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email the maintainer directly or use [GitHub Security Advisories](https://github.com/bahaback-hub/quran-app/security/advisories/new)
3. Include a clear description of the vulnerability and steps to reproduce
4. Allow reasonable time for a fix before public disclosure (90 days standard)

### Response Timeline

| Step | Target |
|------|--------|
| Acknowledgment | ≤ 48 hours |
| Initial assessment | ≤ 7 days |
| Fix or mitigation | ≤ 30 days (critical), 90 days (others) |
| Public disclosure | After fix is released |

## Security Measures

This project implements defense-in-depth security:

### Application Security
- **Content Security Policy (CSP)** — strict CSP with hash-based script allowlist
- **HTML Escaping** — all user-provided text is escaped via `escapeHtml()` before DOM insertion
- **No External Scripts** — no third-party JavaScript loaded from CDNs
- **Strict TypeScript** — `strict: true` with `noImplicitAny`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`
- **No eval()** — no use of `eval()`, `new Function()`, or dynamic code execution
- **Input Validation** — settings import uses allowlist + type validation
- **Safe Storage** — localStorage wrapper with try/catch and JSON validation

### Network Security
- **HTTPS only** — all API endpoints use HTTPS
- **Referrer Policy** — `strict-origin-when-cross-origin`
- **X-Content-Type-Options** — `nosniff`
- **Subresource Integrity** — ready for SRI on external resources

### CI/CD Security
- **CodeQL** — semantic code analysis on every PR
- **OWASP ZAP** — baseline DAST scan weekly + on PRs
- **npm audit** — mandatory; fails build on high/critical vulnerabilities
- **License check** — mandatory; fails build on non-compliant licenses
- **Dependabot** — automated dependency updates
- **Branch protection** — required reviews + status checks on `main`

### Runtime Security
- **Service Worker** — no third-party caching, all runtime caches are domain-scoped
- **No cookies** — app uses localStorage + IndexedDB, no cookies set
- **No tracking** — no analytics, no telemetry, no third-party beacons

## Dependency Audit

Dependencies are regularly checked for vulnerabilities:

```bash
# Run audit locally
npm audit

# Run audit with production dependencies only
npm audit --omit=dev

# Fix automatically fixable vulnerabilities
npm audit fix
```

The CI pipeline runs `npm audit --audit-level=high` on every PR and fails the build if any high or critical vulnerability is found.

### Known dev-only advisories (accepted, re-checked on upgrades)

`npm audit` currently reports **2 low + 18 moderate advisories — all inside dev-only tooling** (`eslint`'s minimatch 3.x chain, `workbox-build`/`madge`/`typedoc` chains; count dropped from 24 to 18 as the toolchain moved to eslint 10 / typescript-eslint 8). None affect the shipped application or end users:

| Advisory | Severity | Location | Why it is accepted |
|----------|----------|----------|--------------------|
| minimatch globparts amplification ([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)) | moderate | eslint 9 → minimatch 3.1.5; jake → filelist → minimatch 5.1.9; estree/typedoc/workbox-build → minimatch 10.2.6 | DoS only reachable via glob patterns on **untrusted input**; lint/doc tooling matches repo-controlled patterns. No fixes shipped for the 3.x/5.x/10.x lines; forcing major versions (`overrides`) risks silently breaking lint and build tooling |
| glob AbortSignal cancellation bypass ([GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)) | moderate | workbox-build → glob 11.1.0 | Post-timeout filesystem traversal requires an abort-with-timeout in build tooling on **our own repo**; glob 14.0.3 (used by `@capacitor/cli` → `rimraf`) is patched |
| deepmerge prototype poisoning ([GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)) | low | workbox-build → deepmerge 4.3.1 | Prototype pollution reachable only with untrusted merge input at **build time**; upstream has no fixed release |

Re-check this table every time `eslint`, `vite-plugin-pwa` (workbox), `madge`, `typedoc`, or `@capacitor/cli` receive major upgrades; drop the table once the feeds show clean. The production dependency set (`npm audit --omit=dev`) is clean.

## Threat Model

### Trusted
- AlQuran.cloud API (Quran text, translations)
- Aladhan API (prayer times)
- mp3quran.net (audio files)
- cdn.islamic.network (CDN)
- jsDelivr CDN (Tafsir API, fonts)

### Untrusted
- User input (search queries, custom adhkar) — escaped via `escapeHtml()`
- API response data — validated before use
- localStorage / IndexedDB — validated on read

## Security Headers

The app sets the following security headers via `public/_headers` (for static hosts) and `index.html` meta tags:

| Header | Value |
|--------|-------|
| Content-Security-Policy | strict, hash-based |
| Referrer-Policy | strict-origin-when-cross-origin |
| X-Content-Type-Options | nosniff |
| Permissions-Policy | restrictive |

## Acknowledgments

We thank security researchers who responsibly disclose vulnerabilities. Contributors will be acknowledged in release notes (unless they prefer to remain anonymous).
