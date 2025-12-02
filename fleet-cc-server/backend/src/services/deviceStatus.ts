import { PrismaClient } from '@prisma/client';
import { NotificationService } from './notification';
import { handleDeviceOfflineEvent } from '../events/notificationEvents';

// Import broadcast functions (use lazy import to avoid circular dependency)
let broadcastDeviceUpdate: ((device: any, notification?: any) => void) | null = null;
let broadcastNotification: ((notification: any) => void) | null = null;

export function setBroadcastFunctions(
  deviceUpdateFn: (device: any, notification?: any) => void,
  notificationFn: (notification: any) => void
) {
  broadcastDeviceUpdate = deviceUpdateFn;
  broadcastNotification = notificationFn;
}

/**
 * Device Status Service
 *
 * Manages device status transitions and offline detection.
 */
export class DeviceStatusService {
  private readonly OFFLINE_THRESHOLD_MS = 60 * 1000; // 60 seconds in milliseconds

  constructor(private prisma: PrismaClient) {}

  /**
   * Check if a device should be marked as offline based on last_seen timestamp
   */
  private shouldBeOffline(lastSeen: Date | null, currentStatus: string): boolean {
    if (!lastSeen) {
      return currentStatus !== 'offline';
    }

    const now = new Date();
    const timeSinceLastSeen = now.getTime() - lastSeen.getTime();

    return timeSinceLastSeen > this.OFFLINE_THRESHOLD_MS && currentStatus === 'online';
  }

  /**
   * Update device status based on last_seen timestamp
   * Returns true if status was changed, false otherwise
   */
  async updateDeviceStatusIfOffline(deviceId: number): Promise<boolean> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: {
        id: true,
        status: true,
        last_seen: true,
      },
    });

    if (!device) {
      return false;
    }

    if (this.shouldBeOffline(device.last_seen, device.status)) {
      // Update device to offline
      const updatedDevice = await this.prisma.device.update({
        where: { id: deviceId },
        data: {
          status: 'offline',
        },
      });

      // Create offline notification
      let notification = null;
      try {
        const notificationService = new NotificationService(this.prisma);
        notification = await notificationService.createDeviceOfflineNotification(deviceId, {
          message: `Device has not sent a heartbeat in over 60 seconds`,
          metadata: {
            last_seen: device.last_seen,
            marked_offline_at: new Date(),
          },
        });
      } catch (error) {
        // Log but don't fail status update
        console.error('Failed to create offline notification:', error);
      }

      // Broadcast device update and notification to all connected clients
      try {
        if (notification && broadcastDeviceUpdate && broadcastNotification) {
          broadcastDeviceUpdate(updatedDevice, notification);
          broadcastNotification(notification);
        } else if (broadcastDeviceUpdate) {
          // Broadcast device update even if notification creation failed
          broadcastDeviceUpdate(updatedDevice);
        }
      } catch (broadcastError) {
        // Log broadcast error but don't fail status update
        console.error('Failed to broadcast offline device update:', broadcastError);
      }

      // Trigger notification event listeners for user-based notifications
      try {
        await handleDeviceOfflineEvent(deviceId, {
          device_id: updatedDevice.id,
          hostname: updatedDevice.hostname,
          last_seen: device.last_seen,
        });
      } catch (eventError) {
        // Log but don't fail - event listeners are optional
        console.error('Failed to handle device offline event:', eventError);
      }

      return true;
    }

    return false;
  }

  /**
   * Check if there are any devices currently online
   * Returns the count of online devices
   */
  async hasOnlineDevices(): Promise<boolean> {
    const onlineCount = await this.prisma.device.count({
      where: {
        status: 'online',
      },
    });
    return onlineCount > 0;
  }

  /**
   * Check and update all devices that should be marked as offline
   * Returns array of device IDs that were updated
   */
  async updateAllOfflineDevices(): Promise<number[]> {
    const now = new Date();
    const thresholdTime = new Date(now.getTime() - this.OFFLINE_THRESHOLD_MS);

    // Find all devices that are online but haven't been seen recently
    const staleDevices = await this.prisma.device.findMany({
      where: {
        status: 'online',
        last_seen: {
          lt: thresholdTime,
        },
      },
      select: {
        id: true,
        last_seen: true,
      },
    });

    const updatedDeviceIds: number[] = [];

    for (const device of staleDevices) {
      const updated = await this.updateDeviceStatusIfOffline(device.id);
      if (updated) {
        updatedDeviceIds.push(device.id);
      }
    }

    return updatedDeviceIds;
  }

  /**
   * Get device with status check (automatically marks offline if needed)
   */
  async getDeviceWithStatusCheck(deviceId: number) {
    // Check if device should be offline
    await this.updateDeviceStatusIfOffline(deviceId);

    // Return updated device
    return this.prisma.device.findUnique({
      where: { id: deviceId },
    });
  }

  /**
   * Get all devices with status checks (automatically marks offline devices)
   */
  async getAllDevicesWithStatusCheck() {
    // Update all stale devices
    await this.updateAllOfflineDevices();

    // Return all devices
    return this.prisma.device.findMany({
      orderBy: [
        { status: 'asc' }, // online before offline
        { last_seen: 'desc' },
        { device_id: 'asc' },
      ],
    });
  }
}

