# ADR-0005: Hosted OIDC Package Publication

- Status: Accepted
- Date: 2026-08-11

## Context

`@plasius/voice` must publish without a long-lived npm write token and without
accepting CI evidence for another source snapshot.

## Decision

Publish only from the GitHub-hosted `production` job using npm trusted
publishing. Prove the prepared SHA is still the exact remote `main` head and
that push-triggered `ci.yml` succeeded for it. Require Node 24 and npm 11.5.1 or
newer, request provenance, and prohibit npm write-token fallbacks. Same-repo PR
CI may use explicit self-hosted runners; fork PR code is denied.

## Consequences

Missing trust configuration, moved `main`, absent CI, unsupported runtime, or
missing OIDC identity fails closed before publication.

## Test implications

Workflow tests enforce source, CI, runtime, identity, runner, and token rules.
