import { PrismaClient } from '@prisma/client';
import { NotificationService } from './notification';

/**
 * Notification Rule Service
 * Manages notification rules and their evaluation
 */
export class NotificationRuleService {
  constructor(
    private prisma: PrismaClient,
    private notificationService: NotificationService
  ) {}

  /**
   * Create a notification rule
   */
  async createRule(data: {
    name: string;
    description?: string;
    trigger_type: 'date_time' | 'backend_event' | 'user_driven';
    trigger_config: any;
    notification_type_code: string;
    target_users?: string[] | null;
    target_roles?: string[] | null;
    enabled?: boolean;
    priority?: number;
  }): Promise<any> {
    // Validate notification type exists
    const notificationType = await this.prisma.notificationType.findUnique({
      where: { type_code: data.notification_type_code },
    });

    if (!notificationType) {
      throw new Error(`Notification type ${data.notification_type_code} not found`);
    }

    // Build target_users JSONB
    let targetUsers: any = null;
    if (data.target_users && data.target_users.length > 0) {
      targetUsers = { users: data.target_users };
    } else if (data.target_roles && data.target_roles.length > 0) {
      targetUsers = { roles: data.target_roles };
    }

    return this.prisma.notificationRule.create({
      data: {
        name: data.name,
        description: data.description || null,
        trigger_type: data.trigger_type,
        trigger_config: data.trigger_config || {},
        notification_type_code: data.notification_type_code,
        target_users: targetUsers,
        enabled: data.enabled !== undefined ? data.enabled : true,
        priority: data.priority || 0,
      },
    });
  }

  /**
   * Get all rules
   */
  async getAllRules(options: {
    enabled?: boolean;
    trigger_type?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<any[]> {
    const where: any = {};

    if (options.enabled !== undefined) {
      where.enabled = options.enabled;
    }

    if (options.trigger_type) {
      where.trigger_type = options.trigger_type;
    }

    return this.prisma.notificationRule.findMany({
      where,
      include: {
        triggers: {
          orderBy: {
            created_at: 'desc',
          },
          take: 10,
        },
      },
      orderBy: [
        { priority: 'desc' },
        { created_at: 'desc' },
      ],
      take: options.limit || 100,
      skip: options.offset || 0,
    });
  }

  /**
   * Get rule by ID
   */
  async getRuleById(ruleId: number): Promise<any> {
    return this.prisma.notificationRule.findUnique({
      where: { id: ruleId },
      include: {
        triggers: {
          orderBy: {
            created_at: 'desc',
          },
        },
      },
    });
  }

  /**
   * Update rule
   */
  async updateRule(
    ruleId: number,
    data: {
      name?: string;
      description?: string;
      trigger_type?: 'date_time' | 'backend_event' | 'user_driven';
      trigger_config?: any;
      notification_type_code?: string;
      target_users?: string[] | null;
      target_roles?: string[] | null;
      enabled?: boolean;
      priority?: number;
    }
  ): Promise<any> {
    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.trigger_type !== undefined) updateData.trigger_type = data.trigger_type;
    if (data.trigger_config !== undefined) updateData.trigger_config = data.trigger_config;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.priority !== undefined) updateData.priority = data.priority;

    if (data.notification_type_code !== undefined) {
      // Validate notification type exists
      const notificationType = await this.prisma.notificationType.findUnique({
        where: { type_code: data.notification_type_code },
      });

      if (!notificationType) {
        throw new Error(`Notification type ${data.notification_type_code} not found`);
      }

      updateData.notification_type_code = data.notification_type_code;
    }

    if (data.target_users !== undefined || data.target_roles !== undefined) {
      let targetUsers: any = null;
      if (data.target_users && data.target_users.length > 0) {
        targetUsers = { users: data.target_users };
      } else if (data.target_roles && data.target_roles.length > 0) {
        targetUsers = { roles: data.target_roles };
      }
      updateData.target_users = targetUsers;
    }

    return this.prisma.notificationRule.update({
      where: { id: ruleId },
      data: updateData,
    });
  }

  /**
   * Delete rule
   */
  async deleteRule(ruleId: number): Promise<void> {
    await this.prisma.notificationRule.delete({
      where: { id: ruleId },
    });
  }

  /**
   * Evaluate rules for a backend event
   * Returns matching rules that should trigger notifications
   */
  async evaluateRulesForEvent(
    eventType: string,
    eventData: any
  ): Promise<any[]> {
    const rules = await this.prisma.notificationRule.findMany({
      where: {
        enabled: true,
        trigger_type: 'backend_event',
        trigger_config: {
          path: ['event_type'],
          equals: eventType,
        },
      },
      orderBy: {
        priority: 'desc',
      },
    });

    // Filter rules based on trigger_config conditions
    const matchingRules: any[] = [];

    for (const rule of rules) {
      const config = rule.trigger_config as any;

      if (config.event_type === eventType) {
        // Check additional conditions if any
        let matches = true;

        if (config.conditions) {
          for (const condition of config.conditions) {
            const value = this.getNestedValue(eventData, condition.field);

            switch (condition.operator) {
              case 'equals':
                if (value !== condition.value) matches = false;
                break;
              case 'not_equals':
                if (value === condition.value) matches = false;
                break;
              case 'contains':
                if (!String(value).includes(condition.value)) matches = false;
                break;
              case 'greater_than':
                if (Number(value) <= Number(condition.value)) matches = false;
                break;
              case 'less_than':
                if (Number(value) >= Number(condition.value)) matches = false;
                break;
            }

            if (!matches) break;
          }
        }

        if (matches) {
          matchingRules.push(rule);
        }
      }
    }

    return matchingRules;
  }

  /**
   * Helper to get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }

  /**
   * Execute a rule (create notification based on rule)
   */
  async executeRule(
    ruleId: number,
    options: {
      deviceId?: number;
      title?: string;
      message?: string;
      metadata?: any;
      deviceLogId?: number;
    } = {}
  ): Promise<any> {
    const rule = await this.getRuleById(ruleId);

    if (!rule) {
      throw new Error(`Rule ${ruleId} not found`);
    }

    if (!rule.enabled) {
      throw new Error(`Rule ${ruleId} is disabled`);
    }

    // Create notification
    const notification = await this.notificationService.createNotification(
      options.deviceId || 1,
      rule.notification_type_code,
      {
        title: options.title,
        message: options.message,
        metadata: options.metadata,
        deviceLogId: options.deviceLogId,
      }
    );

    // Determine target users
    const targetUsers = rule.target_users as any;
    let userIds: string[] | null = null;
    let roleNames: string[] | null = null;

    if (targetUsers) {
      if (targetUsers.users && Array.isArray(targetUsers.users)) {
        userIds = targetUsers.users;
      }
      if (targetUsers.roles && Array.isArray(targetUsers.roles)) {
        roleNames = targetUsers.roles;
      }
    }

    // Deliver notification to users
    await this.notificationService.deliverNotificationToUsers(
      notification,
      userIds,
      roleNames
    );

    return notification;
  }
}

