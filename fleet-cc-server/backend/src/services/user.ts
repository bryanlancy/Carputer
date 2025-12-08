import { PrismaClient } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:8000';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.JWT_SECRET || 'dummy-key-for-development';

let supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

/**
 * User Service
 * Manages user accounts synced from Supabase Auth
 */
export class UserService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Sync user from Supabase Auth to local database
   */
  async syncUserFromSupabase(supabaseUserId: string): Promise<any> {
    const client = getSupabaseClient();
    const { data: supabaseUser, error } = await client.auth.admin.getUserById(supabaseUserId);

    if (error || !supabaseUser?.user) {
      throw new Error(`User not found in Supabase: ${supabaseUserId}`);
    }

    const userData = supabaseUser.user;

    // Check if user already exists
    let user = await this.prisma.user.findUnique({
      where: { supabase_user_id: supabaseUserId },
      include: {
        user_roles: true,
      },
    });

    if (user) {
      // Update existing user
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          email: userData.email || user.email,
          full_name: userData.user_metadata?.full_name || user.full_name,
          avatar_url: userData.user_metadata?.avatar_url || user.avatar_url,
        },
        include: {
          user_roles: true,
        },
      });
    } else {
      // Create new user
      user = await this.prisma.user.create({
        data: {
          id: userData.id,
          supabase_user_id: userData.id,
          email: userData.email || '',
          full_name: userData.user_metadata?.full_name || null,
          avatar_url: userData.user_metadata?.avatar_url || null,
        },
        include: {
          user_roles: true,
        },
      });
    }

    // Sync roles from Supabase metadata
    const roles = userData.user_metadata?.roles || userData.app_metadata?.roles || [];
    if (Array.isArray(roles) && roles.length > 0) {
      // Remove existing roles
      await this.prisma.userRole.deleteMany({
        where: { user_id: user.id },
      });

      // Add new roles
      for (const role of roles) {
        if (['admin', 'operator', 'viewer'].includes(role)) {
          await this.prisma.userRole.upsert({
            where: {
              user_id_role: {
                user_id: user.id,
                role: role,
              },
            },
            create: {
              user_id: user.id,
              role: role,
            },
            update: {},
          });
        }
      }
    }

    // Reload user with roles
    return this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        user_roles: true,
      },
    });
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<any> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        user_roles: true,
        notification_preferences: true,
      },
    });
  }

  /**
   * Get user by Supabase user ID
   */
  async getUserBySupabaseId(supabaseUserId: string): Promise<any> {
    return this.prisma.user.findUnique({
      where: { supabase_user_id: supabaseUserId },
      include: {
        user_roles: true,
        notification_preferences: true,
      },
    });
  }

  /**
   * Get all users
   */
  async getAllUsers(options: {
    limit?: number;
    offset?: number;
    role?: string;
  } = {}): Promise<any[]> {
    const where: any = {};

    if (options.role) {
      where.user_roles = {
        some: {
          role: options.role,
        },
      };
    }

    return this.prisma.user.findMany({
      where,
      include: {
        user_roles: true,
      },
      take: options.limit || 100,
      skip: options.offset || 0,
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  /**
   * Update user roles
   */
  async updateUserRoles(userId: string, roles: string[]): Promise<any> {
    // Validate roles
    const validRoles = roles.filter(r => ['admin', 'operator', 'viewer'].includes(r));

    // Remove existing roles
    await this.prisma.userRole.deleteMany({
      where: { user_id: userId },
    });

    // Add new roles
    for (const role of validRoles) {
      await this.prisma.userRole.create({
        data: {
          user_id: userId,
          role: role,
        },
      });
    }

    // Update Supabase metadata
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (user) {
      const client = getSupabaseClient();
      await client.auth.admin.updateUserById(user.supabase_user_id, {
        user_metadata: {
          roles: validRoles,
        },
        app_metadata: {
          roles: validRoles,
        },
      });
    }

    return this.getUserById(userId);
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id: userId },
    });
  }
}


