-- CreateTable
CREATE TABLE "Scheme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "department" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'Telangana',
    "beneficiaryGroup" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "benefitSummary" TEXT,
    "applicationUrl" TEXT,
    "officialSourceUrl" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "lastVerifiedAt" DATETIME,
    "deadline" DATETIME,
    "deadlineNote" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SchemeRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schemeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "valueJson" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "evidenceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SchemeRule_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SchemeRule_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "SchemeEvidence" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SchemeEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schemeId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceTitle" TEXT NOT NULL,
    "quotedText" TEXT,
    "verifiedAt" DATETIME,
    "verifiedBy" TEXT,
    "notes" TEXT,
    CONSTRAINT "SchemeEvidence_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schemeId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "actor" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VerificationRecord_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "age" INTEGER,
    "state" TEXT,
    "district" TEXT,
    "educationLevel" TEXT,
    "occupation" TEXT,
    "annualIncome" INTEGER,
    "incomeBand" TEXT,
    "isGuest" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "documentName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChecklistItem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChecklistItem_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrackedApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INTERESTED',
    "followUpDate" DATETIME,
    "notes" TEXT,
    "statusUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackedApplication_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrackedApplication_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrackerEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackerEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "TrackedApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "schemeId" TEXT,
    "title" TEXT NOT NULL,
    "remindAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reminder_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reminder_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedScheme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedScheme_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedScheme_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Scheme_slug_key" ON "Scheme"("slug");

-- CreateIndex
CREATE INDEX "Scheme_published_idx" ON "Scheme"("published");

-- CreateIndex
CREATE INDEX "SchemeRule_schemeId_idx" ON "SchemeRule"("schemeId");

-- CreateIndex
CREATE INDEX "SchemeRule_evidenceId_idx" ON "SchemeRule"("evidenceId");

-- CreateIndex
CREATE INDEX "SchemeEvidence_schemeId_idx" ON "SchemeEvidence"("schemeId");

-- CreateIndex
CREATE INDEX "VerificationRecord_schemeId_idx" ON "VerificationRecord"("schemeId");

-- CreateIndex
CREATE INDEX "ChecklistItem_schemeId_idx" ON "ChecklistItem"("schemeId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItem_profileId_schemeId_documentName_key" ON "ChecklistItem"("profileId", "schemeId", "documentName");

-- CreateIndex
CREATE INDEX "TrackedApplication_schemeId_idx" ON "TrackedApplication"("schemeId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedApplication_profileId_schemeId_key" ON "TrackedApplication"("profileId", "schemeId");

-- CreateIndex
CREATE INDEX "TrackerEvent_applicationId_idx" ON "TrackerEvent"("applicationId");

-- CreateIndex
CREATE INDEX "Reminder_profileId_idx" ON "Reminder"("profileId");

-- CreateIndex
CREATE INDEX "Reminder_schemeId_idx" ON "Reminder"("schemeId");

-- CreateIndex
CREATE INDEX "SavedScheme_schemeId_idx" ON "SavedScheme"("schemeId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedScheme_profileId_schemeId_key" ON "SavedScheme"("profileId", "schemeId");
