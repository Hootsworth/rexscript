fact $budget = { "budget": 0.10 };

spawn agent "DetailScraper" with $budget as $workerBot;

parallel distributed limit 5 {
    hunt page "https://example.com/item/1" as $p1;
    hunt page "https://example.com/item/2" as $p2;
} then synthesise [$p1, $p2] as $merged;

send { "urls": $merged } to $workerBot;

attempt {
    fact $results = receive from $workerBot;
    remember $results tagged "output" mode vector;
} recover Timeout {
    telemetry {
        exporter "datadog"
        endpoint "http-intake"
        key $budget
    }
}
