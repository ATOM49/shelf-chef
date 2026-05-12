-- CreateTable
CREATE TABLE "InstamartWorkflowSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstamartWorkflowSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstamartWorkflowSession_userId_updatedAt_idx" ON "InstamartWorkflowSession"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "InstamartWorkflowSession" ADD CONSTRAINT "InstamartWorkflowSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
