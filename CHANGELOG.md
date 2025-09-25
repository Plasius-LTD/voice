# Changelog

All notable changes to this project will be documented in this file.

The format is based on **[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)**, and this project adheres to **[Semantic Versioning](https://semver.org/spec/v2.0.0.html)**.

---

## [Unreleased]

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - add startup watchdog with recognizer recreate to ensure listening flag is set when onstart fails to fire

- **Security**
  - (placeholder)

## [1.0.5] - 2025-09-25

- **Added**
  - Additional state tests

- **Changed**
  - (placeholder)

- **Fixed**
  - Fixed the state.listening flag not being updated correctly to external libraries. 

- **Security**
  - (placeholder)

## [1.0.4] - 2025-09-25

- **Added**
  - VoiceIntents auto-register/unregister mechanism added

- **Changed**
  - README.md update

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.0.0] - 2025-09-24

- **Added**

  - Initial Commit
  - CD pipeline added major, minor and patch flags for the pipeline

- **Changed**

  - (placeholder)

- **Fixed**

  - (placeholder)

- **Security**
  - (placeholder)

---

## Release process (maintainers)

1. Update `CHANGELOG.md` under **Unreleased** with user‑visible changes.
2. Bump version in `package.json` following SemVer (major/minor/patch).
3. Move entries from **Unreleased** to a new version section with the current date.
4. Tag the release in Git (`vX.Y.Z`) and push tags.
5. Publish to npm (via CI/CD or `npm publish`).

> Tip: Use Conventional Commits in PR titles/bodies to make changelog updates easier.

---

[Unreleased]: https://github.com/Plasius-LTD/voice/compare/v1.0.5...HEAD


[1.0.0]: https://github.com/Plasius-LTD/voice/releases/tag/v1.0.0
[1.0.4]: https://github.com/Plasius-LTD/voice/releases/tag/v1.0.4
[1.0.5]: https://github.com/Plasius-LTD/voice/releases/tag/v1.0.5
