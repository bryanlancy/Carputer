import { PrismaClient } from '@prisma/client';

/**
 * Image Verification Service
 *
 * Manages verification of carputer images to ensure only authorized
 * images can register devices with the fleet server.
 * Works with the new images table structure.
 */
export class ImageVerificationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get or create an image by build hash
   * If image doesn't exist, creates it with verified=false (unverified)
   */
  async getOrCreateImage(
    buildHash: string,
    options: {
      signature?: string;
      buildId?: string;
      gitSha?: string;
      buildTimestamp?: Date;
      verified?: boolean;
    } = {}
  ): Promise<any> {
    if (!buildHash) {
      throw new Error('Image build hash is required');
    }

    // Try to get existing image
    let image = await this.prisma.image.findUnique({
      where: { image_build_hash: buildHash }
    });

    if (image) {
      return image;
    }

    // Create new image as unverified if not specified
    const verified = options.verified !== undefined ? options.verified : false;

    image = await this.prisma.image.create({
      data: {
        image_build_hash: buildHash,
        image_signature: options.signature || null,
        build_id: options.buildId || null,
        git_sha: options.gitSha || null,
        build_timestamp: options.buildTimestamp || null,
        verified: verified
      }
    });

    return image;
  }

  /**
   * Verify if an image build hash is authorized (verified and active)
   */
  async isImageVerified(buildHash: string): Promise<boolean> {
    if (!buildHash) {
      return false;
    }

    const image = await this.prisma.image.findFirst({
      where: {
        image_build_hash: buildHash,
        verified: true,
        is_active: true
      }
    });

    return image !== null;
  }

  /**
   * Verify if an image signature is valid for a build hash
   */
  async verifyImageSignature(buildHash: string, signature: string): Promise<boolean> {
    if (!buildHash || !signature) {
      return false;
    }

    const image = await this.prisma.image.findFirst({
      where: {
        image_build_hash: buildHash,
        verified: true,
        is_active: true
      }
    });

    if (!image) {
      return false;
    }

    // If no signature stored, just check build hash
    if (!image.image_signature) {
      return true;
    }

    // Compare signatures (in production, use cryptographic verification)
    return image.image_signature === signature;
  }

  /**
   * Add or update a verified image
   */
  async addVerifiedImage(
    buildHash: string,
    options: {
      signature?: string;
      buildId?: string;
      gitSha?: string;
      buildTimestamp?: Date;
      verifiedBy?: string;
      notes?: string;
    } = {}
  ): Promise<any> {
    const now = new Date();
    const image = await this.prisma.image.upsert({
      where: { image_build_hash: buildHash },
      update: {
        image_signature: options.signature || undefined,
        build_id: options.buildId || undefined,
        git_sha: options.gitSha || undefined,
        build_timestamp: options.buildTimestamp || undefined,
        verified_by: options.verifiedBy || 'system',
        notes: options.notes || undefined,
        verified: true,
        is_active: true,
        verified_at: now
      },
      create: {
        image_build_hash: buildHash,
        image_signature: options.signature || null,
        build_id: options.buildId || null,
        git_sha: options.gitSha || null,
        build_timestamp: options.buildTimestamp || null,
        verified_by: options.verifiedBy || 'system',
        notes: options.notes || null,
        verified: true,
        is_active: true,
        verified_at: now
      }
    });

    return image;
  }

  /**
   * Mark an image as verified
   */
  async markImageAsVerified(
    buildHash: string,
    options: {
      verifiedBy?: string;
      notes?: string;
    } = {}
  ): Promise<any> {
    const image = await this.prisma.image.findUnique({
      where: { image_build_hash: buildHash }
    });

    if (!image) {
      return null;
    }

    const updated = await this.prisma.image.update({
      where: { image_build_hash: buildHash },
      data: {
        verified: true,
        verified_at: new Date(),
        verified_by: options.verifiedBy || image.verified_by,
        notes: options.notes || image.notes
      }
    });

    return updated;
  }

  /**
   * Deactivate an image
   */
  async deactivateImage(buildHash: string): Promise<void> {
    await this.prisma.image.update({
      where: { image_build_hash: buildHash },
      data: { is_active: false }
    });
  }

  /**
   * Get all images with device counts
   */
  async getImagesWithDeviceCounts(options: {
    includeUnverified?: boolean;
    activeOnly?: boolean;
  } = {}): Promise<any[]> {
    const includeUnverified = options.includeUnverified !== false;
    const activeOnly = options.activeOnly !== false;

    const where: any = {};
    if (!includeUnverified) {
      where.verified = true;
    }
    if (activeOnly) {
      where.is_active = true;
    }

    const images = await this.prisma.image.findMany({
      where,
      include: {
        devices: {
          select: {
            id: true,
            status: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    return images.map(image => ({
      ...image,
      device_count: image.devices.length,
      online_device_count: image.devices.filter(d => d.status === 'online').length
    }));
  }

  /**
   * Get image by build hash with device list
   */
  async getImageWithDevices(buildHash: string): Promise<any | null> {
    const image = await this.prisma.image.findUnique({
      where: { image_build_hash: buildHash },
      include: {
        devices: {
          select: {
            id: true,
            device_id: true,
            hostname: true,
            status: true,
            last_seen: true,
            current_version: true,
            current_build_id: true
          },
          orderBy: {
            last_seen: 'desc'
          }
        }
      }
    });

    if (!image) {
      return null;
    }

    return {
      ...image,
      devices: image.devices,
      device_count: image.devices.length,
      online_device_count: image.devices.filter(d => d.status === 'online').length,
    };
  }

  /**
   * Get all images (legacy method for backward compatibility)
   */
  async getVerifiedImages(activeOnly: boolean = true): Promise<any[]> {
    const images = await this.prisma.image.findMany({
      where: {
        verified: true,
        ...(activeOnly && { is_active: true })
      },
      orderBy: {
        verified_at: 'desc'
      }
    });

    return images;
  }

  /**
   * Get image by build hash (legacy method for backward compatibility)
   */
  async getVerifiedImage(buildHash: string): Promise<any | null> {
    const image = await this.prisma.image.findUnique({
      where: { image_build_hash: buildHash }
    });

    return image;
  }
}


