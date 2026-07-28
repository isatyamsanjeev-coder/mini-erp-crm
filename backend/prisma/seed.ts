import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding login users...');

  const salt = bcrypt.genSaltSync(10);
  const passwordAdmin = bcrypt.hashSync('admin123', salt);
  const passwordSales = bcrypt.hashSync('sales123', salt);
  const passwordWarehouse = bcrypt.hashSync('warehouse123', salt);
  const passwordAccounts = bcrypt.hashSync('accounts123', salt);

  const users = [
    { username: 'admin', password: passwordAdmin, name: 'Aditya (Admin)', role: 'Admin' },
    { username: 'sales', password: passwordSales, name: 'Sonal (Sales Executive)', role: 'Sales' },
    { username: 'warehouse', password: passwordWarehouse, name: 'Vikram (Warehouse Mgr)', role: 'Warehouse' },
    { username: 'accounts', password: passwordAccounts, name: 'Amit (Accounts Lead)', role: 'Accounts' }
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: u
    });
  }
  console.log('Login users seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
