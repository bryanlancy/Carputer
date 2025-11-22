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
   * Get or create a notification type by code
   */
  async getOrCreateNotificationType(
    typeCode: string,
    options: {
      typeName?: string;
      description?: string;
      severity?: 'info' | 'warning' | 'error' | 'critical';
      enabled?: boolean;
    } = {}
  ): Promise<any> {
    if (!typeCode) {
      throw new Error('Notification type code is required');
    }

    // Try to get existing notification type
    let notificationType = await this.prisma.notificationType.findUnique({
      where: { type_code: typeCode },
    });

    if (notificationType) {
      return notificationType;
    }

    // Create new notification type
    notificationType = await this.prisma.notificationType.create({
      data: {
        type_code: typeCode,
        type_name: options.typeName || typeCode,
        description: options.description || null,
        severity: options.severity || 'info',
        enabled: options.enabled !== undefined ? options.enabled : true,
      },
    });

    return notificationType;
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
    } = {}
  ): Promise<any> {
    if (!deviceId || !typeCode) {
      throw new Error('Device ID and notification type code are required');
    }

    // Get or create notification type
    const notificationType = await this.getOrCreateNotificationType(typeCode);

    if (!notificationType.enabled) {
      throw new Error(`Notification type ${typeCode} is disabled`);
    }

    // Generate default title if not provided
    const title =
      options.title ||
      `${notificationType.type_name} - Device ${deviceId}`;

    // Create notification
    const notification = await this.prisma.notification.create({
      data: {
        device_id: deviceId,
        notification_type_id: notificationType.id,
        device_log_id: options.deviceLogId || null,
        title,
        message: options.message || null,
        metadata: options.metadata || null,
        read: false,
      },
      include: {
        device: {
          select: {
            id: true,
            device_id: true,
            hostname: true,
            status: true,
          },
        },
        notification_type: true,
        device_log: {
          select: {
            id: true,
            log_type: true,
            uploaded_at: true,
          },
        },
      },
    });

    return notification;
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

    if (options.unreadOnly) {
      where.read = false;
    }

    const notifications = await this.prisma.notification.findMany({
      where,
      include: {
        notification_type: true,
        device_log: {
          select: {
            id: true,
            log_type: true,
            uploaded_at: true,
          },
        },
      },
      orderBy: {
        [options.orderBy || 'created_at']: options.order || 'desc',
      },
      take: options.limit || 100,
      skip: options.offset || 0,
    });

    return notifications;
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

    if (options.unreadOnly) {
      where.read = false;
    }

    if (options.deviceId) {
      where.device_id = options.deviceId;
    }

    if (options.typeCode) {
      const notificationType = await this.prisma.notificationType.findUnique({
        where: { type_code: options.typeCode },
      });
      if (notificationType) {
        where.notification_type_id = notificationType.id;
      }
    }

    const notifications = await this.prisma.notification.findMany({
      where,
      include: {
        device: {
          select: {
            id: true,
            device_id: true,
            hostname: true,
            status: true,
          },
        },
        notification_type: true,
        device_log: {
          select: {
            id: true,
            log_type: true,
            uploaded_at: true,
          },
        },
      },
      orderBy: {
        [options.orderBy || 'created_at']: options.order || 'desc',
      },
      take: options.limit || 100,
      skip: options.offset || 0,
    });

    return notifications;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: number): Promise<any> {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        read: true,
        read_at: new Date(),
      },
    });
  }

  /**
   * Mark all notifications as read for a device
   */
  async markAllAsRead(deviceId: number): Promise<{ count: number }> {
    return this.prisma.notification.updateMany({
      where: {
        device_id: deviceId,
        read: false,
      },
      data: {
        read: true,
        read_at: new Date(),
      },
    });
  }

  /**
   * Get unread notification count for a device
   */
  async getUnreadCount(deviceId: number): Promise<number> {
    return this.prisma.notification.count({
      where: {
        device_id: deviceId,
        read: false,
      },
    });
  }

  /**
   * Get unread notification count for all devices
   */
  async getTotalUnreadCount(): Promise<number> {
    return this.prisma.notification.count({
      where: {
        read: false,
      },
    });
  }
}

