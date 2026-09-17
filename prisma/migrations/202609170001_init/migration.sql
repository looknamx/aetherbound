CREATE TABLE "MatchArchive" ("id" TEXT NOT NULL, "roomKey" TEXT NOT NULL, "summary" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "MatchArchive_pkey" PRIMARY KEY ("id"));
CREATE TABLE "ContentVersion" ("id" TEXT NOT NULL, "data" JSONB NOT NULL, CONSTRAINT "ContentVersion_pkey" PRIMARY KEY ("id"));
