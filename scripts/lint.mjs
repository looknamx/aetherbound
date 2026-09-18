// Dependency-free project lint rules, using the already installed TypeScript parser.
import ts from "typescript";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
let failures = 0;
function scan(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      scan(path);
      continue;
    }
    if (!/\.tsx?$/.test(path)) continue;
    const source = ts.createSourceFile(
      path,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node) {
      let message;
      if (node.kind === ts.SyntaxKind.AnyKeyword)
        message = "Explicit any is prohibited.";
      if (ts.isDebuggerStatement(node)) message = "Remove debugger statements.";
      if (
        ts.isBinaryExpression(node) &&
        [
          ts.SyntaxKind.EqualsEqualsToken,
          ts.SyntaxKind.ExclamationEqualsToken,
        ].includes(node.operatorToken.kind)
      )
        message = "Use strict equality.";
      if (message) {
        const { line, character } = source.getLineAndCharacterOfPosition(
          node.getStart(source),
        );
        console.error(`${path}:${line + 1}:${character + 1} ${message}`);
        failures++;
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
for (const folder of ["client", "shared", "server", "tests"]) scan(folder);
if (failures) process.exitCode = 1;
else
  console.log(
    "Lint passed: no explicit any, debugger statements or loose equality.",
  );
