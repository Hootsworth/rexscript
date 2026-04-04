goal "Find out what RexScript is" constraint { budget < 0.10 } {
  attempt {
      hunt page "https://github.com" as $content;
      synthesise [$content] as $summary;
  } recover Timeout {
      telemetry {
          exporter "console"
          endpoint "local"
      }
  }
}
