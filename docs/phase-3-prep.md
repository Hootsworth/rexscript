# RexScript Phase 3 Preparation

Date: 2026-04-03

## Objective

Prepare the compiler/runtime boundary for Phase 3 by hardening execution semantics, trace fidelity, and packaging.

## What Is Ready

- Parser supports core RexScript constructs, including `when`, `use.instead`, and recovery statements.
- Semantic analyzer covers major ERR/WARN classes with mode-aware checks (`default`, `strict`, `dynamic`).
- Codegen emits runtime calls with XRisk wrappers and parallel/catch scaffolding.
- CLI scripts available: `rex:check`, `rex:compile`, `rex:run`, `rex:trace`.
- Trace scaffolding emits structured JSON with IDs, risk/capability metadata, duration, and haiku fields.
- Local runtime stub packages are linked and executable through compiler scripts.
- Integration pipeline `compile -> run(dry-run) -> trace` is verified.
- Trace schema validator script is in place for CI-style checks.

## Phase 3 Entry Checklist

- [x] Runtime packages scaffolded and linked locally:
  - `@rexscript/runtime`
  - `@rexscript/xrisk`
  - `@rexscript/rosetta`
- [x] `rex run` execution path works against local runtime stubs without module-not-found failures.
- [x] `use.instead` runtime handlers exist as callable stubs (sql/python/bash/json/yaml/regex/graphql/xpath).
- [x] Source map pipeline exported with compile output and validated in at least one debugging scenario.
- [x] Trace schema validated against a stable JSON schema file for CI checks.

## Priority Work Items for Phase 3

1. Runtime stub packages and local linking strategy.
2. Execution-safe recovery semantics (especially `use default`, `retry`, `skip`) in generated code.
3. Structured trace sink with optional file output and redaction hooks.
4. Rosetta detector handoff contract from compiler to runtime.
5. Integration tests: compile -> run -> trace for representative fixtures.

## Risks

- Runtime packages not installed means generated code cannot execute outside dry-run mode.
- Catch/retry semantics are scaffold-level and need full control-flow guarantees.
- Source maps are currently scaffolding and not line-accurate yet.

## Definition of Done for Phase 3 Start

- One end-to-end scenario executes with local runtime stubs and produces a trace JSON file.
- CI runs smoke + snapshots + trace checks on every change.
- Compiler outputs include optional source map files and sourceMappingURL.
