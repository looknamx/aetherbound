import { mkdir, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import type { Room } from "../shared/types";
export async function archiveMatch(room: Room) {
  const summary = {
    key: room.key,
    startedAt: new Date(room.createdAt).toISOString(),
    finishedAt: new Date().toISOString(),
    rounds: room.round,
    rankings: room.players.map((p) => ({
      name: p.name,
      rank: p.rank,
      hp: p.hp,
    })),
  };
  if (process.env.DATABASE_URL) {
    const { PrismaClient } = await import("@prisma/client");
    const db = new PrismaClient();
    try {
      await db.matchArchive.create({ data: { roomKey: room.key, summary } });
    } finally {
      await db.$disconnect();
    }
  } else {
    await mkdir(".data/matches", { recursive: true });
    const path = join(".data/matches", `${room.key}-${room.createdAt}.json`);
    await writeFile(path + ".tmp", JSON.stringify(summary, null, 2));
    await rename(path + ".tmp", path);
  }
}
