const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

(async () => {
  try {
    // Check all users
    const users = await db.user.findMany({
      select: { id: true, username: true, role: true, isActive: true }
    });
    
    console.log('All users:');
    console.log(JSON.stringify(users, null, 2));
    
    // Check all mothers
    const mothers = await db.mother.findMany({
      select: { id: true, fullName: true, phone: true }
    });
    
    console.log('\nAll mothers:');
    console.log(JSON.stringify(mothers, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.$disconnect();
  }
})();
