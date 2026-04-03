# RexScript Remaining Phases Roadmap (Phase 3-5)

Date: 2026-04-03

## Scope

This roadmap covers the remaining implementation phases after parser/semantic/codegen baseline and pre-Phase-3 setup.

## Phase 3: Runtime and Execution Fidelity

### Goal

Move from stub runtime behavior to executable, auditable behavior with stable trace outputs.

### Current Milestone Status

- Runtime browser-adapter coverage is automated via `npm run -s integration:runtime-browser-adapter`.
- `observe`/`navigate` support adapter metadata with optional Playwright path and deterministic fetch fallback.

### Workstreams

1. Runtime primitives with real behavior:
- `observe page`: network fetch, HTML extraction, metadata, confidence scoring.
- `find`: semantic extraction from observed content.
- `navigate`: stateful session history support.
- `parallel`: bounded concurrency with failure isolation and branch attribution.

2. Session and memory hardening:
- Session lifecycle state (`active`, `closed`) and close semantics.
- Memory tags, retrieval thresholds, wildcard clear, capacity guards.

3. Trace fidelity:
- Runtime action traces include action metadata, duration, result summary, session/file IDs.
- Trace envelope validated in integration checks.
- Runtime risk decisions captured at execution time (`ALLOW`/`BLOCK`) with escalation diagnostics.

4. Recovery semantics correctness:
- `retry`, `skip`, `use default`, catch chains behave deterministically in generated JS.

### Deliverables

- Runtime package with non-stub `observe`/`find` behavior.
- Integration tests that execute compiled `.rex` files and validate both planned and runtime traces.
- Source-map structure present for debugger mapping continuity.

### Exit Criteria

- At least 3 representative fixtures execute with runtime behavior (not dry-run only).
- Runtime trace schema passes on every integration run.
- No regression in smoke, snapshot, and check scripts.

## Phase 4: use.instead and Tooling Integration

### Goal

Make `use.instead` reliable and auditable with capability-gated language execution pathways.

### Current Milestone Status

- Phase B integration hardening completed (matrix/policy, confidence bands, trace consistency, blocked-path trace consistency, blocked-path schema validation).
- Verification path is consolidated under `npm run -s integration:phase-b` from `rexscript/compiler`.

### Workstreams

1. Rosetta language detection:
- Deterministic language hinting with confidence bands.
- Ambiguity diagnostics aligned to `ERR005` and `WARN006`.

2. Language executors:
- SQL and regex first (v0.2 target behavior), then Python/Bash/GraphQL/XPath.
- Per-language sandbox contracts and capability tokens.

3. Isolation and policy:
- Dynamic feature isolation checks (`ERR007`) enforced at semantic and runtime boundaries.
- Runtime guardrails for denied capabilities and escalation events.

4. Developer tooling:
- CLI ergonomics: `rex check|compile|run|trace` parity and polished messages.
- Improved map generation and optional trace annotations with source locations.

### Deliverables

- `use.instead` runtime with per-language adapters and risk-aware execution.
- Rosetta confidence integration into compile and runtime diagnostics.
- Expanded integration suite for language-hosting scenarios.

### Exit Criteria

- SQL and regex paths fully operational with trace logging.
- Ambiguous language cases produce expected diagnostics and recovery guidance.
- Dynamic feature policy checks verified by tests.

## Phase 5: Dynamic Feature System and Release Readiness

### Goal

Enable end-to-end dynamic feature lifecycle with approval gates, isolation, and production-facing packaging.

### Current Milestone Status

- Policy-gate stress coverage is automated via `npm run -s integration:phase5-policy-gate-stress`.
- Aggregated Phase 5 hardening path is available via `npm run -s integration:phase5-hardening`.

### Workstreams

1. Dynamic feature lifecycle:
- Pending/approved/trace directory workflow.
- Compile-time and runtime policy checks before execution.

2. Capability and risk governance:
- XRisk risk matrices wired to runtime decisions.
- Deny/allow outcomes reflected in traces and surfaced to CLI.

3. Packaging and distribution:
- Publish-ready structure for compiler/runtime packages.
- Version codename stamping and release metadata.

4. Quality and release gates:
- Regression suite for parser, semantics, codegen, runtime, traces.
- Upgrade docs and migration notes for early adopters.

### Deliverables

- Dynamic feature flow executable from `.rex` source to audited trace artifacts.
- Release candidate CLI behavior and package metadata.
- v0.5-ready implementation baseline (Hunter track).

### Exit Criteria

- Full dynamic feature path is demonstrated with approval simulation and trace persistence.
- Quality bars hold across CI checks for all core scenarios.
- Documentation reflects real implemented behavior, not planned behavior.

## Immediate Implementation Start (This Iteration)

1. Upgrade runtime `observe` from stub to network-backed HTML extraction.
2. Upgrade runtime `find` from stub to semantic match extraction with confidence scoring.
3. Keep API compatibility to avoid compiler/codegen changes.
4. Validate with integration scripts and schema checks.

## Phase D: Developer Experience and Syntax Friendliness

### Goal

Improve authoring ergonomics in editor tooling and make recovery blocks easier to read.

### Current Milestone Status

- VS Code support validation is automated via `npm run -s integration:vscode-support`.
- Grammar scope assertions are automated via `npm run -s integration:vscode-grammar-scopes`.
- Aggregated Phase D validation is available via `npm run -s integration:phase-d`.
- Full regression execution is available with `npm run -s integration:full-validation`.

### Workstreams

1. VS Code language support:
- TextMate grammar for `.rex` files.
- File icon theme mapping for a custom `rs` file logo.
- Command palette hierarchy under a dedicated `RexScript` category.

2. Friendly recovery syntax:
- Prefer `expect { ... } otherwise ...` over `try/catch` in docs and examples.
- Keep parser compatibility for legacy `try/catch` source while migration is in progress.

### Exit Criteria

- `.rex` files highlight reliably in VS Code with custom language activation.
- RexScript commands appear grouped and discoverable in command palette.
- `expect/otherwise` syntax compiles and runs in fixture and integration paths.
