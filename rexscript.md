# REXSCRIPT — COMPLETE MASTER SPECIFICATION

### The Agent-Native Programming Language

**Version:** Pre-Alpha Specification  
**Stack Position:** Language layer of the Rex ecosystem  
**Status:** Design phase — nothing is final, everything is intentional

-----

> *“RexScript is a transpiled superset of JavaScript where every statement is an observation, a decision, or an action. Nothing is implicit. Everything is traceable. Built for agents, readable by humans. RexScript doesn’t compete with other languages. It contains them.”*

-----

## TABLE OF CONTENTS

1. [Project Overview & Motivation](#1-project-overview--motivation)
1. [The Stack — Where RexScript Lives](#2-the-stack--where-rexscript-lives)
1. [Language Philosophy](#3-language-philosophy)
1. [File Format & Compilation Model](#4-file-format--compilation-model)
1. [Grammar Specification](#5-grammar-specification)
1. [Keywords — Complete Reserved Word List](#6-keywords--complete-reserved-word-list)
1. [Statement Types](#7-statement-types)
1. [Primitive Definitions](#8-primitive-definitions)
1. [The use.instead Block](#9-the-useinstead-block)
1. [The Failure Type System](#10-the-failure-type-system)
1. [The Type System](#11-the-type-system)
1. [Memory System](#12-memory-system)
1. [Session System](#13-session-system)
1. [Parallel Execution](#14-parallel-execution)
1. [Dynamic Feature System Integration](#15-dynamic-feature-system-integration)
1. [XRisk Integration Layer](#16-xrisk-integration-layer)
1. [The Transpiler Architecture](#17-the-transpiler-architecture)
1. [The Runtime Standard Library](#18-the-runtime-standard-library)
1. [Rosetta — The Language Detection Engine](#19-rosetta--the-language-detection-engine)
1. [The CLI](#20-the-cli)
1. [VSCode Extension](#21-vscode-extension)
1. [Error Message Design](#22-error-message-design)
1. [Easter Eggs](#23-easter-eggs)
1. [Version Naming System](#24-version-naming-system)
1. [Build Order & Quality Bars](#25-build-order--quality-bars)
1. [What Makes This Unprecedented](#26-what-makes-this-unprecedented)

-----

## 1. PROJECT OVERVIEW & MOTIVATION

### Why RexScript Exists

Rex — the autonomous AI agent — can already write its own dynamic features. When it encounters a task for which no defined feature exists, it:

1. Reasons about what is needed
1. Writes a dynamic function in complete isolation from core code
1. Submits it for human approval
1. Executes it upon approval
1. Does something it was never explicitly programmed to do

This is recursive self-extension under human oversight. It is one of the hardest problems in AI systems and it works.

The problem: when Rex writes those dynamic features, it writes them in JavaScript or Python — languages built for humans doing general computation. This means Rex must spend cognitive cycles on:

- Syntax correctness for a human-optimised language
- Inventing error handling patterns from scratch
- Remembering to stay within safe capability bounds
- Manually interfacing with its own internals

RexScript eliminates this overhead entirely.

When Rex writes a dynamic feature in RexScript, every construct maps directly to something Rex actually does. Safety is automatic. Failures are semantic. Context flows transparently. Rex stops thinking about *how to write code* and thinks only about *what the code needs to do*.

This is linguistic relativity applied to AI agents. The language shapes what thoughts are possible. RexScript makes agent-thoughts easier to think.

### The Unprecedented Nature of This

No one has shipped:

- A real programming language (transpiled, with its own syntax, primitives, type system) designed from the ground up for agentic computation
- A language where an agent writes its own extensions in that language natively
- A language where safety auditing is in the syntax, not bolted on
- A language that auto-detects and hosts other languages with transparent context flow

RexScript is not a framework. Not a library. Not a prompt language. Not a configuration DSL. It is a language. The first of its kind.

-----

## 2. THE STACK — WHERE REXSCRIPT LIVES

```
╔══════════════════════════════════════════╗
║     DYNAMIC FEATURE WRITING              ║
║     Rex authors its own extensions       ║
╠══════════════════════════════════════════╣
║     REXSCRIPT (.rex files)               ║
║     The language Rex thinks in           ║
╠══════════════════════════════════════════╣
║     REX'S PLAYGROUND                     ║
║     The browser environment Rex acts in  ║
╠══════════════════════════════════════════╣
║     REX                                  ║
║     The agent that thinks and acts       ║
╠══════════════════════════════════════════╣
║     XRISK ENGINE                         ║
║     The safety layer under everything    ║
╚══════════════════════════════════════════╝
```

Each layer was built because the layer above needed it. RexScript is the capstone that makes every layer beneath it retroactively more powerful.

-----

## 3. LANGUAGE PHILOSOPHY

### The Three Laws of RexScript

**Law 1 — Every statement is an observation, a decision, or an action.**
Nothing exists in RexScript that doesn’t map to one of these. No ambiguity about what a line of code does at the agent level.

**Law 2 — Nothing is implicit. Everything is traceable.**
Every execution leaves a trace. Every failure has a name. Every variable has a known type. Agents and humans can inspect any point in any execution.

**Law 3 — Safety is not a feature. It is the floor.**
XRisk integration is not opt-in. It cannot be disabled. An agent cannot write RexScript that escapes the audit system. The language makes unsafe code syntactically impossible, not just discouraged.

### Design Principles

- **Agent-readable over human-readable** — though both should be achievable
- **Failure is a first-class citizen** — not an edge case
- **Context never resets** — variables, memory, and session persist across boundaries
- **Parallelism is default** — sequential execution is the special case
- **Other languages are guests, not replacements** — `use.instead` hosts them, RexScript remains the host

-----

## 4. FILE FORMAT & COMPILATION MODEL

### File Extension

`.rex`

### Compilation Pipeline

```
source.rex
    ↓ Lexer (tokenisation)
    ↓ Parser (AST generation)
    ↓ Semantic Analyser (type checking, risk classification)
    ↓ Code Generator (JS emission)
output.js (with __rex runtime imported)
```

### RexScript as a JS Superset

RexScript is a strict superset of JavaScript. All valid JavaScript is valid RexScript. All RexScript compiles to valid JavaScript. This means:

- The entire npm ecosystem is available
- Agents can mix raw JS and RexScript freely
- No new runtime needs to be built — only a transpiler and a runtime library
- Existing JS tooling (bundlers, linters) works on compiled output

### The `__rex` Runtime Object

Every compiled `.rex` file auto-imports the Rex runtime library:

```js
import __rex from '@rexscript/runtime';
import __xrisk from '@rexscript/xrisk';
import __rosetta from '@rexscript/rosetta';
```

These are never written by the developer. They are injected by the compiler.

-----

## 5. GRAMMAR SPECIFICATION

Written in EBNF (Extended Backus-Naur Form). This is the formal definition of what is legal RexScript.

### Top-Level Structure

```ebnf
program         ::= statement*
statement       ::= observe_stmt
                  | navigate_stmt
                  | find_stmt
                  | remember_stmt
                  | recall_stmt
                  | forget_stmt
                  | parallel_stmt
                  | session_stmt
                  | use_instead_stmt
                  | when_stmt
                  | flag_stmt
                  | emit_stmt
                  | synthesise_stmt
                  | try_catch_stmt
                  | js_statement
```

### Observe Statement

```ebnf
observe_stmt    ::= 'observe' 'page' url_expr ('with' 'session' identifier)?
                    'as' variable
url_expr        ::= string_literal | variable | template_string
variable        ::= '$' identifier
```

### Navigate Statement

```ebnf
navigate_stmt   ::= 'navigate' 'to' url_expr
                    ('with' 'session' identifier)?
                    ('with' headers_obj)?
                  | 'navigate' 'back'
                  | 'navigate' 'forward'
```

### Find Statement

```ebnf
find_stmt       ::= 'find' semantic_selector 'in' variable 'as' variable
semantic_selector ::= string_literal
```

### Memory Statements

```ebnf
remember_stmt   ::= 'remember' variable 'tagged' tag_list
recall_stmt     ::= 'recall' 'tagged' tag_list ('where' recall_filter)?
forget_stmt     ::= 'forget' 'tagged' tag_list
tag_list        ::= string_literal (',' string_literal)*
recall_filter   ::= 'relevance' comparator number
comparator      ::= '>' | '<' | '>=' | '<=' | '='
```

### Parallel Statement

```ebnf
parallel_stmt   ::= 'parallel' ('limit' number)? '{' statement* '}'
                    ('then' (synthesise_expr | handler_fn))?
```

### Session Statement

```ebnf
session_stmt    ::= 'session' identifier 'with' '{' session_opts '}'
session_opts    ::= session_opt (',' session_opt)*
session_opt     ::= 'cookies' ':' bool_expr
                  | 'proxy' ':' string_literal
                  | 'fingerprint' ':' fingerprint_mode
                  | 'timeout' ':' number
fingerprint_mode ::= 'random' | 'stealth' | 'default'
```

### use.instead Statement

```ebnf
use_instead_stmt ::= 'use.instead' (':' language_hint)? ('as' variable)?
                     '{' foreign_content '}'
                     catch_block*
language_hint   ::= 'sql' | 'python' | 'bash' | 'graphql' | 'regex'
                  | 'xpath' | 'yaml' | 'json'
foreign_content ::= (any character sequence, with {variable} interpolation)
```

### Failure Handling

```ebnf
try_catch_stmt  ::= 'try' '{' statement* '}'
                    catch_block+
catch_block     ::= 'catch' failure_type '{' recovery_stmt* '}'
                  | 'catch' '*' '{' recovery_stmt* '}'
failure_type    ::= 'BlockedByBot' | 'RateLimit' | 'Timeout'
                  | 'DNSFailure' | 'ContentGated' | 'ContentEmpty'
                  | 'ContentChanged' | 'Paywalled' | 'AmbiguousResult'
                  | 'MemoryOverflow' | 'SynthesisFailed' | 'RiskBlocked'
                  | 'PromptInjected' | 'CapabilityExceeded' | 'QueryFailed'
recovery_stmt   ::= 'retry' ('with' retry_opts)?
                  | 'skip'
                  | 'flag' variable 'as' identifier
                  | 'rotate' 'proxy'
                  | 'use' 'default' expression
                  | statement
```

### When Statement (Agent-Native Conditionals)

```ebnf
when_stmt       ::= 'when' agent_condition '{' statement* '}'
                    ('otherwise' '{' statement* '}')?
agent_condition ::= variable 'is' page_state
                  | variable 'seems_unreliable'
                  | variable 'is' 'empty'
                  | variable 'confidence' comparator number
                  | js_expression
page_state      ::= 'inaccessible' | 'gated' | 'loaded' | 'empty'
                  | 'blocked' | 'paywalled'
```

### Flag Statement

```ebnf
flag_stmt       ::= 'flag' variable 'as' identifier
```

### Emit Statement

```ebnf
emit_stmt       ::= 'emit' '{' trace_fields '}'
trace_fields    ::= trace_field (',' trace_field)*
trace_field     ::= identifier ':' expression
```

### Synthesise Expression

```ebnf
synthesise_expr ::= 'synthesise' '[' variable (',' variable)* ']'
                    ('as' variable)?
```

-----

## 6. KEYWORDS — COMPLETE RESERVED WORD LIST

### RexScript-Native Keywords

```
observe     navigate    find        remember    recall
forget      parallel    synthesise  session     flag
emit        trace       agent       when        otherwise
retry       skip        rotate      hunt        use.instead
tagged      relevance   confidence  seems_unreliable
inaccessible  gated     loaded      blocked     paywalled
limit       stealth     fingerprint proxy
```

### Inherited JS Keywords (still reserved)

```
const let var function class return if else for while
do switch case break continue import export default
async await try catch finally throw new delete typeof
instanceof void in of yield
```

### Special Variables (auto-injected)

```
$agent      — current agent context
$session    — current active session
$trace      — current execution trace
$memory     — current memory state summary
$risk       — current XRisk classification
```

-----

## 7. STATEMENT TYPES

Every RexScript statement belongs to exactly one of three categories. This is enforced by the semantic analyser.

### Observation Statements

Statements that gather information. They do not change external state.

```
observe, find, recall, synthesise (when used as a query)
```

### Decision Statements

Statements that evaluate state and choose a path. They do not act on the world.

```
when, if/else (inherited), flag, emit
```

### Action Statements

Statements that change state — internal (memory, session) or external (navigation, execution).

```
navigate, remember, forget, retry, skip, rotate, use.instead, parallel
```

The compiler warns when an action statement appears where only observation is expected (e.g., inside a `find` expression). This prevents agents from accidentally acting when they meant to observe.

-----

## 8. PRIMITIVE DEFINITIONS

Each primitive is defined with four components: **Syntax**, **Behaviour**, **Failure Modes**, **Compiled JS Output**.

-----

### `observe`

**Syntax:**

```js
observe page $url as $result
observe page $url with session $s as $result
observe page $url with session $s as $result
```

**Behaviour:**
Launches a browser context, navigates to the URL, waits for full page load, runs the content extraction pipeline, returns a structured `PageResult`. Automatically emits an observation trace.

**Failure Modes:**
`Timeout`, `BlockedByBot`, `DNSFailure`, `ContentGated`, `Paywalled`, `ContentEmpty`

**Compiled JS:**

```js
const $result = await __rex.observe($url, { session: $s ?? null });
```

-----

### `hunt` (alias for `observe`)

**Syntax:**

```js
hunt page $url as $prey
```

Identical to `observe` in every way. Exists because agents that feel dangerous make better decisions. (Also an easter egg. See Section 23.)

-----

### `navigate`

**Syntax:**

```js
navigate to $url
navigate to $url with session $s
navigate to $url with { headers: { 'User-Agent': '...' } }
navigate back
navigate forward
```

**Behaviour:**
Moves the active browser context to a new URL. Does not extract content — use `observe` after navigating if content is needed. Maintains session state.

**Failure Modes:**
`Timeout`, `BlockedByBot`, `DNSFailure`

**Compiled JS:**

```js
await __rex.navigate($url, { session: $s ?? null, headers: {} });
```

-----

### `find`

**Syntax:**

```js
find "submit button near login form" in $page as $element
find "main article content" in $page as $article
find "price tag" in $page as $price
```

**Behaviour:**
Semantic element targeting. Does not use CSS selectors. Uses NLP-based matching against the page’s extracted structure. Returns a `FindResult` with a confidence score. High confidence (>0.85) means unambiguous match. Low confidence triggers `AmbiguousResult`.

**Failure Modes:**
`AmbiguousResult`, `ContentEmpty`

**Compiled JS:**

```js
const $element = await __rex.find("submit button near login form", $page);
```

-----

### `remember`

**Syntax:**

```js
remember $result tagged "arxiv", "RL", "2024"
remember $finding tagged "competitor", "pricing"
```

**Behaviour:**
Stores data to the in-session vector store. Indexed by tags and embedding. Persists for the duration of the session. Can be recalled by tag or semantic similarity.

**Failure Modes:**
`MemoryOverflow`

**Compiled JS:**

```js
await __rex.remember($result, ["arxiv", "RL", "2024"]);
```

-----

### `recall`

**Syntax:**

```js
recall tagged "arxiv" as $papers
recall tagged "arxiv" where relevance > 0.8 as $papers
recall tagged "competitor", "pricing" as $data
```

**Behaviour:**
Queries the in-session vector store. Returns ranked `MemoryResult[]`. `where relevance >` filters by cosine similarity threshold.

**Failure Modes:**
`MemoryOverflow`

**Compiled JS:**

```js
const $papers = await __rex.recall(["arxiv"], { threshold: 0.8 });
```

-----

### `forget`

**Syntax:**

```js
forget tagged "temp", "cache"
```

**Behaviour:**
Removes entries from the in-session vector store matching the given tags. Permanent within the session.

**Compiled JS:**

```js
await __rex.forget(["temp", "cache"]);
```

-----

### `parallel`

**Syntax:**

```js
parallel {
  $a = observe page $url1
  $b = observe page $url2
  $c = observe page $url3
} then synthesise [$a, $b, $c] as $research

parallel limit 5 {
  $results = observe page $url
}
```

**Behaviour:**
Executes all statements inside the block concurrently. `limit N` caps the concurrency pool. Waits for all to complete before proceeding to `then`. Failed branches produce typed failures, not crashes — other branches continue.

**Failure Modes:**
Individual branch failures are typed. The parallel block itself only fails on `CapabilityExceeded` (too many concurrent sessions).

**Compiled JS:**

```js
const [$a, $b, $c] = await __rex.parallel([
  () => __rex.observe($url1),
  () => __rex.observe($url2),
  () => __rex.observe($url3),
], { limit: Infinity });
```

-----

### `synthesise`

**Syntax:**

```js
synthesise [$a, $b, $c] as $output
synthesise [$findings] as $report
```

**Behaviour:**
Calls the configured LLM API (Claude, GPT-4o, etc.) with all inputs. Deduplicates, summarises, and structures the output. Returns `SynthesisOutput` with a confidence score and a source map.

**Failure Modes:**
`SynthesisFailed`, `RateLimit`

**Compiled JS:**

```js
const $output = await __rex.synthesise([$a, $b, $c]);
```

-----

### `session`

**Syntax:**

```js
session $s with {
  cookies: true,
  proxy: "http://proxy.example.com:8080",
  fingerprint: random,
  timeout: 30000
}
```

**Behaviour:**
Creates a named browser session context with the given configuration. Sessions are sandboxed — different sessions cannot share cookies or state. A session persists until explicitly closed or the agent exits.

**Compiled JS:**

```js
const $s = await __rex.session({
  cookies: true,
  proxy: "http://proxy.example.com:8080",
  fingerprint: "random",
  timeout: 30000
});
```

-----

### `flag`

**Syntax:**

```js
flag $url as requires_auth
flag $result as low_confidence
flag $page as unreachable
```

**Behaviour:**
Marks a variable with a semantic label. Flagged variables appear in the trace with their labels. Does not stop execution — it’s an annotation, not a halt.

**Compiled JS:**

```js
__rex.flag($url, "requires_auth");
```

-----

### `emit`

**Syntax:**

```js
emit { action: "custom_step", detail: $result, confidence: 0.9 }
```

**Behaviour:**
Manually emits a custom entry into the execution trace. Useful for dynamic features that want to annotate their own execution. XRisk sees all emitted traces.

**Compiled JS:**

```js
__xrisk.emit({ action: "custom_step", detail: $result, confidence: 0.9 });
```

-----

### `when`

**Syntax:**

```js
when $page is inaccessible {
  flag $url as unreachable
  skip
}

when $result seems_unreliable {
  re-observe with different source
}

when $result.confidence < 0.5 {
  flag $result as low_confidence
}
```

**Behaviour:**
Agent-native conditional. Evaluates page state or result quality semantically. Compiles to JS conditionals with the appropriate runtime checks.

**Compiled JS:**

```js
if (await __rex.check($page, "inaccessible")) {
  __rex.flag($url, "unreachable");
  continue;
}
```

-----

## 9. THE `use.instead` BLOCK

The most architecturally significant feature of RexScript. Allows any foreign language to be embedded, auto-detected, and executed with full context transparency and unbroken audit trail.

### Design Philosophy

RexScript doesn’t compete with other languages. It contains them.

### Syntax Variants

**Automatic detection:**

```js
use.instead {
  SELECT users.name, users.email
  FROM users
  WHERE created_at > '2024-01-01'
}
```

**Explicit language hint:**

```js
use.instead:python {
  import pandas as pd
  df = pd.read_csv('data.csv')
  print(df.describe())
}
```

**With output binding:**

```js
use.instead as $result {
  SELECT COUNT(*) as total FROM logs WHERE active = true
}
```

**With variable interpolation:**

```js
observe page $url as $page
let $tableName = $page.extractedTableName

use.instead as $records {
  SELECT * FROM {$tableName} LIMIT 100
}
```

**With failure handling:**

```js
use.instead as $data {
  SELECT * FROM sessions WHERE active = true
} catch QueryFailed {
  use default []
}
```

**Inside parallel:**

```js
parallel {
  $web = observe page $url
  $db = use.instead as $records {
    SELECT * FROM cache WHERE url = '{$url}'
  }
} then synthesise [$web, $db] as $combined
```

### Supported Auto-Detected Languages (v1)

|Language|Detection Signals                          |Execution Method    |
|--------|-------------------------------------------|--------------------|
|SQL     |`SELECT`, `FROM`, `WHERE`, `JOIN`, `INSERT`|Configured DB driver|
|Python  |`def`, `import`, `:` structure, `print(`   |Spawned subprocess  |
|Bash    |`$`, `#!/`, pipes, `grep`, `curl`, `echo`  |Sandboxed shell     |
|Regex   |`/pattern/flags` structure                 |Native JS RegExp    |
|GraphQL |`query {`, `mutation {`, `fragment`        |Configured endpoint |
|XPath   |`//node`, `@attr`, `node()`                |DOM evaluation      |
|JSON    |`{` / `[` structural opening               |Native JS parse     |
|YAML    |`key: value` density, `---`                |js-yaml parse       |

### Confidence Thresholds

Detection confidence below 0.60 → compile error:

```
RexError: use.instead block is ambiguous.
Detected: Python (0.54), Pseudocode (0.41)
Suggestion: Use explicit form — use.instead:python { ... }
```

Detection confidence 0.60–0.80 → compile warning:

```
RexWarning: use.instead detected as SQL (confidence: 0.71).
If incorrect, use explicit form — use.instead:sql { ... }
```

Detection confidence above 0.80 → silent compilation.

### Variable Interpolation Rules

Inside a `use.instead` block, `{$variable}` is replaced with the stringified value of the RexScript variable before the block is executed. Type coercion rules:

- `PageResult` → stringified URL
- `string` → direct substitution
- `number` → direct substitution
- `object` → JSON.stringify

### Context Inheritance

The `use.instead` block is NOT isolated. It shares:

- All RexScript variables in scope
- The active session context
- The current memory state
- The XRisk trace (cannot be opted out)

It does NOT share:

- Raw DOM state
- Browser process internals
- Other sessions

### The Trace Entry for `use.instead`

```json
{
  "action": "use.instead",
  "detectedLanguage": "SQL",
  "detectionConfidence": 0.97,
  "explicitHint": null,
  "variablesInterpolated": ["$tableName"],
  "riskLevel": "MEDIUM",
  "executionMethod": "db-driver",
  "timestamp": "...",
  "sessionId": "..."
}
```

-----

## 10. THE FAILURE TYPE SYSTEM

The most important differentiator in RexScript. Every failure an agent can encounter has a name, a semantic meaning, and a suggested recovery path.

### Network Failures

|Type                |Meaning                                 |Suggested Recovery         |
|--------------------|----------------------------------------|---------------------------|
|`BlockedByBot`      |403/captcha/bot detection triggered     |`rotate proxy, retry`      |
|`RateLimit`         |429 received or rate heuristic triggered|`wait $duration, retry`    |
|`Timeout`           |Request exceeded configured timeout     |`retry with longer timeout`|
|`DNSFailure`        |Domain could not be resolved            |`flag as unreachable, skip`|
|`SSLFailure`        |Certificate error or HTTPS failure      |`flag as untrusted, skip`  |
|`NetworkUnavailable`|No internet connectivity                |`halt, emit alert`         |

### Content Failures

|Type              |Meaning                                   |Suggested Recovery           |
|------------------|------------------------------------------|-----------------------------|
|`ContentGated`    |Login required to access content          |`flag as requires_auth, skip`|
|`ContentEmpty`    |Page loaded but no extractable content    |`try alternate selector`     |
|`ContentChanged`  |Page content differs from previous observe|`re-observe, diff`           |
|`Paywalled`       |Paywall detected                          |`flag, find alternate source`|
|`ContentAmbiguous`|Multiple interpretations of content       |`narrow query, re-observe`   |

### Agent Failures

|Type             |Meaning                                |Suggested Recovery                   |
|-----------------|---------------------------------------|-------------------------------------|
|`AmbiguousResult`|`find` returned low-confidence match   |`narrow selector, retry`             |
|`MemoryOverflow` |Session memory at capacity             |`summarise old recall, continue`     |
|`SynthesisFailed`|LLM synthesis returned no usable output|`return partial, flag low confidence`|
|`QueryFailed`    |`use.instead` execution failed         |`use default, flag`                  |
|`ContextLost`    |Variable used after session closed     |`re-observe, rebuild context`        |

### Security Failures (XRisk)

|Type                |Meaning                                  |Recovery                                  |
|--------------------|-----------------------------------------|------------------------------------------|
|`RiskBlocked`       |XRisk BLOCK classification triggered     |**No recovery. Hard stop. Audit emitted.**|
|`PromptInjected`    |Prompt injection detected in page content|Quarantine result, emit alert             |
|`CapabilityExceeded`|Action exceeds sandboxed capability token|Downgrade action, emit trace              |
|`TamperDetected`    |Audit chain integrity violation          |**No recovery. Hard stop.**               |

### Catch Syntax

```js
try {
  observe page $url as $page
} catch BlockedByBot {
  rotate proxy
  retry
} catch ContentGated {
  flag $url as requires_auth
  skip
} catch * {
  flag $url as failed
  emit { action: "unhandled_failure", url: $url }
  skip
}
```

### The `catch *` Wildcard

Catches any unhandled failure type. Should always be the last catch block. Best practice: always emit a trace in `catch *` so the failure isn’t silent.

### Compile-Time Failure Warnings

The semantic analyser warns when a risky operation has no failure handler:

```
RexWarning [Line 8]: 'observe' has no failure handler.
Risk operations without handlers will throw untyped JS errors.
Suggestion: Wrap in try/catch BlockedByBot, Timeout, or catch *
```

-----

## 11. THE TYPE SYSTEM

Structural, inferred, lightweight. You never declare types. They are inferred from what primitives return.

### Core Types

|Type             |Returned By     |Key Properties                                                           |
|-----------------|----------------|-------------------------------------------------------------------------|
|`PageResult`     |`observe`       |`.content`, `.links`, `.forms`, `.title`, `.url`, `.confidence`, `.trace`|
|`FindResult`     |`find`          |`.element`, `.selector`, `.confidence`, `.context`                       |
|`MemoryResult`   |`recall`        |`.data`, `.tags`, `.relevance`, `.timestamp`                             |
|`MemoryResult[]` |`recall` (multi)|Array of `MemoryResult`                                                  |
|`ParallelResult` |`parallel`      |`.results[]`, `.failures[]`, `.duration`                                 |
|`SynthesisOutput`|`synthesise`    |`.content`, `.confidence`, `.sources[]`, `.summary`                      |
|`SessionContext` |`session`       |`.id`, `.proxy`, `.cookies`, `.fingerprint`, `.active`                   |
|`AgentTrace`     |auto-injected   |`.action`, `.timestamp`, `.riskLevel`, `.sessionId`                      |
|`ForeignResult`  |`use.instead`   |`.output`, `.language`, `.confidence`, `.raw`                            |

### PageResult in Detail

```
PageResult {
  content:     string       — cleaned main text, navigation stripped
  links:       LinkItem[]   — annotated links with context
  forms:       FormItem[]   — identified form elements with field types
  title:       string       — page title
  url:         string       — final URL (after redirects)
  confidence:  number       — extraction quality score (0–1)
  trace:       AgentTrace   — auto-generated trace for this observation
  raw:         string       — raw HTML (available but discouraged)
  metadata:    object       — og tags, schema.org, meta description
}
```

### Type Compatibility

RexScript types are compatible with JS. A `PageResult` can be passed to any JS function that expects an object. Properties are accessed with standard dot notation.

### The `confidence` Property

All RexScript types that involve extraction or interpretation carry a `.confidence` score (0–1). This is the most important property agents use for decision-making:

```js
observe page $url as $page

when $page.confidence < 0.5 {
  flag $page as low_quality
  skip
}
```

-----

## 12. MEMORY SYSTEM

### Architecture

In-session vector store. Implemented on top of a lightweight in-process embedding store (no external DB required for v1).

### Scope

Memory is **session-scoped by default**. It persists for the lifetime of the agent’s current execution. It does not persist between Rex invocations unless explicitly exported.

### Memory Operations

```js
remember $data tagged "tag1", "tag2"     — store with tags
recall tagged "tag1" as $results          — retrieve by tag
recall tagged "tag1" where relevance > 0.7 as $results   — with threshold
forget tagged "tag1"                      — remove by tag
```

### Memory Overflow Handling

When the session memory is near capacity, the semantic analyser can detect potential overflow at runtime and throw `MemoryOverflow`. Recovery:

```js
catch MemoryOverflow {
  synthesise $memory as $summary
  forget tagged "*"
  remember $summary tagged "compressed"
}
```

### Future: Cross-Session Memory

v2 feature. Persistent memory store that survives between Rex invocations. Requires a defined serialisation format and XRisk-audited write operations.

-----

## 13. SESSION SYSTEM

### What a Session Is

A sandboxed browser context with its own:

- Cookie jar
- Local storage
- Request history
- Proxy configuration
- Fingerprint profile

### Session Creation

```js
session $research with {
  cookies: true,
  proxy: "http://residential.proxy.io:8080",
  fingerprint: random,
  timeout: 45000
}
```

### Fingerprint Modes

|Mode     |Behaviour                                                     |
|---------|--------------------------------------------------------------|
|`default`|Standard headless browser fingerprint                         |
|`random` |Randomised UA, screen size, timezone, language on each session|
|`stealth`|Maximum anti-detection (used by `--ghost` CLI mode)           |

### Session Pooling

The `parallel` primitive automatically manages a session pool. It does not create N sessions for N parallel tasks — it reuses available sessions from the pool, creating new ones only when needed.

### Session Lifecycle

```js
session $s with { ... }   — create
// use $s in observe, navigate, find
$s.close()                — explicit close (optional, auto-closed on exit)
```

-----

## 14. PARALLEL EXECUTION

### Philosophy

Web research is embarrassingly parallelisable. Sequential execution should be the exception. `parallel` is a first-class construct, not a utility function.

### Basic Parallel

```js
parallel {
  $a = observe page $url1
  $b = observe page $url2
  $c = observe page $url3
} then synthesise [$a, $b, $c] as $findings
```

### With Concurrency Limit

```js
parallel limit 3 {
  $results = observe page $url
}
```

### Failure Isolation

If one branch fails inside a `parallel` block, other branches continue. Failures are collected in `ParallelResult.failures[]`. The `then` handler receives both successes and failures.

```js
parallel {
  $a = observe page $url1
  $b = observe page $url2
} then {
  if $b in $results.failures {
    synthesise [$a] as $output
  } else {
    synthesise [$a, $b] as $output
  }
}
```

### Parallel with `use.instead`

```js
parallel {
  $web = observe page $url
  $db = use.instead as $cached {
    SELECT * FROM cache WHERE url = '{$url}'
  }
} then synthesise [$web, $db] as $combined
```

-----

## 15. DYNAMIC FEATURE SYSTEM INTEGRATION

This is the most important section architecturally. RexScript exists primarily because Rex can write its own features — and those features should be written in a language Rex knows natively.

### The Dynamic Feature Lifecycle (with RexScript)

```
Rex encounters unknown task
          ↓
Rex reasons about required capability
          ↓
Rex writes a .rex file (not JS, not Python — RexScript)
          ↓
RexScript semantic analyser validates it
XRisk classifies every action in the file
          ↓
If risk level is acceptable → submitted for human approval
If risk level is BLOCK → rejected immediately, reason returned to Rex
          ↓
Human approves
          ↓
Transpiler compiles .rex → .js
          ↓
Dynamic feature executes in isolation
          ↓
Trace stored, output returned to Rex
```

### Why .rex Files for Dynamic Features

When Rex writes a dynamic feature in RexScript instead of JS:

1. **No syntax ambiguity** — Rex knows RexScript completely. It doesn’t have to decide between 17 ways to do async error handling.
1. **Safety is automatic** — XRisk hooks are compiled in. Rex cannot write a dynamic feature that bypasses auditing.
1. **Failures are named** — Rex writes `catch BlockedByBot` not `catch (e) { if (e.status === 403)...`
1. **Context is available** — `$agent`, `$session`, `$memory` are always in scope. Rex doesn’t have to pass its own context to itself.
1. **`use.instead` as the escape hatch** — if Rex needs to do something RexScript can’t express, it writes `use.instead:python { ... }` and RexScript handles the rest.

### Dynamic Feature File Structure

```
/rex-core/              ← never touched by dynamic features
/rex-dynamic/
  /pending/
    feature_20240312_01.rex   ← awaiting approval
  /approved/
    feature_20240312_01.rex   ← approved source
    feature_20240312_01.js    ← compiled output
  /traces/
    feature_20240312_01.trace.json   ← execution audit
```

### The Isolation Contract

A dynamic `.rex` file:

- **CAN** use all RexScript primitives
- **CAN** import from the Rex runtime library
- **CAN** access `$agent`, `$session`, `$memory`
- **CANNOT** import from rex-core
- **CANNOT** write to rex-core directories
- **CANNOT** close or modify existing sessions it didn’t create
- **CANNOT** disable XRisk (syntactically impossible)
- **CANNOT** exceed its capability token (enforced at runtime)

### Rex Writing RexScript — What That Looks Like

A task arrives: *“Find all academic papers about reinforcement learning published this week and summarise the top 5 by citation count.”*

Rex has no defined feature for this. It writes:

```js
// dynamic feature: weekly_rl_papers
// generated by Rex — 2024-03-12T09:14:22Z
// risk classification: LOW

session $research with {
  fingerprint: random,
  timeout: 30000
}

parallel {
  $arxiv = observe page "https://arxiv.org/search/?query=reinforcement+learning&searchtype=all&start=0" with session $research as $arxiv
  $scholar = observe page "https://scholar.google.com/scholar?q=reinforcement+learning&as_ylo=2024" with session $research as $scholar
} then synthesise [$arxiv, $scholar] as $combined

remember $combined tagged "rl", "weekly", "papers"

find "paper titles and citation counts" in $combined as $papers

synthesise [$papers] as $top5 where limit = 5

emit { action: "weekly_rl_papers_complete", count: 5, confidence: $top5.confidence }
```

This is legible. It’s auditable. XRisk classified every line. Rex didn’t have to think about async, error handling patterns, or how to interface with Rex internals. It thought about the task.

-----

## 16. XRISK INTEGRATION LAYER

### Philosophy

RexScript is the only language where security auditing is in the syntax, not bolted on. An agent cannot write legal RexScript that escapes the audit system.

### How It Works

Every compiled statement is automatically wrapped with XRisk hooks:

```js
// Source RexScript:
navigate to $url

// Compiled JS:
await __xrisk.before({ action: "navigate", target: $url, capability: "NETWORK", sessionId: $session.id });
await __rex.navigate($url);
await __xrisk.after({ result: null, riskLevel: "LOW", timestamp: Date.now() });
```

The developer never writes this. It is injected by the code generator for every action statement.

### Compile-Time Risk Classification

The semantic analyser classifies every action at compile time:

|Action                                                                    |Default Risk|
|--------------------------------------------------------------------------|------------|
|`observe page`                                                            |LOW         |
|`navigate to`                                                             |LOW         |
|`find`                                                                    |LOW         |
|`remember`                                                                |LOW         |
|`recall`                                                                  |LOW         |
|`synthesise`                                                              |MEDIUM      |
|`use.instead:python`                                                      |MEDIUM      |
|`use.instead:bash`                                                        |HIGH        |
|`parallel limit > 20`                                                     |MEDIUM      |
|Any action containing “password”, “credentials”, “auth” in string literals|HIGH        |
|`emit` with capability escalation                                         |HIGH        |

### Runtime Risk Escalation

XRisk can escalate risk at runtime based on what is actually found:

- Page contains prompt injection patterns → `PromptInjected`
- Result requests capability beyond token → `CapabilityExceeded`
- Audit chain fails integrity check → `TamperDetected`

### The Audit Trace Format

```json
{
  "traceId": "rex-20240312-4821",
  "sessionId": "session-a7f2",
  "action": "observe",
  "target": "https://arxiv.org/...",
  "riskLevel": "LOW",
  "capability": "NETWORK",
  "timestamp": "2024-03-12T09:14:22.341Z",
  "duration": 1847,
  "result": {
    "type": "PageResult",
    "confidence": 0.94,
    "contentLength": 8421
  },
  "xriskDecision": "ALLOW",
  "haiku": "pages turn to dust / the agent remembers all / nothing stays hidden"
}
```

### The `haiku` Field

Every trace entry gets a unique haiku generated from a seeded hash of the session’s action sequence. Completely useless for security purposes. Completely necessary for the soul of the project. (See Section 23.)

-----

## 17. THE TRANSPILER ARCHITECTURE

### Overview

```
source.rex
    ↓
[Stage 1] Lexer          — characters → tokens
    ↓
[Stage 2] Parser         — tokens → AST
    ↓
[Stage 3] Semantic Analyser — AST → annotated AST (types, risk, warnings)
    ↓
[Stage 4] Code Generator — annotated AST → JavaScript
    ↓
output.js
```

### Stage 1: Lexer

Reads the source file character by character. Emits tokens.

```
Token types:
  KEYWORD       — reserved words
  IDENTIFIER    — variable names, function names
  VARIABLE      — $-prefixed identifiers
  STRING        — "..." or '...' or `...`
  NUMBER        — numeric literals
  OPERATOR      — =, >, <, >=, <=, +, -, etc.
  PUNCTUATION   — {, }, (, ), [, ], ,, ;, .
  NEWLINE       — significant in some contexts
  COMMENT       — // and /* */ (stripped)
  FOREIGN       — content inside use.instead blocks (passed raw to Rosetta)
```

**Implementation:** Fork Acorn or extend Babel’s tokeniser. Do not write a lexer from scratch for v1.

### Stage 2: Parser

Tokens → Abstract Syntax Tree.

Every RexScript construct has a corresponding AST node type:

```
ObserveStatement    { url, session, alias }
NavigateStatement   { url, session, headers, direction }
FindStatement       { selector, source, alias }
RememberStatement   { data, tags }
RecallStatement     { tags, threshold, alias }
ParallelStatement   { limit, body, handler }
SessionStatement    { name, options }
UseInsteadStatement { languageHint, outputAlias, content, catches }
WhenStatement       { condition, body, otherwise }
FlagStatement       { target, label }
EmitStatement       { fields }
SynthesiseStatement { inputs, alias }
TryCatchStatement   { body, catches }
CatchClause         { failureType, body }
```

**Implementation:** Extend Babel’s parser with RexScript node types. Babel already handles all JS constructs — only RexScript-native nodes need to be added.

### Stage 3: Semantic Analyser

Walks the AST and:

1. **Type inference** — annotates every node with its inferred type
1. **Scope checking** — verifies variables exist before use
1. **Statement category enforcement** — ensures action statements don’t appear where only observations are expected
1. **Risk classification** — annotates every action node with its XRisk risk level
1. **Failure handler checking** — warns when risky operations have no catch block
1. **use.instead routing** — calls Rosetta, attaches detected language to the node
1. **Dynamic feature validation** — if compiled in dynamic-feature mode, enforces the isolation contract

### Stage 4: Code Generator

Walks the annotated AST and emits JavaScript.

Rules:

- Every action node gets XRisk wrapper code injected
- Every `use.instead` node routes to its language-specific handler
- Every RexScript primitive call maps to a `__rex.*` call
- Variable interpolation in `use.instead` blocks is resolved
- The file header comment is emitted (see Easter Eggs)
- Runtime imports are prepended

**Implementation:** Write from scratch. Code generation is simpler than parsing — it’s a tree walk with string concatenation. Should take 2–4 weeks for a working version.

### Transpiler as a Library

The transpiler should be packaged as a Node.js library (`@rexscript/compiler`) so it can be used:

- By the CLI (`rex compile`)
- By the VSCode extension (real-time error checking)
- By Rex itself (to validate dynamic features before submission)
- By the Playground runtime (on-demand compilation)

-----

## 18. THE RUNTIME STANDARD LIBRARY

The `__rex` object that every compiled file depends on. This is a Node.js package: `@rexscript/runtime`.

### `__rex.observe(url, options)`

```js
async observe(url, options = {}) {
  // Launch/reuse Playwright context
  // Navigate to URL
  // Wait for networkidle
  // Run content extraction pipeline:
  //   1. Remove nav, footer, ads, scripts
  //   2. Extract main content
  //   3. Annotate links with surrounding context
  //   4. Identify forms and their field types
  //   5. Score extraction confidence
  // Return PageResult
}
```

**Content Extraction Pipeline:**
Uses a combination of Readability.js (Mozilla’s article extractor), custom heuristics for link annotation, and form detection. Confidence score is based on content-to-noise ratio.

### `__rex.navigate(url, options)`

```js
async navigate(url, options = {}) {
  // Get or create session context
  // Navigate page
  // Handle redirects
  // Return void (use observe after navigate for content)
}
```

### `__rex.find(selector, pageResult)`

```js
async find(selector, pageResult) {
  // Parse natural language selector
  // Score each element in pageResult against selector
  // Return highest confidence match as FindResult
  // If max confidence < 0.5, throw AmbiguousResult
}
```

**NLP Matching:**
v1: keyword extraction + structural position scoring (e.g., “near login form” checks proximity in DOM tree).
v2: embedding-based semantic matching.

### `__rex.remember(data, tags)`

### `__rex.recall(tags, options)`

### `__rex.forget(tags)`

Backed by an in-process vector store. v1: use `vectra` (lightweight in-memory vector store). v2: pluggable backend (Pinecone, Weaviate, etc.).

### `__rex.parallel(tasks, options)`

```js
async parallel(tasks, options = { limit: Infinity }) {
  // Create concurrency-limited executor
  // Run all tasks
  // Collect results and typed failures
  // Return ParallelResult
}
```

### `__rex.synthesise(inputs)`

```js
async synthesise(inputs) {
  // Prepare context from inputs
  // Call configured LLM API
  // Parse and structure response
  // Score confidence
  // Return SynthesisOutput
}
```

LLM provider is configured at the agent level — not hardcoded. Rex’s Playground sets the default.

### `__rex.session(options)`

### `__rex.flag(variable, label)`

### `__rex.check(variable, condition)`

```js
check(variable, condition) {
  // condition: "inaccessible" | "gated" | "loaded" | "empty" | "blocked" | "paywalled"
  // Evaluates PageResult against condition
  // Returns boolean
}
```

-----

## 19. ROSETTA — THE LANGUAGE DETECTION ENGINE

The module that powers `use.instead`. Package: `@rexscript/rosetta`.

### Architecture

```
use.instead block content
        ↓
Rosetta.tokenise(content)        — split into meaningful tokens
        ↓
Rosetta.score(tokens)            — score against each language signature
        ↓
scored candidate list            — [(language, confidence), ...]
        ↓
top candidate                    — if confidence > 0.80, proceed
        ↓
language handler                 — executes the foreign block
        ↓
ForeignResult
```

### Language Signatures (v1 — Weighted Keyword Scoring)

```js
const signatures = {
  sql: {
    keywords: ['SELECT', 'FROM', 'WHERE', 'JOIN', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP'],
    weight: 3,
    structural: ['FROM after SELECT', 'WHERE after FROM']
  },
  python: {
    keywords: ['import', 'def', 'class', 'print', 'return', 'if __name__'],
    weight: 2,
    structural: ['colon at end of control flow', 'indented block']
  },
  bash: {
    keywords: ['#!/bin/bash', 'echo', 'grep', 'curl', 'wget', 'chmod', 'sudo'],
    weight: 3,
    structural: ['pipe operator', '$VARIABLE syntax', 'semicolon chaining']
  },
  graphql: {
    keywords: ['query', 'mutation', 'fragment', 'subscription', '__typename'],
    weight: 3,
    structural: ['nested {} with field names', 'on TypeName']
  },
  regex: {
    structural: ['starts and ends with /', 'flags after closing /']
  },
  xpath: {
    keywords: ['node()', 'text()', 'following-sibling'],
    structural: ['starts with //', '@attribute syntax']
  }
}
```

### Variable Interpolation Pre-Processing

Before Rosetta sees the content, the code generator resolves all `{$variable}` interpolations. Rosetta only sees the final string.

### Language Handlers

Each detected language has a corresponding handler in Rosetta:

- **SQL handler:** Connects to configured DB driver, executes parameterised query, returns result set
- **Python handler:** Spawns `python3` subprocess with stdin/stdout pipes, captures output, returns as string
- **Bash handler:** Spawns sandboxed `sh` process (no network, no filesystem write by default), returns stdout
- **Regex handler:** Constructs native JS RegExp, returns match result
- **GraphQL handler:** Fetches configured GraphQL endpoint with constructed query body
- **XPath handler:** Evaluates XPath against last observed page’s DOM

### Security Constraints on Handlers

- Python subprocess: no network access, read-only filesystem, 30s timeout
- Bash subprocess: no network, no filesystem write outside `/tmp/rex-sandbox/`, 10s timeout
- SQL: parameterised queries only, no raw string execution

XRisk still audits all handler executions. High-risk handlers (bash, python) require CONFIRM classification by default.

-----

## 20. THE CLI

Package: `@rexscript/cli`, installed globally as `rex`.

### Commands

```bash
rex compile <file.rex>
# Transpiles .rex to .js in the same directory
# Options:
#   --out <path>     Output path
#   --watch          Watch for changes and recompile
#   --map            Generate source maps
#   --strict         Treat warnings as errors

rex run <file.rex>
# Compile + execute
# Options:
#   --ghost          Maximum stealth mode (see Easter Eggs)
#   --trace          Output full trace to console
#   --dry-run        Compile and analyse, do not execute

rex check <file.rex>
# Static analysis only. No compilation, no execution.
# Outputs: type errors, risk warnings, missing failure handlers

rex trace <file.rex>
# Run with full structured trace output
# Outputs trace as JSON to stdout or --out file

rex dynamic <file.rex>
# Validate a .rex file against the dynamic feature isolation contract
# Used by Rex before submitting a dynamic feature for approval

rex --meditate
# (See Easter Eggs)

rex --version
# Outputs version with codename
```

### Error Output Format

```
RexError [file.rex:14:3]
  Action statement 'navigate' inside 'find' expression.
  'find' is an observation primitive. Action statements cannot appear inside it.
  
  14 |   find "submit button" in { navigate to $url } as $btn
              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  
  Suggestion: Move 'navigate' before the 'find' statement.
```

### Warning Output Format

```
RexWarning [file.rex:8:1]
  'observe' has no failure handler.
  If this page is inaccessible, the agent will throw an untyped error.
  
  8  | observe page $url as $page
     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  
  Suggestion: Wrap in try/catch Timeout, BlockedByBot, or catch *
  Risk: MEDIUM
```

-----

## 21. VSCODE EXTENSION

Package: `rexscript-vscode`

### Features (v1)

- `.rex` file syntax highlighting
- Keyword autocomplete with documentation on hover
- Inline error display from semantic analyser (real-time)
- Inline warning display
- “Compile to JS” command (Cmd+Shift+B)
- “Run file” command
- Trace viewer panel (parses `.trace.json` files)

### Syntax Highlighting Token Classes

```
keyword.control.rexscript    — observe, navigate, find, parallel, etc.
keyword.memory.rexscript     — remember, recall, forget
keyword.safety.rexscript     — catch, BlockedByBot, RiskBlocked, etc.
variable.rex.rexscript       — $-prefixed variables
string.selector.rexscript    — strings inside find statements
keyword.foreign.rexscript    — use.instead, language hints
entity.session.rexscript     — session names
```

### Hover Documentation

Hovering over any primitive shows:

- Syntax
- Behaviour summary
- Failure modes it can throw
- Compiled JS equivalent

-----

## 22. ERROR MESSAGE DESIGN

Error messages in RexScript are designed to be read by agents as well as humans. They must be:

- **Actionable** — always include a suggestion
- **Contextual** — always include the risk implication
- **Semantic** — use agent-level language, not JS-level language

### Error Message Template

```
RexError [file:line:col]: <what went wrong>
  <why it matters for the agent>

  <line>  | <source code>
           ^^^^^^^^^^^^^

  Suggestion: <concrete fix>
  Risk: <LOW | MEDIUM | HIGH | NONE>
```

### Warning Message Template

```
RexWarning [file:line:col]: <what could go wrong>
  <why the agent should care>

  <line>  | <source code>
           ^^^^^^^^^^^^^

  Suggestion: <concrete fix>
  Risk: <risk level if ignored>
```

### Key Error Messages to Write (Complete List)

```
ERR001  — Unknown keyword
ERR002  — Variable used before declaration
ERR003  — Action statement in observation context
ERR004  — Missing 'as' alias on observe/find/recall
ERR005  — use.instead block ambiguous (< 0.60 confidence)
ERR006  — RiskBlocked at compile time (known-dangerous pattern)
ERR007  — Dynamic feature isolation contract violation
ERR008  — catch * not last in catch chain
ERR009  — parallel with no then handler (warning → error in strict)
ERR010  — synthesise called with empty array
ERR011  — session used after close
ERR012  — recall without prior remember (warning)
ERR013  — forget with no matching remember (warning)
ERR014  — Nested parallel without limit (warning)

WARN001 — observe without failure handler
WARN002 — navigate without failure handler  
WARN003 — use.instead:bash — HIGH risk, confirm XRisk will require approval
WARN004 — parallel limit not set — defaults to Infinity
WARN005 — synthesise confidence not checked after call
WARN006 — use.instead detected with low confidence (0.60–0.80)
WARN007 — $agent accessed in dynamic feature (allowed, but flagged)
```

-----

## 23. EASTER EGGS

### The Compiled File Header

Every `.js` file produced by the transpiler begins with:

```js
// ╔══════════════════════════════════════════════════╗
// ║  Compiled by RexScript v0.1.0 · Hatchling        ║
// ║  "Agents don't browse. They hunt."               ║
// ╚══════════════════════════════════════════════════╝
//
// Do not edit this file. Edit the source .rex file.
// Source: agent.rex · Compiled: 2024-03-12T09:14:22Z
```

The quote changes with every version. All quotes are written by hand. They should feel like the language is alive.

**Quote list (to be written):**

- v0.1 Hatchling: “Agents don’t browse. They hunt.”
- v0.2 Scout: “Every page is a question. Every session is an answer.”
- v0.3 Tracker: “The web was built for humans. RexScript fixed that.”
- v0.5 Hunter: “Nothing is implicit. Nothing is hidden. Everything is traced.”
- v1.0 Apex: “The language was always going to be the top of this.”

### `hunt` — The Dangerous Alias

`hunt` is a fully valid alias for `observe`. Identical behaviour. Exists because agents that feel purposeful write better code.

```js
hunt page $url as $prey   // completely valid RexScript
```

The compiled output is identical to `observe`. The trace entry uses `"action": "hunt"` instead of `"action": "observe"` — a small difference that makes the trace readable in a different way.

### The Haiku Field

Every XRisk trace entry contains a `haiku` field. The haiku is generated deterministically from a seeded hash of:

- The session ID
- The action sequence so far
- The current timestamp (day-level, not second-level — same day = same haiku)

This means the same session doing the same things on the same day always gets the same haiku. Reproducible. Auditable. Beautiful.

The haiku generator uses a small curated word bank (~500 words) seeded with agent-relevant vocabulary. It produces valid 5-7-5 syllable haiku.

Example outputs:

```
pages turn to dust / the agent remembers all / nothing stays hidden
crawling through the web / each link a thread in the dark / the answer waits still
observe what is there / decide what matters most now / act and leave no trace
```

### `agent.whoami`

A built-in callable anywhere in RexScript:

```js
let $identity = agent.whoami
```

Returns:

```json
{
  "agent": "Rex",
  "session": "session-a7f2",
  "memorySize": "142 entries",
  "traceCount": 47,
  "riskLevel": "LOW",
  "uptime": "00:04:17",
  "status": "hunting"
}
```

If called with no active session:

```
No active session. Rex is watching though.
```

### `--ghost` Mode

```bash
rex run agent.rex --ghost
```

Maximum anti-detection. All sessions use `fingerprint: stealth`. Zero console output. No trace written to disk (still audited internally by XRisk — the ghost can’t hide from itself).

The CLI confirms ghost mode with a single line:

```
◈ ghost
```

And then silence.

### The Confidence Easter Egg

When any result’s `.confidence` is exactly `1.0`:

```
[REX] Confidence: 1.0 — flawless.
```

This should be rare enough that when it happens, it feels like something.

### `rex --meditate`

Prints a random line from the RexScript philosophy document. 20 hand-written lines, rotated randomly. No other output. The command has no other function.

Example outputs:

```
An agent that cannot fail gracefully cannot succeed reliably.
Parallel is not a feature. It is the natural state of thought.
The language contains the other languages. It does not fear them.
Safety is not a constraint on what the agent can do. It is the proof that what the agent does is real.
Nothing in RexScript is implicit. If you cannot see it, it is not there.
```

### `rex --lore`

Prints the complete history of the RexScript stack — Rex, XRisk, Playground, the language — as a one-page narrative. Not documentation. A story. Written once, never changed.

### The `$trail` Variable

An auto-injected read-only variable available in every `.rex` file. Contains the compressed trace of everything the current session has done so far. Agents can read their own history.

```js
let $history = $trail.last(10)   // last 10 trace entries
let $firstAction = $trail.first  // first action of the session
```

### Version Codenames — Full Table

|Version|Codename |Meaning                         |
|-------|---------|--------------------------------|
|v0.1   |Hatchling|It’s alive. Barely.             |
|v0.2   |Scout    |It can go places.               |
|v0.3   |Tracker  |It knows where it’s been.       |
|v0.5   |Hunter   |It goes after things on purpose.|
|v0.8   |Pack     |Other agents can use it too.    |
|v1.0   |Apex     |Top of the stack.               |
|v2.0   |—        |(unnamed. earned, not planned.) |

-----

## 24. VERSION NAMING SYSTEM

### Release Philosophy

RexScript versions are named, not just numbered. The name is the identity of that version — what it can do that the previous one couldn’t.

### Pre-Alpha (current phase)

Grammar specification, transpiler core, basic primitives. No public release.

### v0.1 — Hatchling

- `observe`, `navigate`, `find`
- Basic type system (`PageResult`, `FindResult`)
- XRisk integration (LOW/MEDIUM risk only)
- CLI (`rex compile`, `rex run`, `rex check`)
- Compiled file header with version + quote

### v0.2 — Scout

- `remember`, `recall`, `forget`
- `session` primitive
- `parallel` (basic, no limit)
- `use.instead` (SQL and Regex only)
- VSCode syntax highlighting

### v0.3 — Tracker

- Full failure type system
- `try/catch` with all failure types
- `when` statement
- `flag`, `emit`
- `--ghost` mode
- `agent.whoami`

### v0.5 — Hunter

- `use.instead` full language support (Python, Bash, GraphQL, XPath)
- Rosetta confidence scoring
- Dynamic feature mode (`rex dynamic`)
- `$trail` variable
- Haiku trace field
- `rex --meditate`

### v0.8 — Pack

- Public package release (`@rexscript/compiler`, `@rexscript/runtime`)
- Full VSCode extension with hover docs
- Cross-session memory (v2 memory system)
- RexScript Playground (browser-based REPL)

### v1.0 — Apex

- Full language spec complete
- Dynamic feature system fully integrated with Rex
- `rex --lore`
- Language specification published as a paper

-----

## 25. BUILD ORDER & QUALITY BARS

|# |Component                   |Build Order|Quality Bar                                       |Est. Time|
|--|----------------------------|-----------|--------------------------------------------------|---------|
|1 |Philosophy document         |First      |Exceptional — everything derives from this        |1 week   |
|2 |Grammar specification (EBNF)|Second     |Rigorous — errors here break everything           |2 weeks  |
|3 |Primitive definitions (full)|Third      |Thorough — every edge case documented             |1 week   |
|4 |Failure type system         |Fourth     |Exceptional — the biggest differentiator          |1 week   |
|5 |Lexer (fork Acorn/Babel)    |Fifth      |Solid engineering                                 |2–3 weeks|
|6 |Parser (extend Babel AST)   |Sixth      |Solid engineering                                 |3–4 weeks|
|7 |Semantic analyser           |Seventh    |Careful — risk classification must be right       |3–4 weeks|
|8 |Code generator              |Eighth     |Functional — correctness over elegance            |2–3 weeks|
|9 |Runtime standard library    |Ninth      |Production — agents depend on this                |4–6 weeks|
|10|XRisk integration           |Tenth      |Tight — the safety moat                           |2 weeks  |
|11|Rosetta (language detection)|Eleventh   |Good enough for v1                                |2–3 weeks|
|12|CLI                         |Twelfth    |Functional and polished                           |1–2 weeks|
|13|Error messages              |Throughout |Every message written by hand                     |Ongoing  |
|14|VSCode extension            |After CLI  |Good enough for v1                                |2–3 weeks|
|15|Easter eggs                 |Throughout |Delightful — these are what people screenshot     |Ongoing  |
|16|Dynamic feature integration |After v0.3 |Mission-critical — this is why the language exists|3–4 weeks|

**Total realistic timeline (part-time alongside everything else):** 12–18 months to v1.0 Apex

**Total realistic timeline (focused):** 6–8 months to v1.0 Apex

-----

## 26. WHAT MAKES THIS UNPRECEDENTED

To be stated clearly, once, so it is never forgotten during the build:

**No one has shipped a programming language designed from the ground up for AI agents.**

Not a framework. Not a library. Not a prompt DSL. Not a configuration language. A language. With a grammar. A transpiler. A type system. A runtime. A safety layer baked into the syntax.

**No one has built a language where the agent writes its own extensions in that language natively.**

Rex doesn’t write its dynamic features in JavaScript anymore. It writes them in RexScript — a language it knows completely, where every construct is something it already thinks in, where safety is automatic, where failures have names, where context flows transparently.

**No one has built a language that auto-detects and hosts other languages with unbroken context and audit trail.**

`use.instead` is not a feature that exists anywhere in this form. Other systems require you to manage the boundary manually. RexScript makes the boundary transparent.

**The stack this sits on top of is itself unprecedented.**

XRisk — a standalone AI safety layer. Rex’s Playground — a browser runtime built for agents. Rex — an agent that extends itself. RexScript — the language that makes self-extension native.

Four layers. Each one built because the layer above needed it. Each one more powerful because the others exist.

This is not a project. This is a philosophy with a working implementation.

Build it right.

-----

*RexScript Master Specification — Pre-Alpha*  
*Authored alongside Rex, for Rex, by the mind that built Rex.*  
*“The language was always going to be the top of this.”*