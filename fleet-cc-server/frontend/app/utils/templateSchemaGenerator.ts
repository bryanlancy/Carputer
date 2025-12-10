/**
 * Generate JSON Schema from message template
 * Analyzes template variables like {{device.status}} and generates appropriate schema
 */

export function generateSchemaFromTemplate(template: string): any {
	if (!template || typeof template !== 'string') {
		return null
	}

	// Extract all variables from template (e.g., {{device.status}}, {{user.email}})
	const variableRegex = /\{\{([^}]+)\}\}/g
	const variables = new Set<string>()
	let match

	while ((match = variableRegex.exec(template)) !== null) {
		variables.add(match[1].trim())
	}

	if (variables.size === 0) {
		return null
	}

	// Build schema properties based on variables
	const properties: Record<string, any> = {}
	const required: string[] = []

	// Group variables by prefix (device, user, command, etc.)
	const deviceVars: string[] = []
	const userVars: string[] = []
	const commandVars: string[] = []
	const dateTimeVars: string[] = []
	const otherVars: string[] = []

	variables.forEach(variable => {
		const parts = variable.split('.')
		const prefix = parts[0].toLowerCase()

		if (prefix === 'device') {
			deviceVars.push(variable)
		} else if (prefix === 'user') {
			userVars.push(variable)
		} else if (prefix === 'command' || prefix === 'cmd') {
			commandVars.push(variable)
		} else if (
			prefix === 'timestamp' ||
			prefix === 'date' ||
			prefix === 'time' ||
			prefix === 'datetime'
		) {
			dateTimeVars.push(variable)
		} else {
			otherVars.push(variable)
		}
	})

	// Add device object if device variables exist
	if (deviceVars.length > 0) {
		properties.device = {
			type: 'object',
			properties: {},
		}
		required.push('device')

		deviceVars.forEach(variable => {
			const parts = variable.split('.')
			if (parts.length > 1) {
				const propName = parts.slice(1).join('.')
				properties.device.properties[propName] = {
					type: 'string',
				}
			}
		})
	}

	// Add user object if user variables exist
	if (userVars.length > 0) {
		properties.user = {
			type: 'object',
			properties: {},
		}
		required.push('user')

		userVars.forEach(variable => {
			const parts = variable.split('.')
			if (parts.length > 1) {
				const propName = parts.slice(1).join('.')
				properties.user.properties[propName] = {
					type: 'string',
				}
			}
		})
	}

	// Add command object if command variables exist
	if (commandVars.length > 0) {
		properties.command = {
			type: 'object',
			properties: {},
		}
		required.push('command')

		commandVars.forEach(variable => {
			const parts = variable.split('.')
			if (parts.length > 1) {
				const propName = parts.slice(1).join('.')
				properties.command.properties[propName] = {
					type: 'string',
				}
			}
		})
	}

	// Add date/time properties
	if (dateTimeVars.length > 0) {
		dateTimeVars.forEach(variable => {
			properties[variable] = {
				type: 'string',
				format: variable.includes('time') ? 'date-time' : 'date',
			}
			required.push(variable)
		})
	}

	// Add other variables as string properties
	otherVars.forEach(variable => {
		properties[variable] = {
			type: 'string',
		}
		required.push(variable)
	})

	return {
		type: 'object',
		properties,
		required,
	}
}

