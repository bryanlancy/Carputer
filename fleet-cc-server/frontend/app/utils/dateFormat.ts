import { format } from 'date-fns'

/**
 * Normalize format string tokens to date-fns format
 * Converts common uppercase tokens to date-fns lowercase equivalents
 */
export function normalizeFormatTokens(formatString: string): string {
  // Map of common uppercase tokens to date-fns tokens
  const tokenMap: Record<string, string> = {
    'DD': 'dd',   // Day of month (01-31)
    'YY': 'yy',   // 2-digit year
    'YYYY': 'yyyy', // 4-digit year
    'MM': 'MM',   // Month (01-12) - already correct
    'HH': 'HH',   // 24-hour format - already correct
    'mm': 'mm',   // Minutes - already correct
    'ss': 'ss',   // Seconds - already correct
  }

  let normalized = formatString

  // Replace tokens in order (longest first to avoid partial matches)
  const sortedTokens = Object.keys(tokenMap).sort((a, b) => b.length - a.length)

  for (const token of sortedTokens) {
    const regex = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
    normalized = normalized.replace(regex, tokenMap[token])
  }

  return normalized
}

/**
 * Format a date value with custom text support
 * Parses the format string to extract known date-fns tokens and preserves quoted text
 * Unknown characters (not in quotes) result in "Bad format"
 */
export function formatDateWithCustomText(date: Date, formatString: string): string {
  // Known date-fns tokens (in order of length to match longest first)
  const knownTokens = [
    'yyyy', 'MMMM', 'MMM', 'MM', 'dd', 'HH', 'mm', 'ss', 'EEEE', 'EEE',
    'yy', 'd', 'H', 'h', 'a', 'A', 'p', 'P', 'O', 'z', 'X', 'x'
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
      const quotedText = formatString.substring(position + 1, endQuote)
      result += quotedText
      position = endQuote + 1
      continue
    }

    // Skip whitespace and common separators (colon, dash, slash, etc.)
    const char = formatString[position]
    if (/\s/.test(char) || char === ':' || char === '/' || char === '-' || char === '.' || char === ',') {
      result += char
      position++
      continue
    }

    let matched = false

    // Try to match known tokens at current position
    for (const token of sortedTokens) {
      if (position + token.length <= formatString.length &&
          formatString.substring(position, position + token.length) === token) {
        // Found a known token, add formatted value
        try {
          const formatted = format(date, token)
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
      return 'Bad format'
    }
  }

  return result
}

/**
 * Format a date value, handling custom text and token normalization
 */
export function formatDate(value: any, formatString: string): string {
  if (!formatString) {
    return String(value)
  }

  try {
    let date: Date

    if (value instanceof Date) {
      date = value
    } else if (typeof value === 'string') {
      date = new Date(value)
    } else if (typeof value === 'number') {
      // Handle Unix timestamps (seconds or milliseconds)
      date = new Date(value > 1000000000000 ? value : value * 1000)
    } else {
      date = new Date(value)
    }

    // Check if date is valid
    if (!isNaN(date.getTime())) {
      // Normalize format tokens first (DD -> dd, YY -> yy, etc.)
      const normalizedFormat = normalizeFormatTokens(formatString)
      // Use custom formatter that preserves unknown text
      return formatDateWithCustomText(date, normalizedFormat)
    }
  } catch (error) {
    // If date parsing/formatting fails, return as string
    return String(value)
  }

  return String(value)
}

