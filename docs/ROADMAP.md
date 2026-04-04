# RexScript Roadmap to v1.0.0

This document outlines the strategic minor releases required to take RexScript from its current early-stage (`v0.1.x`) to a fully stabilized, production-ready `v1.0.0` that you can confidently publish, advocate for, and onboard developers to.

## Current State: v0.1.x - The Foundation
* **Syntax Revamp:** Replaced legacy JavaScript keywords with agent-first primitives (`fact`, `state`, `attempt`, `ensure`).
* **Agent Contexts:** Introduced `goal`, `workspace`, and `rationale` blocks for token and context management.
* **Bounded Execution:** Pipeline operators (`|`) and strict retry semantics (`upto`, `timeout`).

---

## v0.2.0 - The Runtime & Standard Library Expansion
**Focus:** Enhancing the built-in capabilities so agents don't require external utility libraries for basic intelligence.
* **Native Tool Integration (`equip` / `tool`):** Let agents natively bind and advertise their own functions to the LLM backend.
* **Standard `assess` Block:** A specialized version of a switch-case statement that uses an LLM to evaluate complex, fuzzy conditions on the fly (e.g., `assess ($content) { case "is a receipt": ... }`).
* **Vector Memory Integration:** Extend the `remember` and `recall` primitives to hook directly into local Vector stores (e.g., ChromaDB, SQLite-vec) rather than just ephemeral memory arrays.

## v0.3.0 - The XRisk & Traceability Release
**Focus:** Proving to the enterprise that RexScript is safe and auditable.
* **Live Telemetry:** Stream `__xrisk` events and `rationale` logs directly to standard observability platforms (Datadog, OpenTelemetry).
* **Cost Constraints:** Add strict language-level budget tracking to `goal` blocks (`budget < $0.05`) that actively block the runtime if an LLM token budget is exceeded.
* **Trace Replayer:** Ship a CLI tool (`rex:replay`) that takes a `.trace.json` file and visually plays back exactly what the agent "saw" and "thought" on the DOM/CLI.

## v0.4.0 - Multi-Agent Topologies
**Focus:** Moving from single scripts to swarms.
* **`spawn agent` Keyword:** Allow a RexScript to spin up entirely separate agent processes with their own budgets and workspaces.
* **Inter-Agent Protocols:** Native asynchronous messaging between running RexScript agents using `emit` and `await` channels.
* **Parallel Hunts:** Overhaul the `parallel` keyword to aggressively distribute DOM interactions across multiple headless browser instances seamlessly.

## v0.5.0 - The Sandboxed Execution Engine
**Focus:** Making the `use.instead` keyword unbreakable.
* **Docker/WASM Isolation:** Force all `use.instead:bash` or `python` blocks to execute inside strictly permissioned, ephemeral WASM or Docker containers.
* **Capability Toggles:** Let users strictly define capabilities at compile-time (e.g., `--capabilities=NETWORK,READ_ONLY` dropping `WRITE` and `FOREIGN_EXEC`).
* **Secret Management:** Native parser syntax for injecting environment variables without leaking them into traces (`fact secrets = vault("OAI_KEY")`).

## v0.6.0 - The IDE & Developer Experience (DX) Update
**Focus:** Making it fun and frictionless for engineers to write RexScript.
* **Language Server (LSP):** Full VSCode extension providing autocomplete, hover-hints, and semantic error-highlighting for `fact`, `state`, `attempt`, etc.
* **Confidence Linter:** A linter that warns you when you synthesize LLM outputs without wrapping them in an `attempt` or checking their `confidence()`.
* **Playground:** A local web-based RexScript playground to quickly test "hunts" against live websites using a visual UI.

## v0.7.0 -> v0.9.0 - Stabilization & Web Integration
**Focus:** Hardening the compiler and runtime.
* **Framework Agnostic Adapters:** Allow RexScript to run directly embedded inside Next.js/React standard APIs, not just Node.js backends.
* **Performance Enhancements:** Aggressive caching on AST nodes parsing and Playwright contexts.
* **Comprehensive End-to-End Test Suite:** Ensure 100% operational coverage on all language features against live, fluctuating internet environments.

---

## v1.0.0 - The "Enterprise Agent" Release

At `v1.0.0`, RexScript is pitched to the world not just as a scripting language, but as **The safest, most deterministic, and auditable runtime for autonomous web agents**.

**Launch Deliverables:**
* **Stable Language Specification:** The parser and keywords are locked; no more breaking syntax changes.
* **Marketing Landing Page:** "Agents don't browse. They hunt." with interactive code snippets comparing brittle Python/Puppeteer scripts to clean RexScript blocks.
* **Comprehensive Documentation Sites:** Detailed guides on how to build scrapers, social-media bot handlers, and research assistants purely in `1.0.0` RexScript.
