import { format, parseISO } from 'date-fns';

/**
 * Template Service
 *
 * Handles variable replacement in notification message templates.
 * Supports simple {{variable}} syntax with nested object access.
 *
 * Examples:
 * - {{device.name}} - Access nested property
 * - {{timestamp}} - Simple variable
 * - {{timestamp|format:YYYY-MM-DD}} - Date formatting (future enhancement)
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
      return '';
    }

    // Match {{variable}} or {{variable|format:...}} patterns
    const pattern = /\{\{([^}]+)\}\}/g;

    return template.replace(pattern, (match, expression) => {
      try {
        // Handle format pipes (e.g., {{timestamp|format:YYYY-MM-DD}})
        if (expression.includes('|')) {
          const [variablePath, ...pipeParts] = expression.split('|').map(s => s.trim());
          const value = this.getNestedValue(data, variablePath);

          // Process pipes
          let result = value;
          for (const pipe of pipeParts) {
            if (pipe.startsWith('format:')) {
              const formatString = pipe.substring(7).trim();
              result = this.formatValue(result, formatString);
            }
          }

          return this.valueToString(result);
        }

        // Simple variable access
        const value = this.getNestedValue(data, expression.trim());
        return this.valueToString(value);
      } catch (error) {
        console.warn(`Template variable replacement error for ${expression}:`, error);
        return match; // Return original if replacement fails
      }
    });
  }

  /**
   * Get nested value from object using dot notation (e.g., "device.name")
   */
  private static getNestedValue(obj: any, path: string): any {
    if (!obj || !path) {
      return undefined;
    }

    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Format a value based on format string
   */
  private static formatValue(value: any, formatString: string): string {
    if (value === null || value === undefined) {
      return '';
    }

    // Date formatting
    if (formatString && (value instanceof Date || typeof value === 'string')) {
      try {
        const date = value instanceof Date ? value : parseISO(value);
        return format(date, formatString);
      } catch (error) {
        // If date parsing fails, return as string
        return String(value);
      }
    }

    return String(value);
  }

  /**
   * Convert value to string representation
   */
  private static valueToString(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object') {
      // For objects, try to get a meaningful string representation
      if (value instanceof Date) {
        return value.toISOString();
      }

      // If object has a name or title property, use that
      if (value.name) {
        return String(value.name);
      }
      if (value.title) {
        return String(value.title);
      }
      if (value.id) {
        return String(value.id);
      }

      // Otherwise, stringify the object
      return JSON.stringify(value);
    }

    return String(value);
  }

  /**
   * Extract all variable names from a template
   * Useful for validation and showing available variables
   */
  static extractVariables(template: string): string[] {
    if (!template) {
      return [];
    }

    const pattern = /\{\{([^}]+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = pattern.exec(template)) !== null) {
      const expression = match[1].trim();
      // Remove pipe operations to get just the variable path
      const variablePath = expression.split('|')[0].trim();
      if (variablePath && !variables.includes(variablePath)) {
        variables.push(variablePath);
      }
    }

    return variables;
  }

  /**
   * Validate that all required variables are present in the data
   */
  static validateTemplate(template: string, data: Record<string, any>): {
    valid: boolean;
    missing: string[];
  } {
    const variables = this.extractVariables(template);
    const missing: string[] = [];

    for (const variable of variables) {
      const value = this.getNestedValue(data, variable);
      if (value === undefined || value === null) {
        missing.push(variable);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }
}

