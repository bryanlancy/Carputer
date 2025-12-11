import { PrismaClient } from '@prisma/client';
import { NotificationService } from './notification';
import { TemplateService } from './template';

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
    message_template?: string;
    enabled?: boolean;
    priority?: number;
  }): Promise<any> {
    // Validate notification type exists (using notifications table)
    const notificationType = await this.prisma.notification.findFirst({
      where: { name: data.notification_type_code },
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

    // Note: notificationRule table has been deprecated - rules are now managed via notifications table
    // This method is kept for backward compatibility but should be refactored
    throw new Error('NotificationRule table has been deprecated. Use Notification table instead.');
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
    // Note: notificationRule table has been deprecated
    // This method should be refactored to use notifications table
    // For now, return empty array to prevent errors
    return [];
  }

  /**
   * Get rule by ID
   */
  async getRuleById(ruleId: number): Promise<any> {
    // Note: notificationRule table has been deprecated
    throw new Error('NotificationRule table has been deprecated. Use Notification table instead.');
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
      // Validate notification type exists (using notifications table)
      const notificationType = await this.prisma.notification.findFirst({
        where: { name: data.notification_type_code },
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

    // Note: notificationRule table has been deprecated
    throw new Error('NotificationRule table has been deprecated. Use Notification table instead.');
  }

  /**
   * Delete rule
   */
  async deleteRule(ruleId: number): Promise<void> {
    // Note: notificationRule table has been deprecated
    throw new Error('NotificationRule table has been deprecated. Use Notification table instead.');
  }

  /**
   * Evaluate rules for a backend event
   * Returns matching rules that should trigger notifications
   */
  async evaluateRulesForEvent(
    eventType: string,
    eventData: any
  ): Promise<any[]> {
    // Note: notificationRule table has been deprecated - rules are now in notifications table
    // This method should be refactored to use notifications table
    const rules: any[] = [];
    // TODO: Refactor to query notifications table with appropriate filters

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
      triggerOutput?: any; // Data from trigger for template rendering
    } = {}
  ): Promise<any> {
    const rule = await this.getRuleById(ruleId);

    if (!rule) {
      throw new Error(`Rule ${ruleId} not found`);
    }

    if (!rule.enabled) {
      throw new Error(`Rule ${ruleId} is disabled`);
    }

    // Render message template if it exists
    let renderedMessage = options.message;
    if (rule.message_template && options.triggerOutput) {
      try {
        renderedMessage = TemplateService.render(rule.message_template, options.triggerOutput);
      } catch (error) {
        console.error('Template rendering error:', error);
        // Fall back to provided message or template as-is
        renderedMessage = options.message || rule.message_template;
      }
    } else if (rule.message_template && !renderedMessage) {
      // If no trigger output but template exists, use template as-is
      renderedMessage = rule.message_template;
    }

    // Create notification
    const notification = await this.notificationService.createNotification(
      options.deviceId || 1,
      rule.notification_type_code,
      {
        title: options.title,
        message: renderedMessage,
        metadata: options.metadata,
        deviceLogId: options.deviceLogId,
        show_in_feed: true, // Default to showing in feed
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

