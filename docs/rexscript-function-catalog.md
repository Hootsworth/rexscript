# RexScript Function Catalog (v0.1)

This catalog lists the currently supported RexScript statements from the compiler parser and code generator.

## Core Execution And Flow

### 1) `expect { ... } otherwise ...`

```rex
expect {
  observe page "https://example.com" as $page
} otherwise * {
  skip
}
```

### 2) `try { ... } catch ...`

```rex
try {
  use.instead:sql as $rows {
    SELECT * FROM posts
  }
} catch QueryFailed {
  use default []
}
```

### 3) `when ... { ... } otherwise { ... }`

```rex
when $page is loaded {
  emit { action: "loaded" }
} otherwise {
  skip
}
```

### 4) `parallel [limit N] { ... } then ...`

```rex
parallel limit 2 {
  observe page "https://example.com/a" as $a
  observe page "https://example.com/b" as $b
} then synthesise [$a, $b] as $joined
```

### 5) `skip`

```rex
skip
```

### 6) `retry`

```rex
retry
```

## Data Collection And Navigation

### 7) `observe page <urlExpr> [with session <name>] as <var>`

```rex
observe page "https://example.com" as $page
```

### 8) `hunt page <urlExpr> ... as <var>`

```rex
hunt page "https://example.com/search?q=rex" as $resultPage
```

### 9) `navigate to <urlExpr> [with session <name>] [with { headers... }]`

```rex
navigate to "https://example.com/docs" with session s1 with { "Authorization": "Bearer token" }
```

### 10) `navigate back`

```rex
navigate back
```

### 11) `navigate forward`

```rex
navigate forward
```

### 12) `find "selector" in <var|{raw}> as <var>`

```rex
find "h1" in $page as $title
```

## Memory And Synthesis

### 13) `remember <var> tagged "tag1", "tag2"`

```rex
remember $title tagged "headline", "home"
```

### 14) `forget tagged "tag1", "tag2"`

```rex
forget tagged "headline"
```

### 15) `recall tagged "tag1", "tag2" [where relevance > N] as <var>`

```rex
recall tagged "headline" where relevance > 0.7 as $memory
```

### 16) `synthesise [<var>, ...] [as <var>]`

```rex
synthesise [$title, $memory] as $summary
```

## Session, Policy, And Signals

### 17) `session <name> with { ... }`

```rex
session s1 with { headless: true, locale: "en-US" }
```

### 18) `flag <var> as <identifier>`

```rex
flag $page as unavailable
```

### 19) `emit { ... }`

```rex
emit { action: "audit", step: "collect" }
```

### 20) `rotate proxy`

```rex
rotate proxy
```

## Foreign Executor Bridge

### 21) `use.instead[:lang] [as <var>] { ... } [catch ...]`

```rex
use.instead:python as $out {
  print("hello")
} catch ForeignExecutionDenied {
  use default { ok: false }
}
```

### 22) `use default <expr>`

```rex
use default []
```

## Conditions Currently Parsed In `when`

- `$var is loaded`
- `$var is empty`
- `$var seems_unreliable`
- `$var confidence > 0.8`
- fallback raw JS-like condition text

## Host JavaScript Escape Hatch

Any line that is not a recognized RexScript keyword is parsed as host JavaScript and passed through to output.

```rex
console.log("Host JS inside RexScript");
```

This is useful for quick debugging and integration with custom runtime helpers.