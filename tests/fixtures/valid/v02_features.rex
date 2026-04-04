tool fetch_docs($topic) {
  rationale "Fetching documents from internal knowledge base";
  use.instead:python as $docs {
    # mock fetch
    return [{"title": "Agent Patterns", "content": "Agents hunt."}]
  }
  return $docs;
}

goal "Analyze document type" {
  equip fetch_docs;

  fact $query = "AI";
  fact $data = $query | fetch_docs;
  
  remember $data tagged "docs" mode vector;
  
  recall tagged "docs" where relevance > 80 mode vector as $similarDocs;
  
  assess $similarDocs {
    case "contains patterns":
      flag $similarDocs as useful;
    case "contains nonsense":
      skip;
    otherwise:
      throw "Unknown doc type";
  }
}
