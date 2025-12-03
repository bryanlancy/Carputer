import { PrismaClient } from '@prisma/client';

/**
 * Trigger Service
 *
 * Manages trigger types and their output schemas.
 * Triggers emit data when events occur (device online, command completed, etc.)
 */

export interface TriggerOutput {
  [key: string]: any;
}

export class TriggerService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get all triggers
   */
  async getAllTriggers(options: {
    enabled?: boolean;
  } = {}): Promise<any[]> {
    const where: any = {};
    if (options.enabled !== undefined) {
      where.enabled = options.enabled;
    }

    return this.prisma.trigger.findMany({
      where,
      orderBy: { trigger_name: 'asc' },
    });
  }

  /**
   * Get trigger by code
   */
  async getTriggerByCode(triggerCode: string): Promise<any | null> {
    return this.prisma.trigger.findUnique({
      where: { trigger_code: triggerCode },
    });
  }

  /**
   * Get trigger by ID
   */
  async getTriggerById(triggerId: number): Promise<any | null> {
    return this.prisma.trigger.findUnique({
      where: { id: triggerId },
    });
  }

  /**
   * Create a new trigger
   */
  async createTrigger(data: {
    trigger_code: string;
    trigger_name: string;
    description?: string;
    output_schema: any; // JSON Schema
    enabled?: boolean;
  }): Promise<any> {
    // Validate trigger_code is unique
    const existing = await this.prisma.trigger.findUnique({
      where: { trigger_code: data.trigger_code },
    });

    if (existing) {
      throw new Error(`Trigger with code ${data.trigger_code} already exists`);
    }

    return this.prisma.trigger.create({
      data: {
        trigger_code: data.trigger_code,
        trigger_name: data.trigger_name,
        description: data.description || null,
        output_schema: data.output_schema,
        enabled: data.enabled !== undefined ? data.enabled : true,
      },
    });
  }

  /**
   * Update trigger
   */
  async updateTrigger(
    triggerId: number,
    data: {
      trigger_name?: string;
      description?: string;
      output_schema?: any;
      enabled?: boolean;
    }
  ): Promise<any> {
    return this.prisma.trigger.update({
      where: { id: triggerId },
      data: {
        ...(data.trigger_name && { trigger_name: data.trigger_name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.output_schema && { output_schema: data.output_schema }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
      },
    });
  }

  /**
   * Delete trigger
   */
  async deleteTrigger(triggerId: number): Promise<void> {
    await this.prisma.trigger.delete({
      where: { id: triggerId },
    });
  }

  /**
   * Validate that trigger output matches its schema
   */
  validateTriggerOutput(trigger: any, output: TriggerOutput): boolean {
    // Basic validation - can be enhanced with full JSON Schema validation
    if (!trigger || !trigger.output_schema) {
      return false;
    }

    const schema = trigger.output_schema;
    if (schema.type !== 'object') {
      return false;
    }

    // Check required properties
    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in output)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get built-in trigger definitions
   * These are the default triggers that come with the system
   */
  static getBuiltInTriggers(): Array<{
    trigger_code: string;
    trigger_name: string;
    description: string;
    output_schema: any;
  }> {
    return [
      {
        trigger_code: 'device.online',
        trigger_name: 'Device Online',
        description: 'Triggered when a device comes online',
        output_schema: {
          type: 'object',
          properties: {
            device: { type: 'object' },
            timestamp: { type: 'string', format: 'date-time' },
          },
          required: ['device', 'timestamp'],
        },
      },
      {
        trigger_code: 'device.offline',
        trigger_name: 'Device Offline',
        description: 'Triggered when a device goes offline',
        output_schema: {
          type: 'object',
          properties: {
            device: { type: 'object' },
            timestamp: { type: 'string', format: 'date-time' },
          },
          required: ['device', 'timestamp'],
        },
      },
      {
        trigger_code: 'command.completed',
        trigger_name: 'Command Completed',
        description: 'Triggered when a command completes successfully',
        output_schema: {
          type: 'object',
          properties: {
            command: { type: 'object' },
            device: { type: 'object' },
            timestamp: { type: 'string', format: 'date-time' },
          },
          required: ['command', 'device', 'timestamp'],
        },
      },
      {
        trigger_code: 'command.failed',
        trigger_name: 'Command Failed',
        description: 'Triggered when a command fails',
        output_schema: {
          type: 'object',
          properties: {
            command: { type: 'object' },
            device: { type: 'object' },
            error: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
          required: ['command', 'device', 'error', 'timestamp'],
        },
      },
      {
        trigger_code: 'date_time',
        trigger_name: 'Date/Time',
        description: 'Triggered at a specific date/time',
        output_schema: {
          type: 'object',
          properties: {
            timestamp: { type: 'string', format: 'date-time' },
            date: { type: 'string' },
            time: { type: 'string' },
          },
          required: ['timestamp'],
        },
      },
    ];
  }
}

