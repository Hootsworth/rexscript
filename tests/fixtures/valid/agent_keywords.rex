goal "Find best deals" constraint { budget < 100 } {
  rationale "Start fresh scope to avoid memory bloat";
  workspace "deals" {
    attempt {
      observe page "https://example.com/deals" as $dealsPage;
      fact $data = $dealsPage | extract_deals;
      state $isGood = false;
      
      when confidence($data) > 80 {
        $isGood = true;
      } otherwise {
        $isGood = false;
        throw "Not enough confidence";
      }
    } upto 3 timeout 15s recover Timeout {
      emit { "error": "timed out" };
    } recover {
      emit { "error": "unknown failure" };
    } ensure {
      rationale "Cleanup phase";
    }
  }
}
