/**
 * Filter response data based on allowed fields
 * This service filters JSON objects/arrays to only include allowed fields
 */

type AllowedFields = Record<string, string[]> | null | undefined

/**
 * Filter a single object based on allowed fields
 */
function filterObject(
	obj: any,
	allowedFields: string[] | null | undefined
): any {
	if (!allowedFields || allowedFields.length === 0) {
		return {}
	}

	if (Array.isArray(allowedFields) && allowedFields.length === 0) {
		return {}
	}

	const filtered: any = {}

	for (const field of allowedFields) {
		// Handle nested fields (e.g., "device.device_id")
		if (field.includes('.')) {
			const parts = field.split('.')
			let current = obj
			let target = filtered

			// Navigate to the nested field
			for (let i = 0; i < parts.length - 1; i++) {
				if (current && typeof current === 'object' && current[parts[i]]) {
					if (!target[parts[i]]) {
						target[parts[i]] = {}
					}
					target = target[parts[i]]
					current = current[parts[i]]
				} else {
					// Field path doesn't exist, skip
					break
				}
			}

			// Set the final field value
			const finalField = parts[parts.length - 1]
			if (current && typeof current === 'object' && current[finalField] !== undefined) {
				target[finalField] = current[finalField]
			}
		} else {
			// Simple field access
			if (obj && typeof obj === 'object' && obj[field] !== undefined) {
				filtered[field] = obj[field]
			}
		}
	}

	return filtered
}

/**
 * Filter response data based on resource type and allowed fields
 */
export function filterResponse(
	data: any,
	resourceType: string,
	allowedFields: AllowedFields
): any {
	if (!allowedFields) {
		// No field restrictions, return data as-is
		return data
	}

	// Get allowed fields for this resource type
	const fieldsForResource = allowedFields[resourceType]

	if (!fieldsForResource || fieldsForResource.length === 0) {
		// No fields allowed for this resource, return empty structure
		if (Array.isArray(data)) {
			return []
		}
		return {}
	}

	// Handle arrays
	if (Array.isArray(data)) {
		return data.map(item => filterObject(item, fieldsForResource))
	}

	// Handle single objects
	if (data && typeof data === 'object') {
		return filterObject(data, fieldsForResource)
	}

	// Primitive values pass through
	return data
}

/**
 * Filter response for multiple resource types (when response contains mixed resources)
 */
export function filterMultiResourceResponse(
	data: any,
	allowedFields: AllowedFields
): any {
	if (!allowedFields) {
		return data
	}

	// Try to detect resource type from data structure
	// This is a simple heuristic - may need refinement based on actual API responses
	if (Array.isArray(data) && data.length > 0) {
		// Try to infer resource type from first item
		const firstItem = data[0]
		if (firstItem && typeof firstItem === 'object') {
			// Check common resource indicators
			if ('device_id' in firstItem) {
				return filterResponse(data, 'devices', allowedFields)
			}
			if ('email' in firstItem && 'supabase_user_id' in firstItem) {
				return filterResponse(data, 'users', allowedFields)
			}
			if ('command' in firstItem && 'device_id' in firstItem) {
				return filterResponse(data, 'commands', allowedFields)
			}
		}
	} else if (data && typeof data === 'object') {
		// Single object - try to detect type
		if ('device_id' in data) {
			return filterResponse(data, 'devices', allowedFields)
		}
		if ('email' in data && 'supabase_user_id' in data) {
			return filterResponse(data, 'users', allowedFields)
		}
		if ('command' in data && 'device_id' in data) {
			return filterResponse(data, 'commands', allowedFields)
		}
	}

	// If we can't determine resource type, return data as-is
	return data
}

