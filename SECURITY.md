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
