-- CreateEnum
CREATE TYPE "RecipeImageJobStatus" AS ENUM ('PENDING', 'GENERATING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "RecipeImageJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "householdId" TEXT,
    "recipeId" TEXT NOT NULL,
    "recipeTitle" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "cuisine" TEXT,
    "prompt" TEXT NOT NULL,
    "status" "RecipeImageJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "mimeType" TEXT,
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeImageJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecipeImageJob_userId_recipeId_key" ON "RecipeImageJob"("userId", "recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeImageJob_householdId_recipeId_key" ON "RecipeImageJob"("householdId", "recipeId");

-- CreateIndex
CREATE INDEX "RecipeImageJob_status_updatedAt_idx" ON "RecipeImageJob"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "RecipeImageJob_userId_status_idx" ON "RecipeImageJob"("userId", "status");

-- CreateIndex
CREATE INDEX "RecipeImageJob_householdId_status_idx" ON "RecipeImageJob"("householdId", "status");

-- AddForeignKey
ALTER TABLE "RecipeImageJob" ADD CONSTRAINT "RecipeImageJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeImageJob" ADD CONSTRAINT "RecipeImageJob_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
