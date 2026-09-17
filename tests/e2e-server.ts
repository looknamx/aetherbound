import { createGameServer } from "../server/app";
const server = createGameServer({ devTools: true, archive: true });
await server.listen(3101, "127.0.0.1");
console.log("E2E server ready");
