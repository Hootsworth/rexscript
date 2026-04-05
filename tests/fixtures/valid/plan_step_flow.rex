plan "Research pricing changes" {
  step "Capture source page" {
    observe page "data:text/html,<html><head><title>Pricing</title></head><body><h1>Pricing</h1><p>Starter plan</p></body></html>" as $page
  }

  step "Summarise pricing notes" {
    synthesise [$page] as $summary
  }
}
