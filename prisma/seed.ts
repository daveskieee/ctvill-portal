import { PrismaClient, Role, AccountStatus } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

dotenv.config();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
const isCloudDb = connectionString.includes('sslmode=') || connectionString.includes('neon.tech') || connectionString.includes('supabase') || connectionString.includes('render');
const pool = new Pool({
  connectionString,
  ...(isCloudDb ? { ssl: { rejectUnauthorized: false } } : {})
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Clearing all data from database...');
  
  // Clean up in reverse relation dependency order
  await prisma.processAuditLog.deleteMany({});
  await prisma.punchListDefect.deleteMany({});
  await prisma.civilWorksMilestone.deleteMany({});
  await prisma.buyerKyc.deleteMany({});
  await prisma.titlePermitTracker.deleteMany({});
  await prisma.installmentLedger.deleteMany({});
  await prisma.clientPackage.deleteMany({});
  await prisma.weeklyProgressLog.deleteMany({});
  await prisma.slot.deleteMany({});
  await prisma.landParcel.deleteMany({});
  await prisma.contractor.deleteMany({});
  await prisma.payrollRecord.deleteMany({});
  await prisma.projectTask.deleteMany({});
  await prisma.dailySiteLog.deleteMany({});
  await prisma.projectDocument.deleteMany({});
  await prisma.projectRisk.deleteMany({});
  await prisma.changeOrder.deleteMany({});
  await prisma.user.deleteMany({});

  // ─── Admin Account ─────────────────────────────────────────────────────────
  console.log('Seeding admin account...');
  await prisma.user.create({
    data: {
      email: 'davematthewreglos@gmail.com',
      name: 'Dave Matthew Reglos',
      role: Role.ADMIN,
      accountStatus: AccountStatus.ACTIVE,
      passwordHash: hashPassword('admin123'),
      contact: '',
    },
  });
  console.log('  ✅ Admin → davematthewreglos@gmail.com / admin123');

  // ─── Project Manager Account ───────────────────────────────────────────────
  console.log('Seeding project manager account...');
  await prisma.user.create({
    data: {
      id: 'USER-PM-001',
      email: 'pm@ctvill.com',
      name: 'Project Manager',
      role: Role.PROJECT_MANAGER,
      accountStatus: AccountStatus.ACTIVE,
      passwordHash: hashPassword('pm123'),
      contact: '',
    },
  });
  console.log('  ✅ Project Manager → pm@ctvill.com / pm123');

  // ─── Audit Log ─────────────────────────────────────────────────────────────
  console.log('Logging system initialization audit record...');
  await prisma.processAuditLog.create({
    data: {
      entityType: 'PARCEL',
      entityId: 'SYSTEM',
      action: 'CLEAN_SLATE_INITIALIZED',
      actorName: 'Dave Matthew Reglos',
      actorRole: 'ADMIN',
      details: 'System database initialized with zero sample data. Ready for fresh data entry.',
    }
  });

  console.log('\n🚀 System initialized! Staff accounts ready:');
  console.log('   Admin         → davematthewreglos@gmail.com  /  admin123');
  console.log('   Project Manager → pm@ctvill.com             /  pm123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
