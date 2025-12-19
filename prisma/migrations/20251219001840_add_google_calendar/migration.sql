-- CreateTable
CREATE TABLE "StaffCalendarConnection" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "accessToken" TEXT,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "tokenType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffCalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffCalendarConnection_staffId_key" ON "StaffCalendarConnection"("staffId");

-- CreateIndex
CREATE INDEX "StaffCalendarConnection_provider_calendarId_idx" ON "StaffCalendarConnection"("provider", "calendarId");

-- AddForeignKey
ALTER TABLE "StaffCalendarConnection" ADD CONSTRAINT "StaffCalendarConnection_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
