import { PrismaClient } from '@prisma/client';
import { NotificationTriggerService } from '../services/notificationTriggers';
import { NotificationRuleService } from '../services/notificationRules';
import { NotificationService } from '../services/notification';

/**
 * Notification Event Listeners
 * Handles backend events and triggers notifications based on rules
 */

let triggerService: NotificationTriggerService | null = null;

/**
 * Initialize event listeners
 */
export function initializeNotificationEventListeners(prisma: PrismaClient): void {
  if (triggerService) {
    console.log('Notification event listeners already initialized');
    return;
  }

  const notificationService = new NotificationService(prisma);
  const ruleService = new NotificationRuleService(prisma, notificationService);
  triggerService = new NotificationTriggerService(prisma, ruleService);

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
    console.error('Error handling device online event:', error);
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
    console.error('Error handling device offline event:', error);
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

