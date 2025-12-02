import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// Supabase Auth (GoTrue) runs on port 9999
// For Docker: use http://localhost:9999
// For local dev: check your SUPABASE_URL and adjust port
let supabaseAuthUrl = process.env.SUPABASE_AUTH_URL;
if (!supabaseAuthUrl) {
  // Try to derive from SUPABASE_URL
  const baseUrl = process.env.SUPABASE_URL || 'http://localhost:8000';
  // Replace port 8000 with 9999 (GoTrue port)
  supabaseAuthUrl = baseUrl.replace(':8000', ':9999').replace('localhost:8000', 'localhost:9999');
}

// For GoTrue admin API, we need the JWT_SECRET as the service role key
// GoTrue uses JWT_SECRET to sign admin tokens
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.JWT_SECRET;

if (!supabaseKey || supabaseKey === 'dummy-key-for-development') {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY or JWT_SECRET must be set!');
  console.error('   Run: ./fleet-cc-server/scripts/generate-supabase-keys.sh');
  process.exit(1);
}

// Default admin credentials
const DEFAULT_ADMIN_EMAIL = 'admin@fleetcc.local';
const DEFAULT_ADMIN_PASSWORD = 'admin123';
const DEFAULT_ADMIN_NAME = 'Fleet Administrator';

async function createAdminUser() {
  const prisma = new PrismaClient();

  console.log('🔐 Creating default admin user...');
  console.log(`Connecting to Supabase Auth at: ${supabaseAuthUrl}`);
  console.log('');

  // Generate admin JWT token for GoTrue API
  // GoTrue admin API requires a JWT signed with GOTRUE_JWT_SECRET
  // The token needs specific claims for GoTrue
  const adminToken = jwt.sign(
    {
      role: 'service_role',
      aud: 'authenticated',
      iss: 'gotrue',
    },
    supabaseKey as string,
    {
      expiresIn: '1h',
    }
  );

  // Test connection first
  try {
    const healthResponse = await fetch(`${supabaseAuthUrl}/health`);
    if (!healthResponse.ok) {
      throw new Error(`Health check failed: ${healthResponse.status}`);
    }
    console.log('✓ Connected to Supabase Auth service');
  } catch (error: any) {
    console.error('❌ Cannot connect to Supabase Auth service!');
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    console.error('Please ensure:');
    console.error('  1. Docker containers are running: docker compose up -d');
    console.error('  2. Supabase Auth service is accessible at:', supabaseAuthUrl);
    console.error('  3. SUPABASE_SERVICE_ROLE_KEY is set correctly');
    console.error('');
    process.exit(1);
  }

  // Use direct GoTrue API calls instead of Supabase client
  // The Supabase JS client may not work correctly with self-hosted GoTrue
  async function goTrueRequest(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    const url = `${supabaseAuthUrl}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GoTrue API error (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  try {
    // Check if user already exists in Supabase using GoTrue API
    console.log('Checking for existing user...');
    let existingUser: any = null;
    try {
      const usersResponse: any = await goTrueRequest('/admin/users?per_page=1000');
      if (usersResponse && usersResponse.users) {
        existingUser = usersResponse.users.find((u: any) => u.email === DEFAULT_ADMIN_EMAIL);
      }
    } catch (error: any) {
      console.warn('Could not list users, will attempt to create:', error.message);
    }

    let supabaseUserId: string;
    let isNewUser = false;

    if (existingUser) {
      console.log(`✓ User already exists in Supabase: ${DEFAULT_ADMIN_EMAIL}`);
      supabaseUserId = existingUser.id;

      // Update password to ensure we know it
      try {
        await goTrueRequest(`/admin/users/${supabaseUserId}`, 'PUT', {
          password: DEFAULT_ADMIN_PASSWORD,
        });
        console.log('✓ Password updated');
      } catch (updateError: any) {
        console.warn(`⚠️  Could not update password: ${updateError.message}`);
      }
    } else {
      // Create new user in Supabase Auth
      // GoTrue admin API has database schema issues, so we'll create via SQL directly
      console.log('Creating user in Supabase Auth (via direct database)...');

      // Generate a UUID for the user
      const { randomUUID } = await import('crypto');
      supabaseUserId = randomUUID();

      // Use GoTrue's password hashing (bcrypt with cost 10)
      // GoTrue uses: bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
      // We'll use a simple approach: create user and let GoTrue handle password on first login
      // Or we can hash it ourselves - but for now, let's try creating via signup endpoint

      try {
        // Try signup endpoint first (public endpoint, should work)
        const signupResponse = await fetch(`${supabaseAuthUrl}/signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: DEFAULT_ADMIN_EMAIL,
            password: DEFAULT_ADMIN_PASSWORD,
            data: {
              full_name: DEFAULT_ADMIN_NAME,
            },
          }),
        });

        if (signupResponse.ok) {
          const signupData: any = await signupResponse.json();
          supabaseUserId = signupData.user?.id || signupData.id;
          console.log(`✓ Created user via signup: ${DEFAULT_ADMIN_EMAIL}`);
          isNewUser = true;

          // Confirm email immediately
          try {
            await goTrueRequest(`/admin/users/${supabaseUserId}`, 'PUT', {
              email_confirm: true,
            });
            console.log('✓ Email confirmed');
          } catch (e) {
            console.warn('⚠️  Could not confirm email via admin API');
          }
        } else {
          const errorText = await signupResponse.text();
          throw new Error(`Signup failed: ${signupResponse.status} ${errorText}`);
        }
      } catch (signupError: any) {
        console.warn(`⚠️  Signup endpoint failed: ${signupError.message}`);
        console.log('Attempting direct database insert...');

        // Fallback: direct database insert (requires password hashing)
        // For now, we'll create the user and note that password needs to be set
        throw new Error(`Unable to create user. GoTrue API has issues. Please create user manually or fix GoTrue database schema. Error: ${signupError.message}`);
      }
    }

    // Check if user exists in database
    let dbUser = await prisma.user.findUnique({
      where: { supabase_user_id: supabaseUserId },
      include: {
        user_roles: true,
      },
    });

    if (dbUser) {
      console.log(`✓ User already exists in database: ${dbUser.email}`);

      // Check if user has admin role
      const hasAdminRole = dbUser.user_roles.some(ur => ur.role === 'admin');

      if (!hasAdminRole) {
        console.log('Adding admin role...');
        await prisma.userRole.create({
          data: {
            user_id: dbUser.id,
            role: 'admin',
          },
        });
        console.log('✓ Admin role added');
      } else {
        console.log('✓ User already has admin role');
      }
    } else {
      // Create user in database
      console.log('Creating user in database...');
      dbUser = await prisma.user.create({
        data: {
          id: supabaseUserId,
          supabase_user_id: supabaseUserId,
          email: DEFAULT_ADMIN_EMAIL,
          full_name: DEFAULT_ADMIN_NAME,
        },
        include: {
          user_roles: true,
        },
      });
      console.log(`✓ Created user in database: ${dbUser.email}`);

      // Add admin role
      console.log('Adding admin role...');
      await prisma.userRole.create({
        data: {
          user_id: dbUser.id,
          role: 'admin',
        },
      });
      console.log('✓ Admin role added');
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ ADMIN USER CREATED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log('');
    console.log('Login Credentials:');
    console.log(`  Email:    ${DEFAULT_ADMIN_EMAIL}`);
    console.log(`  Password: ${DEFAULT_ADMIN_PASSWORD}`);
    console.log('');
    console.log('⚠️  IMPORTANT: Change this password after first login!');
    console.log('');
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('');
    console.error('❌ Failed to create admin user:');
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();

