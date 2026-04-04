<div align="center">
  <img src="https://img.shields.io/badge/RexScript-v1.0.0_Stable-00e59b?style=for-the-badge&logo=codeigniter&logoColor=black" alt="RexScript v1.0.0 Stable" />
  <h1>The Programming Language for Autonomous Agents</h1>
  <p>
    <strong>Deterministic semantics • Policy-aware runtime • Edge-native execution</strong>
  </p>
  <p>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-teal.svg?style=flat-square" alt="License: MIT"></a>
    <a href="#quick-start"><img src="https://img.shields.io/badge/Getting_Started-Build_an_Agent-blue?style=flat-square" alt="Getting Started"></a>
  </p>
</div>

<br />

> **“Because autonomous agents don't browse. They hunt.”**

**RexScript** strips away the DOM APIs and server-side bloat of traditional JavaScript, replacing them with mathematically deterministic **semantic primitives designed natively around Large Language Models (LLMs)**. It operates in heavy-tail probabilistic environments (the internet) securely and reliably.

## 🌟 Why RexScript?

Traditional languages were built for deterministic inputs. Agents operate on probabilistic inputs. RexScript bridges this gap by enforcing risk boundaries, sandbox executions, and trace-logging strictly at compile time.

- **Zero-Trust Execution (`security`)**: Natively define isolation perimeters (e.g., `sandbox "docker" lockdown strict`).
- **Probabilistic Error Handling (`attempt / recover`)**: Elegantly handle non-deterministic LLM failures natively without thousands of try-catch blocks.
- **Edge-Ready Pipeline (`compileString`)**: The compiler is totally abstracted from NodeJS built-ins. Lex and parse your agents securely in Next.js Serverless Edge or Cloudflare Workers.
- **Native Data Vaults (`vault()`)**: Hardcode secret aliases directly in code. RexScript physically injects them into process memory dynamically via the `__xrisk` engine—keeping API keys entirely out of telemetry traces.
- **Strict Linting Engine (`rex:lint`)**: Forces all probabilistic warnings (`Code: WARNXXX`) into exit-code `2` failures, mathematically securing your codebase across GitHub Actions and CI platforms.

---

## ⚡ Quick Start

```bash
# Clone the repository
git clone https://github.com/Hootsworth/rexscript.git
cd rexscript

# Install dependencies (Node.js 20+ Recommended)
cd compiler && npm install
npm run -s rex:compile -- ../tests/fixtures/valid/when_use_instead.rex out.js
```

### The Web Playground
We ship a highly-aesthetic React/Express playground for testing Agent hunts live:
```bash
cd packages/playground
npm install && npm start
# Go to http://localhost:3000
```

---

## 📖 Language Primitives

RexScript provides native keywords exclusively built for AI logic. 

### 1. Guarded Operations & LLM Synthesis
Execute web actions securely using fallback recovery blocks.
```rex
goal "Audit Web Data" {
  attempt {
    hunt page "https://example.com/data" as $page;
    synthesise [$page] as $summary;
  } recover Timeout {
    telemetry { exporter "console" }
  } otherwise * {
    skip
  }
}
```

### 2. Zero-Trust Sandbox Isolation
Explicitly block `use.instead` bash arrays and remote macros without invoking a physical execution perimeter.
```rex
security {
    sandbox "docker"
    lockdown strict
}

use.instead:python as $rows {
    import os
    print("Locked Down")
}
```

### 3. State memory
Pass facts probabilistically without polluting process memory natively.
```rex
memory {
    remember $summary as "latest-summary"
}
```

---

## 🛠️ CLI Reference

RexScript’s CLI is blazing fast and handles compiling, tracing, and static validation natively.

```bash
# Compile to safe execution sandbox
npm run -s rex:compile -- <file.rex> [out.js] [default|strict|dynamic]

# Catch warnings using Live Diagnostics JSON Output (For VSCode Extension)
npm run -s rex:check -- <file.rex> default --json

# Strict validation (Ideal for CI/CD Github Actions)
npm run -s rex:lint -- <file.rex>

# Trace execution plans natively
npm run -s rex:trace -- <file.rex> plan.json
```

---

## 🏗️ Architecture Layout

RexScript is organized into modular packages ensuring the Compiler never bleeds into the Runtime adapters.

| Directory | Purpose |
| --- | --- |
| `compiler/src/` | Lexer, Parser, Semantic Analyzer, and CodeGen logic. |
| `packages/runtime/` | Standard library adapters (`__rex`) executing compiled primitives. |
| `packages/xrisk/` | The security perimeter. Handles policy gates, `vault`, and sandboxes. |
| `packages/playground/` | The Web Engine. A WebSockets server testing LLM hunts visually. |
| `extensions/vscode/` | Visual Studio Code native language support providing line-by-line syntax hinting natively hooking `rex:check --json`! |

---

## 🛡️ Production Readiness Checklist

Before you ship your Autonomous Agent built on RexScript, verify the following bounds:

- [ ] **Run Linting**: Run `npm run rex:lint` and ensure **zero** failures.
- [ ] **Lock Dependencies**: Pin your node packages statically to prevent supply-chain poisoning.
- [ ] **Enforce Capabilities**: Restrict your production capability flag: `export REX_ALLOWED_CAPABILITIES=NETWORK,FOREIGN_EXEC`.
- [ ] **Verify E2E Tests**: Use `npx playwright test` to ensure web interfaces function under execution traces perfectly.

## 📄 License & Contributing

RexScript is licensed under the MIT License. To contribute, submit PRs specifically hitting the `tests/integration/` spec files to prove semantic deterministic compilation.

<div align="center">
  <sub>Built by engineers focused on alignment and autonomy natively.</sub>
</div>
