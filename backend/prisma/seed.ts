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

  // Seed sample products if empty
  const productCount = await prisma.product.count();
  let prod1, prod2, prod3;
  if (productCount === 0) {
    console.log('Seeding sample products...');
    prod1 = await prisma.product.create({
      data: {
        name: 'Premium Wall Emulsion',
        sku: 'PA-EMUL-05',
        category: 'Paints',
        unitPrice: 220.0,
        currentStock: 80,
        minStockAlert: 15,
        location: 'Aisle A3'
      }
    });

    prod2 = await prisma.product.create({
      data: {
        name: 'Professional Roller Brush',
        sku: 'BR-ROLL-09',
        category: 'Brushes & Rollers',
        unitPrice: 45.0,
        currentStock: 120,
        minStockAlert: 20,
        location: 'Aisle B1'
      }
    });

    prod3 = await prisma.product.create({
      data: {
        name: 'Synthetic Lacquer Gloss',
        sku: 'PA-LACQ-12',
        category: 'Paints',
        unitPrice: 310.0,
        currentStock: 12,
        minStockAlert: 15,
        location: 'Aisle A5'
      }
    });
    console.log('Products seeded successfully!');
  } else {
    const prods = await prisma.product.findMany();
    prod1 = prods[0];
    prod2 = prods[1];
    prod3 = prods[2];
  }

  // Seed sample customers if empty
  const customerCount = await prisma.customer.count();
  let cust1, cust2;
  if (customerCount === 0) {
    console.log('Seeding sample customers...');
    cust1 = await prisma.customer.create({
      data: {
        name: 'Satyam Sanjeev',
        mobile: '9262256873',
        email: 'im.satyamsanjeev@gmail.com',
        businessName: 'Shagun Art Studio',
        gstNumber: '29AAAAA1111A1Z1',
        type: 'Wholesale',
        address: 'CKC Layout, Bangalore',
        status: 'Active',
        followUpDate: new Date('2026-08-10T12:00:00.000Z'),
        notes: 'Premium art client, bulk orders paints weekly.'
      }
    });

    cust2 = await prisma.customer.create({
      data: {
        name: 'Alok Gupta',
        mobile: '9876543210',
        email: 'alok@example.com',
        businessName: 'Fundesroom Infotech',
        gstNumber: '29BBBBB2222B2Z2',
        type: 'Distributor',
        address: 'MG Road, Bangalore',
        status: 'Lead',
        followUpDate: new Date('2026-07-30T12:00:00.000Z'),
        notes: 'Potential distributor partnership.'
      }
    });
    console.log('Customers seeded successfully!');
  } else {
    const custs = await prisma.customer.findMany();
    cust1 = custs[0];
    cust2 = custs[1];
  }

  // Seed sample challans if empty
  const challanCount = await prisma.challan.count();
  if (challanCount === 0 && cust1 && prod1 && prod2) {
    console.log('Seeding sample sales challans...');
    // Create draft challan
    await prisma.challan.create({
      data: {
        challanNumber: 'CH-2026-0001',
        customerId: cust1.id,
        totalQuantity: 15,
        status: 'Draft',
        createdBy: 'Sonal (Sales Executive)',
        items: {
          create: [
            {
              productId: prod1.id,
              name: prod1.name,
              sku: prod1.sku,
              unitPrice: prod1.unitPrice,
              quantity: 5
            },
            {
              productId: prod2.id,
              name: prod2.name,
              sku: prod2.sku,
              unitPrice: prod2.unitPrice,
              quantity: 10
            }
          ]
        }
      }
    });

    // Create confirmed challan
    await prisma.challan.create({
      data: {
        challanNumber: 'CH-2026-0002',
        customerId: cust1.id,
        totalQuantity: 20,
        status: 'Confirmed',
        createdBy: 'Aditya (Admin)',
        items: {
          create: [
            {
              productId: prod2.id,
              name: prod2.name,
              sku: prod2.sku,
              unitPrice: prod2.unitPrice,
              quantity: 20
            }
          ]
        }
      }
    });
    console.log('Challans seeded successfully!');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
