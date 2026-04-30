import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  try {
    const count = await db.district.count();
    console.log(`Total districts: ${count}`);
    
    const countries = await db.country.findMany();
    console.log(`Total countries: ${countries.length}`);
    
    if (countries.length > 0) {
      const first = countries[0];
      console.log(`\nFirst country: ${first.name}`);
      
      const districtsByCountry = await db.district.count({
        where: { countryId: first.id }
      });
      console.log(`Districts for country ${first.id}: ${districtsByCountry}`);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.$disconnect();
  }
}

main();
