# RexScript Overview

RexScript is a transpiled, agent-centric language built on JavaScript runtime infrastructure.

Pipeline:

1. Source `.rex`
2. Lexer -> Parser -> Semantic Analyzer
3. Codegen emits JS with integrated XRisk hooks
4. Runtime executes primitives (`observe`, `find`, `use.instead`, `parallel`, `synthesise`)
5. Plan + runtime traces are generated and validated

Governance:

- Compile-time diagnostics (`ERR*`, `WARN*`)
- Runtime capability and language policy gates
- Trace-level auditability (`xriskDecision`, `policyReason`, `haiku`, `loc`)
