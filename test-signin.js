const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

(async () => {
  try {
    const user = await db.user.findUnique({
      where: { username: 'msolo256' },
      select: { id: true, username: true, role: true, isActive: true, motherId: true }
    });
    
    console.log('User found:', user);
    
    if (!user) {
      // Check if mother exists
      const mothers = await db.mother.findMany({
        select: { id: true, fullName: true, phone: true }
      });
      console.log('All mothers count:', mothers.length);
      console.log('First few mothers:', mothers.slice(0, 3));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.$disconnect();
  }
})();
