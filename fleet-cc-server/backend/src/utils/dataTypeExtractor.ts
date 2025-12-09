/**
 * Data Type Extractor
 *
 * Extracts data type categories (User, Date/Time, Device, Command) from JSON schemas.
 * Used to determine what data triggers emit and what data actions require.
 */

export type DataType = 'User' | 'Date/Time' | 'Device' | 'Command'

export interface DataTypeInfo {
	types: DataType[]
	properties: Record<string, any>
}

/**
 * Extract data types from a JSON schema
 * Analyzes the schema properties to identify data categories
 */
export function extractDataTypes(schema: any): DataType[] {
	if (!schema || typeof schema !== 'object') {
		return []
	}

	const types: Set<DataType> = new Set()

	// Check if schema has properties
	const properties = schema.properties || {}

	// Check for User data
	if (hasUserData(properties)) {
		types.add('User')
	}

	// Check for Date/Time data
	if (hasDateTimeData(properties)) {
		types.add('Date/Time')
	}

	// Check for Device data
	if (hasDeviceData(properties)) {
		types.add('Device')
	}

	// Check for Command data
	if (hasCommandData(properties)) {
		types.add('Command')
	}

	return Array.from(types)
}

/**
 * Check if schema contains User data
 */
function hasUserData(properties: any): boolean {
	// Look for user-related properties
	const userIndicators = ['user', 'user_id', 'username', 'email', 'user_name']

	for (const key in properties) {
		const lowerKey = key.toLowerCase()
		if (userIndicators.some(indicator => lowerKey.includes(indicator))) {
			return true
		}

		// Check nested objects
		const prop = properties[key]
		if (prop && typeof prop === 'object' && prop.type === 'object') {
			if (hasUserData(prop.properties || {})) {
				return true
			}
		}
	}

	return false
}

/**
 * Check if schema contains Date/Time data
 */
function hasDateTimeData(properties: any): boolean {
	// Look for date/time-related properties
	const dateTimeIndicators = [
		'timestamp',
		'date',
		'time',
		'datetime',
		'created_at',
		'updated_at',
		'scheduled_at',
	]

	for (const key in properties) {
		const lowerKey = key.toLowerCase()
		if (
			dateTimeIndicators.some(indicator => lowerKey.includes(indicator))
		) {
			return true
		}

		// Check if property has date-time format
		const prop = properties[key]
		if (prop && prop.format === 'date-time') {
			return true
		}

		// Check nested objects
		if (prop && typeof prop === 'object' && prop.type === 'object') {
			if (hasDateTimeData(prop.properties || {})) {
				return true
			}
		}
	}

	return false
}

/**
 * Check if schema contains Device data
 */
function hasDeviceData(properties: any): boolean {
	// Look for device-related properties
	const deviceIndicators = [
		'device',
		'device_id',
		'deviceId',
		'hostname',
		'mac_address',
		'ip',
		'status',
	]

	for (const key in properties) {
		const lowerKey = key.toLowerCase()
		if (deviceIndicators.some(indicator => lowerKey.includes(indicator))) {
			return true
		}

		// Check nested objects
		const prop = properties[key]
		if (prop && typeof prop === 'object' && prop.type === 'object') {
			if (hasDeviceData(prop.properties || {})) {
				return true
			}
		}
	}

	return false
}

/**
 * Check if schema contains Command data
 */
function hasCommandData(properties: any): boolean {
	// Look for command-related properties
	const commandIndicators = [
		'command',
		'command_id',
		'commandId',
		'cmd',
		'action',
		'parameters',
	]

	for (const key in properties) {
		const lowerKey = key.toLowerCase()
		if (commandIndicators.some(indicator => lowerKey.includes(indicator))) {
			return true
		}

		// Check nested objects
		const prop = properties[key]
		if (prop && typeof prop === 'object' && prop.type === 'object') {
			if (hasCommandData(prop.properties || {})) {
				return true
			}
		}
	}

	return false
}

/**
 * Get detailed information about data types in a schema
 */
export function getDataTypeInfo(schema: any): DataTypeInfo {
	const types = extractDataTypes(schema)
	const properties = schema.properties || {}

	return {
		types,
		properties,
	}
}
