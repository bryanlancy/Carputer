import { createClient } from '@supabase/supabase-js'

// Get environment variables - try multiple sources
// In Docker, env vars might come from docker-compose environment section
// In local dev, they come from .env file
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  (typeof window !== 'undefined' && (window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_SUPABASE_URL) ||
  'http://localhost:9999'

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
  (typeof window !== 'undefined' && (window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  ''

// Validate configuration
if (!supabaseUrl || !supabaseAnonKey) {
  const missingVars: string[] = []
  if (!supabaseUrl) missingVars.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!supabaseAnonKey) missingVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')

  const errorMsg = `Supabase configuration missing! Missing: ${missingVars.join(', ')}`

  console.error('='.repeat(60))
  console.error('❌ SUPABASE CONFIGURATION ERROR')
  console.error('='.repeat(60))
  console.error(errorMsg)
  console.error('')
  console.error('Current environment variables:')
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl || '❌ NOT SET')
  console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ SET' : '❌ NOT SET')
  console.error('')
  console.error('To fix this:')
  console.error('1. Ensure fleet-cc-server/frontend/.env exists')
  console.error('2. Add the following variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL=http://localhost:9999')
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-jwt-secret>')
  console.error('3. Run: ./fleet-cc-server/scripts/generate-supabase-keys.sh')
  console.error('4. Restart your Next.js dev server')
  console.error('='.repeat(60))

  throw new Error(errorMsg)
}

// Use defaults if not set (for development)
// For self-hosted GoTrue, we need to use a proxy since GoTrue doesn't support /auth/v1/ prefix
// The proxy is at /api/auth/* and routes /auth/v1/* requests to GoTrue on port 9999
const isClient = typeof window !== 'undefined'
const baseUrl = isClient ? window.location.origin : 'http://localhost:3000'
const finalSupabaseUrl = isClient
  ? `${baseUrl}/api`  // Use Next.js API proxy for client-side (client will append /auth/v1/token)
  : (supabaseUrl || 'http://localhost:9999')  // Direct connection for server-side
const finalSupabaseAnonKey = supabaseAnonKey

export const supabase = createClient(finalSupabaseUrl, finalSupabaseAnonKey)

