import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { balanceReport } from "../server/headless";
const count = Number(process.argv[2] ?? 3),
  seed = Number(process.argv[3] ?? 1);
if (
  !Number.isInteger(count) ||
  count < 1 ||
  count > 100 ||
  !Number.isSafeInteger(seed) ||
  seed < 0 ||
  seed > 0xffffffff
)
  throw Error(
    "Usage: npm run simulate -- <1..100 matches> <seed> [output.json]",
  );
const report = balanceReport(
  Array.from({ length: count }, (_, i) => (seed + i) >>> 0),
);
const output = resolve(process.argv[4] ?? "artifacts/balance/latest.json");
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2));
console.log("Completed " + count + " headless matches; report: " + output);
console.log(
  "Average rounds: " + report.matches.reduce((n, m) => n + m.rounds, 0) / count,
);
