-- CreateTable
CREATE TABLE "EquipmentTypeDef" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentTypeDef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentTypeDef_code_key" ON "EquipmentTypeDef"("code");

-- Seed the eight types that previously lived in the EquipmentType enum.
INSERT INTO "EquipmentTypeDef" ("id", "code", "label", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
  ('eqtype_ps5_console', 'PS5_CONSOLE', 'PS5 Console', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('eqtype_ps5_controller', 'PS5_CONTROLLER', 'PS5 Controller', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('eqtype_switch_console', 'SWITCH_CONSOLE', 'Switch Console', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('eqtype_switch_controller', 'SWITCH_CONTROLLER', 'Switch Controller', 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('eqtype_table_tennis', 'TABLE_TENNIS', 'Table Tennis', 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('eqtype_foosball', 'FOOSBALL', 'Foosball', 60, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('eqtype_pool', 'POOL', 'Pool Table', 70, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('eqtype_air_hockey', 'AIR_HOCKEY', 'Air Hockey', 80, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable: enum → text so Equipment.type can reference EquipmentTypeDef.code
ALTER TABLE "Equipment" ALTER COLUMN "type" TYPE TEXT USING ("type"::text);

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_type_fkey" FOREIGN KEY ("type") REFERENCES "EquipmentTypeDef"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropEnum
DROP TYPE "EquipmentType";
