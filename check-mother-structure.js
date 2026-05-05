const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

(async () => {
  try {
    // Get existing mother
    const mother = await db.mother.findFirst({
      select: { id: true, fullName: true, districtId: true, facilityId: true, deletedAt: true }
    });

    console.log('Existing mother:');
    console.log(JSON.stringify(mother, null, 2));

    // Check district and facility exist
    if (mother) {
      const facility = await db.facility.findUnique({
        where: { id: mother.facilityId },
        select: { id: true, name: true, districtId: true }
      });

      const district = await db.district.findUnique({
        where: { id: mother.districtId },
        select: { id: true, name: true }
      });

      console.log('\nAssociated facility:');
      console.log(JSON.stringify(facility, null, 2));

      console.log('\nAssociated district:');
      console.log(JSON.stringify(district, null, 2));
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.$disconnect();
  }
})();
