import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Admin default
  const adminPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@catering.com' },
    update: {},
    create: {
      fullName: 'Super Admin',
      email: 'admin@catering.com',
      password: adminPassword,
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin: admin@catering.com / admin123');

  // 2. User dummy
  const userPassword = await bcrypt.hash('user123', 10);
  await prisma.user.upsert({
    where: { email: 'user@catering.com' },
    update: {},
    create: {
      fullName: 'User Demo',
      email: 'user@catering.com',
      password: userPassword,
      role: 'USER',
    },
  });
  console.log('✅ User: user@catering.com / user123');

  // 3. Kategori
  const tumpeng = await prisma.category.upsert({
    where: { name: 'Tumpeng' },
    update: {},
    create: { name: 'Tumpeng', description: 'Paket tumpeng tradisional' },
  });
  const buffet = await prisma.category.upsert({
    where: { name: 'Buffet' },
    update: {},
    create: { name: 'Buffet', description: 'Paket prasmanan untuk acara besar' },
  });
  const nasiBox = await prisma.category.upsert({
    where: { name: 'Nasi Box' },
    update: {},
    create: { name: 'Nasi Box', description: 'Nasi kotak untuk meeting & acara' },
  });
  console.log('✅ Kategori dibuat');

  // 4. Paket
  await prisma.package.createMany({
    data: [
      {
        name: 'Paket Nasi Kuning Tumpeng',
        description: 'Tumpeng nasi kuning lengkap dengan 7 macam lauk pauk',
        price: 300000,
        imageUrl: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400',
        stock: 20,
        isActive: true,
        categoryId: tumpeng.id,
      },
      {
        name: 'Paket Buffet Acara',
        description: 'Prasmanan lengkap 5 menu utama + dessert untuk min. 50 orang',
        price: 1500000,
        imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400',
        stock: 10,
        isActive: true,
        categoryId: buffet.id,
      },
      {
        name: 'Nasi Box Premium',
        description: 'Nasi box dengan ayam bakar, sayur, tempe, dan kerupuk',
        price: 35000,
        imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400',
        stock: 100,
        isActive: true,
        categoryId: nasiBox.id,
      },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Paket dummy dibuat');

  console.log('🎉 Seeding selesai!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });