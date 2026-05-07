/**
 * Database Sync Utility
 * Synchronizes data between SQLite (local) and Supabase (PostgreSQL)
 * 
 * Usage:
 * - node scripts/sync-databases.js export    (Export SQLite to Supabase)
 * - node scripts/sync-databases.js import    (Import Supabase to SQLite)
 * - node scripts/sync-databases.js verify    (Check both databases)
 */

const { PrismaClient } = require('@prisma/client');
const path = require('path');

// Create Prisma clients for both databases
const supabaseUrl = process.env.DATABASE_URL;
const localDbPath = process.env.DATABASE_URL_LOCAL;

async function getLocalClient() {
  // Temporarily override DATABASE_URL to point to local SQLite
  const originalUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = localDbPath;
  const client = new PrismaClient();
  process.env.DATABASE_URL = originalUrl;
  return client;
}

async function getSupabaseClient() {
  return new PrismaClient({
    datasources: {
      db: {
        url: supabaseUrl
      }
    }
  });
}

async function exportToSupabase() {
  console.log('🔄 Starting export from SQLite to Supabase...');
  
  try {
    const localClient = await getLocalClient();
    const supabaseClient = await getSupabaseClient();

    // Get counts from local database
    const localCounts = {
      countries: await localClient.country.count(),
      districts: await localClient.district.count(),
      facilities: await localClient.facility.count(),
      users: await localClient.user.count(),
      mothers: await localClient.mother.count(),
      pregnancies: await localClient.pregnancy.count(),
    };

    console.log('📊 Local Database Records:');
    Object.entries(localCounts).forEach(([model, count]) => {
      console.log(`   ${model}: ${count}`);
    });

    // Start sync transaction
    console.log('\n📤 Syncing data to Supabase...');
    
    // Sync Countries
    const countries = await localClient.country.findMany();
    if (countries.length > 0) {
      await supabaseClient.country.deleteMany(); // Clear existing
      await supabaseClient.country.createMany({
        data: countries,
        skipDuplicates: true
      });
      console.log(`✓ Synced ${countries.length} countries`);
    }

    // Sync Districts
    const districts = await localClient.district.findMany();
    if (districts.length > 0) {
      await supabaseClient.district.deleteMany();
      await supabaseClient.district.createMany({
        data: districts,
        skipDuplicates: true
      });
      console.log(`✓ Synced ${districts.length} districts`);
    }

    // Sync Facilities
    const facilities = await localClient.facility.findMany();
    if (facilities.length > 0) {
      await supabaseClient.facility.deleteMany();
      await supabaseClient.facility.createMany({
        data: facilities,
        skipDuplicates: true
      });
      console.log(`✓ Synced ${facilities.length} facilities`);
    }

    // Sync Users
    const users = await localClient.user.findMany();
    if (users.length > 0) {
      await supabaseClient.user.deleteMany();
      await supabaseClient.user.createMany({
        data: users,
        skipDuplicates: true
      });
      console.log(`✓ Synced ${users.length} users`);
    }

    // Sync Mothers
    const mothers = await localClient.mother.findMany();
    if (mothers.length > 0) {
      await supabaseClient.mother.deleteMany();
      await supabaseClient.mother.createMany({
        data: mothers,
        skipDuplicates: true
      });
      console.log(`✓ Synced ${mothers.length} mothers`);
    }

    // Sync Pregnancies and related data
    const pregnancies = await localClient.pregnancy.findMany();
    if (pregnancies.length > 0) {
      await supabaseClient.pregnancy.deleteMany();
      await supabaseClient.pregnancy.createMany({
        data: pregnancies,
        skipDuplicates: true
      });
      console.log(`✓ Synced ${pregnancies.length} pregnancies`);
    }

    console.log('\n✅ Export to Supabase completed successfully!');

    await localClient.$disconnect();
    await supabaseClient.$disconnect();
  } catch (error) {
    console.error('❌ Error during export:', error.message);
    process.exit(1);
  }
}

async function verifyDatabases() {
  console.log('🔍 Verifying both databases...\n');
  
  try {
    const localClient = await getLocalClient();
    const supabaseClient = await getSupabaseClient();

    const tables = [
      'country',
      'district',
      'facility',
      'user',
      'mother',
      'pregnancy',
    ];

    console.log('📊 Record Counts:\n');
    console.log('Model'.padEnd(20) + 'SQLite'.padEnd(15) + 'Supabase');
    console.log('─'.repeat(50));

    for (const table of tables) {
      try {
        const localCount = await localClient[table].count();
        const supabaseCount = await supabaseClient[table].count();
        const match = localCount === supabaseCount ? '✓' : '✗';
        
        console.log(
          table.padEnd(20) +
          String(localCount).padEnd(15) +
          String(supabaseCount).padEnd(15) +
          match
        );
      } catch (e) {
        console.log(`${table.padEnd(20)}Error reading table`);
      }
    }

    await localClient.$disconnect();
    await supabaseClient.$disconnect();
  } catch (error) {
    console.error('❌ Error during verification:', error.message);
    process.exit(1);
  }
}

async function main() {
  const command = process.argv[2] || 'help';

  switch (command) {
    case 'export':
      await exportToSupabase();
      break;
    case 'verify':
      await verifyDatabases();
      break;
    case 'help':
    default:
      console.log(`
📚 Database Sync Utility

Usage: node scripts/sync-databases.js <command>

Commands:
  export    - Sync data from SQLite to Supabase
  verify    - Compare record counts between databases
  help      - Show this help message

Requirements:
  - DATABASE_URL must point to Supabase (PostgreSQL)
  - DATABASE_URL_LOCAL must point to SQLite
  - Both databases must have the same schema

Example:
  node scripts/sync-databases.js export
  node scripts/sync-databases.js verify
      `);
  }
}

main().catch(console.error);
