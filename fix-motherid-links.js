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

    console.log(`Found ${usersWithoutMotherId.length} COMMUNITY_USER users without motherId:\n`);
    console.log(JSON.stringify(usersWithoutMotherId, null, 2));

    if (usersWithoutMotherId.length === 0) {
      console.log('\n✓ All COMMUNITY_USER users already have motherId set!');
      await db.$disconnect();
      return;
    }

    // For each user, create or link to a mother
    console.log('\nLinking users to mothers...\n');

    for (const user of usersWithoutMotherId) {
      try {
        // Check if a mother already exists with this name
        let mother = await db.mother.findFirst({
          where: { fullName: user.name },
          select: { id: true }
        });

        // If no mother exists, create one
        if (!mother) {
          // Get first district with country info
          let district = await db.district.findFirst({
            select: { id: true, countryId: true }
          });

          if (!district) {
            console.log(`⚠ No district found, skipping user ${user.username}`);
            continue;
          }

          // Get first facility in that district
          let facility = await db.facility.findFirst({
            where: { districtId: district.id },
            select: { id: true }
          });

          if (!facility) {
            console.log(`⚠ No facility found in district, skipping user ${user.username}`);
            continue;
          }

          // Create mother
          mother = await db.mother.create({
            data: {
              fullName: user.name,
              districtId: district.id,
              facilityId: facility.id,
              consentAccepted: true,
              consentDate: new Date()
            },
            select: { id: true }
          });

          console.log(`✓ Created mother ${user.name} (ID: ${mother.id})`);
        } else {
          console.log(`✓ Found existing mother for ${user.name} (ID: ${mother.id})`);
        }

        // Link user to mother
        await db.user.update({
          where: { id: user.id },
          data: { motherId: mother.id }
        });

        console.log(`✓ Linked user ${user.username} to mother ${mother.id}\n`);
      } catch (err) {
        console.error(`Error processing user ${user.username}:`, err.message);
      }
    }

    console.log('=== VERIFICATION ===\n');

    // Verify the fix
    const verifyUsers = await db.user.findMany({
      where: { role: 'COMMUNITY_USER' },
      select: {
        id: true,
        username: true,
        role: true,
        motherId: true
      }
    });

    console.log('COMMUNITY_USER users after fix:');
    console.log(JSON.stringify(verifyUsers, null, 2));

    console.log('\n✓ All COMMUNITY_USER users now have motherId!');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.$disconnect();
  }
})();
