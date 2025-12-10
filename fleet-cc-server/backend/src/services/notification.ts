import { PrismaClient } from '@prisma/client';

/**
 * Notification Service
 *
 * Manages creation and retrieval of notifications for various system events.
 * Supports extensible notification types and linking to device logs for deeper tracking.
 */
export class NotificationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get or create a notification by name
   */
  async getOrCreateNotification(
    name: string,
    options: {
      description?: string;
      priority?: number;
      enabled?: boolean;
    } = {}
  ): Promise<any> {
    if (!name) {
      throw new Error('Notification name is required');
    }

    // Try to get existing notification
    let notification = await this.prisma.notification.findUnique({
      where: { name: name },
    });

    if (notification) {
      return notification;
    }

    // Create new notification
    notification = await this.prisma.notification.create({
      data: {
        name: name,
        description: options.description || null,
        priority: options.priority || 0,
        enabled: options.enabled !== undefined ? options.enabled : true,
      },
    });

    return notification;
  }

  /**
   * Create a notification for a device
   */
  async createNotification(
    deviceId: number,
    typeCode: string,
    options: {
      title?: string;
      message?: string;
      metadata?: any;
      deviceLogId?: number;
      show_in_feed?: boolean;
    } = {}
  ): Promise<any> {
    if (!deviceId || !typeCode) {
      throw new Error('Device ID and notification type code are required');
    }

    // Get or create notification (using typeCode as name for backward compatibility)
    const notificationType = await this.getOrCreateNotification(typeCode);

    if (!notificationType.enabled) {
      throw new Error(`Notification ${typeCode} is disabled`);
    }

    // Generate default title if not provided
    const title =
      options.title ||
      `${notificationType.name} - Device ${deviceId}`;

    // Note: notification_instances table has been removed
    // This method may need to be refactored based on new requirements
    throw new Error('createNotification is deprecated - notification_instances table has been removed');
  }

  /**
   * Create a device online notification
   */
  async createDeviceOnlineNotification(
    deviceId: number,
    options: {
      message?: string;
      metadata?: any;
      deviceLogId?: number;
    } = {}
  ): Promise<any> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: {
        device_id: true,
        hostname: true,
        current_ip: true,
        last_seen: true,
      },
    });

    if (!device) {
      throw new Error(`Device with ID ${deviceId} not found`);
    }

    const hostname = device.hostname || device.device_id;
    const title = `Device ${hostname} came online`;
    const message =
      options.message ||
      `Device ${hostname} has successfully established connection. ${
        device.current_ip ? `IP: ${device.current_ip}` : ''
      }`;

    return this.createNotification(deviceId, 'device.online', {
      title,
      message,
      metadata: {
        ...options.metadata,
        ip: device.current_ip,
        last_seen: device.last_seen,
      },
      deviceLogId: options.deviceLogId,
    });
  }

  /**
   * Create a device offline notification
   */
  async createDeviceOfflineNotification(
    deviceId: number,
    options: {
      message?: string;
      metadata?: any;
      deviceLogId?: number;
    } = {}
  ): Promise<any> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: {
        device_id: true,
        hostname: true,
        current_ip: true,
        last_seen: true,
      },
    });

    if (!device) {
      throw new Error(`Device with ID ${deviceId} not found`);
    }

    const hostname = device.hostname || device.device_id;
    const title = `Device ${hostname} went offline`;
    const message =
      options.message ||
      `Device ${hostname} has lost connection or gone offline. ${
        device.last_seen
          ? `Last seen: ${device.last_seen.toISOString()}`
          : ''
      }`;

    return this.createNotification(deviceId, 'device.offline', {
      title,
      message,
      metadata: {
        ...options.metadata,
        ip: device.current_ip,
        last_seen: device.last_seen,
      },
      deviceLogId: options.deviceLogId,
    });
  }

  /**
   * Get notifications for a device
   */
  async getDeviceNotifications(
    deviceId: number,
    options: {
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
      orderBy?: 'created_at' | 'read';
      order?: 'asc' | 'desc';
    } = {}
  ): Promise<any[]> {
    const where: any = {
      device_id: deviceId,
    };

    // Note: read status is now handled in UserNotification, not Notification
    // This method can't filter by read status anymore

    // Note: notification_instances table has been removed
    // This method may need to be refactored based on new requirements
    throw new Error('getDeviceNotifications is deprecated - notification_instances table has been removed');
  }

  /**
   * Get all notifications
   */
  async getAllNotifications(
    options: {
      unreadOnly?: boolean;
      deviceId?: number;
      typeCode?: string;
      limit?: number;
      offset?: number;
      orderBy?: 'created_at' | 'read';
      order?: 'asc' | 'desc';
    } = {}
  ): Promise<any[]> {
    const where: any = {};

    // Note: read status is now handled in UserNotification, not Notification
    // This method can't filter by read status anymore

    if (options.deviceId) {
      where.device_id = options.deviceId;
    }

    if (options.typeCode) {
      const notificationType = await this.prisma.notification.findUnique({
        where: { name: options.typeCode },
      });
      if (notificationType) {
        // Note: This method is deprecated, but keeping for backward compatibility
        // where.notification_type_id = notificationType.id;
      }
    }

    // Note: notification_instances table has been removed
    // This method may need to be refactored based on new requirements
    throw new Error('getAllNotifications is deprecated - notification_instances table has been removed');
  }

  /**
   * Mark notification as read
   * @deprecated Use UserNotification methods instead - read status is now per-user
   */
  async markAsRead(notificationId: number): Promise<any> {
    // This method is deprecated - read status is now in UserNotification
    throw new Error('markAsRead is deprecated. Use UserNotification methods instead.');
  }

  /**
   * Mark all notifications as read for a device
   * @deprecated Use UserNotification methods instead - read status is now per-user
   */
  async markAllAsRead(deviceId: number): Promise<{ count: number }> {
    // This method is deprecated - read status is now in UserNotification
    throw new Error('markAllAsRead is deprecated. Use UserNotification methods instead.');
  }

  /**
   * Get unread notification count for a device
   * @deprecated Use UserNotification methods instead - read status is now per-user
   */
  async getUnreadCount(deviceId: number): Promise<number> {
    // This method is deprecated - read status is now in UserNotification
    throw new Error('getUnreadCount is deprecated. Use UserNotification methods instead.');
  }

  /**
   * Get unread notification count for all devices
   * @deprecated Use UserNotification methods instead - read status is now per-user
   */
  async getTotalUnreadCount(): Promise<number> {
    // This method is deprecated - read status is now in UserNotification
    throw new Error('getTotalUnreadCount is deprecated. Use UserNotification methods instead.');
  }

  // ============================================
  // USER-BASED NOTIFICATION METHODS (NEW)
  // ============================================

  /**
   * Create a notification for specific users
   * Creates the notification and links it to the specified users
   */
  async createUserNotification(
    userIds: string[],
    typeCode: string,
    options: {
      deviceId?: number;
      title?: string;
      message?: string;
      metadata?: any;
      deviceLogId?: number;
    } = {}
  ): Promise<any> {
    if (!userIds || userIds.length === 0) {
      throw new Error('At least one user ID is required');
    }

    if (!typeCode) {
      throw new Error('Notification type code is required');
    }

    // Note: notification_instances table has been removed
    // This method may need to be refactored based on new requirements
    throw new Error('createUserNotification is deprecated - notification_instances table has been removed');
  }

  /**
   * Create notification for users based on roles
   */
  async createNotificationForRoles(
    roles: string[],
    typeCode: string,
    options: {
      deviceId?: number;
      title?: string;
      message?: string;
      metadata?: any;
      deviceLogId?: number;
    } = {}
  ): Promise<any> {
    // Find all users with the specified roles
    const users = await this.prisma.user.findMany({
      where: {
        user_roles: {
          some: {
            role: {
              in: roles,
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (users.length === 0) {
      throw new Error(`No users found with roles: ${roles.join(', ')}`);
    }

    const userIds = users.map(u => u.id);
    return this.createUserNotification(userIds, typeCode, options);
  }

  /**
   * Create notification for all users
   */
  async createNotificationForAllUsers(
    typeCode: string,
    options: {
      deviceId?: number;
      title?: string;
      message?: string;
      metadata?: any;
      deviceLogId?: number;
    } = {}
  ): Promise<any> {
    // Get all users
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
      },
    });

    if (users.length === 0) {
      throw new Error('No users found in system');
    }

    const userIds = users.map(u => u.id);
    return this.createUserNotification(userIds, typeCode, options);
  }

  /**
   * Get notifications for a specific user
   */
  async getUserNotifications(
    userId: string,
    options: {
      unviewedOnly?: boolean;
      limit?: number;
      offset?: number;
      orderBy?: 'created_at' | 'viewed';
      order?: 'asc' | 'desc';
    } = {}
  ): Promise<any[]> {
    const where: any = {
      user_id: userId,
    };

    if (options.unviewedOnly) {
      where.viewed = false;
    }

    // Note: notifications table now stores templates, not instances
    const userNotifications = await this.prisma.userNotification.findMany({
      where,
      include: {
        notification: true,
      },
      orderBy: {
        [options.orderBy === 'viewed' ? 'viewed_at' : 'created_at']: options.order || 'desc',
      },
      take: options.limit || 100,
      skip: options.offset || 0,
    });

    // Transform to include viewed status
    return userNotifications.map(un => ({
      ...un.notification,
      viewed: un.viewed,
      viewed_at: un.viewed_at,
      user_notification_id: un.id,
    }));
  }

  /**
   * Mark notification as viewed by user
   */
  async markAsViewedByUser(
    notificationId: number,
    userId: string
  ): Promise<any> {
    return this.prisma.userNotification.update({
      where: {
        user_notification_unique: {
          user_id: userId,
          notification_id: notificationId,
        },
      },
      data: {
        viewed: true,
        viewed_at: new Date(),
      },
      include: {
        notification: true,
      },
    });
  }

  /**
   * Mark all notifications as viewed for a user
   */
  async markAllAsViewedByUser(userId: string): Promise<{ count: number }> {
    return this.prisma.userNotification.updateMany({
      where: {
        user_id: userId,
        viewed: false,
      },
      data: {
        viewed: true,
        viewed_at: new Date(),
      },
    });
  }

  /**
   * Get unviewed notification count for a user
   */
  async getUnviewedCountForUser(userId: string): Promise<number> {
    return this.prisma.userNotification.count({
      where: {
        user_id: userId,
        viewed: false,
      },
    });
  }

  /**
   * Deliver notification to users based on rules
   * This is called by the notification rules engine
   */
  async deliverNotificationToUsers(
    notification: any,
    targetUsers: string[] | null,
    targetRoles: string[] | null
  ): Promise<void> {
    let userIds: string[] = [];

    if (targetUsers && targetUsers.length > 0) {
      // Direct user targeting
      userIds = targetUsers;
    } else if (targetRoles && targetRoles.length > 0) {
      // Role-based targeting
      const users = await this.prisma.user.findMany({
        where: {
          user_roles: {
            some: {
              role: {
                in: targetRoles,
              },
            },
          },
        },
        select: {
          id: true,
        },
      });
      userIds = users.map(u => u.id);
    } else {
      // All users
      const users = await this.prisma.user.findMany({
        select: {
          id: true,
        },
      });
      userIds = users.map(u => u.id);
    }

    // Link notification to users
    for (const userId of userIds) {
      try {
        await this.prisma.userNotification.upsert({
          where: {
            user_notification_unique: {
              user_id: userId,
              notification_id: notification.id,
            },
          },
          create: {
            user_id: userId,
            notification_id: notification.id,
            viewed: false,
          },
          update: {},
        });
      } catch (error: any) {
        // Log but don't fail if there's an issue
        console.error(`Failed to link notification ${notification.id} to user ${userId}:`, error);
      }
    }
  }
}

