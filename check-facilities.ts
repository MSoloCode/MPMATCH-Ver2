import { db } from '@/lib/db';

async function checkFacilities() {
  try {
    const facilities = await db.facility.findMany({
      select: {
        id: true,
        name: true,
        districtId: true,
        type: true,
      },
      take: 20,
    });

    console.log('=== FACILITIES IN DATABASE ===');
    console.log(`Total shown: ${facilities.length}`);
    facilities.forEach((f) => {
      console.log(`  ID: ${f.id}, Name: ${f.name}, District: ${f.districtId}, Type: ${f.type}`);
    });

    // Check Kampala specifically
    const kampalaFacilities = await db.facility.findMany({
      where: { district: { name: 'Kampala' } },
      select: {
        id: true,
        name: true,
        type: true,
      },
      take: 5,
    });

    console.log('\n=== KAMPALA FACILITIES ===');
    console.log(`Count: ${kampalaFacilities.length}`);
    kampalaFacilities.forEach((f) => {
      console.log(`  ${f.name} (${f.type})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkFacilities();
