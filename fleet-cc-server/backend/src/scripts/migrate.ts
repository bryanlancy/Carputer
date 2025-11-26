import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Running database migrations...');

    // Get migrations directory
    const migrationsDir = path.join(__dirname, '../db/migrations');

    // Read all migration files and sort them
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration file(s)`);

    // Execute each migration in order
    for (const file of files) {
      const migrationPath = path.join(migrationsDir, file);
      console.log(`Running migration: ${file}`);

      const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
      await pool.query(migrationSQL);

      console.log(`✓ Completed: ${file}`);
    }

    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();

