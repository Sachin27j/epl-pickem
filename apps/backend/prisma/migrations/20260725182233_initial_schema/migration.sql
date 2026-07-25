/*
  Warnings:

  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - Added the required column `passwordHash` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "LeagueRole" AS ENUM ('ADMIN', 'PLAYER');

-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "GameweekStatus" AS ENUM ('UPCOMING', 'OPEN', 'LOCKED', 'REVEALED');

-- CreateEnum
CREATE TYPE "FixtureStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "ResultSource" AS ENUM ('API', 'MANUAL');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('PICK_SUBMITTED', 'PICK_UPDATED', 'PREDICTION_BOOST_USED', 'LATE_PASS_USED', 'FIXTURES_IMPORTED', 'GAMEWEEK_REVEALED', 'SEASON_CREATED');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "password",
ADD COLUMN     "passwordHash" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "role" "LeagueRole" NOT NULL DEFAULT 'PLAYER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueSettings" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "predictionBoosts" INTEGER NOT NULL DEFAULT 5,
    "latePasses" INTEGER NOT NULL DEFAULT 3,
    "deadlineOffsetMinutes" INTEGER NOT NULL DEFAULT 60,

    CONSTRAINT "LeagueSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SeasonStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "logoUrl" TEXT,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonGameweek" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" "GameweekStatus" NOT NULL,

    CONSTRAINT "SeasonGameweek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fixture" (
    "id" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "kickoff" TIMESTAMP(3) NOT NULL,
    "status" "FixtureStatus" NOT NULL,
    "homeGoals" INTEGER,
    "awayGoals" INTEGER,
    "source" "ResultSource" NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "Fixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pick" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "predictionBoostUsed" BOOLEAN NOT NULL DEFAULT false,
    "predictedHomeGoals" INTEGER,
    "predictedAwayGoals" INTEGER,
    "latePassUsed" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "basePoints" INTEGER NOT NULL DEFAULT 0,
    "gdBonus" INTEGER NOT NULL DEFAULT 0,
    "predictionMultiplier" INTEGER NOT NULL DEFAULT 1,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Pick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandingSnapshot" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,

    CONSTRAINT "StandingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT,
    "gameweekId" TEXT,
    "eventType" "EventType" NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "League_inviteCode_key" ON "League"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueMember_userId_leagueId_key" ON "LeagueMember"("userId", "leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueSettings_leagueId_key" ON "LeagueSettings"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_shortName_key" ON "Team"("shortName");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonGameweek_seasonId_number_key" ON "SeasonGameweek"("seasonId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Pick_userId_gameweekId_key" ON "Pick"("userId", "gameweekId");

-- AddForeignKey
ALTER TABLE "LeagueMember" ADD CONSTRAINT "LeagueMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMember" ADD CONSTRAINT "LeagueMember_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueSettings" ADD CONSTRAINT "LeagueSettings_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonGameweek" ADD CONSTRAINT "SeasonGameweek_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "SeasonGameweek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "SeasonGameweek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandingSnapshot" ADD CONSTRAINT "StandingSnapshot_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandingSnapshot" ADD CONSTRAINT "StandingSnapshot_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "SeasonGameweek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandingSnapshot" ADD CONSTRAINT "StandingSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "SeasonGameweek"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
