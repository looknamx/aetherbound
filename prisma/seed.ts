import { PrismaClient } from "@prisma/client";
import { UNITS, ITEMS, TRAITS, ODDS } from "../shared/content";
const db = new PrismaClient();
try {
  await db.contentVersion.upsert({
    where: { id: "v1" },
    create: {
      id: "v1",
      data: { units: UNITS, items: ITEMS, traits: TRAITS, odds: ODDS },
    },
    update: {
      data: { units: UNITS, items: ITEMS, traits: TRAITS, odds: ODDS },
    },
  });
} finally {
  await db.$disconnect();
}
