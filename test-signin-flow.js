const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

(async () => {
  try {
    console.log('=== TESTING SIGN-IN FLOW ===\n');

    // 1. Get existing users
    const users = await db.user.findMany({
      select: { id: true, username: true, role: true, motherId: true },
      take: 5
    });

    console.log('Sample users in database:');
    console.log(JSON.stringify(users, null, 2));

    // 2. Check kmsolo256 user (if exists)
    const kmsolo = await db.user.findUnique({
      where: { username: 'kmsolo256' },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        motherId: true
      }
    });

    console.log('\nUser kmsolo256:');
    console.log(JSON.stringify(kmsolo, null, 2));

    // 3. Simulate what the API should return for a COMMUNITY_USER
    console.log('\n=== EXPECTED API RESPONSE FORMAT ===');
    const exampleMother = users.find(u => u.role === 'COMMUNITY_USER' && u.motherId);
    
    if (exampleMother) {
      console.log('Example COMMUNITY_USER with motherId:');
      const apiResponse = {
        success: true,
        message: 'Sign in successful',
        data: {
          token: 'jwt_token_here',
          user: {
            userId: exampleMother.id,
            username: exampleMother.username,
            phone: null,
            role: exampleMother.role,
            name: 'Name here',
            motherId: exampleMother.motherId  // <-- CRITICAL: motherId included
          }
        }
      };
      console.log(JSON.stringify(apiResponse, null, 2));
    } else {
      console.log('No COMMUNITY_USER with motherId found. Need to create one via registration.');
    }

    console.log('\n✓ API response format check completed!');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.$disconnect();
  }
})();
