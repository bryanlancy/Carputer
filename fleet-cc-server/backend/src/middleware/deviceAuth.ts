import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

/**
 * Device Authentication Middleware
 *
 * Authenticates devices based on MAC address and device ID.
 * Devices must be registered and authorized to access protected endpoints.
 */

interface DeviceAuthRequest extends Request {
  deviceId?: string;
  macAddress?: string;
  deviceDbId?: number;
  deviceAuthorized?: boolean;
}

/**
 * Middleware to authenticate device by MAC address or device ID
 * Expects either:
 * - X-Device-MAC header (for automatic registration/authentication)
 * - X-Device-ID header (for existing registered devices)
 */
export function authenticateDevice(req: DeviceAuthRequest, res: Response, next: NextFunction) {
  const macAddress = req.headers['x-device-mac'] as string;
  const deviceId = req.headers['x-device-id'] as string || req.body?.deviceId;

  if (!macAddress && !deviceId) {
    return res.status(401).json({
      error: 'Device authentication required',
      message: 'Provide either X-Device-MAC or X-Device-ID header'
    });
  }

  req.macAddress = macAddress;
  req.deviceId = deviceId;
  next();
}

/**
 * Middleware to verify device is registered and authorized
 * Must be used after authenticateDevice middleware
 */
export async function verifyDeviceAuthorized(
  req: DeviceAuthRequest,
  res: Response,
  next: NextFunction
) {
  const prisma: PrismaClient = req.prisma;
  const macAddress = req.macAddress;
  const deviceId = req.deviceId;

  try {
    let device;

    // Try to find device by MAC address first (most reliable)
    if (macAddress) {
      device = await prisma.device.findUnique({
        where: { mac_address: macAddress }
      });
    }

    // Fallback to device ID if not found by MAC
    if (!device && deviceId) {
      device = await prisma.device.findUnique({
        where: { device_id: deviceId }
      });
    }

    if (!device) {
      return res.status(404).json({
        error: 'Device not found',
        message: 'Device must be registered before accessing this endpoint'
      });
    }

    if (!device.authorized) {
      return res.status(403).json({
        error: 'Device not authorized',
        message: 'Device registration is pending authorization'
      });
    }

    // Attach device info to request
    req.deviceId = device.device_id;
    req.macAddress = device.mac_address || undefined;
    req.deviceDbId = device.id;
    req.deviceAuthorized = device.authorized;

    next();
  } catch (error) {
    console.error('Device authorization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}


