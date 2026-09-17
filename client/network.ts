import { io } from "socket.io-client";
import type { Action, Reply } from "../shared/types";
export const socket = io({ autoConnect: false, reconnection: true });
export function request(event: string, payload: unknown): Promise<Reply> {
  return new Promise((resolve) => {
    socket
      .timeout(7000)
      .emit(event, payload, (err: Error | null, reply: Reply) =>
        resolve(
          err
            ? { ok: false, error: "Connection timed out. Please reconnect." }
            : reply,
        ),
      );
  });
}
export const sendAction = (action: Action) =>
  request("action", {
    version: 1,
    id: Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join(""),
    action,
  });
