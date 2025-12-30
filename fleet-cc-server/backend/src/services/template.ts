import { format, parseISO } from 'date-fns'

/**
 * Template Service
 *
 * Handles variable replacement in notification message templates.
 * Supports simple {{variable}} syntax with nested object access.
 *
 * Examples:
 * - {{device.name}} - Access nested property
 * - {{timestamp}} - Simple variable
 * - {{timestamp|"Hello" dd yy HH:mm:ss}} - Date formatting with custom text
 */

export class TemplateService {
	/**
	 * Render a template string by replacing {{variable}} placeholders with actual values
	 *
	 * @param template - Template string with {{variable}} placeholders
	 * @param data - Data object containing values to replace
	 * @returns Rendered string with variables replaced
	 */
	static render(template: string, data: Record<string, any>): string {
		if (!template) {
			return ''
		}

		// Match {{variable}} or {{variable|format:...}} patterns
		const pattern = /\{\{([^}]+)\}\}/g

		return template.replace(pattern, (match, expression) => {
			try {
				// Handle format pipes (e.g., {{timestamp|"Hello" dd yy HH:mm:ss}})
				if (expression.includes('|')) {
					// Split on | but preserve quoted strings
					const parts: string[] = []
					let currentPart = ''
					let inQuotes = false

					for (let i = 0; i < expression.length; i++) {
						const char = expression[i]
						if (char === '"') {
							inQuotes = !inQuotes
							currentPart += char
						} else if (char === '|' && !inQuotes) {
							// Only split on | if not inside quotes
							if (currentPart.trim()) {
								parts.push(currentPart.trim())
							}
							currentPart = ''
						} else {
							currentPart += char
						}
					}

					// Add the last part
					if (currentPart.trim()) {
						parts.push(currentPart.trim())
					}

					if (parts.length === 0) {
						return match // No parts, return original
					}

					const variablePath = parts[0]
					const value = this.getNestedValue(data, variablePath)

					// Process pipes - everything after the first | is the format string
					let result = value
					if (parts.length > 1) {
						// Join all pipe parts after the first one (preserving quotes)
						const formatString = parts.slice(1).join('|').trim()
						result = this.formatValue(value, formatString)
					}

					return this.valueToString(result)
				}

				// Simple variable access
				const value = this.getNestedValue(data, expression.trim())
				return this.valueToString(value)
			} catch (error) {
				console.warn(
					`Template variable replacement error for ${expression}:`,
					error
				)
				return match // Return original if replacement fails
			}
		})
	}

	/**
	 * Get nested value from object using dot notation (e.g., "device.name")
	 */
	private static getNestedValue(obj: any, path: string): any {
		if (!obj || !path) {
			return undefined
		}

		const parts = path.split('.')
		let current = obj

		for (const part of parts) {
			if (current === null || current === undefined) {
				return undefined
			}
			current = current[part]
		}

		return current
	}

	/**
	 * Normalize format string tokens to date-fns format
	 * Converts common uppercase tokens to date-fns lowercase equivalents
	 */
	private static normalizeFormatTokens(formatString: string): string {
		// Map of common uppercase tokens to date-fns tokens
		const tokenMap: Record<string, string> = {
			DD: 'dd', // Day of month (01-31)
			YY: 'yy', // 2-digit year
			YYYY: 'yyyy', // 4-digit year
			MM: 'MM', // Month (01-12) - already correct
			HH: 'HH', // 24-hour format - already correct
			mm: 'mm', // Minutes - already correct
			ss: 'ss', // Seconds - already correct
		}

		let normalized = formatString

		// Replace tokens in order (longest first to avoid partial matches)
		const sortedTokens = Object.keys(tokenMap).sort(
			(a, b) => b.length - a.length
		)

		for (const token of sortedTokens) {
			const regex = new RegExp(
				token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
				'g'
			)
			normalized = normalized.replace(regex, tokenMap[token])
		}

		return normalized
	}

	/**
	 * Format a date value with custom text support
	 * Parses the format string to extract known date-fns tokens and preserves quoted text
	 * Unknown characters (not in quotes) result in "Bad format"
	 */
	private static formatDateWithCustomText(
		date: Date,
		formatString: string
	): string {
		// Known date-fns tokens (in order of length to match longest first)
		const knownTokens = [
			'yyyy',
			'MMMM',
			'MMM',
			'MM',
			'dd',
			'HH',
			'mm',
			'ss',
			'EEEE',
			'EEE',
			'yy',
			'd',
			'H',
			'h',
			'a',
			'A',
			'p',
			'P',
			'O',
			'z',
			'X',
			'x',
		]

		// Sort by length descending to match longest tokens first
		const sortedTokens = knownTokens.sort((a, b) => b.length - a.length)

		let result = ''
		let position = 0

		// Build result string by processing format string character by character
		while (position < formatString.length) {
			// Check for quoted string
			if (formatString[position] === '"') {
				// Find the closing quote
				const endQuote = formatString.indexOf('"', position + 1)
				if (endQuote === -1) {
					// Unclosed quote, return error
					return 'Bad format'
				}
				// Extract quoted text (without quotes)
				const quotedText = formatString.substring(
					position + 1,
					endQuote
				)
				result += quotedText
				position = endQuote + 1
				continue
			}

			// Skip whitespace and common separators (colon, dash, slash, etc.)
			const char = formatString[position]
			if (
				/\s/.test(char) ||
				char === ':' ||
				char === '/' ||
				char === '-' ||
				char === '.' ||
				char === ','
			) {
				result += char
				position++
				continue
			}

			let matched = false

			// Try to match known tokens at current position
			for (const token of sortedTokens) {
				if (
					position + token.length <= formatString.length &&
					formatString.substring(
						position,
						position + token.length
					) === token
				) {
					// Found a known token, add formatted value
					try {
						// Format in UTC by creating a new Date object with UTC components
						// This ensures timestamps in messages are in UTC and can be converted to local time on frontend
						const utcDate = new Date(
							Date.UTC(
								date.getUTCFullYear(),
								date.getUTCMonth(),
								date.getUTCDate(),
								date.getUTCHours(),
								date.getUTCMinutes(),
								date.getUTCSeconds(),
								date.getUTCMilliseconds()
							)
						)
						const formatted = format(utcDate, token)
						result += formatted
						position += token.length
						matched = true
						break
					} catch (error) {
						// If formatting fails, return error
						return 'Bad format'
					}
				}
			}

			if (!matched) {
				// Unknown character (not in quotes, not whitespace/separator, not a known token)
				// Log warning but continue processing - skip the unknown character to avoid breaking the format
				console.warn(
					`Unknown format character at position ${position}: "${char}" in format string: "${formatString}"`
				)
				// Skip unknown characters to avoid breaking the format
				position++
				continue
			}
		}

		return result
	}

	/**
	 * Format a value based on format string
	 */
	private static formatValue(value: any, formatString: string): string {
		if (value === null || value === undefined) {
			return ''
		}

		// Date formatting - try to parse as date if format string is provided
		if (formatString) {
			try {
				let date: Date

				if (value instanceof Date) {
					date = value
				} else if (typeof value === 'string') {
					// Try ISO format first, then try parsing as regular date string
					try {
						date = parseISO(value)
					} catch {
						date = new Date(value)
					}
				} else if (typeof value === 'number') {
					// Handle Unix timestamps (seconds or milliseconds)
					date = new Date(
						value > 1000000000000 ? value : value * 1000
					)
				} else {
					// Try to convert to date
					date = new Date(value)
				}

				// Check if date is valid
				if (!isNaN(date.getTime())) {
					// Normalize format tokens first (DD -> dd, YY -> yy, etc.)
					const normalizedFormat =
						this.normalizeFormatTokens(formatString)
					// Use custom formatter that preserves unknown text
					return this.formatDateWithCustomText(date, normalizedFormat)
				}
			} catch (error) {
				// If date parsing/formatting fails, return as string
				return String(value)
			}
		}

		return String(value)
	}

	/**
	 * Convert value to string representation
	 */
	private static valueToString(value: any): string {
		if (value === null || value === undefined) {
			return ''
		}

		if (typeof value === 'object') {
			// For objects, try to get a meaningful string representation
			if (value instanceof Date) {
				return value.toISOString()
			}

			// If object has a name or title property, use that
			if (value.name) {
				return String(value.name)
			}
			if (value.title) {
				return String(value.title)
			}
			if (value.id) {
				return String(value.id)
			}

			// Otherwise, stringify the object
			return JSON.stringify(value)
		}

		return String(value)
	}

	/**
	 * Extract all variable names from a template
	 * Useful for validation and showing available variables
	 */
	static extractVariables(template: string): string[] {
		if (!template) {
			return []
		}

		const pattern = /\{\{([^}]+)\}\}/g
		const variables: string[] = []
		let match

		while ((match = pattern.exec(template)) !== null) {
			const expression = match[1].trim()
			// Remove pipe operations to get just the variable path
			const variablePath = expression.split('|')[0].trim()
			if (variablePath && !variables.includes(variablePath)) {
				variables.push(variablePath)
			}
		}

		return variables
	}

	/**
	 * Validate that all required variables are present in the data
	 */
	static validateTemplate(
		template: string,
		data: Record<string, any>
	): {
		valid: boolean
		missing: string[]
	} {
		const variables = this.extractVariables(template)
		const missing: string[] = []

		for (const variable of variables) {
			const value = this.getNestedValue(data, variable)
			if (value === undefined || value === null) {
				missing.push(variable)
			}
		}

		return {
			valid: missing.length === 0,
			missing,
		}
	}
}
