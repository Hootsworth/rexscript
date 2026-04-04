fact $datadogKey = "12345";

telemetry {
  exporter "datadog"
  endpoint "https://http-intake.logs.datadoghq.com/api/v2/logs"
  key $datadogKey
}

goal "Scrape e-commerce listings" constraint {
  budget < 0.05
  timeout < 30s
} {
  rationale "Beginning scrape with strict $0.05 budget";
  
  attempt {
    hunt page "https://example.com/products" as $products;
    synthesise [$products] as $clean;
  } recover Timeout {
    emit { "error": "timed out" };
  }
}
