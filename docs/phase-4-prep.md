# RexScript Phase 4 Preparation

Date: 2026-04-03

## Objective

Prepare `use.instead` and tooling integration work for structured Phase 4 execution.

## Current Baseline

- Compile-time `use.instead` policy enforcement exists (`ERR006`) for allowlist-denied hints/inference.
- Runtime XRisk policy enforcement blocks denied capabilities and denied foreign languages.
- Runtime executors implemented for:
  - SQL
  - Regex
  - Python (sandboxed prototype)
  - Bash (opt-in with strict allowlist)
  - GraphQL (endpoint-allowlisted adapter)
  - XPath (safe HTML selector subset)
  - JSON (strict native parse)
  - YAML (strict native parse subset)
- Rosetta language detection is wired for auto-routing.

## Phase 4 Readiness Decisions

1. Introduce a runtime support matrix contract for `use.instead`.
2. Distinguish implemented vs planned executors explicitly.
3. Fail fast for explicitly hinted but unsupported executors.
4. Keep auto-detected unsupported languages in passthrough mode unless strict mode is enabled.

## New Runtime Contract (Phase 4 Prep)

- `useInstead(...)` returns executor metadata (`native` or `passthrough`) and support matrix.
- `useInsteadSupport()` exposes implemented/planned language lists for tooling and diagnostics.
- Environment flag:
  - `REX_USE_INSTEAD_STRICT_EXECUTORS=1` forces unsupported auto-detected languages to fail with `ForeignRuntimeMissing`.

## Phase 4 Entry Checklist

- [x] SQL and regex executors are stable and integration-tested.
- [x] Compile-time and runtime policy gates are active.
- [x] Runtime support matrix and unsupported-language contract are documented.
- [x] Integration checks cover executor success, policy denial, and unsupported-language behavior.

## Next Implementation Targets (Phase 4)

1. Extend trace diagnostics with executor-level confidence and policy rationale.
2. Improve CLI output for policy and adapter failures.
3. Add python sandbox hardening tests for timeout, recursion limits, and deterministic resource guards.
4. Add GraphQL adapter allowlist UX improvements (typed policy errors and suggested env configuration).
5. Harden YAML parser coverage or switch to a dedicated parser package with audited subset mode.

Status update: Bash, GraphQL, XPath, JSON, and YAML executor baselines are implemented with explicit policy controls.
