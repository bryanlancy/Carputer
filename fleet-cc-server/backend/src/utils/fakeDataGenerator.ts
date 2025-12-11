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
 * @returns Generated fake data matching the schema
 */
export function generateFakeDataFromSchema(
	schema: any,
	propertyName?: string
): any {
	if (!schema || typeof schema !== 'object') {
		return generateDefaultValue(propertyName)
	}

	// Handle type field
	const type = schema.type

	if (type === 'object') {
		return generateObject(schema, propertyName)
	}

	if (type === 'array') {
		return generateArray(schema, propertyName)
	}

	if (type === 'string') {
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
 * Generate a fake object from schema
 */
function generateObject(schema: any, propertyName?: string): any {
	const result: any = {}
	const properties = schema.properties || {}

	for (const key in properties) {
		if (properties.hasOwnProperty(key)) {
			const propSchema = properties[key]
			const required = schema.required || []
			const isRequired = required.includes(key)

			// Generate value for this property
			result[key] = generateFakeDataFromSchema(propSchema, key)
		}
	}

	return result
}

/**
 * Generate a fake array from schema
 */
function generateArray(schema: any, propertyName?: string): any {
	const items = schema.items
	const minItems = schema.minItems || 1
	const maxItems = schema.maxItems || 3

	// Generate 1-3 items
	const count = Math.min(Math.max(minItems, 1), maxItems)
	const result: any[] = []

	for (let i = 0; i < count; i++) {
		if (items) {
			result.push(generateFakeDataFromSchema(items, propertyName))
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
	if (schema.format === 'date-time' || schema.format === 'date') {
		return new Date().toISOString()
	}
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
		return new Date()
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

	return null
}

/**
 * Generate fake data for a flat path (e.g., "device.hostname")
 * This is used when we have a variable path but need to generate the full object structure
 */
export function generateFakeDataForPath(path: string): any {
	const parts = path.split('.')
	const result: any = {}

	if (parts.length === 0) {
		return generateDefaultValue(path)
	}

	// Build nested structure
	let current = result
	for (let i = 0; i < parts.length; i++) {
		const part = parts[i]
		const isLast = i === parts.length - 1

		if (isLast) {
			// Last part gets a value
			current[part] = generateDefaultValue(part)
		} else {
			// Intermediate parts get objects
			current[part] = {}
			current = current[part]
		}
	}

	// Fill in common device structure if device is in path
	if (path.includes('device')) {
		if (!result.device) {
			result.device = {}
		}
		result.device = {
			id: 1,
			device_id: 'DEV-001',
			hostname: 'test-device',
			status: 'online',
			current_ip: '192.168.1.100',
			...result.device,
		}
	}

	// Fill in common user structure if user is in path
	if (path.includes('user')) {
		if (!result.user) {
			result.user = {}
		}
		result.user = {
			id: 'user-123',
			email: 'test@example.com',
			name: 'Test User',
			...result.user,
		}
	}

	return result
}

