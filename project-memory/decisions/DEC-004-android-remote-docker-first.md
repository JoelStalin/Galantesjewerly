# DEC-004 Android Remote-Docker-First Strategy

## ID

- Decision: DEC-004
- Status: accepted
- Date: 2026-03-25

## Context

- Problem: the project had to stay fully dockerized while also targeting Android-oriented operation
- Constraints:
  - Android cannot be treated as a server Linux distro without verification
  - Docker support cannot be invented where official platform support does not exist
  - existing Termux operational context had to stay valid
- Alternatives considered:
  - claim Android native Docker support
  - require on-device Linux VM for every deployment
  - drop Docker entirely in favor of standalone only

## Decision

Keep Docker as the packaging and primary deployment standard, recommend Android as an operator device that controls a remote Linux Docker host, and keep Termux standalone as the explicit fallback when the Android device itself must host the app.

## Consequences

- Positive effects:
  - preserves the Docker requirement honestly
  - avoids unsupported Android assumptions
  - keeps the existing Termux architecture usable
- Tradeoffs:
  - remote-host operation introduces dependency on network access and host management
  - on-device Docker remains conditional on a verified Linux VM
- Operational impact:
  - deployment documentation must always distinguish build packaging from actual runtime host viability

## Evidence

- Validation:
  - Docker stack was verified locally
  - Android deployment matrix documented with official and local operational sources
- Artifact:
  - `project-memory/09-android-deployment-strategy.md`
- Related change log entries:
  - `CHG-013`
  - `CHG-015`

## Sources

- Source: Docker Desktop Linux and VM guidance
  - Consulted on: 2026-03-25
  - Applied conclusion: Docker Desktop targets supported desktop/server operating systems and relies on virtualization support, not Android-native hosting
- Source: Android background and storage docs
  - Consulted on: 2026-03-25
  - Applied conclusion: Android imposes runtime and storage constraints that make server-like process assumptions risky
- Source: Android Virtualization Framework overview
  - Consulted on: 2026-03-25
  - Applied conclusion: on-device virtualization is conditional and hardware-bound, not a blanket Docker-host guarantee
