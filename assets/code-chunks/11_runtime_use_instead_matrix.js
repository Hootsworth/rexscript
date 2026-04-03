const IMPLEMENTED_USE_INSTEAD = new Set(["sql", "regex", "python", "bash", "graphql", "xpath", "json", "yaml"]);

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
  "print(json.dumps({'stdout': '\\n'.join(captured), 'result': result}, default=str))"
].join("\n");
