const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const db = new PrismaClient();

(async () => {
  try {
    console.log('=== CREATING TEST USER FOR SIGN-IN ===\n');

    // Check if test user already exists
    let testUser = await db.user.findUnique({
      where: { username: 'msolo256' },
      select: { id: true }
    });

    if (testUser) {
      console.log('✓ Test user "msolo256" already exists (ID:', testUser.id + ')');
      
      // Check if they have a mother
      const userWithMother = await db.user.findUnique({
        where: { username: 'msolo256' },
        select: { id: true, motherId: true }
      });
      
      console.log('  Mother ID:', userWithMother.motherId || 'NOT SET');
    } else {
      console.log('Creating test user "msolo256"...\n');

      // Use existing district and facility (from Test User mother)
      const districtId = 8; // Kampala
      const facilityId = 1; // Kampala Health Center

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('1234567890', salt);

      // Create mother first
      console.log('Creating mother record...');
      const mother = await db.mother.create({
        data: {
          fullName: 'Mary Solo',
          districtId: districtId,
          facilityId: facilityId,
          consentAccepted: true,
          consentDate: new Date()
        }
      });
      console.log('✓ Mother created (ID:', mother.id + ')\n');

      // Create user linked to mother
      console.log('Creating user account...');
      const newUser = await db.user.create({
        data: {
          name: 'Mary Solo',
          username: 'msolo256',
          passwordHash: passwordHash,
          role: 'COMMUNITY_USER',
          phone: null,
          isActive: true,
          motherId: mother.id,
          districtId: 8, // Kampala
          countryId: 1
        },
        select: {
          id: true,
          username: true,
          role: true,
          motherId: true,
          isActive: true
        }
      });

      console.log('✓ User created!\n');
      console.log(JSON.stringify(newUser, null, 2));
    }

    // Verify the setup
    console.log('\n=== VERIFICATION ===\n');

    const verifyUser = await db.user.findUnique({
      where: { username: 'msolo256' },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        motherId: true
      }
    });

    console.log('Final user state:');
    console.log(JSON.stringify(verifyUser, null, 2));

    console.log('\n✓ Test user ready for sign-in!');
    console.log('\nLogin credentials:');
    console.log('  Username: msolo256');
    console.log('  Password: 1234567890');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.$disconnect();
  }
})();
