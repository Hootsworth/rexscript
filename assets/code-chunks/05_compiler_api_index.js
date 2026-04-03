export function checkFile(filePath, options = {}) {
  const source = readSource(filePath);
  const ast = parse(source);
  const diagnostics = analyze(ast, options);
  const merged = [...diagnostics.errors, ...diagnostics.warnings];
  return {
    diagnostics,
    formatted: formatDiagnostics(merged, filePath, source)
  };
}

export function compileFile(filePath, options = {}) {
  const source = readSource(filePath);
  const ast = parse(source);
  const diagnostics = analyze(ast, options);
  if (diagnostics.errors.length > 0) {
    return {
      ok: false,
      diagnostics,
      code: null,
      formatted: formatDiagnostics([...diagnostics.errors, ...diagnostics.warnings], filePath, source)
    };
  }

  const generatedFile = options.generatedFile || filePath.replace(/\.rex$/i, ".js");
  const generated = generate(ast, {
    sourceFile: filePath,
    generatedFile
  });

  return {
    ok: true,
    diagnostics,
    code: generated.code,
    map: generated.map,
    formatted: formatDiagnostics(diagnostics.warnings, filePath, source)
  };
}
