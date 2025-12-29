import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Only load .env if not in Docker (Docker provides env vars via docker-compose.yml)
// When running via docker compose exec, DOCKER_ENV is set and POSTGRES_* vars are available
if (!process.env.DOCKER_ENV && !process.env.POSTGRES_HOST) {
	dotenv.config();
}

/**
 * URL-encode password to match the entrypoint script logic
 * This handles special characters in PostgreSQL passwords
 */
function encodePassword(password: string): string {
	// Handle backslash escape sequences first
	let cleaned = password.replace(/\\\+/g, '+').replace(/\\=/g, '=').replace(/\\\$/g, '$');

	// URL-encode special characters (order matters - % must be first)
	return cleaned
		.replace(/%/g, '%25')
		.replace(/\+/g, '%2B')
		.replace(/ /g, '%20')
		.replace(/#/g, '%23')
		.replace(/\$/g, '%24')
		.replace(/&/g, '%26')
		.replace(/=/g, '%3D')
		.replace(/\?/g, '%3F')
		.replace(/@/g, '%40')
		.replace(/\//g, '%2F');
}

async function migrate() {
  // When running via docker compose exec, the entrypoint doesn't run, so DATABASE_URL isn't set
  // But POSTGRES_* environment variables from docker-compose.yml are available
  // Construct DATABASE_URL using the same logic as the entrypoint script
  const host = process.env.POSTGRES_HOST || 'postgres';
  const port = process.env.POSTGRES_PORT || '5432';
  const database = process.env.POSTGRES_DB || 'fleet_cc';
  const user = process.env.POSTGRES_USER || 'postgres';
  const password = process.env.POSTGRES_PASSWORD || '';

  // Prefer DATABASE_URL if available (set by entrypoint script when container runs normally)
  // Otherwise construct it with proper password encoding
  const databaseUrl = process.env.DATABASE_URL ||
    `postgres://${user}:${encodePassword(password)}@${host}:${port}/${database}`;

  const pool = new Pool({
    connectionString: databaseUrl,
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

