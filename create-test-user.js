const { PrismaClient } = require('@prisma/client');
const bcryptjs = require('bcryptjs');

const db = new PrismaClient();

async function createTestUser() {
  try {
    const hashedPassword = await bcryptjs.hash('Test123!', 10);
    
    const user = await db.user.create({
      data: {
        username: 'testdoctor',
        passwordHash: hashedPassword,
        name: 'Test Doctor',
        phone: '256701234567',
        role: 'DOCTOR',
        isActive: true,
      },
    });
    
    console.log('Test user created:', user);
  } catch (error) {
    console.error('Error creating test user:', error.message);
  } finally {
    await db.$disconnect();
  }
}

createTestUser();
