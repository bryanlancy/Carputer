import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function verifySeed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Verifying database connection and seeded data...\n');

    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✓ Database connection successful\n');

    // Check images
    const imagesResult = await pool.query('SELECT COUNT(*) as count FROM images');
    const imagesCount = parseInt(imagesResult.rows[0].count);
    console.log(`Images: ${imagesCount}`);
    if (imagesCount > 0) {
      const verifiedCount = await pool.query(
        "SELECT COUNT(*) as count FROM images WHERE verified = true"
      );
      const unverifiedCount = await pool.query(
        "SELECT COUNT(*) as count FROM images WHERE verified = false"
      );
      console.log(`  - Verified: ${verifiedCount.rows[0].count}`);
      console.log(`  - Unverified: ${unverifiedCount.rows[0].count}`);
    }

    // Check devices
    const devicesResult = await pool.query('SELECT COUNT(*) as count FROM devices');
    const devicesCount = parseInt(devicesResult.rows[0].count);
    console.log(`\nDevices: ${devicesCount}`);
    if (devicesCount > 0) {
      const onlineCount = await pool.query(
        "SELECT COUNT(*) as count FROM devices WHERE status = 'online'"
      );
      const authorizedCount = await pool.query(
        "SELECT COUNT(*) as count FROM devices WHERE authorized = true"
      );
      console.log(`  - Online: ${onlineCount.rows[0].count}`);
      console.log(`  - Authorized: ${authorizedCount.rows[0].count}`);
    }

    // Check commands
    const commandsResult = await pool.query('SELECT COUNT(*) as count FROM commands');
    console.log(`\nCommands: ${commandsResult.rows[0].count}`);

    // Check device_logs
    const logsResult = await pool.query('SELECT COUNT(*) as count FROM device_logs');
    console.log(`Device Logs: ${logsResult.rows[0].count}`);

    // Check registration attempts
    const attemptsResult = await pool.query('SELECT COUNT(*) as count FROM device_registration_attempts');
    console.log(`Registration Attempts: ${attemptsResult.rows[0].count}`);

    // Test API endpoint data format
    console.log('\n--- Sample Device Data (as API would return) ---');
    const sampleDevice = await pool.query(
      'SELECT * FROM devices LIMIT 1'
    );
    if (sampleDevice.rows.length > 0) {
      console.log(JSON.stringify(sampleDevice.rows[0], null, 2));
    } else {
      console.log('No devices found');
    }

    console.log('\n--- Sample Image Data (as API would return) ---');
    const sampleImage = await pool.query(
      'SELECT * FROM images LIMIT 1'
    );
    if (sampleImage.rows.length > 0) {
      console.log(JSON.stringify(sampleImage.rows[0], null, 2));
    } else {
      console.log('No images found');
    }

    if (imagesCount === 0 || devicesCount === 0) {
      console.log('\n⚠️  WARNING: Database appears to be empty. Run: npm run db:seed');
      process.exit(1);
    } else {
      console.log('\n✓ Database verification successful!');
    }
  } catch (error) {
    console.error('Verification failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifySeed();

