import Database from 'better-sqlite3';
import path from 'path';

try {
  const dbPath = path.resolve('./prisma/dev.db');
  console.log(`Opening database at: ${dbPath}`);
  
  const db = new Database(dbPath);
  
  // Query the districts table directly
  const result = db.prepare('SELECT COUNT(*) as count FROM districts').get();
  console.log(`Districts in database: ${result.count}`);
  
  // Get first 5
  const districts = db.prepare('SELECT id, name FROM districts ORDER BY name LIMIT 5').all();
  if (districts.length > 0) {
    console.log('\nFirst 5 districts:');
    districts.forEach((d) => {
      console.log(`  - ${d.name} (ID: ${d.id})`);
    });
  } else {
    console.log('\nNo districts found');
  }
  
  db.close();
} catch (error) {
  console.error('Error:', error.message);
}
