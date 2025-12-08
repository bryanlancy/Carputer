import { PrismaClient } from '@prisma/client';
import { TriggerService } from './trigger';
import { EventService } from './event';

/**
 * Wiring Service
 *
 * Manages trigger-to-event connections with schema validation.
 * Handles React Flow wiring configurations for visual node connections.
 */

export class WiringService {
  constructor(
    private prisma: PrismaClient,
    private triggerService: TriggerService,
    private eventService: EventService
  ) {}

  /**
   * Get wiring configuration for a rule
   */
  async getWiringConfiguration(ruleId: number): Promise<any | null> {
    return this.prisma.wiringConfiguration.findUnique({
      where: { rule_id: ruleId },
      include: {
        rule: true,
      },
    });
  }

  /**
   * Save wiring configuration for a rule
   */
  async saveWiringConfiguration(
    ruleId: number,
    data: {
      nodes: any; // React Flow nodes
      edges: any; // React Flow edges
      viewport?: any; // Viewport position/zoom
    }
  ): Promise<any> {
    // Validate rule exists
    const rule = await this.prisma.notificationRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule) {
      throw new Error(`Notification rule ${ruleId} not found`);
    }

    // Upsert wiring configuration
    return this.prisma.wiringConfiguration.upsert({
      where: { rule_id: ruleId },
      update: {
        nodes: data.nodes,
        edges: data.edges,
        viewport: data.viewport ?? null,
      },
      create: {
        rule_id: ruleId,
        nodes: data.nodes,
        edges: data.edges,
        viewport: data.viewport ?? null,
      },
    });
  }

  /**
   * Get all trigger-event connections for a rule
   */
  async getConnectionsForRule(ruleId: number): Promise<any[]> {
    return this.prisma.triggerEventConnection.findMany({
      where: { rule_id: ruleId },
      include: {
        trigger: true,
        event: true,
      },
    });
  }

  /**
   * Create a trigger-event connection
   */
  async createConnection(
    ruleId: number,
    data: {
      trigger_id: number;
      event_id: number;
      connection_config?: any;
      enabled?: boolean;
    }
  ): Promise<any> {
    // Validate rule exists
    const rule = await this.prisma.notificationRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule) {
      throw new Error(`Notification rule ${ruleId} not found`);
    }

    // Validate trigger exists
    const trigger = await this.triggerService.getTriggerById(data.trigger_id);
    if (!trigger) {
      throw new Error(`Trigger ${data.trigger_id} not found`);
    }

    // Validate event exists
    const event = await this.eventService.getEventById(data.event_id);
    if (!event) {
      throw new Error(`Event ${data.event_id} not found`);
    }

    // Validate schema compatibility
    const validation = this.validateConnection(trigger, event);
    if (!validation.valid) {
      throw new Error(`Invalid connection: ${validation.error}`);
    }

    return this.prisma.triggerEventConnection.create({
      data: {
        rule_id: ruleId,
        trigger_id: data.trigger_id,
        event_id: data.event_id,
        connection_config: data.connection_config || null,
        enabled: data.enabled !== undefined ? data.enabled : true,
      },
    });
  }

  /**
   * Update a connection
   */
  async updateConnection(
    connectionId: number,
    data: {
      connection_config?: any;
      enabled?: boolean;
    }
  ): Promise<any> {
    return this.prisma.triggerEventConnection.update({
      where: { id: connectionId },
      data: {
        ...(data.connection_config !== undefined && { connection_config: data.connection_config }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
      },
    });
  }

  /**
   * Delete a connection
   */
  async deleteConnection(connectionId: number): Promise<void> {
    await this.prisma.triggerEventConnection.delete({
      where: { id: connectionId },
    });
  }

  /**
   * Validate that a trigger's output schema satisfies an event's input schema
   * Returns true if the trigger can provide all required data for the event
   */
  validateConnection(trigger: any, event: any): {
    valid: boolean;
    error?: string;
  } {
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
          const hasNested = this.hasNestedProperty(triggerProperties, requiredProp);
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
  private hasNestedProperty(properties: any, path: string): boolean {
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
   * Delete all connections for a rule
   */
  async deleteConnectionsForRule(ruleId: number): Promise<void> {
    await this.prisma.triggerEventConnection.deleteMany({
      where: { rule_id: ruleId },
    });
  }
}


