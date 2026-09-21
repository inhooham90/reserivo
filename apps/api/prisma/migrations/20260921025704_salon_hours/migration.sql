-- CreateTable
CREATE TABLE "salon_hours" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,

    CONSTRAINT "salon_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salon_hours_exceptions" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "type" "ExceptionType" NOT NULL,
    "startMinutes" INTEGER,
    "endMinutes" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salon_hours_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "salon_hours_salonId_weekday_idx" ON "salon_hours"("salonId", "weekday");

-- CreateIndex
CREATE INDEX "salon_hours_exceptions_salonId_date_idx" ON "salon_hours_exceptions"("salonId", "date");

-- AddForeignKey
ALTER TABLE "salon_hours" ADD CONSTRAINT "salon_hours_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salon_hours_exceptions" ADD CONSTRAINT "salon_hours_exceptions_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing salons open Mon–Sat 09:00–18:00 until a manager changes it.
INSERT INTO "salon_hours" ("id", "salonId", "weekday", "startMinutes", "endMinutes")
SELECT gen_random_uuid(), s."id", d.weekday, 540, 1080
FROM "salons" s
CROSS JOIN (VALUES (1), (2), (3), (4), (5), (6)) AS d(weekday);
