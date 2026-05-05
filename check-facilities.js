const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

(async () => {
  try {
    const facilities = await db.facility.findMany({
      select: { id: true, name: true, districtId: true },
      take: 5
    });

    console.log('Facilities in database:', facilities.length);
    console.log(JSON.stringify(facilities, null, 2));

    const districts = await db.district.findMany({
      select: { id: true, name: true },
      take: 3
    });

    console.log('\nDistricts in database:', districts.length);
    console.log(JSON.stringify(districts, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.$disconnect();
  }
})();
