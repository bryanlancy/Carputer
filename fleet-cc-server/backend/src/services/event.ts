import { PrismaClient } from '@prisma/client';

/**
 * Event Service
 *
 * Manages event types and their input schemas.
 * Events are actions that can be triggered (show notification, send email, etc.)
 */

export interface EventInput {
  [key: string]: any;
}

export class EventService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get all events
   */
  async getAllEvents(options: {
    enabled?: boolean;
    handler_type?: string;
  } = {}): Promise<any[]> {
    const where: any = {};
    if (options.enabled !== undefined) {
      where.enabled = options.enabled;
    }
    if (options.handler_type) {
      where.handler_type = options.handler_type;
    }

    return this.prisma.event.findMany({
      where,
      orderBy: { event_name: 'asc' },
    });
  }

  /**
   * Get event by code
   */
  async getEventByCode(eventCode: string): Promise<any | null> {
    return this.prisma.event.findUnique({
      where: { event_code: eventCode },
    });
  }

  /**
   * Get event by ID
   */
  async getEventById(eventId: number): Promise<any | null> {
    return this.prisma.event.findUnique({
      where: { id: eventId },
    });
  }

  /**
   * Create a new event
   */
  async createEvent(data: {
    event_code: string;
    event_name: string;
    description?: string;
    input_schema: any; // JSON Schema
    handler_type: string;
    enabled?: boolean;
  }): Promise<any> {
    // Validate event_code is unique
    const existing = await this.prisma.event.findUnique({
      where: { event_code: data.event_code },
    });

    if (existing) {
      throw new Error(`Event with code ${data.event_code} already exists`);
    }

    return this.prisma.event.create({
      data: {
        event_code: data.event_code,
        event_name: data.event_name,
        description: data.description || null,
        input_schema: data.input_schema,
        handler_type: data.handler_type,
        enabled: data.enabled !== undefined ? data.enabled : true,
      },
    });
  }

  /**
   * Update event
   */
  async updateEvent(
    eventId: number,
    data: {
      event_name?: string;
      description?: string;
      input_schema?: any;
      handler_type?: string;
      enabled?: boolean;
    }
  ): Promise<any> {
    return this.prisma.event.update({
      where: { id: eventId },
      data: {
        ...(data.event_name && { event_name: data.event_name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.input_schema && { input_schema: data.input_schema }),
        ...(data.handler_type && { handler_type: data.handler_type }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
      },
    });
  }

  /**
   * Delete event
   */
  async deleteEvent(eventId: number): Promise<void> {
    await this.prisma.event.delete({
      where: { id: eventId },
    });
  }

  /**
   * Validate that event input matches its schema
   */
  validateEventInput(event: any, input: EventInput): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!event || !event.input_schema) {
      return { valid: false, errors: ['Event or input schema not found'] };
    }

    const schema = event.input_schema;
    if (schema.type !== 'object') {
      return { valid: false, errors: ['Input schema must be an object type'] };
    }

    // Check required properties
    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in input)) {
          errors.push(`Missing required property: ${requiredProp}`);
        }
      }
    }

    // Basic type checking for properties
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        if (propName in input) {
          const propValue = input[propName];
          const propDef = propSchema as any;

          if (propDef.type === 'string' && typeof propValue !== 'string') {
            errors.push(`Property ${propName} must be a string`);
          } else if (propDef.type === 'object' && typeof propValue !== 'object') {
            errors.push(`Property ${propName} must be an object`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get built-in event definitions
   * These are the default events that come with the system
   */
  static getBuiltInEvents(): Array<{
    event_code: string;
    event_name: string;
    description: string;
    input_schema: any;
    handler_type: string;
  }> {
    return [
      {
        event_code: 'show_notification',
        event_name: 'Show Notification',
        description: 'Display a notification to users',
        input_schema: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            title: { type: 'string' },
            device: { type: 'object' },
          },
          required: ['message'],
        },
        handler_type: 'notification',
      },
      {
        event_code: 'send_email',
        event_name: 'Send Email',
        description: 'Send an email notification',
        input_schema: {
          type: 'object',
          properties: {
            to: { type: 'string' },
            subject: { type: 'string' },
            body: { type: 'string' },
          },
          required: ['to', 'subject', 'body'],
        },
        handler_type: 'email',
      },
      {
        event_code: 'execute_command',
        event_name: 'Execute Command',
        description: 'Execute a command on a device',
        input_schema: {
          type: 'object',
          properties: {
            device: { type: 'object' },
            command: { type: 'string' },
            parameters: { type: 'object' },
          },
          required: ['device', 'command'],
        },
        handler_type: 'command',
      },
    ];
  }
}

