# Non-Functional Requirements (NFR) for Code Generation Tasks

## 1. Purpose

This document defines the non-functional requirements (NFRs) that all generated code must satisfy.

These requirements ensure generated implementations meet standards for:

- security
- privacy
- reliability
- performance
- scalability
- maintainability
- observability
- compliance

These rules apply to:

- AI-generated code
- developer-written code
- generated infrastructure scripts
- automation and CI/CD workflows

Requirements are ordered by user impact, prioritizing privacy and security first.

---

## 2. Priority Levels

| Level | Description |
|------|-------------|
| Critical | Must be satisfied before code can be deployed |
| High | Required for production readiness |
| Medium | Strongly recommended |
| Low | Optional improvements |

---

## 3. Security

**Priority: Critical**

Security failures represent the highest potential harm to users and systems.

### Requirements

Generated code MUST:

- follow protections outlined in OWASP Top 10
- validate all external inputs
- avoid injection vulnerabilities
- enforce authentication and authorization correctly
- use secure defaults
- protect against privilege escalation

### Input Validation

All external input must be validated.

Sources include:

- HTTP parameters
- request bodies
- cookies
- file uploads
- environment variables
- database input
- message queues

Input validation must include:

- type validation
- length limits
- allowed character sets
- schema validation where applicable

### Secrets Management

Secrets MUST NOT appear in:

- source code
- configuration files committed to repositories
- logs
- client responses

Secrets must be obtained from secure providers.

Examples:

- environment variables
- secret managers
- vault systems

### Cryptography

Custom cryptography MUST NOT be implemented.

Approved standards should be used, such as:

- AES-256
- TLS 1.2+
- SHA-256+

### Dependency Security

Dependencies must:

- originate from trusted registries
- be monitored for vulnerabilities
- be updated regularly

Recommended tools:

- Dependabot
- npm audit
- Snyk
- OSV scanners

---

## 4. Privacy & Data Protection

**Priority: Critical**

User privacy must be protected by design.

### Data Minimization

Generated systems should collect only the minimum data necessary to perform their function.

Sensitive information includes:

- personal identifiers
- passwords
- authentication tokens
- financial data
- location data
- biometric information

### Data Protection Rules

Sensitive data MUST:

- never appear in logs
- be encrypted at rest if stored
- be transmitted only over secure channels
- be masked when displayed

### Data Lifecycle

Systems should support:

- deletion of personal data
- anonymization where appropriate
- configurable data retention

### Compliance

Where applicable, systems should support:

- UK GDPR
- GDPR
- CCPA
- SOC2 principles

---

## 5. Reliability, Fault Tolerance & Failure Handling

**Priority: High**

Systems must remain trustworthy under failure conditions.

Generated systems should fail gracefully for users while failing fast internally to prevent cascading system degradation.

### Core Principles

Systems must:

- detect failure quickly
- terminate non-viable work early
- return controlled errors
- prevent cascading retry storms
- avoid indefinite blocking
- shift retry responsibility outward where possible

### Fail Fast

Systems should fail fast when:

- dependencies are unavailable
- required configuration is missing
- request deadlines cannot be met
- validation fails

Fail-fast behavior protects system resources and prevents cascading degradation.

### Fail Gracefully

When failures occur, systems must:

- return bounded error responses
- preserve system stability
- avoid leaking internal details
- provide enough context for callers to decide retry strategy

### Retry Ownership

Retry responsibility should primarily sit with:

- the client application
- the edge/API gateway
- workflow orchestrators
- queue processors

Retrying at every service layer must be avoided.

### Server Retry Rules

Server-side retries should be rare and tightly controlled.

If retries are used:

- retry only transient faults
- cap retry count
- apply backoff with jitter
- stop retries if request deadlines cannot still be met

### Mandatory Controls

Generated code must include:

- explicit timeout values
- cancellation support
- bounded concurrency
- idempotency safeguards
- dependency isolation patterns

### Recommended Patterns

Appropriate patterns include:

- circuit breakers
- bulkheads
- deadline propagation
- rate limiting
- backpressure
- bounded queues

### Anti-Patterns

Generated code must avoid:

- infinite retries
- nested retry loops
- recursive retry behavior
- retry amplification across service chains
- blocking waits for dependency recovery

---

## 6. Performance & Efficiency

**Priority: High**

Generated code must operate efficiently under expected workloads.

### Requirements

Systems should:

- minimize memory allocations
- avoid blocking operations
- minimize repeated expensive calculations
- use caching appropriately

### Example Targets

| Metric | Target |
|------|------|
| Average API response | <200ms |
| p95 latency | <500ms |
| Memory growth | stable over time |

Targets may vary depending on system requirements.

---

## 7. Scalability

**Priority: High**

Generated systems must support growth in user demand.

### Requirements

Systems should support:

- horizontal scaling
- stateless service design
- distributed architectures
- scalable data storage
- caching layers

Avoid:

- global mutable state
- single bottleneck services
- synchronous dependency chains

---

## 8. Maintainability

**Priority: High**

Generated code must remain understandable and maintainable.

### Requirements

Code should:

- follow consistent naming conventions
- be modular and composable
- avoid deep nesting
- separate concerns

Recommended techniques:

- clear module boundaries
- dependency injection
- small focused functions

---

## 9. Testability

**Priority: High**

Generated code must support automated testing.

### Requirements

Code must:

- support unit testing
- isolate business logic from infrastructure
- allow dependency mocking
- avoid hidden side effects

Recommended:

- minimum 80% coverage
- deterministic functions where possible

---

## 10. Observability

**Priority: Medium**

Systems must provide insight into behavior during runtime.

### Logging

Logs should:

- be structured
- avoid sensitive data
- include correlation identifiers
- support distributed tracing

### Metrics

Systems should expose metrics for:

- request rates
- error rates
- latency
- resource utilization

### Tracing

Distributed tracing should allow tracking requests across service boundaries.

---

## 11. Accessibility

**Priority: Medium**

User-facing interfaces should meet accessibility standards.

Recommended standard:

- WCAG 2.1 AA

Practices include:

- keyboard navigation
- semantic HTML
- appropriate color contrast
- screen reader support

---

## 12. Documentation

**Priority: Medium**

Generated code must include documentation sufficient for maintenance.

Documentation should describe:

- purpose of components
- inputs and outputs
- configuration parameters
- operational considerations

---

## 13. Portability

**Priority: Medium**

Code should avoid unnecessary platform coupling.

Prefer:

- environment-based configuration
- container-compatible deployments
- portable tooling

---

## 14. Backwards Compatibility

**Priority: Medium**

Changes should not break existing users unexpectedly.

Strategies include:

- semantic versioning
- API versioning
- feature flags

---

## 15. Compliance & Standards

Generated systems should follow recognized standards where applicable:

- ISO/IEC 25010
- OWASP ASVS
- NIST Secure Software Development Framework
- GDPR / UK GDPR

---

## 16. Acceptance Criteria

Code should not be considered production-ready unless it satisfies:

- all Critical NFRs
- security validation
- privacy requirements
- testability requirements
- failure-handling requirements

---

## 17. Review Checklist

Before merging generated code verify:

- [ ] No secrets in source code
- [ ] Input validation exists
- [ ] Timeouts defined for external calls
- [ ] Failure paths handled correctly
- [ ] Retry behavior bounded
- [ ] Logs avoid sensitive data
- [ ] Code supports testing
- [ ] Dependencies are secure
- [ ] Performance impact reviewed
