-- CreateTable
CREATE TABLE "public"."GameweekTeamResult" (
    "id" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "goalsFor" INTEGER NOT NULL,
    "goalsAgainst" INTEGER NOT NULL,

    CONSTRAINT "GameweekTeamResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameweekTeamResult_gameweekId_teamId_key" ON "public"."GameweekTeamResult"("gameweekId", "teamId");

-- AddForeignKey
ALTER TABLE "public"."GameweekTeamResult" ADD CONSTRAINT "GameweekTeamResult_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "public"."SeasonGameweek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GameweekTeamResult" ADD CONSTRAINT "GameweekTeamResult_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
