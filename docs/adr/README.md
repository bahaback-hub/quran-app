# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for the Quran App.

## What is an ADR?

An ADR is a short text document that captures a single architectural
decision: the context, the decision, the consequences, and the
alternatives that were considered. ADRs are immutable once accepted —
if a decision is reversed, a new ADR is created that supersedes the old
one.

## Index

| Number | Title | Status | Date |
|--------|-------|--------|------|
| [0001](./0001-no-framework-architecture.md) | No-Framework Architecture (Vanilla TypeScript + Custom Proxy) | Accepted | 2026-05-31 |
| [0002](./0002-proxy-state-management.md) | Proxy-Based Reactive State Management | Accepted | 2026-05-31 |
| [0003](./0003-three-phase-bootstrap.md) | Three-Phase Bootstrap | Accepted | 2026-05-31 |
| [0004](./0004-four-tier-data-loading.md) | Four-Tier Data Loading and Offline-First Strategy | Accepted | 2026-06-17 |

## How to Add a New ADR

1. Copy `0000-template.md` (or use the next available number).
2. Name it `NNNN-short-title.md` (e.g., `0005-web-worker-search.md`).
3. Fill in all sections: Context, Decision, Consequences, Alternatives.
4. Add an entry to the table above.
5. Reference related ADRs using relative links.

## ADR Format

Each ADR follows this structure:

- **Status:** Accepted | Proposed | Deprecated | Superseded
- **Date:** Initial date and last review date
- **Context:** Why this decision was needed
- **Decision:** What was decided, with code references
- **Consequences:** Positive, negative, and mitigations
- **Alternatives Considered:** What else was evaluated and why it was rejected
- **References:** Links to source files and related ADRs
