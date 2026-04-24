import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // Get or create Uganda country
  let uganda = await db.country.findUnique({
    where: { code: 'UG' },
  });

  if (!uganda) {
    uganda = await db.country.create({
      data: {
        name: 'Uganda',
        code: 'UG',
      },
    });
    console.log('Created Uganda country');
  } else {
    console.log('Uganda country already exists');
  }

  // List of all Uganda districts organized by region
  const ugandaDistricts = [
    // Central Region
    'Buikwe',
    'Bukomansimbi',
    'Butambala',
    'Buvuma',
    'Gomba',
    'Kalangala',
    'Kalungu',
    'Kampala', // Capital City
    'Kasanda',
    'Kayunga',
    'Kiboga',
    'Kyankwanzi',
    'Kyotera',
    'Luweero',
    'Lwengo',
    'Lyantonde',
    'Masaka',
    'Mityana',
    'Mpigi',
    'Mubende',
    'Mukono',
    'Nakaseke',
    'Nakasongola',
    'Rakai',
    'Sembabule',
    'Wakiso',

    // Eastern Region
    'Amuria',
    'Budaka',
    'Bududa',
    'Bugiri',
    'Bugweri',
    'Bukedea',
    'Bukwo',
    'Bulambuli',
    'Busia',
    'Butaleja',
    'Butebo',
    'Buyende',
    'Iganga',
    'Jinja',
    'Kaberamaido',
    'Kaliro',
    'Kamuli',
    'Kapchorwa',
    'Kapelebyong',
    'Katakwi',
    'Kibuku',
    'Kumi',
    'Kween',
    'Luuka',
    'Manafwa',
    'Mayuge',
    'Mbale',
    'Namayingo',
    'Namisindwa',
    'Namutumba',
    'Ngora',
    'Pallisa',
    'Serere',
    'Sironko',
    'Soroti',
    'Tororo',

    // Northern Region
    'Abim',
    'Adjumani',
    'Agago',
    'Alebtong',
    'Amolatar',
    'Amudat',
    'Amuru',
    'Apac',
    'Arua',
    'Dokolo',
    'Gulu',
    'Kaabong',
    'Karenga',
    'Kitgum',
    'Koboko',
    'Kole',
    'Kotido',
    'Kwania',
    'Lamwo',
    'Lira',
    'Madi-Okollo',
    'Maracha',
    'Moroto',
    'Moyo',
    'Nabilatuk',
    'Nakapiripirit',
    'Napak',
    'Nebbi',
    'Nwoya',
    'Obongi',
    'Omoro',
    'Otuke',
    'Oyam',
    'Pader',
    'Pakwach',
    'Yumbe',
    'Zombo',
  ];

  // Create or update districts
  let createdCount = 0;
  let updatedCount = 0;

  for (const districtName of ugandaDistricts) {
    const existing = await db.district.findFirst({
      where: {
        name: districtName,
        countryId: uganda.id,
      },
    });

    if (!existing) {
      await db.district.create({
        data: {
          name: districtName,
          countryId: uganda.id,
        },
      });
      createdCount++;
    } else {
      updatedCount++;
    }
  }

  console.log(`\nSeeding completed:`);
  console.log(`- Created: ${createdCount} districts`);
  console.log(`- Already existed: ${updatedCount} districts`);
  console.log(`- Total districts: ${ugandaDistricts.length}`);
}

main()
  .then(async () => {
    await db.$disconnect();
    console.log('\nDatabase seeding finished successfully!');
  })
  .catch(async (e) => {
    console.error('Error during seeding:', e);
    await db.$disconnect();
    process.exit(1);
  });
