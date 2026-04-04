# RexScript Task Program Set For Testing And ML Training

This document provides varied RexScript programs you can run directly in terminal for manual testing and for building a training corpus.

## Dataset Notes

- Keep one file per task in a dataset directory, for example `datasets/rexscript/tasks/`.
- Naming suggestion: `task_001_hello_world.rex`, `task_002_basic_observe.rex`, etc.
- Include at least one positive and one failure-path sample per feature.

## Task 001: Hello World

```rex
expect {
  console.log("Hello, world from RexScript!");
  emit { action: "hello_world" }
} otherwise * {
  emit { action: "hello_world_fallback" }
  skip
}
```

## Task 002: Basic Observe + Find

```rex
expect {
  observe page "https://example.com" as $page
  find "h1" in $page as $title
  emit { action: "found_title", selector: "h1" }
} otherwise * {
  skip
}
```

## Task 003: Hunt Flow

```rex
expect {
  hunt page "https://example.com/search?q=rexscript" as $resultPage
  emit { action: "hunt_done" }
} otherwise * {
  skip
}
```

## Task 004: Session Navigation

```rex
expect {
  session s1 with { headless: true }
  observe page "https://example.com" with session s1 as $home
  navigate to "https://example.com/docs" with session s1
  navigate back
  navigate forward
  emit { action: "session_navigation_complete" }
} otherwise * {
  skip
}
```

## Task 005: Memory Store And Recall

```rex
expect {
  observe page "https://example.com" as $page
  remember $page tagged "home", "snapshot"
  recall tagged "home" as $mem
  synthesise [$mem] as $summary
  emit { action: "memory_roundtrip" }
} otherwise * {
  skip
}
```

## Task 006: Relevance Filter Recall

```rex
expect {
  recall tagged "home", "snapshot" where relevance > 0.5 as $filtered
  emit { action: "recall_threshold" }
} otherwise * {
  skip
}
```

## Task 007: Forget Memory Tags

```rex
expect {
  forget tagged "snapshot"
  emit { action: "forget_done" }
} otherwise * {
  skip
}
```

## Task 008: When Loaded Condition

```rex
expect {
  observe page "https://example.com" as $page
  when $page is loaded {
    emit { action: "loaded_path" }
  } otherwise {
    emit { action: "not_loaded_path" }
    skip
  }
} otherwise * {
  skip
}
```

## Task 009: When Empty Condition

```rex
expect {
  recall tagged "missing" as $mem
  when $mem is empty {
    emit { action: "empty_memory" }
  } otherwise {
    emit { action: "non_empty_memory" }
  }
} otherwise * {
  skip
}
```

## Task 010: Confidence Condition

```rex
expect {
  use.instead:sql as $rows {
    SELECT id FROM posts LIMIT 3
  }
  when $rows confidence > 0.7 {
    emit { action: "high_confidence_rows" }
  } otherwise {
    emit { action: "low_confidence_rows" }
  }
} otherwise * {
  skip
}
```

## Task 011: use.instead SQL With Fallback

```rex
expect {
  use.instead:sql as $rows {
    SELECT id, title FROM posts LIMIT 5
  } catch QueryFailed {
    use default []
  }
  synthesise [$rows] as $report
} otherwise * {
  skip
}
```

## Task 012: use.instead Python With Fallback

```rex
expect {
  use.instead:python as $py {
    print("training sample")
  } catch ForeignExecutionDenied {
    use default { ok: false, reason: "python_denied" }
  }
  emit { action: "python_adapter_attempted" }
} otherwise * {
  skip
}
```

## Task 013: Generic Try/Catch

```rex
try {
  use.instead:bash as $result {
    echo "unsafe command"
  }
} catch ForeignExecutionDenied {
  emit { action: "blocked_by_policy" }
}
```

## Task 014: Parallel Observe

```rex
expect {
  parallel limit 2 {
    observe page "https://example.com/a" as $a
    observe page "https://example.com/b" as $b
  } then synthesise [$a, $b] as $joined
  emit { action: "parallel_complete" }
} otherwise * {
  skip
}
```

## Task 015: Flag Risky Target

```rex
expect {
  observe page "https://example.com" as $page
  flag $page as unavailable
  emit { action: "flagged" }
} otherwise * {
  skip
}
```

## Task 016: Rotate Proxy + Retry Pattern

```rex
expect {
  rotate proxy
  retry
} otherwise * {
  skip
}
```

## Task 017: Host JS Interop

```rex
expect {
  const startedAt = Date.now();
  console.log("interop", startedAt);
  emit { action: "host_js_interop" }
} otherwise * {
  skip
}
```

## Task 018: Full Mini Pipeline

```rex
expect {
  session s1 with { headless: true }
  observe page "https://example.com/data" with session s1 as $page
  find "article" in $page as $rows
  remember $rows tagged "rows", "latest"
  recall tagged "rows" as $memory
  synthesise [$rows, $memory] as $summary
  emit { action: "mini_pipeline_complete" }
} otherwise * {
  emit { action: "mini_pipeline_fallback" }
  skip
}
```

## Terminal Test Commands

Run from `compiler/`:

```bash
npm run -s rex:check -- ../tests/fixtures/valid/hello_world.rex
npm run -s rex:compile -- ../tests/fixtures/valid/hello_world.rex ./.rex-run/hello_world.js default --map
npm run -s rex:run -- ../tests/fixtures/valid/hello_world.rex default --trace-out ../tests/integration/hello_world.runtime.trace.json
```

## ML Training Suggestions

- Build train/validation splits by feature family (navigation, memory, foreign execution, control flow).
- Add hard negatives: syntactically close but invalid samples.
- Keep labels for each sample: `features`, `risk_level`, `expected_diagnostics`.
- Include paired data: natural-language task prompt and target RexScript.