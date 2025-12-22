/**
 * Fake Data Generator
 *
 * Generates realistic fake data from JSON schemas for testing purposes.
 * Used in notification and trigger testing to create sample data that matches
 * the expected schema structure.
 */

/**
 * Generate fake data from a JSON schema
 * @param schema - JSON schema object
 * @param propertyName - Optional property name for context-aware generation
 * @param triggerCode - Optional trigger code for trigger-specific data generation
 * @param triggerName - Optional trigger name for trigger-specific data generation
 * @returns Generated fake data matching the schema
 */
export function generateFakeDataFromSchema(
	schema: any,
	propertyName?: string,
	triggerCode?: string,
	triggerName?: string
): any {
	// Check if this is a top-level object and we have trigger context
	if (schema?.type === 'object' && !propertyName && (triggerCode || triggerName)) {
		const triggerSpecificData = generateTriggerSpecificData(
			schema,
			triggerCode,
			triggerName
		)
		if (triggerSpecificData) {
			return triggerSpecificData
		}
	}

	if (!schema || typeof schema !== 'object') {
		return generateDefaultValue(propertyName)
	}

	// Handle type field
	const type = schema.type

	if (type === 'object') {
		return generateObject(schema, propertyName, triggerCode, triggerName)
	}

	if (type === 'array') {
		return generateArray(schema, propertyName, triggerCode, triggerName)
	}

	if (type === 'string') {
		// Check for date-time format - return ISO string
		if (schema.format === 'date-time' || schema.format === 'date') {
			return new Date().toISOString()
		}
		return generateString(schema, propertyName)
	}

	if (type === 'number' || type === 'integer') {
		return generateNumber(schema, propertyName)
	}

	if (type === 'boolean') {
		return generateBoolean(schema, propertyName)
	}

	// Fallback for unknown types
	return generateDefaultValue(propertyName)
}

/**
 * Generate trigger-specific test data based on trigger code/name
 */
function generateTriggerSpecificData(
	schema: any,
	triggerCode?: string,
	triggerName?: string
): any | null {
	const code = triggerCode?.toLowerCase() || ''
	const name = triggerName?.toLowerCase() || ''
	const now = new Date()

	// Device Online trigger
	if (code === 'device.online' || name.includes('device online')) {
		return {
			device: {
				id: 1,
				device_id: 'DEV-001',
				hostname: 'test-device-01',
				vin: '1HGBH41JXMN109186',
				hardware_rev: 'R1.0',
				build_id: 'build-2024.01.15',
				current_version: '1.2.3',
				current_build_id: 'build-2024.01.15',
				current_ip: '192.168.1.100',
				uptime: 3600,
				services_status: {
					carputer_hub: true,
					carputer_ui: true,
					network_manager: true,
				},
				status: 'online',
				last_seen: now.toISOString(),
			},
			timestamp: now.toISOString(),
		}
	}

	// Device Offline trigger
	if (code === 'device.offline' || name.includes('device offline')) {
		return {
			device: {
				id: 1,
				device_id: 'DEV-001',
				hostname: 'test-device-01',
				vin: '1HGBH41JXMN109186',
				hardware_rev: 'R1.0',
				build_id: 'build-2024.01.15',
				current_version: '1.2.3',
				current_build_id: 'build-2024.01.15',
				current_ip: '192.168.1.100',
				uptime: 7200,
				services_status: {
					carputer_hub: false,
					carputer_ui: false,
					network_manager: false,
				},
				status: 'offline',
				last_seen: new Date(now.getTime() - 300000).toISOString(), // 5 minutes ago
			},
			timestamp: now.toISOString(),
		}
	}

	// Command Completed trigger
	if (code === 'command.completed' || name.includes('command completed')) {
		return {
			command: {
				id: 1,
				command: 'reboot',
				parameters: {},
				status: 'completed',
				result: {
					success: true,
					message: 'Device rebooted successfully',
					reboot_time: now.toISOString(),
				},
				created_at: new Date(now.getTime() - 60000).toISOString(), // 1 minute ago
				completed_at: now.toISOString(),
			},
			device: {
				id: 1,
				device_id: 'DEV-001',
				hostname: 'test-device-01',
				status: 'online',
				current_ip: '192.168.1.100',
			},
			user: {
				id: 'user-123',
				email: 'admin@example.com',
				name: 'Admin User',
			},
			timestamp: now.toISOString(),
		}
	}

	// Command Failed trigger
	if (code === 'command.failed' || name.includes('command failed')) {
		return {
			command: {
				id: 2,
				command: 'update',
				parameters: {
					build_id: 'build-2024.01.20',
				},
				status: 'failed',
				error: 'Update failed: Network timeout while downloading update package',
				created_at: new Date(now.getTime() - 120000).toISOString(), // 2 minutes ago
				completed_at: now.toISOString(),
			},
			device: {
				id: 1,
				device_id: 'DEV-001',
				hostname: 'test-device-01',
				status: 'online',
				current_ip: '192.168.1.100',
			},
			user: {
				id: 'user-123',
				email: 'admin@example.com',
				name: 'Admin User',
			},
			error: 'Update failed: Network timeout while downloading update package',
			timestamp: now.toISOString(),
		}
	}

	// Date/Time trigger
	if (code === 'date_time' || name.includes('date/time') || name.includes('date time')) {
		const dateStr = now.toISOString().split('T')[0]
		const timeStr = now.toTimeString().split(' ')[0]
		return {
			timestamp: now.toISOString(),
			date: dateStr,
			time: timeStr,
		}
	}

	return null
}

/**
 * Generate a fake object from schema
 */
function generateObject(
	schema: any,
	propertyName?: string,
	triggerCode?: string,
	triggerName?: string
): any {
	const result: any = {}
	const properties = schema.properties || {}

	for (const key in properties) {
		if (properties.hasOwnProperty(key)) {
			const propSchema = properties[key]
			const required = schema.required || []
			const isRequired = required.includes(key)

			// Generate value for this property
			result[key] = generateFakeDataFromSchema(
				propSchema,
				key,
				triggerCode,
				triggerName
			)
		}
	}

	return result
}

/**
 * Generate a fake array from schema
 */
function generateArray(
	schema: any,
	propertyName?: string,
	triggerCode?: string,
	triggerName?: string
): any {
	const items = schema.items
	const minItems = schema.minItems || 1
	const maxItems = schema.maxItems || 3

	// Generate 1-3 items
	const count = Math.min(Math.max(minItems, 1), maxItems)
	const result: any[] = []

	for (let i = 0; i < count; i++) {
		if (items) {
			result.push(
				generateFakeDataFromSchema(items, propertyName, triggerCode, triggerName)
			)
		} else {
			result.push(null)
		}
	}

	return result
}

/**
 * Generate a fake string from schema
 */
function generateString(schema: any, propertyName?: string): string {
	// Use property name to generate context-aware values
	if (propertyName) {
		const lowerName = propertyName.toLowerCase()

		// Device-related properties
		if (lowerName.includes('device_id') || lowerName === 'device_id') {
			return 'DEV-001'
		}
		if (lowerName.includes('hostname')) {
			return 'test-device'
		}
		if (lowerName.includes('status')) {
			return 'online'
		}
		if (lowerName.includes('id') && !lowerName.includes('device')) {
			return '1'
		}
		if (lowerName.includes('name') && !lowerName.includes('host')) {
			return 'Test Name'
		}
		if (lowerName.includes('email')) {
			return 'test@example.com'
		}
		if (lowerName.includes('type')) {
			return 'test.type'
		}
		if (lowerName.includes('version')) {
			return '1.0.0'
		}
		if (lowerName.includes('ip') || lowerName.includes('address')) {
			return '192.168.1.100'
		}
		if (lowerName.includes('vin')) {
			return 'TEST123456789'
		}
	}

	// Check for enum
	if (schema.enum && schema.enum.length > 0) {
		return schema.enum[0]
	}

	// Check for format
	if (schema.format === 'email') {
		return 'test@example.com'
	}
	if (schema.format === 'uri' || schema.format === 'url') {
		return 'https://example.com'
	}

	// Default string
	return 'test-value'
}

/**
 * Generate a fake number from schema
 */
function generateNumber(schema: any, propertyName?: string): number {
	if (propertyName) {
		const lowerName = propertyName.toLowerCase()

		if (lowerName.includes('id')) {
			return 1
		}
		if (lowerName.includes('port')) {
			return 8080
		}
		if (lowerName.includes('priority')) {
			return 0
		}
		if (lowerName.includes('uptime')) {
			return 3600
		}
	}

	// Check for minimum/maximum
	const min = schema.minimum !== undefined ? schema.minimum : 0
	const max = schema.maximum !== undefined ? schema.maximum : 100

	return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Generate a fake boolean from schema
 */
function generateBoolean(schema: any, propertyName?: string): boolean {
	if (propertyName) {
		const lowerName = propertyName.toLowerCase()

		if (lowerName.includes('enabled') || lowerName.includes('active')) {
			return true
		}
		if (lowerName.includes('disabled') || lowerName.includes('inactive')) {
			return false
		}
	}

	return true
}

/**
 * Generate a default value based on property name
 */
function generateDefaultValue(propertyName?: string): any {
	if (!propertyName) {
		return null
	}

	const lowerName = propertyName.toLowerCase()

	// Timestamp-related
	if (
		lowerName.includes('timestamp') ||
		lowerName.includes('date') ||
		lowerName.includes('time')
	) {
		return new Date().toISOString()
	}

	// Device-related
	if (lowerName.includes('device')) {
		return {
			id: 1,
			device_id: 'DEV-001',
			hostname: 'test-device',
			status: 'online',
			current_ip: '192.168.1.100',
		}
	}

	// User-related
	if (lowerName.includes('user')) {
		return {
			id: 'user-123',
			email: 'test@example.com',
			name: 'Test User',
		}
	}

	// Command-related
	if (lowerName.includes('command')) {
		return {
			id: 1,
			command: 'reboot',
			parameters: {},
			status: 'completed',
			result: { success: true },
			created_at: new Date().toISOString(),
			completed_at: new Date().toISOString(),
		}
	}

	return null
}
