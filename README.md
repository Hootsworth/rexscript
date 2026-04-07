<div align="center">
  <img src="https://img.shields.io/badge/RexScript-v1.0.0_Stable-00e59b?style=for-the-badge&logo=codeigniter&logoColor=black" alt="RexScript v1.0.0 Stable" />
  <br /><br />
  <h1>RexScript</h1>
  <p><strong>A programming language built for autonomous agents.</strong></p>
  <p>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-teal.svg?style=flat-square" alt="MIT License"></a>
  </p>
</div>

---

> *"Agents don't browse. They hunt."*

RexScript is a domain-specific language for building AI agents that interact with the web, process data, and coordinate multi-step tasks. Instead of wiring together DOM APIs, fetch calls, and error handling boilerplate, you write goal-oriented programs using high-level semantic primitives — and the runtime handles the rest.

The language compiles to JavaScript and runs on a policy-aware runtime that wraps every action in auditable traces, capability checks, and sandboxed execution.

---

## Why RexScript?

Most languages were designed for deterministic inputs. Agents work with the opposite — unreliable pages, rate limits, bot detection, and probabilistic outputs from LLMs. RexScript makes this the default assumption rather than an afterthought.

A few things that set it apart:

**Goal-first control flow.** You define what you want to accomplish. Recovery, retries, and fallbacks are first-class constructs, not try/catch noise scattered throughout your code.

**Native web primitives.** `observe`, `hunt`, `find`, `synthesise` — these aren't library calls wrapped in convenience functions. They're keywords with built-in XRisk policy enforcement, trace logging, and confidence scoring.

**Policy-aware execution.** Every action passes through the XRisk engine before and after it runs. Capabilities (`NETWORK`, `FOREIGN_EXEC`, `MEMORY`, etc.) can be allowlisted at compile time and enforced at runtime, with full trace output for auditing.

**Foreign language bridge.** Need SQL, Python, regex, or GraphQL? Use `use.instead` to drop into any supported runtime without leaving your agent's execution context.

**Edge-ready compiler.** The compiler has no Node.js built-in dependencies, so it can run in Next.js Edge Functions or Cloudflare Workers.

---

## Quick Start

```bash
git clone https://github.com/Hootsworth/rexscript.git
cd rexscript/compiler
npm install
npm run -s rex:run -- ../tests/fixtures/valid/when_use_instead.rex
```

To open the web playground:

```bash
cd packages/playground
npm install && npm start
# Visit http://localhost:3000
```

---

## The Language

### Observe and extract

```rexscript
expect {
  observe page "https://news.ycombinator.com" as $page
  find "top story" in $page as $headline
  synthesise [$page, $headline] as $summary
  emit { action: "done", result: $summary }
} otherwise Timeout {
  flag $page as timed_out
  skip
} otherwise * {
  emit { action: "fallback" }
  skip
}
```

### Confidence-aware branching

```rexscript
observe page "https://example.com/data" as $page

when $page confidence > 0.7 {
  find "price" in $page as $price
  remember $price tagged "latest"
} otherwise {
  rationale "Page confidence too low — skipping extraction"
  skip
}
```

### Parallel fetch with aggregation

```rexscript
parallel limit 3 {
  observe page "https://source-a.com" as $a
  observe page "https://source-b.com" as $b
  observe page "https://source-c.com" as $c
} then synthesise [$a, $b, $c] as $report

emit { summary: $report }
```

### Foreign language execution

```rexscript
expect {
  use.instead:sql as $rows {
    SELECT id, title FROM posts WHERE year > 2023 LIMIT 10
  } catch QueryFailed {
    use default []
  }

  synthesise [$rows] as $summary
} otherwise * {
  skip
}
```

### Budgeted execution

```rexscript
budget max_cost=$0.05, max_tokens=2000, max_time=30s {
  synthesise [$page, $rows] as $summary
}
```

### Structured plans

```rexscript
plan "Research pricing changes" {
  step "Capture source page" {
    observe page "https://example.com/pricing" as $page
  }

  step "Summarise findings" {
    synthesise [$page] as $summary
  }
}
```

### Security isolation

```rexscript
security {
  sandbox "docker"
  lockdown strict
}

use.instead:python as $result {
  result = context.get("n", 0) + 1
}
```

---

## CLI Reference

All commands are run from the `compiler/` directory.

| Command | Description |
| --- | --- |
| `npm run -s rex:check -- <file.rex>` | Type-check and lint a `.rex` file |
| `npm run -s rex:compile -- <file.rex> [out.js]` | Compile to JavaScript |
| `npm run -s rex:run -- <file.rex>` | Compile and execute |
| `npm run -s rex:trace -- <file.rex> [out.json]` | Emit a structured trace plan |
| `npm run -s rex:lint -- <file.rex>` | Strict CI linting (warnings become errors) |

All commands accept an optional mode argument: `default`, `strict`, or `dynamic`.

```bash
npm run -s rex:check -- my_agent.rex strict
npm run -s rex:compile -- my_agent.rex out.js default --map
npm run -s rex:run -- my_agent.rex default --trace-out trace.json
```

---

## Supported `use.instead` Languages

| Language | Executor | Notes |
| --- | --- | --- |
| `sql` | Native | `SELECT`, `FROM`, `WHERE`, `LIMIT` on JSON context |
| `regex` | Native | Full regex matching with group extraction |
| `python` | Native | Sandboxed execution; imports are blocked by default |
| `bash` | Native (opt-in) | Strict allowlist required via `REX_BASH_ALLOWED_COMMANDS` |
| `graphql` | Native | Endpoint allowlist required via `REX_GRAPHQL_ALLOWED_ENDPOINTS` |
| `xpath` | Native | Safe HTML selector subset |
| `json` | Native | Strict parse of raw JSON payloads |
| `yaml` | Native | Audited subset parser |

Omit the language hint to let the Rosetta detector auto-route based on content analysis.

---

## Error and Warning Reference

The compiler emits structured diagnostics with codes, suggestions, and risk levels.

**Errors** (compilation fails):

| Code | Description |
| --- | --- |
| `ERR001` | Unknown keyword or syntax error |
| `ERR002` | Variable used before declaration |
| `ERR003` | Action statement inside an observation-only context |
| `ERR004` | Missing `as $alias` on `observe`, `find`, or `recall` |
| `ERR005` | `use.instead` block is ambiguous (confidence < 0.25) |
| `ERR006` | Blocked at compile time — sensitive pattern or policy violation |
| `ERR007` | Dynamic feature isolation contract violation |
| `ERR008` | `otherwise *` must be the last recovery block |
| `ERR010` | `synthesise` called with an empty input array |
| `ERR011` | Session used after it has been closed |

**Warnings** (compilation succeeds, issues flagged):

| Code | Description |
| --- | --- |
| `WARN001` | `observe` without a failure handler |
| `WARN003` | `use.instead:bash` is high risk |
| `WARN005` | `synthesise` confidence not checked after the call |
| `WARN006` | `use.instead` auto-detected language has low confidence |
| `WARN020` | `use.instead` used without a `security` block |

---

## Runtime Policy

The XRisk engine enforces policies at both compile time and runtime. Capabilities can be restricted via environment variables:

```bash
# Only allow network and memory operations
export REX_ALLOWED_CAPABILITIES=NETWORK,MEMORY

# Restrict which use.instead languages are permitted
export REX_ALLOWED_USE_INSTEAD_LANGS=sql,regex

# Enable bash executor (disabled by default)
export REX_BASH_EXECUTOR_ENABLE=1
export REX_BASH_ALLOWED_COMMANDS=echo,date,pwd

# Write a trace file on execution
export REX_TRACE_OUT=./traces/run.json
```

Blocked actions are recorded in the trace with `xriskDecision: "BLOCK"` and a `policyReason` field, rather than silently dropped.

---

## Tracing

Every execution produces a structured JSON trace containing:

- Action-by-action log with timestamps, durations, and risk levels
- XRisk allow/block decisions with policy reasons
- Source locations tied back to the `.rex` file
- Diagnostic warnings and errors encountered at runtime
- A haiku (for ambiance)

```bash
# Validate a trace file against the schema
node tests/integration/validate-trace-schema.js trace.json
```

---

## Project Structure

```
rexscript/
├── compiler/
│   ├── src/               # Lexer, parser, semantic analyzer, codegen
│   ├── scripts/           # CLI entry points (rex:check, rex:compile, etc.)
│   └── contracts/         # AST schema, diagnostics contract, reserved keywords
├── packages/
│   ├── runtime/           # @rexscript/runtime — observe, find, synthesise, etc.
│   ├── xrisk/             # @rexscript/xrisk — policy engine and trace sink
│   ├── rosetta/           # @rexscript/rosetta — language detection for use.instead
│   └── playground/        # Web-based REPL (Express + WebSocket + Monaco)
├── extensions/
│   └── vscode-rexscript/  # VS Code extension with highlighting, snippets, commands
└── tests/
    ├── fixtures/          # Valid, invalid, and warning test cases
    ├── snapshots/         # Compiled JS snapshots for regression testing
    └── integration/       # End-to-end compile → run → trace checks
```

---

## VS Code Extension

The extension adds syntax highlighting, completions, hover docs, and quick fixes for `.rex` files.

**Install locally:**

```bash
cd extensions/vscode-rexscript
npm i -g @vscode/vsce
vsce package
code --install-extension rexscript-vscode-support-*.vsix
```

**Press F5** inside the extension folder to launch a development host. Live diagnostics are powered by `rex:check --json` and update as you type.

---

## Running Tests

```bash
cd compiler

# Smoke test — parse and analyze all fixtures
npm run -s phase1:smoke

# Snapshot regression — verify codegen output
npm run -s codegen:snapshots

# Full integration suite
npm run -s integration:full-validation
```

---

## Pre-release Checklist

Before shipping an agent built on RexScript:

- [ ] Run `npm run -s rex:lint` — zero failures required
- [ ] Set `REX_ALLOWED_CAPABILITIES` to the minimum required set
- [ ] Set `REX_ALLOWED_USE_INSTEAD_LANGS` if using foreign execution
- [ ] Review trace output for unexpected `BLOCK` decisions or `WARN020` entries
- [ ] Pin your Node.js package versions

---

## License

MIT — see [LICENSE](./extensions/vscode-rexscript/LICENSE).
