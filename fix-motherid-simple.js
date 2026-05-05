const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

(async () => {
  try {
    console.log('=== FIXING COMMUNITY_USER USERS WITHOUT MOTHERID ===\n');

    // Get all COMMUNITY_USER users without a motherId
    const usersWithoutMotherId = await db.user.findMany({
      where: {
        role: 'COMMUNITY_USER',
        motherId: null
      },
      select: {
        id: true,
        username: true,
        name: true
      }
    });

    console.log(`Found ${usersWithoutMotherId.length} COMMUNITY_USER users without motherId\n`);

    if (usersWithoutMotherId.length === 0) {
      console.log('✓ All COMMUNITY_USER users already have motherId set!');
      await db.$disconnect();
      return;
    }

    // Get a facility to use for all mothers
    const facility = await db.facility.findFirst({
      select: { id: true, districtId: true }
    });

    if (!facility) {
      console.log('✗ No facility found in database!');
      await db.$disconnect();
      return;
    }

    console.log(`Using Facility ID: ${facility.id}, District ID: ${facility.districtId}\n`);
    console.log('Linking users to mothers...\n');

    // For each user, create a mother and link
    for (const user of usersWithoutMotherId) {
      try {
        // Create mother directly using the facility
        const mother = await db.mother.create({
          data: {
            fullName: user.name,
            districtId: facility.districtId,
            facilityId: facility.id,
            consentAccepted: true,
            consentDate: new Date()
          },
          select: { id: true }
        });

        console.log(`✓ Created mother for ${user.name} (Mother ID: ${mother.id})`);

        // Link user to mother
        await db.user.update({
          where: { id: user.id },
          data: { motherId: mother.id }
        });

        console.log(`✓ Linked user "${user.username}" to mother\n`);
      } catch (err) {
        console.error(`⚠ Error processing user ${user.username}:`, err.message, '\n');
      }
    }

    console.log('=== VERIFICATION ===\n');

    // Verify the fix
    const verifyUsers = await db.user.findMany({
      where: { role: 'COMMUNITY_USER' },
      select: {
        id: true,
        username: true,
        motherId: true
      },
      orderBy: { id: 'asc' }
    });

    const linked = verifyUsers.filter(u => u.motherId !== null);
    const unlinked = verifyUsers.filter(u => u.motherId === null);

    console.log(`✓ Successfully linked ${linked.length} / ${verifyUsers.length} COMMUNITY_USER users`);
    
    if (unlinked.length > 0) {
      console.log(`\n⚠ Still unlinked:`);
      unlinked.forEach(u => console.log(`  - ${u.username}`));
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.$disconnect();
  }
})();
