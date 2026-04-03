// Compiled by RexScript compiler scaffold
import __rex from '@rexscript/runtime';
import __xrisk from '@rexscript/xrisk';

async function __rex_main() {
  await __xrisk.before({ action: "remember", target: $seed, capability: "MEMORY" });
  const __rex_result_1 = await __rex.remember($seed, ["bootstrap"]);
  await __xrisk.after({ action: "remember", riskLevel: "LOW", result: __rex_result_1 ?? null });
  let $a, $b, $c;
  const __rex_parallel_5 = await __rex.parallel([
    async () => {
      await __xrisk.before({ action: "observe", target: "https://example.com/a", capability: "NETWORK" });
      const __rex_result_2 = await __rex.observe("https://example.com/a", { session: null });
      await __xrisk.after({ action: "observe", riskLevel: "LOW", result: __rex_result_2 ?? null });
      const $a = __rex_result_2;
      return { name: "$a", value: $a };
    },
    async () => {
      await __xrisk.before({ action: "observe", target: "https://example.com/b", capability: "NETWORK" });
      const __rex_result_3 = await __rex.observe("https://example.com/b", { session: null });
      await __xrisk.after({ action: "observe", riskLevel: "LOW", result: __rex_result_3 ?? null });
      const $b = __rex_result_3;
      return { name: "$b", value: $b };
    },
    async () => {
      await __xrisk.before({ action: "observe", target: "https://example.com/c", capability: "NETWORK" });
      const __rex_result_4 = await __rex.observe("https://example.com/c", { session: null });
      await __xrisk.after({ action: "observe", riskLevel: "LOW", result: __rex_result_4 ?? null });
      const $c = __rex_result_4;
      return { name: "$c", value: $c };
    }
  ], { limit: 3 });
  for (const __r of (__rex_parallel_5.results || [])) {
    if (!__r || !__r.name) continue;
    switch (__r.name) {
      case "$a": $a = __r.value; break;
      case "$b": $b = __r.value; break;
      case "$c": $c = __r.value; break;
      default: break;
    }
  }
  await __xrisk.before({ action: "synthesise", target: null, capability: "MODEL" });
  const __rex_result_6 = await __rex.synthesise([$a, $b, $c]);
  await __xrisk.after({ action: "synthesise", riskLevel: "MEDIUM", result: __rex_result_6 ?? null });
  const $summary = __rex_result_6;
  await __xrisk.before({ action: "recall", target: ["bootstrap"], capability: "MEMORY" });
  const __rex_result_7 = await __rex.recall(["bootstrap"]);
  await __xrisk.after({ action: "recall", riskLevel: "LOW", result: __rex_result_7 ?? null });
  const $memory = __rex_result_7;
  await __xrisk.before({ action: "synthesise", target: null, capability: "MODEL" });
  const __rex_result_8 = await __rex.synthesise([$summary, $memory]);
  await __xrisk.after({ action: "synthesise", riskLevel: "MEDIUM", result: __rex_result_8 ?? null });
  const $report = __rex_result_8;
}

await __rex_main();
