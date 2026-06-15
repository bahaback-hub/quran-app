# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email the maintainer directly or use [GitHub Security Advisories](https://github.com/bahaback-hub/quran-app/security/advisories/new)
3. Include a clear description of the vulnerability and steps to reproduce
4. Allow reasonable time for a fix before public disclosure

## Security Measures

This project implements several security measures:

- **Content Security Policy (CSP)** — strict CSP headers in `index.html` to prevent XSS
- **HTML Escaping** — all user-provided text is escaped via `escapeHtml()` before DOM insertion
- **No External Scripts** — no third-party JavaScript loaded from CDNs
- **Strict TypeScript** — `strict: true` with `noImplicitAny` catches type-related bugs at compile time
- **No eval()** — no use of `eval()`, `new Function()`, or dynamic code execution
- **SRI-ready** — all external resources use trusted CDNs (Google Fonts, jsDelivr)

## Dependencies

Dependencies are regularly checked for vulnerabilities:
```bash
npm audit
```
