-- CreateEnum
CREATE TYPE "public"."LatePassRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "public"."LatePassRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "status" "public"."LatePassRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "LatePassRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LatePassRequest_userId_gameweekId_key" ON "public"."LatePassRequest"("userId", "gameweekId");

-- AddForeignKey
ALTER TABLE "public"."LatePassRequest" ADD CONSTRAINT "LatePassRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LatePassRequest" ADD CONSTRAINT "LatePassRequest_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "public"."SeasonGameweek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
