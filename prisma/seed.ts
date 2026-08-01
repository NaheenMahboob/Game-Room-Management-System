import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type EquipmentSeedType =
  | "PS5_CONSOLE"
  | "PS5_CONTROLLER"
  | "SWITCH_CONSOLE"
  | "SWITCH_CONTROLLER"
  | "TABLE_TENNIS"
  | "FOOSBALL"
  | "POOL"
  | "AIR_HOCKEY";

const EQUIPMENT_SEED: { type: EquipmentSeedType; label: string }[] = [
  ...Array.from({ length: 6 }, (_, i) => ({
    type: "PS5_CONSOLE" as const,
    label: `PS5 Console #${i + 1}`,
  })),
  ...Array.from({ length: 24 }, (_, i) => ({
    type: "PS5_CONTROLLER" as const,
    label: `PS5 Controller #${i + 1}`,
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    type: "SWITCH_CONSOLE" as const,
    label: `Switch Console #${i + 1}`,
  })),
  ...Array.from({ length: 8 }, (_, i) => ({
    type: "SWITCH_CONTROLLER" as const,
    label: `Switch Controller #${i + 1}`,
  })),
  { type: "TABLE_TENNIS", label: "Table Tennis" },
  { type: "FOOSBALL", label: "Foosball" },
  { type: "POOL", label: "Pool Table" },
  { type: "AIR_HOCKEY", label: "Air Hockey" },
];

const DEFAULT_WAIVER_TEXT = `
COMMUNITY GAME ROOM LIABILITY WAIVER AND RELEASE

By signing this waiver, I acknowledge that I am voluntarily participating in activities
at the community game room. I understand that use of gaming equipment and recreational
tables involves inherent risks.

I agree to follow all community rules, treat equipment with care, and accept responsibility
for any damage caused by misuse. I release the mosque, its volunteers, and staff from
liability for injuries or losses arising from ordinary use of the facilities, to the fullest
extent permitted by law.

For participants under 18 years of age, a parent or legal guardian must sign this waiver
and provide parental consent before the minor may sign in to the game room.

Version 1 — Community Game Room
`.trim();

const OPENING_HOURS = {
  monday: { open: "16:00", close: "21:00" },
  tuesday: { open: "16:00", close: "21:00" },
  wednesday: { open: "16:00", close: "21:00" },
  thursday: { open: "16:00", close: "21:00" },
  friday: { open: "16:00", close: "22:00" },
  saturday: { open: "14:00", close: "22:00" },
  sunday: { open: "14:00", close: "20:00" },
};

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@mosque.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "ChangeMeAdmin123!";

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      role: "ADMIN",
    },
    create: {
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log(`Admin user ready: ${admin.email} (${admin.id})`);

  const volunteerEmail =
    process.env.VOLUNTEER_EMAIL ?? "volunteer@mosque.local";
  const volunteerPassword =
    process.env.VOLUNTEER_PASSWORD ?? "ChangeMeVolunteer123!";
  const volunteerHash = await bcrypt.hash(volunteerPassword, 12);

  const volunteer = await prisma.user.upsert({
    where: { email: volunteerEmail },
    update: {
      passwordHash: volunteerHash,
      role: "VOLUNTEER",
    },
    create: {
      email: volunteerEmail,
      passwordHash: volunteerHash,
      role: "VOLUNTEER",
    },
  });

  console.log(`Volunteer user ready: ${volunteer.email} (${volunteer.id})`);

  const memberEmail = process.env.MEMBER_EMAIL ?? "member@mosque.local";
  const memberPassword = process.env.MEMBER_PASSWORD ?? "ChangeMeMember123!";
  const memberHash = await bcrypt.hash(memberPassword, 12);

  const memberUser = await prisma.user.upsert({
    where: { email: memberEmail },
    update: {
      passwordHash: memberHash,
      role: "MEMBER",
    },
    create: {
      email: memberEmail,
      passwordHash: memberHash,
      role: "MEMBER",
    },
  });

  await prisma.member.upsert({
    where: { userId: memberUser.id },
    update: {
      fullName: "Demo Member",
      phone: "555-0100",
      email: memberEmail,
      emergencyContactName: "Demo Parent",
      emergencyContactPhone: "555-0101",
      // Private storage filename (served via GET /api/members/[id]/photo).
      photoUrl: "placeholder.jpg",
      membershipStatus: "ACTIVE",
      waiverSigned: true,
      waiverSignedAt: new Date(),
      waiverVersion: 1,
      parentalConsent: true,
      registeredByUserId: admin.id,
    },
    create: {
      userId: memberUser.id,
      fullName: "Demo Member",
      phone: "555-0100",
      email: memberEmail,
      emergencyContactName: "Demo Parent",
      emergencyContactPhone: "555-0101",
      // Same storage filename on create so re-seed stays consistent.
      photoUrl: "placeholder.jpg",
      membershipStatus: "ACTIVE",
      waiverSigned: true,
      waiverSignedAt: new Date(),
      waiverVersion: 1,
      parentalConsent: true,
      qrPayload: `m_demo_member`,
      registeredByUserId: admin.id,
    },
  });

  console.log(`Member user ready: ${memberUser.email} (${memberUser.id})`);

  for (const item of EQUIPMENT_SEED) {
    await prisma.equipment.upsert({
      where: { label: item.label },
      update: {
        type: item.type,
        isActive: true,
      },
      create: {
        type: item.type,
        label: item.label,
      },
    });
  }

  const equipmentCount = await prisma.equipment.count();
  console.log(`Equipment inventory: ${equipmentCount} items`);

  const settings: { key: string; value: string }[] = [
    { key: "openingHours", value: JSON.stringify(OPENING_HOURS) },
    { key: "maxSessionDuration", value: "120" },
    { key: "guestLimit", value: "2" },
    { key: "waiverVersion", value: "1" },
    { key: "autoMinorIssueOnNotes", value: "true" },
    {
      key: "communityRules",
      value:
        "1. Sign in and out with a volunteer.\n2. Treat all equipment with care.\n3. No food or drinks near consoles.\n4. Keep voices respectful — this is a shared community space.\n5. Return equipment when your turn is done.\n6. Guests must stay with their host member.",
    },
    {
      key: "membershipInfo",
      value:
        "New members can register at the volunteer desk. Bring a photo ID if requested. Members under 18 need a parent or guardian to sign the waiver. After registration you receive a member QR card and portal login.",
    },
    {
      key: "equipmentTimeLimits",
      value: JSON.stringify({
        PS5_CONSOLE: 60,
        PS5_CONTROLLER: 60,
        SWITCH_CONSOLE: 60,
        SWITCH_CONTROLLER: 60,
        TABLE_TENNIS: 30,
        FOOSBALL: 30,
        POOL: 30,
        AIR_HOCKEY: 30,
      }),
    },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  console.log(`Settings upserted: ${settings.length}`);

  await prisma.waiver.upsert({
    where: { version: 1 },
    update: {
      text: DEFAULT_WAIVER_TEXT,
      createdByUserId: admin.id,
    },
    create: {
      version: 1,
      text: DEFAULT_WAIVER_TEXT,
      createdByUserId: admin.id,
    },
  });

  console.log("Waiver version 1 ready");

  const existingAnnouncement = await prisma.announcement.findFirst({
    where: { title: "Welcome to the Game Room" },
  });

  if (!existingAnnouncement) {
    await prisma.announcement.create({
      data: {
        title: "Welcome to the Game Room",
        content:
          "Our community game room is open! Please sign in with a volunteer, take care of the equipment, and have fun.",
        targetAudience: "GENERAL",
        createdByUserId: admin.id,
      },
    });
  }

  const existingEvent = await prisma.event.findFirst({
    where: { title: "Game Night" },
  });

  if (!existingEvent) {
    const nextSaturday = new Date();
    nextSaturday.setDate(nextSaturday.getDate() + ((6 - nextSaturday.getDay() + 7) % 7 || 7));
    nextSaturday.setHours(18, 0, 0, 0);

    await prisma.event.create({
      data: {
        title: "Game Night",
        description: "Community game night — all members welcome. Sign in at the volunteer desk.",
        eventDate: nextSaturday,
        createdByUserId: admin.id,
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
