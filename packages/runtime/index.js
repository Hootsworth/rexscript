import rosetta from "../rosetta/index.js";
import { spawnSync } from "node:child_process";

const __memory = [];
const __sessions = new Map();
const MAX_SNIPPET = 220;
const MAX_MEMORY_ENTRIES = 500;
const IMPLEMENTED_USE_INSTEAD = new Set(["sql", "regex", "python", "bash", "graphql", "xpath", "json", "yaml"]);
const PLANNED_USE_INSTEAD = [];
let __pythonCommand = undefined;
let __playwrightLoader = undefined;

const PYTHON_RUNNER = [
  "import json, sys",
  "payload = json.loads(sys.stdin.read() or '{}')",
  "ctx = payload.get('context', {})",
  "code = payload.get('code', '')",
  "safe_builtins = {",
  "  'len': len, 'sum': sum, 'min': min, 'max': max, 'sorted': sorted,",
  "  'str': str, 'int': int, 'float': float, 'bool': bool,",
  "  'list': list, 'dict': dict, 'range': range, 'enumerate': enumerate",
  "}",
  "globals_env = {'__builtins__': safe_builtins}",
  "locals_env = {'context': ctx}",
  "captured = []",
  "def _rex_print(*args):",
  "  captured.append(' '.join(str(a) for a in args))",
  "globals_env['print'] = _rex_print",
  "exec(code, globals_env, locals_env)",
  "result = locals_env.get('result')",
  "if result is None and '_result' in locals_env:",
  "  result = locals_env.get('_result')",
  "safe_locals = {}",
  "for k, v in locals_env.items():",
  "  if k.startswith('_') or k == 'context':",
  "    continue",
  "  try:",
  "    json.dumps(v)",
  "    safe_locals[k] = v",
  "  except Exception:",
  "    safe_locals[k] = str(v)",
  "print(json.dumps({'stdout': '\\n'.join(captured), 'result': result, 'locals': safe_locals}, default=str))"
].join("\n");

function nowIso() {
  return new Date().toISOString();
}

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripTags(html) {
  const withoutScripts = String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");

  return decodeHtmlEntities(withoutScripts.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function extractTitle(html) {
  const match = String(html || "").match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return decodeHtmlEntities((match?.[1] || "").replace(/\s+/g, " ").trim()) || "Untitled Page";
}

function extractLinks(html, baseUrl) {
  const raw = String(html || "");
  const links = [];
  const linkPattern = /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;

  let match;
  while ((match = linkPattern.exec(raw)) && links.length < 100) {
    const href = (match[1] || match[2] || match[3] || "").trim();
    if (!href) {
      continue;
    }
    let absolute = href;
    try {
      absolute = new URL(href, baseUrl).toString();
    } catch {
      absolute = href;
    }
    const text = stripTags(match[4] || "").slice(0, 160);
    links.push({ href: absolute, text });
  }

  return links;
}

function extractForms(html) {
  const raw = String(html || "");
  const forms = [];
  const formPattern = /<form\b([^>]*)>/gi;
  let match;
  while ((match = formPattern.exec(raw)) && forms.length < 20) {
    const attrs = match[1] || "";
    const actionMatch = attrs.match(/action\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const methodMatch = attrs.match(/method\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    forms.push({
      action: (actionMatch?.[1] || actionMatch?.[2] || actionMatch?.[3] || "").trim() || null,
      method: ((methodMatch?.[1] || methodMatch?.[2] || methodMatch?.[3] || "GET").trim() || "GET").toUpperCase()
    });
  }
  return forms;
}

function calculateConfidence({ contentLength, title, linksCount, status }) {
  let score = 0.45;
  if (status >= 200 && status < 300) score += 0.2;
  if (title && title !== "Untitled Page") score += 0.1;
  if (contentLength > 200) score += 0.1;
  if (contentLength > 1200) score += 0.05;
  if (linksCount > 0) score += 0.05;
  return Math.min(0.99, Number(score.toFixed(2)));
}

async function fetchPage(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "RexScriptRuntime/0.1 (+agentic execution)"
      }
    });
    const html = await response.text();
    return {
      status: response.status,
      ok: response.ok,
      finalUrl: response.url || url,
      headers: Object.fromEntries(response.headers.entries()),
      html
    };
  } finally {
    clearTimeout(timeout);
  }
}

function browserAdapterPreference() {
  const raw = String(process.env.REX_RUNTIME_BROWSER_ADAPTER || "auto").trim().toLowerCase();
  if (raw === "playwright") return "playwright";
  if (raw === "fetch") return "fetch";
  return "auto";
}

function browserAdapterStrict() {
  return process.env.REX_RUNTIME_BROWSER_ADAPTER_STRICT === "1";
}

async function loadPlaywrightChromium() {
  if (process.env.REX_RUNTIME_PLAYWRIGHT_DISABLE === "1") {
    return null;
  }
  if (__playwrightLoader !== undefined) {
    return __playwrightLoader;
  }
  try {
    const mod = await import("playwright");
    __playwrightLoader = mod?.chromium || null;
    return __playwrightLoader;
  } catch {
    __playwrightLoader = null;
    return __playwrightLoader;
  }
}

async function ensurePlaywrightSession(session, options = {}) {
  const chromium = await loadPlaywrightChromium();
  if (!chromium) {
    return null;
  }

  if (!session.__browserState) {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    session.__browserState = {
      kind: "playwright",
      browser,
      context,
      page
    };
  }

  const timeoutMs = Number(options.timeout || 15000);
  session.__browserState.page.setDefaultNavigationTimeout(timeoutMs);
  session.__browserState.page.setDefaultTimeout(timeoutMs);

  return session.__browserState;
}

async function observeViaPlaywright(url, options = {}) {
  const timeoutMs = Number(options.timeout || 15000);
  const browserState = options.browserState;
  const page = browserState.page;

  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs
  });

  const html = await page.content();
  const status = response?.status?.() ?? 200;
  const ok = response ? response.ok() : true;
  const headers = response?.headers?.() || {};

  return {
    status,
    ok,
    finalUrl: page.url() || url,
    headers,
    html
  };
}

function resolveObserveAdapter(session) {
  const pref = browserAdapterPreference();
  if (pref === "fetch") {
    return "fetch";
  }
  if (pref === "playwright") {
    return "playwright";
  }
  if (session) {
    return "playwright";
  }
  return "fetch";
}

async function cleanupTransientBrowserState(browserState) {
  if (!browserState) {
    return;
  }
  try {
    await browserState.context?.close?.();
  } catch {
    // no-op
  }
  try {
    await browserState.browser?.close?.();
  } catch {
    // no-op
  }
}

function resolveSessionRef(sessionOpt) {
  if (!sessionOpt) {
    return null;
  }
  if (typeof sessionOpt === "string") {
    return __sessions.get(sessionOpt) || null;
  }
  if (typeof sessionOpt === "object" && sessionOpt.id) {
    return __sessions.get(sessionOpt.id) || sessionOpt;
  }
  return null;
}

async function closeSessionBrowserState(session) {
  const state = session?.__browserState;
  if (!state) {
    return;
  }
  try {
    await state.context?.close?.();
  } catch {
    // no-op
  }
  try {
    await state.browser?.close?.();
  } catch {
    // no-op
  }
  delete session.__browserState;
}

function makeRuntimeError(name, message) {
  const err = new Error(message || name);
  err.name = name;
  err.code = name;
  return err;
}

function ensureSessionOpen(session, actionName) {
  if (!session) {
    return;
  }
  if (session.closed || session.active === false) {
    throw makeRuntimeError("SessionClosed", `${actionName} attempted on closed session ${session.id}`);
  }
}

function buildPage({ url, html, status = 200, ok = true, sessionId = null, headers = {}, error = null, adapter = "fetch" }) {
  const title = extractTitle(html);
  const content = stripTags(html).slice(0, 10000);
  const links = extractLinks(html, url);
  const forms = extractForms(html);
  const confidence = calculateConfidence({
    contentLength: content.length,
    title,
    linksCount: links.length,
    status
  });

  return {
    url,
    title,
    content,
    links,
    forms,
    confidence,
    trace: {
      action: "observe",
      timestamp: nowIso(),
      riskLevel: ok ? "LOW" : "MEDIUM",
      sessionId
    },
    metadata: {
      status,
      ok,
      adapter,
      headers,
      contentLength: content.length,
      fetchedAt: nowIso(),
      error
    },
    raw: String(html || "")
  };
}

function keywordTokens(selector) {
  return String(selector || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .slice(0, 12);
}

function makeSnippet(content, index) {
  if (index < 0) {
    return content.slice(0, MAX_SNIPPET);
  }
  const start = Math.max(0, index - 60);
  return content.slice(start, start + MAX_SNIPPET);
}

function semanticFind(selector, source) {
  const tokens = keywordTokens(selector);
  const content = String(source?.content || source || "").toLowerCase();

  if (!content) {
    return {
      selector,
      source,
      confidence: 0.1,
      element: null,
      matches: [],
      reason: "Empty source content"
    };
  }

  const matches = [];
  for (const token of tokens) {
    const idx = content.indexOf(token);
    if (idx >= 0) {
      const snippet = makeSnippet(String(source?.content || source || ""), idx);
      matches.push({ token, index: idx, snippet });
    }
  }

  const coverage = tokens.length > 0 ? matches.length / tokens.length : 0;
  const base = tokens.length === 0 ? 0.4 : 0.25;
  const confidence = Math.min(0.99, Number((base + coverage * 0.7).toFixed(2)));
  const best = matches[0] || null;

  return {
    selector,
    source,
    confidence,
    element: best
      ? {
          text: best.snippet,
          token: best.token
        }
      : null,
    matches,
    reason: best ? "Matched semantic tokens in source content" : "No semantic token matches found"
  };
}

function normalizeRows(context) {
  if (Array.isArray(context?.rows)) {
    return context.rows;
  }
  if (Array.isArray(context)) {
    return context;
  }
  return [];
}

function parseSql(sql) {
  const source = String(sql || "").trim().replace(/\s+/g, " ");
  const m = source.match(/^select\s+(.+?)\s+from\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(.*)$/i);
  if (!m) {
    throw makeRuntimeError("QueryFailed", "Unsupported SQL shape. Expected SELECT ... FROM ...");
  }

  const fieldsRaw = m[1].trim();
  const table = m[2].trim();
  const tail = m[3] || "";

  let limit = null;
  const limitMatch = tail.match(/\blimit\s+(\d+)\b/i);
  if (limitMatch) {
    limit = Number(limitMatch[1]);
  }

  let where = null;
  const whereMatch = tail.match(/\bwhere\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(=|!=|>=|<=|>|<)\s*(?:'([^']*)'|"([^"]*)"|(\d+(?:\.\d+)?))\b/i);
  if (whereMatch) {
    where = {
      field: whereMatch[1],
      op: whereMatch[2],
      value: whereMatch[3] ?? whereMatch[4] ?? Number(whereMatch[5])
    };
  }

  const fields = fieldsRaw === "*" ? ["*"] : fieldsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  return { fields, table, where, limit };
}

function compareWhere(lhs, op, rhs) {
  if (op === "=") return lhs === rhs;
  if (op === "!=") return lhs !== rhs;
  if (op === ">") return lhs > rhs;
  if (op === "<") return lhs < rhs;
  if (op === ">=") return lhs >= rhs;
  if (op === "<=") return lhs <= rhs;
  return false;
}

function executeSql(sql, context = {}) {
  const parsed = parseSql(sql);
  const rows = normalizeRows(context);

  let filtered = rows;
  if (parsed.where) {
    filtered = rows.filter((row) => compareWhere(row?.[parsed.where.field], parsed.where.op, parsed.where.value));
  }

  let projected = filtered;
  if (!(parsed.fields.length === 1 && parsed.fields[0] === "*")) {
    projected = filtered.map((row) => {
      const out = {};
      for (const f of parsed.fields) {
        out[f] = row?.[f];
      }
      return out;
    });
  }

  if (Number.isFinite(parsed.limit)) {
    projected = projected.slice(0, parsed.limit);
  }

  return {
    table: parsed.table,
    rows: projected,
    rowCount: projected.length,
    parsed
  };
}

function parseRegexExpression(content) {
  const text = String(content || "").trim();
  const literalMatch = text.match(/^\/(.*)\/([a-z]*)$/i);
  if (literalMatch) {
    return {
      pattern: literalMatch[1],
      flags: literalMatch[2] || "g"
    };
  }
  return {
    pattern: text,
    flags: "g"
  };
}

function executeRegex(content, context = {}) {
  const expr = parseRegexExpression(content);
  const input = String(context?.text ?? context?.content ?? "");

  let re;
  try {
    re = new RegExp(expr.pattern, expr.flags.includes("g") ? expr.flags : `${expr.flags}g`);
  } catch (err) {
    throw makeRuntimeError("PatternError", `Invalid regex: ${String(err?.message || err)}`);
  }

  const matches = [];
  let match;
  while ((match = re.exec(input)) && matches.length < 200) {
    matches.push({
      match: match[0],
      index: match.index,
      groups: match.slice(1)
    });
    if (match[0] === "") {
      re.lastIndex += 1;
    }
  }

  return {
    pattern: expr.pattern,
    flags: expr.flags,
    matchCount: matches.length,
    matches
  };
}

function resolvePythonCommand() {
  if (__pythonCommand !== undefined) {
    return __pythonCommand;
  }

  const candidates = ["python3", "python"];
  for (const cmd of candidates) {
    const probe = spawnSync(cmd, ["--version"], {
      encoding: "utf8",
      timeout: 1000
    });
    if (!probe.error && (probe.status === 0 || probe.stdout || probe.stderr)) {
      __pythonCommand = cmd;
      return __pythonCommand;
    }
  }

  __pythonCommand = null;
  return __pythonCommand;
}

function assertPythonSandbox(content) {
  const text = String(content || "").toLowerCase();
  const blocked = [
    /\bimport\b/,
    /\bopen\s*\(/,
    /\bexec\s*\(/,
    /\beval\s*\(/,
    /\b__import__\b/,
    /\bos\./,
    /\bsubprocess\b/,
    /\bsys\./,
    /\bglobals\s*\(/,
    /\blocals\s*\(/
  ];

  for (const pattern of blocked) {
    if (pattern.test(text)) {
      throw makeRuntimeError("ForeignExecutionDenied", "Python sandbox denied restricted operation");
    }
  }
}

function executePython(content, context = {}) {
  assertPythonSandbox(content);

  const python = resolvePythonCommand();
  if (!python) {
    throw makeRuntimeError("ForeignRuntimeMissing", "Python runtime not found for use.instead:python");
  }

  const proc = spawnSync(python, ["-I", "-S", "-c", PYTHON_RUNNER], {
    encoding: "utf8",
    input: JSON.stringify({ code: String(content || ""), context }),
    timeout: 2500,
    maxBuffer: 1024 * 1024
  });

  if (proc.error) {
    if (proc.error.code === "ETIMEDOUT") {
      throw makeRuntimeError("ExecutionTimeout", "Python executor timed out");
    }
    throw makeRuntimeError("PythonExecutionError", String(proc.error.message || proc.error));
  }

  if ((proc.status ?? 0) !== 0) {
    const stderr = String(proc.stderr || "").trim();
    throw makeRuntimeError("PythonExecutionError", stderr || "Python executor failed");
  }

  const stdout = String(proc.stdout || "").trim();
  if (!stdout) {
    return {
      stdout: "",
      result: null,
      locals: {}
    };
  }

  try {
    const parsed = JSON.parse(stdout);
    return {
      stdout: parsed.stdout ?? "",
      result: parsed.result ?? null,
      locals: parsed.locals ?? {}
    };
  } catch {
    throw makeRuntimeError("PythonExecutionError", "Python executor returned invalid JSON output");
  }
}

function parseShellWords(raw) {
  const text = String(raw || "").trim();
  if (!text) {
    throw makeRuntimeError("ForeignExecutionDenied", "bash executor received empty command");
  }

  // Reject shell metacharacters to avoid command chaining, redirects, and expansion.
  if (/[|&;<>`$(){}]/.test(text)) {
    throw makeRuntimeError("ForeignExecutionDenied", "bash executor denied unsafe shell syntax");
  }

  const parts = text.match(/(?:"[^"]*"|'[^']*'|\S+)/g) || [];
  return parts.map((p) => p.replace(/^"|"$/g, "").replace(/^'|'$/g, ""));
}

function allowedBashCommands() {
  const raw = process.env.REX_BASH_ALLOWED_COMMANDS;
  if (!raw || String(raw).trim() === "") {
    return new Set(["echo", "pwd", "date", "whoami", "uname", "ls"]);
  }
  return new Set(
    String(raw)
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
  );
}

function executeBash(content, _context = {}) {
  if (process.env.REX_BASH_EXECUTOR_ENABLE !== "1") {
    throw makeRuntimeError("ForeignExecutionDenied", "bash executor disabled; set REX_BASH_EXECUTOR_ENABLE=1 to opt in");
  }

  const argv = parseShellWords(content);
  const command = argv[0];
  const args = argv.slice(1);

  const allow = allowedBashCommands();
  if (!allow.has(command)) {
    throw makeRuntimeError("ForeignExecutionDenied", `bash command '${command}' denied by allowlist`);
  }

  const proc = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 2000,
    maxBuffer: 512 * 1024,
    shell: false
  });

  if (proc.error) {
    if (proc.error.code === "ETIMEDOUT") {
      throw makeRuntimeError("ExecutionTimeout", "bash executor timed out");
    }
    throw makeRuntimeError("BashExecutionError", String(proc.error.message || proc.error));
  }

  return {
    command,
    args,
    status: proc.status ?? 0,
    stdout: String(proc.stdout || "").trim(),
    stderr: String(proc.stderr || "").trim()
  };
}

function parseGraphqlContent(content, context = {}) {
  const text = String(content || "").trim();
  if (!text) {
    throw makeRuntimeError("QueryFailed", "GraphQL executor requires a query or mutation body");
  }

  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      const query = parsed.query || "";
      if (!query) {
        throw makeRuntimeError("QueryFailed", "GraphQL JSON payload is missing 'query'");
      }
      return {
        query,
        variables: parsed.variables || context.variables || {},
        operationName: parsed.operationName || context.operationName || null
      };
    } catch (err) {
      if (err?.name === "QueryFailed") {
        throw err;
      }
      throw makeRuntimeError("QueryFailed", "Invalid GraphQL JSON payload");
    }
  }

  return {
    query: text,
    variables: context.variables || {},
    operationName: context.operationName || null
  };
}

function parseAllowedGraphqlEndpoints() {
  const raw = process.env.REX_GRAPHQL_ALLOWED_ENDPOINTS;
  if (!raw || String(raw).trim() === "") {
    return [];
  }
  return String(raw)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function endpointAllowed(endpoint, allowlist) {
  if (!Array.isArray(allowlist) || allowlist.length === 0) {
    return false;
  }
  return allowlist.some((allowed) => endpoint === allowed || endpoint.startsWith(`${allowed}`));
}

async function defaultGraphqlTransport(request) {
  const timeoutMs = Number(process.env.REX_GRAPHQL_TIMEOUT_MS || 4000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(request.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(request.headers || {})
      },
      body: JSON.stringify(request.body),
      signal: controller.signal
    });

    const data = await response.json();
    return {
      status: response.status,
      data
    };
  } catch (err) {
    if (err?.name === "AbortError") {
      throw makeRuntimeError("ExecutionTimeout", `GraphQL request timed out after ${timeoutMs}ms`);
    }
    throw makeRuntimeError("QueryFailed", String(err?.message || err));
  } finally {
    clearTimeout(timer);
  }
}

async function executeGraphql(content, context = {}) {
  const endpoint = String(context.endpoint || process.env.REX_GRAPHQL_ENDPOINT || "").trim();
  if (!endpoint) {
    throw makeRuntimeError("ForeignExecutionDenied", "GraphQL endpoint missing; provide context.endpoint or REX_GRAPHQL_ENDPOINT");
  }

  const allowlist = parseAllowedGraphqlEndpoints();
  if (!endpointAllowed(endpoint, allowlist)) {
    throw makeRuntimeError("ForeignExecutionDenied", `GraphQL endpoint '${endpoint}' denied by allowlist`);
  }

  const payload = parseGraphqlContent(content, context);
  const request = {
    endpoint,
    body: payload,
    headers: context.headers || {}
  };

  const transport = typeof context.transport === "function" ? context.transport : defaultGraphqlTransport;
  const response = await transport(request);
  const status = Number(response?.status ?? 0);
  const body = response?.data ?? null;
  const errors = Array.isArray(body?.errors) ? body.errors : [];

  if (errors.length > 0) {
    throw makeRuntimeError("QueryFailed", `GraphQL responded with ${errors.length} error(s)`);
  }

  return {
    endpoint,
    status,
    data: body?.data ?? null,
    errors,
    operationName: payload.operationName,
    query: payload.query
  };
}

function parseXpathQuery(query) {
  const text = String(query || "").trim();
  let m = text.match(/^\/\/([a-zA-Z][a-zA-Z0-9_-]*)\/text\(\)$/);
  if (m) {
    return { kind: "text", tag: m[1].toLowerCase() };
  }

  m = text.match(/^\/\/([a-zA-Z][a-zA-Z0-9_-]*)\/@([a-zA-Z_:][a-zA-Z0-9_:\-\.]*)$/);
  if (m) {
    return { kind: "attribute", tag: m[1].toLowerCase(), attribute: m[2].toLowerCase() };
  }

  m = text.match(/^\/\/([a-zA-Z][a-zA-Z0-9_-]*)$/);
  if (m) {
    return { kind: "element", tag: m[1].toLowerCase() };
  }

  throw makeRuntimeError("QueryFailed", `Unsupported XPath query: ${text}`);
}

function extractTagText(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const out = [];
  let match;
  while ((match = re.exec(html)) && out.length < 200) {
    out.push(decodeHtmlEntities(String(match[1] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()));
  }
  return out;
}

function extractTagAttribute(html, tag, attr) {
  const re = new RegExp(`<${tag}\\b([^>]*)>`, "gi");
  const out = [];
  let match;
  while ((match = re.exec(html)) && out.length < 200) {
    const attrs = match[1] || "";
    const attrRe = new RegExp(`${attr}\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))`, "i");
    const attrMatch = attrs.match(attrRe);
    if (attrMatch) {
      out.push(attrMatch[1] || attrMatch[2] || attrMatch[3] || "");
    }
  }
  return out;
}

function extractTagElements(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
  const out = [];
  let match;
  while ((match = re.exec(html)) && out.length < 100) {
    out.push(String(match[0] || "").slice(0, 280));
  }
  return out;
}

function executeXpath(content, context = {}) {
  const parsed = parseXpathQuery(content);
  const html = String(context?.html || context?.page?.raw || context?.raw || "");

  if (!html) {
    return {
      query: String(content || ""),
      kind: parsed.kind,
      matches: [],
      matchCount: 0,
      note: "No HTML context provided"
    };
  }

  let matches = [];
  if (parsed.kind === "text") {
    matches = extractTagText(html, parsed.tag);
  } else if (parsed.kind === "attribute") {
    matches = extractTagAttribute(html, parsed.tag, parsed.attribute);
  } else {
    matches = extractTagElements(html, parsed.tag);
  }

  return {
    query: String(content || ""),
    kind: parsed.kind,
    tag: parsed.tag,
    attribute: parsed.attribute || null,
    matches,
    matchCount: matches.length
  };
}

function coerceYamlScalar(value) {
  const trimmed = String(value || "").trim();
  if (trimmed === "") return "";
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function executeJson(content, _context = {}) {
  const text = String(content || "").trim();
  if (!text) {
    throw makeRuntimeError("QueryFailed", "JSON payload is empty");
  }
  try {
    return {
      value: JSON.parse(text)
    };
  } catch (err) {
    throw makeRuntimeError("QueryFailed", `Invalid JSON payload: ${String(err?.message || err)}`);
  }
}

function executeYaml(content, _context = {}) {
  const text = String(content || "").replace(/\t/g, "  ");
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "" && !line.trim().startsWith("#"));
  if (lines.length === 0) {
    throw makeRuntimeError("QueryFailed", "YAML payload is empty");
  }

  const root = {};
  const stack = [{ indent: -1, value: root }];

  for (const rawLine of lines) {
    const indent = rawLine.match(/^\s*/)?.[0]?.length ?? 0;
    const line = rawLine.trim();
    const idx = line.indexOf(":");
    if (idx <= 0) {
      throw makeRuntimeError("QueryFailed", `Invalid YAML line: ${line}`);
    }

    const key = line.slice(0, idx).trim();
    const rhs = line.slice(idx + 1).trim();
    if (!key) {
      throw makeRuntimeError("QueryFailed", `Invalid YAML key in line: ${line}`);
    }

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].value;
    if (typeof parent !== "object" || parent == null || Array.isArray(parent)) {
      throw makeRuntimeError("QueryFailed", `Invalid YAML nesting near: ${line}`);
    }

    if (rhs === "") {
      parent[key] = {};
      stack.push({ indent, value: parent[key] });
    } else {
      parent[key] = coerceYamlScalar(rhs);
    }
  }

  return {
    value: root
  };
}

function resolveLanguageHint(hint, content) {
  if (hint && hint !== "auto") {
    return {
      language: hint,
      confidence: 0.99,
      via: "hint"
    };
  }

  const detected = rosetta.detect(content);
  return {
    language: detected.language,
    confidence: Number(detected.confidence ?? 0),
    alternatives: detected.alternatives || [],
    via: "rosetta"
  };
}

function getUseInsteadSupportMatrix() {
  return {
    implemented: [...IMPLEMENTED_USE_INSTEAD],
    planned: [...PLANNED_USE_INSTEAD],
    totalKnown: IMPLEMENTED_USE_INSTEAD.size + PLANNED_USE_INSTEAD.length
  };
}

const runtime = {
  async observe(url, options = {}) {
    const target = url || options.url || "about:blank";
    const session = resolveSessionRef(options.session);
    ensureSessionOpen(session, "observe");
    const sessionId = session?.id || null;
    const selectedAdapter = resolveObserveAdapter(session);
    const strictAdapter = browserAdapterStrict();
    let adapterUsed = "fetch";
    let transientBrowserState = null;

    try {
      let response;
      if (selectedAdapter === "playwright") {
        const owner = session || {
          id: `transient-${Date.now()}`,
          history: []
        };
        const browserState = await ensurePlaywrightSession(owner, options);
        if (browserState) {
          response = await observeViaPlaywright(target, {
            ...options,
            browserState
          });
          adapterUsed = "playwright";
          if (!session) {
            transientBrowserState = browserState;
          }
        } else if (strictAdapter || selectedAdapter === "playwright") {
          if (strictAdapter) {
            throw makeRuntimeError("BrowserAdapterUnavailable", "Playwright adapter requested but playwright is not installed");
          }
          response = await fetchPage(target, Number(options.timeout || 15000));
          adapterUsed = "fetch-fallback-playwright-unavailable";
        }
      }

      if (!response) {
        response = await fetchPage(target, Number(options.timeout || 15000));
        adapterUsed = "fetch";
      }

      if (session) {
        session.history.push({ url: response.finalUrl, timestamp: nowIso(), action: "observe" });
      }

      return buildPage({
        url: response.finalUrl,
        html: response.html,
        status: response.status,
        ok: response.ok,
        sessionId,
        headers: response.headers,
        adapter: adapterUsed
      });
    } catch (err) {
      if (strictAdapter && selectedAdapter === "playwright") {
        throw err;
      }
      return buildPage({
        url: target,
        html: "",
        status: 0,
        ok: false,
        sessionId,
        error: String(err?.message || err),
        adapter: adapterUsed
      });
    } finally {
      await cleanupTransientBrowserState(transientBrowserState);
    }
  },

  async hunt(url, options = {}) {
    const page = await runtime.observe(url, options);
    if (page && page.trace) {
      page.trace.action = "hunt";
    }
    return page;
  },

  async navigate(url, options = {}) {
    const session = resolveSessionRef(options.session);
    ensureSessionOpen(session, "navigate");
    const strictAdapter = browserAdapterStrict();
    let adapter = "fetch";

    if (session && resolveObserveAdapter(session) === "playwright") {
      const browserState = await ensurePlaywrightSession(session, options);
      if (browserState) {
        await browserState.page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: Number(options.timeout || 15000)
        });
        adapter = "playwright";
      } else {
        if (strictAdapter) {
          throw makeRuntimeError("BrowserAdapterUnavailable", "Playwright adapter requested but playwright is not installed");
        }
        adapter = "fetch-fallback-playwright-unavailable";
      }
    }

    if (session) {
      session.currentUrl = url;
      session.history.push({ url, timestamp: nowIso(), action: "navigate" });
    }
    return { ok: true, url, sessionId: session?.id || null, adapter };
  },

  async navigateBack(options = {}) {
    const session = resolveSessionRef(options.session);
    ensureSessionOpen(session, "navigateBack");
    let adapter = "fetch";
    if (session && session.__browserState?.page) {
      await session.__browserState.page.goBack({
        waitUntil: "domcontentloaded",
        timeout: Number(options.timeout || 15000)
      }).catch(() => null);
      session.currentUrl = session.__browserState.page.url() || session.currentUrl;
      adapter = "playwright";
    }
    if (session && session.history.length > 1) {
      session.history.pop();
      session.currentUrl = session.history[session.history.length - 1]?.url || null;
    }
    return { ok: true, direction: "back", url: session?.currentUrl || null, sessionId: session?.id || null, adapter };
  },

  async navigateForward(options = {}) {
    const session = resolveSessionRef(options.session);
    ensureSessionOpen(session, "navigateForward");
    let adapter = "fetch";
    if (session && session.__browserState?.page) {
      await session.__browserState.page.goForward({
        waitUntil: "domcontentloaded",
        timeout: Number(options.timeout || 15000)
      }).catch(() => null);
      session.currentUrl = session.__browserState.page.url() || session.currentUrl;
      adapter = "playwright";
    }
    return { ok: true, direction: "forward", url: session?.currentUrl || null, sessionId: session?.id || null, adapter };
  },

  async find(selector, source) {
    return semanticFind(selector, source);
  },

  async remember(data, tags = []) {
    if (__memory.length >= MAX_MEMORY_ENTRIES) {
      throw makeRuntimeError("MemoryOverflow", `Memory capacity exceeded (${MAX_MEMORY_ENTRIES} entries)`);
    }
    __memory.push({ data, tags, timestamp: nowIso() });
    return { stored: true };
  },

  async recall(tags = [], options = {}) {
    const threshold = options.threshold ?? 0;
    return __memory
      .filter((m) => tags.length === 0 || tags.some((t) => m.tags.includes(t)))
      .map((m) => ({ ...m, relevance: 0.9 }))
      .filter((m) => m.relevance >= threshold);
  },

  async forget(tags = []) {
    if (tags.includes("*")) {
      __memory.length = 0;
      return { removed: "all" };
    }
    for (let i = __memory.length - 1; i >= 0; i -= 1) {
      if (tags.some((t) => __memory[i].tags.includes(t))) {
        __memory.splice(i, 1);
      }
    }
    return { removed: true };
  },

  async synthesise(inputs = []) {
    const normalized = Array.isArray(inputs) ? inputs : [inputs];

    const textParts = normalized
      .map((item) => {
        if (item == null) return "";
        if (typeof item === "string") return item;
        if (typeof item === "number" || typeof item === "boolean") return String(item);
        if (typeof item === "object") {
          if (typeof item.summary === "string") return item.summary;
          if (typeof item.content === "string") return item.content;
          if (typeof item.title === "string") return item.title;
          try {
            return JSON.stringify(item);
          } catch {
            return String(item);
          }
        }
        return String(item);
      })
      .map((part) => part.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    const combined = textParts.join(" ").trim();
    const tokens = combined
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3);

    const stop = new Set([
      "the", "and", "for", "with", "that", "this", "from", "into", "when", "where",
      "are", "was", "were", "have", "has", "had", "then", "than", "there", "their",
      "about", "after", "before", "while", "will", "would", "could", "should", "into",
      "your", "you", "our", "its", "they", "them", "which", "what", "who", "whom"
    ]);

    const frequency = new Map();
    for (const token of tokens) {
      if (stop.has(token)) continue;
      frequency.set(token, (frequency.get(token) || 0) + 1);
    }

    const keywords = Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([word]) => word);

    const trimmed = combined.slice(0, 420);
    const content = trimmed || `Synthesised ${normalized.length} inputs`;
    const summary = keywords.length
      ? `Synthesised ${normalized.length} inputs; key topics: ${keywords.join(", ")}`
      : `Synthesised ${normalized.length} inputs`;

    const nonEmptyRatio = normalized.length === 0 ? 0 : textParts.length / normalized.length;
    const densityBoost = Math.min(0.2, (keywords.length / 8) * 0.2);
    const confidence = Number(Math.min(0.99, 0.5 + nonEmptyRatio * 0.3 + densityBoost).toFixed(2));

    return {
      content,
      summary,
      confidence,
      sources: normalized,
      keywords,
      stats: {
        inputCount: normalized.length,
        nonEmptyInputs: textParts.length,
        tokenCount: tokens.length
      }
    };
  },

  async session(options = {}) {
    const id = options.id || `session-${Date.now()}`;
    const session = {
      id,
      active: true,
      closed: false,
      currentUrl: null,
      history: [],
      __browserState: null,
      ...options,
      async close() {
        this.closed = true;
        this.active = false;
        await closeSessionBrowserState(this);
      }
    };
    __sessions.set(id, session);
    return session;
  },

  flag(_value, _label) {
    return true;
  },

  async rotateProxy() {
    return { rotated: true };
  },

  retry() {
    return { retry: true };
  },

  async check(variable, condition) {
    if (condition === "empty") {
      return !variable || (typeof variable === "string" && variable.length === 0);
    }
    if (condition === "seems_unreliable") {
      return Number(variable?.confidence ?? 1) < 0.5;
    }
    if (condition === "loaded") {
      return true;
    }
    if (condition === "inaccessible" || condition === "blocked" || condition === "gated" || condition === "paywalled") {
      return false;
    }
    return false;
  },

  async useInstead({ hint = null, content = "", context = {} } = {}) {
    const resolved = resolveLanguageHint(hint, content);
    const language = String(resolved.language || "unknown").toLowerCase();
    if (language === "unknown" && resolved.confidence < 0.6) {
      throw makeRuntimeError("AmbiguousForeignLanguage", "Unable to determine use.instead language with confidence >= 0.60");
    }

    const strictExecutors = process.env.REX_USE_INSTEAD_STRICT_EXECUTORS === "1";
    const support = getUseInsteadSupportMatrix();

    let output;
    let executor = "passthrough";

    if (language === "sql") {
      output = executeSql(content, context);
      executor = "native";
    } else if (language === "regex") {
      output = executeRegex(content, context);
      executor = "native";
    } else if (language === "python") {
      output = executePython(content, context);
      executor = "native";
    } else if (language === "bash") {
      output = executeBash(content, context);
      executor = "native";
    } else if (language === "graphql") {
      output = await executeGraphql(content, context);
      executor = "native";
    } else if (language === "xpath") {
      output = executeXpath(content, context);
      executor = "native";
    } else if (language === "json") {
      output = executeJson(content, context);
      executor = "native";
    } else if (language === "yaml") {
      output = executeYaml(content, context);
      executor = "native";
    } else {
      const explicitHint = hint && hint !== "auto";
      if (explicitHint || strictExecutors) {
        throw makeRuntimeError("ForeignRuntimeMissing", `No runtime executor is implemented for use.instead:${language}`);
      }
      output = {
        passthrough: true,
        content,
        reason: `No runtime executor for ${language}; returning passthrough output`
      };
    }

    return {
      output,
      language,
      executor,
      confidence: resolved.confidence,
      raw: content,
      via: resolved.via,
      alternatives: resolved.alternatives || [],
      support
    };
  },

  useInsteadSupport() {
    return getUseInsteadSupportMatrix();
  },

  isFailure(err, failureType) {
    return Boolean(err && (err.name === failureType || err.code === failureType));
  },

  async parallel(tasks = [], options = {}) {
    const start = Date.now();
    const limit = Number.isFinite(options.limit) ? Math.max(1, options.limit) : tasks.length;
    const results = [];
    const failures = [];

    let cursor = 0;
    async function worker() {
      while (cursor < tasks.length) {
        const current = cursor;
        cursor += 1;
        try {
          const value = await tasks[current]();
          results.push(value);
        } catch (e) {
          failures.push({ index: current, error: String(e?.message || e) });
        }
      }
    }

    const workers = [];
    for (let i = 0; i < Math.min(limit, tasks.length || 1); i += 1) {
      workers.push(worker());
    }
    await Promise.all(workers);

    return {
      results,
      failures,
      duration: Math.max(0, Date.now() - start)
    };
  }
};

export default runtime;
