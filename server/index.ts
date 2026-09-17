import { createGameServer } from "./app";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
if (existsSync(".env")) loadEnvFile(".env");
const server = createGameServer({
  devTools: process.env.ENABLE_DEV_TOOLS === "true",
});
const port = await server.listen(
  Number(process.env.PORT) || 3001,
  process.env.HOST || "0.0.0.0",
);
console.log(
  `Aetherbound authoritative server listening on http://localhost:${port}`,
);
process.on("SIGINT", () => void server.close().then(() => process.exit(0)));
