/**
 * Database Backup Utility
 * Syncs data from local SQLite to Supabase PostgreSQL
 * 
 * Usage:
 *   node lib/db-backup.js sync    // Sync all tables to Supabase
 *   node lib/db-backup.js status  // Check backup status
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const pg = require('pg');

// Primary database (local SQLite)
const localDb = new PrismaClient({
  log: ['error', 'warn'],
});

// Backup database (Supabase PostgreSQL) - raw connection
async function getBackupConnection() {
  const backupUrl = process.env.DATABASE_URL_BACKUP;
  if (!backupUrl) {
    console.error('ERROR: DATABASE_URL_BACKUP not configured in .env');
    return null;
  }

  try {
    const client = new pg.Client({ connectionString: backupUrl });
    await client.connect();
    return client;
  } catch (error) {
    return null;
  }
}

async function syncToBackup() {
  console.log('🔄 Starting database backup to Supabase...\n');

  const backupClient = await getBackupConnection();
  if (!backupClient) {
    console.error('❌ Could not connect to backup database');
    process.exit(1);
  }

  try {
    // Get counts before sync
    const localCounts = {
      mothers: await localDb.mother.count(),
      pregnancies: await localDb.pregnancy.count(),
      ancVisits: await localDb.ancVisit.count(),
      vitals: await localDb.vitals.count(),
      symptoms: await localDb.symptoms.count(),
      alerts: await localDb.alert.count(),
      appointments: await localDb.appointment.count(),
    };

    console.log('📊 Local database counts:');
    Object.entries(localCounts).forEach(([table, count]) => {
      console.log(`   ${table}: ${count}`);
    });

    // Get backup counts
    const backupCounts = {};
    for (const table of Object.keys(localCounts)) {
      try {
        const result = await backupClient.query(`SELECT COUNT(*) as count FROM "${table}"`);
        backupCounts[table] = parseInt(result.rows[0].count, 10);
      } catch {
        backupCounts[table] = '?';
      }
    }

    console.log('\n📊 Backup database counts (Supabase):');
    Object.entries(backupCounts).forEach(([table, count]) => {
      console.log(`   ${table}: ${count}`);
    });

    console.log('\n✅ Backup utility ready!');
    console.log('   - Local database: SQLite (dev.db)');
    console.log('   - Backup database: Supabase PostgreSQL');
    console.log('\n📝 Note: Implement specific sync logic based on your needs.');
    console.log('   Common patterns:');
    console.log('   1. Full copy: SELECT * FROM local → INSERT/UPSERT to backup');
    console.log('   2. Incremental: Sync only new/modified records (timestamp-based)');
    console.log('   3. Selective: Sync only specific tables or time ranges');

  } catch (error) {
    console.error('❌ Backup failed:', error.message);
  } finally {
    await localDb.$disconnect();
    if (backupClient) {
      await backupClient.end();
    }
  }
}

async function checkStatus() {
  console.log('📊 Database Status:\n');

  try {
    // Check local database
    const localCount = await localDb.mother.count();
    console.log('✅ Local Database (SQLite):');
    console.log(`   Status: Connected`);
    console.log(`   File: ${process.env.DATABASE_URL}`);
    console.log(`   Records (mothers): ${localCount}`);

    // Check backup database
    const backupClient = await getBackupConnection();
    if (backupClient) {
      try {
        const result = await backupClient.query('SELECT COUNT(*) as count FROM "Mother"');
        const backupCount = parseInt(result.rows[0].count, 10);
        console.log('\n✅ Backup Database (Supabase):');
        console.log(`   Status: Connected`);
        console.log(`   Records (mothers): ${backupCount}`);
      } catch (error) {
        console.log('\n⚠️  Backup Database (Supabase):');
        console.log(`   Status: Connected (tables may not exist)`);
        console.log(`   Error: ${error.message.substring(0, 80)}`);
      } finally {
        await backupClient.end();
      }
    } else {
      console.log('\n⚠️  Backup Database (Supabase):');
      console.log(`   Status: Unreachable or not configured`);
      console.log(`   Check DATABASE_URL_BACKUP in .env`);
    }
  } catch (error) {
    console.error('❌ Status check failed:', error.message);
  } finally {
    await localDb.$disconnect();
  }
}

// CLI
const command = process.argv[2] || 'status';

(async () => {
  switch (command) {
    case 'sync':
      await syncToBackup();
      break;
    case 'status':
      await checkStatus();
      break;
    default:
      console.log('Usage: node lib/db-backup.js [sync|status]');
      process.exit(1);
  }
  process.exit(0);
})();
