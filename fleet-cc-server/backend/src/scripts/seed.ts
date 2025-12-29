import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

async function seed() {
	const pool = new Pool({
		connectionString: process.env.DATABASE_URL,
	})

	try {
		console.log('Starting database seeding...')

		// Helper function to generate random MAC address
		function generateMacAddress(): string {
			const hex = '0123456789ABCDEF'
			let mac = ''
			for (let i = 0; i < 6; i++) {
				if (i > 0) mac += ':'
				mac +=
					hex[Math.floor(Math.random() * 16)] +
					hex[Math.floor(Math.random() * 16)]
			}
			return mac
		}

		// Helper function to generate random IP address
		function generateIpAddress(): string {
			return `192.168.1.${Math.floor(Math.random() * 254) + 1}`
		}

		// Helper function to generate random build hash
		function generateBuildHash(): string {
			return Array.from(
				{ length: 64 },
				() => '0123456789abcdef'[Math.floor(Math.random() * 16)]
			).join('')
		}

		// Helper function to generate random git SHA
		function generateGitSha(): string {
			return Array.from(
				{ length: 40 },
				() => '0123456789abcdef'[Math.floor(Math.random() * 16)]
			).join('')
		}

		// Clear existing data (in reverse order of dependencies)
		console.log('Clearing existing data...')
		await pool.query('DELETE FROM device_logs')
		await pool.query('DELETE FROM commands')
		await pool.query('DELETE FROM device_registration_attempts')
		await pool.query('UPDATE devices SET image_id = NULL')
		await pool.query('DELETE FROM devices')
		await pool.query('DELETE FROM images')
		console.log('✓ Cleared existing data')

		// Seed default device FIRST (before images, before notifications)
		// This device is used for template previews and should have id=1
		console.log('Seeding default device (for template previews)...')
		const defaultDeviceResult = await pool.query(
			`INSERT INTO devices (
				device_id, mac_address, hostname, vin, hardware_rev, build_id, current_build_id,
				current_version, current_ip, status, authorized, authorized_at, authorized_by,
				registration_method, uptime, services_status, first_seen, last_seen,
				last_registration_attempt, is_default, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW())
			RETURNING id, device_id`,
			[
				'default-device', // device_id
				'00:00:00:00:00:00', // mac_address
				'default-carputer', // hostname
				'1DEFAULT0000000000', // vin
				'rev1.0', // hardware_rev
				'v1.0.0', // build_id
				'v1.0.0', // current_build_id
				'1.0.0', // current_version
				'192.168.1.100', // current_ip
				'online', // status
				true, // authorized
				new Date(), // authorized_at
				'system', // authorized_by
				'manual', // registration_method
				86400, // uptime (1 day in seconds)
				JSON.stringify({
					carputer_hub: true,
					carputer_ui: true,
					network: true,
				}), // services_status
				new Date(), // first_seen
				new Date(), // last_seen
				new Date(), // last_registration_attempt
				true, // is_default
			]
		)
		console.log(
			`✓ Seeded default device (id: ${defaultDeviceResult.rows[0].id}, device_id: ${defaultDeviceResult.rows[0].device_id})`
		)

		// Seed images table (consolidated with versions data)
		console.log('Seeding images table...')
		const images = [
			{
				image_build_hash:
					'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
				image_signature: 'verified-signature-1',
				build_id: 'v1.0.0',
				git_sha: generateGitSha(),
				build_timestamp: new Date('2024-01-15T10:00:00Z'),
				verified: true,
				verified_at: new Date('2024-01-15T10:05:00Z'),
				verified_by: 'admin',
				is_active: true,
				is_latest: false,
				changelog:
					'Initial production release\n- Core functionality\n- Device registration\n- Command system',
				notes: 'Production release v1.0.0',
			},
			{
				image_build_hash:
					'b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567890',
				image_signature: 'verified-signature-2',
				build_id: 'v1.1.0',
				git_sha: generateGitSha(),
				build_timestamp: new Date('2024-02-01T14:30:00Z'),
				verified: true,
				verified_at: new Date('2024-02-01T14:35:00Z'),
				verified_by: 'admin',
				is_active: true,
				is_latest: true,
				changelog:
					'Bug fixes and improvements\n- Fixed registration issues\n- Improved heartbeat reliability',
				notes: 'Production release v1.1.0 with bug fixes',
			},
			{
				image_build_hash:
					'c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567890ab',
				image_signature: null,
				build_id: 'v1.2.0-beta',
				git_sha: generateGitSha(),
				build_timestamp: new Date('2024-02-15T09:00:00Z'),
				verified: false,
				verified_at: null,
				verified_by: null,
				is_active: true,
				is_latest: false,
				changelog:
					'Beta release\n- New features\n- Experimental changes',
				notes: 'Beta release - needs verification',
			},
			{
				image_build_hash:
					'd4e5f6789012345678901234567890abcdef1234567890abcdef1234567890abcd',
				image_signature: null,
				build_id: 'v1.3.0-dev',
				git_sha: generateGitSha(),
				build_timestamp: new Date('2024-03-01T16:00:00Z'),
				verified: false,
				verified_at: null,
				verified_by: null,
				is_active: true,
				is_latest: false,
				changelog: null,
				notes: 'Development build - unverified image',
			},
			{
				image_build_hash:
					'e5f6789012345678901234567890abcdef1234567890abcdef1234567890abcdef',
				image_signature: 'verified-signature-3',
				build_id: 'v0.9.5',
				git_sha: generateGitSha(),
				build_timestamp: new Date('2023-12-20T11:00:00Z'),
				verified: true,
				verified_at: new Date('2023-12-20T11:05:00Z'),
				verified_by: 'admin',
				is_active: false,
				is_latest: false,
				changelog: null,
				notes: 'Legacy version - deactivated',
			},
		]

		const imageResults = []
		for (const image of images) {
			const result = await pool.query(
				`INSERT INTO images (
          image_build_hash, image_signature, build_id, git_sha, build_timestamp,
          verified, verified_at, verified_by, is_active, is_latest, changelog, notes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        RETURNING id, image_build_hash`,
				[
					image.image_build_hash,
					image.image_signature,
					image.build_id,
					image.git_sha,
					image.build_timestamp,
					image.verified,
					image.verified_at,
					image.verified_by,
					image.is_active,
					image.is_latest,
					image.changelog,
					image.notes,
				]
			)
			imageResults.push(result.rows[0])
		}
		console.log(
			`✓ Seeded ${imageResults.length} images (with version data merged)`
		)

		// Seed devices table
		console.log('Seeding devices table...')
		const devices = [
			{
				device_id: 'carputer-001',
				mac_address: 'AA:BB:CC:DD:EE:01',
				hostname: 'carputer-alpha',
				vin: '1HGBH41JXMN109186',
				hardware_rev: 'rev2.1',
				build_id: 'v1.0.0',
				current_build_id: 'v1.0.0',
				current_version: '1.0.0',
				image_id: imageResults[0].id,
				image_build_hash: imageResults[0].image_build_hash,
				image_signature: 'verified-signature-1',
				image_verified: true,
				image_verified_at: new Date('2024-01-15T10:05:00Z'),
				current_ip: '192.168.1.101',
				registration_ip: '192.168.1.101',
				status: 'offline',
				authorized: true,
				authorized_at: new Date('2024-01-15T10:10:00Z'),
				authorized_by: 'auto',
				registration_method: 'auto',
				uptime: 86400,
				services_status: {
					carputer_hub: true,
					carputer_ui: true,
					network: true,
				},
				first_seen: new Date('2024-01-15T10:10:00Z'),
				last_seen: new Date(),
				last_registration_attempt: new Date('2024-01-15T10:10:00Z'),
			},
			{
				device_id: 'carputer-002',
				mac_address: 'AA:BB:CC:DD:EE:02',
				hostname: 'carputer-beta',
				vin: '1HGBH41JXMN109187',
				hardware_rev: 'rev2.1',
				build_id: 'v1.1.0',
				current_build_id: 'v1.1.0',
				current_version: '1.1.0',
				image_id: imageResults[1].id,
				image_build_hash: imageResults[1].image_build_hash,
				image_signature: 'verified-signature-2',
				image_verified: true,
				image_verified_at: new Date('2024-02-01T14:35:00Z'),
				current_ip: '192.168.1.102',
				registration_ip: '192.168.1.102',
				status: 'offline',
				authorized: true,
				authorized_at: new Date('2024-02-01T14:40:00Z'),
				authorized_by: 'auto',
				registration_method: 'auto',
				uptime: 172800,
				services_status: {
					carputer_hub: true,
					carputer_ui: true,
					network: true,
				},
				first_seen: new Date('2024-02-01T14:40:00Z'),
				last_seen: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
				last_registration_attempt: new Date('2024-02-01T14:40:00Z'),
			},
			{
				device_id: 'carputer-003',
				mac_address: 'AA:BB:CC:DD:EE:03',
				hostname: 'carputer-gamma',
				vin: '1HGBH41JXMN109188',
				hardware_rev: 'rev2.0',
				build_id: 'v1.1.0',
				current_build_id: 'v1.1.0',
				current_version: '1.1.0',
				image_id: imageResults[1].id,
				image_build_hash: imageResults[1].image_build_hash,
				image_signature: 'verified-signature-2',
				image_verified: true,
				image_verified_at: new Date('2024-02-01T14:35:00Z'),
				current_ip: '192.168.1.103',
				registration_ip: '192.168.1.103',
				status: 'offline',
				authorized: true,
				authorized_at: new Date('2024-02-02T08:00:00Z'),
				authorized_by: 'auto',
				registration_method: 'auto',
				uptime: null,
				services_status: null,
				first_seen: new Date('2024-02-02T08:00:00Z'),
				last_seen: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
				last_registration_attempt: new Date('2024-02-02T08:00:00Z'),
			},
			{
				device_id: 'carputer-004',
				mac_address: 'AA:BB:CC:DD:EE:04',
				hostname: 'carputer-delta',
				vin: '1HGBH41JXMN109189',
				hardware_rev: 'rev2.1',
				build_id: 'v1.2.0-beta',
				current_build_id: 'v1.2.0-beta',
				current_version: '1.2.0-beta',
				image_id: imageResults[2].id,
				image_build_hash: imageResults[2].image_build_hash,
				image_signature: null,
				image_verified: false,
				image_verified_at: null,
				current_ip: '192.168.1.104',
				registration_ip: '192.168.1.104',
				status: 'offline',
				authorized: false,
				authorized_at: null,
				authorized_by: null,
				registration_method: 'auto',
				uptime: 43200,
				services_status: {
					carputer_hub: true,
					carputer_ui: false,
					network: true,
				},
				first_seen: new Date('2024-02-15T09:30:00Z'),
				last_seen: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
				last_registration_attempt: new Date('2024-02-15T09:30:00Z'),
			},
			{
				device_id: 'carputer-005',
				mac_address: 'AA:BB:CC:DD:EE:05',
				hostname: 'carputer-epsilon',
				vin: '1HGBH41JXMN109190',
				hardware_rev: 'rev2.2',
				build_id: 'v1.3.0-dev',
				current_build_id: 'v1.3.0-dev',
				current_version: '1.3.0-dev',
				image_id: imageResults[3].id,
				image_build_hash: imageResults[3].image_build_hash,
				image_signature: null,
				image_verified: false,
				image_verified_at: null,
				current_ip: '192.168.1.105',
				registration_ip: '192.168.1.105',
				status: 'offline',
				authorized: false,
				authorized_at: null,
				authorized_by: null,
				registration_method: 'auto',
				uptime: 21600,
				services_status: {
					carputer_hub: true,
					carputer_ui: true,
					network: false,
				},
				first_seen: new Date('2024-03-01T16:15:00Z'),
				last_seen: new Date(Date.now() - 1 * 60 * 1000), // 1 minute ago
				last_registration_attempt: new Date('2024-03-01T16:15:00Z'),
			},
			{
				device_id: 'carputer-006',
				mac_address: 'AA:BB:CC:DD:EE:06',
				hostname: 'carputer-zeta',
				vin: '1HGBH41JXMN109191',
				hardware_rev: 'rev2.0',
				build_id: 'v0.9.5',
				current_build_id: 'v0.9.5',
				current_version: '0.9.5',
				image_id: imageResults[4].id,
				image_build_hash: imageResults[4].image_build_hash,
				image_signature: 'verified-signature-3',
				image_verified: true,
				image_verified_at: new Date('2023-12-20T11:05:00Z'),
				current_ip: '192.168.1.106',
				registration_ip: '192.168.1.106',
				status: 'offline',
				authorized: true,
				authorized_at: new Date('2023-12-20T11:10:00Z'),
				authorized_by: 'admin',
				registration_method: 'manual',
				uptime: null,
				services_status: null,
				first_seen: new Date('2023-12-20T11:10:00Z'),
				last_seen: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
				last_registration_attempt: new Date('2023-12-20T11:10:00Z'),
			},
		]

		const deviceResults = []
		for (const device of devices) {
			const result = await pool.query(
				`INSERT INTO devices (
          device_id, mac_address, hostname, vin, hardware_rev, build_id, current_build_id,
          current_version, image_id, image_build_hash, image_signature, image_verified, image_verified_at,
          current_ip, registration_ip, status, authorized, authorized_at, authorized_by,
          registration_method, uptime, services_status, first_seen, last_seen,
          last_registration_attempt, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, NOW(), NOW())
        RETURNING id, device_id`,
				[
					device.device_id,
					device.mac_address,
					device.hostname,
					device.vin,
					device.hardware_rev,
					device.build_id,
					device.current_build_id,
					device.current_version,
					device.image_id,
					device.image_build_hash,
					device.image_signature,
					device.image_verified,
					device.image_verified_at,
					device.current_ip,
					device.registration_ip,
					device.status,
					device.authorized,
					device.authorized_at,
					device.authorized_by,
					device.registration_method,
					device.uptime,
					JSON.stringify(device.services_status),
					device.first_seen,
					device.last_seen,
					device.last_registration_attempt,
				]
			)
			deviceResults.push(result.rows[0])
		}
		console.log(`✓ Seeded ${deviceResults.length} devices`)

		// Seed commands table
		console.log('Seeding commands table...')
		const commands = [
			{
				device_id: deviceResults[0].id,
				command: 'reboot',
				parameters: null,
				status: 'completed',
				result: {
					success: true,
					rebooted_at: new Date().toISOString(),
				},
				error: null,
				completed_at: new Date(Date.now() - 1 * 60 * 60 * 1000),
			},
			{
				device_id: deviceResults[0].id,
				command: 'collect_logs',
				parameters: { log_types: ['system', 'application'] },
				status: 'pending',
				result: null,
				error: null,
				completed_at: null,
			},
			{
				device_id: deviceResults[1].id,
				command: 'update',
				parameters: { target_version: 'v1.2.0' },
				status: 'running',
				result: null,
				error: null,
				completed_at: null,
			},
			{
				device_id: deviceResults[1].id,
				command: 'start_service',
				parameters: { service: 'carputer_ui' },
				status: 'completed',
				result: {
					success: true,
					service: 'carputer_ui',
					started_at: new Date().toISOString(),
				},
				error: null,
				completed_at: new Date(Date.now() - 30 * 60 * 1000),
			},
			{
				device_id: deviceResults[2].id,
				command: 'trigger_rsync',
				parameters: { source: '/data', destination: 'server://backup' },
				status: 'failed',
				result: null,
				error: 'Device offline - cannot execute command',
				completed_at: new Date(Date.now() - 3 * 60 * 60 * 1000),
			},
			{
				device_id: deviceResults[0].id,
				command: 'stop_service',
				parameters: { service: 'network' },
				status: 'completed',
				result: {
					success: true,
					service: 'network',
					stopped_at: new Date().toISOString(),
				},
				error: null,
				completed_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
			},
			{
				device_id: deviceResults[3].id,
				command: 'reboot',
				parameters: null,
				status: 'pending',
				result: null,
				error: null,
				completed_at: null,
			},
		]

		for (const cmd of commands) {
			await pool.query(
				`INSERT INTO commands (device_id, command, parameters, status, result, error, created_at, updated_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), $7)`,
				[
					cmd.device_id,
					cmd.command,
					cmd.parameters ? JSON.stringify(cmd.parameters) : null,
					cmd.status,
					cmd.result ? JSON.stringify(cmd.result) : null,
					cmd.error,
					cmd.completed_at,
				]
			)
		}
		console.log(`✓ Seeded ${commands.length} commands`)

		// Seed device_logs table
		console.log('Seeding device_logs table...')
		const deviceLogs = [
			{
				device_id: deviceResults[0].id,
				log_type: 'system',
				log_path: '/var/log/carputer/system.log',
				file_size: 1048576,
				metadata: {
					lines: 10000,
					last_modified: new Date().toISOString(),
				},
			},
			{
				device_id: deviceResults[0].id,
				log_type: 'application',
				log_path: '/var/log/carputer/app.log',
				file_size: 524288,
				metadata: {
					lines: 5000,
					last_modified: new Date().toISOString(),
				},
			},
			{
				device_id: deviceResults[1].id,
				log_type: 'system',
				log_path: '/var/log/carputer/system.log',
				file_size: 2097152,
				metadata: {
					lines: 20000,
					last_modified: new Date().toISOString(),
				},
			},
			{
				device_id: deviceResults[2].id,
				log_type: 'error',
				log_path: '/var/log/carputer/error.log',
				file_size: 262144,
				metadata: {
					lines: 2500,
					last_modified: new Date(
						Date.now() - 2 * 60 * 60 * 1000
					).toISOString(),
				},
			},
		]

		for (const log of deviceLogs) {
			await pool.query(
				`INSERT INTO device_logs (device_id, log_type, log_path, uploaded_at, file_size, metadata)
         VALUES ($1, $2, $3, NOW(), $4, $5)`,
				[
					log.device_id,
					log.log_type,
					log.log_path,
					log.file_size,
					JSON.stringify(log.metadata),
				]
			)
		}
		console.log(`✓ Seeded ${deviceLogs.length} device logs`)

		// Seed device_registration_attempts table
		console.log('Seeding device_registration_attempts table...')
		const registrationAttempts = [
			{
				mac_address: devices[0].mac_address,
				device_id: devices[0].device_id,
				ip_address: devices[0].registration_ip,
				image_build_hash: devices[0].image_build_hash,
				image_signature: devices[0].image_signature,
				registration_method: 'auto',
				success: true,
				error_message: null,
				created_at: devices[0].first_seen,
			},
			{
				mac_address: devices[1].mac_address,
				device_id: devices[1].device_id,
				ip_address: devices[1].registration_ip,
				image_build_hash: devices[1].image_build_hash,
				image_signature: devices[1].image_signature,
				registration_method: 'auto',
				success: true,
				error_message: null,
				created_at: devices[1].first_seen,
			},
			{
				mac_address: devices[3].mac_address,
				device_id: devices[3].device_id,
				ip_address: devices[3].registration_ip,
				image_build_hash: devices[3].image_build_hash,
				image_signature: null,
				registration_method: 'auto',
				success: true,
				error_message: null,
				created_at: devices[3].first_seen,
			},
			{
				mac_address: 'AA:BB:CC:DD:EE:99',
				device_id: null,
				ip_address: '192.168.1.200',
				image_build_hash: generateBuildHash(),
				image_signature: null,
				registration_method: 'auto',
				success: false,
				error_message: 'Image not verified - unverified image',
				created_at: new Date(Date.now() - 1 * 60 * 60 * 1000),
			},
			{
				mac_address: 'AA:BB:CC:DD:EE:98',
				device_id: 'carputer-failed',
				ip_address: '192.168.1.201',
				image_build_hash: devices[0].image_build_hash,
				image_signature: 'invalid-signature',
				registration_method: 'auto',
				success: false,
				error_message: 'Image signature verification failed',
				created_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
			},
		]

		for (const attempt of registrationAttempts) {
			await pool.query(
				`INSERT INTO device_registration_attempts (
          mac_address, device_id, ip_address, image_build_hash, image_signature,
          registration_method, success, error_message, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
				[
					attempt.mac_address,
					attempt.device_id,
					attempt.ip_address,
					attempt.image_build_hash,
					attempt.image_signature,
					attempt.registration_method,
					attempt.success,
					attempt.error_message,
					attempt.created_at,
				]
			)
		}
		console.log(
			`✓ Seeded ${registrationAttempts.length} registration attempts`
		)

		console.log('\n✓ Database seeding completed successfully!')
		console.log('\nSummary:')
		console.log(
			`  - ${imageResults.length} images (${
				images.filter(i => i.verified).length
			} verified, ${images.filter(i => !i.verified).length} unverified)`
		)
		console.log(
			`  - ${deviceResults.length} devices (${
				devices.filter(d => d.status === 'online').length
			} online, ${
				devices.filter(d => d.status === 'offline').length
			} offline)`
		)
		console.log(
			`  - ${devices.filter(d => d.authorized).length} authorized, ${
				devices.filter(d => !d.authorized).length
			} unauthorized`
		)
		console.log(`  - ${commands.length} commands`)
		console.log(`  - ${deviceLogs.length} device logs`)
		console.log(`  - ${registrationAttempts.length} registration attempts`)
	} catch (error) {
		console.error('Seeding failed:', error)
		process.exit(1)
	} finally {
		await pool.end()
	}
}

seed()
