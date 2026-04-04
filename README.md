# RexScript

[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0--stable-brightgreen.svg)]()

> "Because autonomous agents don't browse. They hunt."

**RexScript (v1.0.0 Stable)** is the first programming language designed fundamentally for AI agents. It drops DOM APIs and NodeJS servers, replacing standard JavaScript runtime bounds with **semantic primitives designed natively around LLMs.**
## Table Of Contents

- [What You Get](#what-you-get)
- [Requirements](#requirements)
- [Install](#install)
- [Quick Start](#quick-start)
- [Language Examples](#language-examples)
- [CLI Reference](#cli-reference)
- [Runtime Policy Controls](#runtime-policy-controls)
- [Tracing And Audit Artifacts](#tracing-and-audit-artifacts)
- [Validation Commands](#validation-commands)
- [Production Readiness Checklist](#production-readiness-checklist)
- [Repository Layout](#repository-layout)
- [Troubleshooting](#troubleshooting)

## What You Get

- **Edge Compatibility**: Execute Rex lexing serverlessly natively on Cloudflare Workers and Next.js Edge.
- **VSCode Diagnostics**: Native language server providing static analysis line/column JSON traces.
- **Web Playground**: Sleek React/Vite-styled testing environment connecting through local web sockets.
- **Strict Linting Engine**: `npm run rex:lint` transforms low-confidence validation bindings natively into fatal exit traps.
- **Zero Trust Security Vaults**: Sandbox `docker`/`strict` and `vault("API_KEY")` natively bound securely in memory.
- `use.instead` adapters with confidence, policy, and trace metadata
- Compile-time and runtime trace artifacts suitable for auditing

Core implementation paths:

- `compiler/src/parser.js`
- `compiler/src/semantic.js`
- `compiler/src/codegen.js`
- `packages/runtime/index.js`
- `packages/xrisk/index.js`
- `tests/integration`

## Requirements

- Node.js 20+ (recommended)
- npm 10+
- Optional for some adapters:
  - Python 3 for `use.instead:python`
  - Playwright runtime for browser adapter mode

## Install

```bash
cd rexscript/compiler
npm install
```

## Quick Start

```bash
cd rexscript/compiler

npm run -s rex:check -- ../tests/fixtures/valid/when_use_instead.rex
npm run -s rex:compile -- ../tests/fixtures/valid/when_use_instead.rex ./.rex-run/quickstart.js default --map
npm run -s rex:run -- ../tests/fixtures/valid/when_use_instead.rex default --trace-out ../tests/integration/quickstart.runtime.trace.json
npm run -s rex:trace -- ../tests/fixtures/valid/when_use_instead.rex ../tests/integration/quickstart.plan.trace.json default
```

## Language Examples

### Guarded execution with `expect` / `otherwise`

```rex
expect {
  observe page "https://example.com/data" as $page

  when $page is loaded {
    find "Latest headlines" in $page as $headlines
    synthesise [$page, $headlines] as $summary
  } otherwise {
    flag $page as unavailable
    skip
  }
} otherwise * {
  emit { action: "fallback" }
  skip
}
```

### `use.instead` with fallback behavior

```rex
expect {
  use.instead:sql as $rows {
    SELECT id, title FROM posts LIMIT 5
  } catch QueryFailed {
    use default []
  }

  synthesise [$rows] as $report
} otherwise * {
  emit { action: "fallback" }
  skip
}
```

### Session-oriented navigation flow

```rex
expect {
  session as $s
  observe page "https://example.com" with session $s as $home
  navigate to "https://example.com/docs" with session $s as $docs
  navigate back with session $s
  close session $s
} otherwise * {
  skip
}
```

## CLI Reference

Run from `rexscript/compiler`.

### Core Commands

- `npm run -s rex:check -- <file.rex> [default|strict|dynamic]`
- `npm run -s rex:compile -- <file.rex> [out.js] [default|strict|dynamic] [--map]`
- `npm run -s rex:run -- <file.rex> [default|strict|dynamic] [--dry-run] [--trace-out <file.json>]`
- `npm run -s rex:trace -- <file.rex> [out.json] [default|strict|dynamic]`

### Key Integration Gates

- `npm run -s integration:phase3`
- `npm run -s integration:phase-b`
- `npm run -s integration:phase-d`
- `npm run -s integration:dynamic-feature-lifecycle`
- `npm run -s integration:phase5-policy-gate-stress`
- `npm run -s integration:full-validation`

## Runtime Policy Controls

RexScript runtime behavior is controlled through environment variables.

### Capability and foreign execution

- `REX_ALLOWED_CAPABILITIES`
- `REX_ALLOWED_USE_INSTEAD_LANGS`
- `REX_USE_INSTEAD_STRICT_EXECUTORS`

### Browser adapter behavior

- `REX_RUNTIME_BROWSER_ADAPTER` (`auto`, `playwright`, `fetch`)
- `REX_RUNTIME_BROWSER_ADAPTER_STRICT`
- `REX_RUNTIME_PLAYWRIGHT_DISABLE`

### Bash / GraphQL adapter controls

- `REX_BASH_EXECUTOR_ENABLE`
- `REX_BASH_ALLOWED_COMMANDS`
- `REX_GRAPHQL_ENDPOINT`
- `REX_GRAPHQL_ALLOWED_ENDPOINTS`
- `REX_GRAPHQL_TIMEOUT_MS`

## Tracing And Audit Artifacts

RexScript can generate two trace artifacts:

- Plan trace (compiler-side): deterministic action plan
- Runtime trace (execution-side): real action outcomes, policy decisions, diagnostics

Typical runtime trace fields:

- `traceId`, `sessionId`, `generatedAt`
- `actions[]` with action metadata, risk, policy, duration, location
- `diagnostics` (warnings, errors)

Reference paths:

- `compiler/src/trace-plan.js`
- `tests/integration/trace.schema.json`
- `tests/integration/validate-trace-schema.js`

## Validation Commands

Recommended complete verification:

```bash
cd rexscript/compiler
npm run -s integration:full-validation
```

Expanded explicit chain:

```bash
cd rexscript/compiler
npm run -s phase1:smoke && \
  npm run -s codegen:snapshots && \
  npm run -s integration:phase3 && \
  npm run -s integration:host-js-boundary && \
  npm run -s integration:compiler-policy && \
  npm run -s integration:recovery-sourcemap && \
  npm run -s integration:rosetta-detection && \
  npm run -s integration:phase-b && \
  npm run -s integration:diagnostic-format && \
  npm run -s integration:phase-d && \
  npm run -s integration:dynamic-feature-lifecycle && \
  npm run -s integration:phase5-policy-gate-stress
```

## Production Readiness Checklist

Use this checklist before shipping:

1. Run `integration:full-validation` and ensure zero failures.
2. Verify policy allowlists for your target environment.
3. Persist runtime traces and monitor diagnostics.
4. Lock adapter behavior (`REX_RUNTIME_BROWSER_ADAPTER`) for deterministic runtime behavior.
5. Restrict `use.instead` language surface to required executors only.
6. Pin package versions and enforce reproducible build scripts.
7. Validate dynamic lifecycle gates if using dynamic mode.

## Repository Layout

- `compiler`: lexer/parser/semantic/codegen + CLI scripts
- `packages/runtime`: runtime primitives and `use.instead` adapters
- `packages/xrisk`: runtime policy and trace sink
- `packages/rosetta`: language detection and confidence scoring
- `tests/fixtures`: valid/invalid/warning fixture corpus
- `tests/integration`: integration and regression checks
- `docs`: engineering notes and roadmap docs

## Troubleshooting

### `BrowserAdapterUnavailable`

- Install Playwright dependencies, or set:

```bash
export REX_RUNTIME_BROWSER_ADAPTER=fetch
```

### `ForeignExecutionDenied`

- Review language and capability allowlists:

```bash
export REX_ALLOWED_USE_INSTEAD_LANGS=sql,regex
export REX_ALLOWED_CAPABILITIES=NETWORK,FOREIGN_EXEC,NONE
```

### `MemoryOverflow`

- Ensure memory cleanup where appropriate:

```rex
forget ["*"]
```

---

RexScript is designed for controlled agent execution where auditability, policy compliance, and deterministic runtime behavior are first-class constraints.
