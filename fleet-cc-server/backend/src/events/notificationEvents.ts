import { PrismaClient } from '@prisma/client';
import { NotificationTriggerService } from '../services/notificationTriggers';
import { NotificationRuleService } from '../services/notificationRules';
import { NotificationService } from '../services/notification';
import { WiringExecutorService } from '../services/wiringExecutor';
import { WiringService } from '../services/wiring';
import { TriggerService } from '../services/trigger';
import { EventService } from '../services/event';

/**
 * Notification Event Listeners
 * Handles backend events and triggers notifications based on rules
 */

let triggerService: NotificationTriggerService | null = null;
let wiringExecutorService: WiringExecutorService | null = null;
let prismaClient: PrismaClient | null = null;

/**
 * Initialize event listeners
 */
export function initializeNotificationEventListeners(prisma: PrismaClient): void {
  if (triggerService && wiringExecutorService) {
    console.log('Notification event listeners already initialized');
    return;
  }

  prismaClient = prisma;
  const notificationService = new NotificationService(prisma);
  const ruleService = new NotificationRuleService(prisma, notificationService);
  triggerService = new NotificationTriggerService(prisma, ruleService);

  // Initialize wiring executor service for wiring-based triggers
  const wiringService = new WiringService(prisma, new TriggerService(prisma), new EventService(prisma));
  const triggerServiceForWiring = new TriggerService(prisma);
  const eventService = new EventService(prisma);
  wiringExecutorService = new WiringExecutorService(
    prisma,
    wiringService,
    triggerServiceForWiring,
    eventService,
    notificationService
  );

  console.log('Notification event listeners initialized');
}

/**
 * Handle device online event
 */
export async function handleDeviceOnlineEvent(
  deviceId: number,
  deviceData: any
): Promise<void> {
  if (!triggerService) {
    console.warn('Trigger service not initialized, skipping event handling');
    return;
  }

  // Handle legacy notification rules
  try {
    await triggerService.handleBackendEvent(
      'device.online',
      {
        device_id: deviceId,
        ...deviceData,
      },
      {
        deviceId,
      }
    );
  } catch (error) {
    console.error('Error handling device online event (legacy rules):', error);
  }

  // Handle wiring-based triggers
  if (!wiringExecutorService) {
    console.warn('[DeviceOnlineEvent] Wiring executor service not initialized');
  }
  if (!prismaClient) {
    console.warn('[DeviceOnlineEvent] Prisma client not initialized');
  }

  if (wiringExecutorService && prismaClient) {
    try {
      console.log(`[DeviceOnlineEvent] Executing wiring triggers for device ${deviceId}`);
      // Get device data for trigger
      const device = await prismaClient.device.findUnique({
        where: { id: deviceId },
      });

      if (device) {
        // Prepare trigger data matching the device.online trigger schema
        // The schema expects: { device: object, timestamp: string (ISO 8601) }
        const triggerData = {
          device: {
            id: device.id,
            mac_address: device.mac_address,
            hostname: device.hostname,
            vin: device.vin,
            hardware_rev: device.hardware_rev,
            build_id: device.build_id,
            current_version: device.current_version,
            current_build_id: device.current_build_id,
            current_ip: device.current_ip,
            status: device.status,
            last_seen: device.last_seen,
            authorized: device.authorized,
            registration_method: device.registration_method,
            ...deviceData,
            // Ensure device_id is always set correctly (after spread to prevent overwrite)
            device_id: device.device_id,
          },
          timestamp: new Date().toISOString(), // ISO 8601 format as required by schema
        };

        console.log(`[DeviceOnlineEvent] Trigger data prepared:`, JSON.stringify(triggerData, null, 2));
        const results = await wiringExecutorService.executeTriggerForAllWorkspaces(
          'device.online',
          triggerData
        );
        console.log(`[DeviceOnlineEvent] Wiring execution results:`, results);
      } else {
        console.warn(`[DeviceOnlineEvent] Device ${deviceId} not found`);
      }
    } catch (error) {
      console.error('Error executing wiring triggers for device online:', error);
    }
  } else {
    console.warn('[DeviceOnlineEvent] Wiring executor service not initialized');
  }
}

/**
 * Handle device offline event
 */
export async function handleDeviceOfflineEvent(
  deviceId: number,
  deviceData: any
): Promise<void> {
  if (!triggerService) {
    console.warn('Trigger service not initialized, skipping event handling');
    return;
  }

  // Handle legacy notification rules
  try {
    await triggerService.handleBackendEvent(
      'device.offline',
      {
        device_id: deviceId,
        ...deviceData,
      },
      {
        deviceId,
      }
    );
  } catch (error) {
    console.error('Error handling device offline event (legacy rules):', error);
  }

  // Handle wiring-based triggers
  if (wiringExecutorService && prismaClient) {
    try {
      console.log(`[DeviceOfflineEvent] Executing wiring triggers for device ${deviceId}`);
      // Get device data for trigger
      const device = await prismaClient.device.findUnique({
        where: { id: deviceId },
      });

      if (device) {
        // Prepare trigger data matching the device.offline trigger schema
        // The schema expects: { device: object, timestamp: string (ISO 8601) }
        const triggerData = {
          device: {
            id: device.id,
            mac_address: device.mac_address,
            hostname: device.hostname,
            vin: device.vin,
            hardware_rev: device.hardware_rev,
            build_id: device.build_id,
            current_version: device.current_version,
            current_build_id: device.current_build_id,
            current_ip: device.current_ip,
            status: device.status,
            last_seen: device.last_seen,
            authorized: device.authorized,
            registration_method: device.registration_method,
            ...deviceData,
            // Ensure device_id is always set correctly (after spread to prevent overwrite)
            device_id: device.device_id,
          },
          timestamp: new Date().toISOString(), // ISO 8601 format as required by schema
        };

        await wiringExecutorService.executeTriggerForAllWorkspaces(
          'device.offline',
          triggerData
        );
      }
    } catch (error) {
      console.error('Error executing wiring triggers for device offline:', error);
    }
  }
}

/**
 * Handle command completion event
 */
export async function handleCommandCompletionEvent(
  commandId: number,
  commandData: any
): Promise<void> {
  if (!triggerService) {
    console.warn('Trigger service not initialized, skipping event handling');
    return;
  }

  try {
    await triggerService.handleBackendEvent(
      'command.completed',
      {
        command_id: commandId,
        ...commandData,
      },
      {
        deviceId: commandData.device_id,
      }
    );
  } catch (error) {
    console.error('Error handling command completion event:', error);
  }
}

/**
 * Handle command failure event
 */
export async function handleCommandFailureEvent(
  commandId: number,
  commandData: any
): Promise<void> {
  if (!triggerService) {
    console.warn('Trigger service not initialized, skipping event handling');
    return;
  }

  try {
    await triggerService.handleBackendEvent(
      'command.failed',
      {
        command_id: commandId,
        ...commandData,
      },
      {
        deviceId: commandData.device_id,
      }
    );
  } catch (error) {
    console.error('Error handling command failure event:', error);
  }
}

/**
 * Handle generic backend event
 */
export async function handleBackendEvent(
  eventType: string,
  eventData: any,
  options: {
    deviceId?: number;
    metadata?: any;
  } = {}
): Promise<void> {
  if (!triggerService) {
    console.warn('Trigger service not initialized, skipping event handling');
    return;
  }

  try {
    await triggerService.handleBackendEvent(eventType, eventData, options);
  } catch (error) {
    console.error(`Error handling backend event ${eventType}:`, error);
  }
}


