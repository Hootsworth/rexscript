function emitRiskWrapped(ctx, indent, meta, callExpr, assignTo = null) {
  const resultTemp = nextTemp(ctx, "result");
  const loc = meta?.loc ? JSON.stringify(meta.loc) : "null";
  const lines = [];

  lines.push(
    `${indent}await __xrisk.before({ action: ${JSON.stringify(meta.action)}, target: ${meta.target || "null"}, capability: ${JSON.stringify(meta.capability)}, loc: ${loc} });`
  );
  lines.push(`${indent}const ${resultTemp} = await ${callExpr};`);
  lines.push(
    `${indent}await __xrisk.after({ action: ${JSON.stringify(meta.action)}, riskLevel: ${JSON.stringify(meta.riskLevel)}, result: ${resultTemp} ?? null, loc: ${loc} });`
  );

  if (assignTo) {
    lines.push(`${indent}const ${assignTo} = ${resultTemp};`);
  }
  return lines.join("\n");
}
