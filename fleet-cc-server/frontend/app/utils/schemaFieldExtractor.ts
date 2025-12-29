/**
 * Schema Field Extractor
 *
 * Extracts all accessible fields from a JSON schema, including nested fields.
 * Returns fields with their paths, types, and display labels.
 */

export interface SchemaField {
	path: string // Dot-notation path, e.g., "device.deviceId", "timestamp"
	label: string // Human-readable label, e.g., "Device ID", "Timestamp"
	type: 'string' | 'number' | 'boolean' | 'date-time' | 'object' | 'array' | 'unknown'
	format?: string // Additional format info (e.g., "date-time")
}

/**
 * Normalize field path to avoid duplicates (e.g., deviceId and device_id)
 */
function normalizeFieldPath(path: string): string {
	// Convert camelCase to snake_case for normalization
	return path
		.replace(/([a-z])([A-Z])/g, '$1_$2')
		.toLowerCase()
}

/**
 * Extract all accessible fields from a JSON schema
 * Handles nested object properties and generates dot-notation paths
 */
export function extractSchemaFields(schema: any): SchemaField[] {
	if (!schema || typeof schema !== 'object') {
		return []
	}

	const fields: SchemaField[] = []
	const fieldsByNormalizedPath = new Map<string, SchemaField>()
	const properties = schema.properties || {}

	// Recursively extract fields from properties
	function extractFields(
		props: Record<string, any>,
		prefix: string = '',
		depth: number = 0
	) {
		// Limit nesting depth to avoid infinite recursion
		if (depth > 10) {
			return
		}

		for (const [key, prop] of Object.entries(props)) {
			if (!prop || typeof prop !== 'object') {
				continue
			}

			const fieldPath = prefix ? `${prefix}.${key}` : key
			const fieldType = determineFieldType(prop)

			// If it's an object type with nested properties, recursively extract them
			if (fieldType === 'object' && prop.properties) {
				// Recursively extract nested properties
				extractFields(prop.properties, fieldPath, depth + 1)
			} else if (fieldType === 'object' && !prop.properties) {
				// Object type without explicit properties in schema
				// For well-known object types, add common properties
				const inferredProperties = inferObjectProperties(key, fieldPath, depth)
				if (inferredProperties && Object.keys(inferredProperties).length > 0) {
					extractFields(inferredProperties, fieldPath, depth + 1)
				}
				// Don't add the object itself as a field - only its properties
			} else {
				// Add this field (leaf field with a primitive type)
				const normalizedPath = normalizeFieldPath(fieldPath)

				// Check if we already have this field (avoid duplicates like deviceId vs device_id)
				if (!fieldsByNormalizedPath.has(normalizedPath)) {
					const field: SchemaField = {
						path: fieldPath,
						label: formatFieldLabel(key, prefix),
						type: fieldType,
						format: prop.format,
					}
					fields.push(field)
					fieldsByNormalizedPath.set(normalizedPath, field)
				}
			}
		}
	}

	extractFields(properties)

	return fields
}

/**
 * Infer common properties for well-known object types that don't have explicit schema definitions
 */
function inferObjectProperties(key: string, fieldPath: string, depth: number): Record<string, any> | null {
	// Limit depth to avoid infinite recursion
	if (depth > 5) {
		return null
	}

	const lowerKey = key.toLowerCase()

	// Common device object properties
	// Use snake_case as primary, avoid duplicates
	if (lowerKey === 'device') {
		return {
			id: { type: 'number' },
			device_id: { type: 'string' },
			hostname: { type: 'string' },
			mac_address: { type: 'string' },
			uptime: { type: 'number' },
			status: { type: 'string' },
			current_ip: { type: 'string' },
			vin: { type: 'string' },
			hardware_rev: { type: 'string' },
			build_id: { type: 'string' },
			current_version: { type: 'string' },
			current_build_id: { type: 'string' },
			last_seen: { type: 'string', format: 'date-time' },
		}
	}

	// Common command object properties
	if (lowerKey === 'command') {
		return {
			id: { type: 'number' },
			command: { type: 'string' },
			command_id: { type: 'number' },
			commandId: { type: 'number' },
			status: { type: 'string' },
			parameters: { type: 'object' },
			result: { type: 'object' },
			error: { type: 'string' },
			created_at: { type: 'string', format: 'date-time' },
			createdAt: { type: 'string', format: 'date-time' },
		}
	}

	// Common user object properties
	if (lowerKey === 'user') {
		return {
			id: { type: 'number' },
			user_id: { type: 'number' },
			userId: { type: 'number' },
			username: { type: 'string' },
			email: { type: 'string' },
			name: { type: 'string' },
		}
	}

	return null
}

/**
 * Determine the field type from a schema property definition
 */
function determineFieldType(prop: any): SchemaField['type'] {
	if (!prop || typeof prop !== 'object') {
		return 'unknown'
	}

	// Check for explicit type
	const type = prop.type

	// Check for format that indicates date-time
	if (prop.format === 'date-time' || prop.format === 'date' || prop.format === 'time') {
		return 'date-time'
	}

	// Map JSON schema types to our types
	switch (type) {
		case 'string':
			return 'string'
		case 'number':
		case 'integer':
			return 'number'
		case 'boolean':
			return 'boolean'
		case 'object':
			return 'object'
		case 'array':
			return 'array'
		default:
			return 'unknown'
	}
}

/**
 * Format a field label for display
 * Converts camelCase/PascalCase to readable format
 * e.g., "deviceId" -> "Device ID", "device.uptime" -> "Device > Uptime"
 */
function formatFieldLabel(key: string, prefix: string = ''): string {
	// Convert camelCase to Title Case with spaces
	const formattedKey = key
		.replace(/([A-Z])/g, ' $1') // Insert space before capital letters
		.replace(/^./, str => str.toUpperCase()) // Capitalize first letter
		.trim()

	if (prefix) {
		// Split prefix and format each part
		const prefixParts = prefix.split('.').map(part =>
			part
				.replace(/([A-Z])/g, ' $1')
				.replace(/^./, str => str.toUpperCase())
				.trim()
		)
		return `${prefixParts.join(' > ')} > ${formattedKey}`
	}

	return formattedKey
}

/**
 * Check if a field is a timestamp/date-time field
 */
function isTimestampField(field: SchemaField): boolean {
	return field.type === 'date-time' || field.format === 'date-time' ||
		   field.format === 'date' || field.format === 'time' ||
		   field.path.toLowerCase().includes('timestamp') ||
		   field.path.toLowerCase().includes('date') ||
		   field.path.toLowerCase().includes('time')
}

/**
 * Group fields by their parent (top-level field)
 * Special handling for timestamp subfields - they get their own group
 * Returns a map where keys are parent field names and values are arrays of child fields
 */
export function groupFieldsByParent(
	fields: SchemaField[]
): Map<string, SchemaField[]> {
	const groups = new Map<string, SchemaField[]>()
	const timestampSubfieldKeys = new Set<string>() // Track unique timestamp subfield keys to avoid duplicates

	for (const field of fields) {
		// Check if this is a timestamp subfield (e.g., timestamp.year, timestamp.month)
		const pathParts = field.path.split('.')
		if (pathParts.length > 1) {
			const lastPart = pathParts[pathParts.length - 1]
			const timestampSubfields = ['year', 'month', 'day', 'hour', 'minute', 'second', 'dayOfWeek', 'dayOfYear', 'week', 'quarter']

			if (timestampSubfields.includes(lastPart)) {
				// It's a timestamp subfield - group under "Timestamp"
				// Deduplicate by subfield key (e.g., 'year', 'month') - only keep the first one
				if (!timestampSubfieldKeys.has(lastPart)) {
					timestampSubfieldKeys.add(lastPart)
					const timestampGroup = groups.get('Timestamp') || []
					timestampGroup.push(field)
					groups.set('Timestamp', timestampGroup)
				}
				continue
			}
		}

		// Regular field grouping
		const parent = pathParts.length > 1 ? pathParts[0] : 'Root'
		const fieldsForParent = groups.get(parent) || []
		fieldsForParent.push(field)
		groups.set(parent, fieldsForParent)
	}

	return groups
}

/**
 * Format parent name for display
 */
export function formatParentName(parent: string): string {
	if (parent === 'Root') {
		return 'Root Fields'
	}
	return parent
		.replace(/([A-Z])/g, ' $1')
		.replace(/^./, str => str.toUpperCase())
		.trim()
}

/**
 * Get the type of a field by its path
 */
export function getFieldType(schema: any, fieldPath: string): SchemaField['type'] | null {
	if (!schema || !fieldPath) {
		return null
	}

	const properties = schema.properties || {}
	const pathParts = fieldPath.split('.')

	let current: any = properties

	for (let i = 0; i < pathParts.length; i++) {
		const part = pathParts[i]
		if (!current[part]) {
			return null
		}

		if (i === pathParts.length - 1) {
			// Last part, return its type
			return determineFieldType(current[part])
		}

		// Navigate deeper
		if (current[part].properties) {
			current = current[part].properties
		} else {
			return null
		}
	}

	return null
}

