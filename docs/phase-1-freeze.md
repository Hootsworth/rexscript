# RexScript Phase 1 Freeze (v0.1)

Date: 2026-04-03

## Purpose

Freeze the minimum language surface required to build compiler stages 1-4 without spec drift.

## Included in v0.1

- Primitives: `observe`, `navigate`, `find`, `session`, `remember`, `recall`, `forget`, `parallel`, `synthesise`, `flag`, `emit`, `when`, `try/catch`, `use.instead`
- Failure handling: typed `catch <FailureType>` and wildcard `catch *`
- Variable model: `$identifier` as Rex variable form
- Host model: JavaScript statements allowed as pass-through nodes

## Explicit Freeze Decisions

1. `observe`, `find`, and `recall` require `as $alias` in v0.1.
2. `catch *` must be the last catch block (ERR008).
3. `parallel` without `then` is warning by default and error in strict mode (ERR009 behavior in strict).
4. `use.instead` supports explicit hints and auto-detection metadata, but language routing implementation is Phase 4.
5. `when` supports both semantic predicates and JS expression fallback.

## Deferred to Later Phases

- Rich NLP matching quality tuning for `find`
- full Rosetta language detection scoring runtime behavior
- VS Code extension UX polish and trace viewer
- dynamic feature pipeline and isolation enforcement runtime details

## Open Questions to Resolve Before Phase 2 Completion

- Exact parser treatment for mixed JS + Rex statements in one block when semicolon-free style is used.
- Whether `hunt` is parsed as distinct node or alias lowered in parser.
- Whether `synthesise` supports optional inline clauses beyond `as` in v0.1.
