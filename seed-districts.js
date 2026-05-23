const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

const ugandaDistricts = [
  { name: 'Kampala' },
  { name: 'Wakiso' },
  { name: 'Mukono' },
  { name: 'Luweero' },
  { name: 'Nakaseke' },
  { name: 'Kamangu' },
  { name: 'Jinja' },
  { name: 'Kamuli' },
  { name: 'Soroti' },
  { name: 'Kumi' },
  { name: 'Mbale' },
  { name: 'Sironko' },
  { name: 'Kapchorwa' },
  { name: 'Busia' },
  { name: 'Tororo' },
  { name: 'Pallisa' },
  { name: 'Bugiri' },
  { name: 'Iganga' },
  { name: 'Mayuge' },
  { name: 'Kaliro' },
];

(async () => {
  try {
    // First, ensure Uganda country exists
    let country = await db.country.findUnique({
      where: { name: 'Uganda' }
    });

    if (!country) {
      console.log('Creating Uganda country...');
      country = await db.country.create({
        data: { name: 'Uganda', code: 'UG' }
      });
    }

    console.log(`Using Uganda country with ID: ${country.id}`);

    // Check existing districts
    const existingCount = await db.district.count({
      where: { countryId: country.id }
    });

    if (existingCount > 0) {
      console.log(`${existingCount} districts already exist. Skipping seed.`);
    } else {
      console.log('Creating districts...');
      for (const district of ugandaDistricts) {
        await db.district.create({
          data: {
            name: district.name,
            countryId: country.id
          }
        });
      }
      console.log(`✅ Created ${ugandaDistricts.length} districts`);
    }

    // Verify
    const allDistricts = await db.district.findMany({
      where: { countryId: country.id },
      select: { id: true, name: true }
    });

    console.log('\nAll districts in database:');
    allDistricts.forEach(d => console.log(`  - ${d.name} (ID: ${d.id})`));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.$disconnect();
  }
})();
