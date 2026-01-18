import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Seeding database with test devices...');

    // Check if test devices already exist
    const existing = await pool.query(
      "SELECT COUNT(*) as count FROM devices WHERE device_id LIKE 'TEST-%'"
    );
    const count = parseInt(existing.rows[0].count);

    if (count > 0) {
      console.log(`Found ${count} existing test devices. Deleting...`);
      await pool.query("DELETE FROM devices WHERE device_id LIKE 'TEST-%'");
      console.log('Deleted existing test devices.');
    }

    // Create test devices with various statuses
    const testDevices = [
      // Online devices (should appear first when sorted)
      {
        device_id: 'TEST-001-ONLINE',
        hostname: 'TEST-carputer-alpha',
        vin: 'TEST-VIN-ALPHA-001',
        hardware_rev: 'RPi4-Rev1.1',
        build_id: 'build-2024.11.15-abc123',
        current_version: 'v1.2.3',
        current_build_id: 'build-2024.11.15-abc123',
        current_ip: '192.168.1.101',
        uptime: 86400, // 1 day
        services_status: { hub: true, ui: true, network: true },
        status: 'online',
        last_seen: new Date(Date.now() - 30000), // 30 seconds ago
      },
      {
        device_id: 'TEST-002-ONLINE',
        hostname: 'TEST-carputer-beta',
        vin: 'TEST-VIN-BETA-002',
        hardware_rev: 'RPi4-Rev1.2',
        build_id: 'build-2024.11.15-def456',
        current_version: 'v1.2.3',
        current_build_id: 'build-2024.11.15-def456',
        current_ip: '192.168.1.102',
        uptime: 172800, // 2 days
        services_status: { hub: true, ui: false, network: true },
        status: 'online',
        last_seen: new Date(Date.now() - 60000), // 1 minute ago
      },
      {
        device_id: 'TEST-003-ONLINE',
        hostname: 'TEST-carputer-gamma',
        vin: 'TEST-VIN-GAMMA-003',
        hardware_rev: 'RPi4-Rev1.1',
        build_id: 'build-2024.11.14-ghi789',
        current_version: 'v1.2.2',
        current_build_id: 'build-2024.11.14-ghi789',
        current_ip: '192.168.1.103',
        uptime: 43200, // 12 hours
        services_status: { hub: true, ui: true, network: true },
        status: 'online',
        last_seen: new Date(Date.now() - 120000), // 2 minutes ago
      },
      // Offline devices
      {
        device_id: 'TEST-004-OFFLINE',
        hostname: 'TEST-carputer-delta',
        vin: 'TEST-VIN-DELTA-004',
        hardware_rev: 'RPi4-Rev1.0',
        build_id: 'build-2024.11.10-jkl012',
        current_version: 'v1.2.1',
        current_build_id: 'build-2024.11.10-jkl012',
        current_ip: '192.168.1.104',
        uptime: null,
        services_status: null,
        status: 'offline',
        last_seen: new Date(Date.now() - 86400000), // 1 day ago
      },
      {
        device_id: 'TEST-005-OFFLINE',
        hostname: 'TEST-carputer-epsilon',
        vin: 'TEST-VIN-EPSILON-005',
        hardware_rev: 'RPi4-Rev1.1',
        build_id: 'build-2024.11.08-mno345',
        current_version: 'v1.2.0',
        current_build_id: 'build-2024.11.08-mno345',
        current_ip: null,
        uptime: null,
        services_status: null,
        status: 'offline',
        last_seen: new Date(Date.now() - 172800000), // 2 days ago
      },
      // Stale device (online but hasn't checked in recently)
      {
        device_id: 'TEST-006-STALE',
        hostname: 'TEST-carputer-zeta',
        vin: 'TEST-VIN-ZETA-006',
        hardware_rev: 'RPi4-Rev1.2',
        build_id: 'build-2024.11.12-pqr678',
        current_version: 'v1.2.2',
        current_build_id: 'build-2024.11.12-pqr678',
        current_ip: '192.168.1.106',
        uptime: 259200, // 3 days
        services_status: { hub: true, ui: false, network: false },
        status: 'stale',
        last_seen: new Date(Date.now() - 3600000), // 1 hour ago
      },
      // Device with minimal info
      {
        device_id: 'TEST-007-MINIMAL',
        hostname: null,
        vin: null,
        hardware_rev: null,
        build_id: null,
        current_version: null,
        current_build_id: null,
        current_ip: null,
        uptime: null,
        services_status: null,
        status: 'offline',
        last_seen: null,
      },
      // Online device with different build version
      {
        device_id: 'TEST-008-ONLINE-OLD',
        hostname: 'TEST-carputer-eta',
        vin: 'TEST-VIN-ETA-008',
        hardware_rev: 'RPi4-Rev1.0',
        build_id: 'build-2024.11.05-stu901',
        current_version: 'v1.1.5',
        current_build_id: 'build-2024.11.05-stu901',
        current_ip: '192.168.1.108',
        uptime: 604800, // 7 days
        services_status: { hub: true, ui: true, network: true },
        status: 'online',
        last_seen: new Date(Date.now() - 45000), // 45 seconds ago
      },
    ];

    // Insert test devices
    for (const device of testDevices) {
      await pool.query(
        `INSERT INTO devices (
          device_id, hostname, vin, hardware_rev, build_id,
          current_version, current_build_id, current_ip, uptime,
          services_status, status, last_seen, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
        [
          device.device_id,
          device.hostname,
          device.vin,
          device.hardware_rev,
          device.build_id,
          device.current_version,
          device.current_build_id,
          device.current_ip,
          device.uptime,
          device.services_status ? JSON.stringify(device.services_status) : null,
          device.status,
          device.last_seen,
        ]
      );
    }

    console.log(`✅ Successfully seeded ${testDevices.length} test devices!`);
    console.log('');
    console.log('Test devices are labeled with "TEST-" prefix in device_id and hostname.');
    console.log('You can identify and remove them later with:');
    console.log('  DELETE FROM devices WHERE device_id LIKE \'TEST-%\';');
    console.log('');

  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();




