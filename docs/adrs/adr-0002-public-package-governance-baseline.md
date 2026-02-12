# ADR-0002: Public Package Governance Baseline

- Status: Accepted
- Date: 2026-02-12

## Context

`@plasius/voice` is consumed as a public package. To keep package quality consistent across the ecosystem, it should meet the same baseline established by `@plasius/schema`.

## Decision

Adopt schema-level governance requirements for this repository:

- Keep full README banner set for package, build, coverage, and policy visibility.
- Document architecture decisions in ADRs under `docs/adrs`.
- Keep legal and security policy docs maintained as part of normal release updates.
- Publish through GitHub CI/CD with required tests and coverage reporting.

## Consequences

- Positive: External consumers get consistent quality and governance expectations.
- Positive: Package maintenance and audits become more predictable.
- Negative: Slight increase in ongoing documentation and release discipline effort.

## Alternatives Considered

- Governance only in central docs: Rejected because package-level context gets lost.
- Delay governance until next major release: Rejected to avoid shipping with known gaps.
