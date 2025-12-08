/**
 * Schema Validation Utilities
 *
 * Validates JSON Schemas and checks if trigger outputs satisfy event inputs.
 * Matches backend validation logic in WiringService.validateConnection()
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate that a trigger's output schema satisfies an event's input schema
 * Returns true if the trigger can provide all required data for the event
 */
export function validateConnection(trigger: any, event: any): ValidationResult {
  if (!trigger || !event) {
    return { valid: false, error: 'Trigger or event not found' };
  }

  if (!trigger.output_schema || !event.input_schema) {
    return { valid: false, error: 'Trigger or event schema not found' };
  }

  const triggerOutput = trigger.output_schema;
  const eventInput = event.input_schema;

  // Both must be object types
  if (triggerOutput.type !== 'object' || eventInput.type !== 'object') {
    return { valid: false, error: 'Schemas must be object types' };
  }

  // Check that trigger output provides all required event inputs
  if (eventInput.required && Array.isArray(eventInput.required)) {
    const triggerProperties = triggerOutput.properties || {};
    const eventRequired = eventInput.required;

    for (const requiredProp of eventRequired) {
      // Check if trigger output has this property
      if (!(requiredProp in triggerProperties)) {
        // Check if it's a nested property (e.g., device.name)
        const hasNested = hasNestedProperty(triggerProperties, requiredProp);
        if (!hasNested) {
          return {
            valid: false,
            error: `Trigger output does not provide required property: ${requiredProp}`,
          };
        }
      }
    }
  }

  return { valid: true };
}

/**
 * Check if a nested property exists in the schema
 * Handles cases like "device.name" where device is an object
 */
function hasNestedProperty(properties: any, path: string): boolean {
  const parts = path.split('.');
  let current = properties;

  for (const part of parts) {
    if (!current || typeof current !== 'object') {
      return false;
    }
    if (part in current) {
      current = current[part];
    } else {
      // Check if any property is an object that might contain this
      for (const key in current) {
        const prop = current[key];
        if (prop && typeof prop === 'object' && prop.type === 'object') {
          // This is an object type, it might contain the nested property
          return true; // Optimistic - assume object types can contain anything
        }
      }
      return false;
    }
  }

  return true;
}

/**
 * Get a user-friendly description of a schema property
 */
export function getPropertyDescription(property: any, propertyName: string): string {
  if (property.description) {
    return property.description;
  }

  const type = property.type || 'any';
  const format = property.format || '';

  if (format) {
    return `${type} (${format})`;
  }

  return type;
}

/**
 * Format schema for display
 */
export function formatSchema(schema: any): string {
  if (!schema || !schema.properties) {
    return 'No schema defined';
  }

  const properties = Object.keys(schema.properties);
  if (properties.length === 0) {
    return 'No properties';
  }

  return properties.join(', ');
}

